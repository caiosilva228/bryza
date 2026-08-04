BEGIN;

-- Keep the provider transaction details directly on the commercial record.
-- payment_attempts remains the complete immutable-ish provider history, while
-- these columns make the current transaction available from pedidos without
-- having to traverse payment_intents -> payment_attempts.
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS mercado_pago_payment_id text,
  ADD COLUMN IF NOT EXISTS mercado_pago_payment_method_id text,
  ADD COLUMN IF NOT EXISTS mercado_pago_payment_type_id text,
  ADD COLUMN IF NOT EXISTS mercado_pago_installments integer;

ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS mercado_pago_payment_id text,
  ADD COLUMN IF NOT EXISTS mercado_pago_payment_method_id text,
  ADD COLUMN IF NOT EXISTS mercado_pago_payment_type_id text,
  ADD COLUMN IF NOT EXISTS mercado_pago_installments integer;

COMMENT ON COLUMN public.pedidos.mercado_pago_payment_id IS
  'ID da transação no Mercado Pago, sincronizado a partir de payment_attempts.';
COMMENT ON COLUMN public.pedidos.mercado_pago_payment_method_id IS
  'Método informado pelo Mercado Pago na transação atual.';
COMMENT ON COLUMN public.pedidos.mercado_pago_payment_type_id IS
  'Tipo informado pelo Mercado Pago na transação atual.';
COMMENT ON COLUMN public.agendamentos.mercado_pago_payment_id IS
  'ID da transação no Mercado Pago, sincronizado a partir de payment_attempts.';

-- Backfill safe for payments that were approved before the denormalized
-- columns existed. The latest approved attempt wins per subject.
WITH latest_pedido_payment AS (
  SELECT DISTINCT ON (pi.pedido_id)
    pi.pedido_id,
    pa.provider_payment_id,
    pa.payment_method_id,
    pa.payment_type_id,
    pa.installments
  FROM public.payment_intents pi
  JOIN public.payment_attempts pa ON pa.payment_intent_id = pi.id
  WHERE pi.pedido_id IS NOT NULL
    AND pa.status IN ('aprovado', 'approved')
  ORDER BY pi.pedido_id, coalesce(pa.approved_at, pa.created_at) DESC, pa.created_at DESC
)
UPDATE public.pedidos p
SET mercado_pago_payment_id = latest.provider_payment_id,
    mercado_pago_payment_method_id = latest.payment_method_id,
    mercado_pago_payment_type_id = latest.payment_type_id,
    mercado_pago_installments = latest.installments,
    forma_pagamento = CASE
      WHEN lower(coalesce(latest.payment_type_id, '')) IN ('pix', 'pix_online')
        OR lower(coalesce(latest.payment_method_id, '')) = 'pix'
        THEN 'pix'
      WHEN lower(coalesce(latest.payment_type_id, '')) IN ('credit_card', 'debit_card', 'card')
        THEN 'cartao'
      ELSE 'mercado_pago'
    END
FROM latest_pedido_payment latest
WHERE p.id = latest.pedido_id
  AND p.mercado_pago_payment_id IS NULL;

WITH latest_agendamento_payment AS (
  SELECT DISTINCT ON (pi.agendamento_id)
    pi.agendamento_id,
    pa.provider_payment_id,
    pa.payment_method_id,
    pa.payment_type_id,
    pa.installments
  FROM public.payment_intents pi
  JOIN public.payment_attempts pa ON pa.payment_intent_id = pi.id
  WHERE pi.agendamento_id IS NOT NULL
    AND pa.status IN ('aprovado', 'approved')
  ORDER BY pi.agendamento_id, coalesce(pa.approved_at, pa.created_at) DESC, pa.created_at DESC
)
UPDATE public.agendamentos a
SET mercado_pago_payment_id = latest.provider_payment_id,
    mercado_pago_payment_method_id = latest.payment_method_id,
    mercado_pago_payment_type_id = latest.payment_type_id,
    mercado_pago_installments = latest.installments,
    forma_pagamento = CASE
      WHEN lower(coalesce(latest.payment_type_id, '')) IN ('pix', 'pix_online')
        OR lower(coalesce(latest.payment_method_id, '')) = 'pix'
        THEN 'pix'
      WHEN lower(coalesce(latest.payment_type_id, '')) IN ('credit_card', 'debit_card', 'card')
        THEN 'cartao'
      ELSE 'mercado_pago'
    END
