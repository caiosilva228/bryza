-- Remote migration 20260724204209. Phase 7: canonical identity is the only personal-data write source.

CREATE OR REPLACE FUNCTION private.sync_person_identity_internal(
  p_actor uuid,
  p_person_id uuid,
  p_data jsonb,
  p_operation_scope text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_person private.persons%ROWTYPE;
  v_name text;
  v_cpf text;
  v_email text;
  v_phone text;
  v_identifier record;
  v_conflicting_person_ids uuid[] := ARRAY[]::uuid[];
  v_review_id uuid;
  v_review_fp bytea;
BEGIN
  SELECT * INTO v_person FROM private.persons
  WHERE id = p_person_id AND status = 'active'
  FOR UPDATE;
  IF v_person.id IS NULL THEN
    RAISE EXCEPTION 'canonical_person_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_name := btrim(coalesce(nullif(p_data->>'full_name', ''), v_person.full_name));
  v_cpf := regexp_replace(coalesce(nullif(p_data->>'cpf', ''), v_person.cpf_normalized, ''), '[^0-9]', '', 'g');
  v_email := lower(nullif(btrim(coalesce(nullif(p_data->>'email', ''), v_person.email_normalized, '')), ''));
  v_phone := regexp_replace(coalesce(nullif(p_data->>'phone', ''), v_person.phone_normalized, ''), '[^0-9]', '', 'g');

  IF length(v_name) < 3
     OR (v_cpf <> '' AND v_cpf !~ '^[0-9]{11}$')
     OR (v_phone <> '' AND v_phone !~ '^[0-9]{10,11}$') THEN
    RAISE EXCEPTION 'invalid_canonical_identity_data' USING ERRCODE = '22023';
  END IF;

  FOR v_identifier IN
    SELECT *
    FROM (VALUES
      ('cpf'::text, nullif(v_cpf, '')),
      ('email'::text, v_email),
      ('phone'::text, nullif(v_phone, ''))
    ) AS identifiers(identifier_type, normalized_value)
    WHERE normalized_value IS NOT NULL
  LOOP
    SELECT coalesce(array_agg(DISTINCT f.person_id), ARRAY[]::uuid[])
    INTO v_conflicting_person_ids
    FROM private.person_identity_fingerprints f
    WHERE f.identifier_type = v_identifier.identifier_type
      AND f.fingerprint = private.identity_hmac_internal(
        v_identifier.identifier_type,
        v_identifier.normalized_value,
        1::smallint
      )
      AND f.is_active
      AND f.person_id <> p_person_id;

    IF cardinality(v_conflicting_person_ids) > 0 THEN
      v_review_fp := extensions.digest(
        convert_to(
          p_operation_scope || ':' || p_person_id::text || ':' ||
          v_identifier.identifier_type || ':' ||
          encode(private.identity_hmac_internal(
            v_identifier.identifier_type,
            v_identifier.normalized_value,
            1::smallint
          ), 'hex'),
          'UTF8'
        ),
        'sha256'
      );
      v_review_id := private.persist_identity_review_internal(
        p_actor,
        v_review_fp,
        ARRAY[v_identifier.identifier_type || '_belongs_to_another_person'],
        p_operation_scope,
        array_append(v_conflicting_person_ids, p_person_id),
        'person',
        p_person_id
      );
      RETURN jsonb_build_object(
        'status', 'manual_review_required',
        'review_id', v_review_id
      );
    END IF;
  END LOOP;

  UPDATE private.persons
  SET full_name = v_name,
      cpf_normalized = nullif(v_cpf, ''),
      email_normalized = v_email,
      phone_normalized = nullif(v_phone, ''),
      identity_version = identity_version + 1,
      updated_at = now()
  WHERE id = p_person_id;

  FOR v_identifier IN
    SELECT *
    FROM (VALUES
      ('cpf'::text, nullif(v_cpf, '')),
      ('email'::text, v_email),
      ('phone'::text, nullif(v_phone, ''))
    ) AS identifiers(identifier_type, normalized_value)
  LOOP
    UPDATE private.person_identity_fingerprints
    SET is_active = false,
        deactivated_at = now()
    WHERE person_id = p_person_id
      AND identifier_type = v_identifier.identifier_type
      AND is_active
      AND (
        v_identifier.normalized_value IS NULL
        OR fingerprint <> private.identity_hmac_internal(
          v_identifier.identifier_type,
          v_identifier.normalized_value,
          1::smallint
        )
      );

    IF v_identifier.normalized_value IS NOT NULL THEN
      INSERT INTO private.person_identity_fingerprints (
        person_id, identifier_type, fingerprint, verified_at
      )
      SELECT p_person_id, v_identifier.identifier_type,
             private.identity_hmac_internal(
               v_identifier.identifier_type,
               v_identifier.normalized_value,
               1::smallint
             ),
             now()
      WHERE NOT EXISTS (
        SELECT 1 FROM private.person_identity_fingerprints
        WHERE person_id = p_person_id
          AND identifier_type = v_identifier.identifier_type
          AND fingerprint = private.identity_hmac_internal(
            v_identifier.identifier_type,
            v_identifier.normalized_value,
            1::smallint
          )
          AND is_active
      );
    END IF;
  END LOOP;

  PERFORM set_config('bryza.canonical_identity_write', 'true', true);

  UPDATE public.clientes
  SET nome = v_name,
      cpf = nullif(v_cpf, ''),
      email = v_email,
      telefone = nullif(v_phone, '')
  WHERE person_id = p_person_id;

  UPDATE public.profiles
  SET nome = v_name,
      cpf = nullif(v_cpf, ''),
      email = v_email,
      telefone = nullif(v_phone, '')
  WHERE person_id = p_person_id;

  UPDATE public.ambassadors
  SET full_name = v_name,
      cpf = nullif(v_cpf, ''),
      email = v_email,
      phone = nullif(v_phone, ''),
      updated_at = now()
  WHERE person_id = p_person_id;

  INSERT INTO private.phase1_audit_events (
    actor_id, event_type, entity_type, entity_id, outcome_code, metadata
  ) VALUES (
    p_actor, 'canonical_identity_updated', 'person', p_person_id, 'updated',
    jsonb_build_object('operation_scope', p_operation_scope)
  );

  RETURN jsonb_build_object('status', 'updated', 'person_id', p_person_id);
END;
$$;

REVOKE ALL ON FUNCTION private.sync_person_identity_internal(uuid, uuid, jsonb, text)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fn_admin_upsert_profile_canonical(
  p_auth_user_id uuid,
  p_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_actor uuid;
  v_role text;
  v_profile public.profiles%ROWTYPE;
  v_person_id uuid;
  v_result jsonb;
  v_permission text;
  v_cpf text := regexp_replace(coalesce(p_data->>'cpf', ''), '[^0-9]', '', 'g');
  v_email text := lower(nullif(btrim(coalesce(p_data->>'email', '')), ''));
  v_phone text := regexp_replace(coalesce(p_data->>'telefone', ''), '[^0-9]', '', 'g');
  v_candidate_ids uuid[];
BEGIN
  SELECT actor_id, actor_role INTO v_actor, v_role
  FROM private.require_phase2_actor(ARRAY['admin']);

  IF p_auth_user_id IS NULL OR jsonb_typeof(p_data) <> 'object' THEN
    RAISE EXCEPTION 'invalid_profile_identity_payload' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_profile FROM public.profiles
  WHERE id = p_auth_user_id FOR UPDATE;

  SELECT person_id INTO v_person_id
  FROM private.person_accounts
  WHERE auth_user_id = p_auth_user_id AND status = 'active'
  FOR UPDATE;
  v_person_id := coalesce(v_person_id, v_profile.person_id);

  IF v_person_id IS NULL THEN
    SELECT coalesce(array_agg(DISTINCT f.person_id), ARRAY[]::uuid[])
    INTO v_candidate_ids
    FROM private.person_identity_fingerprints f
    WHERE f.is_active AND (
      (v_cpf <> '' AND f.identifier_type = 'cpf'
        AND f.fingerprint = private.identity_hmac_internal('cpf', v_cpf, 1::smallint))
      OR (v_email IS NOT NULL AND f.identifier_type = 'email'
        AND f.fingerprint = private.identity_hmac_internal('email', v_email, 1::smallint))
      OR (v_phone <> '' AND f.identifier_type = 'phone'
        AND f.fingerprint = private.identity_hmac_internal('phone', v_phone, 1::smallint))
    );

    IF cardinality(v_candidate_ids) > 1
       OR (
         cardinality(v_candidate_ids) = 1
         AND EXISTS (
           SELECT 1 FROM private.person_accounts
           WHERE person_id = v_candidate_ids[1] AND status = 'active'
         )
       ) THEN
      RETURN jsonb_build_object(
        'status', 'manual_review_required',
        'code', 'profile_identity_conflict'
      );
    END IF;

    IF cardinality(v_candidate_ids) = 1 THEN
      v_person_id := v_candidate_ids[1];
    ELSE
      INSERT INTO private.persons (
        full_name, cpf_normalized, email_normalized, phone_normalized
      ) VALUES (
        btrim(p_data->>'nome'), nullif(v_cpf, ''), v_email, nullif(v_phone, '')
      )
      RETURNING id INTO v_person_id;
    END IF;

    INSERT INTO private.person_accounts (
      person_id, auth_user_id, status, linked_by
    ) VALUES (
      v_person_id, p_auth_user_id, 'active', v_actor
    );
  END IF;

  v_result := private.sync_person_identity_internal(
    v_actor,
    v_person_id,
    jsonb_build_object(
      'full_name', p_data->>'nome',
      'cpf', nullif(v_cpf, ''),
      'email', v_email,
      'phone', nullif(v_phone, '')
    ),
    'admin_access_profile_upsert'
  );
  IF v_result->>'status' = 'manual_review_required' THEN
    RETURN v_result;
  END IF;

  PERFORM set_config('bryza.canonical_identity_write', 'true', true);
  INSERT INTO public.profiles (
    id, person_id, nome, email, telefone, cpf, role, ativo,
    data_nascimento, endereco, bairro, cidade, estado, regiao_atuacao,
    data_entrada, observacoes, nivel_comissao, percentual_comissao,
    meta_diaria, meta_semanal, meta_mensal
  ) VALUES (
    p_auth_user_id, v_person_id, btrim(p_data->>'nome'), v_email,
    nullif(v_phone, ''), nullif(v_cpf, ''),
    coalesce((p_data->>'role')::public.app_role, 'vendedor'),
    coalesce((p_data->>'ativo')::boolean, true),
    nullif(p_data->>'data_nascimento', '')::date,
    nullif(p_data->>'endereco', ''), nullif(p_data->>'bairro', ''),
    nullif(p_data->>'cidade', ''), nullif(p_data->>'estado', ''),
    nullif(p_data->>'regiao_atuacao', ''),
    nullif(p_data->>'data_entrada', '')::date,
    nullif(p_data->>'observacoes', ''),
    coalesce((p_data->>'nivel_comissao')::public.nivel_comissao, 'Bronze'),
    coalesce((p_data->>'percentual_comissao')::numeric, 8),
    coalesce((p_data->>'meta_diaria')::integer, 0),
    coalesce((p_data->>'meta_semanal')::integer, 0),
    coalesce((p_data->>'meta_mensal')::integer, 0)
  )
  ON CONFLICT (id) DO UPDATE
    SET person_id = EXCLUDED.person_id,
        nome = EXCLUDED.nome,
        email = EXCLUDED.email,
        telefone = EXCLUDED.telefone,
        cpf = EXCLUDED.cpf,
        role = EXCLUDED.role,
        ativo = EXCLUDED.ativo,
        data_nascimento = EXCLUDED.data_nascimento,
        endereco = EXCLUDED.endereco,
        bairro = EXCLUDED.bairro,
        cidade = EXCLUDED.cidade,
        estado = EXCLUDED.estado,
        regiao_atuacao = EXCLUDED.regiao_atuacao,
        data_entrada = EXCLUDED.data_entrada,
        observacoes = EXCLUDED.observacoes,
        nivel_comissao = EXCLUDED.nivel_comissao,
        percentual_comissao = EXCLUDED.percentual_comissao,
        meta_diaria = EXCLUDED.meta_diaria,
        meta_semanal = EXCLUDED.meta_semanal,
        meta_mensal = EXCLUDED.meta_mensal;

  v_permission := CASE p_data->>'role'
    WHEN 'admin' THEN 'admin'
    WHEN 'logistica' THEN 'logistics'
    WHEN 'embaixador' THEN 'ambassador_portal'
    ELSE 'seller'
  END;
  INSERT INTO private.person_access_permissions (
    person_id, auth_user_id, permission_type, status, granted_by
  ) VALUES (
    v_person_id, p_auth_user_id, v_permission, 'active', v_actor
  )
  ON CONFLICT (auth_user_id, permission_type) DO UPDATE
    SET person_id = EXCLUDED.person_id,
        status = 'active',
        granted_by = EXCLUDED.granted_by,
        revoked_by = NULL,
        revoked_at = NULL;

  RETURN jsonb_build_object('status', 'updated', 'person_id', v_person_id);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_upsert_profile_canonical(uuid, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_upsert_profile_canonical(uuid, jsonb)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_update_my_profile_canonical(
  p_full_name text,
  p_phone text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_person_id uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;
  SELECT person_id INTO v_person_id
  FROM private.person_accounts
  WHERE auth_user_id = v_actor AND status = 'active';
  IF v_person_id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'manual_review_required',
      'code', 'account_without_canonical_identity'
    );
  END IF;
  RETURN private.sync_person_identity_internal(
    v_actor, v_person_id,
    jsonb_build_object('full_name', p_full_name, 'phone', p_phone),
    'self_profile_update'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_update_my_profile_canonical(text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_update_my_profile_canonical(text, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_admin_update_ambassador_canonical(
  p_ambassador_id uuid,
  p_data jsonb
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
  v_result jsonb;
BEGIN
  SELECT actor_id, actor_role INTO v_actor, v_role
  FROM private.require_phase2_actor(ARRAY['admin']);
  SELECT * INTO v_ambassador FROM public.ambassadors
  WHERE id = p_ambassador_id FOR UPDATE;
  IF v_ambassador.id IS NULL OR v_ambassador.person_id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'manual_review_required',
      'code', 'ambassador_without_canonical_identity'
    );
  END IF;

  v_result := private.sync_person_identity_internal(
    v_actor, v_ambassador.person_id,
    jsonb_build_object(
      'full_name', p_data->>'full_name',
      'phone', p_data->>'phone',
      'email', p_data->>'email'
    ),
    'admin_ambassador_update'
  );
  IF v_result->>'status' = 'manual_review_required' THEN RETURN v_result; END IF;

  PERFORM set_config('bryza.canonical_identity_write', 'true', true);
  UPDATE public.ambassadors
  SET display_name = coalesce(nullif(p_data->>'display_name', ''), p_data->>'full_name'),
      instagram = nullif(p_data->>'instagram', ''),
      city = nullif(p_data->>'city', ''),
      state = nullif(upper(p_data->>'state'), ''),
      notes = nullif(p_data->>'notes', ''),
      photo_path = nullif(p_data->>'photo_path', ''),
      cep = nullif(p_data->>'cep', ''),
      address = nullif(p_data->>'address', ''),
      number = nullif(p_data->>'number', ''),
      neighborhood = nullif(p_data->>'neighborhood', ''),
      latitude = nullif(p_data->>'latitude', '')::numeric,
      longitude = nullif(p_data->>'longitude', '')::numeric,
      pix_key_type = coalesce(nullif(p_data->>'pix_key_type', ''), pix_key_type),
      pix_key = CASE
        WHEN nullif(p_data->>'pix_key', '') IS NOT NULL
          AND p_data->>'pix_key' NOT LIKE '%*%'
        THEN p_data->>'pix_key' ELSE pix_key END,
      updated_at = now()
  WHERE id = p_ambassador_id;

  RETURN jsonb_build_object('status', 'updated', 'ambassador_id', p_ambassador_id);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_update_ambassador_canonical(uuid, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_update_ambassador_canonical(uuid, jsonb)
  TO authenticated;

CREATE OR REPLACE FUNCTION private.prevent_independent_personal_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  IF coalesce(current_setting('bryza.canonical_identity_write', true), '') = 'true' THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'clientes'
     AND OLD.person_id IS NOT NULL
     AND (
       NEW.nome IS DISTINCT FROM OLD.nome
       OR NEW.cpf IS DISTINCT FROM OLD.cpf
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.telefone IS DISTINCT FROM OLD.telefone
     ) THEN
    RAISE EXCEPTION 'canonical_identity_write_required' USING ERRCODE = '42501';
  ELSIF TG_TABLE_NAME = 'profiles'
     AND OLD.person_id IS NOT NULL
     AND (
       NEW.nome IS DISTINCT FROM OLD.nome
       OR NEW.cpf IS DISTINCT FROM OLD.cpf
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.telefone IS DISTINCT FROM OLD.telefone
     ) THEN
    RAISE EXCEPTION 'canonical_identity_write_required' USING ERRCODE = '42501';
  ELSIF TG_TABLE_NAME = 'ambassadors'
     AND OLD.person_id IS NOT NULL
     AND (
       NEW.full_name IS DISTINCT FROM OLD.full_name
       OR NEW.cpf IS DISTINCT FROM OLD.cpf
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.phone IS DISTINCT FROM OLD.phone
     ) THEN
    RAISE EXCEPTION 'canonical_identity_write_required' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.prevent_independent_personal_write()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_clientes_require_canonical_identity_write ON public.clientes;
CREATE TRIGGER trg_clientes_require_canonical_identity_write
BEFORE UPDATE ON public.clientes
FOR EACH ROW EXECUTE FUNCTION private.prevent_independent_personal_write();

DROP TRIGGER IF EXISTS trg_profiles_require_canonical_identity_write ON public.profiles;
CREATE TRIGGER trg_profiles_require_canonical_identity_write
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION private.prevent_independent_personal_write();

DROP TRIGGER IF EXISTS trg_ambassadors_require_canonical_identity_write ON public.ambassadors;
CREATE TRIGGER trg_ambassadors_require_canonical_identity_write
BEFORE UPDATE ON public.ambassadors
FOR EACH ROW EXECUTE FUNCTION private.prevent_independent_personal_write();
