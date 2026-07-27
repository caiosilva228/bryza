BEGIN;

-- Uma solicitação pendente reserva as comissões por meio de
-- commission_payment_items. O índice impede solicitações concorrentes.
CREATE UNIQUE INDEX IF NOT EXISTS uq_commission_payments_pending_ambassador
  ON public.commission_payments (ambassador_id)
  WHERE status = 'pendente' AND payment_reference IS NULL;

CREATE OR REPLACE FUNCTION public.fn_get_embaixador_pagamentos(
  p_limit integer DEFAULT 10,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_ambassador public.ambassadors%ROWTYPE;
  v_minimum numeric(12,2) := 0;
  v_frequency text := 'mensal';
  v_program_status text := 'ativo';
  v_available numeric(12,2) := 0;
  v_available_count integer := 0;
  v_total integer := 0;
  v_items jsonb := '[]'::jsonb;
  v_pending jsonb;
  v_pix_masked text;
  v_can_request boolean := false;
  v_blocked_reason text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida' USING ERRCODE = '42501';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 50
     OR p_offset IS NULL OR p_offset < 0 THEN
    RAISE EXCEPTION 'Paginação inválida' USING ERRCODE = '22023';
  END IF;

  SELECT a.* INTO v_ambassador
  FROM public.ambassadors a
  JOIN public.profiles p ON p.id = a.user_id
  WHERE a.user_id = auth.uid()
    AND p.role = 'embaixador'
    AND p.ativo
    AND NOT p.must_change_password
    AND a.status = 'ativo'
    AND a.lifecycle_status = 'active';

  IF v_ambassador.id IS NULL THEN
    RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE = '42501';
  END IF;

  SELECT
    coalesce(s.minimum_payment_amount, 0),
    coalesce(s.payment_frequency, 'mensal'),
    coalesce(s.program_status, 'ativo')
  INTO v_minimum, v_frequency, v_program_status
  FROM public.ambassador_program_settings s
  WHERE s.singleton;

  SELECT count(*), coalesce(sum(c.commission_amount), 0)
  INTO v_available_count, v_available
  FROM public.commissions c
  WHERE c.ambassador_id = v_ambassador.id
    AND c.status = 'liberada';

  SELECT jsonb_build_object(
    'id', cp.id,
    'amount', cp.amount,
    'created_at', cp.created_at,
    'commission_count', count(cpi.id)
  )
  INTO v_pending
  FROM public.commission_payments cp
  JOIN public.commission_payment_items cpi ON cpi.payment_id = cp.id
  WHERE cp.ambassador_id = v_ambassador.id
    AND cp.status = 'pendente'
    AND cp.payment_reference IS NULL
  GROUP BY cp.id, cp.amount, cp.created_at
  LIMIT 1;

  v_pix_masked := CASE
    WHEN nullif(trim(coalesce(v_ambassador.pix_key, '')), '') IS NULL THEN NULL
    WHEN length(v_ambassador.pix_key) <= 6 THEN '******'
    ELSE left(v_ambassador.pix_key, 3)
      || repeat('*', greatest(length(v_ambassador.pix_key) - 6, 4))
      || right(v_ambassador.pix_key, 3)
  END;

  v_blocked_reason := CASE
    WHEN v_program_status <> 'ativo' THEN 'program_inactive'
    WHEN v_pending IS NOT NULL THEN 'pending_request'
    WHEN v_pix_masked IS NULL OR v_ambassador.pix_key_type IS NULL THEN 'pix_missing'
    WHEN v_available < v_minimum THEN 'below_minimum'
    WHEN v_available_count = 0 THEN 'no_available_commissions'
    ELSE NULL
  END;
  v_can_request := v_blocked_reason IS NULL;

  SELECT count(*) INTO v_total
  FROM public.commission_payments cp
  WHERE cp.ambassador_id = v_ambassador.id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', history.id,
    'created_at', history.created_at,
    'paid_at', history.paid_at,
    'amount', history.amount,
    'payment_method', history.payment_method,
    'status', history.status,
    'notes', history.notes,
    'is_withdrawal_request', history.payment_reference IS NULL,
    'has_receipt', history.receipt_path IS NOT NULL
  ) ORDER BY history.created_at DESC, history.id DESC), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT cp.*
    FROM public.commission_payments cp
    WHERE cp.ambassador_id = v_ambassador.id
    ORDER BY cp.created_at DESC, cp.id DESC
    LIMIT p_limit OFFSET p_offset
  ) history;

  RETURN jsonb_build_object(
    'items', v_items,
    'total', v_total,
    'withdrawal', jsonb_build_object(
      'available_amount', v_available,
      'available_commission_count', v_available_count,
      'minimum_payment_amount', v_minimum,
      'payment_frequency', v_frequency,
      'program_status', v_program_status,
      'pix_key_type', v_ambassador.pix_key_type,
      'pix_key_masked', v_pix_masked,
      'can_request', v_can_request,
      'blocked_reason', v_blocked_reason,
      'pending_request', v_pending
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_solicitar_saque_comissoes()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_ambassador public.ambassadors%ROWTYPE;
  v_payment public.commission_payments%ROWTYPE;
  v_minimum numeric(12,2) := 0;
  v_program_status text := 'ativo';
  v_total numeric(12,2) := 0;
  v_count integer := 0;
  v_commission_ids uuid[];
  v_cpf_digits text;
  v_cpf_masked text;
  v_pix_masked text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida' USING ERRCODE = '42501';
  END IF;

  SELECT a.* INTO v_ambassador
  FROM public.ambassadors a
  JOIN public.profiles p ON p.id = a.user_id
  WHERE a.user_id = auth.uid()
    AND p.role = 'embaixador'
    AND p.ativo
    AND NOT p.must_change_password
    AND a.status = 'ativo'
    AND a.lifecycle_status = 'active'
  FOR UPDATE OF a;

  IF v_ambassador.id IS NULL THEN
    RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE = '42501';
  END IF;

  SELECT
    coalesce(s.minimum_payment_amount, 0),
    coalesce(s.program_status, 'ativo')
  INTO v_minimum, v_program_status
  FROM public.ambassador_program_settings s
  WHERE s.singleton;

  IF v_program_status <> 'ativo' THEN
    RAISE EXCEPTION 'O programa de embaixadores não está disponível para saques.';
  END IF;
  IF nullif(trim(coalesce(v_ambassador.pix_key, '')), '') IS NULL
     OR v_ambassador.pix_key_type IS NULL THEN
    RAISE EXCEPTION 'Cadastre uma chave Pix antes de solicitar o saque.';
  END IF;

  SELECT cp.* INTO v_payment
  FROM public.commission_payments cp
  WHERE cp.ambassador_id = v_ambassador.id
    AND cp.status = 'pendente'
    AND cp.payment_reference IS NULL
  FOR UPDATE;

  IF v_payment.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'request_id', v_payment.id,
      'amount', v_payment.amount,
      'message', 'Sua solicitação de saque já está em análise.'
    );
  END IF;

  PERFORM 1
  FROM public.commissions c
  WHERE c.ambassador_id = v_ambassador.id
    AND c.status = 'liberada'
  FOR UPDATE;

  SELECT
    array_agg(c.id ORDER BY c.created_at, c.id),
    count(*),
    coalesce(sum(c.commission_amount), 0)
  INTO v_commission_ids, v_count, v_total
  FROM public.commissions c
  WHERE c.ambassador_id = v_ambassador.id
    AND c.status = 'liberada';

  IF v_count = 0 THEN
    RAISE EXCEPTION 'Você ainda não possui comissões liberadas para saque.';
  END IF;
  IF v_total < v_minimum THEN
    RAISE EXCEPTION 'Saldo abaixo do mínimo de R$ % para saque.',
      trim(to_char(v_minimum, 'FM999G999G990D00'));
  END IF;

  v_cpf_digits := regexp_replace(coalesce(v_ambassador.cpf, ''), '[^0-9]', '', 'g');
  v_cpf_masked := CASE
    WHEN length(v_cpf_digits) = 11
      THEN left(v_cpf_digits, 3) || '.***.***-' || right(v_cpf_digits, 2)
    ELSE 'Não informado'
  END;
  v_pix_masked := CASE
    WHEN length(v_ambassador.pix_key) <= 6 THEN '******'
    ELSE left(v_ambassador.pix_key, 3)
      || repeat('*', greatest(length(v_ambassador.pix_key) - 6, 4))
      || right(v_ambassador.pix_key, 3)
  END;

  INSERT INTO public.commission_payments (
    ambassador_id,
    amount,
    payment_method,
    ambassador_name_snapshot,
    cpf_masked_snapshot,
    pix_key_type_snapshot,
    pix_key_snapshot,
    payment_reference,
    status,
    paid_at,
    notes,
    created_by
  ) VALUES (
    v_ambassador.id,
    v_total,
    'pix',
    v_ambassador.full_name,
    v_cpf_masked,
    v_ambassador.pix_key_type,
    v_pix_masked,
    NULL,
    'pendente',
    NULL,
    'Solicitação de saque criada pelo embaixador.',
    auth.uid()
  )
  RETURNING * INTO v_payment;

  INSERT INTO public.commission_payment_items (
    payment_id,
    commission_id,
    amount
  )
  SELECT v_payment.id, c.id, c.commission_amount
  FROM public.commissions c
  WHERE c.id = ANY(v_commission_ids);

  INSERT INTO public.audit_logs (
    actor_id, actor_role, action, entity_type, entity_id, metadata
  ) VALUES (
    auth.uid(),
    'embaixador',
    'commission_withdrawal_requested',
    'commission_payments',
    v_payment.id,
    jsonb_build_object(
      'amount', v_total,
      'commission_count', v_count,
      'minimum_payment_amount', v_minimum
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'request_id', v_payment.id,
    'amount', v_total,
    'message', 'Solicitação de saque enviada para análise.'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_cancelar_solicitacao_saque(
  p_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_ambassador_id uuid;
  v_payment public.commission_payments%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida' USING ERRCODE = '42501';
  END IF;

  SELECT a.id INTO v_ambassador_id
  FROM public.ambassadors a
  JOIN public.profiles p ON p.id = a.user_id
  WHERE a.user_id = auth.uid()
    AND p.role = 'embaixador'
    AND p.ativo
    AND NOT p.must_change_password
    AND a.status = 'ativo'
    AND a.lifecycle_status = 'active';

  SELECT cp.* INTO v_payment
  FROM public.commission_payments cp
  WHERE cp.id = p_request_id
    AND cp.ambassador_id = v_ambassador_id
    AND cp.status = 'pendente'
    AND cp.payment_reference IS NULL
  FOR UPDATE;

  IF v_payment.id IS NULL THEN
    RAISE EXCEPTION 'Solicitação pendente não encontrada.';
  END IF;

  DELETE FROM public.commission_payment_items cpi
  WHERE cpi.payment_id = v_payment.id;

  UPDATE public.commission_payments
  SET
    status = 'cancelada',
    notes = 'Solicitação de saque cancelada pelo embaixador.'
  WHERE id = v_payment.id;

  INSERT INTO public.audit_logs (
    actor_id, actor_role, action, entity_type, entity_id, metadata
  ) VALUES (
    auth.uid(),
    'embaixador',
    'commission_withdrawal_cancelled',
    'commission_payments',
    v_payment.id,
    jsonb_build_object('amount', v_payment.amount)
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Solicitação de saque cancelada.'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_admin_listar_comissoes_liberadas()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_minimum numeric(12,2) := 0;
  v_groups jsonb := '[]'::jsonb;
  v_available numeric(12,2) := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.ativo
  ) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(s.minimum_payment_amount, 0)
  INTO v_minimum
  FROM public.ambassador_program_settings s
  WHERE s.singleton;

  SELECT coalesce(sum(c.commission_amount), 0)
  INTO v_available
  FROM public.commissions c
  WHERE c.status = 'liberada';

  SELECT coalesce(jsonb_agg(group_data ORDER BY group_data->>'ambassador_name'), '[]'::jsonb)
  INTO v_groups
  FROM (
    SELECT jsonb_build_object(
      'ambassador_id', a.id,
      'ambassador_name', a.full_name,
      'referral_code', a.referral_code,
      'pix_key_type', a.pix_key_type,
      'pix_masked', CASE
        WHEN a.pix_key IS NULL THEN NULL
        WHEN length(a.pix_key) <= 6 THEN '******'
        ELSE left(a.pix_key, 3)
          || repeat('*', greatest(length(a.pix_key) - 6, 4))
          || right(a.pix_key, 3)
      END,
      'total', sum(c.commission_amount),
      'count', count(*),
      'eligible_minimum', sum(c.commission_amount) >= v_minimum,
      'withdrawal_request', request.request_data,
      'commissions', jsonb_agg(jsonb_build_object(
        'id', c.id,
        'order_id', c.order_id,
        'level', c.commission_level,
        'type', c.commission_type,
        'amount', c.commission_amount,
        'created_at', c.created_at
      ) ORDER BY c.created_at)
    ) AS group_data
    FROM public.commissions c
    JOIN public.ambassadors a ON a.id = c.ambassador_id
    LEFT JOIN LATERAL (
      SELECT jsonb_build_object(
        'id', cp.id,
        'amount', cp.amount,
        'created_at', cp.created_at,
        'commission_ids', jsonb_agg(cpi.commission_id ORDER BY cpi.created_at)
      ) AS request_data
      FROM public.commission_payments cp
      JOIN public.commission_payment_items cpi ON cpi.payment_id = cp.id
      WHERE cp.ambassador_id = a.id
        AND cp.status = 'pendente'
        AND cp.payment_reference IS NULL
      GROUP BY cp.id, cp.amount, cp.created_at
      LIMIT 1
    ) request ON true
    WHERE c.status = 'liberada'
    GROUP BY
      a.id, a.full_name, a.referral_code, a.pix_key_type, a.pix_key,
      request.request_data
  ) grouped;

  RETURN jsonb_build_object(
    'summary', jsonb_build_object(
      'available', v_available,
      'minimum_payment_amount', v_minimum
    ),
    'groups', v_groups
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_admin_criar_pagamento_comissoes(
  p_ambassador_id uuid,
  p_commission_ids uuid[],
  p_payment_reference text,
  p_notes text DEFAULT NULL,
  p_override_minimum boolean DEFAULT false,
  p_override_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_ambassador public.ambassadors%ROWTYPE;
  v_payment public.commission_payments%ROWTYPE;
  v_request public.commission_payments%ROWTYPE;
  v_request_ids uuid[];
  v_total numeric(12,2) := 0;
  v_minimum numeric(12,2) := 0;
  v_count integer := 0;
  v_requested boolean := false;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.ativo
  ) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = '42501';
  END IF;
  IF p_ambassador_id IS NULL
     OR coalesce(array_length(p_commission_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Seleção de comissões obrigatória.';
  END IF;
  IF length(trim(coalesce(p_payment_reference, ''))) < 3 THEN
    RAISE EXCEPTION 'Referência de pagamento obrigatória.';
  END IF;
  IF p_override_minimum
     AND length(trim(coalesce(p_override_reason, ''))) < 5 THEN
    RAISE EXCEPTION 'Motivo do override obrigatório.';
  END IF;

  SELECT cp.* INTO v_payment
  FROM public.commission_payments cp
  WHERE cp.payment_reference = trim(p_payment_reference);

  IF v_payment.id IS NOT NULL THEN
    IF v_payment.ambassador_id = p_ambassador_id THEN
      RETURN jsonb_build_object(
        'success', true,
        'idempotent', true,
        'payment_id', v_payment.id,
        'amount', v_payment.amount
      );
    END IF;
    RAISE EXCEPTION 'Referência de pagamento já utilizada.';
  END IF;

  SELECT a.* INTO v_ambassador
  FROM public.ambassadors a
  WHERE a.id = p_ambassador_id
  FOR UPDATE;

  IF v_ambassador.id IS NULL THEN
    RAISE EXCEPTION 'Embaixador não encontrado.';
  END IF;

  SELECT coalesce(s.minimum_payment_amount, 0)
  INTO v_minimum
  FROM public.ambassador_program_settings s
  WHERE s.singleton;

  PERFORM 1
  FROM public.commissions c
  WHERE c.id = ANY(p_commission_ids)
  FOR UPDATE;

  SELECT count(*), coalesce(sum(c.commission_amount), 0)
  INTO v_count, v_total
  FROM public.commissions c
  WHERE c.id = ANY(p_commission_ids)
    AND c.ambassador_id = p_ambassador_id
    AND c.status = 'liberada';

  IF v_count <> array_length(p_commission_ids, 1) THEN
    RAISE EXCEPTION 'Uma ou mais comissões não estão liberadas ou pertencem a outro embaixador.';
  END IF;
  IF v_total < v_minimum AND NOT p_override_minimum THEN
    RAISE EXCEPTION 'Valor abaixo do mínimo configurado.';
  END IF;

  SELECT cp.* INTO v_request
  FROM public.commission_payments cp
  WHERE cp.ambassador_id = p_ambassador_id
    AND cp.status = 'pendente'
    AND cp.payment_reference IS NULL
  FOR UPDATE;

  IF v_request.id IS NOT NULL THEN
    SELECT array_agg(cpi.commission_id ORDER BY cpi.commission_id)
    INTO v_request_ids
    FROM public.commission_payment_items cpi
    WHERE cpi.payment_id = v_request.id;

    IF cardinality(v_request_ids) <> cardinality(p_commission_ids)
       OR EXISTS (
         SELECT requested_id
         FROM unnest(v_request_ids) requested_id
         EXCEPT
         SELECT selected_id
         FROM unnest(p_commission_ids) selected_id
       )
       OR EXISTS (
         SELECT selected_id
         FROM unnest(p_commission_ids) selected_id
         EXCEPT
         SELECT requested_id
         FROM unnest(v_request_ids) requested_id
       ) THEN
      RAISE EXCEPTION 'Processe exatamente as comissões incluídas na solicitação de saque pendente.';
    END IF;
    IF v_request.amount IS DISTINCT FROM v_total THEN
      RAISE EXCEPTION 'O valor da solicitação não corresponde às comissões liberadas.';
    END IF;

    UPDATE public.commission_payments
    SET
      payment_reference = trim(p_payment_reference),
      status = 'processando',
      paid_at = now(),
      notes = nullif(trim(coalesce(p_notes, '')), '')
    WHERE id = v_request.id
    RETURNING * INTO v_payment;

    v_requested := true;
  ELSE
    INSERT INTO public.commission_payments (
      ambassador_id,
      amount,
      payment_method,
      ambassador_name_snapshot,
      cpf_masked_snapshot,
      pix_key_type_snapshot,
      pix_key_snapshot,
      payment_reference,
      status,
      paid_at,
      notes,
      created_by
    ) VALUES (
      v_ambassador.id,
      v_total,
      'pix',
      v_ambassador.full_name,
      CASE
        WHEN length(regexp_replace(coalesce(v_ambassador.cpf, ''), '[^0-9]', '', 'g')) = 11
          THEN left(regexp_replace(v_ambassador.cpf, '[^0-9]', '', 'g'), 3)
            || '.***.***-'
            || right(regexp_replace(v_ambassador.cpf, '[^0-9]', '', 'g'), 2)
        ELSE 'Não informado'
      END,
      v_ambassador.pix_key_type,
      CASE
        WHEN v_ambassador.pix_key IS NULL THEN NULL
        WHEN length(v_ambassador.pix_key) <= 6 THEN '******'
        ELSE left(v_ambassador.pix_key, 3)
          || repeat('*', greatest(length(v_ambassador.pix_key) - 6, 4))
          || right(v_ambassador.pix_key, 3)
      END,
      trim(p_payment_reference),
      'processando',
      now(),
      p_notes,
      auth.uid()
    )
    RETURNING * INTO v_payment;

    INSERT INTO public.commission_payment_items (
      payment_id, commission_id, amount
    )
    SELECT v_payment.id, c.id, c.commission_amount
    FROM public.commissions c
    WHERE c.id = ANY(p_commission_ids);
  END IF;

  UPDATE public.commissions
  SET status = 'paga', paid_at = now()
  WHERE id = ANY(p_commission_ids)
    AND status = 'liberada';

  UPDATE public.commission_payments
  SET status = 'paga'
  WHERE id = v_payment.id;

  INSERT INTO public.audit_logs (
    actor_id, actor_role, action, entity_type, entity_id, metadata
  ) VALUES (
    auth.uid(),
    'admin',
    'commission_payment_completed',
    'commission_payments',
    v_payment.id,
    jsonb_build_object(
      'amount', v_total,
      'commission_count', v_count,
      'override_minimum', p_override_minimum,
      'override_reason', p_override_reason,
      'requested_by_ambassador', v_requested
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment.id,
    'amount', v_total,
    'requested_by_ambassador', v_requested
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_get_embaixador_pagamentos(integer, integer)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_solicitar_saque_comissoes()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_cancelar_solicitacao_saque(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_admin_listar_comissoes_liberadas()
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_admin_criar_pagamento_comissoes(
  uuid, uuid[], text, text, boolean, text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.fn_get_embaixador_pagamentos(integer, integer)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_solicitar_saque_comissoes()
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_cancelar_solicitacao_saque(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_admin_listar_comissoes_liberadas()
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_admin_criar_pagamento_comissoes(
  uuid, uuid[], text, text, boolean, text
) TO authenticated, service_role;

COMMIT;
