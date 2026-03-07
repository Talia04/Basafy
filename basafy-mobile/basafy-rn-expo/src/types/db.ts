/**
 * Convenience re-exports from the generated Supabase schema types.
 * Import from here instead of directly from `database.ts`.
 *
 * Regenerate database.ts whenever the schema changes:
 *   supabase gen types typescript --project-id iwjtlncxbmftrwcgldbj \
 *     > src/types/database.ts
 */
import type { Database } from '@backend/supabase/types/database';

// ── Table row types ──────────────────────────────────────────────────────────
export type Application    = Database['public']['Tables']['applications']['Row'];
export type AppInsert      = Database['public']['Tables']['applications']['Insert'];
export type AppUpdate      = Database['public']['Tables']['applications']['Update'];

export type Event          = Database['public']['Tables']['events']['Row'];
export type EventInsert    = Database['public']['Tables']['events']['Insert'];

export type Task           = Database['public']['Tables']['tasks']['Row'];
export type TaskInsert     = Database['public']['Tables']['tasks']['Insert'];
export type TaskUpdate     = Database['public']['Tables']['tasks']['Update'];

export type Notification   = Database['public']['Tables']['notifications']['Row'];
export type Profile        = Database['public']['Tables']['profiles']['Row'];
export type GmailConnection = Database['public']['Tables']['gmail_connections']['Row'];
export type GmailSyncLog   = Database['public']['Tables']['gmail_sync_logs']['Row'];
export type GmailSyncState = Database['public']['Tables']['gmail_sync_state']['Row'];
export type JobEmailEvent  = Database['public']['Tables']['job_email_events']['Row'];

// ── View row types ───────────────────────────────────────────────────────────
export type HomeMetrics        = Database['public']['Views']['v_home_metrics']['Row'];
export type HomeUpcomingEvent  = Database['public']['Views']['v_home_upcoming_events']['Row'];
export type PipelineApplication = Database['public']['Views']['v_pipeline_applications']['Row'];
export type CalendarEvent      = Database['public']['Views']['v_calendar_events']['Row'];

// ── RPC return types ─────────────────────────────────────────────────────────
export type InsightsSummary = Database['public']['Functions']['get_insights_summary']['Returns'][number];

// ── The typed Database itself (for createClient<Database>) ───────────────────
export type { Database };
