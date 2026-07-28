-- Mercado Pago Checkout Pro, payment lifecycle, and ambassador own-orders portal.
-- "forma_pagamento" remains the payment method. "payment_timing" records when
-- the customer chose to pay.

ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS payment_timing text NOT NULL DEFAULT 'na_entrega',
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS payment_source text NOT NULL DEFAULT 'entrega',
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS payment_timing text NOT NULL DEFAULT 'na_entrega',
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS payment_source text NOT NULL DEFAULT 'entrega',
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

ALTER TABLE public.agendamentos
  DROP CONSTRAINT IF EXISTS agendamentos_payment_timing_check,
  DROP CONSTRAINT IF EXISTS agendamentos_payment_status_check,
  DROP CONSTRAINT IF EXISTS agendamentos_payment_source_check;

ALTER TABLE public.agendamentos
  ADD CONSTRAINT agendamentos_payment_timing_check
    CHECK (payment_timing IN ('agora', 'na_entrega')),
  ADD CONSTRAINT agendamentos_payment_status_check
    CHECK (payment_status IN (
      'pendente', 'processando', 'aprovado', 'recusado', 'cancelado',
      'expirado', 'reembolsado', 'chargeback', 'em_analise'
    )),
  ADD CONSTRAINT agendamentos_payment_source_check
    CHECK (payment_source IN ('mercado_pago', 'entrega', 'manual'));

ALTER TABLE public.pedidos
  DROP CONSTRAINT IF EXISTS pedidos_payment_timing_check,
  DROP CONSTRAINT IF EXISTS pedidos_payment_status_check,
  DROP CONSTRAINT IF EXISTS pedidos_payment_source_check;

ALTER TABLE public.pedidos
  ADD CONSTRAINT pedidos_payment_timing_check
    CHECK (payment_timing IN ('agora', 'na_entrega')),
  ADD CONSTRAINT pedidos_payment_status_check
    CHECK (payment_status IN (
      'pendente', 'processando', 'aprovado', 'recusado', 'cancelado',
      'expirado', 'reembolsado', 'chargeback', 'em_analise'
    )),
  ADD CONSTRAINT pedidos_payment_source_check
    CHECK (payment_source IN ('mercado_pago', 'entrega', 'manual'));

CREATE TABLE IF NOT EXISTS public.payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  external_reference uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  agendamento_id uuid REFERENCES public.agendamentos(id) ON DELETE RESTRICT,
  pedido_id uuid REFERENCES public.pedidos(id) ON DELETE RESTRICT,
  provider text NOT NULL DEFAULT 'mercado_pago'
    CHECK (provider = 'mercado_pago'),
  payment_timing text NOT NULL DEFAULT 'agora'
    CHECK (payment_timing IN ('agora', 'na_entrega')),
  expected_amount numeric(12,2) NOT NULL CHECK (expected_amount > 0),
  currency char(3) NOT NULL DEFAULT 'BRL' CHECK (currency = 'BRL'),
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN (
      'pendente', 'processando', 'aprovado', 'recusado', 'cancelado',
      'expirado', 'reembolsado', 'chargeback', 'em_analise'
    )),
  provider_preference_id text UNIQUE,
  checkout_url text,
  sandbox_checkout_url text,
  expires_at timestamptz,
  approved_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_intents_subject_check
    CHECK (agendamento_id IS NOT NULL OR pedido_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS payment_intents_agendamento_idx
  ON public.payment_intents (agendamento_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_intents_pedido_idx
  ON public.payment_intents (pedido_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_intents_open_idx
  ON public.payment_intents (status, created_at)
  WHERE status IN ('pendente', 'processando', 'em_analise');
CREATE UNIQUE INDEX IF NOT EXISTS payment_intents_online_schedule_uidx
  ON public.payment_intents (agendamento_id)
  WHERE agendamento_id IS NOT NULL AND payment_timing = 'agora';

CREATE TABLE IF NOT EXISTS public.payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_intent_id uuid NOT NULL
    REFERENCES public.payment_intents(id) ON DELETE RESTRICT,
  provider_payment_id text NOT NULL UNIQUE,
  provider_merchant_order_id text,
  status text NOT NULL,
  status_detail text,
  transaction_amount numeric(12,2) NOT NULL CHECK (transaction_amount >= 0),
  net_received_amount numeric(12,2),
  currency char(3) NOT NULL DEFAULT 'BRL',
  payment_method_id text,
  payment_type_id text,
  installments integer,
  approved_at timestamptz,
  refunded_at timestamptz,
  provider_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_attempts_intent_idx
  ON public.payment_attempts (payment_intent_id, created_at DESC);

CREATE TABLE IF NOT EXISTS private.payment_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'mercado_pago',
  provider_event_id text,
  topic text NOT NULL,
  resource_id text NOT NULL,
  request_id text,
  payload_hash bytea NOT NULL,
  status text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'processed', 'ignored', 'failed')),
  attempt_count integer NOT NULL DEFAULT 1 CHECK (attempt_count > 0),
  last_error text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_webhook_event_id_uidx
  ON private.payment_webhook_events (provider, provider_event_id, topic)
  WHERE provider_event_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payment_webhook_hash_uidx
  ON private.payment_webhook_events (provider, payload_hash)
  WHERE provider_event_id IS NULL;

CREATE TABLE IF NOT EXISTS public.commission_reversals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id uuid NOT NULL REFERENCES public.commissions(id) ON DELETE RESTRICT,
  ambassador_id uuid NOT NULL REFERENCES public.ambassadors(id) ON DELETE RESTRICT,
  payment_attempt_id uuid NOT NULL
    REFERENCES public.payment_attempts(id) ON DELETE RESTRICT,
  reason text NOT NULL CHECK (reason IN ('reembolso', 'chargeback')),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'compensada')),
  created_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz,
  UNIQUE (commission_id, payment_attempt_id, reason)
);

