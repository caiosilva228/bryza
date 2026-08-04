-- Permite correções financeiras administrativas explicitamente auditadas.
-- A trava continua ativa para qualquer atualização comum; somente uma sessão
-- privilegiada que define o GUC dentro da função administrativa pode corrigir
-- snapshots já gerados.

CREATE OR REPLACE FUNCTION public.fn_amb_protect_commission_snapshots()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public, pg_temp
AS $function$
BEGIN
  IF OLD.ambassador_id IS DISTINCT FROM NEW.ambassador_id
     OR OLD.order_id IS DISTINCT FROM NEW.order_id
     OR OLD.commission_plan_id IS DISTINCT FROM NEW.commission_plan_id
     OR OLD.commission_level IS DISTINCT FROM NEW.commission_level
     OR OLD.commissionable_amount IS DISTINCT FROM NEW.commissionable_amount
     OR OLD.order_amount_snapshot IS DISTINCT FROM NEW.order_amount_snapshot
     OR OLD.percentage_snapshot IS DISTINCT FROM NEW.percentage_snapshot
     OR OLD.commission_amount IS DISTINCT FROM NEW.commission_amount
     OR OLD.commission_type IS DISTINCT FROM NEW.commission_type
     OR OLD.fixed_bonus_amount_snapshot IS DISTINCT FROM NEW.fixed_bonus_amount_snapshot
     OR OLD.qualification_minimum_snapshot IS DISTINCT FROM NEW.qualification_minimum_snapshot THEN
    IF current_setting('bryza.allow_commission_financial_update', true)
       IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION
        'Dados financeiros e snapshots de comissão já gerados são imutáveis.';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Corrige, com motivo obrigatório e auditoria, a base congelada de uma venda
-- quando o valor líquido do pedido foi corrigido antes do pagamento da comissão.
CREATE OR REPLACE FUNCTION private.fn_admin_correct_order_commission_snapshots(
  p_order_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_order public.pedidos%ROWTYPE;
  v_base numeric(12,2);
  v_direct_expected numeric(12,2);
  v_commission_count integer;
  v_updated_commissions integer;
  v_old_commissions jsonb;
  v_new_commissions jsonb;
BEGIN
  IF length(trim(coalesce(p_reason, ''))) < 10 THEN
    RAISE EXCEPTION 'Motivo da correção é obrigatório (mínimo de 10 caracteres).';
  END IF;

  SELECT p.* INTO v_order
  FROM public.pedidos p
  WHERE p.id = p_order_id
  FOR UPDATE;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  IF v_order.valor_total IS NULL OR v_order.valor_total <= 0 THEN
    RAISE EXCEPTION 'Pedido não possui valor líquido válido para correção.';
  END IF;

  IF v_order.commission_percentage_snapshot IS NULL THEN
    RAISE EXCEPTION 'Pedido não possui percentual direto congelado.';
  END IF;

  v_base := round(v_order.valor_total, 2);
  v_direct_expected := round(
    v_base * v_order.commission_percentage_snapshot / 100.0,
    2
  );

  SELECT count(*)::integer INTO v_commission_count
  FROM public.commissions c
  WHERE c.order_id = p_order_id;

  IF v_commission_count = 0 THEN
    RAISE EXCEPTION 'Pedido não possui comissões geradas.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.commissions c
    WHERE c.order_id = p_order_id
      AND c.commission_type NOT IN ('network_percentage', 'first_purchase_bonus')
  ) THEN
    RAISE EXCEPTION 'Pedido possui tipo de comissão não suportado por esta correção.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.commission_payment_items cpi
    JOIN public.commissions c ON c.id = cpi.commission_id
    WHERE c.order_id = p_order_id
  ) THEN
    RAISE EXCEPTION 'Comissão já vinculada a um pagamento; correção bloqueada.';
  END IF;

  PERFORM 1
  FROM public.commissions c
  WHERE c.order_id = p_order_id
  FOR UPDATE;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'type', c.commission_type,
        'level', c.commission_level,
        'commissionable_amount', c.commissionable_amount,
        'order_amount_snapshot', c.order_amount_snapshot,
        'commission_amount', c.commission_amount,
        'status', c.status
      )
      ORDER BY c.commission_type, c.commission_level
    ),
    '[]'::jsonb
  ) INTO v_old_commissions
  FROM public.commissions c
  WHERE c.order_id = p_order_id;

  PERFORM set_config('bryza.allow_order_snapshot_update', 'true', true);
  PERFORM set_config('bryza.allow_commission_financial_update', 'true', true);

  UPDATE public.pedidos
  SET commissionable_amount_snapshot = v_base,
      commission_amount_snapshot = v_direct_expected,
      updated_at = now()
  WHERE id = p_order_id;

  UPDATE public.commissions c
  SET commissionable_amount = v_base,
      order_amount_snapshot = v_base,
      commission_amount = CASE
        WHEN c.commission_type = 'network_percentage' THEN round(
          v_base * c.percentage_snapshot / 100.0,
          2
        )
        WHEN c.commission_type = 'first_purchase_bonus' THEN coalesce(
          c.fixed_bonus_amount_snapshot,
          c.commission_amount
        )
        ELSE c.commission_amount
      END
  WHERE c.order_id = p_order_id;

  GET DIAGNOSTICS v_updated_commissions = ROW_COUNT;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'type', c.commission_type,
        'level', c.commission_level,
        'commissionable_amount', c.commissionable_amount,
        'order_amount_snapshot', c.order_amount_snapshot,
        'commission_amount', c.commission_amount,
        'status', c.status
      )
      ORDER BY c.commission_type, c.commission_level
    ),
    '[]'::jsonb
  ) INTO v_new_commissions
  FROM public.commissions c
  WHERE c.order_id = p_order_id;

  INSERT INTO public.audit_logs (
    actor_id, actor_role, action, entity_type, entity_id,
    old_data, new_data, metadata
  ) VALUES (
    NULL,
    'system',
    'commission_snapshots_corrected',
    'pedidos',
    p_order_id,
    jsonb_build_object(
      'valor_total', v_order.valor_total,
      'commissionable_amount_snapshot', v_order.commissionable_amount_snapshot,
      'commission_amount_snapshot', v_order.commission_amount_snapshot,
      'commissions', v_old_commissions
    ),
    jsonb_build_object(
      'valor_total', v_base,
      'commissionable_amount_snapshot', v_base,
      'commission_amount_snapshot', v_direct_expected,
      'commissions', v_new_commissions
    ),
    jsonb_build_object(
      'reason', p_reason,
      'updated_commissions', v_updated_commissions,
      'session_user', session_user
    )
  );

  RETURN jsonb_build_object(
    'sucesso', true,
    'pedido_id', p_order_id,
    'base', v_base,
    'comissao_direta', v_direct_expected,
    'comissoes_atualizadas', v_updated_commissions,
    'comissoes', v_new_commissions
  );
END;
$function$;

REVOKE ALL ON FUNCTION private.fn_admin_correct_order_commission_snapshots(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.fn_admin_correct_order_commission_snapshots(uuid, text)
  TO service_role;
