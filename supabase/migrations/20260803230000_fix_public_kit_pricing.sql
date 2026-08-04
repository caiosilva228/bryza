-- Corrige o total liquido da oferta publica e o preco do pano promocional.
-- O desconto do brinde e aplicado pelo gatilho dentro do contexto da RPC,
-- portanto o calculo nao deve depender do texto de observacoes do registro.

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
  WHERE a.id = v_agendamento_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_recalculate_public_kit_scheduling_total()
  FROM PUBLIC, anon, authenticated;

UPDATE public.produtos
SET preco_venda = 12.99
WHERE id = '664d141e-e52c-43c9-bd1a-e5848c6490a6'::uuid;
