-- Production-safe transactional verification for the operational integration.
BEGIN;

DO $$
DECLARE
  v_admin uuid;
  v_customer uuid;
  v_ambassador uuid;
  v_ambassador_person uuid;
  v_product uuid;
  v_price numeric;
  v_payload jsonb;
  v_items jsonb;
  v_key uuid := extensions.gen_random_uuid();
  v_created jsonb;
  v_replay jsonb;
  v_conflict jsonb;
  v_self jsonb;
  v_order_id uuid;
  v_private_read_blocked boolean := false;
BEGIN
  BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM 1 FROM private.persons LIMIT 1;
  EXCEPTION WHEN insufficient_privilege THEN
    v_private_read_blocked := true;
  END;
  RESET ROLE;

  IF NOT v_private_read_blocked THEN
    RAISE EXCEPTION 'authenticated read private.persons directly';
  END IF;

  SELECT id INTO v_admin
  FROM public.profiles
  WHERE role::text = 'admin' AND ativo
  ORDER BY id LIMIT 1;

  SELECT id, person_id INTO v_ambassador, v_ambassador_person
  FROM public.ambassadors
  WHERE status = 'ativo'
    AND lifecycle_status = 'active'
    AND person_id IS NOT NULL
  ORDER BY id LIMIT 1;

  SELECT id INTO v_customer
  FROM public.clientes
  WHERE lifecycle_status = 'active'
    AND person_id IS NOT NULL
    AND person_id <> v_ambassador_person
    AND current_referral_assignment_id IS NULL
  ORDER BY id LIMIT 1;

  SELECT id, preco_venda INTO v_product, v_price
  FROM public.produtos
  WHERE ativo AND preco_venda > 0 AND estoque_atual > 0
  ORDER BY id LIMIT 1;

  IF v_admin IS NULL OR v_customer IS NULL OR v_ambassador IS NULL
     OR v_product IS NULL THEN
    RAISE EXCEPTION 'Phase 8 prerequisites missing';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  v_payload := jsonb_build_object(
    'cliente_id', v_customer,
    'selected_ambassador_id', v_ambassador,
    'vendedor_id', v_admin,
    'valor_total', v_price,
    'desconto_tipo', 'none',
    'desconto_valor', 0,
    'desconto_aplicado', 0,
    'forma_pagamento', 'pix',
    'nome_vendedor', 'Phase 8 Test',
    'codigo_vendedor', 0
  );
  v_items := jsonb_build_array(jsonb_build_object(
    'produto_id', v_product,
    'quantidade', 1,
    'preco_unitario', v_price,
    'desconto_tipo', 'none',
    'desconto_valor', 0,
    'desconto_aplicado', 0,
    'subtotal', v_price
  ));

  v_created := public.fn_create_manual_order_canonical(
    v_payload, v_items, v_key
  );
  IF v_created->>'status' <> 'created' THEN
    RAISE EXCEPTION 'Atomic order creation failed: %', v_created;
  END IF;

  v_order_id := (v_created->>'entity_id')::uuid;
  IF NOT EXISTS (
    SELECT 1
    FROM public.pedidos p
    JOIN private.customer_ambassador_assignments a
      ON a.id = p.referral_assignment_id
    WHERE p.id = v_order_id
      AND a.customer_id = v_customer
      AND a.ambassador_id = v_ambassador
      AND a.status = 'active'
      AND a.valid_until IS NULL
      AND a.is_validated
      AND a.is_commissionable
      AND p.ambassador_name_snapshot IS NOT NULL
      AND p.commission_levels_snapshot IS NOT NULL
      AND p.qualification_snapshot IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Atomic assignment or complete order snapshot missing';
  END IF;

  v_replay := public.fn_create_manual_order_canonical(
    v_payload, v_items, v_key
  );
  IF coalesce((v_replay->>'replayed')::boolean, false) IS NOT TRUE
     OR v_replay->>'entity_id' <> v_created->>'entity_id' THEN
    RAISE EXCEPTION 'Idempotent replay failed';
  END IF;

  v_conflict := public.fn_create_manual_order_canonical(
    v_payload || jsonb_build_object('forma_pagamento', 'dinheiro'),
    v_items,
    v_key
  );
  IF v_conflict->>'status' <> 'idempotency_conflict' THEN
    RAISE EXCEPTION 'Different payload reused the idempotency key';
  END IF;

  UPDATE private.customer_ambassador_assignments
  SET status = 'ended',
      valid_until = greatest(now(), valid_from + interval '1 microsecond'),
      ended_by = v_admin
  WHERE customer_id = v_customer
    AND status = 'active';

  PERFORM set_config('bryza.canonical_identity_write', 'true', true);
  PERFORM set_config('bryza.canonical_referral_write', 'true', true);
  UPDATE public.clientes
  SET person_id = v_ambassador_person,
      current_referral_assignment_id = NULL,
      commissionable_ambassador_id = NULL,
      ambassador_id = NULL
  WHERE id = v_customer;

  v_self := public.fn_create_manual_order_canonical(
    v_payload, v_items, extensions.gen_random_uuid()
  );
  IF v_self->>'status' <> 'assignment_rejected'
     OR v_self->>'code' <> 'self_referral_forbidden' THEN
    RAISE EXCEPTION 'Explicit self-referral was not blocked: %', v_self;
  END IF;
END
$$;

ROLLBACK;
