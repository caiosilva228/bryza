-- Keep the canonical identity guard table-safe. PostgreSQL does not guarantee
-- boolean expression evaluation order, so a single expression referencing
-- columns from three trigger tables can try to read a missing field.
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

  IF TG_TABLE_NAME = 'clientes' THEN
    IF TG_OP = 'INSERT' THEN
      RAISE EXCEPTION 'canonical_customer_insert_required'
        USING ERRCODE = '42501';
    END IF;

    IF OLD.person_id IS NOT NULL
       AND (
         NEW.nome IS DISTINCT FROM OLD.nome
         OR NEW.cpf IS DISTINCT FROM OLD.cpf
         OR NEW.email IS DISTINCT FROM OLD.email
         OR NEW.telefone IS DISTINCT FROM OLD.telefone
       ) THEN
      RAISE EXCEPTION 'canonical_identity_write_required' USING ERRCODE = '42501';
    END IF;
  ELSIF TG_TABLE_NAME = 'profiles' THEN
    IF OLD.person_id IS NOT NULL
       AND (
         NEW.nome IS DISTINCT FROM OLD.nome
         OR NEW.cpf IS DISTINCT FROM OLD.cpf
         OR NEW.email IS DISTINCT FROM OLD.email
         OR NEW.telefone IS DISTINCT FROM OLD.telefone
       ) THEN
      RAISE EXCEPTION 'canonical_identity_write_required' USING ERRCODE = '42501';
    END IF;
  ELSIF TG_TABLE_NAME = 'ambassadors' THEN
    IF OLD.person_id IS NOT NULL
       AND (
         NEW.full_name IS DISTINCT FROM OLD.full_name
         OR NEW.cpf IS DISTINCT FROM OLD.cpf
         OR NEW.email IS DISTINCT FROM OLD.email
         OR NEW.phone IS DISTINCT FROM OLD.phone
       ) THEN
      RAISE EXCEPTION 'canonical_identity_write_required' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Canonical, service-only provisioning used by the /loja registration action.
CREATE OR REPLACE FUNCTION public.fn_service_provision_store_ambassador(
  p_ambassador_id uuid,
  p_auth_user_id uuid,
  p_person_id uuid
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
  IF coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
     AND current_user NOT IN ('postgres', 'service_role', 'supabase_admin') THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501';
  END IF;

  IF p_ambassador_id IS NULL OR p_auth_user_id IS NULL OR p_person_id IS NULL THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_ambassador
  FROM public.ambassadors
  WHERE id = p_ambassador_id
    AND status = 'ativo'
    AND lifecycle_status = 'active'
  FOR UPDATE;

  IF v_ambassador.id IS NULL OR v_ambassador.person_id IS DISTINCT FROM p_person_id THEN
    RETURN jsonb_build_object('status', 'ambassador_identity_mismatch');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM private.person_business_roles
    WHERE person_id = p_person_id
      AND role_type = 'customer'
      AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('status', 'customer_role_required');
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
    RETURN jsonb_build_object('status', 'invalid_auth_user');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM private.person_accounts
    WHERE person_id = p_person_id
      AND auth_user_id <> p_auth_user_id
      AND status = 'active'
  ) OR EXISTS (
    SELECT 1
    FROM private.person_accounts
    WHERE auth_user_id = p_auth_user_id
      AND person_id <> p_person_id
      AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('status', 'person_account_conflict');
  END IF;

  INSERT INTO private.person_business_roles (
    person_id, role_type, source_entity_id, status, activated_at
  )
  VALUES (p_person_id, 'ambassador', p_ambassador_id, 'active', now())
  ON CONFLICT (person_id, role_type) DO UPDATE
    SET source_entity_id = EXCLUDED.source_entity_id,
        status = 'active',
        activated_at = coalesce(private.person_business_roles.activated_at, now()),
        updated_at = now();

  v_phone := regexp_replace(coalesce(v_ambassador.phone, ''), '\D', '', 'g');
  PERFORM set_config('bryza.canonical_identity_write', 'true', true);

  INSERT INTO private.person_accounts (person_id, auth_user_id, status, linked_by)
  VALUES (p_person_id, p_auth_user_id, 'active', NULL)
  ON CONFLICT (person_id) DO UPDATE
    SET auth_user_id = EXCLUDED.auth_user_id,
        status = 'active',
        linked_by = NULL,
        disabled_at = NULL,
        updated_at = now();

  INSERT INTO public.profiles (
    id, person_id, nome, email, telefone, cpf, username,
    role, ativo, must_change_password
  )
  VALUES (
    p_auth_user_id,
    p_person_id,
    v_ambassador.full_name,
    lower(v_user.email),
    nullif(v_phone, ''),
    regexp_replace(coalesce(v_ambassador.cpf, ''), '\D', '', 'g'),
    v_ambassador.username,
    'embaixador',
    true,
    false
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
        must_change_password = false;

  INSERT INTO private.person_access_permissions (
    person_id, auth_user_id, permission_type, status, granted_by
  )
  VALUES (p_person_id, p_auth_user_id, 'ambassador_portal', 'active', NULL)
  ON CONFLICT (auth_user_id, permission_type) DO UPDATE
    SET person_id = EXCLUDED.person_id,
        status = 'active',
        granted_by = NULL,
        revoked_by = NULL,
        revoked_at = NULL;

  UPDATE public.ambassadors
  SET user_id = p_auth_user_id,
      person_id = p_person_id,
      updated_at = now()
  WHERE id = p_ambassador_id;

  RETURN jsonb_build_object(
    'status', 'linked',
    'ambassador_id', p_ambassador_id,
    'auth_user_id', p_auth_user_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_service_provision_store_ambassador(
  uuid, uuid, uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_service_provision_store_ambassador(
  uuid, uuid, uuid
) TO service_role;

-- Repair Auth rows left incomplete by the failed provisioning path. GoTrue
-- expects token columns to be strings, and password users need an e-mail identity.
UPDATE auth.users
SET confirmation_token = coalesce(confirmation_token, ''),
    recovery_token = coalesce(recovery_token, ''),
    email_change_token_new = coalesce(email_change_token_new, ''),
    email_change = coalesce(email_change, ''),
    phone_change = coalesce(phone_change, ''),
    phone_change_token = coalesce(phone_change_token, ''),
    email_change_token_current = coalesce(email_change_token_current, ''),
    reauthentication_token = coalesce(reauthentication_token, ''),
    updated_at = now()
WHERE confirmation_token IS NULL
   OR recovery_token IS NULL
   OR email_change_token_new IS NULL
   OR email_change IS NULL
   OR phone_change IS NULL
   OR phone_change_token IS NULL
   OR email_change_token_current IS NULL
   OR reauthentication_token IS NULL;

INSERT INTO auth.identities (
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT
  u.id::text,
  u.id,
  jsonb_build_object(
    'sub', u.id::text,
    'email', lower(u.email),
    'email_verified', u.email_confirmed_at IS NOT NULL,
    'phone_verified', false
  ),
  'email',
  u.last_sign_in_at,
  coalesce(u.created_at, now()),
  now()
FROM auth.users u
WHERE u.email IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM auth.identities i
    WHERE i.user_id = u.id
      AND i.provider = 'email'
  )
ON CONFLICT (provider_id, provider) DO NOTHING;
