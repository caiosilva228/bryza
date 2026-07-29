-- Scoped canonical service-role entry point for public sales channels that do not
-- have an authenticated admin/seller actor (store and ambassador signup).
CREATE OR REPLACE FUNCTION public.fn_upsert_public_customer_canonical(
  p_customer_data jsonb,
  p_referral_code text DEFAULT NULL,
  p_source text DEFAULT 'public_checkout'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_actor uuid;
  v_customer public.clientes%ROWTYPE;
  v_referrer public.ambassadors%ROWTYPE;
  v_assignment private.customer_ambassador_assignments%ROWTYPE;
  v_person_id uuid;
  v_email_person_id uuid;
  v_candidates uuid[];
  v_customer_ids uuid[];
  v_name text := btrim(coalesce(p_customer_data->>'nome', ''));
  v_phone text := regexp_replace(coalesce(p_customer_data->>'telefone', ''), '[^0-9]', '', 'g');
  v_cpf text := nullif(regexp_replace(coalesce(p_customer_data->>'cpf', ''), '[^0-9]', '', 'g'), '');
  v_email text := nullif(lower(btrim(coalesce(p_customer_data->>'email', ''))), '');
  v_cep text := nullif(regexp_replace(coalesce(p_customer_data->>'cep', ''), '[^0-9]', '', 'g'), '');
  v_origin text := btrim(coalesce(p_customer_data->>'origem', 'public_checkout'));
  v_phone_fp bytea;
  v_cpf_fp bytea;
  v_email_fp bytea;
  v_prior_identity_write text :=
    coalesce(current_setting('bryza.canonical_identity_write', true), '');
  v_prior_referral_write text :=
    coalesce(current_setting('bryza.canonical_referral_write', true), '');
BEGIN
  IF v_phone ~ '^55[0-9]{10,11}$' THEN
    v_phone := substring(v_phone FROM 3);
  END IF;

  IF jsonb_typeof(p_customer_data) <> 'object'
     OR length(v_name) NOT BETWEEN 3 AND 200
     OR v_phone !~ '^[0-9]{10,11}$'
     OR (v_cpf IS NOT NULL AND v_cpf !~ '^[0-9]{11}$')
     OR (v_email IS NOT NULL AND (
       length(v_email) NOT BETWEEN 3 AND 254 OR position('@' IN v_email) <= 1
     ))
     OR length(v_origin) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'invalid_public_customer_payload' USING ERRCODE = '22023';
  END IF;

  SELECT p.id INTO v_actor
  FROM public.profiles p
  WHERE p.role = 'admin' AND p.ativo
  ORDER BY p.created_at, p.id
  LIMIT 1;

  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'public_customer_system_actor_unavailable'
      USING ERRCODE = '55000';
  END IF;

  -- Fixed lock order prevents deadlocks. Separate identifier locks ensure that
  -- concurrent requests sharing only CPF or only phone are still serialized.
  PERFORM pg_advisory_xact_lock(hashtextextended('customer:phone:' || v_phone, 0));
  IF v_cpf IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('customer:cpf:' || v_cpf, 0));
  END IF;
  IF v_email IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('customer:email:' || v_email, 0));
  END IF;

  -- The active customer role is authoritative for sales deduplication. Legacy
  -- staff/ambassador accounts may still have separate person rows for the same
  -- human, but must never create a second active customer.
  SELECT coalesce(array_agg(c.id ORDER BY c.data_cadastro, c.id), ARRAY[]::uuid[])
  INTO v_customer_ids
  FROM public.clientes c
  WHERE c.lifecycle_status = 'active'
    AND (
      (
        CASE
          WHEN regexp_replace(c.telefone, '[^0-9]', '', 'g') ~ '^55[0-9]{10,11}$'
            THEN substring(regexp_replace(c.telefone, '[^0-9]', '', 'g') FROM 3)
          ELSE regexp_replace(c.telefone, '[^0-9]', '', 'g')
        END
      ) = v_phone
      OR (
        v_cpf IS NOT NULL
        AND regexp_replace(coalesce(c.cpf, ''), '[^0-9]', '', 'g') = v_cpf
      )
    );

  IF cardinality(v_customer_ids) > 1 THEN
    RETURN jsonb_build_object(
      'status', 'manual_review_required',
      'code', 'identifiers_point_to_different_customers'
    );
  END IF;

  IF cardinality(v_customer_ids) = 1 THEN
    SELECT * INTO v_customer
    FROM public.clientes c
    WHERE c.id = v_customer_ids[1]
    FOR UPDATE;
    v_person_id := v_customer.person_id;

    IF v_cpf IS NOT NULL
       AND nullif(regexp_replace(coalesce(v_customer.cpf, ''), '[^0-9]', '', 'g'), '') IS NOT NULL
       AND regexp_replace(v_customer.cpf, '[^0-9]', '', 'g') <> v_cpf THEN
      RETURN jsonb_build_object(
        'status', 'manual_review_required',
        'code', 'cpf_conflicts_with_existing_customer'
      );
    END IF;
  END IF;

  v_phone_fp := private.identity_hmac_internal('phone', v_phone, 1::smallint);
  IF v_cpf IS NOT NULL THEN
    v_cpf_fp := private.identity_hmac_internal('cpf', v_cpf, 1::smallint);
  END IF;
  IF v_email IS NOT NULL THEN
    v_email_fp := private.identity_hmac_internal('email', v_email, 1::smallint);
  END IF;

  IF v_customer.id IS NULL THEN
    SELECT coalesce(array_agg(DISTINCT f.person_id ORDER BY f.person_id), ARRAY[]::uuid[])
    INTO v_candidates
    FROM private.person_identity_fingerprints f
    WHERE f.is_active
      AND (
        (f.identifier_type = 'phone' AND f.fingerprint = v_phone_fp)
        OR (v_cpf_fp IS NOT NULL
            AND f.identifier_type = 'cpf' AND f.fingerprint = v_cpf_fp)
      );
  ELSE
    v_candidates := ARRAY[v_person_id];
  END IF;

  IF v_customer.id IS NULL AND v_email_fp IS NOT NULL THEN
    SELECT f.person_id INTO v_email_person_id
    FROM private.person_identity_fingerprints f
    WHERE f.is_active
      AND f.identifier_type = 'email'
      AND f.fingerprint = v_email_fp;

    IF v_email_person_id IS NOT NULL
       AND (
         cardinality(v_candidates) = 0
         OR (cardinality(v_candidates) = 1
             AND v_candidates[1] <> v_email_person_id)
       ) THEN
      RETURN jsonb_build_object(
        'status', 'manual_review_required',
        'code', 'email_conflicts_with_verified_identifiers'
      );
    END IF;
  END IF;

  IF v_customer.id IS NULL AND cardinality(v_candidates) > 1 THEN
    INSERT INTO private.phase1_audit_events (
      actor_id, event_type, entity_type, outcome_code, metadata
    ) VALUES (
      v_actor, 'public_customer_identity_conflict', 'customer',
      'manual_review_required',
      jsonb_build_object(
        'candidate_count', cardinality(v_candidates),
        'source', p_source
      )
    );
    RETURN jsonb_build_object(
      'status', 'manual_review_required',
      'code', 'identifiers_point_to_different_people'
    );
  END IF;

  IF v_customer.id IS NULL AND cardinality(v_candidates) = 1 THEN
    v_person_id := v_candidates[1];

    -- CPF is a verified identifier and cannot be silently replaced merely
    -- because a submitted phone happens to match.
    IF v_cpf_fp IS NOT NULL AND EXISTS (
      SELECT 1
      FROM private.person_identity_fingerprints f
      WHERE f.person_id = v_person_id
        AND f.identifier_type = 'cpf'
        AND f.is_active
        AND f.fingerprint <> v_cpf_fp
    ) THEN
      RETURN jsonb_build_object(
        'status', 'manual_review_required',
        'code', 'cpf_conflicts_with_existing_person'
      );
    END IF;
  ELSIF v_person_id IS NULL THEN
    INSERT INTO private.persons (
      full_name, cpf_normalized, email_normalized, phone_normalized
    ) VALUES (
      v_name, v_cpf, v_email, v_phone
    )
    RETURNING id INTO v_person_id;
  END IF;

  -- Phone and e-mail may legitimately change after CPF proves the identity.
  UPDATE private.person_identity_fingerprints
  SET is_active = false, is_primary = false, deactivated_at = now()
  WHERE person_id = v_person_id
    AND identifier_type = 'phone'
    AND is_active
    AND fingerprint <> v_phone_fp;

  IF v_email_fp IS NOT NULL THEN
    UPDATE private.person_identity_fingerprints
    SET is_active = false, is_primary = false, deactivated_at = now()
    WHERE person_id = v_person_id
      AND identifier_type = 'email'
      AND is_active
      AND fingerprint <> v_email_fp;
  END IF;

  INSERT INTO private.person_identity_fingerprints (
    person_id, identifier_type, fingerprint, verified_at
  ) VALUES (v_person_id, 'phone', v_phone_fp, now())
  ON CONFLICT DO NOTHING;

  IF v_cpf_fp IS NOT NULL THEN
    INSERT INTO private.person_identity_fingerprints (
      person_id, identifier_type, fingerprint, verified_at
    ) VALUES (v_person_id, 'cpf', v_cpf_fp, now())
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_email_fp IS NOT NULL THEN
    INSERT INTO private.person_identity_fingerprints (
      person_id, identifier_type, fingerprint, verified_at
    ) VALUES (v_person_id, 'email', v_email_fp, now())
    ON CONFLICT DO NOTHING;
  END IF;

  UPDATE private.persons
  SET full_name = v_name,
      phone_normalized = v_phone,
      cpf_normalized = coalesce(v_cpf, cpf_normalized),
      email_normalized = coalesce(v_email, email_normalized),
      identity_version = identity_version + 1,
      updated_at = now()
  WHERE id = v_person_id;

  IF v_customer.id IS NULL THEN
    SELECT * INTO v_customer
    FROM public.clientes c
    WHERE c.person_id = v_person_id
      AND c.lifecycle_status = 'active'
    ORDER BY c.data_cadastro, c.id
    LIMIT 1
    FOR UPDATE;
  END IF;

  PERFORM set_config('bryza.canonical_identity_write', 'true', true);

  IF v_customer.id IS NULL THEN
    INSERT INTO public.clientes (
      person_id, nome, telefone, cpf, email, cep, endereco, numero, bairro,
      cidade, estado, origem, status_cliente, lifecycle_status
    ) VALUES (
      v_person_id,
      v_name,
      v_phone,
      v_cpf,
      v_email,
      v_cep,
      btrim(coalesce(p_customer_data->>'endereco', '')),
      nullif(btrim(coalesce(p_customer_data->>'numero', '')), ''),
      btrim(coalesce(p_customer_data->>'bairro', '')),
      btrim(coalesce(p_customer_data->>'cidade', '')),
      upper(btrim(coalesce(p_customer_data->>'estado', ''))),
      v_origin,
      'lead',
      'active'
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
    SET nome = v_name,
        telefone = v_phone,
        cpf = coalesce(v_cpf, cpf),
        email = coalesce(v_email, email),
        cep = coalesce(v_cep, cep),
        endereco = coalesce(nullif(btrim(coalesce(p_customer_data->>'endereco', '')), ''), endereco),
        numero = coalesce(nullif(btrim(coalesce(p_customer_data->>'numero', '')), ''), numero),
        bairro = coalesce(nullif(btrim(coalesce(p_customer_data->>'bairro', '')), ''), bairro),
        cidade = coalesce(nullif(btrim(coalesce(p_customer_data->>'cidade', '')), ''), cidade),
        estado = coalesce(nullif(upper(btrim(coalesce(p_customer_data->>'estado', ''))), ''), estado)
    WHERE id = v_customer.id
    RETURNING * INTO v_customer;
  END IF;

  IF nullif(btrim(coalesce(p_referral_code, '')), '') IS NOT NULL THEN
    SELECT * INTO v_referrer
    FROM public.ambassadors a
    WHERE lower(a.referral_code) = lower(btrim(p_referral_code))
      AND a.status = 'ativo'
      AND a.lifecycle_status = 'active'
    FOR SHARE;

    IF v_referrer.id IS NULL THEN
      RAISE EXCEPTION 'invalid_or_inactive_referral' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_assignment
    FROM private.customer_ambassador_assignments ca
    WHERE ca.customer_id = v_customer.id
      AND ca.status = 'active'
    FOR UPDATE;

    IF v_assignment.id IS NULL
       AND NOT (
         v_referrer.person_id IS NOT NULL
         AND v_referrer.person_id = v_customer.person_id
       ) THEN
      INSERT INTO private.customer_ambassador_assignments (
        customer_id, ambassador_id, status, is_validated, is_commissionable,
        source, evidence_code, assigned_by, reason
      ) VALUES (
        v_customer.id,
        v_referrer.id,
        'active',
        true,
        true,
        CASE
          WHEN p_source IN (
            'admin_selection', 'manual_order_selection', 'smart_link',
            'manual_code', 'verified_migration', 'administrative_review'
          ) THEN p_source
          ELSE 'smart_link'
        END,
        v_referrer.referral_code,
        v_actor,
        'Atribuição validada no cadastro público.'
      )
      RETURNING * INTO v_assignment;

      PERFORM set_config('bryza.canonical_referral_write', 'true', true);
      UPDATE public.clientes
      SET commissionable_ambassador_id = v_referrer.id,
          current_referral_assignment_id = v_assignment.id,
          ambassador_id = v_referrer.id,
          referral_code = v_referrer.referral_code,
          referral_source = CASE
            WHEN p_source IN (
              'admin_selection', 'manual_order_selection', 'smart_link',
              'manual_code', 'verified_migration', 'administrative_review'
            ) THEN p_source
            ELSE 'smart_link'
          END,
          referral_attributed_at = now(),
          referral_locked_at = now()
      WHERE id = v_customer.id
      RETURNING * INTO v_customer;
    END IF;
  END IF;

  PERFORM set_config(
    'bryza.canonical_identity_write',
    v_prior_identity_write,
    true
  );
  PERFORM set_config(
    'bryza.canonical_referral_write',
    v_prior_referral_write,
    true
  );

  RETURN jsonb_build_object(
    'status', 'resolved',
    'customer_id', v_customer.id,
    'person_id', v_person_id,
    'customer_code', 'C' || lpad(v_customer.codigo_cliente::text, 5, '0')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_upsert_public_customer_canonical(
  jsonb, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_upsert_public_customer_canonical(
  jsonb, text, text
) TO service_role;

COMMENT ON FUNCTION public.fn_upsert_public_customer_canonical(jsonb, text, text)
IS 'Canonical, concurrency-safe customer resolver for public sales channels.';
