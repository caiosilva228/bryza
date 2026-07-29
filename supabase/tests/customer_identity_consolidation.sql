BEGIN;

DO $$
DECLARE
  v_canonical_id uuid;
  v_duplicate_id uuid;
BEGIN
  SELECT id INTO v_canonical_id
  FROM public.clientes
  WHERE codigo_cliente = 175;

  SELECT id INTO v_duplicate_id
  FROM public.clientes
  WHERE codigo_cliente = 183;

  IF NOT EXISTS (
    SELECT 1 FROM public.clientes
    WHERE id = v_canonical_id
      AND codigo_cliente = 175
      AND lifecycle_status = 'active'
      AND person_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'canonical_customer_assertion_failed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.clientes
    WHERE id = v_duplicate_id
      AND codigo_cliente = 183
      AND lifecycle_status = 'archived'
      AND archived_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'duplicate_archive_assertion_failed';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.agendamentos WHERE cliente_id = v_duplicate_id
    UNION ALL
    SELECT 1 FROM public.pedidos WHERE cliente_id = v_duplicate_id
  ) THEN
    RAISE EXCEPTION 'duplicate_operational_links_remain';
  END IF;

  IF (SELECT count(*) FROM public.agendamentos
      WHERE cliente_id = v_canonical_id) <> 5
     OR (SELECT count(*) FROM public.pedidos
         WHERE cliente_id = v_canonical_id) <> 1 THEN
    RAISE EXCEPTION 'canonical_order_graph_assertion_failed';
  END IF;

  IF EXISTS (
    SELECT regexp_replace(telefone, '[^0-9]', '', 'g')
    FROM public.clientes
    WHERE lifecycle_status = 'active'
    GROUP BY 1 HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'active_phone_duplicates_remain';
  END IF;
END;
$$;

DO $$
DECLARE
  v_customer_id uuid;
  v_expected_id uuid;
  v_result jsonb;
BEGIN
  SELECT id INTO v_expected_id
  FROM public.clientes
  WHERE codigo_cliente = 175;

  v_result := public.fn_upsert_public_customer_canonical(
    p_customer_data => jsonb_build_object(
      'nome', 'Caio Costa Vaz de Lisboa',
      'telefone', '+55 (61) 98211-5107',
      'cpf', '056.207.431-79',
      'endereco', '',
      'numero', '',
      'bairro', '',
      'cidade', '',
      'estado', 'DF',
      'origem', 'db_regression_test'
    ),
    p_referral_code => NULL,
    p_source => 'db_regression_test'
  );
  v_customer_id := (v_result->>'customer_id')::uuid;
  IF v_result->>'status' <> 'resolved'
     OR v_customer_id <> v_expected_id THEN
    RAISE EXCEPTION 'public_canonical_rpc_did_not_reuse_customer';
  END IF;
END;
$$;

-- A direct insert must be rejected before it can bypass canonical identity.
DO $$
BEGIN
  BEGIN
    INSERT INTO public.clientes (
      nome, telefone, endereco, bairro, cidade, estado, origem, status_cliente
    ) VALUES (
      'TESTE DIRETO', '61999999999', '', '', 'Brasilia', 'DF',
      'db_regression_test', 'lead'
    );
    RAISE EXCEPTION 'direct_insert_was_not_blocked';
  EXCEPTION
    WHEN insufficient_privilege THEN
      IF SQLERRM <> 'canonical_customer_insert_required' THEN
        RAISE;
      END IF;
  END;
END;
$$;

-- Even a privileged/canonical write cannot race past the normalized identity
-- constraint.
DO $$
BEGIN
  PERFORM set_config('bryza.canonical_identity_write', 'true', true);
  BEGIN
    INSERT INTO public.clientes (
      nome, telefone, endereco, bairro, cidade, estado, origem, status_cliente
    ) VALUES (
      'TESTE DUPLICADO', '+55 (61) 98211-5107', '', '', 'Brasilia', 'DF',
      'db_regression_test', 'lead'
    );
    RAISE EXCEPTION 'normalized_phone_unique_index_failed';
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
  END;
END;
$$;

ROLLBACK;
