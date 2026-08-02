-- Mantém o pano promocional como item real do agendamento/pedido para que os
-- gatilhos de reserva e baixa de estoque processem a quantidade normalmente,
-- mas aplica desconto integral e subtotal líquido zero na oferta pública.

CREATE OR REPLACE FUNCTION public.fn_apply_public_kit_gift_discount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE
  v_is_public_kit boolean := false;
  v_gross_subtotal numeric(12,2);
BEGIN
  v_is_public_kit := coalesce(
    current_setting('bryza.public_kit_full_discount', true),
    'false'
  ) = 'true';

  IF coalesce(v_is_public_kit, false)
     AND NEW.produto_id = '664d141e-e52c-43c9-bd1a-e5848c6490a6'::uuid THEN
    v_gross_subtotal := round(NEW.preco_unitario * NEW.quantidade, 2);
    NEW.desconto_tipo := 'fixed';
    NEW.desconto_valor := v_gross_subtotal;
    NEW.desconto_aplicado := v_gross_subtotal;
    NEW.subtotal := 0;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_apply_public_kit_gift_discount()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_apply_public_kit_gift_discount
  ON public.agendamento_itens;
CREATE TRIGGER trg_apply_public_kit_gift_discount
BEFORE INSERT OR UPDATE OF quantidade, preco_unitario, produto_id
ON public.agendamento_itens
FOR EACH ROW
EXECUTE FUNCTION public.fn_apply_public_kit_gift_discount();

CREATE OR REPLACE FUNCTION public.fn_recalculate_public_kit_scheduling_total()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE
  v_agendamento_id uuid;
BEGIN
  IF coalesce(
    current_setting('bryza.public_kit_full_discount', true),
    'false'
  ) <> 'true' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_agendamento_id := OLD.agendamento_id;
  ELSE
    v_agendamento_id := NEW.agendamento_id;
  END IF;

  UPDATE public.agendamentos a
  SET valor_total = (
        SELECT coalesce(sum(ai.subtotal), 0)
        FROM public.agendamento_itens ai
        WHERE ai.agendamento_id = v_agendamento_id
      ),
      updated_at = now()
  WHERE a.id = v_agendamento_id
    AND a.observacoes = 'Agendamento criado pela página de vendas.';

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_recalculate_public_kit_scheduling_total()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_recalculate_public_kit_scheduling_total
  ON public.agendamento_itens;
CREATE TRIGGER trg_recalculate_public_kit_scheduling_total
AFTER INSERT OR UPDATE OF quantidade, preco_unitario, subtotal, desconto_aplicado OR DELETE
ON public.agendamento_itens
FOR EACH ROW
EXECUTE FUNCTION public.fn_recalculate_public_kit_scheduling_total();

-- A função canônica original continua responsável por identidade, atribuição e
-- idempotência. Este wrapper devolve ao checkout o total líquido recalculado
-- depois que o desconto integral do brinde foi aplicado pelos gatilhos acima.
CREATE OR REPLACE FUNCTION public.fn_criar_agendamento_publico_kit(
  p_cliente_data jsonb,
  p_itens_data jsonb,
  p_atribuicao jsonb,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE
  v_result jsonb;
  v_agendamento_id uuid;
  v_net_total numeric(12,2);
BEGIN
  PERFORM set_config('bryza.public_kit_full_discount', 'true', true);

  v_result := public.fn_criar_agendamento_publico(
    p_cliente_data,
    p_itens_data,
    p_atribuicao,
    p_idempotency_key
  );

  v_agendamento_id := nullif(v_result->>'agendamento_id', '')::uuid;
  IF v_agendamento_id IS NULL THEN
    RETURN v_result;
  END IF;

  SELECT a.valor_total
  INTO v_net_total
  FROM public.agendamentos a
  WHERE a.id = v_agendamento_id;

  RETURN jsonb_set(
    v_result,
    '{valor_total}',
    to_jsonb(coalesce(v_net_total, 0)),
    true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_criar_agendamento_publico_kit(jsonb, jsonb, jsonb, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_criar_agendamento_publico_kit(jsonb, jsonb, jsonb, uuid)
  TO service_role;

COMMENT ON FUNCTION public.fn_criar_agendamento_publico_kit(jsonb, jsonb, jsonb, uuid)
  IS 'Creates the public Kit Bryza scheduling and returns the net total after the gift line receives a full discount.';
