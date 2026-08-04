BEGIN;

-- The first-access action runs through the server-side service-role client.
-- Keep the canonical identity guard enabled while allowing this trusted
-- operation to update the profile and its linked identity in one transaction.
CREATE OR REPLACE FUNCTION public.fn_complete_first_access(
  p_user_id uuid,
  p_cpf text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_person_id uuid;
  v_profile public.profiles%ROWTYPE;
  v_clean_cpf text;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid_first_access_user' USING ERRCODE = '22023';
  END IF;

  -- This function is intentionally callable only by the server-side admin
  -- client. It accepts a user id because the server action has already
  -- authenticated that user and passes the id from auth.user().
  IF current_user NOT IN ('postgres', 'service_role', 'supabase_admin')
     AND coalesce(auth.jwt() ->> 'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_catalog.set_config('bryza.canonical_identity_write', 'true', true);

  SELECT *
  INTO v_profile
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_profile.id IS NULL THEN
    RETURN jsonb_build_object('status', 'profile_not_found');
  END IF;

  v_person_id := v_profile.person_id;
  v_clean_cpf := nullif(regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g'), '');

  IF v_clean_cpf IS NOT NULL AND length(v_clean_cpf) <> 11 THEN
    RAISE EXCEPTION 'invalid_first_access_cpf' USING ERRCODE = '22023';
  END IF;

  IF v_clean_cpf IS NOT NULL THEN
    UPDATE public.profiles
    SET cpf = v_clean_cpf,
        must_change_password = false
    WHERE id = p_user_id;

    UPDATE public.ambassadors
    SET cpf = v_clean_cpf
    WHERE user_id = p_user_id;

    IF v_person_id IS NOT NULL THEN
      UPDATE public.clientes
      SET cpf = v_clean_cpf
      WHERE person_id = v_person_id
        AND (cpf IS NULL OR cpf = '');

      UPDATE private.persons
      SET cpf_normalized = v_clean_cpf
      WHERE id = v_person_id
        AND cpf_normalized IS NULL;
    END IF;
  ELSE
    UPDATE public.profiles
    SET must_change_password = false
    WHERE id = p_user_id;
  END IF;

  RETURN jsonb_build_object('status', 'success');
END;
$$;

-- This is a SECURITY DEFINER function with a target user id. It must never be
-- callable by browser sessions or anonymous callers.
REVOKE ALL ON FUNCTION public.fn_complete_first_access(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_complete_first_access(uuid, text)
  TO service_role;

COMMIT;
