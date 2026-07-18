BEGIN;

-- Enriquece a visão geral sem duplicar a implementação histórica da RPC.
ALTER FUNCTION public.fn_get_embaixador_dashboard_metrics()
  RENAME TO fn_get_embaixador_dashboard_metrics_core;
REVOKE ALL ON FUNCTION public.fn_get_embaixador_dashboard_metrics_core() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_get_embaixador_dashboard_metrics_core() TO service_role;

CREATE FUNCTION public.fn_get_embaixador_dashboard_metrics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_amb_id UUID;
  v_result JSONB;
  v_first_purchase_bonus_total NUMERIC(15,2) := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida' USING ERRCODE = '42501';
  END IF;

  SELECT a.id INTO v_amb_id
  FROM public.ambassadors a
  JOIN public.profiles p ON p.id = a.user_id
  WHERE a.user_id = auth.uid()
    AND p.role = 'embaixador'
    AND p.ativo = TRUE
    AND p.must_change_password = FALSE
    AND a.status = 'ativo';

  IF v_amb_id IS NULL THEN
    RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE = '42501';
  END IF;

  v_result := public.fn_get_embaixador_dashboard_metrics_core();

  SELECT COALESCE(SUM(c.commission_amount), 0)
  INTO v_first_purchase_bonus_total
  FROM public.commissions c
  WHERE c.ambassador_id = v_amb_id
    AND c.commission_type = 'first_purchase_bonus'
    AND c.status <> 'cancelada';

  RETURN v_result || jsonb_build_object(
    'first_purchase_bonus_total', v_first_purchase_bonus_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_get_embaixador_dashboard_metrics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_get_embaixador_dashboard_metrics() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_get_embaixador_indicacoes(
  p_limit INT DEFAULT 10,
  p_offset INT DEFAULT 0,
  p_status TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_amb_id UUID;
  v_total INT := 0;
  v_items JSONB := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida' USING ERRCODE = '42501';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 50 THEN
    RAISE EXCEPTION 'p_limit deve estar entre 1 e 50' USING ERRCODE = '22023';
  END IF;
  IF p_offset IS NULL OR p_offset < 0 THEN
    RAISE EXCEPTION 'p_offset deve ser maior ou igual a 0' USING ERRCODE = '22023';
  END IF;

  SELECT a.id INTO v_amb_id
  FROM public.ambassadors a
  JOIN public.profiles p ON p.id = a.user_id
  WHERE a.user_id = auth.uid()
    AND p.role = 'embaixador'
    AND p.ativo = TRUE
    AND p.must_change_password = FALSE
    AND a.status = 'ativo';

  IF v_amb_id IS NULL THEN
    RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*) INTO v_total
  FROM public.referral_attributions ra
  WHERE ra.ambassador_id = v_amb_id
    AND (p_status IS NULL OR p_status = '' OR ra.source = p_status);

  SELECT jsonb_agg(jsonb_build_object(
    'id', sub.id,
    'created_at', sub.created_at,
    'referral_source', sub.referral_source,
    'cliente_nome_mascarado', sub.nome_mascarado,
    'is_locked', sub.is_locked,
    'total_pedidos', sub.total_pedidos,
    'valor_aprovado_total', sub.valor_aprovado_total,
    'is_active', sub.is_active,
    'activation_status', CASE WHEN sub.is_active THEN 'ativo' ELSE 'nao_ativo' END,
    'activated_at', sub.activated_at,
    'activation_order_code', sub.activation_order_code
  )) INTO v_items
  FROM (
    SELECT
      ra.id,
      ra.created_at,
      ra.source AS referral_source,
      ra.locked_at IS NOT NULL AS is_locked,
      CASE
        WHEN c.nome IS NULL THEN 'Cliente Indireto'
        WHEN position(' ' in trim(c.nome)) > 0 THEN
          split_part(trim(c.nome), ' ', 1) || ' ' || upper(left(split_part(trim(c.nome), ' ', 2), 1)) || '.'
        ELSE trim(c.nome)
      END AS nome_mascarado,
      COALESCE(order_totals.total_pedidos, 0) AS total_pedidos,
      COALESCE(order_totals.valor_aprovado_total, 0) AS valor_aprovado_total,
      activation.activated_at IS NOT NULL AS is_active,
      activation.activated_at,
      activation.numero_pedido AS activation_order_code
    FROM public.referral_attributions ra
    LEFT JOIN public.clientes c ON c.id = ra.customer_id
    LEFT JOIN LATERAL (
      SELECT
        COUNT(DISTINCT ped.id) AS total_pedidos,
        COALESCE(SUM(CASE
          WHEN ped.status_pedido = 'finalizado' AND ped.payment_check_status = 'confirmado'
          THEN ped.valor_total ELSE 0 END), 0) AS valor_aprovado_total
      FROM public.pedidos ped
      WHERE ped.cliente_id = ra.customer_id
        AND ped.ambassador_id = v_amb_id
    ) order_totals ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        ped.numero_pedido,
        COALESCE(ped.finalized_at, ped.updated_at, ped.created_at) AS activated_at
      FROM public.pedidos ped
      WHERE ped.cliente_id = ra.customer_id
        AND ped.ambassador_id = v_amb_id
        AND ped.payment_check_status = 'confirmado'
        AND ped.status_pedido IN ('entregue', 'finalizado')
      ORDER BY COALESCE(ped.finalized_at, ped.updated_at, ped.created_at), ped.created_at, ped.id
      LIMIT 1
    ) activation ON TRUE
    WHERE ra.ambassador_id = v_amb_id
      AND (p_status IS NULL OR p_status = '' OR ra.source = p_status)
    ORDER BY ra.created_at DESC, ra.id DESC
    LIMIT p_limit OFFSET p_offset
  ) sub;

  RETURN jsonb_build_object(
    'items', COALESCE(v_items, '[]'::jsonb),
    'total', v_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_get_embaixador_indicacoes(INT, INT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_get_embaixador_indicacoes(INT, INT, TEXT) TO authenticated, service_role;

COMMIT;
