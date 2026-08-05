-- Recover payments reconciled by the webhook before the checkout response
-- stored the provider id in the private idempotency claim.
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
  v_reconciled_payment_id text;
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
  IF v_intent.id IS NULL THEN
    RAISE EXCEPTION 'payment_intent_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_intent.status IN ('aprovado', 'reembolsado', 'chargeback', 'cancelado') THEN
    RETURN jsonb_build_object('status', 'unavailable', 'intent_status', v_intent.status);
  END IF;

  SELECT * INTO v_claim
  FROM private.mercado_pago_transparent_attempts
  WHERE payment_intent_id = v_intent.id
  FOR UPDATE;

  -- The webhook can reconcile the payment before the checkout request stores
  -- its provider id. Repair the claim from that trusted server-side record.
  IF v_claim.id IS NOT NULL AND v_claim.provider_payment_id IS NULL THEN
    SELECT attempt.provider_payment_id, attempt.status
    INTO v_reconciled_payment_id, v_provider_status
    FROM public.payment_attempts attempt
    WHERE attempt.payment_intent_id = v_intent.id
      AND attempt.provider_payment_id IS NOT NULL
    ORDER BY attempt.created_at DESC
    LIMIT 1;

    IF v_reconciled_payment_id IS NOT NULL THEN
      UPDATE private.mercado_pago_transparent_attempts
      SET provider_payment_id = v_reconciled_payment_id,
          status = 'completed', expires_at = now(), updated_at = now()
      WHERE id = v_claim.id;

      RETURN jsonb_build_object(
        'status', 'replay',
        'provider_payment_id', v_reconciled_payment_id,
        'intent_status', v_intent.status
      );
    END IF;
  END IF;

  IF v_claim.id IS NOT NULL AND v_claim.idempotency_key = v_key THEN
    IF v_claim.provider_payment_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'status', 'replay',
        'provider_payment_id', v_claim.provider_payment_id,
        'intent_status', v_intent.status
      );
    END IF;
    IF v_claim.status = 'processing' AND v_claim.expires_at > now() THEN
      RETURN jsonb_build_object('status', 'in_progress', 'intent_status', v_intent.status);
    END IF;

    UPDATE private.mercado_pago_transparent_attempts
    SET status = 'processing', expires_at = now() + interval '5 minutes', updated_at = now()
    WHERE id = v_claim.id;
    RETURN jsonb_build_object('status', 'claimed', 'intent_status', v_intent.status);
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
      RETURN jsonb_build_object(
        'status', 'replay',
        'provider_payment_id', v_claim.provider_payment_id,
        'intent_status', v_intent.status
      );
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
        status = 'processing', expires_at = now() + interval '5 minutes', updated_at = now()
    WHERE id = v_claim.id;
  END IF;

  RETURN jsonb_build_object('status', 'claimed', 'intent_status', v_intent.status);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_service_claim_transparent_attempt(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_service_claim_transparent_attempt(uuid, text)
  TO service_role;
