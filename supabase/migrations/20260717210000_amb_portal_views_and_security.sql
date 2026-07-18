-- ═══════════════════════════════════════════════════════════════════
-- BRYZA — Migration Prompt 05: Portal do Embaixador & Segurança RLS
-- Arquivo: supabase/migrations/20260717210000_amb_portal_views_and_security.sql
-- ═══════════════════════════════════════════════════════════════════

-- 0. GARANTIR COLUNA RECEIPT_PATH EM COMMISSION_PAYMENTS
ALTER TABLE public.commission_payments 
ADD COLUMN IF NOT EXISTS receipt_path TEXT;

-- 1. ÍNDICES DE PERFORMANCE DE ISOLAMENTO E BUSCA
CREATE INDEX IF NOT EXISTS idx_commissions_ambassador_status_created
ON public.commissions (ambassador_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_commission_payments_ambassador_created
ON public.commission_payments (ambassador_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_referral_attributions_ambassador_created
ON public.referral_attributions (ambassador_id, created_at DESC);

-- 2. BUCKET PRIVADO DE COMPROVANTES DE PAGAMENTO
INSERT INTO storage.buckets (id, name, public) 
VALUES ('payment-receipts', 'payment-receipts', false) 
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Acesso total de admin no storage de comprovantes" ON storage.objects;
CREATE POLICY "Acesso total de admin no storage de comprovantes"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'payment-receipts'
  AND public.get_user_role() = 'admin'
)
WITH CHECK (
  bucket_id = 'payment-receipts'
  AND public.get_user_role() = 'admin'
);

DROP POLICY IF EXISTS "Leitura de comprovantes proprios por embaixadores" ON storage.objects;
CREATE POLICY "Leitura de comprovantes proprios por embaixadores"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'payment-receipts'
  AND (
    public.get_user_role() = 'admin'
    OR EXISTS (
      SELECT 1 
      FROM public.commission_payments cp
      JOIN public.ambassadors a ON a.id = cp.ambassador_id
      WHERE a.user_id = auth.uid()
        AND cp.receipt_path IS NOT NULL
        AND storage.objects.name LIKE cp.id::text || '/%'
    )
  )
);

-- 3. REVOGAR UPDATE DIRETO NA TABELA AMBASSADORS (IMUTABILIDADE DE CPF/USERNAME/PLANO)
REVOKE UPDATE ON public.ambassadors FROM authenticated;
REVOKE UPDATE ON public.ambassadors FROM anon;
REVOKE UPDATE ON public.ambassadors FROM PUBLIC;

