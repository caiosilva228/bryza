-- Transactional production-safe verification for Phase 1.
-- Every synthetic row is rolled back.

BEGIN;

DO $$
BEGIN
  IF has_schema_privilege('anon', 'private', 'USAGE') THEN
    RAISE EXCEPTION 'anon unexpectedly has USAGE on private';
  END IF;
  IF has_schema_privilege('authenticated', 'private', 'USAGE') THEN
    RAISE EXCEPTION 'authenticated unexpectedly has USAGE on private';
  END IF;
  IF has_table_privilege('anon', 'private.persons', 'SELECT') THEN
    RAISE EXCEPTION 'anon unexpectedly has SELECT on private.persons';
  END IF;
  IF has_table_privilege('authenticated', 'private.persons', 'SELECT,INSERT,UPDATE,DELETE') THEN
    RAISE EXCEPTION 'authenticated unexpectedly has direct DML on private.persons';
  END IF;
  IF NOT has_table_privilege('service_role', 'private.persons', 'SELECT,INSERT,UPDATE') THEN
    RAISE EXCEPTION 'service_role is missing required minimal DML on private.persons';
  END IF;
  IF has_table_privilege('service_role', 'private.persons', 'DELETE') THEN
    RAISE EXCEPTION 'service_role unexpectedly has DELETE on private.persons';
  END IF;
END
$$;

DO $$
DECLARE
  v_blocked boolean := false;
BEGIN
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    EXECUTE 'SELECT 1 FROM private.persons LIMIT 1';
  EXCEPTION
    WHEN insufficient_privilege THEN
      v_blocked := true;
  END;
  RESET ROLE;

  IF NOT v_blocked THEN
    RAISE EXCEPTION 'anon direct query was not blocked';
  END IF;
END
$$;

DO $$
DECLARE
  v_blocked boolean := false;
BEGIN
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    EXECUTE 'SELECT 1 FROM private.persons LIMIT 1';
  EXCEPTION
    WHEN insufficient_privilege THEN
      v_blocked := true;
  END;
  RESET ROLE;

  IF NOT v_blocked THEN
    RAISE EXCEPTION 'authenticated direct query was not blocked';
  END IF;
END
$$;

DO $$
DECLARE
  v_user_1 uuid;
  v_user_2 uuid;
  v_person_1 uuid;
  v_person_2 uuid;
  v_unique_user_blocked boolean := false;
  v_unique_person_blocked boolean := false;
BEGIN
  SELECT auth_user_id, person_id
  INTO v_user_1, v_person_1
  FROM private.person_accounts
  WHERE status = 'active'
  ORDER BY created_at, id LIMIT 1;

  SELECT auth_user_id
  INTO v_user_2
  FROM private.person_accounts
  WHERE status = 'active' AND auth_user_id <> v_user_1
  ORDER BY created_at, id LIMIT 1;

  IF v_user_1 IS NULL OR v_user_2 IS NULL THEN
    RAISE EXCEPTION 'identity uniqueness test requires two existing auth users';
  END IF;

  INSERT INTO private.persons(full_name)
  VALUES ('Phase 1 Test Person B')
  RETURNING id INTO v_person_2;

  BEGIN
    INSERT INTO private.person_accounts(person_id, auth_user_id)
    VALUES (v_person_2, v_user_1);
  EXCEPTION
    WHEN unique_violation THEN
      v_unique_user_blocked := true;
  END;

  BEGIN
    INSERT INTO private.person_accounts(person_id, auth_user_id)
    VALUES (v_person_1, v_user_2);
  EXCEPTION
    WHEN unique_violation THEN
      v_unique_person_blocked := true;
  END;

  IF NOT v_unique_user_blocked OR NOT v_unique_person_blocked THEN
    RAISE EXCEPTION 'one-to-one person/auth account invariant failed';
  END IF;
END
$$;

DO $$
DECLARE
  v_admin uuid;
  v_fingerprint bytea;
  v_first jsonb;
  v_second jsonb;
  v_review_id uuid;
  v_count bigint;
