-- Remote migration 20260724200540.
ALTER FUNCTION public.fn_upsert_customer_canonical(
  uuid, text, text, text, text, text, text, text, text, text, text,
  text, text, uuid, double precision, double precision, uuid, text, uuid
) RENAME TO fn_upsert_customer_canonical_core;

REVOKE ALL ON FUNCTION public.fn_upsert_customer_canonical_core(
  uuid, text, text, text, text, text, text, text, text, text, text,
  text, text, uuid, double precision, double precision, uuid, text, uuid
) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fn_upsert_customer_canonical(
  p_customer_id uuid,
  p_full_name text,
  p_phone text,
  p_email text,
  p_cpf text,
  p_cep text,
  p_address text,
  p_number text,
  p_neighborhood text,
  p_city text,
  p_state text,
  p_origin text,
  p_customer_status text,
  p_commercial_profile_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_ambassador_id uuid,
  p_assignment_reason text,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_actor uuid;
  v_role text;
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  v_cpf text := nullif(regexp_replace(coalesce(p_cpf, ''), '[^0-9]', '', 'g'), '');
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_payload_hash bytea;
  v_stored private.operation_idempotency%ROWTYPE;
BEGIN
  SELECT actor_id, actor_role
  INTO v_actor, v_role
  FROM private.require_phase2_actor(ARRAY['admin', 'vendedor']);

  IF v_role = 'vendedor' THEN
    p_commercial_profile_id := v_actor;
  END IF;

  v_payload_hash := extensions.digest(
    convert_to(
      jsonb_build_object(
        'customer_id', p_customer_id,
        'full_name', btrim(p_full_name),
        'phone', v_phone,
        'email', v_email,
        'cpf', v_cpf,
        'cep', p_cep,
        'address', p_address,
        'number', p_number,
        'neighborhood', p_neighborhood,
        'city', p_city,
        'state', upper(btrim(coalesce(p_state, ''))),
        'origin', p_origin,
        'customer_status', p_customer_status,
        'commercial_profile_id', p_commercial_profile_id,
        'latitude', p_latitude,
        'longitude', p_longitude,
        'ambassador_id', p_ambassador_id,
        'assignment_reason', p_assignment_reason
      )::text,
      'UTF8'
    ),
    'sha256'
  );

  IF p_customer_id IS NULL THEN
    SELECT *
    INTO v_stored
    FROM private.operation_idempotency
    WHERE operation_scope = 'canonical_customer_write'
      AND idempotency_key = p_idempotency_key;

    IF v_stored.id IS NOT NULL AND v_stored.status = 'completed' THEN
      IF v_stored.payload_hash = v_payload_hash
         AND v_stored.operation_type = 'create_customer' THEN
        RETURN v_stored.original_result || jsonb_build_object('replayed', true);
      END IF;

      INSERT INTO private.phase1_audit_events (
        actor_id, event_type, entity_type, entity_id, outcome_code, metadata
      )
      VALUES (
        v_actor, 'idempotency_conflict', 'operation_idempotency',
        v_stored.id, 'idempotency_conflict',
        jsonb_build_object(
          'operation_scope', 'canonical_customer_write',
          'operation_type', 'create_customer',
          'idempotency_key', p_idempotency_key
        )
      );

      RETURN jsonb_build_object(
        'status', 'idempotency_conflict',
        'operation_id', v_stored.id
      );
    END IF;
  END IF;

  RETURN public.fn_upsert_customer_canonical_core(
    p_customer_id,
    p_full_name,
    p_phone,
    p_email,
    p_cpf,
    p_cep,
    p_address,
    p_number,
    p_neighborhood,
    p_city,
    p_state,
    p_origin,
    p_customer_status,
    p_commercial_profile_id,
    p_latitude,
    p_longitude,
    p_ambassador_id,
    p_assignment_reason,
    p_idempotency_key
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_upsert_customer_canonical(
  uuid, text, text, text, text, text, text, text, text, text, text,
  text, text, uuid, double precision, double precision, uuid, text, uuid
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_upsert_customer_canonical(
  uuid, text, text, text, text, text, text, text, text, text, text,
  text, text, uuid, double precision, double precision, uuid, text, uuid
) TO authenticated;