-- 4. RPC DE ATUALIZAÇÃO RESTRITA DO PERFIL DO EMBAIXADOR
CREATE OR REPLACE FUNCTION public.fn_update_meu_perfil(
  p_phone TEXT,
  p_instagram TEXT,
  p_city TEXT,
  p_state TEXT,
  p_pix_type TEXT,
  p_pix_key TEXT,
  p_photo_path TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_amb_id UUID;
  v_old_pix_key TEXT;
  v_pix_changed BOOLEAN := FALSE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida' USING ERRCODE = '42501';
  END IF;

  SELECT a.id, a.pix_key
  INTO v_amb_id, v_old_pix_key
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

  IF p_pix_key IS NOT NULL AND p_pix_key <> '' AND p_pix_key NOT LIKE '%*%' AND p_pix_key <> COALESCE(v_old_pix_key, '') THEN
    v_pix_changed := TRUE;
  END IF;

  UPDATE public.ambassadors
  SET
    phone = COALESCE(p_phone, phone),
    instagram = COALESCE(p_instagram, instagram),
    city = COALESCE(p_city, city),
    state = COALESCE(p_state, state),
    pix_key_type = COALESCE(p_pix_type, pix_key_type),
    pix_key = CASE WHEN p_pix_key IS NOT NULL AND p_pix_key <> '' AND p_pix_key NOT LIKE '%*%' THEN p_pix_key ELSE pix_key END,
    photo_path = COALESCE(p_photo_path, photo_path),
    updated_at = NOW()
  WHERE id = v_amb_id;

  IF v_pix_changed THEN
    INSERT INTO public.audit_logs (action, entity_type, entity_id, actor_id, metadata)
    VALUES (
      'update_pix_key', 
      'ambassadors', 
      v_amb_id, 
      auth.uid(), 
      jsonb_build_object('message', 'Chave Pix alterada pelo próprio embaixador.')
    );
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 5. RPC DE MÉTRICAS E DASHBOARD DO EMBAIXADOR
CREATE OR REPLACE FUNCTION public.fn_get_embaixador_dashboard_metrics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_amb_id UUID;
  v_referral_code TEXT;
  v_display_name TEXT;
  v_photo_path TEXT;
  v_vendas_mes_qtd INT := 0;
  v_vendas_mes_valor NUMERIC(15,2) := 0.00;
  v_comissao_aguardando NUMERIC(15,2) := 0.00;
  v_comissao_disponivel NUMERIC(15,2) := 0.00;
  v_total_recebido NUMERIC(15,2) := 0.00;
  v_clientes_indicados INT := 0;
  v_grafico_mensal JSONB := '[]'::jsonb;
  v_start_of_month TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida' USING ERRCODE = '42501';
  END IF;

  SELECT a.id, a.referral_code, a.display_name, a.photo_path
  INTO v_amb_id, v_referral_code, v_display_name, v_photo_path
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

  -- Início do mês no fuso America/Sao_Paulo
  v_start_of_month := date_trunc('month', NOW() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo';

  -- 1. Vendas do mês (pedidos finalizados, descontando estornos)
  SELECT 
    COALESCE(COUNT(DISTINCT p.id), 0),
    COALESCE(SUM(p.valor_total), 0.00)
  INTO v_vendas_mes_qtd, v_vendas_mes_valor
  FROM public.pedidos p
  WHERE p.ambassador_id = v_amb_id
    AND p.status_pedido = 'finalizado'
    AND p.created_at >= v_start_of_month;

  -- 2. Métricas de Comissões e Pagamentos
  SELECT 
    COALESCE(SUM(CASE WHEN status IN ('aguardando_entrega', 'aguardando_pagamento') THEN commission_amount ELSE 0 END), 0.00),
    COALESCE(SUM(CASE WHEN status = 'liberada' THEN commission_amount ELSE 0 END), 0.00)
  INTO v_comissao_aguardando, v_comissao_disponivel
  FROM public.commissions
  WHERE ambassador_id = v_amb_id;

  -- 3. Total recebido (saques pagos)
  SELECT COALESCE(SUM(amount), 0.00)
  INTO v_total_recebido
  FROM public.commission_payments
  WHERE ambassador_id = v_amb_id;

  -- 4. Total de clientes indicados
  SELECT COUNT(*)
  INTO v_clientes_indicados
  FROM public.referral_attributions
  WHERE ambassador_id = v_amb_id;

  -- 5. Gráfico mensal dos últimos 6 meses (Sem agregação aninhada)
  WITH months AS (
    SELECT generate_series(
      date_trunc('month', NOW() AT TIME ZONE 'America/Sao_Paulo') - INTERVAL '5 months',
      date_trunc('month', NOW() AT TIME ZONE 'America/Sao_Paulo'),
      INTERVAL '1 month'
    ) AS month_start
  ),
  monthly_summary AS (
    SELECT 
      m.month_start,
      to_char(m.month_start, 'YYYY-MM') AS mes,
      COALESCE(COUNT(DISTINCT p.id), 0) AS vendas_qtd,
      COALESCE(SUM(p.valor_total), 0.00) AS vendas_valor,
      COALESCE(SUM(c.commission_amount), 0.00) AS comissao_valor
    FROM months m
    LEFT JOIN public.pedidos p ON p.ambassador_id = v_amb_id 
      AND p.status_pedido = 'finalizado'
      AND p.created_at >= m.month_start 
      AND p.created_at < m.month_start + INTERVAL '1 month'
    LEFT JOIN public.commissions c ON c.order_id = p.id AND c.ambassador_id = v_amb_id AND c.status <> 'cancelada'
    GROUP BY m.month_start
    ORDER BY m.month_start ASC
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'mes', mes,
      'vendas_qtd', vendas_qtd,
      'vendas_valor', vendas_valor,
      'comissao_valor', comissao_valor
    )
  )
  INTO v_grafico_mensal
  FROM monthly_summary;

  RETURN jsonb_build_object(
    'referral_code', v_referral_code,
    'display_name', v_display_name,
    'photo_path', v_photo_path,
    'vendas_mes_qtd', v_vendas_mes_qtd,
    'vendas_mes_valor', v_vendas_mes_valor,
    'comissao_aguardando', v_comissao_aguardando,
    'comissao_disponivel', v_comissao_disponivel,
    'total_recebido', v_total_recebido,
    'clientes_indicados', v_clientes_indicados,
    'grafico_mensal', COALESCE(v_grafico_mensal, '[]'::jsonb)
  );
END;
$$;

-- 6. RPC DE INDICAÇÕES COM PRIVACIDADE E PAGINAÇÃO
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

  -- Total count
  SELECT COUNT(*) INTO v_total
  FROM public.referral_attributions ra
  WHERE ra.ambassador_id = v_amb_id
    AND (p_status IS NULL OR p_status = '' OR ra.referral_source = p_status);

  -- Items mascarados
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', sub.id,
      'created_at', sub.created_at,
      'referral_source', sub.referral_source,
      'cliente_nome_mascarado', sub.nome_mascarado,
      'is_locked', (sub.locked_at IS NOT NULL),
      'total_pedidos', sub.total_pedidos,
      'valor_aprovado_total', sub.valor_aprovado_total
    )
  )
  INTO v_items
  FROM (
    SELECT 
      ra.id,
      ra.created_at,
      ra.referral_source,
      ra.locked_at,
      CASE 
        WHEN c.nome IS NULL THEN 'Cliente Indireto'
        WHEN position(' ' in trim(c.nome)) > 0 THEN 
          split_part(trim(c.nome), ' ', 1) || ' ' || upper(left(split_part(trim(c.nome), ' ', 2), 1)) || '.'
        ELSE trim(c.nome)
      END AS nome_mascarado,
      COALESCE(COUNT(DISTINCT ped.id), 0) AS total_pedidos,
      COALESCE(SUM(CASE WHEN ped.status_pedido = 'finalizado' THEN ped.valor_total ELSE 0 END), 0.00) AS valor_aprovado_total
    FROM public.referral_attributions ra
    LEFT JOIN public.clientes c ON c.id = ra.client_id
    LEFT JOIN public.pedidos ped ON ped.cliente_id = ra.client_id AND ped.ambassador_id = v_amb_id
    WHERE ra.ambassador_id = v_amb_id
      AND (p_status IS NULL OR p_status = '' OR ra.referral_source = p_status)
    GROUP BY ra.id, ra.created_at, ra.referral_source, ra.locked_at, c.nome
    ORDER BY ra.created_at DESC, ra.id DESC
    LIMIT p_limit OFFSET p_offset
  ) sub;

  RETURN jsonb_build_object(
    'items', COALESCE(v_items, '[]'::jsonb),
    'total', v_total
  );