CREATE INDEX IF NOT EXISTS commission_reversals_ambassador_idx
  ON public.commission_reversals (ambassador_id, status, created_at DESC);

ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_reversals ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.payment_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin le intencoes de pagamento" ON public.payment_intents;
CREATE POLICY "Admin le intencoes de pagamento"
  ON public.payment_intents FOR SELECT TO authenticated
  USING (public.get_user_role() = 'admin'::public.app_role);

DROP POLICY IF EXISTS "Admin le tentativas de pagamento" ON public.payment_attempts;
CREATE POLICY "Admin le tentativas de pagamento"
  ON public.payment_attempts FOR SELECT TO authenticated
  USING (public.get_user_role() = 'admin'::public.app_role);

DROP POLICY IF EXISTS "Admin le estornos de comissao" ON public.commission_reversals;
CREATE POLICY "Admin le estornos de comissao"
  ON public.commission_reversals FOR SELECT TO authenticated
  USING (public.get_user_role() = 'admin'::public.app_role);

GRANT SELECT ON public.payment_intents TO authenticated;
GRANT SELECT ON public.payment_attempts TO authenticated;
GRANT SELECT ON public.commission_reversals TO authenticated;
GRANT ALL ON public.payment_intents TO service_role;
GRANT ALL ON public.payment_attempts TO service_role;
GRANT ALL ON public.commission_reversals TO service_role;
REVOKE ALL ON private.payment_webhook_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON private.payment_webhook_events TO service_role;

CREATE OR REPLACE FUNCTION public.fn_payment_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO pg_catalog
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payment_intents_updated_at ON public.payment_intents;
CREATE TRIGGER trg_payment_intents_updated_at
BEFORE UPDATE ON public.payment_intents
FOR EACH ROW EXECUTE FUNCTION public.fn_payment_touch_updated_at();

DROP TRIGGER IF EXISTS trg_payment_attempts_updated_at ON public.payment_attempts;
CREATE TRIGGER trg_payment_attempts_updated_at
BEFORE UPDATE ON public.payment_attempts
FOR EACH ROW EXECUTE FUNCTION public.fn_payment_touch_updated_at();

REVOKE ALL ON FUNCTION public.fn_payment_touch_updated_at() FROM PUBLIC, anon, authenticated;

-- Delivery/manual confirmation remains compatible with the existing logistics
-- flow while also updating the canonical payment status.
CREATE OR REPLACE FUNCTION public.fn_project_legacy_payment_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog
AS $$
BEGIN
  IF NEW.payment_check_status = 'confirmado'
     AND OLD.payment_check_status IS DISTINCT FROM 'confirmado'
     AND NEW.payment_status IS DISTINCT FROM 'aprovado' THEN
    UPDATE public.pedidos
    SET payment_status = 'aprovado',
        payment_source = CASE
          WHEN payment_source = 'mercado_pago' THEN payment_source
          ELSE 'entrega'
        END,
        paid_at = coalesce(paid_at, now())
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_legacy_payment_status ON public.pedidos;
CREATE TRIGGER trg_project_legacy_payment_status
AFTER UPDATE OF payment_check_status ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.fn_project_legacy_payment_status();

REVOKE ALL ON FUNCTION public.fn_project_legacy_payment_status()
  FROM PUBLIC, anon, authenticated;

