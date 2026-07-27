BEGIN;

CREATE OR REPLACE FUNCTION private.copy_customer_location_to_new_ambassador()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_customer public.clientes%ROWTYPE;
BEGIN
  IF NEW.person_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO v_customer
  FROM public.clientes
  WHERE person_id = NEW.person_id
    AND lifecycle_status = 'active'
  ORDER BY data_cadastro DESC
  LIMIT 1;

  IF v_customer.id IS NULL THEN
    RETURN NEW;
  END IF;

  NEW.cep := coalesce(nullif(NEW.cep, ''), v_customer.cep);
  NEW.address := coalesce(nullif(NEW.address, ''), v_customer.endereco);
  NEW.number := coalesce(nullif(NEW.number, ''), v_customer.numero);
  NEW.neighborhood := coalesce(nullif(NEW.neighborhood, ''), v_customer.bairro);
  NEW.city := coalesce(nullif(NEW.city, ''), v_customer.cidade);
  NEW.state := coalesce(nullif(NEW.state, ''), v_customer.estado);
  NEW.latitude := coalesce(NEW.latitude, v_customer.latitude);
  NEW.longitude := coalesce(NEW.longitude, v_customer.longitude);

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.copy_customer_location_to_new_ambassador()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_ambassadors_copy_customer_location
ON public.ambassadors;

CREATE TRIGGER trg_ambassadors_copy_customer_location
BEFORE INSERT ON public.ambassadors
FOR EACH ROW
EXECUTE FUNCTION private.copy_customer_location_to_new_ambassador();

WITH location_source AS (
  SELECT DISTINCT ON (a.id)
    a.id AS ambassador_id,
    c.cep,
    c.endereco,
    c.numero,
    c.bairro,
    c.cidade,
    c.estado,
    c.latitude,
    c.longitude
  FROM public.ambassadors a
  JOIN public.clientes c
    ON c.own_ambassador_id = a.id
    OR (
      c.own_ambassador_id IS NULL
      AND c.person_id = a.person_id
    )
  WHERE c.lifecycle_status = 'active'
  ORDER BY
    a.id,
    (c.own_ambassador_id = a.id) DESC,
    c.data_cadastro DESC
)
UPDATE public.ambassadors a
SET
  cep = coalesce(nullif(a.cep, ''), source.cep),
  address = coalesce(nullif(a.address, ''), source.endereco),
  number = coalesce(nullif(a.number, ''), source.numero),
  neighborhood = coalesce(nullif(a.neighborhood, ''), source.bairro),
  city = coalesce(nullif(a.city, ''), source.cidade),
  state = coalesce(nullif(a.state, ''), source.estado),
  latitude = coalesce(a.latitude, source.latitude),
  longitude = coalesce(a.longitude, source.longitude),
  updated_at = now()
FROM location_source source
WHERE source.ambassador_id = a.id
  AND (
    nullif(a.cep, '') IS NULL
    OR nullif(a.address, '') IS NULL
    OR nullif(a.number, '') IS NULL
    OR nullif(a.neighborhood, '') IS NULL
    OR nullif(a.city, '') IS NULL
    OR nullif(a.state, '') IS NULL
    OR a.latitude IS NULL
    OR a.longitude IS NULL
  );

