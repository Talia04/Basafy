// @ts-ignore
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0';
import { buildWrappedReport, WRAPPED_REPORT_VERSION } from './wrapped-report-model.ts';

export async function generateWrappedReport(
  admin: SupabaseClient,
  userId: string,
  syncRunId: string,
  relatedSyncRunIds: string[] = [syncRunId],
): Promise<string> {
  const runIds = Array.from(new Set([syncRunId, ...relatedSyncRunIds]));
  const [{ data: syncRunData, error: runError }, { data: parseData, error: parseError }, { data: matchData, error: matchError }] = await Promise.all([
    admin.from('gmail_sync_runs').select('id, status, messages_kept, messages_discarded').eq('id', syncRunId).eq('user_id', userId).single(),
    admin.from('email_parse_attempts').select('gmail_message_id, final_decision, confidence').in('sync_run_id', runIds).eq('user_id', userId),
    admin.from('gmail_match_decisions').select('gmail_message_id, matched_application_id, decision, match_score').in('sync_run_id', runIds).eq('user_id', userId),
  ]);
  if (runError) console.warn('[wrapped-report] sync run evidence unavailable', runError);
  if (parseError) console.warn('[wrapped-report] parse evidence unavailable', parseError);
  if (matchError) console.warn('[wrapped-report] match evidence unavailable', matchError);
  const syncRun = syncRunData ?? { status: 'success', messages_kept: 0, messages_discarded: 0 };
  const parseAttempts = parseData ?? [];
  const matchDecisions = matchData ?? [];
  if (syncRun.status !== 'success') throw new Error('Wrapped reports require a completed sync run.');

  const messageIds = Array.from(new Set((parseAttempts ?? []).map((attempt: any) => attempt.gmail_message_id).filter(Boolean)));
  const applicationIds = new Set<string>((matchDecisions ?? []).map((decision: any) => decision.matched_application_id).filter(Boolean));
  if (messageIds.length) {
    const { data: linkedEvents, error } = await admin
      .from('job_email_events')
      .select('application_id')
      .eq('user_id', userId)
      .in('gmail_message_id', messageIds)
      .not('application_id', 'is', null);
    if (error) {
      console.warn('[wrapped-report] linked event evidence unavailable', error);
    } else {
      for (const event of linkedEvents ?? []) if (event.application_id) applicationIds.add(event.application_id);
    }
  }

  const ids = Array.from(applicationIds);
  const [{ data: applications, error: appsError }, { data: summaries, error: summariesError }] = ids.length
    ? await Promise.all([
      admin.from('applications').select('id, company, role, status, applied_at, created_at, portal_domain').eq('user_id', userId).in('id', ids),
      admin.from('application_timeline_summaries').select('application_id, current_status, status_confidence, next_action, next_deadline, timeline_summary').eq('user_id', userId).in('application_id', ids),
    ])
    : [{ data: [], error: null }, { data: [], error: null }];
  if (appsError) console.warn('[wrapped-report] applications unavailable', appsError);
  if (summariesError) console.warn('[wrapped-report] timeline summaries unavailable', summariesError);

  const report = buildWrappedReport({
    applications: appsError ? [] : applications ?? [],
    summaries: summariesError ? [] : summaries ?? [],
    parseAttempts: parseAttempts ?? [],
    matchDecisions: matchDecisions ?? [],
    syncRun,
  });
  const reportRow = {
      user_id: userId,
      sync_run_id: syncRunId,
      report_version: WRAPPED_REPORT_VERSION,
      total_applications: report.totalApplications,
      total_companies: report.totalCompanies,
      interviews_count: report.interviews,
      assessments_count: report.assessments,
      rejections_count: report.rejections,
      offers_count: report.offers,
      followups_needed_count: report.followupsNeeded,
      top_companies: report.topCompanies,
      top_roles: report.topRoles,
      timeline_highlights: report.timelineHighlights,
      action_items: report.actionItems,
      confidence_summary: report.confidenceSummary,
      report_payload: report.payload,
      generated_at: new Date().toISOString(),
  };
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await admin
      .from('wrapped_reports')
      .upsert(reportRow, { onConflict: 'sync_run_id,report_version' })
      .select('id')
      .single();
    if (!error && data?.id) return data.id;
    lastError = error ?? new Error('Wrapped report write returned no ID.');
    await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
  }
  throw lastError;
}
