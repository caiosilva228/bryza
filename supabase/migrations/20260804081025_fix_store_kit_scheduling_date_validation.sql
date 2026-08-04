-- A loja escolhe um dia do calendario; o periodo (manha/tarde/noite) fica
-- separado nas observacoes. A validacao anterior comparava o timestamp
-- inteiro com now() + 30 minutos, o que fazia uma data valida falhar perto
-- da virada do dia ou quando o runtime convertia o valor para UTC.
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
  v_schedule_date date;
  v_today date;
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

  -- O calendario comercial da loja e America/Sao_Paulo. Validamos a data
  -- civil e so aplicamos os 30 minutos quando o pedido e para hoje.
  v_schedule_date := (v_date AT TIME ZONE 'America/Sao_Paulo')::date;
  v_today := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  IF v_date IS NULL
     OR v_schedule_date < v_today
     OR v_schedule_date > v_today + 180
     OR (v_schedule_date = v_today AND v_date < now() + interval '30 minutes') THEN
    RAISE EXCEPTION 'scheduling_date_out_of_range' USING ERRCODE = '22023';
  END IF;
  v_date := (v_schedule_date + time '12:00') AT TIME ZONE 'America/Sao_Paulo';

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
