// Gmail query builder for job-related email searching.
// Buckets are intentionally targeted so parsing refines candidates instead of
// carrying generic platform noise through the whole pipeline.

// ============================================================================
// Optimized Gmail Query Builder
// ============================================================================

export type GmailQueryBucketName =
  | 'application_confirmation'
  | 'interview'
  | 'assessment'
  | 'rejection'
  | 'offer'
  | 'recruiter'
  | 'scheduling'
  | 'platform_updates'
  | 'followup';

export interface GmailQueryBucket {
  name: GmailQueryBucketName;
  query: string;
}

export function buildGmailQueryBuckets(options: {
  hardSync?: boolean;
  lookbackMonths?: number | string | null;
  lastSyncedAt?: string | null;
  isInitialImport?: boolean;
  priorityDomains?: string[] | null;
}): GmailQueryBucket[] {
  const scope = options.hardSync
    ? 'in:anywhere'
    : '{in:inbox in:category:promotions in:category:updates} -category:social -category:forums -is:chat';
  const dateFilter = buildDateFilter(options);
  const priorityDomains = normalizePriorityDomains(options.priorityDomains);
  const platformDomains = [
    'linkedin.com', 'indeed.com', 'ziprecruiter.com', 'glassdoor.com',
    'greenhouse.io', 'grnh.se', 'lever.co', 'workday.com', 'myworkdayjobs.com',
    'ashbyhq.com', 'icims.com', 'smartrecruiters.com', 'jobvite.com', 'taleo.net',
  ];
  const allPlatformDomains = Array.from(new Set([...platformDomains, ...priorityDomains]));
  const platformLifecycleTerms = [
    'subject:"your application"',
    'subject:"application received"',
    'subject:"application submitted"',
    'subject:"application status"',
    'subject:"thank you for applying"',
    'subject:interview',
    'subject:"phone screen"',
    'subject:"technical screen"',
    'subject:assessment',
    'subject:"coding challenge"',
    'subject:"not moving forward"',
    'subject:"after careful consideration"',
    'subject:offer',
    'subject:"offer letter"',
    'subject:"next steps"',
    'subject:schedule',
    'subject:availability',
  ].join(' ');
  const definitions: Array<[GmailQueryBucketName, string]> = [
    ['application_confirmation', '{subject:"thank you for applying" subject:"application received" subject:"we received your application" subject:"application submitted"}'],
    ['interview', '{subject:interview subject:"schedule a call" subject:"next steps" subject:availability subject:"phone screen" subject:"technical screen"}'],
    ['assessment', `{subject:assessment subject:"coding challenge" subject:"take-home" subject:"technical assessment" from:(hackerrank.com OR codesignal.com OR codility.com OR hirevue.com)}`],
    ['rejection', '{subject:unfortunately subject:"not moving forward" subject:"after careful consideration" subject:"not selected" subject:"other candidates"}'],
    ['offer', '{subject:offer subject:"pleased to offer" subject:congratulations subject:"offer letter"}'],
    ['recruiter', '{from:(recruiter OR recruiting OR talent) subject:recruiter subject:"talent acquisition"}'],
    ['scheduling', '{subject:schedule subject:scheduling subject:availability from:(calendly.com OR goodtime.io OR cronofy.com)}'],
    ['platform_updates', `from:(${allPlatformDomains.join(' OR ')}) {${platformLifecycleTerms}}`],
    ['followup', '{subject:"follow up" subject:"following up" subject:"checking in" subject:"application status"}'],
  ];

  return definitions.map(([name, signal]) => ({
    name,
    query: `${scope} (${signal}) ${dateFilter}`.trim(),
  }));
}

function normalizePriorityDomains(values?: string[] | null) {
  return Array.from(new Set((values ?? []).map((value) => value.trim().toLowerCase())
    .map((value) => value.replace(/^https?:\/\//, '').replace(/^@/, '').split('/')[0])
    .filter((value) => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(value)))).slice(0, 25);
}

function buildDateFilter(options: {
  hardSync?: boolean;
  lookbackMonths?: number | string | null;
  lastSyncedAt?: string | null;
  isInitialImport?: boolean;
}) {
  let after: Date | null = null;
  if (options.hardSync || options.isInitialImport) {
    const fallback = options.isInitialImport ? 3 : null;
    const requested = Number(options.lookbackMonths ?? fallback);
    if (Number.isFinite(requested) && requested > 0) {
      after = new Date(Date.now() - Math.min(24, Math.max(1, requested)) * 30 * 24 * 60 * 60 * 1000);
    }
  } else if (options.lastSyncedAt) {
    const parsed = new Date(options.lastSyncedAt);
    if (!Number.isNaN(parsed.getTime())) after = parsed;
  }
  return after ? `after:${after.toISOString().slice(0, 10).replace(/-/g, '/')}` : '';
}

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

  // Core ATS / recruiting platform domains. In the fallback query these domains
  // are paired with lifecycle subject terms instead of queried alone.
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

  const lifecycleSubjectKeywords = [
    '"your application"', '"job application"', '"application status"',
    '"thank you for applying"', '"we received your"', '"application received"',
    '"application submitted"', '"application confirmation"',
    'interview', '"phone screen"', '"technical screen"',
    '"video interview"', '"technical interview"',
    'assessment', '"coding challenge"', '"take-home"', '"take home"',
    '"technical assessment"', '"online assessment"',
    '"offer letter"', '"job offer"', '"pleased to offer"',
    '"unfortunately"', '"not moving forward"', '"we regret"',
    '"not selected"', '"after careful consideration"', '"other candidates"',
    '"next steps"', '"next round"', '"moving forward"', '"move forward"',
    'schedule', 'scheduling', 'availability',
    '"background check"', '"follow up"', '"following up"',
  ];

  // Strong standalone subject terms that can retrieve non-platform emails.
  const subjectKeywords = [
    ...lifecycleSubjectKeywords,
    '"hiring team"', '"talent acquisition"', 'recruiter',
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
    '"candidate profile"',
    '"career profile"',
    '"profile suggestions"',
    '"complete your profile"',
  ];

  // Build the query
  let query = baseQuery;

  // Single OR group: platform domain plus lifecycle subject terms OR strong
  // lifecycle subject keywords OR recruiter-style sender names.
  query += '(';
  query += `(from:(${combinedDomains.join(' OR ')}) subject:(${lifecycleSubjectKeywords.join(' OR ')}))`;
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
