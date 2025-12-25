-- Migration: Create job_email_events table

CREATE TABLE public.job_email_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  gmail_message_id TEXT NOT NULL,
  gmail_thread_id TEXT NOT NULL,
  raw_subject TEXT,
  raw_from TEXT,
  raw_snippet TEXT,
  received_at TIMESTAMPTZ NOT NULL,
  event_type TEXT DEFAULT 'unknown' NOT NULL,
  parsed_company TEXT,
  parsed_role TEXT,
  parsed_status TEXT,
  confidence FLOAT,
  application_id BIGINT REFERENCES public.applications(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Unique constraint to prevent duplicates
ALTER TABLE public.job_email_events
  ADD CONSTRAINT job_email_events_unique_user_msg UNIQUE (user_id, gmail_message_id);

-- Enable Row Level Security
ALTER TABLE public.job_email_events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own rows
CREATE POLICY "Users can view their own job_email_events"
  ON public.job_email_events
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own job_email_events"
  ON public.job_email_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own job_email_events"
  ON public.job_email_events
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own job_email_events"
  ON public.job_email_events
  FOR DELETE
  USING (auth.uid() = user_id);