END;
$$;

-- 7. RPC DE VENDAS COM PRIVACIDADE E PAGINAÇÃO
CREATE OR REPLACE FUNCTION public.fn_get_embaixador_vendas(
  p_limit INT DEFAULT 10,
  p_offset INT DEFAULT 0,
  p_status_pedido TEXT DEFAULT NULL
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

  -- Total count
  SELECT COUNT(*) INTO v_total
  FROM public.pedidos ped
  WHERE ped.ambassador_id = v_amb_id
    AND (p_status_pedido IS NULL OR p_status_pedido = '' OR ped.status_pedido = p_status_pedido);

  -- Items sem custos/lucros da Bryza
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', sub.id,
      'codigo_pedido', sub.codigo_pedido,
      'created_at', sub.created_at,
      'valor_total', sub.valor_total,
      'status_pedido', sub.status_pedido,
      'cliente_nome_mascarado', sub.nome_mascarado,
      'commission_percentage', sub.percentage_snapshot,
      'commission_amount', sub.commission_amount,
      'commission_status', sub.commission_status
    )
  )
  INTO v_items
  FROM (
    SELECT 
      ped.id,
      ped.numero_pedido AS codigo_pedido,
      ped.created_at,
      ped.valor_total,
      ped.status_pedido,
      CASE 
        WHEN c.nome IS NULL THEN 'Cliente Bryza'
        WHEN position(' ' in trim(c.nome)) > 0 THEN 
          split_part(trim(c.nome), ' ', 1) || ' ' || upper(left(split_part(trim(c.nome), ' ', 2), 1)) || '.'
        ELSE trim(c.nome)
      END AS nome_mascarado,
      comm.percentage_snapshot,
      comm.commission_amount,
      comm.status AS commission_status
    FROM public.pedidos ped
    LEFT JOIN public.clientes c ON c.id = ped.cliente_id
    LEFT JOIN public.commissions comm ON comm.order_id = ped.id AND comm.ambassador_id = v_amb_id
    WHERE ped.ambassador_id = v_amb_id
      AND (p_status_pedido IS NULL OR p_status_pedido = '' OR ped.status_pedido = p_status_pedido)
    ORDER BY ped.created_at DESC, ped.id DESC
    LIMIT p_limit OFFSET p_offset
  ) sub;

  RETURN jsonb_build_object(
    'items', COALESCE(v_items, '[]'::jsonb),
    'total', v_total
  );
