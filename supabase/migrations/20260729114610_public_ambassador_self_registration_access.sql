-- Service-only Auth provisioning for the store-specific public registration.
-- The person must already hold active customer and ambassador business roles.

CREATE OR REPLACE FUNCTION public.fn_service_provision_public_ambassador_access(
  p_ambassador_id uuid,
  p_auth_user_id uuid
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
  IF coalesce(auth.jwt() ->> 'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501';
  END IF;

  IF p_ambassador_id IS NULL OR p_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid_access_provision_payload' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_ambassador
  FROM public.ambassadors
  WHERE id = p_ambassador_id
    AND status = 'ativo'
    AND lifecycle_status = 'active'
  FOR UPDATE;

  IF v_ambassador.id IS NULL OR v_ambassador.person_id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'manual_review_required',
      'code', 'ambassador_without_canonical_identity'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM private.person_business_roles
    WHERE person_id = v_ambassador.person_id
      AND role_type = 'customer'
      AND status = 'active'
  ) OR NOT EXISTS (
    SELECT 1
    FROM private.person_business_roles
    WHERE person_id = v_ambassador.person_id
      AND role_type = 'ambassador'
      AND status = 'active'
  ) THEN
    RETURN jsonb_build_object(
      'status', 'manual_review_required',
      'code', 'customer_ambassador_roles_required'
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
    person_id, auth_user_id, status, linked_by
  )
  VALUES (
    v_ambassador.person_id, p_auth_user_id, 'active', NULL
  )
  ON CONFLICT (person_id) DO UPDATE
    SET auth_user_id = EXCLUDED.auth_user_id,
        status = 'active',
        linked_by = NULL,
        disabled_at = NULL,
        updated_at = now();

  PERFORM set_config('bryza.canonical_identity_write', 'true', true);

  INSERT INTO public.profiles (
    id, person_id, nome, email, telefone, cpf, username,
    role, ativo, must_change_password
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
  VALUES (
    v_ambassador.person_id, p_auth_user_id, 'ambassador_portal', 'active', NULL
  )
  ON CONFLICT (auth_user_id, permission_type) DO UPDATE
    SET person_id = EXCLUDED.person_id,
        status = 'active',
        granted_by = NULL,
        revoked_by = NULL,
        revoked_at = NULL;

  UPDATE public.ambassadors
  SET user_id = p_auth_user_id,
      updated_at = now()
  WHERE id = p_ambassador_id;

  RETURN jsonb_build_object(
    'status', 'linked',
    'ambassador_id', p_ambassador_id,
    'auth_user_id', p_auth_user_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_service_provision_public_ambassador_access(
  uuid, uuid
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.fn_service_provision_public_ambassador_access(
  uuid, uuid
) TO service_role;

COMMENT ON FUNCTION public.fn_service_provision_public_ambassador_access(uuid, uuid)
IS 'Service-only canonical access provisioning for the store customer plus ambassador registration.';
