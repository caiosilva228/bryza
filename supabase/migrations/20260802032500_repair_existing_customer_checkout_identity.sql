-- Clientes legados podem ter CPF e person_id, mas não possuir o fingerprint
-- canônico usado pelo checkout. Nesse cenário, o checkout tenta criar um novo
-- cliente e encontra a restrição de CPF único. Repara os registros existentes
-- e garante a conciliação antes de cada compra pública do Kit Bryza.

CREATE OR REPLACE FUNCTION public.fn_repair_existing_public_customer_identity(
  p_cliente_data jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_cpf text := regexp_replace(
    coalesce(p_cliente_data->>'cpf', ''),
    '[^0-9]',
    '',
    'g'
  );
  v_person_id uuid;
  v_cpf_fingerprint bytea;
BEGIN
  IF v_cpf !~ '^[0-9]{11}$' THEN
    RETURN;
  END IF;

  SELECT c.person_id
  INTO v_person_id
  FROM public.clientes c
  WHERE c.cpf = v_cpf
    AND c.person_id IS NOT NULL
    AND c.lifecycle_status = 'active'
  ORDER BY c.data_cadastro, c.id
  LIMIT 1;

  IF v_person_id IS NULL THEN
    RETURN;
  END IF;

  v_cpf_fingerprint := private.identity_hmac_internal(
    'cpf',
    v_cpf,
    1::smallint
  );

  -- Nunca funde duas pessoas silenciosamente. Se o fingerprint já pertence a
  -- outra pessoa, a função canônica preserva o tratamento de conflito.
  IF EXISTS (
    SELECT 1
    FROM private.person_identity_fingerprints f
    WHERE f.identifier_type = 'cpf'
      AND f.fingerprint = v_cpf_fingerprint
      AND f.is_active
      AND f.person_id <> v_person_id
  ) THEN
    RETURN;
  END IF;

  INSERT INTO private.person_identity_fingerprints (
    person_id,
    identifier_type,
    fingerprint,
    key_version,
    is_primary,
    is_active,
    verified_at
  )
  VALUES (
    v_person_id,
    'cpf',
    v_cpf_fingerprint,
    1,
    true,
    true,
    now()
  )
  ON CONFLICT DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_repair_existing_public_customer_identity(jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_repair_existing_public_customer_identity(jsonb)
  TO service_role;

DO $$
DECLARE
  v_customer record;
BEGIN
  FOR v_customer IN
    SELECT c.cpf
    FROM public.clientes c
    WHERE c.cpf IS NOT NULL
      AND c.person_id IS NOT NULL
      AND c.lifecycle_status = 'active'
  LOOP
    PERFORM public.fn_repair_existing_public_customer_identity(
      jsonb_build_object('cpf', v_customer.cpf)
    );
  END LOOP;
END;
$$;

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
  PERFORM public.fn_repair_existing_public_customer_identity(p_cliente_data);

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

COMMENT ON FUNCTION public.fn_repair_existing_public_customer_identity(jsonb)
  IS 'Repairs a missing canonical CPF fingerprint for an existing active customer before public checkout.';
