-- Transactional verification for official order attribution.

BEGIN;

DO $$
DECLARE
  v_admin uuid;
  v_customer uuid;
  v_legacy_only_customer uuid;
  v_ambassador uuid;
  v_ambassador_person uuid;
  v_product uuid;
  v_price numeric;
  v_assignment jsonb;
  v_order jsonb;
  v_replay jsonb;
  v_order_id uuid;
  v_self_order jsonb;
  v_self_order_id uuid;
  v_legacy_order jsonb;
  v_legacy_order_id uuid;
  v_key uuid := extensions.gen_random_uuid();
  v_payload jsonb;
  v_items jsonb;
BEGIN
  SELECT id INTO v_admin
  FROM public.profiles
  WHERE role::text = 'admin' AND ativo
  ORDER BY id LIMIT 1;

  SELECT id, person_id
  INTO v_ambassador, v_ambassador_person
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
  ORDER BY id LIMIT 1;

  SELECT id INTO v_legacy_only_customer
  FROM public.clientes
  WHERE lifecycle_status = 'active'
    AND ambassador_id IS NOT NULL
    AND commissionable_ambassador_id IS NULL
    AND current_referral_assignment_id IS NULL
    AND id <> v_customer
  ORDER BY id LIMIT 1;

  SELECT id, preco_venda INTO v_product, v_price
  FROM public.produtos
  WHERE ativo AND preco_venda > 0 AND estoque_atual > 0
  ORDER BY id LIMIT 1;

  IF v_admin IS NULL OR v_customer IS NULL OR v_legacy_only_customer IS NULL
     OR v_ambassador IS NULL OR v_product IS NULL THEN
    RAISE EXCEPTION 'Phase 4 test prerequisites missing';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  INSERT INTO private.ambassador_program_exceptions (
    ambassador_id,
    rule_code,
    effect_type,
    reason,
    valid_from,
    valid_until,
    granted_by
  )
  VALUES (
    v_ambassador,
    'monthly_purchase_qualification',
    'allow',
    'Transactional Phase 4 qualification test',
    date_trunc('month', now()),
    date_trunc('month', now()) + interval '1 month',
    v_admin
  );

  v_assignment := public.fn_assign_customer_ambassador(
    v_customer,
    v_ambassador,
    'administrative_review',
    'Transactional official order attribution test',
    extensions.gen_random_uuid()
  );

  IF v_assignment->>'status' <> 'assigned' THEN
    RAISE EXCEPTION 'official assignment setup failed: %', v_assignment;
  END IF;

  v_payload := jsonb_build_object(
    'cliente_id', v_customer,
    'vendedor_id', v_admin,
    'valor_total', v_price,
    'desconto_tipo', 'none',
    'desconto_valor', 0,
    'desconto_aplicado', 0,
    'forma_pagamento', 'pix',
    'nome_vendedor', 'Phase 4 Test',
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

  v_order := public.fn_create_manual_order_canonical(
    v_payload, v_items, v_key
  );

  IF v_order->>'status' <> 'created'
     OR coalesce((v_order->>'commissionable')::boolean, false) IS NOT TRUE
     OR coalesce((v_order->>'qualified')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'canonical order did not freeze valid attribution: %', v_order;
  END IF;

  v_order_id := (v_order->>'entity_id')::uuid;

  IF NOT EXISTS (
    SELECT 1 FROM public.pedidos
    WHERE id = v_order_id
      AND referral_assignment_id IS NOT NULL
      AND referral_validated_snapshot
      AND referral_commissionable_snapshot
      AND ambassador_qualified_snapshot
      AND ambassador_id = v_ambassador
  ) THEN
    RAISE EXCEPTION 'official order snapshots missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.commissions
    WHERE order_id = v_order_id
      AND ambassador_id = v_ambassador
      AND commission_type = 'network_percentage'
  ) THEN
    RAISE EXCEPTION 'qualified official order did not create commission';
  END IF;

  v_replay := public.fn_create_manual_order_canonical(
    v_payload, v_items, v_key
  );
  IF v_replay->>'status' <> 'created'
     OR (v_replay->>'entity_id')::uuid <> v_order_id
     OR coalesce((v_replay->>'replayed')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'canonical order idempotency replay failed';
  END IF;

  PERFORM set_config('bryza.canonical_identity_write', 'true', true);
  UPDATE public.clientes
  SET person_id = v_ambassador_person
  WHERE id = v_customer;

  v_self_order := public.fn_create_manual_order_canonical(
    v_payload, v_items, extensions.gen_random_uuid()
  );
  v_self_order_id := (v_self_order->>'entity_id')::uuid;

  IF EXISTS (
    SELECT 1 FROM public.pedidos
    WHERE id = v_self_order_id
      AND (ambassador_id IS NOT NULL OR referral_commissionable_snapshot)
  ) OR EXISTS (
    SELECT 1 FROM public.commissions WHERE order_id = v_self_order_id
  ) THEN
    RAISE EXCEPTION 'defense-in-depth self referral protection failed';
  END IF;

  v_payload := jsonb_set(
    v_payload,
    '{cliente_id}',
    to_jsonb(v_legacy_only_customer)
  );
  v_legacy_order := public.fn_create_manual_order_canonical(
    v_payload, v_items, extensions.gen_random_uuid()
  );
  v_legacy_order_id := (v_legacy_order->>'entity_id')::uuid;

  IF EXISTS (
    SELECT 1 FROM public.pedidos
    WHERE id = v_legacy_order_id
      AND (ambassador_id IS NOT NULL OR referral_assignment_id IS NOT NULL)
  ) OR EXISTS (
    SELECT 1 FROM public.commissions WHERE order_id = v_legacy_order_id
  ) THEN
    RAISE EXCEPTION 'legacy customer ambassador_id influenced a new order';
  END IF;
END
$$;

ROLLBACK;
