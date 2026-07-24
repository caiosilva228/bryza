-- Transactional production-safe validation for phases 5-7.
BEGIN;

DO $$
DECLARE
  v_admin uuid;
  v_invitee uuid;
  v_person_id uuid;
  v_person private.persons%ROWTYPE;
  v_customer_id uuid := extensions.gen_random_uuid();
  v_token uuid := extensions.gen_random_uuid();
  v_invite jsonb;
  v_accept jsonb;
  v_blocked boolean := false;
  v_ambassador_id uuid;
BEGIN
  SELECT p.id INTO v_admin
  FROM public.profiles p
  WHERE p.role = 'admin' AND p.ativo
  ORDER BY p.created_at
  LIMIT 1;

  SELECT p.id, pe.id INTO v_invitee, v_person_id
  FROM public.profiles p
  JOIN private.persons pe ON pe.id = p.person_id
  WHERE p.ativo
    AND NOT EXISTS (
      SELECT 1 FROM public.ambassadors a
      WHERE a.person_id = pe.id
    )
  ORDER BY p.created_at
  LIMIT 1;

  SELECT * INTO v_person FROM private.persons WHERE id = v_person_id;

  IF v_admin IS NULL OR v_invitee IS NULL THEN
    RAISE EXCEPTION 'Phase 7 test requires an admin and a non-ambassador account';
  END IF;

  UPDATE private.persons
  SET cpf_normalized = '98765432100',
      email_normalized = 'phase7.invitee@example.invalid',
      phone_normalized = '11987654320'
  WHERE id = v_person.id;
  SELECT * INTO v_person FROM private.persons WHERE id = v_person_id;

  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('bryza.canonical_identity_write', 'true', true);
  INSERT INTO public.clientes (
    id, person_id, nome, cpf, email, telefone, endereco, bairro,
    cidade, estado, origem, status_cliente
  ) VALUES (
    v_customer_id, v_person.id, v_person.full_name,
    v_person.cpf_normalized, v_person.email_normalized,
    v_person.phone_normalized, 'Rua Teste', 'Centro',
    'São Paulo', 'SP', 'phase7_transactional_test', 'lead'
  );
  INSERT INTO private.person_business_roles (
    person_id, role_type, source_entity_id, status, activated_at
  ) VALUES (
    v_person.id, 'customer', v_customer_id, 'active', now()
  );
  PERFORM set_config('bryza.canonical_identity_write', '', true);

  BEGIN
    UPDATE public.clientes
    SET telefone = '11999999999'
    WHERE id = v_customer_id;
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Independent customer personal-data update was not blocked';
  END IF;

  v_invite := public.fn_admin_create_ambassador_invitation(
    v_customer_id,
    'programa-embaixadores-v1',
    v_token,
    now() + interval '14 days'
  );
  IF v_invite->>'status' <> 'created' THEN
    RAISE EXCEPTION 'Invitation creation failed: %', v_invite;
  END IF;
  IF EXISTS (
    SELECT 1 FROM private.ambassador_program_invitations
    WHERE id = (v_invite->>'invitation_id')::uuid
      AND encode(token_fingerprint, 'escape') LIKE '%' || v_token::text || '%'
  ) THEN
    RAISE EXCEPTION 'Raw invitation token leaked into the private table';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_invitee::text, true);
  v_accept := public.fn_accept_ambassador_invitation(
    v_token,
    'programa-embaixadores-v1'
  );
  IF v_accept->>'status' <> 'accepted' THEN
    RAISE EXCEPTION 'Invitation acceptance failed: %', v_accept;
  END IF;
  v_ambassador_id := (v_accept->>'ambassador_id')::uuid;

  IF NOT EXISTS (
    SELECT 1 FROM private.person_business_roles
    WHERE person_id = v_person.id AND role_type = 'customer' AND status = 'active'
  ) OR NOT EXISTS (
    SELECT 1 FROM private.person_business_roles
    WHERE person_id = v_person.id AND role_type = 'ambassador' AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Customer and ambassador business roles do not coexist';
  END IF;
  IF (SELECT own_ambassador_id FROM public.clientes WHERE id = v_customer_id)
     IS DISTINCT FROM v_ambassador_id THEN
    RAISE EXCEPTION 'Customer own ambassador role was not linked separately';
  END IF;
END
$$;

DO $$
DECLARE
  v_admin uuid;
  v_visit public.referral_visits%ROWTYPE;
  v_product public.produtos%ROWTYPE;
  v_key uuid := extensions.gen_random_uuid();
  v_customer jsonb;
  v_items jsonb;
  v_attribution jsonb;
  v_first jsonb;
  v_replay jsonb;
  v_conflict jsonb;
  v_phone text := '11987654321';
  v_cpf text := '12345678909';
BEGIN
  SELECT id INTO v_admin FROM public.profiles
  WHERE role = 'admin' AND ativo ORDER BY created_at LIMIT 1;
  SELECT rv.* INTO v_visit
  FROM public.referral_visits rv
  JOIN public.ambassadors a ON a.id = rv.ambassador_id
  WHERE a.status = 'ativo'
    AND a.lifecycle_status = 'active'
    AND rv.visited_at >= now() - interval '10 days'
  ORDER BY rv.visited_at DESC LIMIT 1;
  SELECT * INTO v_product FROM public.produtos
  WHERE ativo AND preco_venda > 0 ORDER BY id LIMIT 1;
  IF v_visit.id IS NULL OR v_product.id IS NULL THEN
    RAISE EXCEPTION 'Public scheduling test prerequisites missing';
  END IF;

  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);

  v_customer := jsonb_build_object(
    'nome', 'Pessoa Teste Canônica',
    'cpf', v_cpf,
    'telefone', v_phone,
    'email', 'phase7.transactional@example.invalid',
    'endereco', 'Rua Transacional',
    'numero', '100',
    'bairro', 'Centro',
    'cidade', 'São Paulo',
    'estado', 'SP',
    'cep', '01001000',
    'data_agendamento', (now() + interval '2 days')::text,
    'forma_pagamento', 'pix'
  );
  v_items := jsonb_build_array(jsonb_build_object(
    'produto_id', v_product.id,
    'quantidade', 1
  ));
  v_attribution := jsonb_build_object(
    'referral_code', v_visit.referral_code,
    'visit_id', v_visit.id,
    'source', 'smart_link'
  );

  v_first := public.fn_criar_agendamento_publico(
    v_customer, v_items, v_attribution, v_key
  );
  v_replay := public.fn_criar_agendamento_publico(
    v_customer, v_items, v_attribution, v_key
  );
  v_conflict := public.fn_criar_agendamento_publico(
    v_customer || jsonb_build_object('numero', '101'),
    v_items, v_attribution, v_key
  );

  IF v_first->>'status' <> 'created'
     OR v_replay->>'agendamento_id' <> v_first->>'agendamento_id'
     OR coalesce((v_replay->>'replayed')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Public scheduling idempotent replay failed: %, %', v_first, v_replay;
  END IF;
  IF v_conflict->>'status' <> 'idempotency_conflict' THEN
    RAISE EXCEPTION 'Public scheduling payload conflict was not detected: %', v_conflict;
  END IF;
  IF EXISTS (SELECT 1 FROM public.ambassadors WHERE cpf = v_cpf) THEN
    RAISE EXCEPTION 'Public checkout auto-created an ambassador';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.agendamentos a
    JOIN private.customer_ambassador_assignments ca
      ON ca.id = a.referral_assignment_id
    WHERE a.id = (v_first->>'agendamento_id')::uuid
      AND ca.is_validated
      AND ca.is_commissionable
  ) THEN
    RAISE EXCEPTION 'Public scheduling did not use an official validated assignment';
  END IF;
END
$$;

ROLLBACK;