FROM latest_agendamento_payment latest
WHERE a.id = latest.agendamento_id
  AND a.mercado_pago_payment_id IS NULL;

-- An agendamento can be converted into a pedido during reconciliation. Copy
-- the provider details again when that link is created so the final pedido
-- also keeps the transaction ID.
UPDATE public.pedidos p
SET mercado_pago_payment_id = a.mercado_pago_payment_id,
    mercado_pago_payment_method_id = a.mercado_pago_payment_method_id,
    mercado_pago_payment_type_id = a.mercado_pago_payment_type_id,
    mercado_pago_installments = a.mercado_pago_installments,
    forma_pagamento = CASE
      WHEN lower(coalesce(a.forma_pagamento, '')) = 'pix' THEN 'pix'
      WHEN lower(coalesce(a.forma_pagamento, '')) = 'cartao' THEN 'cartao'
      ELSE 'mercado_pago'
    END
FROM public.agendamentos a
WHERE a.pedido_id = p.id
  AND a.mercado_pago_payment_id IS NOT NULL
  AND p.mercado_pago_payment_id IS NULL;

CREATE OR REPLACE FUNCTION private.fn_sync_mercado_pago_attempt_to_subject()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog
AS $$
DECLARE
  v_pedido_id uuid;
  v_agendamento_id uuid;
  v_forma_pagamento text;
BEGIN
  IF nullif(btrim(NEW.provider_payment_id), '') IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT pi.pedido_id, pi.agendamento_id
  INTO v_pedido_id, v_agendamento_id
  FROM public.payment_intents pi
  WHERE pi.id = NEW.payment_intent_id;

  v_forma_pagamento := CASE
    WHEN lower(coalesce(NEW.payment_type_id, '')) IN ('pix', 'pix_online')
      OR lower(coalesce(NEW.payment_method_id, '')) = 'pix'
      THEN 'pix'
    WHEN lower(coalesce(NEW.payment_type_id, '')) IN ('credit_card', 'debit_card', 'card')
      THEN 'cartao'
    ELSE 'mercado_pago'
  END;

  IF v_pedido_id IS NOT NULL THEN
    UPDATE public.pedidos
    SET mercado_pago_payment_id = NEW.provider_payment_id,
        mercado_pago_payment_method_id = NEW.payment_method_id,
        mercado_pago_payment_type_id = NEW.payment_type_id,
        mercado_pago_installments = NEW.installments,
        forma_pagamento = v_forma_pagamento,
        payment_source = 'mercado_pago',
        updated_at = now()
    WHERE id = v_pedido_id;
  END IF;

  IF v_agendamento_id IS NOT NULL THEN
    UPDATE public.agendamentos
    SET mercado_pago_payment_id = NEW.provider_payment_id,
        mercado_pago_payment_method_id = NEW.payment_method_id,
        mercado_pago_payment_type_id = NEW.payment_type_id,
        mercado_pago_installments = NEW.installments,
        forma_pagamento = v_forma_pagamento,
        payment_source = 'mercado_pago',
        updated_at = now()
    WHERE id = v_agendamento_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_mercado_pago_attempt_to_subject
  ON public.payment_attempts;
CREATE TRIGGER trg_sync_mercado_pago_attempt_to_subject
AFTER INSERT OR UPDATE OF provider_payment_id, payment_method_id, payment_type_id, installments, status
ON public.payment_attempts
FOR EACH ROW EXECUTE FUNCTION private.fn_sync_mercado_pago_attempt_to_subject();

CREATE OR REPLACE FUNCTION private.fn_sync_mercado_pago_schedule_to_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog
AS $$
BEGIN
  IF NEW.pedido_id IS NULL OR nullif(btrim(NEW.mercado_pago_payment_id), '') IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.pedidos
  SET mercado_pago_payment_id = NEW.mercado_pago_payment_id,
      mercado_pago_payment_method_id = NEW.mercado_pago_payment_method_id,
      mercado_pago_payment_type_id = NEW.mercado_pago_payment_type_id,
      mercado_pago_installments = NEW.mercado_pago_installments,
      forma_pagamento = CASE
        WHEN lower(coalesce(NEW.forma_pagamento, '')) = 'pix' THEN 'pix'
        WHEN lower(coalesce(NEW.forma_pagamento, '')) = 'cartao' THEN 'cartao'
        ELSE 'mercado_pago'
      END,
      payment_source = 'mercado_pago',
      updated_at = now()
  WHERE id = NEW.pedido_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_mercado_pago_schedule_to_order
  ON public.agendamentos;
