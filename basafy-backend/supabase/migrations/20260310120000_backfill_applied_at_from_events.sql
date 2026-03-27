-- Backfill / correct applications.applied_at using the earliest received_at
-- from job_email_events. This fixes two cases:
--   1. applied_at IS NULL (column was added after the app was created)
--   2. applied_at is later than the earliest known email for that app
--      (was set to syncTimestamp instead of the real email date)
-- Falls back to created_at only when there are no email events at all.

-- Step 1: fix apps that have a matching email event with an earlier date
UPDATE public.applications a
SET applied_at = earliest.min_received_at
FROM (
    SELECT application_id, MIN(received_at) AS min_received_at
    FROM public.job_email_events
    WHERE application_id IS NOT NULL
      AND received_at IS NOT NULL
    GROUP BY application_id
) earliest
WHERE a.id = earliest.application_id
  AND (
      a.applied_at IS NULL
      OR a.applied_at > earliest.min_received_at
  );

-- Step 2: for any remaining nulls (no email events at all), fall back to created_at
UPDATE public.applications
SET applied_at = created_at
WHERE applied_at IS NULL
  AND created_at IS NOT NULL;
