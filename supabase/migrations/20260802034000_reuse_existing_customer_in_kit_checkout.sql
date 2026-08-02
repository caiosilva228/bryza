-- A conta autenticada e o papel de cliente podem, por legado, ter person_id
-- distintos para a mesma pessoa. O checkout canônico antigo prioriza o
-- fingerprint da conta e acaba tentando criar outro cliente com o mesmo CPF.
-- Este adaptador faz o fingerprint apontar para o cliente somente durante a
-- transação do agendamento e restaura a identidade da conta antes do commit.

CREATE OR REPLACE FUNCTION public.fn_criar_agendamento_publico_kit(
  p_cliente_data jsonb,
  p_itens_data jsonb,
  p_atribuicao jsonb,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_result jsonb;
  v_agendamento_id uuid;
  v_net_total numeric(12,2);
  v_cpf text := regexp_replace(
    coalesce(p_cliente_data->>'cpf', ''),
    '[^0-9]',
    '',
    'g'
  );
  v_customer_person_id uuid;
  v_cpf_fingerprint bytea;
  v_conflicting_fingerprint_id uuid;
  v_conflicting_was_primary boolean;
  v_temporary_fingerprint_id uuid;
BEGIN
  PERFORM set_config('bryza.public_kit_full_discount', 'true', true);
  PERFORM public.fn_repair_existing_public_customer_identity(p_cliente_data);

  IF v_cpf ~ '^[0-9]{11}$' THEN
    SELECT c.person_id
    INTO v_customer_person_id
    FROM public.clientes c
    WHERE c.cpf = v_cpf
      AND c.person_id IS NOT NULL
      AND c.lifecycle_status = 'active'
    ORDER BY c.data_cadastro, c.id
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF v_customer_person_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM private.person_identity_fingerprints own
       WHERE own.person_id = v_customer_person_id
         AND own.identifier_type = 'cpf'
         AND own.is_active
     ) THEN
    v_cpf_fingerprint := private.identity_hmac_internal(
      'cpf',
      v_cpf,
      1::smallint
    );

    SELECT f.id, f.is_primary
    INTO v_conflicting_fingerprint_id, v_conflicting_was_primary
    FROM private.person_identity_fingerprints f
    WHERE f.identifier_type = 'cpf'
      AND f.fingerprint = v_cpf_fingerprint
      AND f.is_active
      AND f.person_id <> v_customer_person_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.clientes other_customer
        WHERE other_customer.person_id = f.person_id
          AND other_customer.lifecycle_status = 'active'
      )
    FOR UPDATE;

    IF v_conflicting_fingerprint_id IS NOT NULL THEN
      UPDATE private.person_identity_fingerprints
      SET is_active = false,
          is_primary = false,
          deactivated_at = now()
      WHERE id = v_conflicting_fingerprint_id;

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
        v_customer_person_id,
        'cpf',
        v_cpf_fingerprint,
        1,
        true,
        true,
        now()
      )
      RETURNING id INTO v_temporary_fingerprint_id;
    END IF;
  END IF;

  v_result := public.fn_criar_agendamento_publico(
    p_cliente_data,
    p_itens_data,
    p_atribuicao,
    p_idempotency_key
  );

  IF v_temporary_fingerprint_id IS NOT NULL THEN
    DELETE FROM private.person_identity_fingerprints
    WHERE id = v_temporary_fingerprint_id;

    UPDATE private.person_identity_fingerprints
    SET is_active = true,
        is_primary = v_conflicting_was_primary,
        deactivated_at = NULL
    WHERE id = v_conflicting_fingerprint_id;
  END IF;

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
  IS 'Creates a Kit Bryza scheduling, safely reusing an existing customer even when a legacy account owns the CPF fingerprint.';
