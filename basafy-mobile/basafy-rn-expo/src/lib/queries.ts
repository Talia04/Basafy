import { useQuery } from '@tanstack/react-query';
import { supabase } from '@backend/supabase/client';

// ─── Query keys ──────────────────────────────────────────────────────────────

export const QueryKeys = {
  applications: (showHidden: boolean) => ['applications', { showHidden }] as const,
  pipeline: () => ['pipeline'] as const,
};

// ─── Applications ─────────────────────────────────────────────────────────────

export type ApplicationRow = {
  id: string;
  company: string | null;
  role: string | null;
  role_title: string | null;
  status: string | null;
  source_type: string | null;
  is_hidden: boolean;
  gmail_message_id: string | null;
  gmail_thread_id: string | null;
  applied_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  last_synced_at: string | null;
};

async function fetchApplications(showHidden: boolean): Promise<ApplicationRow[]> {
  let query = supabase
    .from('applications')
    .select(
      'id, company, role, role_title, status, source_type, is_hidden, gmail_message_id, gmail_thread_id, applied_at, created_at, updated_at, last_synced_at'
    )
    .order('applied_at', { ascending: false, nullsFirst: false });

  if (!showHidden) {
    query = query.or('is_hidden.is.null,is_hidden.eq.false');
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ApplicationRow[];
}

export function useApplications(showHidden: boolean) {
  return useQuery({
    queryKey: QueryKeys.applications(showHidden),
    queryFn: () => fetchApplications(showHidden),
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

export type PipelineItem = {
  id: string;
  company: string;
  role: string;
  status: string;
  statusKey: string;
  appliedLabel: string;
  source_type: string | null;
};

export type PipelineData = {
  columns: Record<string, PipelineItem[]>;
  taskCountsByApp: Record<string, number>;
};

function formatStatus(statusKey: string): string {
  const labels: Record<string, string> = {
    applied: 'Applied',
    assessment: 'Assessment',
    interview: 'Interview',
    offer: 'Offer',
    rejected: 'Rejected',
  };
  return labels[statusKey] ?? statusKey;
}

function formatAppliedLabel(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getApplicationDate(app: { applied_at?: string | null; created_at?: string | null }) {
  return app.applied_at ?? app.created_at ?? null;
}

const PIPELINE_KEYS = ['applied', 'assessment', 'interview', 'offer', 'rejected'];

async function fetchPipelineData(): Promise<PipelineData> {
  const { data, error } = await supabase
    .from('applications')
    .select('id, company, role_title, role, status, applied_at, created_at, source_type')
    .order('applied_at', { ascending: false, nullsFirst: false });

  if (error) throw error;

  const apps = data ?? [];
  const columns: Record<string, PipelineItem[]> = {};
  PIPELINE_KEYS.forEach((k) => { columns[k] = []; });

  apps.forEach((app: any) => {
    const statusRaw = (app.status || 'applied').toString().toLowerCase();
    let statusKey = 'applied';
    if (statusRaw.includes('assess')) statusKey = 'assessment';
    else if (statusRaw.includes('interview')) statusKey = 'interview';
    else if (statusRaw.includes('offer')) statusKey = 'offer';
    else if (statusRaw.includes('reject')) statusKey = 'rejected';
    const appliedLabel = formatAppliedLabel(getApplicationDate(app));
    columns[statusKey].push({
      id: app.id,
      company: app.company || 'Unknown',
      role: app.role_title || app.role || 'Role pending',
      status: formatStatus(statusKey),
      statusKey,
      appliedLabel,
      source_type: app.source_type ?? null,
    });
  });

  const appIds = apps.map((a: any) => a.id);
  let taskCountsByApp: Record<string, number> = {};
  if (appIds.length > 0) {
    const { data: taskRows } = await supabase
      .from('tasks')
      .select('application_id')
      .eq('status', 'open')
      .in('application_id', appIds);
    taskCountsByApp = (taskRows || []).reduce<Record<string, number>>(
      (acc, row: { application_id?: string | null }) => {
        if (row.application_id) acc[row.application_id] = (acc[row.application_id] || 0) + 1;
        return acc;
      },
      {}
    );
  }

  return { columns, taskCountsByApp };
}

export function usePipelineData() {
  return useQuery({
    queryKey: QueryKeys.pipeline(),
    queryFn: fetchPipelineData,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}
