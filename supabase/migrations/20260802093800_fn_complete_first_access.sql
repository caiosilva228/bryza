BEGIN;

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
  PERFORM pg_catalog.set_config('bryza.canonical_identity_write', 'true', true);

  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;

  IF v_profile.id IS NULL THEN
    RETURN jsonb_build_object('status', 'profile_not_found');
  END IF;

  v_person_id := v_profile.person_id;
  v_clean_cpf := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');

  IF length(v_clean_cpf) = 11 THEN
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
      WHERE person_id = v_person_id AND (cpf IS NULL OR cpf = '');

      UPDATE private.persons
      SET cpf_normalized = v_clean_cpf
      WHERE id = v_person_id AND cpf_normalized IS NULL;
    END IF;
  ELSE
    UPDATE public.profiles
    SET must_change_password = false
    WHERE id = p_user_id;
  END IF;

  RETURN jsonb_build_object('status', 'success');
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_complete_first_access(uuid, text) TO authenticated, service_role;

COMMIT;
