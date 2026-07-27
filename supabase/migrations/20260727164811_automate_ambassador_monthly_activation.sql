BEGIN;

ALTER TABLE public.ambassador_program_settings
  ADD COLUMN IF NOT EXISTS activation_deadline_day smallint NOT NULL DEFAULT 15;

ALTER TABLE public.ambassador_program_settings
  DROP CONSTRAINT IF EXISTS ambassador_program_settings_activation_deadline_day_check,
  ADD CONSTRAINT ambassador_program_settings_activation_deadline_day_check
    CHECK (activation_deadline_day BETWEEN 1 AND 28);

UPDATE public.ambassador_program_settings
SET monthly_activation_enabled = true,
    monthly_activation_amount = 79,
    activation_basis = 'compras_pessoais',
    activation_grace_days = 0,
    activation_deadline_day = 15,
    first_purchase_minimum_amount = 79,
    updated_at = now()
WHERE singleton;

COMMENT ON COLUMN public.ambassador_program_settings.activation_deadline_day IS
  'Último dia inclusivo do mês para a compra pessoal ativar comissões no ciclo atual.';

CREATE OR REPLACE FUNCTION private.ambassador_activation_cycle(
  p_reference_date date,
  p_deadline_day integer DEFAULT 15
)
RETURNS TABLE (
  period_start date,
  period_end date,
  qualification_deadline date,
  days_remaining integer
)
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog
AS $$
  SELECT
    date_trunc('month', p_reference_date)::date,
    (date_trunc('month', p_reference_date) + interval '1 month - 1 day')::date,
    (
      date_trunc('month', p_reference_date)
      + make_interval(days => greatest(1, least(p_deadline_day, 28)) - 1)
    )::date,
    greatest(
      0,
      (
        date_trunc('month', p_reference_date)
        + make_interval(days => greatest(1, least(p_deadline_day, 28)) - 1)
      )::date - p_reference_date
    );
$$;