END;
$$;

-- 8. RPC DE COMISSÕES COM PAGINAÇÃO
CREATE OR REPLACE FUNCTION public.fn_get_embaixador_comissoes(
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
  FROM public.commissions c
  WHERE c.ambassador_id = v_amb_id
    AND (p_status IS NULL OR p_status = '' OR c.status = p_status);

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', sub.id,
      'created_at', sub.created_at,
      'order_code', sub.codigo_pedido,
      'order_amount', sub.valor_total,
      'commission_percentage', sub.percentage_snapshot,
      'commission_amount', sub.commission_amount,
      'status', sub.status
    )
  )
  INTO v_items
  FROM (
    SELECT 
      c.id,
      c.created_at,
      ped.numero_pedido AS codigo_pedido,
      ped.valor_total,
      c.percentage_snapshot,
      c.commission_amount,
      c.status
    FROM public.commissions c
    JOIN public.pedidos ped ON ped.id = c.order_id
    WHERE c.ambassador_id = v_amb_id
      AND (p_status IS NULL OR p_status = '' OR c.status = p_status)
    ORDER BY c.created_at DESC, c.id DESC
    LIMIT p_limit OFFSET p_offset
  ) sub;

  RETURN jsonb_build_object(
    'items', COALESCE(v_items, '[]'::jsonb),
    'total', v_total
  );
END;
$$;

-- 9. RPC DE PAGAMENTOS E SAQUES COM PAGINAÇÃO
CREATE OR REPLACE FUNCTION public.fn_get_embaixador_pagamentos(
  p_limit INT DEFAULT 10,
  p_offset INT DEFAULT 0
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
  FROM public.commission_payments cp
  WHERE cp.ambassador_id = v_amb_id;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', sub.id,
      'created_at', sub.created_at,
      'amount', sub.amount,
      'payment_method', sub.payment_method,
      'notes', sub.notes,
      'has_receipt', (sub.receipt_path IS NOT NULL)
    )
  )
  INTO v_items
  FROM (
    SELECT 
      cp.id,
      cp.created_at,
      cp.amount,
      cp.payment_method,
      cp.notes,
      cp.receipt_path
    FROM public.commission_payments cp
    WHERE cp.ambassador_id = v_amb_id
    ORDER BY cp.created_at DESC, cp.id DESC
    LIMIT p_limit OFFSET p_offset
  ) sub;

  RETURN jsonb_build_object(
    'items', COALESCE(v_items, '[]'::jsonb),
    'total', v_total
  );
END;
$$;

-- 10. REVOGAÇÕES GRANULARES POR ASSINATURA COMPLETA E CONCESSÃO RESTRITA
REVOKE ALL ON FUNCTION public.fn_update_meu_perfil(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_get_embaixador_dashboard_metrics() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_get_embaixador_indicacoes(INT, INT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_get_embaixador_vendas(INT, INT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_get_embaixador_comissoes(INT, INT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_get_embaixador_pagamentos(INT, INT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.fn_update_meu_perfil(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_get_embaixador_dashboard_metrics() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_get_embaixador_indicacoes(INT, INT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_get_embaixador_vendas(INT, INT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_get_embaixador_comissoes(INT, INT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_get_embaixador_pagamentos(INT, INT) TO authenticated, service_role;