CREATE OR REPLACE FUNCTION public.fn_service_provision_ambassador_access(
  p_ambassador_id uuid,
  p_auth_user_id uuid,
  p_actor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_ambassador public.ambassadors%ROWTYPE;
  v_user auth.users%ROWTYPE;
  v_phone text;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501';
  END IF;

  IF p_ambassador_id IS NULL OR p_auth_user_id IS NULL OR p_actor_id IS NULL THEN
    RAISE EXCEPTION 'invalid_access_provision_payload' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = p_actor_id
      AND role = 'admin'
      AND ativo
  ) THEN
    RAISE EXCEPTION 'active_admin_required' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_ambassador
  FROM public.ambassadors
  WHERE id = p_ambassador_id
    AND lifecycle_status = 'active'
  FOR UPDATE;

  IF v_ambassador.id IS NULL OR v_ambassador.person_id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'manual_review_required',
      'code', 'ambassador_without_canonical_identity'
    );
  END IF;

  SELECT *
  INTO v_user
  FROM auth.users
  WHERE id = p_auth_user_id
  FOR SHARE;

  IF v_user.id IS NULL
     OR v_user.email IS NULL
     OR v_user.email_confirmed_at IS NULL
     OR lower(split_part(v_user.email, '@', 1)) <> lower(v_ambassador.username) THEN
    RETURN jsonb_build_object(
      'status', 'manual_review_required',
      'code', 'invalid_ambassador_auth_identity'
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM private.person_accounts
    WHERE person_id = v_ambassador.person_id
      AND auth_user_id <> p_auth_user_id
      AND status = 'active'
  ) OR EXISTS (
    SELECT 1
    FROM private.person_accounts
    WHERE auth_user_id = p_auth_user_id
      AND person_id <> v_ambassador.person_id
      AND status = 'active'
  ) THEN
    RETURN jsonb_build_object(
      'status', 'manual_review_required',
      'code', 'canonical_person_account_conflict'
    );
  END IF;

  v_phone := regexp_replace(coalesce(v_ambassador.phone, ''), '\D', '', 'g');

  INSERT INTO private.person_accounts (
    person_id,
    auth_user_id,
    status,
    linked_by
  )
  VALUES (
    v_ambassador.person_id,
    p_auth_user_id,
    'active',
    p_actor_id
  )
  ON CONFLICT (person_id) DO UPDATE
    SET auth_user_id = EXCLUDED.auth_user_id,
        status = 'active',
        linked_by = EXCLUDED.linked_by,
        disabled_at = NULL,
        updated_at = now();

  PERFORM set_config('bryza.canonical_identity_write', 'true', true);

  INSERT INTO public.profiles (
    id,
    person_id,
    nome,
    email,
    telefone,
    cpf,
    username,
    role,
    ativo,
    must_change_password
  )
  VALUES (
    p_auth_user_id,
    v_ambassador.person_id,
    v_ambassador.full_name,
    lower(v_user.email),
    nullif(v_phone, ''),
    regexp_replace(coalesce(v_ambassador.cpf, ''), '\D', '', 'g'),
    v_ambassador.username,
    'embaixador',
    true,
    true
  )
  ON CONFLICT (id) DO UPDATE
    SET person_id = EXCLUDED.person_id,
        nome = EXCLUDED.nome,
        email = EXCLUDED.email,
        telefone = EXCLUDED.telefone,
        cpf = EXCLUDED.cpf,
        username = EXCLUDED.username,
        role = 'embaixador',
        ativo = true,
        must_change_password = true;

  INSERT INTO private.person_access_permissions (
    person_id,
    auth_user_id,
    permission_type,
    status,
    granted_by
  )
  VALUES (
    v_ambassador.person_id,
    p_auth_user_id,
    'ambassador_portal',
    'active',
    p_actor_id
  )
  ON CONFLICT (auth_user_id, permission_type) DO UPDATE
    SET person_id = EXCLUDED.person_id,
        status = 'active',
        granted_by = EXCLUDED.granted_by,
        revoked_by = NULL,
        revoked_at = NULL;

  UPDATE public.ambassadors
  SET
    user_id = p_auth_user_id,
    updated_at = now()
  WHERE id = p_ambassador_id;

  INSERT INTO public.audit_logs (
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    metadata
  )
  VALUES (
    p_actor_id,
    'admin',
    'provision_ambassador_first_access',
    'ambassadors',
    p_ambassador_id,
    jsonb_build_object(
      'auth_user_id', p_auth_user_id,
      'target_username', v_ambassador.username,
      'temporary_credential_source', 'registered_phone'
    )
  );

  RETURN jsonb_build_object(
    'status', 'linked',
    'ambassador_id', p_ambassador_id,
    'auth_user_id', p_auth_user_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_service_provision_ambassador_access(
  uuid, uuid, uuid
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.fn_service_provision_ambassador_access(
  uuid, uuid, uuid
) TO service_role;

COMMIT;
