-- Transactional verification for Phase 2. All synthetic rows are rolled back.

BEGIN;

DO $$
BEGIN
  IF has_schema_privilege('anon', 'private', 'USAGE')
     OR has_schema_privilege('authenticated', 'private', 'USAGE') THEN
    RAISE EXCEPTION 'private schema became directly accessible';
  END IF;

  IF has_table_privilege(
    'authenticated',
    'private.customer_ambassador_assignments',
    'SELECT,INSERT,UPDATE,DELETE'
  ) THEN
    RAISE EXCEPTION 'authenticated has direct assignment table access';
  END IF;

  IF NOT has_table_privilege(
    'service_role',
    'private.customer_ambassador_assignments',
    'SELECT,INSERT,UPDATE'
  ) OR has_table_privilege(
    'service_role',
    'private.customer_ambassador_assignments',
    'DELETE'
  ) THEN
    RAISE EXCEPTION 'service_role assignment privileges are not minimal';
  END IF;
END
$$;

DO $$
DECLARE
  v_admin uuid;
  v_seller uuid;
  v_ambassador uuid;
  v_create_key uuid := extensions.gen_random_uuid();
  v_create jsonb;
  v_replay jsonb;
  v_conflict jsonb;
  v_customer_id uuid;
  v_person_id uuid;
  v_manual jsonb;
  v_assignment_id uuid;
  v_self_key uuid := extensions.gen_random_uuid();
  v_self_result jsonb;
  v_business_roles bigint;
  v_commercial_rows bigint;
  v_customer_count_before bigint;
  v_customer_count_after bigint;
BEGIN
  SELECT id INTO v_admin
  FROM public.profiles
  WHERE role::text = 'admin' AND ativo
  ORDER BY id LIMIT 1;

  SELECT id INTO v_seller
  FROM public.profiles
  WHERE role::text = 'vendedor' AND ativo
  ORDER BY id LIMIT 1;

  SELECT id INTO v_ambassador
  FROM public.ambassadors
  WHERE status = 'ativo' AND lifecycle_status = 'active'
  ORDER BY id LIMIT 1;

  IF v_admin IS NULL OR v_seller IS NULL OR v_ambassador IS NULL THEN
    RAISE EXCEPTION 'Phase 2 test requires active admin, seller and ambassador';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  SELECT count(*) INTO v_customer_count_before FROM public.clientes;

  v_create := public.fn_upsert_customer_canonical(
    NULL,
    'Phase Two Canonical Test',
    '(11) 98888-7001',
    'phase2-canonical@example.invalid',
    '52998224725',
    '01001-000',
    'Test Address',
    '1',
    'Test Neighborhood',
    'Test City',
    'SP',
    'test',
    'lead',
    v_seller,
    NULL,
    NULL,
    v_ambassador,
    'Individual audited test assignment',
    v_create_key
  );

  IF v_create->>'status' <> 'created' THEN
    RAISE EXCEPTION 'canonical customer create failed: %', v_create;
  END IF;

  v_customer_id := (v_create->>'entity_id')::uuid;

  SELECT person_id, current_referral_assignment_id
  INTO v_person_id, v_assignment_id
  FROM public.clientes
  WHERE id = v_customer_id;

  IF v_person_id IS NULL OR v_assignment_id IS NULL THEN
    RAISE EXCEPTION 'canonical customer/assignment pointers were not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM private.customer_ambassador_assignments
    WHERE id = v_assignment_id
      AND customer_id = v_customer_id
      AND ambassador_id = v_ambassador
      AND status = 'active'
      AND is_validated
      AND is_commissionable
  ) THEN
    RAISE EXCEPTION 'official assignment was not persisted correctly';
  END IF;

  SELECT count(*) INTO v_business_roles
  FROM private.person_business_roles
  WHERE person_id = v_person_id
    AND role_type = 'customer'
    AND source_entity_id = v_customer_id;

  SELECT count(*) INTO v_commercial_rows
  FROM private.customer_commercial_assignments
  WHERE customer_id = v_customer_id
    AND commercial_profile_id = v_seller
    AND valid_until IS NULL;

  IF v_business_roles <> 1 OR v_commercial_rows <> 1 THEN
    RAISE EXCEPTION 'business role or commercial responsibility history missing';
  END IF;

  v_replay := public.fn_upsert_customer_canonical(
    NULL,
    'Phase Two Canonical Test',
    '(11) 98888-7001',
    'phase2-canonical@example.invalid',
    '52998224725',
    '01001-000',
    'Test Address',
    '1',
    'Test Neighborhood',
    'Test City',
    'SP',
    'test',
    'lead',
    v_seller,
    NULL,
    NULL,
    v_ambassador,
    'Individual audited test assignment',
    v_create_key
  );

  IF v_replay->>'status' <> 'created'
     OR (v_replay->>'entity_id')::uuid <> v_customer_id
     OR coalesce((v_replay->>'replayed')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'canonical idempotency replay failed: %', v_replay;
  END IF;

  v_conflict := public.fn_upsert_customer_canonical(
    NULL,
    'Different Payload',
    '(11) 98888-7002',
    NULL,
    NULL,
    '',
    '',
    '',
    '',
    '',
    'SP',
    'test',
    'lead',
    v_seller,
    NULL,
    NULL,
    NULL,
    NULL,
    v_create_key
  );

  IF v_conflict->>'status' <> 'idempotency_conflict' THEN
    RAISE EXCEPTION 'same key/different payload did not conflict';
  END IF;

  v_manual := public.fn_upsert_customer_canonical(
    NULL,
    'Unverified Phone Match',
    '(11) 98888-7001',
    NULL,
    NULL,
    '',
    '',
    '',
    '',
    '',
    'SP',
    'test',
    'lead',
    v_seller,
    NULL,
    NULL,
    NULL,
    NULL,
    extensions.gen_random_uuid()
  );

  IF v_manual->>'status' <> 'manual_review_required'
     OR v_manual->>'review_id' IS NULL THEN
    RAISE EXCEPTION 'unverified phone match did not persist manual review';
  END IF;

  SELECT count(*) INTO v_customer_count_after FROM public.clientes;
  IF v_customer_count_after <> v_customer_count_before + 1 THEN
    RAISE EXCEPTION 'manual review unexpectedly modified customer entities';
  END IF;

  UPDATE public.ambassadors
  SET person_id = v_person_id
  WHERE id = v_ambassador;

  v_self_result := public.fn_assign_customer_ambassador(
    v_customer_id,
    v_ambassador,
    'administrative_review',
    'Self referral rejection test',
    v_self_key
  );

  IF v_self_result->>'status' <> 'rejected'
     OR v_self_result->>'code' <> 'self_referral_forbidden' THEN
    RAISE EXCEPTION 'self referral was not rejected structurally: %', v_self_result;
  END IF;

  IF EXISTS (
    SELECT 1 FROM private.operation_idempotency
    WHERE original_result::text ~* '(phase2-canonical@example|98888-7001|52998224725|Test Address)'
  ) THEN
    RAISE EXCEPTION 'PII leaked into idempotency original_result';
  END IF;
END
$$;

ROLLBACK;
