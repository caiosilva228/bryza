-- Use the canonical customer/ambassador assignment everywhere referrals are read,
-- expose a current-cycle administrative activation flow, and record commission
-- opportunities that are skipped before the regular commission generator runs.

CREATE OR REPLACE FUNCTION public.fn_get_clientes_indicados(
  p_limit integer DEFAULT 10,
  p_offset integer DEFAULT 0,
  p_search text DEFAULT NULL,
  p_ambassador_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_sort_by text DEFAULT NULL,
  p_sort_order text DEFAULT 'desc'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_total bigint;
  v_items jsonb;
  v_order_dir text;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100
     OR p_offset IS NULL OR p_offset < 0 THEN
    RAISE EXCEPTION 'invalid_referral_pagination' USING ERRCODE = '22023';
  END IF;

  v_order_dir := CASE
    WHEN lower(coalesce(p_sort_order, 'desc')) = 'asc' THEN 'ASC'
    ELSE 'DESC'
  END;

  SELECT count(*)
  INTO v_total
  FROM private.customer_ambassador_assignments ca
  JOIN public.ambassadors a ON a.id = ca.ambassador_id
  JOIN public.clientes c ON c.id = ca.customer_id
  WHERE ca.status = 'active'
    AND ca.is_validated
    AND c.own_ambassador_id IS NULL
    AND c.lifecycle_status = 'active'
    AND (p_ambassador_id IS NULL OR ca.ambassador_id = p_ambassador_id)
    AND (p_status IS NULL OR c.status_cliente::text = p_status)
    AND (
      p_search IS NULL
      OR c.nome ILIKE '%' || p_search || '%'
      OR c.telefone ILIKE '%' || p_search || '%'
      OR c.email ILIKE '%' || p_search || '%'
    );

  SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT
      ca.id,
      c.id AS id_cliente,
      c.nome,
      coalesce(c.telefone, '') AS telefone,
      c.email,
      c.cidade,
      c.estado,
      c.status_cliente::text AS status_cliente,
      ca.created_at AS data_cadastro,
      coalesce(c.total_compras, 0) AS total_compras,
      coalesce(c.valor_total_gasto, 0) AS valor_total_gasto,
      coalesce(c.ticket_medio, 0) AS ticket_medio,
      ca.source AS referral_source,
      ca.status AS attribution_status,
      ca.is_commissionable,
      a.id AS ambassador_id,
      a.full_name AS ambassador_name,
      a.username AS ambassador_username,
      a.referral_code AS ambassador_referral_code,
      a.status AS ambassador_status
    FROM private.customer_ambassador_assignments ca
    JOIN public.ambassadors a ON a.id = ca.ambassador_id
    JOIN public.clientes c ON c.id = ca.customer_id
    WHERE ca.status = 'active'
      AND ca.is_validated
      AND c.own_ambassador_id IS NULL
      AND c.lifecycle_status = 'active'
      AND (p_ambassador_id IS NULL OR ca.ambassador_id = p_ambassador_id)
      AND (p_status IS NULL OR c.status_cliente::text = p_status)
      AND (
        p_search IS NULL
        OR c.nome ILIKE '%' || p_search || '%'
        OR c.telefone ILIKE '%' || p_search || '%'
        OR c.email ILIKE '%' || p_search || '%'
      )
    ORDER BY
      CASE WHEN p_sort_by = 'nome' AND v_order_dir = 'ASC' THEN c.nome END ASC,
      CASE WHEN p_sort_by = 'nome' AND v_order_dir = 'DESC' THEN c.nome END DESC,
      CASE WHEN p_sort_by = 'telefone' AND v_order_dir = 'ASC' THEN c.telefone END ASC,
      CASE WHEN p_sort_by = 'telefone' AND v_order_dir = 'DESC' THEN c.telefone END DESC,
      CASE WHEN p_sort_by = 'cidade' AND v_order_dir = 'ASC' THEN c.cidade END ASC,
      CASE WHEN p_sort_by = 'cidade' AND v_order_dir = 'DESC' THEN c.cidade END DESC,
      CASE WHEN p_sort_by = 'status' AND v_order_dir = 'ASC' THEN c.status_cliente::text END ASC,
      CASE WHEN p_sort_by = 'status' AND v_order_dir = 'DESC' THEN c.status_cliente::text END DESC,
      CASE WHEN p_sort_by = 'ambassador_name' AND v_order_dir = 'ASC' THEN a.full_name END ASC,
      CASE WHEN p_sort_by = 'ambassador_name' AND v_order_dir = 'DESC' THEN a.full_name END DESC,
      CASE WHEN p_sort_by = 'compras' AND v_order_dir = 'ASC' THEN coalesce(c.total_compras, 0) END ASC,
      CASE WHEN p_sort_by = 'compras' AND v_order_dir = 'DESC' THEN coalesce(c.total_compras, 0) END DESC,
      CASE WHEN p_sort_by = 'total_gasto' AND v_order_dir = 'ASC' THEN coalesce(c.valor_total_gasto, 0) END ASC,
      CASE WHEN p_sort_by = 'total_gasto' AND v_order_dir = 'DESC' THEN coalesce(c.valor_total_gasto, 0) END DESC,
      CASE WHEN p_sort_by = 'data_cadastro' AND v_order_dir = 'ASC' THEN ca.created_at END ASC,
      CASE WHEN p_sort_by = 'data_cadastro' AND v_order_dir = 'DESC' THEN ca.created_at END DESC,
      CASE WHEN p_sort_by IS NULL THEN ca.created_at END DESC,
      ca.id DESC
    LIMIT p_limit
    OFFSET p_offset
  ) t;

  RETURN jsonb_build_object('items', v_items, 'total', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_get_clientes_indicados(
  integer, integer, text, uuid, text, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_get_clientes_indicados(
  integer, integer, text, uuid, text, text, text
) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_get_embaixador_indicacoes(
  p_limit integer DEFAULT 10,
  p_offset integer DEFAULT 0,
  p_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_amb_id uuid;
  v_total integer := 0;
  v_items jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida' USING ERRCODE = '42501';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 50
     OR p_offset IS NULL OR p_offset < 0 THEN
    RAISE EXCEPTION 'invalid_referral_pagination' USING ERRCODE = '22023';
  END IF;

  SELECT a.id INTO v_amb_id
  FROM public.ambassadors a
  JOIN public.profiles p ON p.id = a.user_id
  WHERE a.user_id = auth.uid()
    AND p.role = 'embaixador'
    AND p.ativo
    AND NOT p.must_change_password
    AND a.status = 'ativo'
    AND a.lifecycle_status = 'active';

  IF v_amb_id IS NULL THEN
    RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_total
  FROM private.customer_ambassador_assignments ca
  JOIN public.clientes c ON c.id = ca.customer_id
  WHERE ca.ambassador_id = v_amb_id
    AND ca.status = 'active'
    AND ca.is_validated
    AND c.lifecycle_status = 'active'
    AND (p_status IS NULL OR p_status = '' OR ca.source = p_status);

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', sub.id,
    'created_at', sub.created_at,
    'referral_source', sub.referral_source,
    'cliente_nome_mascarado', sub.nome_mascarado,
    'is_locked', true,
    'total_pedidos', sub.total_pedidos,
    'valor_aprovado_total', sub.valor_aprovado_total,
    'is_active', sub.is_active,
    'activation_status', CASE WHEN sub.is_active THEN 'ativo' ELSE 'nao_ativo' END,
    'activated_at', sub.activated_at,
    'activation_order_code', sub.activation_order_code
  )), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT
      ca.id,
      ca.created_at,
      ca.source AS referral_source,
      CASE
        WHEN position(' ' in trim(c.nome)) > 0 THEN
          split_part(trim(c.nome), ' ', 1) || ' '
          || upper(left(split_part(trim(c.nome), ' ', 2), 1)) || '.'
        ELSE trim(c.nome)
      END AS nome_mascarado,
      coalesce(order_totals.total_pedidos, 0) AS total_pedidos,
      coalesce(order_totals.valor_aprovado_total, 0) AS valor_aprovado_total,
      activation.activated_at IS NOT NULL AS is_active,
      activation.activated_at,
      activation.numero_pedido AS activation_order_code
    FROM private.customer_ambassador_assignments ca
    JOIN public.clientes c ON c.id = ca.customer_id
    LEFT JOIN LATERAL (
      SELECT
        count(DISTINCT ped.id) AS total_pedidos,
        coalesce(sum(CASE
          WHEN ped.status_pedido IN ('entregue', 'finalizado')
               AND ped.payment_check_status = 'confirmado'
          THEN ped.valor_total ELSE 0 END), 0) AS valor_aprovado_total
      FROM public.pedidos ped
      WHERE ped.referral_assignment_id = ca.id
    ) order_totals ON true
    LEFT JOIN LATERAL (
      SELECT
        ped.numero_pedido,
        coalesce(ped.finalized_at, ped.updated_at, ped.created_at) AS activated_at
      FROM public.pedidos ped
      WHERE ped.referral_assignment_id = ca.id
        AND ped.payment_check_status = 'confirmado'
        AND ped.status_pedido IN ('entregue', 'finalizado')
      ORDER BY coalesce(ped.finalized_at, ped.updated_at, ped.created_at),
               ped.created_at, ped.id
      LIMIT 1
    ) activation ON true
    WHERE ca.ambassador_id = v_amb_id
      AND ca.status = 'active'
      AND ca.is_validated
      AND c.lifecycle_status = 'active'
      AND (p_status IS NULL OR p_status = '' OR ca.source = p_status)
    ORDER BY ca.created_at DESC, ca.id DESC
    LIMIT p_limit OFFSET p_offset
  ) sub;

  RETURN jsonb_build_object('items', v_items, 'total', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_get_embaixador_indicacoes(
  integer, integer, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_get_embaixador_indicacoes(
  integer, integer, text
) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_admin_get_ambassador_activation_status(
  p_ambassador_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_result jsonb;
BEGIN
  PERFORM private.require_phase2_actor(ARRAY['admin']);

  IF p_ambassador_ids IS NULL
     OR cardinality(p_ambassador_ids) < 1
     OR cardinality(p_ambassador_ids) > 100 THEN
    RAISE EXCEPTION 'invalid_ambassador_activation_batch'
      USING ERRCODE = '22023';
  END IF;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object('ambassador_id', requested.ambassador_id)
    || public.fn_evaluate_ambassador_qualification(
      requested.ambassador_id,
      (now() AT TIME ZONE 'America/Sao_Paulo')::date
    )
    ORDER BY requested.ordinality
  ), '[]'::jsonb)
  INTO v_result
  FROM unnest(p_ambassador_ids) WITH ORDINALITY
    AS requested(ambassador_id, ordinality);

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_get_ambassador_activation_status(uuid[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_get_ambassador_activation_status(uuid[])
  TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_admin_activate_current_month_commissions(
  p_ambassador_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_actor uuid;
  v_period_end date;
  v_valid_until timestamptz;
  v_before jsonb;
  v_after jsonb;
  v_grant jsonb;
BEGIN
  SELECT actor_id INTO v_actor
  FROM private.require_phase2_actor(ARRAY['admin']);

  IF length(btrim(coalesce(p_reason, ''))) < 5 THEN
    RAISE EXCEPTION 'activation_reason_too_short' USING ERRCODE = '22023';
  END IF;

  SELECT cycle.period_end
  INTO v_period_end
  FROM private.ambassador_activation_cycle(
    (now() AT TIME ZONE 'America/Sao_Paulo')::date,
    (
      SELECT coalesce(activation_deadline_day, 15)
      FROM public.ambassador_program_settings
      WHERE singleton
    )
  ) cycle;

  v_before := public.fn_evaluate_ambassador_qualification(
    p_ambassador_id,
    (now() AT TIME ZONE 'America/Sao_Paulo')::date
  );

  IF coalesce((v_before->>'qualified')::boolean, false) THEN
    RETURN v_before || jsonb_build_object(
      'activation_result', 'already_active',
      'valid_until', v_period_end
    );
  END IF;

  v_valid_until := (
    (v_period_end + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo'
  ) - interval '1 microsecond';

  v_grant := public.fn_admin_grant_ambassador_exception(
    p_ambassador_id,
    btrim(p_reason),
    v_valid_until
  );

  v_after := public.fn_evaluate_ambassador_qualification(
    p_ambassador_id,
    (now() AT TIME ZONE 'America/Sao_Paulo')::date
  );

  IF NOT coalesce((v_after->>'qualified')::boolean, false) THEN
    RAISE EXCEPTION 'ambassador_activation_failed';
  END IF;

  RETURN v_after || jsonb_build_object(
    'activation_result', 'activated',
    'valid_until', v_period_end,
    'exception_id', v_grant->>'exception_id',
    'activated_by', v_actor
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_activate_current_month_commissions(
  uuid, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_activate_current_month_commissions(
  uuid, text
) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_trg_generate_order_commissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_assignment_commissionable boolean := false;
  v_period_start date;
  v_period_end date;
  v_percentage numeric(5,2);
  v_lost_amount numeric(12,2);
BEGIN
  IF auth.uid() IS NULL AND coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;

  IF NEW.referral_validated_snapshot
     AND NOT NEW.ambassador_qualified_snapshot
     AND NEW.ambassador_id IS NOT NULL
     AND NEW.referral_assignment_id IS NOT NULL
     AND NEW.commission_plan_id_snapshot IS NOT NULL
     AND NEW.commissionable_amount_snapshot IS NOT NULL THEN
    SELECT ca.is_commissionable
    INTO v_assignment_commissionable
    FROM private.customer_ambassador_assignments ca
    WHERE ca.id = NEW.referral_assignment_id
      AND ca.customer_id = NEW.cliente_id
      AND ca.ambassador_id = NEW.ambassador_id
      AND ca.status = 'active'
      AND ca.is_validated;

    IF coalesce(v_assignment_commissionable, false) THEN
      v_period_start := coalesce(
        NEW.qualification_period_start_snapshot,
        date_trunc(
          'month',
          NEW.created_at AT TIME ZONE 'America/Sao_Paulo'
        )::date
      );
      v_period_end := coalesce(
        NEW.qualification_period_end_snapshot,
        (v_period_start + interval '1 month - 1 day')::date
      );
      v_percentage := coalesce(NEW.commission_percentage_snapshot, 0);
      v_lost_amount := round(
        NEW.commissionable_amount_snapshot * v_percentage / 100,
        2
      );

      IF v_lost_amount > 0 THEN
        INSERT INTO private.ambassador_lost_commissions (
          ambassador_id,
          order_id,
          customer_id,
          commission_plan_id,
          commission_level,
          commission_type,
          commissionable_amount,
          order_amount_snapshot,
          percentage_snapshot,
          lost_amount,
          qualification_period_start,
          qualification_period_end
        ) VALUES (
          NEW.ambassador_id,
          NEW.id,
          NEW.cliente_id,
          NEW.commission_plan_id_snapshot,
          1,
          'network_percentage',
          NEW.commissionable_amount_snapshot,
          NEW.valor_total,
          v_percentage,
          v_lost_amount,
          v_period_start,
          v_period_end
        )
        ON CONFLICT (
          order_id, ambassador_id, commission_level, commission_type
        ) DO NOTHING;
      END IF;
    END IF;
  END IF;

  IF NOT NEW.referral_validated_snapshot
     OR NOT NEW.referral_commissionable_snapshot
     OR NOT NEW.ambassador_qualified_snapshot
     OR NEW.referral_assignment_id IS NULL
     OR NEW.commission_plan_id_snapshot IS NULL
     OR NEW.commissionable_amount_snapshot IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.fn_gerar_comissoes_multinivel(NEW.id);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_trg_generate_order_commissions()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fn_get_embaixador_dashboard_metrics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_amb_id uuid;
  v_result jsonb;
  v_activation jsonb;
  v_first_purchase_bonus_total numeric(15,2) := 0;
  v_lost_commission_total numeric(15,2) := 0;
  v_lost_commission_month numeric(15,2) := 0;
  v_clientes_indicados integer := 0;
  v_month_start date := date_trunc(
    'month',
    now() AT TIME ZONE 'America/Sao_Paulo'
  )::date;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida' USING ERRCODE = '42501';
  END IF;

  SELECT a.id INTO v_amb_id
  FROM public.ambassadors a
  JOIN public.profiles p ON p.id = a.user_id
  WHERE a.user_id = auth.uid()
    AND p.role = 'embaixador'
    AND p.ativo
    AND NOT p.must_change_password
    AND a.status = 'ativo'
    AND a.lifecycle_status = 'active';

  IF v_amb_id IS NULL THEN
    RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE = '42501';
  END IF;

  v_activation := public.fn_evaluate_ambassador_qualification(
    v_amb_id,
    (now() AT TIME ZONE 'America/Sao_Paulo')::date
  );
  v_result := public.fn_get_embaixador_dashboard_metrics_core();

  SELECT coalesce(sum(c.commission_amount), 0)
  INTO v_first_purchase_bonus_total
  FROM public.commissions c
  WHERE c.ambassador_id = v_amb_id
    AND c.commission_type = 'first_purchase_bonus'
    AND c.status <> 'cancelada';

  SELECT
    coalesce(sum(lost.lost_amount), 0),
    coalesce(sum(lost.lost_amount) FILTER (
      WHERE lost.qualification_period_start = v_month_start
    ), 0)
  INTO v_lost_commission_total, v_lost_commission_month
  FROM private.ambassador_lost_commissions lost
  JOIN public.pedidos p ON p.id = lost.order_id
  WHERE lost.ambassador_id = v_amb_id
    AND p.status_pedido IN ('entregue', 'finalizado')
    AND p.payment_check_status = 'confirmado';

  SELECT count(*)
  INTO v_clientes_indicados
  FROM private.customer_ambassador_assignments ca
  JOIN public.clientes c ON c.id = ca.customer_id
  WHERE ca.ambassador_id = v_amb_id
    AND ca.status = 'active'
    AND ca.is_validated
    AND c.lifecycle_status = 'active';

  RETURN v_result || jsonb_build_object(
    'first_purchase_bonus_total', v_first_purchase_bonus_total,
    'lost_commission_total', v_lost_commission_total,
    'lost_commission_month', v_lost_commission_month,
    'clientes_indicados', v_clientes_indicados,
    'activation', v_activation
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_get_embaixador_dashboard_metrics()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_get_embaixador_dashboard_metrics()
  TO authenticated, service_role;

-- Preserve the immutable order snapshot and register this historical opportunity.
INSERT INTO private.ambassador_lost_commissions (
  ambassador_id,
  order_id,
  customer_id,
  commission_plan_id,
  commission_level,
  commission_type,
  commissionable_amount,
  order_amount_snapshot,
  percentage_snapshot,
  lost_amount,
  qualification_period_start,
  qualification_period_end
)
SELECT
  p.ambassador_id,
  p.id,
  p.cliente_id,
  p.commission_plan_id_snapshot,
  1,
  'network_percentage',
  p.commissionable_amount_snapshot,
  p.valor_total,
  p.commission_percentage_snapshot,
  round(
    p.commissionable_amount_snapshot
    * p.commission_percentage_snapshot / 100,
    2
  ),
  p.qualification_period_start_snapshot,
  p.qualification_period_end_snapshot
FROM public.pedidos p
JOIN public.ambassadors a ON a.id = p.ambassador_id
JOIN public.clientes c ON c.id = p.cliente_id
JOIN private.customer_ambassador_assignments ca
  ON ca.id = p.referral_assignment_id
WHERE p.numero_pedido = 'PV00279'
  AND a.referral_code = 'bryza02'
  AND c.codigo_cliente = 169
  AND p.referral_validated_snapshot
  AND NOT p.ambassador_qualified_snapshot
  AND ca.is_commissionable
  AND p.commission_plan_id_snapshot IS NOT NULL
  AND p.commissionable_amount_snapshot IS NOT NULL
  AND p.commission_percentage_snapshot IS NOT NULL
  AND p.qualification_period_start_snapshot IS NOT NULL
  AND p.qualification_period_end_snapshot IS NOT NULL
ON CONFLICT (
  order_id, ambassador_id, commission_level, commission_type
) DO NOTHING;
