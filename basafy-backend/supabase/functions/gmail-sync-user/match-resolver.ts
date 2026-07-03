import { adjudicateApplicationMatch, type MatchAdjudication } from './match-adjudicator.ts';
import { normalizeCompanyEntity, normalizeRoleEntity, rolesHaveConflictingLevels } from './entity-normalization.ts';
import type { ApplicationMatchDecision, ParsedEmailResult } from './types.ts';
import { computeTokenSimilarity } from './utils.ts';

export interface MatchableApplication {
  id: string;
  company: string | null;
  role: string | null;
  status: string | null;
  applied_at?: string | null;
  created_at?: string | null;
  gmail_message_id?: string | null;
  gmail_thread_id?: string | null;
  internet_message_id?: string | null;
  canonical_key?: string | null;
  portal_domain?: string | null;
}

export interface ResolvedApplicationMatch {
  application: MatchableApplication | null;
  evidence: ApplicationMatchDecision;
}

type PreparedApplication = {
  application: MatchableApplication;
  company: ReturnType<typeof normalizeCompanyEntity>;
  role: ReturnType<typeof normalizeRoleEntity>;
};

type Adjudicator = (
  email: ParsedEmailResult,
  candidates: MatchableApplication[],
) => Promise<MatchAdjudication>;

export async function resolveApplicationMatches(options: {
  emails: ParsedEmailResult[];
  applications: MatchableApplication[];
  exactApplicationIdsByMessage?: ReadonlyMap<string, string>;
  adjudicator?: Adjudicator;
  maxAdjudications?: number;
}): Promise<Map<string, ResolvedApplicationMatch>> {
  const output = new Map<string, ResolvedApplicationMatch>();
  const byId = new Map(options.applications.map((application) => [application.id, application]));
  const preparedApplications: PreparedApplication[] = options.applications.map((application) => ({
    application,
    company: normalizeCompanyEntity(application.company, application.portal_domain),
    role: normalizeRoleEntity(application.role),
  }));
  const companyCounts = new Map<string, number>();
  for (const prepared of preparedApplications) {
    if (!prepared.company.normalizedKey) continue;
    companyCounts.set(prepared.company.normalizedKey, (companyCounts.get(prepared.company.normalizedKey) ?? 0) + 1);
  }
  const adjudicator = options.adjudicator ?? adjudicateApplicationMatch;
  let adjudications = 0;

  for (const email of options.emails) {
    if (!email.gmailMessageId) continue;
    const exactId = options.exactApplicationIdsByMessage?.get(email.gmailMessageId);
    if (exactId && byId.has(exactId)) {
      const application = byId.get(exactId)!;
      output.set(email.gmailMessageId, resolved(email, application, 'exact_message', 1, 'Exact previously processed Gmail message.'));
      continue;
    }

    const emailCompany = normalizeCompanyEntity(email.company, senderDomain(email.rawFrom));
    const emailRole = normalizeRoleEntity(email.role);
    const sameCompanyCount = emailCompany.normalizedKey ? companyCounts.get(emailCompany.normalizedKey) ?? 0 : 0;
    const ranked = preparedApplications
      .map((application) => scoreCandidate(email, emailCompany, emailRole, application, sameCompanyCount))
      .sort((a, b) => b.score - a.score);
    const best = ranked[0];
    const candidateIds = ranked.filter((candidate) => candidate.score >= 0.35).slice(0, 5).map((candidate) => candidate.application.id);

    if (best && best.score >= 0.85) {
      output.set(email.gmailMessageId, {
        application: best.application,
        evidence: toEvidence(email, best, 'match_existing', best.reason, candidateIds),
      });
      continue;
    }

    if (best && best.score >= 0.65) {
      if (adjudications < (options.maxAdjudications ?? 3)) {
        adjudications += 1;
        const candidates = ranked.slice(0, 3).map((candidate) => candidate.application);
        const adjudication = await adjudicator(email, candidates);
        if (adjudication.decision === 'match_existing' && adjudication.confidence >= 0.8 && adjudication.matchedApplicationId) {
          const matched = byId.get(adjudication.matchedApplicationId) ?? null;
          if (matched) {
            output.set(email.gmailMessageId, {
              application: matched,
              evidence: {
                ...toEvidence(email, best, 'match_existing', `LLM adjudication: ${adjudication.reason}`, candidateIds),
                matchedApplicationId: matched.id,
                matchType: 'llm_adjudicated',
                matchScore: Math.max(best.score, adjudication.confidence),
              },
            });
            continue;
          }
        }
        if (adjudication.decision === 'create_new' && adjudication.confidence >= 0.8) {
          output.set(email.gmailMessageId, unresolved(email, 'create_new', 'llm_create_new', best, `LLM adjudication: ${adjudication.reason}`, candidateIds));
          continue;
        }
        output.set(email.gmailMessageId, unresolved(email, 'needs_review', 'uncertain_score', best, `Uncertain match requires review. ${adjudication.reason}`, candidateIds));
        continue;
      }
      output.set(email.gmailMessageId, unresolved(email, 'needs_review', 'adjudication_limit', best, 'Uncertain match held because the adjudication limit was reached.', candidateIds));
      continue;
    }

    const companyCandidates = ranked.filter((candidate) => candidate.companyScore > 0).map((candidate) => candidate.application.id);
    const decision = companyCandidates.length > 1 && !email.role
      ? 'possible_duplicate'
      : emailCompany.canonicalName && email.role
        ? 'create_new'
        : 'unmatched_job_event';
    output.set(email.gmailMessageId, unresolved(
      email,
      decision,
      decision,
      best,
      decision === 'possible_duplicate'
        ? 'Multiple applications exist for this company and the email has no reliable role.'
        : decision === 'create_new'
          ? 'No candidate reached the minimum match threshold; create a distinct application.'
          : 'Insufficient company and role evidence to create or match an application.',
      companyCandidates,
    ));
  }
  return output;
}

