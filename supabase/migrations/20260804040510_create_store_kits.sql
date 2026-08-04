-- Kits promocionais compostos da Loja.
-- O kit e uma linha comercial; o estoque continua sendo controlado somente por
-- agendamento_itens/pedido_itens/venda_itens (componentes reais).

BEGIN;

CREATE TABLE IF NOT EXISTS public.kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL CHECK (length(btrim(nome)) BETWEEN 1 AND 160),
  descricao text,
  preco_venda numeric(12,2) NOT NULL CHECK (preco_venda >= 0),
  preco_referencia numeric(12,2) CHECK (preco_referencia IS NULL OR preco_referencia >= 0),
  imagem_url text,
  ativo boolean NOT NULL DEFAULT true,
  ativo_loja boolean NOT NULL DEFAULT false,
  vigencia_inicio date,
  vigencia_fim date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kits_vigencia_check CHECK (
    vigencia_fim IS NULL OR vigencia_inicio IS NULL OR vigencia_fim >= vigencia_inicio
  )
);

CREATE TABLE IF NOT EXISTS public.kit_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id uuid NOT NULL REFERENCES public.kits(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
  quantidade integer NOT NULL CHECK (quantidade > 0 AND quantidade <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kit_itens_unique_product UNIQUE (kit_id, produto_id)
);

CREATE INDEX IF NOT EXISTS idx_kits_store_active
  ON public.kits (ativo_loja, ativo, vigencia_inicio, vigencia_fim);
CREATE INDEX IF NOT EXISTS idx_kit_itens_kit ON public.kit_itens (kit_id);
CREATE INDEX IF NOT EXISTS idx_kit_itens_product ON public.kit_itens (produto_id);

CREATE TABLE IF NOT EXISTS public.agendamento_kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id uuid NOT NULL REFERENCES public.agendamentos(id) ON DELETE CASCADE,
  kit_id uuid REFERENCES public.kits(id) ON DELETE SET NULL,
  nome_kit_snapshot text NOT NULL,
  descricao_kit_snapshot text,
  imagem_url_snapshot text,
  quantidade integer NOT NULL CHECK (quantidade > 0),
  preco_unitario numeric(12,2) NOT NULL CHECK (preco_unitario >= 0),
  preco_referencia numeric(12,2),
  subtotal numeric(12,2) NOT NULL CHECK (subtotal >= 0),
  desconto_aplicado numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pedido_kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  kit_id uuid REFERENCES public.kits(id) ON DELETE SET NULL,
  agendamento_kit_id uuid REFERENCES public.agendamento_kits(id) ON DELETE SET NULL,
  nome_kit_snapshot text NOT NULL,
  descricao_kit_snapshot text,
  imagem_url_snapshot text,
  quantidade integer NOT NULL CHECK (quantidade > 0),
  preco_unitario numeric(12,2) NOT NULL CHECK (preco_unitario >= 0),
  preco_referencia numeric(12,2),
  subtotal numeric(12,2) NOT NULL CHECK (subtotal >= 0),
  desconto_aplicado numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.venda_kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id uuid NOT NULL REFERENCES public.vendas(id) ON DELETE CASCADE,
  kit_id uuid REFERENCES public.kits(id) ON DELETE SET NULL,
  pedido_kit_id uuid REFERENCES public.pedido_kits(id) ON DELETE SET NULL,
  nome_kit_snapshot text NOT NULL,
  descricao_kit_snapshot text,
  imagem_url_snapshot text,
  quantidade integer NOT NULL CHECK (quantidade > 0),
  preco_unitario numeric(12,2) NOT NULL CHECK (preco_unitario >= 0),
  preco_referencia numeric(12,2),
  subtotal numeric(12,2) NOT NULL CHECK (subtotal >= 0),
  desconto_aplicado numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agendamento_itens
  ADD COLUMN IF NOT EXISTS kit_line_id uuid;
ALTER TABLE public.pedido_itens
  ADD COLUMN IF NOT EXISTS kit_line_id uuid;
ALTER TABLE public.venda_itens
  ADD COLUMN IF NOT EXISTS kit_line_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'agendamento_itens_kit_line_id_fkey'
      AND conrelid = 'public.agendamento_itens'::regclass
  ) THEN
    ALTER TABLE public.agendamento_itens
      ADD CONSTRAINT agendamento_itens_kit_line_id_fkey
      FOREIGN KEY (kit_line_id) REFERENCES public.agendamento_kits(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pedido_itens_kit_line_id_fkey'
      AND conrelid = 'public.pedido_itens'::regclass
  ) THEN
    ALTER TABLE public.pedido_itens
      ADD CONSTRAINT pedido_itens_kit_line_id_fkey
      FOREIGN KEY (kit_line_id) REFERENCES public.pedido_kits(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'venda_itens_kit_line_id_fkey'
      AND conrelid = 'public.venda_itens'::regclass
  ) THEN
    ALTER TABLE public.venda_itens
      ADD CONSTRAINT venda_itens_kit_line_id_fkey
      FOREIGN KEY (kit_line_id) REFERENCES public.venda_kits(id) ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_agendamento_kits_schedule
  ON public.agendamento_kits (agendamento_id, created_at, id);
CREATE INDEX IF NOT EXISTS idx_pedido_kits_order
  ON public.pedido_kits (pedido_id, created_at, id);
CREATE INDEX IF NOT EXISTS idx_venda_kits_sale
  ON public.venda_kits (venda_id, created_at, id);
CREATE INDEX IF NOT EXISTS idx_agendamento_items_kit_line
  ON public.agendamento_itens (kit_line_id) WHERE kit_line_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pedido_items_kit_line
  ON public.pedido_itens (kit_line_id) WHERE kit_line_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_venda_items_kit_line
  ON public.venda_itens (kit_line_id) WHERE kit_line_id IS NOT NULL;

