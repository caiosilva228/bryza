-- Checkout transparente do Mercado Pago e vínculo server-only de cartões salvos.
-- A tabela privada guarda somente a associação pessoa Bryza -> customer_id do
-- Mercado Pago. Número, CVV e tokens de cartão continuam fora do banco.

ALTER TABLE public.payment_intents
  ADD COLUMN IF NOT EXISTS checkout_mode text NOT NULL DEFAULT 'checkout_pro'
    CHECK (checkout_mode IN ('checkout_pro', 'transparent')),
  ADD COLUMN IF NOT EXISTS card_save_status text NOT NULL DEFAULT 'not_requested'
    CHECK (card_save_status IN ('not_requested', 'eligible', 'saved', 'not_saved', 'failed'));

ALTER TABLE public.payment_attempts
  ADD COLUMN IF NOT EXISTS checkout_mode text NOT NULL DEFAULT 'checkout_pro'
    CHECK (checkout_mode IN ('checkout_pro', 'transparent')),
  ADD COLUMN IF NOT EXISTS card_save_status text NOT NULL DEFAULT 'not_requested'
    CHECK (card_save_status IN ('not_requested', 'eligible', 'saved', 'not_saved', 'failed'));

CREATE TABLE IF NOT EXISTS private.mercado_pago_customer_links (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  person_id uuid NOT NULL UNIQUE REFERENCES private.persons(id) ON DELETE RESTRICT,
  provider_customer_id text NOT NULL UNIQUE CHECK (length(btrim(provider_customer_id)) BETWEEN 1 AND 120),
  email_normalized text NOT NULL CHECK (
    email_normalized = lower(btrim(email_normalized))
    AND length(email_normalized) BETWEEN 3 AND 254
    AND position('@' IN email_normalized) > 1
  ),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  disabled_at timestamptz,
  CHECK ((status = 'disabled') = (disabled_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS private.mercado_pago_transparent_attempts (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  payment_intent_id uuid NOT NULL UNIQUE REFERENCES public.payment_intents(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 16 AND 120),
  provider_payment_id text,
  status text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'completed', 'failed')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE private.mercado_pago_customer_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.mercado_pago_transparent_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.mercado_pago_customer_links FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE private.mercado_pago_transparent_attempts FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE private.mercado_pago_customer_links TO service_role;
GRANT ALL ON TABLE private.mercado_pago_transparent_attempts TO service_role;

CREATE OR REPLACE FUNCTION private.fn_mercado_pago_link_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO pg_catalog
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mercado_pago_customer_links_updated_at
  ON private.mercado_pago_customer_links;
CREATE TRIGGER trg_mercado_pago_customer_links_updated_at
BEFORE UPDATE ON private.mercado_pago_customer_links
FOR EACH ROW EXECUTE FUNCTION private.fn_mercado_pago_link_touch_updated_at();

DROP TRIGGER IF EXISTS trg_mercado_pago_transparent_attempts_updated_at
  ON private.mercado_pago_transparent_attempts;
CREATE TRIGGER trg_mercado_pago_transparent_attempts_updated_at
BEFORE UPDATE ON private.mercado_pago_transparent_attempts
FOR EACH ROW EXECUTE FUNCTION private.fn_mercado_pago_link_touch_updated_at();

REVOKE ALL ON FUNCTION private.fn_mercado_pago_link_touch_updated_at()
  FROM PUBLIC, anon, authenticated;

-- Webhooks may reconcile a payment before the browser receives the direct
-- response. Inherit the intent's checkout mode so the attempt remains
-- correctly classified in either order.
CREATE OR REPLACE FUNCTION public.fn_payment_attempt_inherit_intent_checkout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog
AS $$
DECLARE
  v_checkout_mode text;
  v_card_save_status text;
BEGIN
  SELECT checkout_mode, card_save_status
  INTO v_checkout_mode, v_card_save_status
  FROM public.payment_intents
  WHERE id = NEW.payment_intent_id;

  IF v_checkout_mode = 'transparent' THEN
    NEW.checkout_mode := 'transparent';
    IF NEW.card_save_status = 'not_requested' AND v_card_save_status IS NOT NULL THEN
      NEW.card_save_status := v_card_save_status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payment_attempts_inherit_intent_checkout
  ON public.payment_attempts;
CREATE TRIGGER trg_payment_attempts_inherit_intent_checkout
BEFORE INSERT OR UPDATE OF payment_intent_id ON public.payment_attempts
FOR EACH ROW EXECUTE FUNCTION public.fn_payment_attempt_inherit_intent_checkout();

REVOKE ALL ON FUNCTION public.fn_payment_attempt_inherit_intent_checkout()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_payment_attempt_inherit_intent_checkout()
  TO service_role;

-- Resolve the canonical person from auth.users. The caller must pass the user
-- id obtained from the verified Supabase session; e-mail and customer_id from
-- the browser are intentionally not accepted here.
CREATE OR REPLACE FUNCTION public.fn_service_mercado_pago_customer_context(
  p_auth_user_id uuid,
  p_checkout_token uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_user auth.users%ROWTYPE;
  v_person_id uuid;
  v_customer_id uuid;
  v_full_name text;
  v_email text;
  v_cpf text;
  v_provider_customer_id text;
  v_owned boolean := true;
BEGIN
  IF coalesce(auth.jwt()->>'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501';
  END IF;
  IF p_auth_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'not_linked');
  END IF;

  SELECT * INTO v_user
  FROM auth.users
  WHERE id = p_auth_user_id AND deleted_at IS NULL
    AND email_confirmed_at IS NOT NULL;
  IF v_user.id IS NULL THEN
    RETURN jsonb_build_object('status', 'email_not_confirmed');
  END IF;

  SELECT pa.person_id, pbr.source_entity_id, person.full_name,
         person.email_normalized, person.cpf_normalized
  INTO v_person_id, v_customer_id, v_full_name, v_email, v_cpf
  FROM private.person_accounts pa
  JOIN private.persons person
    ON person.id = pa.person_id AND person.status = 'active'
  JOIN private.person_business_roles pbr
    ON pbr.person_id = pa.person_id
   AND pbr.role_type = 'customer'
   AND pbr.status = 'active'
  JOIN public.clientes customer
    ON customer.id = pbr.source_entity_id
   AND customer.lifecycle_status = 'active'
  WHERE pa.auth_user_id = p_auth_user_id
    AND pa.status = 'active'
  LIMIT 1;

  IF v_person_id IS NULL OR v_customer_id IS NULL THEN
    RETURN jsonb_build_object('status', 'not_linked');
  END IF;

  IF p_checkout_token IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.payment_intents pi
      LEFT JOIN public.agendamentos ag ON ag.id = pi.agendamento_id
      LEFT JOIN public.pedidos pe ON pe.id = pi.pedido_id
      WHERE pi.checkout_token = p_checkout_token
        AND (ag.cliente_id = v_customer_id OR pe.cliente_id = v_customer_id)
    ) INTO v_owned;
  END IF;

  SELECT link.provider_customer_id
  INTO v_provider_customer_id
  FROM private.mercado_pago_customer_links link
  WHERE link.person_id = v_person_id AND link.status = 'active';

  RETURN jsonb_build_object(
    'status', 'ok',
    'owned', v_owned,
    'eligible', v_owned,
    'person_id', v_person_id,
    'customer_id', v_customer_id,
    'full_name', v_full_name,
    'email', coalesce(nullif(lower(btrim(v_user.email)), ''), v_email),
    'cpf', v_cpf,
    'provider_customer_id', v_provider_customer_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_service_mercado_pago_customer_context(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_service_mercado_pago_customer_context(uuid, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.fn_service_upsert_mercado_pago_customer_link(
  p_person_id uuid,
  p_provider_customer_id text,
  p_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_existing private.mercado_pago_customer_links%ROWTYPE;
  v_email text := lower(btrim(coalesce(p_email, '')));
BEGIN
  IF coalesce(auth.jwt()->>'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501';
  END IF;
  IF p_person_id IS NULL OR length(btrim(coalesce(p_provider_customer_id, ''))) = 0
     OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'invalid_mercado_pago_customer_link' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_existing
  FROM private.mercado_pago_customer_links
  WHERE person_id = p_person_id OR provider_customer_id = btrim(p_provider_customer_id)
  FOR UPDATE;

  IF v_existing.id IS NOT NULL
     AND v_existing.person_id <> p_person_id THEN
    RAISE EXCEPTION 'mercado_pago_customer_already_linked' USING ERRCODE = '23505';
  END IF;

  INSERT INTO private.mercado_pago_customer_links (
    person_id, provider_customer_id, email_normalized, status, disabled_at
  ) VALUES (
    p_person_id, btrim(p_provider_customer_id), v_email, 'active', NULL
  )
  ON CONFLICT (person_id) DO UPDATE
  SET provider_customer_id = EXCLUDED.provider_customer_id,
      email_normalized = EXCLUDED.email_normalized,
      status = 'active',
      disabled_at = NULL,
      updated_at = now();

  RETURN jsonb_build_object('status', 'linked', 'provider_customer_id', btrim(p_provider_customer_id));
END;
$$;

REVOKE ALL ON FUNCTION public.fn_service_upsert_mercado_pago_customer_link(uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_service_upsert_mercado_pago_customer_link(uuid, text, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.fn_service_prepare_customer_transparent_checkout(
  p_auth_user_id uuid,
  p_entity_type text,
  p_entity_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_context jsonb;
  v_customer_id uuid;
  v_intent public.payment_intents%ROWTYPE;
  v_order public.pedidos%ROWTYPE;
  v_agendamento public.agendamentos%ROWTYPE;
  v_amount numeric(12,2);
  v_number text;
  v_payment_status text;
  v_fulfillment_status text;
  v_is_paid boolean;
BEGIN
  IF coalesce(auth.jwt()->>'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501';
  END IF;
  IF lower(coalesce(p_entity_type, '')) NOT IN ('pedido', 'agendamento') OR p_entity_id IS NULL THEN
    RAISE EXCEPTION 'invalid_customer_order_identity' USING ERRCODE = '22023';
  END IF;

  v_context := public.fn_service_mercado_pago_customer_context(p_auth_user_id, NULL);
  IF v_context->>'status' <> 'ok' THEN
    RAISE EXCEPTION 'customer_account_not_linked' USING ERRCODE = '42501';
  END IF;
  v_customer_id := nullif(v_context->>'customer_id', '')::uuid;

  IF lower(p_entity_type) = 'pedido' THEN
    SELECT * INTO v_order
    FROM public.pedidos
    WHERE id = p_entity_id AND cliente_id = v_customer_id
    FOR UPDATE;
    IF v_order.id IS NULL THEN RAISE EXCEPTION 'customer_order_not_found' USING ERRCODE = 'P0002'; END IF;
    v_amount := round(v_order.valor_total, 2);
    v_number := v_order.numero_pedido;
    v_payment_status := lower(coalesce(v_order.payment_status, ''));
    v_fulfillment_status := lower(coalesce(v_order.status_pedido, ''));
    v_is_paid := v_payment_status IN ('aprovado', 'confirmado', 'pago')
      OR v_order.payment_check_status = 'confirmado';
  ELSE
    SELECT * INTO v_agendamento
    FROM public.agendamentos
    WHERE id = p_entity_id AND cliente_id = v_customer_id
    FOR UPDATE;
    IF v_agendamento.id IS NULL THEN RAISE EXCEPTION 'customer_order_not_found' USING ERRCODE = 'P0002'; END IF;
    v_amount := round(v_agendamento.valor_total, 2);
    v_number := v_agendamento.numero_agendamento;
    v_payment_status := lower(coalesce(v_agendamento.payment_status, ''));
    v_fulfillment_status := lower(coalesce(v_agendamento.status::text, ''));
    v_is_paid := v_payment_status IN ('aprovado', 'confirmado', 'pago');
  END IF;

  IF v_is_paid OR v_payment_status IN ('reembolsado', 'chargeback')
     OR v_fulfillment_status IN ('cancelado', 'entregue', 'finalizado', 'convertido') THEN
    RAISE EXCEPTION 'customer_payment_unavailable' USING ERRCODE = '55000';
  END IF;
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_customer_payment_amount' USING ERRCODE = '22023';
  END IF;

  IF lower(p_entity_type) = 'pedido' THEN
    SELECT * INTO v_intent
    FROM public.payment_intents
    WHERE pedido_id = p_entity_id
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;
  ELSE
    SELECT * INTO v_intent
    FROM public.payment_intents
    WHERE agendamento_id = p_entity_id
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF v_intent.id IS NULL THEN
    INSERT INTO public.payment_intents (
      agendamento_id, pedido_id, payment_timing, expected_amount, status,
      checkout_mode, card_save_status, expires_at
    ) VALUES (
      CASE WHEN lower(p_entity_type) = 'agendamento' THEN p_entity_id ELSE NULL END,
      CASE WHEN lower(p_entity_type) = 'pedido' THEN p_entity_id ELSE NULL END,
      'agora', v_amount, 'pendente', 'transparent', 'not_requested',
      now() + interval '30 minutes'
    )
    RETURNING * INTO v_intent;
  ELSE
    UPDATE public.payment_intents
    SET expected_amount = v_amount,
        payment_timing = 'agora',
        checkout_mode = 'transparent',
        card_save_status = 'not_requested',
        status = CASE WHEN status IN ('recusado', 'expirado', 'cancelado') THEN 'pendente' ELSE status END,
        expires_at = now() + interval '30 minutes'
    WHERE id = v_intent.id
    RETURNING * INTO v_intent;
  END IF;

  IF lower(p_entity_type) = 'pedido' THEN
    UPDATE public.pedidos
    SET payment_timing = 'agora', payment_status = 'pendente',
        payment_source = 'mercado_pago', forma_pagamento = 'mercado_pago', updated_at = now()
    WHERE id = p_entity_id;
  ELSE
    UPDATE public.agendamentos
    SET payment_timing = 'agora', payment_status = 'pendente',
        payment_source = 'mercado_pago', updated_at = now()
    WHERE id = p_entity_id;
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok',
    'checkout_token', v_intent.checkout_token,
    'amount', v_intent.expected_amount,
    'currency', v_intent.currency,
    'order_number', v_number,
    'intent_status', v_intent.status,
    'person_id', v_context->>'person_id',
    'customer_id', v_context->>'customer_id',
    'email', v_context->>'email',
    'cpf', v_context->>'cpf',
    'provider_customer_id', v_context->>'provider_customer_id'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_service_prepare_customer_transparent_checkout(uuid, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_service_prepare_customer_transparent_checkout(uuid, text, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.fn_service_claim_transparent_attempt(
  p_checkout_token uuid,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_intent public.payment_intents%ROWTYPE;
  v_claim private.mercado_pago_transparent_attempts%ROWTYPE;
  v_key text := btrim(coalesce(p_idempotency_key, ''));
  v_provider_status text;
BEGIN
  IF coalesce(auth.jwt()->>'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501';
  END IF;
  IF p_checkout_token IS NULL OR length(v_key) NOT BETWEEN 16 AND 120 THEN
    RAISE EXCEPTION 'invalid_transparent_attempt' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_intent
  FROM public.payment_intents
  WHERE checkout_token = p_checkout_token
  FOR UPDATE;
  IF v_intent.id IS NULL THEN RAISE EXCEPTION 'payment_intent_not_found' USING ERRCODE = 'P0002'; END IF;
  IF v_intent.status IN ('aprovado', 'reembolsado', 'chargeback', 'cancelado') THEN
    RETURN jsonb_build_object('status', 'unavailable', 'intent_status', v_intent.status);
  END IF;

  SELECT * INTO v_claim
  FROM private.mercado_pago_transparent_attempts
  WHERE payment_intent_id = v_intent.id
  FOR UPDATE;

  IF v_claim.id IS NOT NULL AND v_claim.idempotency_key = v_key THEN
    RETURN jsonb_build_object(
      'status', CASE WHEN v_claim.provider_payment_id IS NULL THEN v_claim.status ELSE 'replay' END,
      'provider_payment_id', v_claim.provider_payment_id,
      'intent_status', v_intent.status
    );
  END IF;
  IF v_claim.id IS NOT NULL AND v_claim.provider_payment_id IS NOT NULL THEN
    SELECT status
    INTO v_provider_status
    FROM public.payment_attempts
    WHERE payment_intent_id = v_intent.id
      AND provider_payment_id = v_claim.provider_payment_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_provider_status IN ('aprovado', 'reembolsado', 'chargeback') THEN
      RETURN jsonb_build_object('status', 'unavailable', 'intent_status', v_intent.status);
    END IF;
    IF v_provider_status IN ('pendente', 'processando', 'em_analise') THEN
      RETURN jsonb_build_object('status', 'in_progress', 'intent_status', v_intent.status);
    END IF;
  END IF;
  IF v_claim.id IS NOT NULL AND v_claim.status = 'processing' AND v_claim.expires_at > now() THEN
    RETURN jsonb_build_object('status', 'in_progress', 'intent_status', v_intent.status);
  END IF;

  IF v_claim.id IS NULL THEN
    INSERT INTO private.mercado_pago_transparent_attempts (
      payment_intent_id, idempotency_key, status, expires_at
    ) VALUES (v_intent.id, v_key, 'processing', now() + interval '5 minutes');
  ELSE
    UPDATE private.mercado_pago_transparent_attempts
    SET idempotency_key = v_key, provider_payment_id = NULL,
        status = 'processing', expires_at = now() + interval '5 minutes'
    WHERE id = v_claim.id;
  END IF;

  RETURN jsonb_build_object('status', 'claimed', 'intent_status', v_intent.status);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_service_claim_transparent_attempt(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_service_claim_transparent_attempt(uuid, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.fn_service_finish_transparent_attempt(
  p_checkout_token uuid,
  p_idempotency_key text,
  p_provider_payment_id text,
  p_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  IF coalesce(auth.jwt()->>'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501';
  END IF;
  UPDATE private.mercado_pago_transparent_attempts claim
  SET provider_payment_id = nullif(btrim(p_provider_payment_id), ''),
      status = CASE WHEN p_status = 'failed' THEN 'failed' ELSE 'completed' END,
      expires_at = now(), updated_at = now()
  FROM public.payment_intents intent
  WHERE claim.payment_intent_id = intent.id
    AND intent.checkout_token = p_checkout_token
    AND claim.idempotency_key = btrim(coalesce(p_idempotency_key, ''));

  RETURN jsonb_build_object('status', 'ok');
END;
$$;

REVOKE ALL ON FUNCTION public.fn_service_finish_transparent_attempt(uuid, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_service_finish_transparent_attempt(uuid, text, text, text)
  TO service_role;

COMMENT ON TABLE private.mercado_pago_customer_links IS
  'Server-only mapping from canonical Bryza person to Mercado Pago customer_id; no card PAN, CVV, or token.';
COMMENT ON TABLE private.mercado_pago_transparent_attempts IS
  'Server-only idempotency claim preventing concurrent transparent charges for one payment intent.';
