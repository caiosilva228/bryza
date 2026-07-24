-- Remote migration 20260724204649.
CREATE OR REPLACE FUNCTION public.fn_evaluate_ambassador_qualification(
  p_ambassador_id uuid,
  p_reference_date date DEFAULT current_date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_actor uuid;
  v_role text;
  v_ambassador public.ambassadors%ROWTYPE;
  v_period_start date := date_trunc('month', p_reference_date)::date;
  v_period_end date := (date_trunc('month', p_reference_date) + interval '1 month - 1 day')::date;
  v_minimum numeric := 0;
  v_personal_purchase numeric := 0;
  v_exception_id uuid;
  v_status text;
  v_qualification_id uuid;
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' THEN
    SELECT id, role::text INTO v_actor, v_role
    FROM public.profiles
    WHERE role = 'admin' AND ativo
    ORDER BY created_at, id
    LIMIT 1;
  ELSE
    SELECT actor_id, actor_role INTO v_actor, v_role
    FROM private.require_phase2_actor(ARRAY['admin', 'vendedor', 'embaixador']);
  END IF;

  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'qualification_actor_unavailable' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_ambassador
  FROM public.ambassadors
  WHERE id = p_ambassador_id
    AND status = 'ativo'
    AND lifecycle_status = 'active';

  IF v_ambassador.id IS NULL THEN
    RETURN jsonb_build_object('status', 'not_qualified', 'code', 'ambassador_inactive');
  END IF;

  IF v_role = 'embaixador' AND v_ambassador.user_id <> v_actor THEN
    RAISE EXCEPTION 'ambassador_qualification_access_denied' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(monthly_activation_amount, 0)
  INTO v_minimum
  FROM public.ambassador_program_settings
  WHERE singleton;

  SELECT e.id INTO v_exception_id
  FROM private.ambassador_program_exceptions e
  WHERE (e.ambassador_id = p_ambassador_id OR e.person_id = v_ambassador.person_id)
    AND e.rule_code = 'monthly_purchase_qualification'
    AND e.effect_type = 'allow'
    AND e.revoked_at IS NULL
    AND e.valid_from <= v_period_end::timestamptz
    AND (e.valid_until IS NULL OR e.valid_until >= v_period_start::timestamptz)
  ORDER BY e.valid_from DESC, e.id
  LIMIT 1;

  SELECT coalesce(sum(p.valor_total), 0)
  INTO v_personal_purchase
  FROM public.pedidos p
  JOIN public.clientes c ON c.id = p.cliente_id
  WHERE c.person_id = v_ambassador.person_id
    AND p.created_at >= v_period_start::timestamptz
    AND p.created_at < (v_period_end + 1)::timestamptz
    AND p.status_pedido IN ('entregue', 'finalizado')
    AND p.payment_check_status = 'confirmado';

  v_status := CASE
    WHEN v_exception_id IS NOT NULL THEN 'exception'
    WHEN v_minimum <= 0 OR v_personal_purchase >= v_minimum THEN 'qualified'
    ELSE 'not_qualified'
  END;

  INSERT INTO private.ambassador_qualifications (
    ambassador_id, period_start, period_end, rule_code, status,
    rule_snapshot, exception_id, evaluated_at, evaluated_by
  ) VALUES (
    p_ambassador_id, v_period_start, v_period_end,
    'monthly_purchase_qualification', v_status,
    jsonb_build_object(
      'minimum_amount', v_minimum,
      'personal_purchase_amount', v_personal_purchase,
      'currency', 'BRL'
    ),
    v_exception_id, now(), v_actor
  )
  ON CONFLICT (ambassador_id, period_start, period_end, rule_code)
  DO UPDATE SET
    status = EXCLUDED.status,
    rule_snapshot = EXCLUDED.rule_snapshot,
    exception_id = EXCLUDED.exception_id,
    evaluated_at = EXCLUDED.evaluated_at,
    evaluated_by = EXCLUDED.evaluated_by,
    updated_at = now()
  RETURNING id INTO v_qualification_id;

  RETURN jsonb_build_object(
    'status', v_status,
    'qualified', v_status IN ('qualified', 'exception'),
    'qualification_id', v_qualification_id,
    'period_start', v_period_start,
    'period_end', v_period_end
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_evaluate_ambassador_qualification(uuid, date)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_evaluate_ambassador_qualification(uuid, date)
  TO authenticated;
