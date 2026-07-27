BEGIN;

CREATE OR REPLACE FUNCTION public.fn_admin_create_or_promote_ambassador(
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
  p_commercial_profile_id uuid,
  p_sponsor_ambassador_id uuid,
  p_plan_id uuid,
  p_initial_status text,
  p_latitude double precision,
  p_longitude double precision,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_actor uuid;
  v_actor_role text;
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  v_cpf text := regexp_replace(coalesce(p_cpf, ''), '[^0-9]', '', 'g');
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_customer public.clientes%ROWTYPE;
  v_match_ids uuid[];
  v_customer_result jsonb;
  v_promotion_result jsonb;
  v_customer_created boolean := false;
  v_commercial_profile_id uuid;
  v_own_ambassador_id uuid;
  v_stored private.operation_idempotency%ROWTYPE;
BEGIN
  SELECT actor_id, actor_role
  INTO v_actor, v_actor_role
  FROM private.require_phase2_actor(ARRAY['admin']);

  IF p_idempotency_key IS NULL
     OR length(btrim(coalesce(p_full_name, ''))) NOT BETWEEN 2 AND 200
     OR v_phone !~ '^[0-9]{10,15}$'
     OR v_cpf !~ '^[0-9]{11}$'
     OR (v_email IS NOT NULL AND (
       length(v_email) NOT BETWEEN 3 AND 254 OR position('@' IN v_email) <= 1
     ))
     OR p_initial_status NOT IN ('pendente', 'ativo')
     OR (nullif(btrim(coalesce(p_state, '')), '') IS NOT NULL
       AND upper(btrim(p_state)) !~ '^[A-Z]{2}$') THEN
    RAISE EXCEPTION 'invalid_ambassador_customer_payload' USING ERRCODE = '22023';
  END IF;

  SELECT a.id
  INTO v_own_ambassador_id
  FROM public.ambassadors a
  WHERE a.lifecycle_status = 'active'
    AND (
      regexp_replace(coalesce(a.cpf, ''), '[^0-9]', '', 'g') = v_cpf
      OR regexp_replace(coalesce(a.phone, ''), '[^0-9]', '', 'g') = v_phone
      OR (v_email IS NOT NULL AND lower(btrim(coalesce(a.email, ''))) = v_email)
    )
  ORDER BY
    (regexp_replace(coalesce(a.cpf, ''), '[^0-9]', '', 'g') = v_cpf) DESC,
    a.created_at ASC
  LIMIT 1;

  IF p_sponsor_ambassador_id IS NOT NULL
     AND p_sponsor_ambassador_id = v_own_ambassador_id THEN
    RAISE EXCEPTION 'ambassador_cannot_refer_self' USING ERRCODE = '22023';
  END IF;

  IF p_sponsor_ambassador_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.ambassadors a
    WHERE a.id = p_sponsor_ambassador_id
      AND a.status = 'ativo'
      AND a.lifecycle_status = 'active'
  ) THEN
    RAISE EXCEPTION 'active_sponsor_required' USING ERRCODE = '22023';
  END IF;

  IF p_customer_id IS NULL THEN
    SELECT *
    INTO v_stored
    FROM private.operation_idempotency
    WHERE operation_scope = 'canonical_customer_write'
      AND idempotency_key = p_idempotency_key;

    IF v_stored.id IS NOT NULL
       AND v_stored.operation_type = 'create_customer'
       AND v_stored.status = 'completed' THEN
      v_commercial_profile_id := coalesce(p_commercial_profile_id, v_actor);
      v_customer_result := public.fn_upsert_customer_canonical(
        NULL,
        btrim(p_full_name),
        v_phone,
        v_email,
        v_cpf,
        coalesce(p_cep, ''),
        coalesce(p_address, ''),
        coalesce(p_number, ''),
        coalesce(p_neighborhood, ''),
        coalesce(p_city, ''),
        coalesce(p_state, ''),
        'cadastro_admin_embaixador',
        'lead',
        v_commercial_profile_id,
        p_latitude,
        p_longitude,
        p_sponsor_ambassador_id,
        CASE WHEN p_sponsor_ambassador_id IS NULL
          THEN NULL
          ELSE 'Patrocinador confirmado no cadastro administrativo do embaixador'
        END,
        p_idempotency_key
      );

      IF v_customer_result->>'status' = 'idempotency_conflict' THEN
        RETURN v_customer_result;
      END IF;

      p_customer_id := (v_customer_result->>'entity_id')::uuid;
      v_promotion_result := public.fn_admin_promote_client_to_ambassador(
        p_customer_id, p_plan_id, p_initial_status
      );

      RETURN jsonb_build_object(
        'status', 'customer_created_and_ambassador_linked',
        'customer_id', p_customer_id,
        'customer_code', (
          SELECT 'C' || lpad(c.codigo_cliente::text, 5, '0')
          FROM public.clientes c WHERE c.id = p_customer_id
        ),
        'customer_created', true,
        'ambassador_id', v_promotion_result->>'ambassador_id',
        'referral_code', v_promotion_result->>'referral_code',
        'username', v_promotion_result->>'username',
        'promotion_status', v_promotion_result->>'status',
        'replayed', true
      );
    ELSIF v_stored.id IS NOT NULL
          AND v_stored.operation_type = 'update_customer' THEN
      p_customer_id := v_stored.customer_id;
    END IF;
  END IF;

  IF p_customer_id IS NULL THEN
    SELECT coalesce(array_agg(candidate.id ORDER BY candidate.id), '{}'::uuid[])
    INTO v_match_ids
    FROM (
      SELECT DISTINCT c.id
      FROM public.clientes c
      WHERE c.lifecycle_status = 'active'
        AND (
          regexp_replace(coalesce(c.cpf, ''), '[^0-9]', '', 'g') = v_cpf
          OR regexp_replace(coalesce(c.telefone, ''), '[^0-9]', '', 'g') = v_phone
          OR (v_email IS NOT NULL AND lower(btrim(coalesce(c.email, ''))) = v_email)
        )
    ) candidate;

    IF cardinality(v_match_ids) > 1 THEN
      INSERT INTO private.phase1_audit_events (
        actor_id, event_type, entity_type, outcome_code, metadata
      )
      VALUES (
        v_actor,
        'ambassador_customer_identity_conflict',
        'customer',
        'manual_review_required',
        jsonb_build_object(
          'candidate_customer_ids', v_match_ids,
          'idempotency_key', p_idempotency_key
        )
      );

      RETURN jsonb_build_object(
        'status', 'manual_review_required',
        'code', 'multiple_customer_matches',
        'candidate_count', cardinality(v_match_ids)
      );
    END IF;

    IF cardinality(v_match_ids) = 1 THEN
      p_customer_id := v_match_ids[1];
    END IF;
  END IF;

  IF p_customer_id IS NOT NULL THEN
    SELECT *
    INTO v_customer
    FROM public.clientes
    WHERE id = p_customer_id
      AND lifecycle_status = 'active'
    FOR UPDATE;

    IF v_customer.id IS NULL THEN
      RETURN jsonb_build_object('status', 'customer_not_found');
    END IF;
  END IF;

  v_commercial_profile_id := coalesce(
    p_commercial_profile_id,
    v_customer.vendedor_responsavel_id,
    v_actor
  );

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = v_commercial_profile_id
      AND p.ativo
      AND p.role::text IN ('admin', 'vendedor')
  ) THEN
    RAISE EXCEPTION 'invalid_commercial_profile' USING ERRCODE = '22023';
  END IF;

  v_customer_result := public.fn_upsert_customer_canonical(
    p_customer_id,
    btrim(p_full_name),
    v_phone,
    v_email,
    v_cpf,
    coalesce(nullif(btrim(coalesce(p_cep, '')), ''), v_customer.cep, ''),
    coalesce(nullif(btrim(coalesce(p_address, '')), ''), v_customer.endereco, ''),
    coalesce(nullif(btrim(coalesce(p_number, '')), ''), v_customer.numero, ''),
    coalesce(nullif(btrim(coalesce(p_neighborhood, '')), ''), v_customer.bairro, ''),
    coalesce(nullif(btrim(coalesce(p_city, '')), ''), v_customer.cidade, ''),
    coalesce(nullif(upper(btrim(coalesce(p_state, ''))), ''), v_customer.estado, ''),
    coalesce(nullif(v_customer.origem, ''), 'cadastro_admin_embaixador'),
    coalesce(v_customer.status_cliente::text, 'lead'),
    v_commercial_profile_id,
    coalesce(p_latitude, v_customer.latitude),
    coalesce(p_longitude, v_customer.longitude),
    p_sponsor_ambassador_id,
    CASE WHEN p_sponsor_ambassador_id IS NULL
      THEN NULL
      ELSE 'Patrocinador confirmado no cadastro administrativo do embaixador'
    END,
    p_idempotency_key
  );

  IF v_customer_result->>'status' IN (
    'manual_review_required', 'idempotency_conflict'
  ) THEN
    RETURN v_customer_result;
  END IF;

  IF v_customer_result->>'status' NOT IN (
    'created', 'updated', 'existing_customer'
  ) THEN
    RAISE EXCEPTION 'canonical_customer_write_failed:%',
      coalesce(v_customer_result->>'status', 'unknown')
      USING ERRCODE = 'P0001';
  END IF;

  p_customer_id := (v_customer_result->>'entity_id')::uuid;
  v_customer_created := v_customer_result->>'status' = 'created';

  v_promotion_result := public.fn_admin_promote_client_to_ambassador(
    p_customer_id,
    p_plan_id,
    p_initial_status
  );

  IF v_promotion_result->>'status' NOT IN (
    'promoted', 'linked_existing_ambassador', 'already_ambassador'
  ) THEN
    RAISE EXCEPTION 'ambassador_promotion_failed:%',
      coalesce(v_promotion_result->>'status', 'unknown')
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.audit_logs (
    actor_id, actor_role, action, entity_type, entity_id, metadata
  )
  VALUES (
    v_actor,
    v_actor_role,
    'admin_created_or_linked_ambassador_customer',
    'ambassadors',
    (v_promotion_result->>'ambassador_id')::uuid,
    jsonb_build_object(
      'customer_id', p_customer_id,
      'customer_created', v_customer_created,
      'customer_status', v_customer_result->>'status',
      'promotion_status', v_promotion_result->>'status',
      'idempotency_key', p_idempotency_key
    )
  );

  RETURN jsonb_build_object(
    'status', CASE WHEN v_customer_created
      THEN 'customer_created_and_ambassador_linked'
      ELSE 'customer_reused_and_ambassador_linked'
    END,
    'customer_id', p_customer_id,
    'customer_code', (
      SELECT 'C' || lpad(c.codigo_cliente::text, 5, '0')
      FROM public.clientes c
      WHERE c.id = p_customer_id
    ),
    'customer_created', v_customer_created,
    'ambassador_id', v_promotion_result->>'ambassador_id',
    'referral_code', v_promotion_result->>'referral_code',
    'username', v_promotion_result->>'username',
    'promotion_status', v_promotion_result->>'status'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_admin_create_or_promote_ambassador(
  uuid, text, text, text, text, text, text, text, text, text, text,
  uuid, uuid, uuid, text, double precision, double precision, uuid
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.fn_admin_create_or_promote_ambassador(
  uuid, text, text, text, text, text, text, text, text, text, text,
  uuid, uuid, uuid, text, double precision, double precision, uuid
) TO authenticated;

DO $backfill$
DECLARE
  v_actor uuid;
  v_ambassador public.ambassadors%ROWTYPE;
  v_customer_id uuid;
  v_commercial_profile_id uuid;
BEGIN
  SELECT id
  INTO v_actor
  FROM public.profiles
  WHERE role = 'admin' AND ativo
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'active_admin_required_for_ambassador_customer_backfill';
  END IF;

  PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_actor::text, true);
  PERFORM pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM pg_catalog.set_config('bryza.canonical_identity_write', 'true', true);

  FOR v_ambassador IN
    SELECT *
    FROM public.ambassadors
    WHERE username IN ('bryza02', 'bryza03', 'bryza04')
    ORDER BY username
  LOOP
    v_customer_id := NULL;
    v_commercial_profile_id := NULL;

    IF v_ambassador.username = 'bryza03' THEN
      SELECT c.id, c.vendedor_responsavel_id
      INTO v_customer_id, v_commercial_profile_id
      FROM public.clientes c
      WHERE c.codigo_cliente = 1
        AND upper(c.nome) = 'ISABELE COSTA VAZ DE LISBOA'
        AND c.lifecycle_status = 'active'
      FOR UPDATE;

      IF v_customer_id IS NULL THEN
        RAISE EXCEPTION 'expected_customer_c00001_not_found';
      END IF;

      UPDATE public.clientes
      SET
        person_id = v_ambassador.person_id,
        own_ambassador_id = v_ambassador.id,
        cpf = coalesce(cpf, v_ambassador.cpf),
        email = coalesce(nullif(email, ''), v_ambassador.email)
      WHERE id = v_customer_id;
    ELSIF v_ambassador.username = 'bryza02' THEN
      SELECT p.id
      INTO v_commercial_profile_id
      FROM public.profiles p
      WHERE p.role = 'vendedor'
        AND p.ativo
        AND upper(p.nome) = upper(v_ambassador.full_name)
      ORDER BY p.created_at ASC
      LIMIT 1;
    END IF;

    IF v_customer_id IS NULL THEN
      SELECT c.id
      INTO v_customer_id
      FROM public.clientes c
      WHERE c.own_ambassador_id = v_ambassador.id
        AND c.lifecycle_status = 'active'
      LIMIT 1;

      IF v_customer_id IS NULL THEN
        INSERT INTO public.clientes (
          nome, telefone, email, cpf, cep, endereco, numero, bairro, cidade,
          estado, origem, status_cliente, vendedor_responsavel_id, latitude,
          longitude, person_id, own_ambassador_id, lifecycle_status
        )
        VALUES (
          upper(v_ambassador.full_name),
          v_ambassador.phone,
          v_ambassador.email,
          v_ambassador.cpf,
          coalesce(v_ambassador.cep, ''),
          coalesce(v_ambassador.address, ''),
          coalesce(v_ambassador.number, ''),
          coalesce(v_ambassador.neighborhood, ''),
          coalesce(v_ambassador.city, ''),
          coalesce(v_ambassador.state, ''),
          'cadastro_admin_embaixador',
          'cliente',
          coalesce(v_commercial_profile_id, v_actor),
          v_ambassador.latitude,
          v_ambassador.longitude,
          v_ambassador.person_id,
          v_ambassador.id,
          'active'
        )
        RETURNING id INTO v_customer_id;
      END IF;
    END IF;

    INSERT INTO private.person_business_roles (
      person_id, role_type, source_entity_id, status, activated_at
    )
    VALUES (
      v_ambassador.person_id, 'customer', v_customer_id, 'active', now()
    )
    ON CONFLICT (role_type, source_entity_id)
    DO UPDATE SET
      person_id = EXCLUDED.person_id,
      status = 'active',
      activated_at = coalesce(
        private.person_business_roles.activated_at,
        EXCLUDED.activated_at
      ),
      inactivated_at = NULL,
      updated_at = now();

    IF NOT EXISTS (
      SELECT 1
      FROM private.customer_commercial_assignments assignment
      WHERE assignment.customer_id = v_customer_id
        AND assignment.valid_until IS NULL
    ) THEN
      INSERT INTO private.customer_commercial_assignments (
        customer_id, commercial_profile_id, source, reason, assigned_by
      )
      VALUES (
        v_customer_id,
        coalesce(v_commercial_profile_id, v_actor),
        'ambassador_customer_backfill',
        'Conciliação administrativa aprovada do perfil próprio do embaixador',
        v_actor
      );
    END IF;

    INSERT INTO public.audit_logs (
      actor_id, actor_role, action, entity_type, entity_id, metadata
    )
    VALUES (
      v_actor,
      'admin',
      'admin_reconciled_ambassador_customer',
      'ambassadors',
      v_ambassador.id,
      jsonb_build_object(
        'customer_id', v_customer_id,
        'username', v_ambassador.username,
        'reused_customer', v_ambassador.username = 'bryza03'
      )
    );
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM public.ambassadors a
    LEFT JOIN public.clientes c
      ON c.own_ambassador_id = a.id
     AND c.person_id = a.person_id
     AND c.lifecycle_status = 'active'
    LEFT JOIN private.person_business_roles r
      ON r.role_type = 'customer'
     AND r.source_entity_id = c.id
     AND r.person_id = a.person_id
     AND r.status = 'active'
    WHERE a.username IN ('bryza02', 'bryza03', 'bryza04')
    GROUP BY a.id
    HAVING count(c.id) <> 1 OR count(r.id) <> 1
  ) THEN
    RAISE EXCEPTION 'ambassador_customer_backfill_invariant_failed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.ambassadors a
    JOIN public.clientes c ON c.own_ambassador_id = a.id
    WHERE a.username = 'bryza03'
      AND c.codigo_cliente = 1
      AND c.person_id = a.person_id
  ) THEN
    RAISE EXCEPTION 'bryza03_must_reuse_c00001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.clientes c
    WHERE c.own_ambassador_id IS NOT NULL
      AND c.commissionable_ambassador_id = c.own_ambassador_id
  ) THEN
    RAISE EXCEPTION 'customer_cannot_be_self_referred';
  END IF;
END;
$backfill$;

COMMIT;
