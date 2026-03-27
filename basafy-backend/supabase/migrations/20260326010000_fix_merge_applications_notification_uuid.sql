-- Fix merge_applications to compare notifications.entity_id as uuid, not text.
-- The notifications table stores entity_id as uuid, so the previous function
-- raised "operator does not exist: uuid = text" during merges.
CREATE OR REPLACE FUNCTION merge_applications(
  primary_id   uuid,
  secondary_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  uid             uuid := auth.uid();
  primary_app     applications%ROWTYPE;
  secondary_app   applications%ROWTYPE;
  priority        jsonb := '{"applied":1,"assessment":2,"interview":3,"rejected":4,"offer":5}'::jsonb;
  primary_prio    int;
  secondary_prio  int;
  winning_status  text;
BEGIN
  IF primary_id = secondary_id THEN
    RAISE EXCEPTION 'primary_id and secondary_id must be different';
  END IF;

  SELECT * INTO primary_app
  FROM applications
  WHERE id = primary_id
    AND user_id = uid;

  SELECT * INTO secondary_app
  FROM applications
  WHERE id = secondary_id
    AND user_id = uid;

  IF primary_app.id IS NULL THEN
    RAISE EXCEPTION 'Primary application not found or access denied';
  END IF;

  IF secondary_app.id IS NULL THEN
    RAISE EXCEPTION 'Secondary application not found or access denied';
  END IF;

  primary_prio := COALESCE((priority ->> lower(COALESCE(primary_app.status, 'applied')))::int, 1);
  secondary_prio := COALESCE((priority ->> lower(COALESCE(secondary_app.status, 'applied')))::int, 1);
  winning_status := CASE
    WHEN secondary_prio > primary_prio THEN secondary_app.status
    ELSE primary_app.status
  END;

  UPDATE job_email_events
  SET application_id = primary_id
  WHERE application_id = secondary_id;

  UPDATE tasks
  SET application_id = primary_id
  WHERE application_id = secondary_id;

  UPDATE events
  SET application_id = primary_id
  WHERE application_id = secondary_id;

  UPDATE notifications
  SET entity_id = primary_id
  WHERE entity_id = secondary_id
    AND entity_type = 'application';

  UPDATE applications
  SET
    status = winning_status,
    company = COALESCE(NULLIF(trim(primary_app.company), ''), secondary_app.company),
    role = COALESCE(NULLIF(trim(primary_app.role), ''), secondary_app.role),
    role_title = COALESCE(NULLIF(trim(primary_app.role_title), ''), secondary_app.role_title),
    notes = CASE
      WHEN primary_app.notes IS NOT NULL AND secondary_app.notes IS NOT NULL
        THEN primary_app.notes || E'\n---\n' || secondary_app.notes
      ELSE COALESCE(primary_app.notes, secondary_app.notes)
    END,
    updated_at = now()
  WHERE id = primary_id;

  DELETE FROM applications
  WHERE id = secondary_id;

  RETURN jsonb_build_object(
    'ok', true,
    'primary_id', primary_id,
    'secondary_id', secondary_id,
    'winning_status', winning_status
  );
END;
$$;
