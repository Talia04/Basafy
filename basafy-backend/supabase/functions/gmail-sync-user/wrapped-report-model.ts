export const WRAPPED_REPORT_VERSION = 'grounded-v1';

type Application = {
  id: string;
  company: string | null;
  role: string | null;
  status: string | null;
  applied_at: string | null;
  created_at: string | null;
  portal_domain: string | null;
};

type TimelineSummary = {
  application_id: string;
  current_status: string;
  status_confidence: number;
  next_action: string | null;
  next_deadline: string | null;
  timeline_summary: Array<{
    status?: string | null;
    occurred_at?: string;
    event_type?: string;
  }> | null;
};

type ParseAttempt = { final_decision: string; confidence: number | null };
type MatchDecision = { decision: string; match_score: number | null };
type SyncRun = { messages_discarded: number; messages_kept: number };

export type WrappedReportInput = {
  applications: Application[];
  summaries: TimelineSummary[];
  parseAttempts: ParseAttempt[];
  matchDecisions: MatchDecision[];
  syncRun: SyncRun;
};

function countBy(values: Array<string | null | undefined>) {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = value?.trim();
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts, ([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function sourceName(domain: string | null) {
  if (!domain) return 'Direct/Email';
  const value = domain.toLowerCase();
  const known: Array<[string, string]> = [
    ['greenhouse', 'Greenhouse'], ['lever', 'Lever'], ['workday', 'Workday'],
    ['ashby', 'Ashby'], ['linkedin', 'LinkedIn'], ['indeed', 'Indeed'],
  ];
  return known.find(([needle]) => value.includes(needle))?.[1] ?? 'Other ATS';
}

function hasStage(summary: TimelineSummary | undefined, status: string) {
  return summary?.current_status === status || summary?.timeline_summary?.some((entry) => entry.status === status) || false;
}

export function buildWrappedReport(input: WrappedReportInput) {
  const summaries = new Map(input.summaries.map((summary) => [summary.application_id, summary]));
  const applications = input.applications;
  const totalApplications = applications.length;
  const totalCompanies = countBy(applications.map((app) => app.company)).length;
  const assessments = applications.filter((app) => hasStage(summaries.get(app.id), 'assessment')).length;
  const interviews = applications.filter((app) => hasStage(summaries.get(app.id), 'interview')).length;
  const rejections = applications.filter((app) => hasStage(summaries.get(app.id), 'rejected')).length;
  const offers = applications.filter((app) => hasStage(summaries.get(app.id), 'offer')).length;
  const actionItems = input.summaries
    .filter((summary) => summary.next_action)
    .map((summary) => ({
      application_id: summary.application_id,
      action: summary.next_action,
      deadline: summary.next_deadline,
    }));

  const parseConfidence = input.parseAttempts
    .map((attempt) => attempt.confidence)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const matchConfidence = input.matchDecisions
    .map((decision) => decision.match_score)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const timelineConfidence = input.summaries
    .map((summary) => Number(summary.status_confidence))
    .filter(Number.isFinite);
  const confidenceValues = [...parseConfidence, ...matchConfidence, ...timelineConfidence];
  const averageConfidence = confidenceValues.length
    ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
    : 0;
  const needsReview = input.parseAttempts.filter((attempt) => attempt.final_decision === 'unknown_needs_review').length
    + input.matchDecisions.filter((decision) => ['needs_review', 'possible_duplicate', 'unmatched_job_event'].includes(decision.decision)).length;
  const confidenceLevel = averageConfidence >= 0.85 && needsReview === 0
    ? 'high'
    : averageConfidence >= 0.65
      ? 'medium'
      : 'low';
  const confidenceMessages = [
    confidenceLevel === 'high'
      ? `We found ${totalApplications} applications.`
      : `We found ${totalApplications} likely applications.`,
    ...(needsReview ? [`These ${needsReview} items may need review.`] : []),
    ...(input.syncRun.messages_discarded ? ['Some job alerts and low-signal messages were excluded from this recap.'] : []),
  ];

  const weekly = new Map<string, { week: string; applications: number; replies: number }>();
  for (const app of applications) {
    const value = app.applied_at ?? app.created_at;
    if (!value || Number.isNaN(Date.parse(value))) continue;
    const date = new Date(value);
    const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    const key = monday.toISOString().slice(0, 10);
    const entry = weekly.get(key) ?? { week: monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }), applications: 0, replies: 0 };
    entry.applications += 1;
    const summary = summaries.get(app.id);
    if ((summary?.timeline_summary?.length ?? 0) > 1) entry.replies += 1;
    weekly.set(key, entry);
  }
  const momentumData = Array.from(weekly.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => value);
  const best = momentumData.reduce((current, item) => item.applications > (current?.applications ?? -1) ? item : current, momentumData[0]);
  const slowest = momentumData.reduce((current, item) => item.applications < (current?.applications ?? Infinity) ? item : current, momentumData[0]);

  const sourceCounts = new Map<string, { count: number; interviews: number }>();
  for (const app of applications) {
    const source = sourceName(app.portal_domain);
    const stats = sourceCounts.get(source) ?? { count: 0, interviews: 0 };
    stats.count += 1;
    if (hasStage(summaries.get(app.id), 'interview')) stats.interviews += 1;
    sourceCounts.set(source, stats);
  }
  const sourcesData = Array.from(sourceCounts, ([platform, value]) => ({ platform, ...value })).sort((a, b) => b.count - a.count);
  const responseTimes: number[] = [];
  const dayBuckets = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => ({ day, applications: 0, responses: 0 }));
  const timeBuckets = [
    { time: 'Morning', label: '6am-12pm', applications: 0, responses: 0 },
    { time: 'Afternoon', label: '12pm-6pm', applications: 0, responses: 0 },
    { time: 'Evening', label: '6pm-12am', applications: 0, responses: 0 },
  ];
  const timeIndex = (date: Date) => date.getUTCHours() < 12 ? 0 : date.getUTCHours() < 18 ? 1 : 2;
  for (const app of applications) {
    const appliedValue = app.applied_at ?? app.created_at;
    if (!appliedValue || Number.isNaN(Date.parse(appliedValue))) continue;
    const applied = new Date(appliedValue);
    dayBuckets[applied.getUTCDay()].applications += 1;
    timeBuckets[timeIndex(applied)].applications += 1;
    const firstResponse = summaries.get(app.id)?.timeline_summary
      ?.filter((entry) => entry.status && entry.status !== 'applied' && entry.occurred_at && !Number.isNaN(Date.parse(entry.occurred_at)))
      .sort((a, b) => Date.parse(a.occurred_at!) - Date.parse(b.occurred_at!))[0];
    if (!firstResponse?.occurred_at) continue;
    const response = new Date(firstResponse.occurred_at);
    responseTimes.push(Math.max(0, (response.getTime() - applied.getTime()) / 86_400_000));
    dayBuckets[applied.getUTCDay()].responses += 1;
    timeBuckets[timeIndex(applied)].responses += 1;
  }
  const responseRanges = [0, 0, 0, 0];
  for (const days of responseTimes) responseRanges[days <= 3 ? 0 : days <= 7 ? 1 : days <= 14 ? 2 : 3] += 1;
  const sortedResponseTimes = [...responseTimes].sort((a, b) => a - b);
  const averageResponse = responseTimes.length ? responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length : null;
  const middle = Math.floor(sortedResponseTimes.length / 2);
  const medianResponse = sortedResponseTimes.length
    ? sortedResponseTimes.length % 2 ? sortedResponseTimes[middle] : (sortedResponseTimes[middle - 1] + sortedResponseTimes[middle]) / 2
    : null;
  const byDayOfWeek = dayBuckets.map((item) => ({ ...item, responseRate: item.applications ? Math.round(item.responses / item.applications * 100) : 0 }));
  const byTimeOfDay = timeBuckets.map((item) => ({ ...item, responseRate: item.applications ? Math.round(item.responses / item.applications * 100) : 0 }));
  const bestDay = byDayOfWeek.reduce((best, item) => item.responseRate > best.responseRate ? item : best, byDayOfWeek[0]);
  const worstDay = byDayOfWeek.reduce((worst, item) => item.responseRate < worst.responseRate ? item : worst, byDayOfWeek[0]);
  const bestTime = byTimeOfDay.reduce((best, item) => item.responseRate > best.responseRate ? item : best, byTimeOfDay[0]);
  const funnelData = [
    ['Applied', totalApplications, 'bg-chart-1'], ['Assessment', assessments, 'bg-chart-2'],
    ['Interview', interviews, 'bg-chart-3'], ['Offer', offers, 'bg-chart-4'],
  ].map(([stage, count, barClass]) => ({
    stage: String(stage), count: Number(count),
    percentage: totalApplications ? Math.round(Number(count) / totalApplications * 100) : 0,
    barClass: String(barClass),
  }));
  const dropPairs = funnelData.slice(0, -1).map((item, index) => ({ from: item, to: funnelData[index + 1] }));
  const biggest = dropPairs.reduce((current, pair) => {
    const drop = pair.from.count ? Math.round((pair.from.count - pair.to.count) / pair.from.count * 100) : 0;
    return drop > current.drop ? { pair, drop } : current;
  }, { pair: dropPairs[0], drop: -1 });

  const stalled = input.summaries.filter((summary) => summary.next_action).length;
  const primary = totalApplications >= 40 ? 'sprinter' : interviews / Math.max(totalApplications, 1) >= 0.2 ? 'strategist' : 'explorer';
  const personality = primary === 'sprinter'
    ? { type: primary, title: 'The Sprinter', description: 'High-volume momentum', stat: `${totalApplications} grounded applications`, gradient: 'from-chart-1 to-chart-2' }
    : primary === 'strategist'
      ? { type: primary, title: 'The Strategist', description: 'Strong response conversion', stat: `${Math.round(interviews / Math.max(totalApplications, 1) * 100)}% interview rate`, gradient: 'from-chart-3 to-chart-4' }
      : { type: primary, title: 'The Explorer', description: 'A broad company search', stat: `${totalCompanies} companies`, gradient: 'from-chart-5 to-chart-1' };

  const payload = {
    overview: { applications: totalApplications, companies: totalCompanies, interviews, offers },
    funnelData,
    biggestDropOff: biggest.pair ? `${biggest.pair.from.stage} → ${biggest.pair.to.stage} (${Math.max(0, biggest.drop)}% drop)` : 'Not enough data yet',
    momentumData,
    bestWeek: best ? `${best.week} (${best.applications} applications)` : 'Not enough data',
    slowestWeek: slowest ? `${slowest.week} (${slowest.applications} applications)` : 'Not enough data',
    responseData: ['0-3 days', '4-7 days', '8-14 days', '15+ days'].map((range, index) => ({ range, count: responseRanges[index] })),
    avgResponseTime: averageResponse === null ? '—' : `${averageResponse.toFixed(1)} days`,
    medianResponseTime: medianResponse === null ? '—' : `${Math.round(medianResponse)} days`,
    sourcesData,
    timingData: {
      byDayOfWeek, byTimeOfDay, bestDay: bestDay.day, bestDayRate: bestDay.responseRate,
      worstDay: worstDay.day, worstDayRate: worstDay.responseRate, bestTime: bestTime.time, bestTimeRate: bestTime.responseRate,
      insight: responseTimes.length
        ? `Your strongest response rate is from ${bestDay.day} ${bestTime.time.toLowerCase()} applications.`
        : 'Timing insights improve as more grounded events are collected.',
    },
    ghostData: {
      totalGhosted: stalled, ghostRate: totalApplications ? Math.round(stalled / totalApplications * 100) : 0,
      avgDaysBeforeGhost: 0, byStage: [], topGhostingCompanies: [], stillWaiting: stalled,
      insight: stalled ? `${stalled} applications have a follow-up action.` : 'No unresolved follow-ups were found.',
    },
    personalities: [personality],
    recommendations: actionItems.slice(0, 3).map((item) => ({
      title: item.action, insight: item.deadline ? `Due ${new Date(item.deadline).toLocaleDateString('en-US')}` : 'Grounded in your application timeline',
      action: 'Open Basafy to follow up', gradient: 'from-chart-1 to-chart-2',
    })),
    confidence: { level: confidenceLevel, messages: confidenceMessages, needsReview },
  };

  return {
    reportVersion: WRAPPED_REPORT_VERSION,
    totalApplications, totalCompanies, interviews, assessments, rejections, offers,
    followupsNeeded: actionItems.length,
    topCompanies: countBy(applications.map((app) => app.company)).slice(0, 5),
    topRoles: countBy(applications.map((app) => app.role)).slice(0, 5),
    timelineHighlights: { momentum: momentumData, best_week: payload.bestWeek, slowest_week: payload.slowestWeek },
    actionItems,
    confidenceSummary: { level: confidenceLevel, average: averageConfidence, needs_review: needsReview, messages: confidenceMessages },
    payload,
  };
}
