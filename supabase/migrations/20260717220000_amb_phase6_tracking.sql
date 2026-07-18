-- Migration: 20260717220000_amb_phase6_tracking.sql
-- Description: Tracking de indicações, congelamento em pedidos, RPCs restritas e segurança anti-fraude.

BEGIN;

-- 1. Enum attribution_source_type
DO $$ BEGIN
  CREATE TYPE public.attribution_source_type AS ENUM ('smart_link', 'admin_manual', 'seller_manual', 'whatsapp', 'customer_registration');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Adaptar Tabela referral_visits (adicionando colunas necessárias de forma idempotente)
ALTER TABLE public.referral_visits
  ADD COLUMN IF NOT EXISTS origin VARCHAR(500),
  ADD COLUMN IF NOT EXISTS utms JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS device_summary VARCHAR(500),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE public.referral_visits SET created_at = visited_at WHERE created_at IS NULL AND visited_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_refvisits_amb_created ON public.referral_visits(ambassador_id, created_at);
CREATE INDEX IF NOT EXISTS idx_refvisits_sess_created ON public.referral_visits(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_refvisits_code_created ON public.referral_visits(referral_code, created_at);

ALTER TABLE public.referral_visits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.referral_visits FROM PUBLIC, anon, authenticated;

-- 3. Colunas na tabela pedidos
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS referral_visit_id UUID REFERENCES public.referral_visits(id),
  ADD COLUMN IF NOT EXISTS attributed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attribution_source public.attribution_source_type;

CREATE INDEX IF NOT EXISTS idx_pedidos_ambassador_id ON public.pedidos(ambassador_id);

-- 4. RPC pública para recuperar perfil restrito do embaixador pelo código
CREATE OR REPLACE FUNCTION public.fn_get_public_ambassador_by_code(p_code text)
RETURNS TABLE (
  display_name TEXT,
  referral_code TEXT,
  photo_path TEXT,
  city TEXT,
  instagram TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_normalized_code TEXT;
BEGIN
  v_normalized_code := lower(trim(p_code));
  IF v_normalized_code !~ '^bryza[0-9]+$' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT a.display_name, a.referral_code, a.photo_path, a.city, a.instagram
  FROM public.ambassadors a
  WHERE lower(a.referral_code) = v_normalized_code AND a.status = 'ativo'
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_get_public_ambassador_by_code(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_get_public_ambassador_by_code(text) TO anon, authenticated;

-- 5. Trigger de imutabilidade dos campos de atribuição em pedidos
CREATE OR REPLACE FUNCTION public.fn_trg_pedidos_atribuicao_imutavel()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.ambassador_id IS DISTINCT FROM OLD.ambassador_id OR
        NEW.referral_visit_id IS DISTINCT FROM OLD.referral_visit_id OR
        NEW.referral_code_snapshot IS DISTINCT FROM OLD.referral_code_snapshot OR
        NEW.attributed_at IS DISTINCT FROM OLD.attributed_at OR
        NEW.attribution_source IS DISTINCT FROM OLD.attribution_source) THEN

      IF OLD.status_pedido IN ('pago', 'entregue', 'finalizado', 'cancelado', 'estornado') THEN
        RAISE EXCEPTION 'Atribuição bloqueada: Pedido finalizado ou pago não pode ter sua indicação alterada.';
      END IF;

      IF current_setting('bryza.allow_reattribution', true) IS DISTINCT FROM 'true' THEN
        RAISE EXCEPTION 'Alteração de atribuição direta é proibida. Utilize exclusivamente a RPC fn_admin_reatribuir_pedido.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pedidos_atribuicao_imutavel ON public.pedidos;
CREATE TRIGGER trg_pedidos_atribuicao_imutavel
  BEFORE UPDATE ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.fn_trg_pedidos_atribuicao_imutavel();

-- 6. RPC administrativa para reatribuição com auditoria
CREATE OR REPLACE FUNCTION public.fn_admin_reatribuir_pedido(
  p_pedido_id UUID,
  p_novo_ambassador_id UUID,
  p_motivo TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pedido RECORD;
  v_novo_amb RECORD;
  v_actor_id UUID;
  v_actor_role TEXT;
BEGIN
  v_actor_id := auth.uid();
  v_actor_role := public.get_user_role();

  IF v_actor_id IS NULL OR v_actor_role != 'admin' THEN
    RAISE EXCEPTION 'Acesso negado: Requer privilégios de administrador.';
  END IF;

  IF p_motivo IS NULL OR char_length(trim(p_motivo)) < 5 THEN
    RAISE EXCEPTION 'Motivo obrigatório (mínimo 5 caracteres).';
  END IF;

  SELECT * INTO v_pedido FROM public.pedidos WHERE id = p_pedido_id;
  IF v_pedido.id IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  IF v_pedido.status_pedido IN ('pago', 'entregue', 'finalizado', 'cancelado', 'estornado') THEN
    RAISE EXCEPTION 'Não é permitido reatribuir pedidos pagos, entregues, finalizados ou cancelados.';
  END IF;

  SELECT * INTO v_novo_amb FROM public.ambassadors WHERE id = p_novo_ambassador_id AND status = 'ativo';
  IF v_novo_amb.id IS NULL THEN
    RAISE EXCEPTION 'Novo embaixador não encontrado ou inativo.';
  END IF;

  PERFORM set_config('bryza.allow_reattribution', 'true', true);

  UPDATE public.pedidos
  SET ambassador_id = v_novo_amb.id,
      referral_code_snapshot = v_novo_amb.referral_code,
      attributed_at = now(),
      attribution_source = 'admin_manual'
  WHERE id = p_pedido_id;

  INSERT INTO public.audit_logs (
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data,
    metadata
  )
  VALUES (
    v_actor_id,
    v_actor_role,
    'reatribuir_pedido_ambassador',
    'pedidos',
    p_pedido_id,
    jsonb_build_object('ambassador_id', v_pedido.ambassador_id, 'referral_code_snapshot', v_pedido.referral_code_snapshot),
    jsonb_build_object('ambassador_id', v_novo_amb.id, 'referral_code_snapshot', v_novo_amb.referral_code),
    jsonb_build_object('motivo', p_motivo)
  );

  RETURN jsonb_build_object('sucesso', true);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_reatribuir_pedido(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_admin_reatribuir_pedido(UUID, UUID, TEXT) TO authenticated;

-- 7. Trigger de validação de comissões (Integridade & Prevenção de Autoindicação)
CREATE OR REPLACE FUNCTION public.fn_trg_valida_comissao_pedido()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_pedido RECORD;
  v_ambassador RECORD;
  v_cliente RECORD;
  v_profile RECORD;
  v_amb_phone TEXT;
  v_cli_phone TEXT;
  v_amb_email TEXT;
  v_cli_email TEXT;
  v_amb_cpf TEXT;
  v_cli_cpf TEXT;
BEGIN
  SELECT * INTO v_pedido FROM public.pedidos WHERE id = NEW.order_id;
  IF v_pedido.id IS NULL THEN
    RAISE EXCEPTION 'Comissão rejeitada: Pedido inexistente.';
  END IF;

  IF v_pedido.ambassador_id IS NULL THEN
    RAISE EXCEPTION 'Comissão rejeitada: Pedido não possui embaixador atribuído.';
  END IF;

  IF NEW.ambassador_id != v_pedido.ambassador_id THEN
    RAISE EXCEPTION 'Fraude: Embaixador da comissão divergente do embaixador congelado no pedido.';
  END IF;

  IF v_pedido.status_pedido NOT IN ('pago', 'entregue', 'finalizado') OR
     v_pedido.status_pedido IN ('cancelado', 'estornado') THEN
    RAISE EXCEPTION 'Comissão rejeitada: Pedido em status inválido para liberação de comissão.';
  END IF;

  SELECT * INTO v_ambassador FROM public.ambassadors WHERE id = v_pedido.ambassador_id;
  SELECT * INTO v_cliente FROM public.clientes WHERE id = v_pedido.cliente_id;
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_pedido.cliente_id;

  v_amb_phone := regexp_replace(COALESCE(v_ambassador.phone, ''), '\D', '', 'g');
  v_cli_phone := regexp_replace(COALESCE(v_pedido.telefone_cliente, COALESCE(v_cliente.telefone, COALESCE(v_profile.telefone, ''))), '\D', '', 'g');

  v_amb_email := lower(trim(COALESCE(v_ambassador.email, '')));
  v_cli_email := lower(trim(COALESCE(v_profile.email, '')));

  v_amb_cpf := regexp_replace(COALESCE(v_ambassador.cpf, ''), '\D', '', 'g');
  v_cli_cpf := regexp_replace(COALESCE(v_profile.cpf, ''), '\D', '', 'g');

  IF (v_ambassador.user_id IS NOT NULL AND v_profile.id IS NOT NULL AND v_ambassador.user_id = v_profile.id) THEN
    RAISE EXCEPTION 'Comissão rejeitada: Autoindicação detectada por User ID (Profiles).';
  END IF;

  IF (v_amb_phone != '' AND v_cli_phone != '' AND v_amb_phone = v_cli_phone) THEN
    RAISE EXCEPTION 'Comissão rejeitada: Autoindicação detectada por Telefone.';
  END IF;

  IF (v_amb_cpf != '' AND v_cli_cpf != '' AND v_amb_cpf = v_cli_cpf) THEN
    RAISE EXCEPTION 'Comissão rejeitada: Autoindicação detectada por CPF.';
  END IF;

  IF (v_amb_email != '' AND v_cli_email != '' AND v_amb_email = v_cli_email) THEN
    RAISE EXCEPTION 'Comissão rejeitada: Autoindicação detectada por E-mail.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_valida_comissao_pedido ON public.commissions;
CREATE TRIGGER trg_valida_comissao_pedido
  BEFORE INSERT OR UPDATE ON public.commissions
  FOR EACH ROW EXECUTE FUNCTION public.fn_trg_valida_comissao_pedido();

-- 8. RPC de Criação Transacional do Pedido
CREATE OR REPLACE FUNCTION public.fn_criar_pedido_completo(
  p_cliente_data JSONB,
  p_itens_data JSONB,
  p_atribuicao JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ambassador_id UUID;
  v_referral_code TEXT;
  v_visit_id UUID;
  v_source public.attribution_source_type;
  v_cliente_id UUID;
  v_pedido_id UUID;
  v_numero_pedido TEXT;
  v_valor_total NUMERIC := 0;
  v_item JSONB;
  v_prod RECORD;
  v_cli_nome TEXT;
  v_cli_fone TEXT;
  v_cli_endereco TEXT;
  v_cli_bairro TEXT;
  v_cli_cidade TEXT;
  v_cli_estado TEXT;
  v_cli_cep TEXT;
  v_cli_complemento TEXT;
BEGIN
  v_referral_code := lower(trim(p_atribuicao->>'referral_code'));
  IF v_referral_code IS NOT NULL AND v_referral_code ~ '^bryza[0-9]+$' THEN
    SELECT id INTO v_ambassador_id
    FROM public.ambassadors
    WHERE lower(referral_code) = v_referral_code AND status = 'ativo';
  END IF;

  IF p_atribuicao->>'visit_id' IS NOT NULL AND p_atribuicao->>'visit_id' != '' THEN
    v_visit_id := (p_atribuicao->>'visit_id')::UUID;
  END IF;

  IF p_atribuicao->>'source' IS NOT NULL AND p_atribuicao->>'source' != '' THEN
    v_source := (p_atribuicao->>'source')::public.attribution_source_type;
  ELSE
    v_source := 'smart_link'::public.attribution_source_type;
  END IF;

  v_cli_nome := p_cliente_data->>'nome';
  v_cli_fone := p_cliente_data->>'telefone';
  v_cli_endereco := p_cliente_data->>'endereco';
  v_cli_bairro := p_cliente_data->>'bairro';
  v_cli_cidade := p_cliente_data->>'cidade';
  v_cli_estado := COALESCE(p_cliente_data->>'estado', 'SP');
  v_cli_cep := p_cliente_data->>'cep';
  v_cli_complemento := p_cliente_data->>'complemento';

  IF v_cli_nome IS NULL OR v_cli_fone IS NULL THEN
    RAISE EXCEPTION 'Nome e telefone do cliente são obrigatórios.';
  END IF;

  SELECT id INTO v_cliente_id FROM public.clientes WHERE telefone = v_cli_fone LIMIT 1;
  IF v_cliente_id IS NULL THEN
    INSERT INTO public.clientes (
      nome, telefone, endereco, bairro, cidade, estado, cep, origem,
      ambassador_id, referral_code, referral_source, referral_attributed_at
    ) VALUES (
      v_cli_nome, v_cli_fone, v_cli_endereco, v_cli_bairro, v_cli_cidade, v_cli_estado, v_cli_cep, COALESCE(p_cliente_data->>'origem', 'indicação'),
      v_ambassador_id, v_referral_code, v_source::TEXT, CASE WHEN v_ambassador_id IS NOT NULL THEN now() ELSE NULL END
    ) RETURNING id INTO v_cliente_id;
  ELSE
    IF v_ambassador_id IS NOT NULL THEN
      UPDATE public.clientes
      SET ambassador_id = COALESCE(ambassador_id, v_ambassador_id),
          referral_code = COALESCE(referral_code, v_referral_code),
          referral_source = COALESCE(referral_source, v_source::TEXT),
          referral_attributed_at = COALESCE(referral_attributed_at, now())
      WHERE id = v_cliente_id;
    END IF;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens_data) LOOP
    SELECT id, preco_venda, ativo INTO v_prod FROM public.produtos WHERE id = (v_item->>'produto_id')::UUID;
    IF v_prod.id IS NULL OR v_prod.ativo IS FALSE THEN
      RAISE EXCEPTION 'Produto indisponível ou inativo: %', v_item->>'produto_id';
    END IF;
    v_valor_total := v_valor_total + (v_prod.preco_venda * (v_item->>'quantidade')::INTEGER);
  END LOOP;

  v_numero_pedido := 'PED-' || floor(extract(epoch from now()))::text || '-' || floor(random() * 8999 + 1000)::text;

  INSERT INTO public.pedidos (
    numero_pedido, cliente_id, nome_cliente, telefone_cliente, endereco_entrega,
    bairro, cidade, estado, cep, complemento, valor_total, forma_pagamento, status_pedido,
    ambassador_id, referral_visit_id, referral_code_snapshot, attributed_at, attribution_source
  ) VALUES (
    v_numero_pedido, v_cliente_id, v_cli_nome, v_cli_fone, v_cli_endereco,
    v_cli_bairro, v_cli_cidade, v_cli_estado, v_cli_cep, v_cli_complemento, v_valor_total,
    COALESCE(p_cliente_data->>'forma_pagamento', 'dinheiro'), 'aguardando_preparacao',
    v_ambassador_id, v_visit_id, v_referral_code, CASE WHEN v_ambassador_id IS NOT NULL THEN now() ELSE NULL END, v_source
  ) RETURNING id INTO v_pedido_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens_data) LOOP
    SELECT id, preco_venda INTO v_prod FROM public.produtos WHERE id = (v_item->>'produto_id')::UUID;
    INSERT INTO public.pedido_itens (
      pedido_id, produto_id, quantidade, preco_unitario, subtotal
    ) VALUES (
      v_pedido_id, v_prod.id, (v_item->>'quantidade')::INTEGER, v_prod.preco_venda,
      (v_prod.preco_venda * (v_item->>'quantidade')::INTEGER)
    );
  END LOOP;

  RETURN jsonb_build_object(
    'sucesso', true,
    'pedido_id', v_pedido_id,
    'numero_pedido', v_numero_pedido,
    'valor_total', v_valor_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_criar_pedido_completo(JSONB, JSONB, JSONB)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.fn_criar_pedido_completo(JSONB, JSONB, JSONB)
TO service_role;

-- 9. RPC de Analytics Agregados para Embaixador
CREATE OR REPLACE FUNCTION public.fn_get_embaixador_tracking_metrics(p_dias integer DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_ambassador_id UUID;
  v_cliques_totais BIGINT;
  v_cliques_unicos BIGINT;
  v_pedidos_atribuidos BIGINT;
  v_inicio TIMESTAMPTZ;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Acesso negado: Usuário não autenticado.';
  END IF;

  SELECT id INTO v_ambassador_id FROM public.ambassadors WHERE user_id = v_user_id AND status = 'ativo';
  IF v_ambassador_id IS NULL THEN
    RAISE EXCEPTION 'Acesso negado: Perfil de embaixador ativo não encontrado.';
  END IF;

  v_inicio := now() - (p_dias || ' days')::INTERVAL;

  SELECT COUNT(*) INTO v_cliques_totais
  FROM public.referral_visits
  WHERE ambassador_id = v_ambassador_id AND (created_at >= v_inicio OR visited_at >= v_inicio);

  SELECT COUNT(DISTINCT session_id) INTO v_cliques_unicos
  FROM public.referral_visits
  WHERE ambassador_id = v_ambassador_id AND (created_at >= v_inicio OR visited_at >= v_inicio);

  SELECT COUNT(*) INTO v_pedidos_atribuidos
  FROM public.pedidos
  WHERE ambassador_id = v_ambassador_id AND created_at >= v_inicio;

  RETURN jsonb_build_object(
    'periodo_dias', p_dias,
    'cliques_totais', v_cliques_totais,
    'cliques_unicos', v_cliques_unicos,
    'pedidos_atribuidos', v_pedidos_atribuidos,
    'taxa_conversao', CASE WHEN v_cliques_unicos > 0 THEN round((v_pedidos_atribuidos::numeric / v_cliques_unicos::numeric) * 100, 2) ELSE 0 END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_get_embaixador_tracking_metrics(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_get_embaixador_tracking_metrics(INTEGER) TO authenticated;

COMMIT;
