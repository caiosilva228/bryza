-- Controle operacional dos agendamentos da loja virtual.
-- O painel altera esta configuração e o checkout consulta/valida tudo no servidor.

ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS periodo text NOT NULL DEFAULT 'qualquer';

DO $$
BEGIN
  ALTER TABLE public.agendamentos
    ADD CONSTRAINT agendamentos_periodo_check
    CHECK (periodo IN ('manhademanha', 'tarde', 'noite', 'qualquer', 'ate_3_horas'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.agendamento_controle (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  automatico_ativo boolean NOT NULL DEFAULT true,
  mesmo_dia_ativo boolean NOT NULL DEFAULT true,
  antecedencia_mesmo_dia_horas integer NOT NULL DEFAULT 3
    CHECK (antecedencia_mesmo_dia_horas BETWEEN 1 AND 24),
  limite_pedidos_dia integer NULL
    CHECK (limite_pedidos_dia IS NULL OR limite_pedidos_dia BETWEEN 1 AND 10000),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.agendamento_controle (singleton)
VALUES (true)
ON CONFLICT (singleton) DO NOTHING;

ALTER TABLE public.agendamento_controle ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.agendamento_controle FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.agendamento_controle TO service_role;

CREATE INDEX IF NOT EXISTS idx_agendamentos_capacity_date_status
  ON public.agendamentos (data_agendamento, status);

-- Wrapper transacional da função existente da loja. O wrapper mantém a lógica
-- de kits/preços/idempotência em um único lugar e adiciona a capacidade diária.
-- O lock na linha singleton serializa dois checkouts concorrentes antes da
-- contagem e impede que ambos ultrapassem o limite configurado.
CREATE OR REPLACE FUNCTION public.fn_create_store_agendamento_with_control(
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
  v_control public.agendamento_controle%ROWTYPE;
  v_requested_date timestamptz;
  v_date timestamptz;
  v_schedule_date date;
  v_today date;
  v_period text;
  v_active_count integer;
  v_payload jsonb;
  v_result jsonb;
  v_schedule_id uuid;
BEGIN
  IF coalesce(auth.jwt()->>'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501';
  END IF;
  IF p_idempotency_key IS NULL OR p_agendamento_data IS NULL OR p_items_data IS NULL THEN
    RAISE EXCEPTION 'invalid_store_checkout_payload' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_agendamento_data) <> 'object' THEN
    RAISE EXCEPTION 'invalid_store_checkout_payload' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_items_data) <> 'array'
     OR jsonb_array_length(p_items_data) < 1
     OR jsonb_array_length(p_items_data) > 50 THEN
    RAISE EXCEPTION 'invalid_store_checkout_payload' USING ERRCODE = '22023';
  END IF;

  -- Idempotência vem antes da capacidade: repetir um checkout já aceito não
  -- consome uma nova vaga e continua retornando o mesmo agendamento.
  SELECT * INTO v_existing
  FROM public.agendamentos
  WHERE submission_id = p_idempotency_key
  FOR UPDATE;
  IF v_existing.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'sucesso', true,
      'idempotente', true,
      'agendamento_id', v_existing.id,
      'numero_agendamento', v_existing.numero_agendamento,
      'data_agendamento', v_existing.data_agendamento,
      'valor_total', v_existing.valor_total
    );
  END IF;

  SELECT * INTO v_control
  FROM public.agendamento_controle
  WHERE singleton = true
  FOR UPDATE;
  IF v_control.singleton IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'scheduling_control_unavailable' USING ERRCODE = 'P0001';
  END IF;
  IF v_control.automatico_ativo IS NOT TRUE THEN
    RAISE EXCEPTION 'scheduling_paused' USING ERRCODE = 'P0001';
  END IF;

  v_period := lower(btrim(coalesce(p_agendamento_data->>'periodo', 'qualquer')));
  IF v_period NOT IN ('manhademanha', 'tarde', 'noite', 'qualquer', 'ate_3_horas') THEN
    RAISE EXCEPTION 'invalid_scheduling_period' USING ERRCODE = '22023';
  END IF;

  BEGIN
    v_requested_date := (p_agendamento_data->>'data_agendamento')::timestamptz;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'scheduling_date_out_of_range' USING ERRCODE = '22023';
  END;
  IF v_requested_date IS NULL THEN
    RAISE EXCEPTION 'scheduling_date_out_of_range' USING ERRCODE = '22023';
  END IF;

  v_schedule_date := (v_requested_date AT TIME ZONE 'America/Sao_Paulo')::date;
  v_today := (now() AT TIME ZONE 'America/Sao_Paulo')::date;

  IF v_period = 'ate_3_horas' THEN
    IF v_control.mesmo_dia_ativo IS NOT TRUE THEN
      RAISE EXCEPTION 'same_day_scheduling_disabled' USING ERRCODE = 'P0001';
    END IF;
    IF v_schedule_date <> v_today THEN
      RAISE EXCEPTION 'same_day_scheduling_disabled' USING ERRCODE = 'P0001';
    END IF;

    v_date := now() + make_interval(hours => v_control.antecedencia_mesmo_dia_horas);
    IF (v_date AT TIME ZONE 'America/Sao_Paulo')::date <> v_today THEN
      RAISE EXCEPTION 'same_day_window_closed' USING ERRCODE = 'P0001';
    END IF;
  ELSE
    IF v_schedule_date <= v_today OR v_schedule_date > v_today + 180 THEN
      RAISE EXCEPTION 'scheduling_date_out_of_range' USING ERRCODE = '22023';
    END IF;
    v_date := (v_schedule_date + time '12:00') AT TIME ZONE 'America/Sao_Paulo';
  END IF;

  IF v_control.limite_pedidos_dia IS NOT NULL THEN
    SELECT count(*) INTO v_active_count
    FROM public.agendamentos
    WHERE data_agendamento >= (v_schedule_date + time '00:00') AT TIME ZONE 'America/Sao_Paulo'
      AND data_agendamento < ((v_schedule_date + 1) + time '00:00') AT TIME ZONE 'America/Sao_Paulo'
      AND status IS DISTINCT FROM 'cancelado'::status_agendamento;

    IF v_active_count >= v_control.limite_pedidos_dia THEN
      RAISE EXCEPTION 'scheduling_daily_limit_reached' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  v_payload := jsonb_set(p_agendamento_data, '{data_agendamento}', to_jsonb(v_date::text), true);
  v_payload := jsonb_set(v_payload, '{periodo}', to_jsonb(v_period), true);

  v_result := public.fn_create_store_agendamento_with_kits(
    v_payload,
    p_items_data,
    p_idempotency_key
  );

  v_schedule_id := NULLIF(v_result->>'agendamento_id', '')::uuid;
  IF v_schedule_id IS NOT NULL AND coalesce((v_result->>'sucesso')::boolean, false) THEN
    UPDATE public.agendamentos
    SET data_agendamento = v_date,
        periodo = v_period,
        updated_at = now()
    WHERE id = v_schedule_id;
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_create_store_agendamento_with_control(jsonb, jsonb, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_create_store_agendamento_with_control(jsonb, jsonb, uuid)
  TO service_role;
