// Gmail query builder for job-related email searching

// ============================================================================
// Optimized Gmail Query Builder
// ============================================================================

export function buildOptimizedGmailQuery(options: {
  hardSync?: boolean;
  lightSync?: boolean;
  lookbackMonths?: number | string | null;
  lastSyncedAt?: string | null;
  isInitialImport?: boolean;
}): string {
  const { hardSync, lightSync, lookbackMonths, lastSyncedAt, isInitialImport } = options;

  // Base query - include promotions/updates tabs since ATS emails often land there
  const baseQuery = hardSync
    ? 'in:anywhere '
    : '{in:inbox in:category:promotions in:category:updates} -category:social -category:forums -is:chat ';

  // Comprehensive ATS and recruiting platform domains
  const atsDomains = [
    // Major ATS platforms
    'lever.co', 'greenhouse.io', 'grnh.se', 'ashbyhq.com',
    'workday.com', 'myworkday.com', 'myworkdayjobs.com',
    'icims.com', 'taleo.net', 'successfactors.com',
    'smartrecruiters.com', 'workable.com', 'jobvite.com',
    'bamboohr.com', 'recruitee.com', 'breezy.hr',
    // Job boards & marketplaces
    'wellfound.com', 'angel.co', 'hired.com', 'otta.com',
    'underdog.io', 'workatastartup.com', 'triplebyte.com',
    // Additional ATS
    'dover.io', 'gem.com', 'eightfold.ai', 'phenom.com',
    'beamery.com', 'fountain.com', 'jazzhr.com', 'jazz.co',
    'clearcompany.com', 'hirebridge.com', 'paylocity.com',
    'paycor.com', 'ultipro.com', 'ukg.com', 'adp.com',
    'ceridian.com', 'dayforce.com', 'rippling.com',
    // Assessment platforms
    'codesignal.com', 'hackerrank.com', 'hirevue.com',
    'codility.com', 'hackerearth.com', 'testgorilla.com',
    'criteria.com', 'pymetrics.com', 'harver.com',
    // Scheduling platforms
    'calendly.com', 'goodtime.io', 'paradox.ai',
  ];

  // Recruiter-related keywords in sender name/email
  const recruiterKeywords = [
    'recruiter', '"talent acquisition"', '"hiring team"',
    '"hiring manager"', 'sourcer', '"people team"',
    '"people operations"', '"talent partner"', '"hr team"',
    '"human resources"', '"ta team"', '"recruitment"',
  ];

  // Job-related subject/body keywords - comprehensive list
  const subjectKeywords = [
    // Application status
    'application', '"application received"', '"application status"',
    '"thank you for applying"', '"your application"', '"we received"',
    '"application confirmation"', '"successfully submitted"',
    // Interview related
    'interview', '"phone screen"', '"video interview"',
    '"interview request"', '"interview invite"', '"interview scheduled"',
    '"technical interview"', '"onsite"', '"on-site"', '"final round"',
    '"hiring manager"', 'schedule', 'availability', 'calendly',
    // Assessment related
    'assessment', '"online assessment"', '"coding challenge"',
    '"take-home"', '"technical assessment"', '"skills assessment"',
    'hackerrank', 'codesignal', 'codility', 'hirevue',
    // Offer related
    '"job offer"', 'offer', '"offer letter"', '"congratulations"',
    // Rejection related
    '"unfortunately"', '"not moving forward"', '"other candidates"',
    '"position has been filled"', '"decided to move forward"',
    // General job related
    '"career opportunity"', '"next steps"', '"background check"',
    '"reference check"', '"start date"', '"onboarding"',
    'position', 'role', 'opportunity', '"new role"',
  ];

  // Senders to exclude (job board notifications, not actual applications)
  const excludedSenders = [
    'jobs-listings@linkedin.com',
    'jobs-noreply@linkedin.com',
    'jobalerts-noreply@linkedin.com',
    'alerts@glassdoor.com',
    'jobs@indeed.com',
    'noreply@indeed.com',
    'notifications@monster.com',
    'noreply@ziprecruiter.com',
  ];

  // Build the query
  let query = baseQuery;

  // Domain OR recruiter keyword OR subject keyword matching
  query += `(from:(${atsDomains.join(' OR ')}) `;
  query += `OR from:(${recruiterKeywords.join(' OR ')}) `;
  query += `OR subject:(${subjectKeywords.join(' OR ')})) `;

  // Exclude noise (avoid blanket -unsubscribe as most ATS emails have unsubscribe links in footers)
  query += '-"job alert" ';
  query += '-"jobs you might be interested" ';
  query += '-"based on your profile" ';
  query += '-"password reset" ';
  query += excludedSenders.map(sender => `-from:${sender}`).join(' ');

  // Apply date filter based on sync type
  if (hardSync) {
    // Hard sync: use lookbackMonths if provided
    if (lookbackMonths && lookbackMonths !== 'all' && !isNaN(Number(lookbackMonths)) && Number(lookbackMonths) > 0) {
      const months = Math.min(24, Math.max(1, Number(lookbackMonths)));
      const afterDate = new Date(Date.now() - months * 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0]
        .replace(/-/g, '/');
      query += ` after:${afterDate}`;
    }
  } else if (isInitialImport) {
    // Initial import: default to 3 months (configurable via lookbackMonths)
    const months = lookbackMonths && !isNaN(Number(lookbackMonths)) ? Number(lookbackMonths) : 3;
    const afterDate = new Date(Date.now() - months * 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]
      .replace(/-/g, '/');
    query += ` after:${afterDate}`;
  } else if (lastSyncedAt) {
    // Incremental sync: only new messages since last sync
    const afterDate = new Date(lastSyncedAt)
      .toISOString()
      .split('T')[0]
      .replace(/-/g, '/');
    query += ` after:${afterDate}`;
  }

  return query;
}
