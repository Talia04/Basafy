// Gmail query builder for job-related email searching
// Simplified, broader query — relies on LLM to filter non-job emails at parse time.

// ============================================================================
// Optimized Gmail Query Builder
// ============================================================================

export function buildOptimizedGmailQuery(options: {
  hardSync?: boolean;
  lightSync?: boolean;
  lookbackMonths?: number | string | null;
  lastSyncedAt?: string | null;
  isInitialImport?: boolean;
  priorityDomains?: string[] | null;
}): string {
  const { hardSync, lightSync, lookbackMonths, lastSyncedAt, isInitialImport, priorityDomains } = options;

  // Base query - include promotions/updates tabs since ATS emails often land there
  const baseQuery = hardSync
    ? 'in:anywhere '
    : '{in:inbox in:category:promotions in:category:updates} -category:social -category:forums -is:chat ';

  // Core ATS / recruiting platform domains — broad list so LLM handles filtering
  const coreDomains = [
    // Tier-1 ATS (high volume)
    'lever.co', 'greenhouse.io', 'grnh.se', 'ashbyhq.com',
    'workday.com', 'myworkdayjobs.com', 'myworkday.com',
    'icims.com', 'taleo.net', 'successfactors.com',
    'smartrecruiters.com', 'workable.com', 'jobvite.com',
    'bamboohr.com', 'dover.io', 'gem.com',
    'wellfound.com', 'hired.com', 'otta.com',
    'eightfold.ai', 'phenom.com', 'rippling.com',
    // Mid-market ATS
    'breezy.hr', 'recruitee.com', 'teamtailor.com',
    'jazzhr.com', 'jazz.co', 'pinpoint.com',
    'comeet.com', 'freshteam.com', 'manatal.com',
    'jobscore.com', 'jobdiva.com', 'bullhorn.com',
    'crelate.com', 'applicantpro.com', 'hirebridge.com',
    'pageuppeople.com', 'lumesse.com', 'talentlyft.com',
    'recruitly.io', 'zohorecruit.com', 'hirequest.com',
    'tracker-rms.com', 'vincere.io', 'loxo.co',
    'recruitlab.co', 'occupop.com', 'homerun.co',
    'taleez.com', 'personio.de', 'personio.com',
    'recruitnow.io', 'apploi.com', 'ponty.com',
    // Scheduling & coordination tools used in hiring
    'calendly.com', 'goodtime.io', 'hireflix.com',
    'prelude.co', 'grayscale.ai', 'cronofy.com',
    // Assessment platforms
    'codesignal.com', 'hackerrank.com', 'hirevue.com',
    'codility.com', 'hackerearth.com', 'testgorilla.com',
    'coderbyte.com', 'vervoe.com', 'pymetrics.ai',
    'karat.com', 'interviewing.io', 'pramp.com',
    // Job boards that send application-specific (not just alert) emails
    'linkedin.com', 'ziprecruiter.com', 'dice.com',
    'monster.com', 'indeed.com',
    // Background check / onboarding
    'checkr.com', 'sterlingbackcheck.com', 'hireright.com',
    'accurate.com', 'onfido.com',
  ];

  // Normalize and merge user priority domains
  const normalizeDomain = (value: string) => {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return null;
    const withoutProtocol = trimmed.replace(/^https?:\/\//, '').replace(/^mailto:/, '');
    const withoutAt = withoutProtocol.replace(/^@/, '');
    const domain = withoutAt.split(/[\/\s]+/)[0];
    const sanitized = domain.replace(/[^a-z0-9.-]/g, '').replace(/\.+/g, '.').replace(/^\.+|\.+$/g, '');
    if (!sanitized || !sanitized.includes('.')) return null;
    return sanitized.length <= 253 ? sanitized : null;
  };

  const normalizedPriorityDomains = Array.from(
    new Set(
      (priorityDomains || [])
        .map((domain) => normalizeDomain(domain))
        .filter((domain): domain is string => Boolean(domain)),
    ),
  ).slice(0, 25);

  const combinedDomains = normalizedPriorityDomains.length > 0
    ? Array.from(new Set([...coreDomains, ...normalizedPriorityDomains]))
    : coreDomains;

  // Broad subject keywords — catch-all for job-related emails.
  // Intentionally inclusive; LLM filters non-job emails at parse time.
  const subjectKeywords = [
    // Application lifecycle (most common subjects)
    'application', 'interview', 'offer', 'assessment',
    '"your application"', '"job application"', '"application status"',
    '"thank you for applying"', '"we received your"',
    // Progression / next steps
    '"next steps"', '"moving forward"', '"move forward"',
    '"next round"', '"advance"', '"shortlisted"', '"selected"',
    '"we\'d like to"', '"we would like to"',
    // Scheduling & invitations
    'schedule', 'invitation', '"technical screen"', '"phone screen"',
    '"video interview"', '"technical interview"', '"hiring process"',
    // Assessments & take-homes
    '"coding challenge"', '"take-home"', '"take home"', '"technical assessment"',
    // Offers & onboarding
    '"offer letter"', '"job offer"', '"start date"', 'onboarding',
    // Rejections
    '"unfortunately"', '"not moving forward"', '"we regret"',
    '"not selected"', '"other candidates"',
    // General recruiting terms
    'recruiter', '"hiring team"', '"talent acquisition"',
    '"background check"', 'congratulations', '"follow up"',
    'candidacy', 'hiring', 'position', 'role', 'opportunity',
  ];

  // Keywords that plausibly appear in a sender name or email address.
  // Do NOT include phrases like "phone screen" or "offer letter" — they are
  // never sender names and add nothing to the from: clause.
  const senderKeywords = [
    'recruiter', 'recruiting', 'talent',
    '"hiring team"', '"talent acquisition"', '"people team"',
  ];

  // Senders to exclude (job alert spam, not actual application correspondence)
  const excludedSenders = [
    'jobs-listings@linkedin.com',
    'jobs-noreply@linkedin.com',
    'jobalerts-noreply@linkedin.com',
    'alerts@glassdoor.com',
    'jobs@indeed.com',
    'noreply@indeed.com',
    'noreply@ziprecruiter.com',
    'noreply@glassdoor.com',
    'alert@monster.com',
    'jobalert@dice.com',
    'alerts@dice.com',
    'noreply@linkedin.com',
  ];

  // Phrases that signal newsletter/digest noise
  const excludedPhrases = [
    '"job alert"',
    '"password reset"',
    '"jobs digest"',
    '"weekly digest"',
    '"new jobs for"',
    '"jobs you may like"',
    '"recommended jobs"',
    '"people also viewed"',
  ];

  // Build the query
  let query = baseQuery;

  // Single OR group: from domain matches OR broad subject keywords OR recruiter-style sender names
  query += '(';
  query += `from:(${combinedDomains.join(' OR ')})`;
  query += ` OR subject:(${subjectKeywords.join(' OR ')})`;
  query += ` OR from:(${senderKeywords.join(' OR ')})`; // only actual sender name patterns
  query += ') ';

  // Exclusions
  query += excludedPhrases.map(phrase => `-${phrase}`).join(' ') + ' ';
  query += excludedSenders.map(sender => `-from:${sender}`).join(' ');

  // Apply date filter based on sync type
  if (hardSync) {
    if (lookbackMonths && lookbackMonths !== 'all' && !isNaN(Number(lookbackMonths)) && Number(lookbackMonths) > 0) {
      const months = Math.min(24, Math.max(1, Number(lookbackMonths)));
      const afterDate = new Date(Date.now() - months * 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0]
        .replace(/-/g, '/');
      query += ` after:${afterDate}`;
    }
  } else if (isInitialImport) {
    const months = lookbackMonths && !isNaN(Number(lookbackMonths)) ? Number(lookbackMonths) : 3;
    const afterDate = new Date(Date.now() - months * 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]
      .replace(/-/g, '/');
    query += ` after:${afterDate}`;
  } else if (lastSyncedAt) {
    const afterDate = new Date(lastSyncedAt)
      .toISOString()
      .split('T')[0]
      .replace(/-/g, '/');
    query += ` after:${afterDate}`;
  }

  return query;
}
