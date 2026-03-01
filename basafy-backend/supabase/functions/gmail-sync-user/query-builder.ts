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

  // Core ATS / recruiting platform domains (top ~25 by volume)
  const coreDomains = [
    'lever.co', 'greenhouse.io', 'grnh.se', 'ashbyhq.com',
    'workday.com', 'myworkdayjobs.com', 'myworkday.com',
    'icims.com', 'taleo.net', 'successfactors.com',
    'smartrecruiters.com', 'workable.com', 'jobvite.com',
    'bamboohr.com', 'dover.io', 'gem.com',
    'wellfound.com', 'hired.com', 'otta.com',
    'eightfold.ai', 'phenom.com', 'rippling.com',
    // Assessment / scheduling
    'codesignal.com', 'hackerrank.com', 'hirevue.com',
    'calendly.com', 'goodtime.io',
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

  // Broad subject/from keywords — catch-all for job-related emails
  // These are intentionally short & inclusive. The LLM filters non-job emails later.
  const broadKeywords = [
    'application', 'interview', 'offer', 'assessment',
    '"next steps"', 'position', 'role', 'opportunity',
    'onboarding', '"background check"', '"start date"',
    'recruiter', '"hiring team"', '"talent acquisition"',
    '"phone screen"', '"coding challenge"', '"offer letter"',
    'congratulations', '"unfortunately"', '"moving forward"',
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
  ];

  // Phrases that signal newsletter/digest noise
  const excludedPhrases = [
    '"job alert"',
    '"password reset"',
    '"jobs digest"',
    '"weekly digest"',
    '"new jobs for"',
  ];

  // Build the query
  let query = baseQuery;

  // Single OR group: from domain matches OR broad subject/from keywords
  query += '(';
  query += `from:(${combinedDomains.join(' OR ')})`;
  query += ` OR subject:(${broadKeywords.join(' OR ')})`;
  query += ` OR from:(${broadKeywords.slice(11).join(' OR ')})`; // recruiter/hiring team/talent keywords in from
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
