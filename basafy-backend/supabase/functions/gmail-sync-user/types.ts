// Type definitions for Gmail sync

export type GmailConnection = {
  id?: string | null;
  user_id: string;
  email: string | null;
  refresh_token: string | null;
  provider: string | null;
  backfill_page_token?: string | null;
  backfill_started_at?: string | null;
  backfill_completed_at?: string | null;
  backfill_total_estimate?: number | null;
  backfill_processed_count?: number | null;
  last_synced_at?: string | null;
};

export type GmailMessage = {
  id: string;
  threadId?: string;
  subject?: string;
  from?: string;
  internetMessageId?: string | null;
  internalDate?: string;
  internalTimestamp?: number;
  snippet?: string;
  bodyText?: string | null;
  matchedQueryBuckets?: string[];
  platformEmailType?: 'job_alert_noise' | 'application_activity' | 'recruiter_message' | 'interview_or_assessment' | 'unknown';
};

export type ExtractionSource = 'subject' | 'body' | 'snippet' | 'from' | 'fallback' | 'html' | null;

export type ExtractionResult = {
  value: string | null;
  source: ExtractionSource;
};

export type SyncStatus = 'idle' | 'running' | 'complete' | 'error';

export type SyncType = 'full' | 'incremental' | 'enrich';

export type ApplicationStatus = 'Applied' | 'Interview' | 'Assessment' | 'Rejected' | 'Offer' | 'Other' | null;

export type EventType =
  | 'application_received'
  | 'interview_invite'
  | 'assessment'
  | 'rejection'
  | 'offer'
  | 'other';

export interface SyncOptions {
  hardSync?: boolean;
  lightSync?: boolean;
  lookbackMonths?: number | string | null;
  maxMessages?: number;
  enrichOnly?: boolean;
  pageToken?: string | null;
  seedOnly?: boolean;
}

export interface MessageFeatures {
  company_candidates?: string[];
  job_title_candidates?: string[];
  job_id_candidates?: string[];
  urls?: string[];
  has_ics?: boolean;
  sender_type?: 'ats' | 'human' | 'system';
}

export interface ParsedEmailLLMResult {
  is_job_related?: boolean;
  company_name: string | null;
  job_title: string | null;
  event_type: EventType;
  status: ApplicationStatus;
  interview_date: string | null;
  confidence: number;
  portal_domain: string | null;
  job_id: string | null;
  diagnostics?: {
    llmAvailable: boolean;
    rawLlmResult: Record<string, unknown> | null;
    heuristicResult?: Record<string, unknown> | null;
    classificationSource?: string;
  };
}

export interface ParsedEmailResult {
  company: string | null;
  role: string | null;
  status: ApplicationStatus;
  eventType: EventType;
  confidence: number;
  companyConfidence: number | null;
  roleConfidence: number | null;
  portalDomain: string | null;
  jobId: string | null;
  requisitionId: string | null;
  canonicalKey: string | null;
  interviewDate?: string | null;
  gmailMessageId?: string | null;
  gmailThreadId?: string | null;
  internetMessageId?: string | null;
  rawSubject?: string | null;
  rawFrom?: string | null;
  rawSnippet?: string | null;
  receivedAt?: string | null;
  message_features?: MessageFeatures;
  llmParsedJson?: Record<string, unknown> | null;
}

export type EmailRelevanceDecision =
  | 'included'
  | 'excluded_not_job_related'
  | 'excluded_low_signal'
  | 'parse_error';

export interface EmailProcessingDecision {
  message: GmailMessage;
  relevanceDecision: EmailRelevanceDecision;
  decisionReason: string;
  parsed: ParsedEmailResult | null;
  parserDiagnostics?: ParsedEmailLLMResult['diagnostics'];
}

export interface ApplicationMatchDecision {
  gmailMessageId: string;
  matchedApplicationId: string | null;
  matchType: string;
  matchScore: number;
  companyScore: number;
  roleScore: number;
  threadScore: number;
  domainScore: number;
  timelineScore: number;
  decision: 'match_existing' | 'create_new' | 'uncertain';
  reason: string;
  candidateApplicationIds: string[];
}