-- Commissions become available as soon as payment is approved, regardless of
-- delivery status. Delivery still has its own independent operational state.
CREATE OR REPLACE FUNCTION public.fn_gerar_comissoes_multinivel(p_pedido_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_order public.pedidos%ROWTYPE;
  v_direct public.ambassadors%ROWTYPE;
  v_customer public.clientes%ROWTYPE;
  v_node record;
  v_amount numeric(12,2);
  v_status text;
  v_count integer := 0;
  v_rows integer := 0;
BEGIN
  SELECT * INTO v_order FROM public.pedidos WHERE id = p_pedido_id FOR UPDATE;
  IF v_order.id IS NULL OR v_order.ambassador_id IS NULL
     OR v_order.commission_plan_id_snapshot IS NULL THEN
    RETURN jsonb_build_object('sucesso', true, 'criadas', 0);
  END IF;
  SELECT * INTO v_direct FROM public.ambassadors WHERE id = v_order.ambassador_id;
  SELECT * INTO v_customer FROM public.clientes WHERE id = v_order.cliente_id;
  IF v_direct.id IS NULL THEN
    RETURN jsonb_build_object('sucesso', true, 'criadas', 0);
  END IF;
  IF v_customer.own_ambassador_id = v_direct.id
     OR (v_customer.cpf IS NOT NULL AND v_customer.cpf = v_direct.cpf)
     OR (
       regexp_replace(coalesce(v_customer.telefone, ''), '[^0-9]', '', 'g') <> ''
       AND regexp_replace(coalesce(v_customer.telefone, ''), '[^0-9]', '', 'g')
         = regexp_replace(coalesce(v_direct.phone, ''), '[^0-9]', '', 'g')
     ) THEN
    RETURN jsonb_build_object(
      'sucesso', true, 'criadas', 0, 'motivo', 'autoindicacao_bloqueada'
    );
  END IF;

  v_status := CASE
    WHEN v_order.status_pedido = 'cancelado' THEN 'cancelada'
    WHEN v_order.payment_status = 'aprovado'
      OR v_order.payment_check_status = 'confirmado' THEN 'liberada'
    WHEN v_order.status_pedido IN ('entregue', 'finalizado')
      THEN 'aguardando_pagamento'
    ELSE 'aguardando_entrega'
  END;

  FOR v_node IN
    WITH RECURSIVE chain AS (
      SELECT a.id, a.parent_ambassador_id, a.status, 1::integer level_number,
        ARRAY[a.id]::uuid[] path
      FROM public.ambassadors a WHERE a.id = v_order.ambassador_id
      UNION ALL
      SELECT parent.id, parent.parent_ambassador_id, parent.status,
        chain.level_number + 1, chain.path || parent.id
      FROM chain
      JOIN public.ambassadors parent ON parent.id = chain.parent_ambassador_id
      WHERE chain.level_number < 10 AND NOT parent.id = ANY(chain.path)
    )
    SELECT chain.id ambassador_id, chain.status, levels.level_number,
      levels.percentage
    FROM chain
    JOIN public.commission_plan_levels levels
      ON levels.commission_plan_id = v_order.commission_plan_id_snapshot
     AND levels.level_number = chain.level_number
     AND levels.enabled
    ORDER BY levels.level_number
  LOOP
    IF v_node.percentage > 0 AND v_node.status = 'ativo' THEN
      v_amount := round(
        v_order.commissionable_amount_snapshot * v_node.percentage / 100.0, 2
      );
      INSERT INTO public.commissions (
        ambassador_id, order_id, customer_id, commission_plan_id,
        commission_level, commissionable_amount, order_amount_snapshot,
        percentage_snapshot, commission_amount, commission_type, status,
        available_at, cancelled_at
      ) VALUES (
        v_node.ambassador_id, v_order.id, v_order.cliente_id,
        v_order.commission_plan_id_snapshot, v_node.level_number,
        v_order.commissionable_amount_snapshot, v_order.valor_total,
        v_node.percentage, v_amount, 'network_percentage', v_status,
        CASE WHEN v_status = 'liberada' THEN now() END,
        CASE WHEN v_status = 'cancelada' THEN now() END
      )
      ON CONFLICT (order_id, ambassador_id, commission_level, commission_type)
      DO NOTHING;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      v_count := v_count + v_rows;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('sucesso', true, 'criadas', v_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_trg_sync_commission_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF NEW.status_pedido = 'cancelado' THEN
    UPDATE public.commissions
    SET status = 'cancelada', cancelled_at = coalesce(cancelled_at, now())
    WHERE order_id = NEW.id
      AND status IN ('aguardando_entrega', 'aguardando_pagamento', 'liberada');
  ELSIF NEW.payment_status IN ('reembolsado', 'chargeback') THEN
    UPDATE public.commissions
    SET status = 'estornada', reversed_at = coalesce(reversed_at, now())
    WHERE order_id = NEW.id AND status <> 'estornada';
  ELSIF NEW.payment_status = 'aprovado'
     OR NEW.payment_check_status = 'confirmado' THEN
    UPDATE public.commissions
    SET status = 'liberada', available_at = coalesce(available_at, now())
    WHERE order_id = NEW.id
      AND status IN ('aguardando_entrega', 'aguardando_pagamento');
  ELSIF NEW.status_pedido IN ('entregue', 'finalizado') THEN
    UPDATE public.commissions SET status = 'aguardando_pagamento'
    WHERE order_id = NEW.id AND status = 'aguardando_entrega';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_commission_status ON public.pedidos;
CREATE TRIGGER trg_sync_commission_status
AFTER UPDATE OF status_pedido, payment_check_status, payment_status
ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.fn_trg_sync_commission_status();

-- Trigger the existing first-purchase bonus function for provider payments too.
DROP TRIGGER IF EXISTS trg_generate_first_purchase_referral_bonus ON public.pedidos;
CREATE TRIGGER trg_generate_first_purchase_referral_bonus
AFTER INSERT OR UPDATE OF status_pedido, payment_check_status, payment_status
ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.fn_generate_first_purchase_referral_bonus();

-- The existing function originally required delivery. This wrapper-compatible
-- replacement lets a provider-approved payment enter the same idempotent logic
-- by presenting the already-approved financial projection to the legacy body.
CREATE OR REPLACE FUNCTION public.fn_generate_first_purchase_referral_bonus_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF NEW.payment_status = 'aprovado'
     AND (TG_OP = 'INSERT' OR OLD.payment_status IS DISTINCT FROM 'aprovado') THEN
    -- The main function is a trigger function and cannot be called directly.
    -- Its normal trigger will handle delivery-confirmed purchases; online
    -- purchases use commission generation plus the same unique constraints.
    PERFORM public.fn_gerar_comissoes_multinivel(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_online_payment_commissions ON public.pedidos;
CREATE TRIGGER trg_generate_online_payment_commissions
AFTER INSERT OR UPDATE OF payment_status ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.fn_generate_first_purchase_referral_bonus_payment();

-- Attach a Mercado Pago preference after the remote API successfully creates it.
CREATE OR REPLACE FUNCTION public.fn_attach_mercado_pago_preference(
  p_checkout_token uuid,
  p_preference_id text,
  p_checkout_url text,
  p_sandbox_checkout_url text,
  p_expires_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog
AS $$
DECLARE
  v_intent public.payment_intents%ROWTYPE;
BEGIN
  SELECT * INTO v_intent
  FROM public.payment_intents
  WHERE checkout_token = p_checkout_token
  FOR UPDATE;

  IF v_intent.id IS NULL THEN
    RAISE EXCEPTION 'payment_intent_not_found';
  END IF;
  IF v_intent.status NOT IN ('pendente', 'processando') THEN
    RAISE EXCEPTION 'payment_intent_not_payable';
  END IF;
  IF v_intent.provider_preference_id IS NOT NULL
     AND v_intent.provider_preference_id IS DISTINCT FROM p_preference_id THEN
    RAISE EXCEPTION 'payment_preference_conflict';
  END IF;

  UPDATE public.payment_intents
  SET provider_preference_id = p_preference_id,
      checkout_url = p_checkout_url,
      sandbox_checkout_url = p_sandbox_checkout_url,
      expires_at = p_expires_at,
      status = 'processando'
  WHERE id = v_intent.id;

  RETURN jsonb_build_object(
    'intent_id', v_intent.id,
    'external_reference', v_intent.external_reference,
    'status', 'processando'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_attach_mercado_pago_preference(
  uuid, text, text, text, timestamptz
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_attach_mercado_pago_preference(
  uuid, text, text, text, timestamptz
) TO service_role;

-- Reconcile a payment fetched directly from Mercado Pago. The Route Handler
-- validates the webhook signature and then fetches this authoritative payload.
CREATE OR REPLACE FUNCTION public.fn_reconcile_mercado_pago_payment(
  p_event_id text,
  p_request_id text,
  p_payment jsonb,
  p_payload_hash bytea
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog
AS $$
DECLARE
  v_external_reference uuid;
  v_payment_id text := nullif(p_payment->>'id', '');
  v_provider_status text := lower(coalesce(p_payment->>'status', ''));
  v_status text;
  v_amount numeric(12,2);
  v_currency text := upper(coalesce(p_payment->>'currency_id', ''));
  v_intent public.payment_intents%ROWTYPE;
  v_attempt public.payment_attempts%ROWTYPE;
  v_ag public.agendamentos%ROWTYPE;
  v_order_id uuid;
  v_order_number text;
  v_reason text;
BEGIN
  IF v_payment_id IS NULL OR p_payload_hash IS NULL THEN
    RAISE EXCEPTION 'invalid_payment_payload';
  END IF;
  BEGIN
    v_external_reference := (p_payment->>'external_reference')::uuid;
    v_amount := round((p_payment->>'transaction_amount')::numeric, 2);
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'invalid_payment_reference_or_amount';
  END;

  SELECT * INTO v_intent
  FROM public.payment_intents
  WHERE external_reference = v_external_reference
  FOR UPDATE;

  IF v_intent.id IS NULL THEN RAISE EXCEPTION 'payment_intent_not_found'; END IF;
  IF v_currency <> v_intent.currency OR abs(v_amount - v_intent.expected_amount) > 0.01 THEN
    RAISE EXCEPTION 'payment_amount_or_currency_mismatch';
  END IF;

  v_status := CASE v_provider_status
    WHEN 'approved' THEN 'aprovado'
    WHEN 'rejected' THEN 'recusado'
    WHEN 'cancelled' THEN 'cancelado'
    WHEN 'refunded' THEN 'reembolsado'
    WHEN 'charged_back' THEN 'chargeback'
    WHEN 'in_mediation' THEN 'em_analise'
    WHEN 'in_process' THEN 'processando'
    WHEN 'pending' THEN 'processando'
    ELSE 'pendente'
  END;

  INSERT INTO private.payment_webhook_events (
    provider_event_id, topic, resource_id, request_id, payload_hash, status
  ) VALUES (
    nullif(p_event_id, ''), 'payment', v_payment_id,
    nullif(p_request_id, ''), p_payload_hash, 'processing'
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO public.payment_attempts (
    payment_intent_id, provider_payment_id, provider_merchant_order_id,
    status, status_detail, transaction_amount, net_received_amount, currency,
    payment_method_id, payment_type_id, installments, approved_at,
    refunded_at, provider_updated_at
  ) VALUES (
    v_intent.id, v_payment_id, nullif(p_payment->>'merchant_order_id', ''),
    v_status, nullif(p_payment->>'status_detail', ''), v_amount,
    nullif(p_payment#>>'{transaction_details,net_received_amount}', '')::numeric,
    v_currency, nullif(p_payment->>'payment_method_id', ''),
    nullif(p_payment->>'payment_type_id', ''),
    nullif(p_payment->>'installments', '')::integer,
    nullif(p_payment->>'date_approved', '')::timestamptz,
    CASE WHEN v_status IN ('reembolsado', 'chargeback') THEN now() END,
    nullif(p_payment->>'date_last_updated', '')::timestamptz
  )
  ON CONFLICT (provider_payment_id) DO UPDATE
  SET status = CASE
        WHEN public.payment_attempts.status IN ('reembolsado', 'chargeback')
          THEN public.payment_attempts.status
        WHEN EXCLUDED.status IN ('reembolsado', 'chargeback', 'aprovado')
          THEN EXCLUDED.status
        ELSE public.payment_attempts.status
      END,
      status_detail = EXCLUDED.status_detail,
      net_received_amount = EXCLUDED.net_received_amount,
      approved_at = coalesce(public.payment_attempts.approved_at, EXCLUDED.approved_at),
      refunded_at = coalesce(public.payment_attempts.refunded_at, EXCLUDED.refunded_at),
      provider_updated_at = greatest(
        public.payment_attempts.provider_updated_at, EXCLUDED.provider_updated_at
      ),
      updated_at = now()
  RETURNING * INTO v_attempt;

  -- Never downgrade a terminal or approved payment with a late pending event.
  IF v_intent.status IN ('reembolsado', 'chargeback') THEN
    v_status := v_intent.status;
  ELSIF v_intent.status = 'aprovado'
        AND v_status NOT IN ('reembolsado', 'chargeback') THEN
    v_status := 'aprovado';
  END IF;

  UPDATE public.payment_intents
  SET status = v_status,
      approved_at = CASE
        WHEN v_status = 'aprovado' THEN coalesce(
          approved_at, v_attempt.approved_at, now()
        )
        ELSE approved_at
      END,
      refunded_at = CASE
        WHEN v_status IN ('reembolsado', 'chargeback')
          THEN coalesce(refunded_at, now())
        ELSE refunded_at
      END
  WHERE id = v_intent.id;

  IF v_status = 'aprovado' THEN
    IF v_intent.agendamento_id IS NOT NULL THEN
      SELECT * INTO v_ag FROM public.agendamentos
      WHERE id = v_intent.agendamento_id FOR UPDATE;
      IF v_ag.id IS NULL THEN RAISE EXCEPTION 'scheduling_not_found'; END IF;

      UPDATE public.agendamentos
      SET payment_timing = 'agora', payment_status = 'aprovado',
          payment_source = 'mercado_pago',
          paid_at = coalesce(paid_at, v_attempt.approved_at, now()),
          updated_at = now()
      WHERE id = v_ag.id;

      IF v_ag.pedido_id IS NOT NULL THEN
        v_order_id := v_ag.pedido_id;
      ELSE
        PERFORM set_config('bryza.allow_seller_referral_snapshots', 'true', true);
        INSERT INTO public.pedidos (
          cliente_id, vendedor_id, valor_total, desconto_tipo, desconto_valor,
          desconto_aplicado, forma_pagamento, observacoes, nome_cliente,
          telefone_cliente, endereco_entrega, bairro, cidade, estado, cep,
          nome_vendedor, codigo_vendedor, status_pedido, ambassador_id,
          referral_visit_id, referral_code_snapshot, attributed_at,
          attribution_source, commission_plan_id_snapshot,
          commission_percentage_snapshot, commissionable_amount_snapshot,
          commission_amount_snapshot, referral_assignment_id,
          referral_validated_snapshot, referral_commissionable_snapshot,
          ambassador_qualified_snapshot, ambassador_qualification_id_snapshot,
          payment_timing, payment_status, payment_source, paid_at, amount_received
        ) VALUES (
          v_ag.cliente_id, v_ag.vendedor_id, v_ag.valor_total,
          v_ag.desconto_tipo, v_ag.desconto_valor, v_ag.desconto_aplicado,
          'mercado_pago', v_ag.observacoes, v_ag.nome_cliente,
          v_ag.telefone_cliente, v_ag.endereco_entrega, v_ag.bairro,
          v_ag.cidade, v_ag.estado, v_ag.cep, v_ag.nome_vendedor,
          v_ag.codigo_vendedor, 'aguardando_preparacao', v_ag.ambassador_id,
          v_ag.referral_visit_id, v_ag.referral_code_snapshot, v_ag.attributed_at,
          v_ag.attribution_source, v_ag.commission_plan_id_snapshot,
          v_ag.commission_percentage_snapshot, v_ag.commissionable_amount_snapshot,
          v_ag.commission_amount_snapshot, v_ag.referral_assignment_id,
          v_ag.referral_validated_snapshot, v_ag.referral_commissionable_snapshot,
          v_ag.ambassador_qualified_snapshot,
          v_ag.ambassador_qualification_id_snapshot, 'agora', 'aprovado',
          'mercado_pago', coalesce(v_attempt.approved_at, now()), v_amount
        )
        RETURNING id, numero_pedido INTO v_order_id, v_order_number;

        INSERT INTO public.pedido_itens (
          pedido_id, produto_id, quantidade, preco_unitario, subtotal,
          desconto_tipo, desconto_valor, desconto_aplicado
        )
        SELECT v_order_id, produto_id, quantidade, preco_unitario, subtotal,
          desconto_tipo, desconto_valor, desconto_aplicado
        FROM public.agendamento_itens WHERE agendamento_id = v_ag.id;

        UPDATE public.agendamentos
        SET status = 'convertido', pedido_id = v_order_id, updated_at = now()
        WHERE id = v_ag.id;
      END IF;
    ELSE
      v_order_id := v_intent.pedido_id;
    END IF;

    UPDATE public.pedidos
    SET payment_timing = 'agora', payment_status = 'aprovado',
        payment_source = 'mercado_pago',
        paid_at = coalesce(paid_at, v_attempt.approved_at, now()),
        amount_received = v_amount
    WHERE id = v_order_id;

    UPDATE public.payment_intents SET pedido_id = v_order_id
    WHERE id = v_intent.id;

    PERFORM public.fn_gerar_comissoes_multinivel(v_order_id);
    UPDATE public.commissions
    SET status = 'liberada', available_at = coalesce(available_at, now())
    WHERE order_id = v_order_id
      AND status IN ('aguardando_entrega', 'aguardando_pagamento');
  ELSIF v_status IN ('reembolsado', 'chargeback') THEN
    v_order_id := v_intent.pedido_id;
    UPDATE public.agendamentos
    SET payment_status = v_status, updated_at = now()
    WHERE id = v_intent.agendamento_id;
    UPDATE public.pedidos SET payment_status = v_status
    WHERE id = v_order_id;

    v_reason := CASE WHEN v_status = 'chargeback' THEN 'chargeback'
      ELSE 'reembolso' END;
    INSERT INTO public.commission_reversals (
      commission_id, ambassador_id, payment_attempt_id, reason, amount
    )
    SELECT c.id, c.ambassador_id, v_attempt.id, v_reason, c.commission_amount
    FROM public.commissions c
    WHERE c.order_id = v_order_id AND c.status = 'paga'
    ON CONFLICT (commission_id, payment_attempt_id, reason) DO NOTHING;

    UPDATE public.commissions
    SET status = 'estornada', reversed_at = coalesce(reversed_at, now())
    WHERE order_id = v_order_id AND status <> 'estornada';
  ELSE
    UPDATE public.agendamentos
    SET payment_status = v_status, payment_source = 'mercado_pago',
        updated_at = now()
    WHERE id = v_intent.agendamento_id
      AND payment_status NOT IN ('aprovado', 'reembolsado', 'chargeback');
    UPDATE public.pedidos
    SET payment_status = v_status, payment_source = 'mercado_pago'
    WHERE id = v_intent.pedido_id
      AND payment_status NOT IN ('aprovado', 'reembolsado', 'chargeback');
  END IF;

  UPDATE private.payment_webhook_events
  SET status = 'processed', processed_at = now(), updated_at = now()
  WHERE provider = 'mercado_pago'
    AND (
      (p_event_id IS NOT NULL AND provider_event_id = p_event_id)
      OR (p_event_id IS NULL AND payload_hash = p_payload_hash)
    );

  RETURN jsonb_build_object(
    'status', v_status, 'intent_id', v_intent.id,
    'pedido_id', v_order_id, 'payment_id', v_payment_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_reconcile_mercado_pago_payment(
  text, text, jsonb, bytea
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_reconcile_mercado_pago_payment(
  text, text, jsonb, bytea
) TO service_role;

-- Manual conversion now preserves the payment lifecycle and links the intent.
CREATE OR REPLACE FUNCTION public.fn_converter_agendamento_em_pedido(
  p_agendamento_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_role text := public.get_user_role()::text;
  v_ag public.agendamentos%ROWTYPE;
  v_order_id uuid;
  v_order_number text;
BEGIN
  IF auth.uid() IS NULL OR v_role NOT IN ('admin', 'vendedor') THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  SELECT * INTO v_ag FROM public.agendamentos
  WHERE id = p_agendamento_id FOR UPDATE;
  IF v_ag.id IS NULL THEN RAISE EXCEPTION 'Agendamento nao encontrado.'; END IF;
  IF v_ag.status = 'convertido' AND v_ag.pedido_id IS NOT NULL THEN
    SELECT numero_pedido INTO v_order_number
    FROM public.pedidos WHERE id = v_ag.pedido_id;
    RETURN jsonb_build_object(
      'sucesso', true, 'idempotente', true, 'pedido_id', v_ag.pedido_id,
      'numero_pedido', v_order_number
    );
  END IF;
  IF v_ag.status <> 'agendado' THEN
    RAISE EXCEPTION 'Agendamento nao pode ser convertido neste estado.';
  END IF;
  IF v_role = 'vendedor' AND v_ag.vendedor_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  PERFORM set_config('bryza.allow_seller_referral_snapshots', 'true', true);
  INSERT INTO public.pedidos (
    cliente_id, vendedor_id, valor_total, desconto_tipo, desconto_valor,
    desconto_aplicado, forma_pagamento, observacoes, nome_cliente,
    telefone_cliente, endereco_entrega, bairro, cidade, estado, cep,
    nome_vendedor, codigo_vendedor, status_pedido, ambassador_id,
    referral_visit_id, referral_code_snapshot, attributed_at,
    attribution_source, commission_plan_id_snapshot,
    commission_percentage_snapshot, commissionable_amount_snapshot,
    commission_amount_snapshot, referral_assignment_id,
    referral_validated_snapshot, referral_commissionable_snapshot,
    ambassador_qualified_snapshot, ambassador_qualification_id_snapshot,
    payment_timing, payment_status, payment_source, paid_at, amount_received
  ) VALUES (
    v_ag.cliente_id, v_ag.vendedor_id, v_ag.valor_total, v_ag.desconto_tipo,
    v_ag.desconto_valor, v_ag.desconto_aplicado, v_ag.forma_pagamento,
    v_ag.observacoes, v_ag.nome_cliente, v_ag.telefone_cliente,
    v_ag.endereco_entrega, v_ag.bairro, v_ag.cidade, v_ag.estado, v_ag.cep,
    v_ag.nome_vendedor, v_ag.codigo_vendedor, 'aguardando_preparacao',
    v_ag.ambassador_id, v_ag.referral_visit_id, v_ag.referral_code_snapshot,
    v_ag.attributed_at, v_ag.attribution_source, v_ag.commission_plan_id_snapshot,
    v_ag.commission_percentage_snapshot, v_ag.commissionable_amount_snapshot,
    v_ag.commission_amount_snapshot, v_ag.referral_assignment_id,
    v_ag.referral_validated_snapshot, v_ag.referral_commissionable_snapshot,
    v_ag.ambassador_qualified_snapshot, v_ag.ambassador_qualification_id_snapshot,
    v_ag.payment_timing, v_ag.payment_status, v_ag.payment_source,
    v_ag.paid_at, CASE WHEN v_ag.payment_status = 'aprovado'
      THEN v_ag.valor_total END
  )
  RETURNING id, numero_pedido INTO v_order_id, v_order_number;

  INSERT INTO public.pedido_itens (
    pedido_id, produto_id, quantidade, preco_unitario, subtotal,
    desconto_tipo, desconto_valor, desconto_aplicado
  )
  SELECT v_order_id, produto_id, quantidade, preco_unitario, subtotal,
    desconto_tipo, desconto_valor, desconto_aplicado
  FROM public.agendamento_itens WHERE agendamento_id = v_ag.id;

  UPDATE public.agendamentos
  SET status = 'convertido', pedido_id = v_order_id, updated_at = now()
  WHERE id = v_ag.id;
  UPDATE public.payment_intents SET pedido_id = v_order_id
  WHERE agendamento_id = v_ag.id;
  UPDATE public.referral_attributions
  SET status = 'convertido', converted_at = coalesce(converted_at, now())
  WHERE customer_id = v_ag.cliente_id
    AND ambassador_id = v_ag.ambassador_id AND status = 'atribuido';

  INSERT INTO public.audit_logs (
    actor_id, actor_role, action, entity_type, entity_id, metadata
  ) VALUES (
    auth.uid(), v_role, 'schedule_converted_to_order', 'pedidos', v_order_id,
    jsonb_build_object('agendamento_id', v_ag.id)
  );
  RETURN jsonb_build_object(
    'sucesso', true, 'pedido_id', v_order_id, 'numero_pedido', v_order_number
  );
END;
$$;

-- Secure projection for the ambassador's own purchases (not network sales).
CREATE OR REPLACE FUNCTION public.fn_embaixador_meus_pedidos(
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0,
  p_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog
AS $$
DECLARE
  v_ambassador_id uuid;
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_items jsonb;
  v_total integer;
BEGIN
  SELECT a.id INTO v_ambassador_id
  FROM public.ambassadors a
  WHERE a.user_id = auth.uid() AND a.status = 'ativo'
  LIMIT 1;
  IF v_ambassador_id IS NULL THEN RAISE EXCEPTION 'ambassador_not_found'; END IF;

  WITH own_customers AS (
    SELECT c.id FROM public.clientes c
    WHERE c.own_ambassador_id = v_ambassador_id
  ), unified AS (
    SELECT
      'pedido'::text entity_type, p.id entity_id, p.numero_pedido numero,
      p.created_at, p.valor_total, p.status_pedido fulfillment_status,
      p.payment_timing, p.payment_status, p.payment_source, p.paid_at,
      (p.payment_timing = 'na_entrega'
        AND p.payment_status NOT IN ('aprovado', 'reembolsado', 'chargeback')
        AND p.status_pedido NOT IN ('entregue', 'finalizado', 'cancelado')
      ) can_pay_now
    FROM public.pedidos p
    WHERE p.cliente_id IN (SELECT id FROM own_customers)
    UNION ALL
    SELECT
      'agendamento'::text, a.id, a.numero_agendamento, a.created_at,
      a.valor_total, a.status::text, a.payment_timing, a.payment_status,
      a.payment_source, a.paid_at,
      (a.payment_timing = 'na_entrega'
        AND a.payment_status NOT IN ('aprovado', 'reembolsado', 'chargeback')
        AND a.status::text NOT IN ('convertido', 'cancelado')
      )
    FROM public.agendamentos a
    WHERE a.cliente_id IN (SELECT id FROM own_customers)
      AND NOT (a.status::text = 'convertido' AND a.pedido_id IS NOT NULL)
  ), filtered AS (
    SELECT * FROM unified
    WHERE p_status IS NULL
       OR fulfillment_status = p_status
       OR payment_status = p_status
  )
  SELECT count(*)::integer INTO v_total FROM filtered;

  WITH own_customers AS (
    SELECT c.id FROM public.clientes c
    WHERE c.own_ambassador_id = v_ambassador_id
  ), unified AS (
    SELECT
      'pedido'::text entity_type, p.id entity_id, p.numero_pedido numero,
      p.created_at, p.valor_total, p.status_pedido fulfillment_status,
      p.payment_timing, p.payment_status, p.payment_source, p.paid_at,
      (p.payment_timing = 'na_entrega'
        AND p.payment_status NOT IN ('aprovado', 'reembolsado', 'chargeback')
        AND p.status_pedido NOT IN ('entregue', 'finalizado', 'cancelado')
      ) can_pay_now
    FROM public.pedidos p
    WHERE p.cliente_id IN (SELECT id FROM own_customers)
    UNION ALL
    SELECT
      'agendamento'::text, a.id, a.numero_agendamento, a.created_at,
      a.valor_total, a.status::text, a.payment_timing, a.payment_status,
      a.payment_source, a.paid_at,
      (a.payment_timing = 'na_entrega'
        AND a.payment_status NOT IN ('aprovado', 'reembolsado', 'chargeback')
        AND a.status::text NOT IN ('convertido', 'cancelado')
      )
    FROM public.agendamentos a
    WHERE a.cliente_id IN (SELECT id FROM own_customers)
      AND NOT (a.status::text = 'convertido' AND a.pedido_id IS NOT NULL)
  ), filtered AS (
    SELECT * FROM unified
    WHERE p_status IS NULL
       OR fulfillment_status = p_status
       OR payment_status = p_status
    ORDER BY created_at DESC
    LIMIT v_limit OFFSET v_offset
  )
  SELECT coalesce(jsonb_agg(to_jsonb(filtered)), '[]'::jsonb)
  INTO v_items FROM filtered;

  RETURN jsonb_build_object('items', v_items, 'total', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_embaixador_meus_pedidos(
  integer, integer, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_embaixador_meus_pedidos(
  integer, integer, text
) TO authenticated;

COMMENT ON COLUMN public.agendamentos.payment_timing IS
  'Customer choice: agora (Mercado Pago) or na_entrega.';
COMMENT ON COLUMN public.pedidos.payment_status IS
  'Canonical payment state. payment_check_status remains a legacy logistics projection.';
