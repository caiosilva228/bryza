-- Active legacy ambassadors may not have a canonical person_id yet.
-- The exception is also scoped by ambassador_id, so that identity is enough
-- for the administrative monthly commission activation.
BEGIN;

CREATE OR REPLACE FUNCTION public.fn_admin_grant_ambassador_exception(
  p_ambassador_id uuid,
  p_reason text,
  p_valid_until timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_actor uuid;
  v_role text;
  v_person_id uuid;
  v_exception_id uuid;
BEGIN
  SELECT actor_id, actor_role INTO v_actor, v_role
  FROM private.require_phase2_actor(ARRAY['admin']);

  SELECT person_id INTO v_person_id
  FROM public.ambassadors
  WHERE id = p_ambassador_id
    AND lifecycle_status = 'active';

  IF NOT FOUND
     OR length(btrim(coalesce(p_reason, ''))) < 5
     OR p_valid_until IS NULL
     OR p_valid_until <= now()
     OR p_valid_until > now() + interval '2 years' THEN
    RAISE EXCEPTION 'invalid_ambassador_exception' USING ERRCODE = '22023';
  END IF;

  INSERT INTO private.ambassador_program_exceptions (
    person_id, ambassador_id, rule_code, effect_type,
    reason, valid_from, valid_until, granted_by
  ) VALUES (
    v_person_id, p_ambassador_id, 'monthly_purchase_qualification',
    'allow', btrim(p_reason), now(), p_valid_until, v_actor
  )
  RETURNING id INTO v_exception_id;

  INSERT INTO private.phase1_audit_events (
    actor_id, event_type, entity_type, entity_id, outcome_code, metadata
  ) VALUES (
    v_actor, 'ambassador_qualification_exception_granted',
    'ambassador_program_exception', v_exception_id, 'granted',
    jsonb_build_object(
      'ambassador_id', p_ambassador_id,
      'valid_until', p_valid_until
    )
  );

  RETURN jsonb_build_object(
    'status', 'granted',
    'exception_id', v_exception_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_grant_ambassador_exception(
  uuid, text, timestamptz
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_grant_ambassador_exception(
  uuid, text, timestamptz
) TO authenticated;

COMMIT;