function scoreCandidate(
  email: ParsedEmailResult,
  emailCompany: ReturnType<typeof normalizeCompanyEntity>,
  emailRole: ReturnType<typeof normalizeRoleEntity>,
  prepared: PreparedApplication,
  sameCompanyCount: number,
) {
  const { application, company: appCompany, role: appRole } = prepared;
  const companyScore = emailCompany.normalizedKey && emailCompany.normalizedKey === appCompany.normalizedKey ? 1 : 0;
  const roleSimilarity = emailRole.normalizedKey && appRole.normalizedKey
    ? computeTokenSimilarity(emailRole.normalizedKey, appRole.normalizedKey)
    : 0;
  const sameFamily = !!emailRole.family && emailRole.family === appRole.family;
  const conflictingLevels = rolesHaveConflictingLevels(emailRole.level, appRole.level);
  const roleScore = conflictingLevels ? 0 : Math.max(roleSimilarity, sameFamily ? 0.75 : 0);
  const threadScore = email.gmailThreadId && application.gmail_thread_id === email.gmailThreadId ? 1 : 0;
  const domainScore = emailCompany.domain && appCompany.domain && emailCompany.domain === appCompany.domain ? 1 : 0;
  const timelineScore = timelineProximity(email.receivedAt, application.applied_at ?? application.created_at);
  const eventScore = eventCompatibility(email.eventType, application.status) ? 1 : 0;
  const canonicalExact = !!email.canonicalKey && email.canonicalKey === application.canonical_key;
  let score = canonicalExact
    ? 0.95
    : companyScore * 0.35 + roleScore * 0.3 + threadScore * 0.25 + domainScore * 0.1 + timelineScore * 0.1 + eventScore * 0.05;
  if (sameCompanyCount > 1 && !email.role) score -= 0.2;
  if (conflictingLevels) score -= 0.15;
  score = Math.max(0, Math.min(1, score));
  const matchType = canonicalExact
    ? 'canonical_key'
    : threadScore && companyScore && roleScore
      ? 'thread_company_role'
      : companyScore && roleScore
        ? 'company_role'
        : threadScore
          ? 'thread_supporting_signal'
          : 'scored_candidate';
  return {
    application,
    score,
    companyScore,
    roleScore,
    threadScore,
    domainScore,
    timelineScore,
    matchType,
    reason: `Score ${score.toFixed(2)} from company ${companyScore.toFixed(2)}, role ${roleScore.toFixed(2)}, thread ${threadScore.toFixed(2)}, domain ${domainScore.toFixed(2)}, and timeline ${timelineScore.toFixed(2)}.`,
  };
}

