-- Merge two applications: reassign all related records to the primary,
-- keep the higher-priority status, fill any gaps from secondary, then delete secondary.
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
  -- Sanity check
  IF primary_id = secondary_id THEN
    RAISE EXCEPTION 'primary_id and secondary_id must be different';
  END IF;

  -- Load both applications, verify ownership
  SELECT * INTO primary_app   FROM applications WHERE id = primary_id   AND user_id = uid;
  SELECT * INTO secondary_app FROM applications WHERE id = secondary_id AND user_id = uid;

  IF primary_app.id IS NULL THEN
    RAISE EXCEPTION 'Primary application not found or access denied';
  END IF;
  IF secondary_app.id IS NULL THEN
    RAISE EXCEPTION 'Secondary application not found or access denied';
  END IF;

  -- Determine the higher-priority status to keep
  primary_prio   := COALESCE((priority ->> lower(COALESCE(primary_app.status,   'applied')))::int, 1);
  secondary_prio := COALESCE((priority ->> lower(COALESCE(secondary_app.status, 'applied')))::int, 1);
  winning_status := CASE WHEN secondary_prio > primary_prio
                         THEN secondary_app.status
                         ELSE primary_app.status
                    END;

  -- Reassign related records
  UPDATE job_email_events SET application_id = primary_id   WHERE application_id = secondary_id;
  UPDATE tasks            SET application_id = primary_id   WHERE application_id = secondary_id;
  UPDATE events           SET application_id = primary_id   WHERE application_id = secondary_id;
  UPDATE notifications    SET entity_id = primary_id::text
    WHERE entity_id = secondary_id::text AND entity_type = 'application';

  -- Update primary: winning status + fill any missing company/role from secondary
  UPDATE applications SET
    status     = winning_status,
    company    = COALESCE(NULLIF(trim(primary_app.company    ), ''), secondary_app.company),
    role       = COALESCE(NULLIF(trim(primary_app.role       ), ''), secondary_app.role),
    role_title = COALESCE(NULLIF(trim(primary_app.role_title ), ''), secondary_app.role_title),
    notes      = CASE
                   WHEN primary_app.notes IS NOT NULL AND secondary_app.notes IS NOT NULL
                     THEN primary_app.notes || E'\n---\n' || secondary_app.notes
                   ELSE COALESCE(primary_app.notes, secondary_app.notes)
                 END,
    updated_at = now()
  WHERE id = primary_id;

  -- Delete secondary (cascades are handled by FK ON DELETE CASCADE if configured,
  -- but we already manually reassigned everything above)
  DELETE FROM applications WHERE id = secondary_id;

  RETURN jsonb_build_object(
    'ok',             true,
    'primary_id',     primary_id,
    'secondary_id',   secondary_id,
    'winning_status', winning_status
  );
END;
$$;

-- Only the owner can call this (uid check is inside the function)
REVOKE ALL ON FUNCTION merge_applications(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION merge_applications(uuid, uuid) TO authenticated;