REVOKE ALL ON FUNCTION private.ambassador_activation_cycle(date, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.ambassador_activation_cycle(date, integer)
  TO service_role;

ALTER TABLE private.ambassador_invitation_eligibilities
  DROP CONSTRAINT IF EXISTS ambassador_invitation_eligibilities_eligibility_type_check,
  ADD CONSTRAINT ambassador_invitation_eligibilities_eligibility_type_check
    CHECK (
      eligibility_type IN (
        'founder_customer',
        'individual_admin',
        'qualifying_purchase'
      )
    );

CREATE TABLE IF NOT EXISTS private.ambassador_lost_commissions (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  ambassador_id uuid NOT NULL
    REFERENCES public.ambassadors(id) ON DELETE RESTRICT,
  order_id uuid NOT NULL
    REFERENCES public.pedidos(id) ON DELETE RESTRICT,
  customer_id uuid
    REFERENCES public.clientes(id) ON DELETE SET NULL,
  commission_plan_id uuid NOT NULL
    REFERENCES public.commission_plans(id) ON DELETE RESTRICT,
  commission_level integer NOT NULL CHECK (commission_level BETWEEN 1 AND 10),
  commission_type text NOT NULL
    CHECK (commission_type IN ('network_percentage', 'first_purchase_bonus')),
  commissionable_amount numeric(12,2) NOT NULL
    CHECK (commissionable_amount >= 0),
  order_amount_snapshot numeric(12,2) NOT NULL
    CHECK (order_amount_snapshot >= 0),
  percentage_snapshot numeric(5,2) NOT NULL
    CHECK (percentage_snapshot BETWEEN 0 AND 100),
  lost_amount numeric(12,2) NOT NULL CHECK (lost_amount >= 0),
  qualification_period_start date NOT NULL,
  qualification_period_end date NOT NULL,
  reason text NOT NULL DEFAULT 'ambassador_not_qualified'
    CHECK (reason = 'ambassador_not_qualified'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ambassador_lost_commissions_order_amb_level_type_key
    UNIQUE (order_id, ambassador_id, commission_level, commission_type)
);

COMMENT ON TABLE private.ambassador_lost_commissions IS
  'Trilha imutável de oportunidades de comissão bloqueadas por falta de ativação mensal.';

CREATE INDEX IF NOT EXISTS idx_ambassador_lost_commissions_ambassador_created
  ON private.ambassador_lost_commissions(ambassador_id, created_at DESC);

ALTER TABLE private.ambassador_lost_commissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.ambassador_lost_commissions
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE private.ambassador_lost_commissions
  TO service_role;

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
  v_period_start date;
  v_period_end date;
  v_deadline date;
  v_days_remaining integer;
  v_deadline_day integer := 15;
  v_enabled boolean := true;
  v_minimum numeric := 79;
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
    RETURN jsonb_build_object(
      'status', 'not_qualified',
      'qualified', false,
      'code', 'ambassador_inactive'
    );
  END IF;

  IF v_role = 'embaixador' AND v_ambassador.user_id <> v_actor THEN
    RAISE EXCEPTION 'ambassador_qualification_access_denied'
      USING ERRCODE = '42501';
  END IF;

  SELECT
    coalesce(monthly_activation_enabled, true),
    coalesce(monthly_activation_amount, 79),
    coalesce(activation_deadline_day, 15)
  INTO v_enabled, v_minimum, v_deadline_day
  FROM public.ambassador_program_settings
  WHERE singleton;

  SELECT cycle.period_start,
         cycle.period_end,
         cycle.qualification_deadline,
         cycle.days_remaining
  INTO v_period_start, v_period_end, v_deadline, v_days_remaining
  FROM private.ambassador_activation_cycle(
    p_reference_date,
    v_deadline_day
  ) cycle;

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
    AND p.created_at < (v_deadline + 1)::timestamptz
    AND p.status_pedido IN ('entregue', 'finalizado')
    AND p.payment_check_status = 'confirmado';

  v_status := CASE
    WHEN NOT v_enabled OR v_minimum <= 0 THEN 'qualified'
    WHEN v_exception_id IS NOT NULL THEN 'exception'
    WHEN v_personal_purchase >= v_minimum THEN 'qualified'
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
      'currency', 'BRL',
      'deadline', v_deadline,
      'deadline_day', v_deadline_day,
      'evaluated_reference_date', p_reference_date
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
    'period_end', v_period_end,
    'deadline', v_deadline,
    'days_remaining', v_days_remaining,
    'minimum_amount', v_minimum,
    'personal_purchase_amount', v_personal_purchase,
    'deadline_passed', p_reference_date > v_deadline
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_evaluate_ambassador_qualification(uuid, date)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_evaluate_ambassador_qualification(uuid, date)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.skip_unqualified_commission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_order_created_at timestamptz;
  v_period_start date;
  v_period_end date;
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL AND coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;

  SELECT created_at
  INTO v_order_created_at
  FROM public.pedidos
  WHERE id = NEW.order_id;

  IF v_order_created_at IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT q.period_start, q.period_end
  INTO v_period_start, v_period_end
  FROM private.ambassador_qualifications q
  WHERE q.ambassador_id = NEW.ambassador_id
    AND v_order_created_at::date BETWEEN q.period_start AND q.period_end
    AND q.rule_code = 'monthly_purchase_qualification'
    AND q.status IN ('qualified', 'exception')
  ORDER BY q.evaluated_at DESC NULLS LAST, q.created_at DESC
  LIMIT 1;

  IF v_period_start IS NULL THEN
    SELECT cycle.period_start, cycle.period_end
    INTO v_period_start, v_period_end
    FROM private.ambassador_activation_cycle(
      v_order_created_at::date,
      (
        SELECT coalesce(activation_deadline_day, 15)
        FROM public.ambassador_program_settings
        WHERE singleton
      )
    ) cycle;

    INSERT INTO private.ambassador_lost_commissions (
      ambassador_id, order_id, customer_id, commission_plan_id,
      commission_level, commission_type, commissionable_amount,
      order_amount_snapshot, percentage_snapshot, lost_amount,
      qualification_period_start, qualification_period_end
    ) VALUES (
      NEW.ambassador_id, NEW.order_id, NEW.customer_id,
      NEW.commission_plan_id, NEW.commission_level, NEW.commission_type,
      NEW.commissionable_amount, NEW.order_amount_snapshot,
      NEW.percentage_snapshot, NEW.commission_amount,
      v_period_start, v_period_end
    )
    ON CONFLICT (
      order_id, ambassador_id, commission_level, commission_type
    ) DO NOTHING;

    IF v_actor IS NOT NULL THEN
      INSERT INTO private.phase1_audit_events (
        actor_id, event_type, entity_type, entity_id, outcome_code, metadata
      ) VALUES (
        v_actor,
        'commission_skipped_unqualified',
        'order',
        NEW.order_id,
        'ambassador_not_qualified',
        jsonb_build_object(
          'operation_scope', 'commission_generation',
          'operation_type', 'skip_unqualified_network_level',
          'ambassador_id', NEW.ambassador_id
        )
      );
    END IF;

    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.skip_unqualified_commission()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.mark_customer_eligible_after_purchase()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_customer public.clientes%ROWTYPE;
  v_minimum numeric := 79;
  v_actor uuid := auth.uid();
BEGIN
  IF NEW.status_pedido NOT IN ('entregue', 'finalizado')
     OR NEW.payment_check_status <> 'confirmado' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.status_pedido IN ('entregue', 'finalizado')
     AND OLD.payment_check_status = 'confirmado' THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(first_purchase_minimum_amount, 79)
  INTO v_minimum
  FROM public.ambassador_program_settings
  WHERE singleton;

  IF coalesce(NEW.valor_total, 0) < v_minimum THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_customer
  FROM public.clientes
  WHERE id = NEW.cliente_id
    AND lifecycle_status = 'active'
  FOR SHARE;

  IF v_customer.id IS NULL
     OR v_customer.person_id IS NULL
     OR v_customer.own_ambassador_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF v_actor IS NULL THEN
    SELECT id INTO v_actor
    FROM public.profiles
    WHERE role = 'admin' AND ativo
    ORDER BY created_at, id
    LIMIT 1;
  END IF;

  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'eligibility_actor_unavailable' USING ERRCODE = '42501';
  END IF;

  INSERT INTO private.ambassador_invitation_eligibilities (
    person_id, customer_id, eligibility_type, eligibility_label,
    status, source, evidence_code, marked_by, eligible_at
  ) VALUES (
    v_customer.person_id,
    v_customer.id,
    'qualifying_purchase',
    'Elegível por compra confirmada de R$ 79 ou mais',
    'eligible',
    'qualifying_purchase_trigger',
    'confirmed_purchase_minimum_79',
    v_actor,
    coalesce(NEW.finalized_at, NEW.updated_at, now())
  )
  ON CONFLICT (person_id) WHERE status = 'eligible'
  DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.mark_customer_eligible_after_purchase()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_mark_customer_eligible_after_purchase
  ON public.pedidos;
CREATE TRIGGER trg_mark_customer_eligible_after_purchase
AFTER INSERT OR UPDATE OF status_pedido, payment_check_status, valor_total
ON public.pedidos
FOR EACH ROW
EXECUTE FUNCTION private.mark_customer_eligible_after_purchase();

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
    AND p.ativo = true
    AND p.must_change_password = false
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

  RETURN v_result || jsonb_build_object(
    'first_purchase_bonus_total', v_first_purchase_bonus_total,
    'lost_commission_total', v_lost_commission_total,
    'lost_commission_month', v_lost_commission_month,
    'activation', v_activation
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_get_embaixador_dashboard_metrics()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_get_embaixador_dashboard_metrics()
  TO authenticated, service_role;

COMMIT;