BEGIN
  SELECT id
  INTO v_admin
  FROM public.profiles
  WHERE role::text = 'admin' AND ativo
  ORDER BY id
  LIMIT 1;

  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'active admin required for RPC test';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  v_fingerprint := public.fn_phase1_identity_fingerprint(
    'email',
    'phase1-test@example.invalid',
    1::smallint
  );

  v_first := public.fn_phase1_open_identity_review(
    v_fingerprint,
    ARRAY['email_conflict'],
    'phase1_test'
  );

  v_second := public.fn_phase1_open_identity_review(
    v_fingerprint,
    ARRAY['email_conflict'],
    'phase1_test'
  );

  IF v_first->>'status' <> 'manual_review_required'
     OR v_second->>'status' <> 'manual_review_required'
     OR v_first->>'review_id' IS DISTINCT FROM v_second->>'review_id' THEN
    RAISE EXCEPTION 'identity conflict structured result/deduplication failed';
  END IF;

  v_review_id := (v_first->>'review_id')::uuid;
  SELECT count(*) INTO v_count
  FROM private.identity_conflict_reviews
  WHERE id = v_review_id AND status = 'open';

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'identity conflict review was not persisted exactly once';
  END IF;
END
$$;

DO $$
DECLARE
  v_admin uuid;
  v_key uuid := extensions.gen_random_uuid();
  v_hash bytea := extensions.digest(
    convert_to('{"amount":100,"operation":"phase1_test"}', 'UTF8'),
    'sha256'
  );
  v_other_hash bytea := extensions.digest(
    convert_to('{"amount":101,"operation":"phase1_test"}', 'UTF8'),
    'sha256'
  );
  v_begin jsonb;
  v_complete jsonb;
  v_replay jsonb;
  v_conflict jsonb;
  v_stored jsonb;
BEGIN
  SELECT id
  INTO v_admin
  FROM public.profiles
  WHERE role::text = 'admin' AND ativo
  ORDER BY id
  LIMIT 1;

  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  v_begin := public.fn_phase1_idempotency_begin(
    v_key, 'phase1_test', NULL, 'identity_review', v_hash, 300
  );

  IF v_begin->>'status' <> 'acquired' THEN
    RAISE EXCEPTION 'first idempotency call did not acquire operation: %', v_begin;
  END IF;

  v_complete := public.fn_phase1_idempotency_complete(
    v_key,
    'phase1_test',
    v_hash,
    jsonb_build_object(
      'status', 'completed',
      'code', 'ok',
      'entity_id', extensions.gen_random_uuid(),
      'email', 'must-not-be-stored@example.invalid',
      'phone', '11999999999',
      'cpf', '00000000000',
      'address', 'must not be stored',
      'token', 'must-not-be-stored'
    )
  );

  IF v_complete->>'status' <> 'completed' THEN
    RAISE EXCEPTION 'idempotency completion failed: %', v_complete;
  END IF;

  v_replay := public.fn_phase1_idempotency_begin(
    v_key, 'phase1_test', NULL, 'identity_review', v_hash, 300
  );

  IF v_replay->>'status' <> 'replayed'
     OR v_replay->'result' IS DISTINCT FROM v_complete->'result' THEN
    RAISE EXCEPTION 'same idempotency key/payload did not replay original result';
  END IF;

  v_conflict := public.fn_phase1_idempotency_begin(
    v_key, 'phase1_test', NULL, 'identity_review', v_other_hash, 300
  );

  IF v_conflict->>'status' <> 'idempotency_conflict' THEN
    RAISE EXCEPTION 'different payload did not return idempotency_conflict';
  END IF;

  SELECT original_result INTO v_stored
  FROM private.operation_idempotency
  WHERE operation_scope = 'phase1_test' AND idempotency_key = v_key;

  IF v_stored ?| ARRAY['email', 'phone', 'cpf', 'address', 'token', 'credential', 'secret']
     OR v_stored::text ~* '(example\\.invalid|11999999999|00000000000|must.not.be.stored)' THEN
    RAISE EXCEPTION 'sensitive PII leaked into idempotency original_result';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('clientes', 'profiles', 'ambassadors')
      AND column_name = 'person_id'
      AND is_nullable <> 'YES'
  ) THEN
    RAISE EXCEPTION 'Phase 1 person links must remain nullable';
  END IF;

  -- Later phases intentionally performed a controlled, evidence-based backfill.
  -- The columns remain nullable so unresolved identities can stay in review.
END
$$;

ROLLBACK;