CREATE TRIGGER trg_sync_mercado_pago_schedule_to_order
AFTER INSERT OR UPDATE OF pedido_id, mercado_pago_payment_id
ON public.agendamentos
FOR EACH ROW EXECUTE FUNCTION private.fn_sync_mercado_pago_schedule_to_order();

REVOKE ALL ON FUNCTION private.fn_sync_mercado_pago_attempt_to_subject()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.fn_sync_mercado_pago_schedule_to_order()
  FROM PUBLIC, anon, authenticated;

-- Prepare a checkout for an ambassador's own purchase. Ownership is checked
-- in the database, so a client cannot pay another customer's order by
-- replacing an ID in the browser request.
CREATE OR REPLACE FUNCTION public.fn_prepare_ambassador_checkout(
  p_entity_type text,
  p_entity_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog
AS $$
DECLARE
  v_ambassador_id uuid;
  v_entity_type text := lower(btrim(coalesce(p_entity_type, '')));
  v_intent public.payment_intents%ROWTYPE;
  v_order public.pedidos%ROWTYPE;
  v_agendamento public.agendamentos%ROWTYPE;
  v_amount numeric(12,2);
  v_number text;
  v_payment_status text;
  v_fulfillment_status text;
  v_intent_can_reuse boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF v_entity_type NOT IN ('pedido', 'agendamento') OR p_entity_id IS NULL THEN
    RAISE EXCEPTION 'invalid_ambassador_order_identity' USING ERRCODE = '22023';
  END IF;

  SELECT a.id INTO v_ambassador_id
  FROM public.ambassadors a
  WHERE a.user_id = auth.uid()
    AND a.status = 'ativo'
  LIMIT 1;
  IF v_ambassador_id IS NULL THEN
    RAISE EXCEPTION 'ambassador_not_found' USING ERRCODE = '42501';
  END IF;

  IF v_entity_type = 'pedido' THEN
    SELECT p.* INTO v_order
    FROM public.pedidos p
    JOIN public.clientes c
      ON c.id = p.cliente_id
     AND c.own_ambassador_id = v_ambassador_id
    WHERE p.id = p_entity_id
    FOR UPDATE;

    IF v_order.id IS NULL THEN
      RAISE EXCEPTION 'ambassador_order_not_found' USING ERRCODE = 'P0002';
    END IF;

    v_amount := round(v_order.valor_total, 2);
    v_number := v_order.numero_pedido;
    v_payment_status := lower(coalesce(v_order.payment_status, 'pendente'));
    v_fulfillment_status := lower(coalesce(v_order.status_pedido, ''));
  ELSE
    SELECT a.* INTO v_agendamento
    FROM public.agendamentos a
    JOIN public.clientes c
      ON c.id = a.cliente_id
     AND c.own_ambassador_id = v_ambassador_id
    WHERE a.id = p_entity_id
      AND a.status::text NOT IN ('convertido', 'cancelado')
    FOR UPDATE;

    IF v_agendamento.id IS NULL THEN
      RAISE EXCEPTION 'ambassador_order_not_found' USING ERRCODE = 'P0002';
    END IF;

    v_amount := round(v_agendamento.valor_total, 2);
    v_number := v_agendamento.numero_agendamento;
    v_payment_status := lower(coalesce(v_agendamento.payment_status, 'pendente'));
    v_fulfillment_status := lower(coalesce(v_agendamento.status::text, ''));
  END IF;

  IF v_payment_status IN ('aprovado', 'reembolsado', 'chargeback') THEN
    RAISE EXCEPTION 'ambassador_payment_unavailable' USING ERRCODE = '55000';
  END IF;
  IF v_fulfillment_status IN ('cancelado', 'entregue', 'finalizado', 'convertido') THEN
    RAISE EXCEPTION 'ambassador_payment_unavailable' USING ERRCODE = '55000';
  END IF;
  IF v_payment_status NOT IN ('pendente', 'processando', 'recusado', 'cancelado', 'expirado') THEN
    RAISE EXCEPTION 'ambassador_payment_under_review' USING ERRCODE = '55000';
  END IF;
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_ambassador_payment_amount' USING ERRCODE = '22023';
  END IF;

  IF v_entity_type = 'pedido' THEN
    SELECT * INTO v_intent
    FROM public.payment_intents pi
    WHERE pi.pedido_id = p_entity_id
    ORDER BY pi.created_at DESC
    LIMIT 1
    FOR UPDATE;
  ELSE
    SELECT * INTO v_intent
    FROM public.payment_intents pi
    WHERE pi.agendamento_id = p_entity_id
    ORDER BY pi.created_at DESC
    LIMIT 1
    FOR UPDATE;
  END IF;

  v_intent_can_reuse := v_intent.id IS NOT NULL
    AND v_intent.status IN ('pendente', 'processando')
    AND round(v_intent.expected_amount, 2) = v_amount
    AND (v_intent.expires_at IS NULL OR v_intent.expires_at > now());

  IF v_intent.id IS NULL THEN
    INSERT INTO public.payment_intents (
      agendamento_id, pedido_id, payment_timing, expected_amount, status
    ) VALUES (
      CASE WHEN v_entity_type = 'agendamento' THEN p_entity_id ELSE NULL END,
      CASE WHEN v_entity_type = 'pedido' THEN p_entity_id ELSE NULL END,
      'agora', v_amount, 'pendente'
    )
    RETURNING * INTO v_intent;
  ELSIF NOT v_intent_can_reuse THEN
    UPDATE public.payment_intents
    SET expected_amount = v_amount,
        payment_timing = 'agora',
        status = 'pendente',
        provider_preference_id = NULL,
        checkout_url = NULL,
        sandbox_checkout_url = NULL,
        expires_at = NULL,
        approved_at = NULL,
        refunded_at = NULL,
        updated_at = now()
    WHERE id = v_intent.id
    RETURNING * INTO v_intent;
  END IF;

  IF v_entity_type = 'pedido' THEN
    UPDATE public.pedidos
    SET payment_timing = 'agora',
        payment_status = 'pendente',
        payment_source = 'mercado_pago',
        forma_pagamento = 'mercado_pago',
        updated_at = now()
    WHERE id = p_entity_id;
  ELSE
    UPDATE public.agendamentos
    SET payment_timing = 'agora',
        payment_status = 'pendente',
        payment_source = 'mercado_pago',
        forma_pagamento = 'mercado_pago',
        updated_at = now()
    WHERE id = p_entity_id;
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok',
    'entity_type', v_entity_type,
    'entity_id', p_entity_id,
    'checkout_token', v_intent.checkout_token,
    'order_number', v_number,
    'amount', v_intent.expected_amount,
    'currency', v_intent.currency
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_prepare_ambassador_checkout(text, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_prepare_ambassador_checkout(text, uuid)
  TO authenticated;

-- The portal can pay any active, unpaid own purchase. Orders under review are
-- intentionally excluded because a new checkout could race the provider's
-- existing decision.
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
      (p.payment_status IN ('pendente', 'processando', 'recusado', 'cancelado', 'expirado')
        AND p.status_pedido NOT IN ('entregue', 'finalizado', 'cancelado')
      ) can_pay_now
    FROM public.pedidos p
    WHERE p.cliente_id IN (SELECT id FROM own_customers)
    UNION ALL
    SELECT
      'agendamento'::text, a.id, a.numero_agendamento, a.created_at,
      a.valor_total, a.status::text, a.payment_timing, a.payment_status,
      a.payment_source, a.paid_at,
      (a.payment_status IN ('pendente', 'processando', 'recusado', 'cancelado', 'expirado')
        AND a.status::text NOT IN ('convertido', 'cancelado')
      ) can_pay_now
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
      (p.payment_status IN ('pendente', 'processando', 'recusado', 'cancelado', 'expirado')
        AND p.status_pedido NOT IN ('entregue', 'finalizado', 'cancelado')
      ) can_pay_now
    FROM public.pedidos p
    WHERE p.cliente_id IN (SELECT id FROM own_customers)
    UNION ALL
    SELECT
      'agendamento'::text, a.id, a.numero_agendamento, a.created_at,
      a.valor_total, a.status::text, a.payment_timing, a.payment_status,
      a.payment_source, a.paid_at,
      (a.payment_status IN ('pendente', 'processando', 'recusado', 'cancelado', 'expirado')
        AND a.status::text NOT IN ('convertido', 'cancelado')
      ) can_pay_now
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

REVOKE ALL ON FUNCTION public.fn_embaixador_meus_pedidos(integer, integer, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_embaixador_meus_pedidos(integer, integer, text)
  TO authenticated;

COMMIT;