ALTER TABLE public.kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kit_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendamento_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venda_kits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS kits_store_read ON public.kits;
CREATE POLICY kits_store_read ON public.kits
  FOR SELECT TO anon, authenticated
  USING (
    ativo IS TRUE
    AND ativo_loja IS TRUE
    AND (vigencia_inicio IS NULL OR vigencia_inicio <= current_date)
    AND (vigencia_fim IS NULL OR vigencia_fim >= current_date)
  );

DROP POLICY IF EXISTS kits_admin_all ON public.kits;
CREATE POLICY kits_admin_all ON public.kits
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS kit_items_store_read ON public.kit_itens;
CREATE POLICY kit_items_store_read ON public.kit_itens
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.kits k
      WHERE k.id = kit_itens.kit_id
        AND k.ativo IS TRUE
        AND k.ativo_loja IS TRUE
        AND (k.vigencia_inicio IS NULL OR k.vigencia_inicio <= current_date)
        AND (k.vigencia_fim IS NULL OR k.vigencia_fim >= current_date)
    )
  );

DROP POLICY IF EXISTS kit_items_admin_all ON public.kit_itens;
CREATE POLICY kit_items_admin_all ON public.kit_itens
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS agendamento_kits_staff_read ON public.agendamento_kits;
CREATE POLICY agendamento_kits_staff_read ON public.agendamento_kits
  FOR SELECT TO authenticated
  USING (
    public.get_user_role() IN ('admin', 'vendedor', 'logistica')
    AND (
      public.get_user_role() IN ('admin', 'logistica')
      OR EXISTS (
        SELECT 1 FROM public.agendamentos a
        WHERE a.id = agendamento_kits.agendamento_id
          AND a.vendedor_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS pedido_kits_staff_read ON public.pedido_kits;
CREATE POLICY pedido_kits_staff_read ON public.pedido_kits
  FOR SELECT TO authenticated
  USING (
    public.get_user_role() IN ('admin', 'logistica')
    OR (
      public.get_user_role() = 'vendedor'
      AND EXISTS (
        SELECT 1 FROM public.pedidos p
        WHERE p.id = pedido_kits.pedido_id
          AND p.vendedor_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS venda_kits_staff_read ON public.venda_kits;
CREATE POLICY venda_kits_staff_read ON public.venda_kits
  FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'admin'
    OR (
      public.get_user_role() IN ('vendedor', 'logistica')
      AND EXISTS (
        SELECT 1 FROM public.vendas v
        WHERE v.id = venda_kits.venda_id
          AND (public.get_user_role() = 'logistica' OR v.vendedor_id = auth.uid())
      )
    )
  );

GRANT SELECT ON public.kits, public.kit_itens TO anon, authenticated;
GRANT SELECT ON public.agendamento_kits, public.pedido_kits, public.venda_kits TO authenticated;
GRANT ALL ON public.kits, public.kit_itens,
  public.agendamento_kits, public.pedido_kits, public.venda_kits TO service_role;

-- Valida todos os componentes de um agendamento em ordem deterministica. O
-- FOR UPDATE serializa duas conversoes concorrentes que compartilham produto.
CREATE OR REPLACE FUNCTION public.fn_validate_agendamento_component_stock(
  p_agendamento_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_need record;
  v_product public.produtos%ROWTYPE;
  v_available numeric;
BEGIN
  IF p_agendamento_id IS NULL THEN
    RAISE EXCEPTION 'agendamento_id_required' USING ERRCODE = '22023';
  END IF;

  FOR v_need IN
    SELECT ai.produto_id, sum(ai.quantidade)::numeric AS quantidade
    FROM public.agendamento_itens ai
    WHERE ai.agendamento_id = p_agendamento_id
    GROUP BY ai.produto_id
    ORDER BY ai.produto_id
  LOOP
    SELECT * INTO v_product
    FROM public.produtos
    WHERE id = v_need.produto_id
    FOR UPDATE;

    IF v_product.id IS NULL THEN
      RAISE EXCEPTION 'product_not_found:%', v_need.produto_id USING ERRCODE = '23503';
    END IF;

    v_available := COALESCE(v_product.estoque_atual, 0)
      - GREATEST(COALESCE(v_product.estoque_reservado, 0), 0);

    IF v_available < v_need.quantidade THEN
      RAISE EXCEPTION 'stock_unavailable:%:%:%',
        v_need.produto_id, v_need.quantidade, v_available
        USING ERRCODE = '55P03';
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_validate_agendamento_component_stock(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_validate_agendamento_component_stock(uuid)
  TO service_role;

-- Checkout da /loja. O cliente envia apenas referencias de produto/kit e
-- quantidades; preco, vigencia e composicao sempre vem do banco.
CREATE OR REPLACE FUNCTION public.fn_create_store_agendamento_with_kits(
  p_agendamento_data jsonb,
  p_items_data jsonb,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing public.agendamentos%ROWTYPE;
  v_schedule_id uuid;
  v_schedule_number text;
  v_customer_id uuid;
  v_item jsonb;
  v_product public.produtos%ROWTYPE;
  v_kit public.kits%ROWTYPE;
  v_component record;
  v_kit_line_id uuid;
  v_qty integer;
  v_total numeric(12,2) := 0;
  v_kit_gross numeric(12,2) := 0;
  v_kit_subtotal numeric(12,2);
  v_component_gross numeric(12,2);
  v_component_net numeric(12,2);
  v_component_discount numeric(12,2);
  v_allocated_net numeric(12,2);
  v_component_index integer;
  v_component_count integer;
  v_date timestamptz;
  v_payment text;
  v_name text;
  v_phone text;
  v_address text;
  v_neighborhood text;
  v_city text;
  v_state text;
  v_cep text;
BEGIN
  IF coalesce(auth.jwt()->>'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501';
  END IF;
  IF p_idempotency_key IS NULL
     OR jsonb_typeof(p_agendamento_data) <> 'object'
     OR jsonb_typeof(p_items_data) <> 'array'
     OR jsonb_array_length(p_items_data) < 1
     OR jsonb_array_length(p_items_data) > 50 THEN
    RAISE EXCEPTION 'invalid_store_checkout_payload' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_existing
  FROM public.agendamentos
  WHERE submission_id = p_idempotency_key
  FOR UPDATE;
  IF v_existing.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'sucesso', true, 'idempotente', true,
      'agendamento_id', v_existing.id,
      'numero_agendamento', v_existing.numero_agendamento,
      'valor_total', v_existing.valor_total
    );
  END IF;

  BEGIN
    v_customer_id := (p_agendamento_data->>'cliente_id')::uuid;
    v_date := (p_agendamento_data->>'data_agendamento')::timestamptz;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'invalid_store_checkout_identity' USING ERRCODE = '22023';
  END;
  IF v_customer_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.clientes WHERE id = v_customer_id
  ) THEN
    RAISE EXCEPTION 'customer_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_date IS NULL OR v_date < now() + interval '30 minutes'
     OR v_date > now() + interval '180 days' THEN
    RAISE EXCEPTION 'scheduling_date_out_of_range' USING ERRCODE = '22023';
  END IF;

  v_payment := lower(btrim(coalesce(p_agendamento_data->>'forma_pagamento', '')));
  IF v_payment NOT IN ('dinheiro', 'pix', 'cartao') THEN
    RAISE EXCEPTION 'invalid_payment_method' USING ERRCODE = '22023';
  END IF;
  v_name := btrim(coalesce(p_agendamento_data->>'nome_cliente', ''));
  v_phone := btrim(coalesce(p_agendamento_data->>'telefone_cliente', ''));
  v_address := btrim(coalesce(p_agendamento_data->>'endereco_entrega', ''));
  v_neighborhood := btrim(coalesce(p_agendamento_data->>'bairro', ''));
  v_city := btrim(coalesce(p_agendamento_data->>'cidade', ''));
  v_state := upper(btrim(coalesce(p_agendamento_data->>'estado', '')));
  v_cep := btrim(coalesce(p_agendamento_data->>'cep', ''));
  IF length(v_name) < 3 OR length(v_phone) < 10 OR v_address = ''
     OR v_neighborhood = '' OR v_city = '' OR v_state !~ '^[A-Z]{2}$' THEN
    RAISE EXCEPTION 'invalid_store_customer_data' USING ERRCODE = '22023';
  END IF;

  -- Primeira passagem valida referencias e trava preco/composicao ate o fim
  -- da transacao. Nenhuma informacao comercial do navegador e considerada.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items_data)
  LOOP
    IF ((v_item ? 'produto_id') AND (v_item ? 'kit_id'))
       OR NOT ((v_item ? 'produto_id') OR (v_item ? 'kit_id')) THEN
      RAISE EXCEPTION 'store_item_must_reference_one_entity' USING ERRCODE = '22023';
    END IF;
    BEGIN
      v_qty := (v_item->>'quantidade')::integer;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'invalid_item_quantity' USING ERRCODE = '22023';
    END;
    IF v_qty < 1 OR v_qty > 100 THEN
      RAISE EXCEPTION 'invalid_item_quantity' USING ERRCODE = '22023';
    END IF;

    IF v_item ? 'produto_id' THEN
      SELECT * INTO v_product
      FROM public.produtos
      WHERE id = (v_item->>'produto_id')::uuid
        AND ativo IS TRUE
        AND ativo_loja IS DISTINCT FROM false
      FOR SHARE;
      IF v_product.id IS NULL THEN
        RAISE EXCEPTION 'product_unavailable' USING ERRCODE = 'P0001';
      END IF;
      v_total := v_total + round(v_product.preco_venda * v_qty, 2);
    ELSE
      SELECT * INTO v_kit
      FROM public.kits
      WHERE id = (v_item->>'kit_id')::uuid
        AND ativo IS TRUE
        AND ativo_loja IS TRUE
        AND (vigencia_inicio IS NULL OR vigencia_inicio <= current_date)
        AND (vigencia_fim IS NULL OR vigencia_fim >= current_date)
      FOR UPDATE;
      IF v_kit.id IS NULL THEN
        RAISE EXCEPTION 'kit_unavailable' USING ERRCODE = 'P0001';
      END IF;

      v_kit_gross := 0;
      v_component_count := 0;
      FOR v_component IN
        SELECT ki.id AS kit_item_id, ki.quantidade AS component_quantity,
               p.id AS produto_id, p.preco_venda, p.ativo
        FROM public.kit_itens ki
        JOIN public.produtos p ON p.id = ki.produto_id
        WHERE ki.kit_id = v_kit.id
        ORDER BY ki.id
        FOR SHARE
      LOOP
        IF v_component.ativo IS NOT TRUE THEN
          RAISE EXCEPTION 'kit_component_unavailable' USING ERRCODE = 'P0001';
        END IF;
        v_component_count := v_component_count + 1;
        v_kit_gross := v_kit_gross
          + round(v_component.preco_venda * v_component.component_quantity * v_qty, 2);
      END LOOP;
      IF v_component_count = 0 THEN
        RAISE EXCEPTION 'kit_without_components' USING ERRCODE = 'P0001';
      END IF;
      v_total := v_total + round(v_kit.preco_venda * v_qty, 2);
    END IF;
  END LOOP;

  INSERT INTO public.agendamentos (
    submission_id, data_agendamento, status, cliente_id, vendedor_id,
    valor_total, desconto_tipo, desconto_valor, desconto_aplicado,
    forma_pagamento, observacoes, nome_cliente, telefone_cliente,
    endereco_entrega, bairro, cidade, estado, cep, attribution_source
  ) VALUES (
    p_idempotency_key, v_date, 'agendado', v_customer_id,
    NULLIF(p_agendamento_data->>'vendedor_id', '')::uuid,
    v_total, 'none', 0, 0, v_payment,
    NULLIF(p_agendamento_data->>'observacoes', ''), v_name, v_phone,
    v_address, v_neighborhood, v_city, v_state, NULLIF(v_cep, ''), NULL
  )
  RETURNING id, numero_agendamento INTO v_schedule_id, v_schedule_number;

  -- Segunda passagem grava snapshots e componentes comerciais. O ultimo
  -- componente recebe o residuo de arredondamento para o total fechar centavo.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items_data)
  LOOP
    v_qty := (v_item->>'quantidade')::integer;
    IF v_item ? 'produto_id' THEN
      SELECT * INTO v_product FROM public.produtos
      WHERE id = (v_item->>'produto_id')::uuid;
      INSERT INTO public.agendamento_itens (
        agendamento_id, produto_id, quantidade, preco_unitario, subtotal,
        desconto_tipo, desconto_valor, desconto_aplicado, kit_line_id
      ) VALUES (
        v_schedule_id, v_product.id, v_qty, v_product.preco_venda,
        round(v_product.preco_venda * v_qty, 2), 'none', 0, 0, NULL
      );
    ELSE
      SELECT * INTO v_kit FROM public.kits WHERE id = (v_item->>'kit_id')::uuid;
      v_kit_subtotal := round(v_kit.preco_venda * v_qty, 2);
      v_kit_gross := 0;
      v_component_count := 0;
      FOR v_component IN
        SELECT ki.id AS kit_item_id, ki.quantidade AS component_quantity,
               p.id AS produto_id, p.preco_venda
        FROM public.kit_itens ki
        JOIN public.produtos p ON p.id = ki.produto_id
        WHERE ki.kit_id = v_kit.id
        ORDER BY ki.id
      LOOP
        v_component_count := v_component_count + 1;
        v_kit_gross := v_kit_gross
          + round(v_component.preco_venda * v_component.component_quantity * v_qty, 2);
      END LOOP;

      INSERT INTO public.agendamento_kits (
        agendamento_id, kit_id, nome_kit_snapshot, descricao_kit_snapshot,
        imagem_url_snapshot, quantidade, preco_unitario, preco_referencia,
        subtotal, desconto_aplicado
      ) VALUES (
        v_schedule_id, v_kit.id, v_kit.nome, v_kit.descricao, v_kit.imagem_url,
        v_qty, v_kit.preco_venda, v_kit.preco_referencia, v_kit_subtotal,
        round(v_kit_gross - v_kit_subtotal, 2)
      ) RETURNING id INTO v_kit_line_id;

      v_component_index := 0;
      v_allocated_net := 0;
      FOR v_component IN
        SELECT ki.id AS kit_item_id, ki.quantidade AS component_quantity,
               p.id AS produto_id, p.preco_venda
        FROM public.kit_itens ki
        JOIN public.produtos p ON p.id = ki.produto_id
        WHERE ki.kit_id = v_kit.id
        ORDER BY ki.id
      LOOP
        v_component_index := v_component_index + 1;
        v_component_gross := round(
          v_component.preco_venda * v_component.component_quantity * v_qty, 2
        );
        IF v_component_index = v_component_count THEN
          v_component_net := round(v_kit_subtotal - v_allocated_net, 2);
        ELSIF v_kit_gross = 0 THEN
          v_component_net := 0;
        ELSE
          v_component_net := round(v_component_gross * v_kit_subtotal / v_kit_gross, 2);
        END IF;
        v_component_discount := round(v_component_gross - v_component_net, 2);
        v_allocated_net := v_allocated_net + v_component_net;

        INSERT INTO public.agendamento_itens (
          agendamento_id, produto_id, quantidade, preco_unitario, subtotal,
          desconto_tipo, desconto_valor, desconto_aplicado, kit_line_id
        ) VALUES (
          v_schedule_id, v_component.produto_id,
          v_component.component_quantity * v_qty,
          v_component.preco_venda, v_component_net, 'fixed',
          v_component_discount, v_component_discount, v_kit_line_id
        );
      END LOOP;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'sucesso', true, 'idempotente', false,
    'agendamento_id', v_schedule_id,
    'numero_agendamento', v_schedule_number,
    'valor_total', v_total
  );
EXCEPTION WHEN unique_violation THEN
  SELECT * INTO v_existing
  FROM public.agendamentos
  WHERE submission_id = p_idempotency_key;
  IF v_existing.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'sucesso', true, 'idempotente', true,
      'agendamento_id', v_existing.id,
      'numero_agendamento', v_existing.numero_agendamento,
      'valor_total', v_existing.valor_total
    );
  END IF;
  RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_create_store_agendamento_with_kits(jsonb, jsonb, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_create_store_agendamento_with_kits(jsonb, jsonb, uuid)
  TO service_role;

-- Conversao atomica usada tanto pelo operador quanto pela aprovacao do
-- Mercado Pago. O pedido so nasce depois do lock/validacao dos componentes.
CREATE OR REPLACE FUNCTION public.fn_convert_agendamento_to_order_internal(
  p_agendamento_id uuid,
  p_payment_timing text DEFAULT NULL,
  p_payment_status text DEFAULT NULL,
  p_payment_source text DEFAULT NULL,
  p_paid_at timestamptz DEFAULT NULL,
  p_amount_received numeric DEFAULT NULL,
  p_payment_method text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_actor_role text;
  v_ag public.agendamentos%ROWTYPE;
  v_schedule_kit public.agendamento_kits%ROWTYPE;
  v_order_id uuid;
  v_order_number text;
  v_order_kit_id uuid;
  v_forma_pagamento text;
  v_payment_timing text;
  v_payment_status text;
  v_payment_source text;
  v_paid_at timestamptz;
  v_amount_received numeric(12,2);
BEGIN
  IF coalesce(auth.jwt()->>'role', '') = 'service_role' THEN
    v_actor_role := 'service_role';
  ELSE
    IF v_actor_id IS NULL THEN
      RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = '42501';
    END IF;
    v_actor_role := public.get_user_role()::text;
    IF v_actor_role NOT IN ('admin', 'vendedor') THEN
      RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT * INTO v_ag
  FROM public.agendamentos
  WHERE id = p_agendamento_id
  FOR UPDATE;
  IF v_ag.id IS NULL THEN
    RAISE EXCEPTION 'Agendamento nao encontrado.' USING ERRCODE = 'P0002';
  END IF;

  IF v_ag.status = 'convertido' AND v_ag.pedido_id IS NOT NULL THEN
    SELECT numero_pedido INTO v_order_number
    FROM public.pedidos WHERE id = v_ag.pedido_id;
    RETURN jsonb_build_object(
      'sucesso', true, 'idempotente', true,
      'pedido_id', v_ag.pedido_id, 'numero_pedido', v_order_number
    );
  END IF;
  IF v_ag.status <> 'agendado' THEN
    RAISE EXCEPTION 'Agendamento nao pode ser convertido neste estado.' USING ERRCODE = 'P0001';
  END IF;
  IF v_actor_role = 'vendedor'
     AND v_ag.vendedor_id IS DISTINCT FROM v_actor_id THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = '42501';
  END IF;

  PERFORM public.fn_validate_agendamento_component_stock(v_ag.id);

  v_forma_pagamento := coalesce(nullif(p_payment_method, ''), v_ag.forma_pagamento);
  v_payment_timing := coalesce(nullif(p_payment_timing, ''), v_ag.payment_timing, 'na_entrega');
  v_payment_status := coalesce(nullif(p_payment_status, ''), v_ag.payment_status, 'pendente');
  v_payment_source := coalesce(nullif(p_payment_source, ''), v_ag.payment_source, 'entrega');
  v_paid_at := coalesce(p_paid_at, v_ag.paid_at);
  v_amount_received := coalesce(
    p_amount_received,
    CASE WHEN v_payment_status = 'aprovado' THEN v_ag.valor_total ELSE NULL END
  );

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
    v_ag.desconto_valor, v_ag.desconto_aplicado, v_forma_pagamento,
    v_ag.observacoes, v_ag.nome_cliente, v_ag.telefone_cliente,
    v_ag.endereco_entrega, v_ag.bairro, v_ag.cidade, v_ag.estado, v_ag.cep,
    v_ag.nome_vendedor, v_ag.codigo_vendedor, 'aguardando_preparacao',
    v_ag.ambassador_id, v_ag.referral_visit_id, v_ag.referral_code_snapshot,
    v_ag.attributed_at, v_ag.attribution_source, v_ag.commission_plan_id_snapshot,
    v_ag.commission_percentage_snapshot, v_ag.commissionable_amount_snapshot,
    v_ag.commission_amount_snapshot, v_ag.referral_assignment_id,
    v_ag.referral_validated_snapshot, v_ag.referral_commissionable_snapshot,
    v_ag.ambassador_qualified_snapshot, v_ag.ambassador_qualification_id_snapshot,
    v_payment_timing, v_payment_status, v_payment_source, v_paid_at,
    v_amount_received
  )
  RETURNING id, numero_pedido INTO v_order_id, v_order_number;

  FOR v_schedule_kit IN
    SELECT * FROM public.agendamento_kits
    WHERE agendamento_id = v_ag.id
    ORDER BY created_at, id
  LOOP
    INSERT INTO public.pedido_kits (
      pedido_id, kit_id, agendamento_kit_id, nome_kit_snapshot,
      descricao_kit_snapshot, imagem_url_snapshot, quantidade,
      preco_unitario, preco_referencia, subtotal, desconto_aplicado
    ) VALUES (
      v_order_id, v_schedule_kit.kit_id, v_schedule_kit.id,
      v_schedule_kit.nome_kit_snapshot, v_schedule_kit.descricao_kit_snapshot,
      v_schedule_kit.imagem_url_snapshot, v_schedule_kit.quantidade,
      v_schedule_kit.preco_unitario, v_schedule_kit.preco_referencia,
      v_schedule_kit.subtotal, v_schedule_kit.desconto_aplicado
    ) RETURNING id INTO v_order_kit_id;

    INSERT INTO public.pedido_itens (
      pedido_id, produto_id, quantidade, preco_unitario, subtotal,
      desconto_tipo, desconto_valor, desconto_aplicado, kit_line_id
    )
    SELECT v_order_id, produto_id, quantidade, preco_unitario, subtotal,
      desconto_tipo, desconto_valor, desconto_aplicado, v_order_kit_id
    FROM public.agendamento_itens
    WHERE agendamento_id = v_ag.id
      AND kit_line_id = v_schedule_kit.id;
  END LOOP;

  INSERT INTO public.pedido_itens (
    pedido_id, produto_id, quantidade, preco_unitario, subtotal,
    desconto_tipo, desconto_valor, desconto_aplicado, kit_line_id
  )
  SELECT v_order_id, produto_id, quantidade, preco_unitario, subtotal,
    desconto_tipo, desconto_valor, desconto_aplicado, NULL
  FROM public.agendamento_itens
  WHERE agendamento_id = v_ag.id
    AND kit_line_id IS NULL;

  UPDATE public.agendamentos
  SET status = 'convertido', pedido_id = v_order_id, updated_at = now()
  WHERE id = v_ag.id;

  UPDATE public.payment_intents
  SET pedido_id = v_order_id
  WHERE agendamento_id = v_ag.id;

  UPDATE public.referral_attributions
  SET status = 'convertido', converted_at = coalesce(converted_at, now())
  WHERE customer_id = v_ag.cliente_id
    AND ambassador_id = v_ag.ambassador_id
    AND status = 'atribuido';

  IF v_actor_id IS NOT NULL THEN
    INSERT INTO public.audit_logs (
      actor_id, actor_role, action, entity_type, entity_id, metadata
    ) VALUES (
      v_actor_id, v_actor_role, 'schedule_converted_to_order', 'pedidos', v_order_id,
      jsonb_build_object('agendamento_id', v_ag.id, 'kit_count', (
        SELECT count(*) FROM public.pedido_kits WHERE pedido_id = v_order_id
      ))
    );
  END IF;

  RETURN jsonb_build_object(
    'sucesso', true, 'idempotente', false,
    'pedido_id', v_order_id, 'numero_pedido', v_order_number
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_convert_agendamento_to_order_internal(
  uuid, text, text, text, timestamptz, numeric, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_convert_agendamento_to_order_internal(
  uuid, text, text, text, timestamptz, numeric, text
) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_converter_agendamento_em_pedido(
  p_agendamento_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = '42501';
  END IF;
  v_role := public.get_user_role()::text;
  IF v_role NOT IN ('admin', 'vendedor') THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = '42501';
  END IF;
  RETURN public.fn_convert_agendamento_to_order_internal(p_agendamento_id);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_converter_agendamento_em_pedido(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_converter_agendamento_em_pedido(uuid)
  TO authenticated, service_role;

-- Reserva por linha continua sendo a fonte de verdade, mas UPDATE agora
-- tambem trata corretamente a troca do produto da linha.
CREATE OR REPLACE FUNCTION public.fn_gerenciar_reserva_estoque()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.produtos
    SET estoque_reservado = COALESCE(estoque_reservado, 0) + NEW.quantidade
    WHERE id = NEW.produto_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.produtos
    SET estoque_reservado = GREATEST(0, COALESCE(estoque_reservado, 0) - OLD.quantidade)
    WHERE id = OLD.produto_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.produto_id IS DISTINCT FROM NEW.produto_id THEN
      UPDATE public.produtos
      SET estoque_reservado = GREATEST(0, COALESCE(estoque_reservado, 0) - OLD.quantidade)
      WHERE id = OLD.produto_id;
      UPDATE public.produtos
      SET estoque_reservado = COALESCE(estoque_reservado, 0) + NEW.quantidade
      WHERE id = NEW.produto_id;
    ELSE
      UPDATE public.produtos
      SET estoque_reservado = GREATEST(
        0, COALESCE(estoque_reservado, 0) - OLD.quantidade + NEW.quantidade
      )
      WHERE id = NEW.produto_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_gerenciar_reserva_estoque ON public.pedido_itens;
CREATE TRIGGER trg_gerenciar_reserva_estoque
AFTER INSERT OR UPDATE OR DELETE ON public.pedido_itens
FOR EACH ROW EXECUTE FUNCTION public.fn_gerenciar_reserva_estoque();

-- Baixa fisica somente na finalizacao. A quantidade e agregada por produto,
-- por isso um produto direto junto com um kit nunca perde/limpa reserva duas
-- vezes de forma nao deterministica.
CREATE OR REPLACE FUNCTION public.fn_confirmar_baixa_estoque_pedido()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_vendedor_id uuid;
  v_ecommerce_seller_id uuid := 'e0000000-0000-0000-0000-000000000001'::uuid;
BEGIN
  v_vendedor_id := coalesce(NEW.vendedor_id, v_ecommerce_seller_id);

  IF NEW.status_pedido = 'finalizado'
     AND (TG_OP = 'INSERT' OR OLD.status_pedido <> 'finalizado') THEN
    WITH quantities AS (
      SELECT produto_id, sum(quantidade)::integer AS quantidade
      FROM public.pedido_itens
      WHERE pedido_id = NEW.id
      GROUP BY produto_id
    )
    UPDATE public.produtos p
    SET estoque_atual = p.estoque_atual - q.quantidade,
        estoque_reservado = GREATEST(0, COALESCE(p.estoque_reservado, 0) - q.quantidade)
    FROM quantities q
    WHERE p.id = q.produto_id;

    INSERT INTO public.estoque_movimentacao (
      produto_id, usuario_id, tipo_movimento, quantidade, origem,
      referencia_id, observacoes, data_movimento
    )
    SELECT pi.produto_id, v_vendedor_id, 'saida', pi.quantidade, 'venda',
      NEW.id,
      'Venda originada do pedido ' || COALESCE(NEW.numero_pedido, '') ||
      CASE WHEN pk.id IS NOT NULL THEN ' (Kit: ' || pk.nome_kit_snapshot || ')' ELSE '' END,
      COALESCE(NEW.finalized_at, NEW.updated_at, now())
    FROM public.pedido_itens pi
    LEFT JOIN public.pedido_kits pk ON pk.id = pi.kit_line_id
    WHERE pi.pedido_id = NEW.id
    ON CONFLICT DO NOTHING;

    INSERT INTO public.vendas (
      id, cliente_id, vendedor_id, valor_total, forma_pagamento,
      status_venda, data_venda
    ) VALUES (
      NEW.id, NEW.cliente_id, v_vendedor_id, NEW.valor_total,
      NEW.forma_pagamento, 'finalizado', now()
    )
    ON CONFLICT (id) DO UPDATE
      SET vendedor_id = EXCLUDED.vendedor_id,
          status_venda = EXCLUDED.status_venda;

    INSERT INTO public.venda_kits (
      venda_id, kit_id, pedido_kit_id, nome_kit_snapshot,
      descricao_kit_snapshot, imagem_url_snapshot, quantidade,
      preco_unitario, preco_referencia, subtotal, desconto_aplicado
    )
    SELECT NEW.id, pk.kit_id, pk.id, pk.nome_kit_snapshot,
      pk.descricao_kit_snapshot, pk.imagem_url_snapshot, pk.quantidade,
      pk.preco_unitario, pk.preco_referencia, pk.subtotal, pk.desconto_aplicado
    FROM public.pedido_kits pk
    WHERE pk.pedido_id = NEW.id
    ON CONFLICT DO NOTHING;

    INSERT INTO public.venda_itens (
      venda_id, produto_id, quantidade, preco_unitario, subtotal, kit_line_id
    )
    SELECT pi.pedido_id, pi.produto_id, pi.quantidade, pi.preco_unitario,
      pi.subtotal, vk.id
    FROM public.pedido_itens pi
    LEFT JOIN public.venda_kits vk
      ON vk.venda_id = pi.pedido_id
     AND vk.pedido_kit_id = pi.kit_line_id
    WHERE pi.pedido_id = NEW.id
    ON CONFLICT DO NOTHING;

    IF NEW.cliente_id IS NOT NULL THEN
      UPDATE public.clientes
      SET total_compras = (
            SELECT COUNT(*) FROM public.pedidos
            WHERE cliente_id = NEW.cliente_id AND status_pedido = 'finalizado'
          ),
          valor_total_gasto = (
            SELECT COALESCE(SUM(valor_total), 0) FROM public.pedidos
            WHERE cliente_id = NEW.cliente_id AND status_pedido = 'finalizado'
          ),
          ticket_medio = (
            SELECT ROUND(COALESCE(AVG(valor_total), 0), 2) FROM public.pedidos
            WHERE cliente_id = NEW.cliente_id AND status_pedido = 'finalizado'
          ),
          data_ultima_compra = (
            SELECT MAX(created_at) FROM public.pedidos
            WHERE cliente_id = NEW.cliente_id AND status_pedido = 'finalizado'
          ),
          dias_sem_comprar = 0,
          status_cliente = CASE
            WHEN status_cliente IN ('lead', 'inativo') THEN 'cliente'::status_cliente
            ELSE status_cliente
          END
      WHERE id = NEW.cliente_id;
    END IF;

  ELSIF NEW.status_pedido = 'cancelado'
        AND TG_OP = 'UPDATE'
        AND OLD.status_pedido <> 'cancelado'
        AND OLD.status_pedido <> 'finalizado' THEN
    WITH quantities AS (
      SELECT produto_id, sum(quantidade)::integer AS quantidade
      FROM public.pedido_itens
      WHERE pedido_id = NEW.id
      GROUP BY produto_id
    )
    UPDATE public.produtos p
    SET estoque_reservado = GREATEST(0, COALESCE(p.estoque_reservado, 0) - q.quantidade)
    FROM quantities q
    WHERE p.id = q.produto_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_confirmar_baixa_estoque_pedido ON public.pedidos;
CREATE TRIGGER trg_confirmar_baixa_estoque_pedido
AFTER INSERT OR UPDATE ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.fn_confirmar_baixa_estoque_pedido();

-- Reconcile do Mercado Pago tambem usa a conversao atomica. Isso evita que
-- pagamentos aprovados criem pedido_itens sem pedido_kits ou sem validar o
-- estoque compartilhado.
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
  v_reason text;
  v_conversion jsonb;
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
  IF v_currency <> v_intent.currency
     OR abs(v_amount - v_intent.expected_amount) > 0.01 THEN
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
  ) ON CONFLICT DO NOTHING;

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

  IF v_intent.status IN ('reembolsado', 'chargeback') THEN
    v_status := v_intent.status;
  ELSIF v_intent.status = 'aprovado'
        AND v_status NOT IN ('reembolsado', 'chargeback') THEN
    v_status := 'aprovado';
  END IF;

  UPDATE public.payment_intents
  SET status = v_status,
      approved_at = CASE
        WHEN v_status = 'aprovado' THEN coalesce(approved_at, v_attempt.approved_at, now())
        ELSE approved_at
      END,
      refunded_at = CASE
        WHEN v_status IN ('reembolsado', 'chargeback') THEN coalesce(refunded_at, now())
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
        v_conversion := public.fn_convert_agendamento_to_order_internal(
          v_ag.id, 'agora', 'aprovado', 'mercado_pago',
          coalesce(v_attempt.approved_at, now()), v_amount, 'mercado_pago'
        );
        v_order_id := (v_conversion->>'pedido_id')::uuid;
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

    IF v_order_id IS NOT NULL THEN
      PERFORM public.fn_gerar_comissoes_multinivel(v_order_id);
      UPDATE public.commissions
      SET status = 'liberada', available_at = coalesce(available_at, now())
      WHERE order_id = v_order_id
        AND status IN ('aguardando_entrega', 'aguardando_pagamento');
    END IF;
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
    SET payment_status = v_status, payment_source = 'mercado_pago', updated_at = now()
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

COMMIT;

-- Projecao do cliente mostra a linha comercial do kit, nunca suas linhas de
-- componente. A operacao continua lendo pedido_itens/agendamento_itens.
BEGIN;

CREATE OR REPLACE FUNCTION public.fn_customer_order_detail(
  p_entity_type text,
  p_entity_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_customer_id uuid;
  v_entity_type text := lower(btrim(coalesce(p_entity_type, '')));
  v_result jsonb;
BEGIN
  IF v_entity_type NOT IN ('pedido', 'agendamento') OR p_entity_id IS NULL THEN
    RAISE EXCEPTION 'invalid_customer_order_identity' USING ERRCODE = '22023';
  END IF;

  SELECT context.customer_id
  INTO v_customer_id
  FROM private.require_customer_account_context() context;

  IF v_entity_type = 'pedido' THEN
    SELECT jsonb_build_object(
      'status', 'ok',
      'order', jsonb_build_object(
        'entity_type', 'pedido',
        'entity_id', p.id,
        'number', p.numero_pedido,
        'created_at', p.created_at,
        'updated_at', p.updated_at,
        'fulfillment_status', p.status_pedido,
        'payment', jsonb_build_object(
          'status', p.payment_status,
          'timing', p.payment_timing,
          'source', p.payment_source,
          'method', p.forma_pagamento,
          'paid_at', p.paid_at,
          'amount_received', p.amount_received
        ),
        'delivery', jsonb_build_object(
          'address', p.endereco_entrega,
          'neighborhood', p.bairro,
          'city', p.cidade,
          'state', p.estado,
          'postal_code', p.cep,
          'started_at', p.delivery_started_at,
          'delivered_at', p.delivered_at,
          'finalized_at', p.finalized_at
        ),
        'total', p.valor_total,
        'can_pay_now', (
          p.payment_timing = 'entrega'
          AND p.payment_status NOT IN ('aprovado', 'cancelado', 'reembolsado', 'chargeback')
          AND p.status_pedido NOT IN ('cancelado', 'entregue', 'finalizado')
        )
      ),
      'items', coalesce((
        SELECT jsonb_agg(line.payload ORDER BY line.sort_created, line.sort_id)
        FROM (
          SELECT item.created_at AS sort_created, item.id AS sort_id,
            jsonb_build_object(
              'item_type', 'produto',
              'product_name', product.nome_produto,
              'image_url', product.imagem_url,
              'quantity', item.quantidade,
              'unit_price', item.preco_unitario,
              'discount', item.desconto_aplicado,
              'subtotal', item.subtotal
            ) AS payload
          FROM public.pedido_itens item
          LEFT JOIN public.produtos product ON product.id = item.produto_id
          WHERE item.pedido_id = p.id AND item.kit_line_id IS NULL
          UNION ALL
          SELECT kit.created_at AS sort_created, kit.id AS sort_id,
            jsonb_build_object(
              'item_type', 'kit',
              'kit_id', kit.kit_id,
              'product_name', kit.nome_kit_snapshot,
              'image_url', kit.imagem_url_snapshot,
              'quantity', kit.quantidade,
              'unit_price', kit.preco_unitario,
              'reference_price', kit.preco_referencia,
              'discount', kit.desconto_aplicado,
              'subtotal', kit.subtotal
            ) AS payload
          FROM public.pedido_kits kit
          WHERE kit.pedido_id = p.id
        ) line
      ), '[]'::jsonb)
    )
    INTO v_result
    FROM public.pedidos p
    WHERE p.id = p_entity_id AND p.cliente_id = v_customer_id;
  ELSE
    SELECT jsonb_build_object(
      'status', 'ok',
      'order', jsonb_build_object(
        'entity_type', 'agendamento',
        'entity_id', a.id,
        'number', a.numero_agendamento,
        'created_at', a.created_at,
        'updated_at', a.updated_at,
        'scheduled_for', a.data_agendamento,
        'fulfillment_status', a.status::text,
        'payment', jsonb_build_object(
          'status', a.payment_status,
          'timing', a.payment_timing,
          'source', a.payment_source,
          'method', a.forma_pagamento,
          'paid_at', a.paid_at,
          'amount_received', CASE WHEN a.payment_status = 'aprovado' THEN a.valor_total ELSE NULL END
        ),
        'delivery', jsonb_build_object(
          'address', a.endereco_entrega,
          'neighborhood', a.bairro,
          'city', a.cidade,
          'state', a.estado,
          'postal_code', a.cep
        ),
        'total', a.valor_total,
        'can_pay_now', (
          a.payment_timing = 'entrega'
          AND a.payment_status NOT IN ('aprovado', 'cancelado', 'reembolsado', 'chargeback')
          AND a.status::text NOT IN ('cancelado', 'convertido')
        )
      ),
      'items', coalesce((
        SELECT jsonb_agg(line.payload ORDER BY line.sort_created, line.sort_id)
        FROM (
          SELECT item.created_at AS sort_created, item.id AS sort_id,
            jsonb_build_object(
              'item_type', 'produto',
              'product_name', product.nome_produto,
              'image_url', product.imagem_url,
              'quantity', item.quantidade,
              'unit_price', item.preco_unitario,
              'discount', item.desconto_aplicado,
              'subtotal', item.subtotal
            ) AS payload
          FROM public.agendamento_itens item
          LEFT JOIN public.produtos product ON product.id = item.produto_id
          WHERE item.agendamento_id = a.id AND item.kit_line_id IS NULL
          UNION ALL
          SELECT kit.created_at AS sort_created, kit.id AS sort_id,
            jsonb_build_object(
              'item_type', 'kit',
              'kit_id', kit.kit_id,
              'product_name', kit.nome_kit_snapshot,
              'image_url', kit.imagem_url_snapshot,
              'quantity', kit.quantidade,
              'unit_price', kit.preco_unitario,
              'reference_price', kit.preco_referencia,
              'discount', kit.desconto_aplicado,
              'subtotal', kit.subtotal
            ) AS payload
          FROM public.agendamento_kits kit
          WHERE kit.agendamento_id = a.id
        ) line
      ), '[]'::jsonb)
    )
    INTO v_result
    FROM public.agendamentos a
    WHERE a.id = p_entity_id AND a.cliente_id = v_customer_id;
  END IF;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'customer_order_not_found' USING ERRCODE = 'P0002';
  END IF;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_customer_order_detail(text, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_customer_order_detail(text, uuid)
  TO authenticated;

COMMIT;
