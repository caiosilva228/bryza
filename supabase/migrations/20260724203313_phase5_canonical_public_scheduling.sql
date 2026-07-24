-- Remote migration 20260724203313. Phase 5: public scheduling uses canonical identity and the official referral source.
-- It no longer creates an ambassador record automatically and never writes legacy
-- referral_attributions as an autonomous commission source.

ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS referral_assignment_id uuid,
  ADD COLUMN IF NOT EXISTS referral_validated_snapshot boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS referral_commissionable_snapshot boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ambassador_qualified_snapshot boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ambassador_qualification_id_snapshot uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'agendamentos_referral_assignment_id_fkey'
      AND conrelid = 'public.agendamentos'::regclass
  ) THEN
    ALTER TABLE public.agendamentos
      ADD CONSTRAINT agendamentos_referral_assignment_id_fkey
      FOREIGN KEY (referral_assignment_id)
      REFERENCES private.customer_ambassador_assignments(id)
      ON DELETE RESTRICT NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'agendamentos_ambassador_qualification_id_fkey'
      AND conrelid = 'public.agendamentos'::regclass
  ) THEN
    ALTER TABLE public.agendamentos
      ADD CONSTRAINT agendamentos_ambassador_qualification_id_fkey
      FOREIGN KEY (ambassador_qualification_id_snapshot)
      REFERENCES private.ambassador_qualifications(id)
      ON DELETE RESTRICT NOT VALID;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_agendamentos_referral_assignment_id
  ON public.agendamentos(referral_assignment_id)
  WHERE referral_assignment_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fn_criar_agendamento_publico(
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
  v_actor uuid;
  v_existing public.agendamentos%ROWTYPE;
  v_referrer public.ambassadors%ROWTYPE;
  v_official_referrer public.ambassadors%ROWTYPE;
  v_visit public.referral_visits%ROWTYPE;
  v_customer public.clientes%ROWTYPE;
  v_person_id uuid;
  v_candidate_ids uuid[];
  v_conflict_types text[] := ARRAY[]::text[];
  v_review_id uuid;
  v_cpf text := regexp_replace(coalesce(p_cliente_data->>'cpf', ''), '[^0-9]', '', 'g');
  v_phone text := regexp_replace(coalesce(p_cliente_data->>'telefone', ''), '[^0-9]', '', 'g');
  v_email text := lower(nullif(btrim(coalesce(p_cliente_data->>'email', '')), ''));
  v_cep text := regexp_replace(coalesce(p_cliente_data->>'cep', ''), '[^0-9]', '', 'g');
  v_code text := lower(btrim(coalesce(p_atribuicao->>'referral_code', '')));
  v_cpf_fp bytea;
  v_phone_fp bytea;
  v_email_fp bytea;
  v_review_fp bytea;
  v_payload_hash bytea;
  v_idempotency private.operation_idempotency%ROWTYPE;
  v_date timestamptz;
  v_total numeric(12,2) := 0;
  v_item jsonb;
  v_product public.produtos%ROWTYPE;
  v_qty integer;
  v_assignment private.customer_ambassador_assignments%ROWTYPE;
  v_qualification jsonb;
  v_schedule_id uuid;
  v_attribution_days integer := 30;
BEGIN
  SELECT p.id INTO v_actor
  FROM public.profiles p
  WHERE p.role = 'admin' AND p.ativo
  ORDER BY p.created_at, p.id
  LIMIT 1;

  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'public_scheduling_system_actor_unavailable' USING ERRCODE = '55000';
  END IF;

  IF p_idempotency_key IS NULL
     OR jsonb_typeof(p_cliente_data) <> 'object'
     OR jsonb_typeof(p_itens_data) <> 'array'
     OR jsonb_array_length(p_itens_data) < 1
     OR jsonb_array_length(p_itens_data) > 20 THEN
    RAISE EXCEPTION 'invalid_public_scheduling_payload' USING ERRCODE = '22023';
  END IF;

  v_payload_hash := extensions.digest(
    convert_to(
      jsonb_build_object(
        'customer', p_cliente_data,
        'items', p_itens_data,
        'attribution', p_atribuicao
      )::text,
      'UTF8'
    ),
    'sha256'
  );

  INSERT INTO private.operation_idempotency (
    operation_scope, idempotency_key, operation_type, payload_hash,
    actor_id, lease_expires_at
  )
  VALUES (
    'public_scheduling_create', p_idempotency_key, 'create_scheduling',
    v_payload_hash, v_actor, now() + interval '5 minutes'
  )
  ON CONFLICT (operation_scope, idempotency_key) DO NOTHING;

  SELECT * INTO v_idempotency
  FROM private.operation_idempotency
  WHERE operation_scope = 'public_scheduling_create'
    AND idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF v_idempotency.payload_hash IS DISTINCT FROM v_payload_hash THEN
    INSERT INTO private.phase1_audit_events (
      actor_id, event_type, entity_type, entity_id, outcome_code, metadata
    ) VALUES (
      v_actor, 'idempotency_conflict', 'operation_idempotency',
      v_idempotency.id, 'idempotency_conflict',
      jsonb_build_object(
        'operation_scope', 'public_scheduling_create',
        'operation_type', 'create_scheduling',
        'idempotency_key', p_idempotency_key,
        'actor_type', 'public_checkout'
      )
    );
    RETURN jsonb_build_object('status', 'idempotency_conflict');
  END IF;

  IF v_idempotency.status = 'completed' THEN
    RETURN v_idempotency.original_result || jsonb_build_object('replayed', true);
  END IF;

  IF length(btrim(coalesce(p_cliente_data->>'nome', ''))) < 3
     OR v_cpf !~ '^[0-9]{11}$'
     OR v_phone !~ '^[0-9]{10,11}$'
     OR (v_cep <> '' AND v_cep !~ '^[0-9]{8}$')
     OR upper(coalesce(p_cliente_data->>'estado', '')) !~ '^[A-Z]{2}$'
     OR lower(coalesce(p_cliente_data->>'forma_pagamento', ''))
       NOT IN ('dinheiro', 'pix', 'cartao') THEN
    RAISE EXCEPTION 'invalid_public_customer_data' USING ERRCODE = '22023';
  END IF;

  BEGIN
    v_date := (p_cliente_data->>'data_agendamento')::timestamptz;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'invalid_scheduling_date' USING ERRCODE = '22023';
  END;

  IF v_date < now() + interval '30 minutes'
     OR v_date > now() + interval '180 days' THEN
    RAISE EXCEPTION 'scheduling_date_out_of_range' USING ERRCODE = '22023';
  END IF;

  SELECT referral_attribution_days INTO v_attribution_days
  FROM public.ambassador_program_settings
  WHERE singleton;

  SELECT * INTO v_referrer
  FROM public.ambassadors
  WHERE referral_code = v_code
    AND status = 'ativo'
    AND lifecycle_status = 'active'
  FOR SHARE;

  IF v_referrer.id IS NULL THEN
    RAISE EXCEPTION 'invalid_or_inactive_referral';
  END IF;

  IF nullif(p_atribuicao->>'visit_id', '') IS NULL THEN
    RAISE EXCEPTION 'missing_referral_visit';
  END IF;

  SELECT * INTO v_visit
  FROM public.referral_visits
  WHERE id = (p_atribuicao->>'visit_id')::uuid
    AND ambassador_id = v_referrer.id
    AND referral_code = v_referrer.referral_code
    AND visited_at >= now() - make_interval(days => coalesce(v_attribution_days, 30))
  FOR SHARE;

  IF v_visit.id IS NULL THEN
    RAISE EXCEPTION 'invalid_or_expired_referral_visit';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens_data)
  LOOP
    BEGIN
      v_qty := (v_item->>'quantidade')::integer;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'invalid_item_quantity' USING ERRCODE = '22023';
    END;

    SELECT * INTO v_product
    FROM public.produtos
    WHERE id = (v_item->>'produto_id')::uuid
      AND ativo
    FOR SHARE;

    IF v_product.id IS NULL OR v_qty < 1 OR v_qty > 100 THEN
      RAISE EXCEPTION 'invalid_or_unavailable_product' USING ERRCODE = '22023';
    END IF;

    v_total := v_total + round(v_product.preco_venda * v_qty, 2);
  END LOOP;

  v_cpf_fp := private.identity_hmac_internal('cpf', v_cpf, 1::smallint);
  v_phone_fp := private.identity_hmac_internal('phone', v_phone, 1::smallint);
  IF v_email IS NOT NULL THEN
    v_email_fp := private.identity_hmac_internal('email', v_email, 1::smallint);
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(encode(v_cpf_fp, 'hex') || encode(v_phone_fp, 'hex'), 0)
  );

  SELECT coalesce(array_agg(DISTINCT f.person_id), ARRAY[]::uuid[])
  INTO v_candidate_ids
  FROM private.person_identity_fingerprints f
  WHERE f.is_active
    AND (
      (f.identifier_type = 'cpf' AND f.fingerprint = v_cpf_fp)
      OR (f.identifier_type = 'phone' AND f.fingerprint = v_phone_fp)
      OR (v_email_fp IS NOT NULL AND f.identifier_type = 'email' AND f.fingerprint = v_email_fp)
    );

  IF cardinality(v_candidate_ids) > 1 THEN
    IF EXISTS (
      SELECT 1 FROM private.person_identity_fingerprints
      WHERE is_active AND identifier_type = 'cpf' AND fingerprint = v_cpf_fp
    ) THEN v_conflict_types := array_append(v_conflict_types, 'cpf_points_to_different_person'); END IF;
    IF EXISTS (
      SELECT 1 FROM private.person_identity_fingerprints
      WHERE is_active AND identifier_type = 'phone' AND fingerprint = v_phone_fp
    ) THEN v_conflict_types := array_append(v_conflict_types, 'phone_points_to_different_person'); END IF;
    IF v_email_fp IS NOT NULL AND EXISTS (
      SELECT 1 FROM private.person_identity_fingerprints
      WHERE is_active AND identifier_type = 'email' AND fingerprint = v_email_fp
    ) THEN v_conflict_types := array_append(v_conflict_types, 'email_points_to_different_person'); END IF;

    v_review_fp := extensions.digest(
      convert_to(
        'public_scheduling:' || encode(v_cpf_fp, 'hex') || ':' ||
        encode(v_phone_fp, 'hex') || ':' || coalesce(encode(v_email_fp, 'hex'), ''),
        'UTF8'
      ),
      'sha256'
    );

    v_review_id := private.persist_identity_review_internal(
      v_actor,
      v_review_fp,
      v_conflict_types,
      'public_scheduling_create',
      v_candidate_ids,
      'public_scheduling',
      NULL
    );

    UPDATE private.operation_idempotency
    SET status = 'completed',
        original_result = jsonb_build_object(
          'status', 'manual_review_required',
          'review_id', v_review_id
        ),
        processed_at = now(),
        lease_expires_at = NULL,
        updated_at = now()
    WHERE id = v_idempotency.id;

    RETURN jsonb_build_object(
      'status', 'manual_review_required',
      'review_id', v_review_id
    );
  END IF;

  IF cardinality(v_candidate_ids) = 1 THEN
    v_person_id := v_candidate_ids[1];
  ELSE
    INSERT INTO private.persons (
      full_name, cpf_normalized, email_normalized, phone_normalized
    ) VALUES (
      btrim(p_cliente_data->>'nome'), v_cpf, v_email, v_phone
    )
    RETURNING id INTO v_person_id;

    INSERT INTO private.person_identity_fingerprints (
      person_id, identifier_type, fingerprint, verified_at
    ) VALUES
      (v_person_id, 'cpf', v_cpf_fp, now()),
      (v_person_id, 'phone', v_phone_fp, now());

    IF v_email_fp IS NOT NULL THEN
      INSERT INTO private.person_identity_fingerprints (
        person_id, identifier_type, fingerprint, verified_at
      ) VALUES (v_person_id, 'email', v_email_fp, now());
    END IF;
  END IF;

  SELECT * INTO v_customer
  FROM public.clientes
  WHERE person_id = v_person_id
    AND lifecycle_status = 'active'
  ORDER BY data_cadastro
  LIMIT 1
  FOR UPDATE;

  PERFORM set_config('bryza.canonical_identity_write', 'true', true);

  IF v_customer.id IS NULL THEN
    INSERT INTO public.clientes (
      person_id, nome, cpf, telefone, email, endereco, numero, bairro,
      cidade, estado, cep, origem, status_cliente
    ) VALUES (
      v_person_id, btrim(p_cliente_data->>'nome'), v_cpf, v_phone, v_email,
      btrim(p_cliente_data->>'endereco'), btrim(p_cliente_data->>'numero'),
      btrim(p_cliente_data->>'bairro'), btrim(p_cliente_data->>'cidade'),
      upper(p_cliente_data->>'estado'), nullif(v_cep, ''),
      'pagina_vendas', 'lead'
    )
    RETURNING * INTO v_customer;

    INSERT INTO private.person_business_roles (
      person_id, role_type, source_entity_id, status, activated_at
    ) VALUES (
      v_person_id, 'customer', v_customer.id, 'active', now()
    )
    ON CONFLICT (person_id, role_type) DO UPDATE
      SET source_entity_id = EXCLUDED.source_entity_id,
          status = 'active',
          activated_at = coalesce(private.person_business_roles.activated_at, now()),
          updated_at = now();
  ELSE
    UPDATE public.clientes
    SET nome = btrim(p_cliente_data->>'nome'),
        telefone = v_phone,
        email = coalesce(v_email, email),
        endereco = btrim(p_cliente_data->>'endereco'),
        numero = btrim(p_cliente_data->>'numero'),
        bairro = btrim(p_cliente_data->>'bairro'),
        cidade = btrim(p_cliente_data->>'cidade'),
        estado = upper(p_cliente_data->>'estado'),
        cep = nullif(v_cep, '')
    WHERE id = v_customer.id
    RETURNING * INTO v_customer;
  END IF;

  SELECT * INTO v_assignment
  FROM private.customer_ambassador_assignments
  WHERE customer_id = v_customer.id
    AND status = 'active'
  FOR UPDATE;

  IF v_assignment.id IS NULL
     AND NOT (
       v_customer.person_id IS NOT NULL
       AND v_referrer.person_id IS NOT NULL
       AND v_customer.person_id = v_referrer.person_id
     ) THEN
    INSERT INTO private.customer_ambassador_assignments (
      customer_id, ambassador_id, status, is_validated, is_commissionable,
      source, evidence_code, assigned_by, reason
    ) VALUES (
      v_customer.id, v_referrer.id, 'active', true, true,
      'smart_link', 'verified_signed_visit', v_actor,
      'Atribuição validada por visita assinada no checkout público.'
    )
    RETURNING * INTO v_assignment;

    PERFORM set_config('bryza.canonical_referral_write', 'true', true);
    UPDATE public.clientes
    SET commissionable_ambassador_id = v_referrer.id,
        current_referral_assignment_id = v_assignment.id,
        ambassador_id = v_referrer.id,
        referral_code = v_referrer.referral_code,
        referral_source = 'smart_link',
        referral_attributed_at = now(),
        referral_locked_at = now()
    WHERE id = v_customer.id;
  END IF;

  IF v_assignment.id IS NOT NULL
     AND v_assignment.is_validated
     AND v_assignment.is_commissionable THEN
    SELECT * INTO v_official_referrer
    FROM public.ambassadors
    WHERE id = v_assignment.ambassador_id
      AND status = 'ativo'
      AND lifecycle_status = 'active';

    IF v_official_referrer.id IS NOT NULL THEN
      v_qualification := public.fn_evaluate_ambassador_qualification(
        v_official_referrer.id,
        v_date::date
      );
    END IF;
  END IF;

  INSERT INTO public.agendamentos (
    submission_id, data_agendamento, status, cliente_id, vendedor_id,
    valor_total, forma_pagamento, observacoes,
    nome_cliente, telefone_cliente, endereco_entrega, bairro, cidade, estado, cep,
    ambassador_id, referral_visit_id, referral_code_snapshot,
    attributed_at, attribution_source, referral_assignment_id,
    referral_validated_snapshot, referral_commissionable_snapshot,
    ambassador_qualified_snapshot, ambassador_qualification_id_snapshot
  ) VALUES (
    p_idempotency_key, v_date, 'agendado', v_customer.id, NULL,
    v_total, lower(p_cliente_data->>'forma_pagamento'),
    'Agendamento criado pela página de vendas.',
    v_customer.nome, v_customer.telefone,
    v_customer.endereco || coalesce(', ' || nullif(v_customer.numero, ''), ''),
    v_customer.bairro, v_customer.cidade, v_customer.estado, v_customer.cep,
    v_official_referrer.id, v_visit.id, v_official_referrer.referral_code,
    CASE WHEN v_assignment.id IS NOT NULL THEN now() END,
    CASE WHEN v_assignment.id IS NOT NULL THEN v_assignment.source::public.attribution_source_type END,
    v_assignment.id,
    coalesce(v_assignment.is_validated, false),
    coalesce(v_assignment.is_commissionable, false)
      AND coalesce((v_qualification->>'qualified')::boolean, false),
    coalesce((v_qualification->>'qualified')::boolean, false),
    nullif(v_qualification->>'qualification_id', '')::uuid
  )
  RETURNING id INTO v_schedule_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens_data)
  LOOP
    v_qty := (v_item->>'quantidade')::integer;
    SELECT * INTO v_product FROM public.produtos
    WHERE id = (v_item->>'produto_id')::uuid;

    INSERT INTO public.agendamento_itens (
      agendamento_id, produto_id, quantidade, preco_unitario, subtotal
    ) VALUES (
      v_schedule_id, v_product.id, v_qty, v_product.preco_venda,
      round(v_product.preco_venda * v_qty, 2)
    );
  END LOOP;

  SELECT * INTO v_existing FROM public.agendamentos WHERE id = v_schedule_id;

  UPDATE private.operation_idempotency
  SET customer_id = v_customer.id,
      status = 'completed',
      original_result = jsonb_build_object(
        'status', 'created',
        'agendamento_id', v_schedule_id,
        'numero_agendamento', v_existing.numero_agendamento,
        'data_agendamento', v_existing.data_agendamento,
        'valor_total', v_total,
        'program_invitation_available', true
      ),
      processed_at = now(),
      lease_expires_at = NULL,
      updated_at = now()
  WHERE id = v_idempotency.id;

  INSERT INTO private.phase1_audit_events (
    actor_id, event_type, entity_type, entity_id, outcome_code, metadata
  ) VALUES (
    v_actor, 'canonical_public_scheduling_created', 'scheduling',
    v_schedule_id, 'created',
    jsonb_build_object(
      'operation_scope', 'public_scheduling_create',
      'idempotency_key', p_idempotency_key,
      'official_assignment_id', v_assignment.id,
      'actor_type', 'public_checkout'
    )
  );

  RETURN jsonb_build_object(
    'status', 'created',
    'agendamento_id', v_schedule_id,
    'numero_agendamento', v_existing.numero_agendamento,
    'data_agendamento', v_existing.data_agendamento,
    'valor_total', v_total,
    'program_invitation_available', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_criar_agendamento_publico(jsonb, jsonb, jsonb, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_criar_agendamento_publico(jsonb, jsonb, jsonb, uuid)
  TO service_role;

COMMENT ON FUNCTION public.fn_criar_agendamento_publico(jsonb, jsonb, jsonb, uuid)
  IS 'Canonical public scheduling. Persists identity conflicts, uses only official referral assignments, and never auto-creates ambassadors.';