function toEvidence(
  email: ParsedEmailResult,
  candidate: ReturnType<typeof scoreCandidate>,
  decision: ApplicationMatchDecision['decision'],
  reason: string,
  candidateIds: string[],
): ApplicationMatchDecision {
  return {
    gmailMessageId: email.gmailMessageId!,
    matchedApplicationId: candidate.application.id,
    matchType: candidate.matchType,
    matchScore: candidate.score,
    companyScore: candidate.companyScore,
    roleScore: candidate.roleScore,
    threadScore: candidate.threadScore,
    domainScore: candidate.domainScore,
    timelineScore: candidate.timelineScore,
    decision,
    reason,
    candidateApplicationIds: candidateIds,
  };
}

function unresolved(
  email: ParsedEmailResult,
  decision: ApplicationMatchDecision['decision'],
  matchType: string,
  candidate: ReturnType<typeof scoreCandidate> | undefined,
  reason: string,
  candidateIds: string[],
): ResolvedApplicationMatch {
  const fallback = candidate;
  return {
    application: null,
    evidence: {
      gmailMessageId: email.gmailMessageId!,
      matchedApplicationId: null,
      matchType,
      matchScore: fallback?.score ?? 0,
      companyScore: fallback?.companyScore ?? 0,
      roleScore: fallback?.roleScore ?? 0,
      threadScore: fallback?.threadScore ?? 0,
      domainScore: fallback?.domainScore ?? 0,
      timelineScore: fallback?.timelineScore ?? 0,
      decision,
      reason,
      candidateApplicationIds: candidateIds,
    },
  };
}

function resolved(email: ParsedEmailResult, application: MatchableApplication, type: string, score: number, reason: string): ResolvedApplicationMatch {
  return {
    application,
    evidence: {
      gmailMessageId: email.gmailMessageId!,
      matchedApplicationId: application.id,
      matchType: type,
      matchScore: score,
      companyScore: 1,
      roleScore: 1,
      threadScore: 1,
      domainScore: 1,
      timelineScore: 1,
      decision: 'match_existing',
      reason,
      candidateApplicationIds: [application.id],
    },
  };
}

function senderDomain(from?: string | null) {
  return from?.match(/@([a-z0-9.-]+)/i)?.[1]?.toLowerCase() ?? null;
}

function timelineProximity(emailDate?: string | null, appDate?: string | null) {
  if (!emailDate || !appDate) return 0.5;
  const days = Math.abs(new Date(emailDate).getTime() - new Date(appDate).getTime()) / 86_400_000;
  if (!Number.isFinite(days)) return 0;
  if (days <= 180) return 1;
  if (days <= 365) return 0.5;
  return 0;
}

function eventCompatibility(eventType: string, status?: string | null) {
  const eventRank: Record<string, number> = { application_received: 1, assessment: 2, interview_invite: 3, rejection: 4, offer: 5, other: 0 };
  const statusRank: Record<string, number> = { applied: 1, assessment: 2, interview: 3, rejected: 4, offer: 5 };
  const incoming = eventRank[eventType] ?? 0;
  const existing = statusRank[(status ?? '').toLowerCase()] ?? 0;
  return incoming === 0 || existing === 0 || incoming >= existing || eventType === 'rejection';
}
