-- Creates a reusable function that corrects applications.applied_at for a single user.
-- Called after every Gmail sync so that as job_email_events.received_at gets populated,
-- applied_at is progressively corrected to the true earliest email date.
--
-- Linkage strategy (ordered by reliability):
--   1. event.application_id = app.id           (direct FK, most precise)
--   2. event.gmail_thread_id = app.gmail_thread_id (thread-level match, catches events
--      where application_id was never set but belong to the same conversation)
--
-- Only updates applied_at when the computed earliest date is strictly earlier than
-- the stored value (or stored value is null).  Safe to run repeatedly.

CREATE OR REPLACE FUNCTION public.correct_applied_at_for_user(p_user_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH all_dates AS (
    -- Tier 1: direct application_id FK
    SELECT e.application_id AS app_id,
           e.received_at
    FROM   job_email_events e
    WHERE  e.user_id        = p_user_id
      AND  e.application_id IS NOT NULL
      AND  e.received_at    IS NOT NULL

    UNION ALL

    -- Tier 2: thread-level match (application_id may be null on old events)
    SELECT a.id AS app_id,
           e.received_at
    FROM   job_email_events e
    JOIN   applications a
           ON  a.gmail_thread_id = e.gmail_thread_id
           AND a.user_id         = e.user_id
    WHERE  e.user_id      = p_user_id
      AND  e.received_at  IS NOT NULL

    UNION ALL

    -- Tier 3: message-level match via gmail_message_id stored on the application row
    SELECT a.id AS app_id,
           e.received_at
    FROM   job_email_events e
    JOIN   applications a
           ON  a.gmail_message_id = e.gmail_message_id
           AND a.user_id          = e.user_id
    WHERE  e.user_id      = p_user_id
      AND  e.received_at  IS NOT NULL
  ),
  earliest AS (
    SELECT app_id,
           MIN(received_at) AS min_date
    FROM   all_dates
    GROUP  BY app_id
  ),
  updated AS (
    UPDATE applications a
    SET    applied_at = earliest.min_date
    FROM   earliest
    WHERE  a.id       = earliest.app_id
      AND  a.user_id  = p_user_id
      AND  (a.applied_at IS NULL OR a.applied_at > earliest.min_date)
    RETURNING a.id
  )
  SELECT COUNT(*)::integer FROM updated;
$$;

COMMENT ON FUNCTION public.correct_applied_at_for_user(uuid) IS
  'Corrects applications.applied_at to the earliest received_at across all linked '
  'job_email_events for the given user. Called after every Gmail sync.';

-- ── One-time backfill for all existing users ──────────────────────────────────
-- Runs immediately on migration.  If received_at is still null for historical
-- records this is a no-op; the RPC call in stage-write.ts will run it again
-- after each sync as received_at gets populated.
DO $$
DECLARE
  uid uuid;
  n   integer;
BEGIN
  FOR uid IN
    SELECT DISTINCT user_id FROM public.gmail_connections
  LOOP
    SELECT public.correct_applied_at_for_user(uid) INTO n;
    IF n > 0 THEN
      RAISE NOTICE 'correct_applied_at_for_user(%): fixed % rows', uid, n;
    END IF;
  END LOOP;
END;
$$;
