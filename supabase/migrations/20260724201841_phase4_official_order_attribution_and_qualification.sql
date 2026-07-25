-- Remote migration 20260724201841. Phase 4: orders read only the official assignment history and freeze
-- qualification/attribution snapshots at creation time.

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS referral_assignment_id uuid,
  ADD COLUMN IF NOT EXISTS referral_validated_snapshot boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS referral_commissionable_snapshot boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ambassador_qualified_snapshot boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ambassador_qualification_id_snapshot uuid,
  ADD COLUMN IF NOT EXISTS qualification_period_start_snapshot date,
  ADD COLUMN IF NOT EXISTS qualification_period_end_snapshot date;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pedidos_referral_assignment_id_fkey'
      AND conrelid = 'public.pedidos'::regclass
  ) THEN
    ALTER TABLE public.pedidos
      ADD CONSTRAINT pedidos_referral_assignment_id_fkey
      FOREIGN KEY (referral_assignment_id)
      REFERENCES private.customer_ambassador_assignments(id)
      ON DELETE RESTRICT NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pedidos_ambassador_qualification_id_fkey'
      AND conrelid = 'public.pedidos'::regclass
  ) THEN
    ALTER TABLE public.pedidos
      ADD CONSTRAINT pedidos_ambassador_qualification_id_fkey
      FOREIGN KEY (ambassador_qualification_id_snapshot)
      REFERENCES private.ambassador_qualifications(id)
      ON DELETE RESTRICT NOT VALID;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_pedidos_referral_assignment
  ON public.pedidos(referral_assignment_id)
  WHERE referral_assignment_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fn_evaluate_ambassador_qualification(
  p_ambassador_id uuid,
  p_reference_date date DEFAULT current_date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_actor uuid;
  v_role text;
  v_ambassador public.ambassadors%ROWTYPE;
  v_period_start date := date_trunc('month', p_reference_date)::date;
  v_period_end date := (date_trunc('month', p_reference_date) + interval '1 month - 1 day')::date;
  v_minimum numeric := 0;
  v_personal_purchase numeric := 0;
  v_exception_id uuid;
  v_status text;
  v_qualification_id uuid;
BEGIN
  SELECT actor_id, actor_role
  INTO v_actor, v_role
  FROM private.require_phase2_actor(ARRAY['admin', 'vendedor', 'embaixador']);

  SELECT * INTO v_ambassador
  FROM public.ambassadors
  WHERE id = p_ambassador_id
    AND status = 'ativo'
    AND lifecycle_status = 'active';

  IF v_ambassador.id IS NULL THEN
    RETURN jsonb_build_object('status', 'not_qualified', 'code', 'ambassador_inactive');
  END IF;

  IF v_role = 'embaixador' AND v_ambassador.user_id <> v_actor THEN
    RAISE EXCEPTION 'ambassador_qualification_access_denied' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(monthly_activation_amount, 0)
  INTO v_minimum
  FROM public.ambassador_program_settings
  WHERE singleton;

  SELECT e.id
  INTO v_exception_id
  FROM private.ambassador_program_exceptions e
  WHERE (e.ambassador_id = p_ambassador_id OR e.person_id = v_ambassador.person_id)
    AND e.rule_code = 'monthly_purchase_qualification'
    AND e.effect_type = 'allow'
    AND e.revoked_at IS NULL
    AND e.valid_from <= v_period_end::timestamptz
    AND (e.valid_until IS NULL OR e.valid_until >= v_period_start::timestamptz)
  ORDER BY e.valid_from DESC, e.id
  LIMIT 1;

  SELECT coalesce(sum(p.valor_total), 0)
  INTO v_personal_purchase
  FROM public.pedidos p
  JOIN public.clientes c ON c.id = p.cliente_id
  WHERE c.person_id = v_ambassador.person_id
    AND p.created_at >= v_period_start::timestamptz
    AND p.created_at < (v_period_end + 1)::timestamptz
    AND p.status_pedido IN ('entregue', 'finalizado')
    AND p.payment_check_status = 'confirmado';

  v_status := CASE
    WHEN v_exception_id IS NOT NULL THEN 'exception'
    WHEN v_minimum <= 0 OR v_personal_purchase >= v_minimum THEN 'qualified'
    ELSE 'not_qualified'
  END;

  INSERT INTO private.ambassador_qualifications (
    ambassador_id,
    period_start,
    period_end,
    rule_code,
    status,
    rule_snapshot,
    exception_id,
    evaluated_at,
    evaluated_by
  )
  VALUES (
    p_ambassador_id,
    v_period_start,
    v_period_end,
    'monthly_purchase_qualification',
    v_status,
    jsonb_build_object(
      'minimum_amount', v_minimum,
      'personal_purchase_amount', v_personal_purchase,
      'currency', 'BRL'
    ),
    v_exception_id,
    now(),
    v_actor
  )
  ON CONFLICT (ambassador_id, period_start, period_end, rule_code)
  DO UPDATE SET
    status = EXCLUDED.status,
    rule_snapshot = EXCLUDED.rule_snapshot,
    exception_id = EXCLUDED.exception_id,
    evaluated_at = EXCLUDED.evaluated_at,
    evaluated_by = EXCLUDED.evaluated_by,
    updated_at = now()
  RETURNING id INTO v_qualification_id;

  RETURN jsonb_build_object(
    'status', v_status,
    'qualification_id', v_qualification_id,
    'period_start', v_period_start,
    'period_end', v_period_end
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_evaluate_ambassador_qualification(uuid, date)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_evaluate_ambassador_qualification(uuid, date)
  TO authenticated;

CREATE OR REPLACE FUNCTION private.apply_official_order_attribution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_assignment private.customer_ambassador_assignments%ROWTYPE;
  v_customer public.clientes%ROWTYPE;
  v_ambassador public.ambassadors%ROWTYPE;
  v_plan public.commission_plans%ROWTYPE;
  v_qualification private.ambassador_qualifications%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL AND coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;

  NEW.ambassador_id := NULL;
  NEW.referral_assignment_id := NULL;
  NEW.referral_code_snapshot := NULL;
  NEW.referral_visit_id := NULL;
  NEW.attributed_at := NULL;
  NEW.attribution_source := NULL;
  NEW.commission_plan_id_snapshot := NULL;
  NEW.commission_percentage_snapshot := NULL;
  NEW.commission_amount_snapshot := NULL;
  NEW.referral_validated_snapshot := false;
  NEW.referral_commissionable_snapshot := false;
  NEW.ambassador_qualified_snapshot := false;
  NEW.ambassador_qualification_id_snapshot := NULL;
  NEW.qualification_period_start_snapshot := NULL;
  NEW.qualification_period_end_snapshot := NULL;

  IF NEW.cliente_id IS NULL THEN
    NEW.first_purchase_bonus_enabled_snapshot := false;
    RETURN NEW;
  END IF;

  SELECT * INTO v_customer
  FROM public.clientes
  WHERE id = NEW.cliente_id
  FOR SHARE;

  IF v_customer.id IS NULL OR v_customer.lifecycle_status <> 'active' THEN
    RAISE EXCEPTION 'order_customer_not_found_or_inactive';
  END IF;

  SELECT * INTO v_assignment
  FROM private.customer_ambassador_assignments
  WHERE id = v_customer.current_referral_assignment_id
    AND customer_id = v_customer.id
    AND status = 'active'
    AND is_validated
  FOR SHARE;

  IF v_assignment.id IS NULL THEN
    NEW.first_purchase_bonus_enabled_snapshot := false;
    RETURN NEW;
  END IF;

  SELECT * INTO v_ambassador
  FROM public.ambassadors
  WHERE id = v_assignment.ambassador_id
    AND status = 'ativo'
    AND lifecycle_status = 'active'
  FOR SHARE;

  IF v_ambassador.id IS NULL THEN
    NEW.first_purchase_bonus_enabled_snapshot := false;
    RETURN NEW;
  END IF;

  IF v_customer.person_id IS NOT NULL
     AND v_ambassador.person_id IS NOT NULL
     AND v_customer.person_id = v_ambassador.person_id THEN
    INSERT INTO private.phase1_audit_events (
      actor_id, event_type, entity_type, entity_id, outcome_code, metadata
    )
    SELECT
      auth.uid(),
      'order_self_referral_blocked',
      'customer_ambassador_assignment',
      v_assignment.id,
      'self_referral_forbidden',
      jsonb_build_object(
        'operation_scope', 'order_creation',
        'operation_type', 'apply_official_attribution'
      )
    WHERE auth.uid() IS NOT NULL;

    NEW.first_purchase_bonus_enabled_snapshot := false;
    RETURN NEW;
  END IF;

  SELECT * INTO v_plan
  FROM public.commission_plans
  WHERE id = v_ambassador.commission_plan_id
    AND status = 'ativo'
  FOR SHARE;

  SELECT * INTO v_qualification
  FROM private.ambassador_qualifications
  WHERE ambassador_id = v_ambassador.id
    AND NEW.created_at::date BETWEEN period_start AND period_end
    AND rule_code = 'monthly_purchase_qualification'
  ORDER BY evaluated_at DESC NULLS LAST, created_at DESC
  LIMIT 1;

  NEW.ambassador_id := v_ambassador.id;
  NEW.referral_assignment_id := v_assignment.id;
  NEW.referral_code_snapshot := v_ambassador.referral_code;
  NEW.attributed_at := now();
  NEW.attribution_source := CASE v_assignment.source
    WHEN 'admin_selection' THEN 'admin_manual'::public.attribution_source_type
    WHEN 'manual_order_selection' THEN 'admin_manual'::public.attribution_source_type
    WHEN 'smart_link' THEN 'smart_link'::public.attribution_source_type
    WHEN 'manual_code' THEN 'customer_registration'::public.attribution_source_type
    ELSE 'admin_manual'::public.attribution_source_type
  END;
  NEW.referral_validated_snapshot := v_assignment.is_validated;
  NEW.ambassador_qualification_id_snapshot := v_qualification.id;
  NEW.qualification_period_start_snapshot := v_qualification.period_start;
  NEW.qualification_period_end_snapshot := v_qualification.period_end;
  NEW.ambassador_qualified_snapshot := coalesce(
    v_qualification.status IN ('qualified', 'exception'),
    false
  );
  NEW.referral_commissionable_snapshot :=
    v_assignment.is_commissionable
    AND NEW.ambassador_qualified_snapshot
    AND v_plan.id IS NOT NULL;

  IF v_plan.id IS NOT NULL THEN
    NEW.commission_plan_id_snapshot := v_plan.id;
    NEW.commission_percentage_snapshot := coalesce(v_plan.direct_percentage, 0);
  END IF;

  IF NEW.referral_commissionable_snapshot THEN
    NEW.commission_amount_snapshot := round(
      coalesce(NEW.commissionable_amount_snapshot, NEW.valor_total, 0)
      * coalesce(NEW.commission_percentage_snapshot, 0) / 100,
      2
    );
  ELSE
    NEW.commission_amount_snapshot := 0;
    NEW.first_purchase_bonus_enabled_snapshot := false;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.apply_official_order_attribution()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_zz_apply_official_order_attribution ON public.pedidos;
CREATE TRIGGER trg_zz_apply_official_order_attribution
BEFORE INSERT ON public.pedidos
FOR EACH ROW
EXECUTE FUNCTION private.apply_official_order_attribution();

CREATE OR REPLACE FUNCTION public.fn_trg_generate_order_commissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  IF auth.uid() IS NULL AND coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;

  IF NOT NEW.referral_validated_snapshot
     OR NOT NEW.referral_commissionable_snapshot
     OR NOT NEW.ambassador_qualified_snapshot
     OR NEW.referral_assignment_id IS NULL
     OR NEW.commission_plan_id_snapshot IS NULL
     OR NEW.commissionable_amount_snapshot IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.fn_gerar_comissoes_multinivel(NEW.id);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_trg_generate_order_commissions()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fn_trg_valida_comissao_pedido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_order public.pedidos%ROWTYPE;
  v_expected uuid;
  v_expected_pct numeric(5,2);
  v_qualified boolean;
BEGIN
  IF auth.uid() IS NULL AND coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE' THEN RETURN NEW; END IF;

  SELECT * INTO v_order
  FROM public.pedidos
  WHERE id = NEW.order_id;

  IF v_order.id IS NULL
     OR v_order.ambassador_id IS NULL
     OR v_order.referral_assignment_id IS NULL
     OR NOT v_order.referral_validated_snapshot
     OR NOT v_order.referral_commissionable_snapshot THEN
    RAISE EXCEPTION 'commission_without_official_commissionable_assignment';
  END IF;

  IF NEW.commission_level NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'invalid_commission_level';
  END IF;

  WITH RECURSIVE chain AS (
    SELECT a.id, a.parent_ambassador_id, 1 AS level_number, ARRAY[a.id]::uuid[] AS path
    FROM public.ambassadors a
    WHERE a.id = v_order.ambassador_id
    UNION ALL
    SELECT parent.id, parent.parent_ambassador_id,
           chain.level_number + 1, chain.path || parent.id
    FROM chain
    JOIN public.ambassadors parent ON parent.id = chain.parent_ambassador_id
    WHERE chain.level_number < NEW.commission_level
      AND NOT parent.id = ANY(chain.path)
  )
  SELECT id INTO v_expected
  FROM chain
  WHERE level_number = NEW.commission_level;

  IF v_expected IS NULL OR NEW.ambassador_id IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION 'commission_beneficiary_network_mismatch';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM private.ambassador_qualifications q
    WHERE q.ambassador_id = NEW.ambassador_id
      AND v_order.created_at::date BETWEEN q.period_start AND q.period_end
      AND q.rule_code = 'monthly_purchase_qualification'
      AND q.status IN ('qualified', 'exception')
  ) INTO v_qualified;

  IF NOT v_qualified THEN
    RAISE EXCEPTION 'ambassador_not_qualified_for_commission_period';
  END IF;

  IF NEW.commission_plan_id IS DISTINCT FROM v_order.commission_plan_id_snapshot
     OR NEW.commissionable_amount IS DISTINCT FROM v_order.commissionable_amount_snapshot THEN
    RAISE EXCEPTION 'commission_snapshot_mismatch';
  END IF;

  IF NEW.commission_type = 'first_purchase_bonus' THEN
    IF NEW.commission_level <> 1
       OR NEW.percentage_snapshot <> 0
       OR NEW.fixed_bonus_amount_snapshot IS NULL
       OR NEW.qualification_minimum_snapshot IS NULL
       OR NEW.order_amount_snapshot < NEW.qualification_minimum_snapshot
       OR NEW.commission_amount IS DISTINCT FROM NEW.fixed_bonus_amount_snapshot THEN
      RAISE EXCEPTION 'invalid_first_purchase_bonus';
    END IF;
  ELSE
    SELECT percentage INTO v_expected_pct
    FROM public.commission_plan_levels
    WHERE commission_plan_id = NEW.commission_plan_id
      AND level_number = NEW.commission_level
      AND enabled;

    IF v_expected_pct IS NULL
       OR NEW.percentage_snapshot IS DISTINCT FROM v_expected_pct
       OR NEW.commission_amount IS DISTINCT FROM round(
         NEW.commissionable_amount * v_expected_pct / 100,
         2
       ) THEN
      RAISE EXCEPTION 'invalid_commission_calculation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_trg_valida_comissao_pedido()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fn_create_manual_order_canonical(
  p_order jsonb,
  p_items jsonb,
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
  v_customer public.clientes%ROWTYPE;
  v_order_id uuid;
  v_order public.pedidos%ROWTYPE;
  v_item jsonb;
  v_product public.produtos%ROWTYPE;
  v_items_total numeric := 0;
  v_order_total numeric := round(coalesce((p_order->>'valor_total')::numeric, 0), 2);
  v_payload_hash bytea;
  v_idempotency private.operation_idempotency%ROWTYPE;
  v_qualification jsonb;
  v_chain record;
BEGIN
  SELECT actor_id, actor_role
  INTO v_actor, v_role
  FROM private.require_phase2_actor(ARRAY['admin', 'vendedor']);

  IF p_idempotency_key IS NULL
     OR jsonb_typeof(p_order) <> 'object'
     OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0
     OR p_order->>'cliente_id' IS NULL THEN
    RAISE EXCEPTION 'invalid_order_payload' USING ERRCODE = '22023';
  END IF;

  v_payload_hash := extensions.digest(
    convert_to((p_order || jsonb_build_object('items', p_items))::text, 'UTF8'),
    'sha256'
  );

  INSERT INTO private.operation_idempotency (
    operation_scope, idempotency_key, customer_id, operation_type,
    payload_hash, actor_id, lease_expires_at
  )
  VALUES (
    'manual_order_create',
    p_idempotency_key,
    (p_order->>'cliente_id')::uuid,
    'create_order',
    v_payload_hash,
    v_actor,
    now() + interval '5 minutes'
  )
  ON CONFLICT (operation_scope, idempotency_key) DO NOTHING;

  SELECT * INTO v_idempotency
  FROM private.operation_idempotency
  WHERE operation_scope = 'manual_order_create'
    AND idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF v_idempotency.payload_hash IS DISTINCT FROM v_payload_hash
     OR v_idempotency.customer_id IS DISTINCT FROM (p_order->>'cliente_id')::uuid THEN
    INSERT INTO private.phase1_audit_events (
      actor_id, event_type, entity_type, entity_id, outcome_code, metadata
    )
    VALUES (
      v_actor, 'idempotency_conflict', 'operation_idempotency',
      v_idempotency.id, 'idempotency_conflict',
      jsonb_build_object(
        'operation_scope', 'manual_order_create',
        'operation_type', 'create_order',
        'idempotency_key', p_idempotency_key
      )
    );
    RETURN jsonb_build_object('status', 'idempotency_conflict');
  END IF;

  IF v_idempotency.status = 'completed' THEN
    RETURN v_idempotency.original_result || jsonb_build_object('replayed', true);
  END IF;

  SELECT * INTO v_customer
  FROM public.clientes
  WHERE id = (p_order->>'cliente_id')::uuid
  FOR SHARE;

  IF v_customer.id IS NULL OR v_customer.lifecycle_status <> 'active' THEN
    RAISE EXCEPTION 'order_customer_not_found_or_inactive';
  END IF;

  IF v_role = 'vendedor'
     AND v_customer.vendedor_responsavel_id <> v_actor THEN
    RAISE EXCEPTION 'seller_customer_access_denied' USING ERRCODE = '42501';
  END IF;

  FOR v_chain IN
    WITH RECURSIVE chain AS (
      SELECT a.id, a.parent_ambassador_id, ARRAY[a.id]::uuid[] path, 1 level_number
      FROM private.customer_ambassador_assignments ca
      JOIN public.ambassadors a ON a.id = ca.ambassador_id
      WHERE ca.id = v_customer.current_referral_assignment_id
        AND ca.status = 'active'
        AND ca.is_validated
      UNION ALL
      SELECT parent.id, parent.parent_ambassador_id,
             chain.path || parent.id, chain.level_number + 1
      FROM chain
      JOIN public.ambassadors parent ON parent.id = chain.parent_ambassador_id
      WHERE chain.level_number < 10
        AND NOT parent.id = ANY(chain.path)
    )
    SELECT id FROM chain ORDER BY level_number
  LOOP
    v_qualification := public.fn_evaluate_ambassador_qualification(
      v_chain.id,
      current_date
    );
  END LOOP;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_product
    FROM public.produtos
    WHERE id = (v_item->>'produto_id')::uuid
      AND ativo
    FOR SHARE;

    IF v_product.id IS NULL
       OR (v_item->>'quantidade')::integer <= 0
       OR (v_item->>'preco_unitario')::numeric < 0
       OR (v_item->>'subtotal')::numeric < 0 THEN
      RAISE EXCEPTION 'invalid_order_item';
    END IF;

    v_items_total := v_items_total + round((v_item->>'subtotal')::numeric, 2);
  END LOOP;

  IF v_order_total < 0 OR v_order_total > v_items_total + 0.01 THEN
    RAISE EXCEPTION 'invalid_order_total';
  END IF;

  PERFORM set_config('bryza.allow_seller_referral_snapshots', 'true', true);

  INSERT INTO public.pedidos (
    cliente_id,
    vendedor_id,
    valor_total,
    desconto_tipo,
    desconto_valor,
    desconto_aplicado,
    forma_pagamento,
    status_pedido,
    observacoes,
    nome_cliente,
    telefone_cliente,
    endereco_entrega,
    bairro,
    cidade,
    estado,
    cep,
    complemento,
    nome_vendedor,
    codigo_vendedor,
    commissionable_amount_snapshot
  )
  VALUES (
    v_customer.id,
    CASE WHEN v_role = 'vendedor' THEN v_actor
      ELSE (p_order->>'vendedor_id')::uuid END,
    v_order_total,
    coalesce(p_order->>'desconto_tipo', 'none'),
    coalesce((p_order->>'desconto_valor')::numeric, 0),
    coalesce((p_order->>'desconto_aplicado')::numeric, 0),
    coalesce(p_order->>'forma_pagamento', 'dinheiro'),
    'aguardando_preparacao',
    nullif(p_order->>'observacoes', ''),
    v_customer.nome,
    v_customer.telefone,
    v_customer.endereco,
    v_customer.bairro,
    v_customer.cidade,
    v_customer.estado,
    v_customer.cep,
    v_customer.numero,
    coalesce(p_order->>'nome_vendedor', ''),
    coalesce((p_order->>'codigo_vendedor')::integer, 0),
    v_order_total
  )
  RETURNING * INTO v_order;

  v_order_id := v_order.id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.pedido_itens (
      pedido_id, produto_id, quantidade, preco_unitario,
      desconto_tipo, desconto_valor, desconto_aplicado, subtotal
    )
    VALUES (
      v_order_id,
      (v_item->>'produto_id')::uuid,
      (v_item->>'quantidade')::integer,
      (v_item->>'preco_unitario')::numeric,
      coalesce(v_item->>'desconto_tipo', 'none'),
      coalesce((v_item->>'desconto_valor')::numeric, 0),
      coalesce((v_item->>'desconto_aplicado')::numeric, 0),
      (v_item->>'subtotal')::numeric
    );
  END LOOP;

  UPDATE private.operation_idempotency
  SET status = 'completed',
      original_result = jsonb_build_object(
        'status', 'created',
        'entity_id', v_order_id
      ),
      processed_at = now(),
      lease_expires_at = NULL,
      updated_at = now()
  WHERE id = v_idempotency.id;

  INSERT INTO private.phase1_audit_events (
    actor_id, event_type, entity_type, entity_id, outcome_code, metadata
  )
  VALUES (
    v_actor, 'canonical_order_created', 'order', v_order_id, 'created',
    jsonb_build_object(
      'operation_scope', 'manual_order_create',
      'operation_type', 'create_order',
      'idempotency_key', p_idempotency_key
    )
  );

  RETURN jsonb_build_object(
    'status', 'created',
    'entity_id', v_order_id,
    'order_number', v_order.numero_pedido,
    'ambassador_id', v_order.ambassador_id,
    'referral_code', v_order.referral_code_snapshot,
    'referral_source', v_order.attribution_source,
    'commissionable', v_order.referral_commissionable_snapshot,
    'qualified', v_order.ambassador_qualified_snapshot
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_create_manual_order_canonical(jsonb, jsonb, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_create_manual_order_canonical(jsonb, jsonb, uuid)
  TO authenticated;

COMMENT ON COLUMN public.pedidos.referral_assignment_id IS
  'Immutable pointer to the official assignment row used when this order was created.';
COMMENT ON COLUMN public.pedidos.referral_commissionable_snapshot IS
  'Frozen eligibility from validated assignment plus period qualification.';
