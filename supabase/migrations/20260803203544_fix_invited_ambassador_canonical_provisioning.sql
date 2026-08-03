BEGIN;

-- The invitation flow uses a temporary phone password, so it needs the same
-- canonical provisioning as the store flow while preserving first access.
CREATE OR REPLACE FUNCTION public.fn_service_provision_invited_ambassador(
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
  v_result jsonb;
BEGIN
  IF coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
     AND current_user NOT IN ('postgres', 'service_role', 'supabase_admin') THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501';
  END IF;

  v_result := public.fn_service_provision_store_ambassador(
    p_ambassador_id,
    p_auth_user_id,
    p_person_id
  );

  IF v_result->>'status' <> 'linked' THEN
    RETURN v_result;
  END IF;

  UPDATE public.profiles
  SET must_change_password = true
  WHERE id = p_auth_user_id
    AND person_id = p_person_id
    AND role = 'embaixador';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invited_ambassador_profile_missing'
      USING ERRCODE = '23503';
  END IF;

  RETURN v_result || jsonb_build_object('must_change_password', true);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_service_provision_invited_ambassador(
  uuid, uuid, uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_service_provision_invited_ambassador(
  uuid, uuid, uuid
) TO service_role;

-- Repair invitation registrations created before canonical provisioning was
-- adopted. Only exact CPF + phone matches resolving to one person are linked.
DO $$
DECLARE
  v_candidate record;
  v_result jsonb;
BEGIN
  FOR v_candidate IN
    SELECT
      a.id AS ambassador_id,
      a.user_id,
      matched.person_id,
      p.must_change_password
    FROM public.ambassadors a
    JOIN public.profiles p ON p.id = a.user_id
    JOIN LATERAL (
      SELECT (array_agg(DISTINCT c.person_id))[1] AS person_id
      FROM public.clientes c
      WHERE c.person_id IS NOT NULL
        AND c.lifecycle_status = 'active'
        AND regexp_replace(coalesce(c.cpf, ''), '\D', '', 'g') <> ''
        AND regexp_replace(coalesce(c.telefone, ''), '\D', '', 'g') <> ''
        AND regexp_replace(coalesce(c.cpf, ''), '\D', '', 'g') =
            regexp_replace(coalesce(a.cpf, ''), '\D', '', 'g')
        AND regexp_replace(coalesce(c.telefone, ''), '\D', '', 'g') =
            regexp_replace(coalesce(a.phone, ''), '\D', '', 'g')
      HAVING count(DISTINCT c.person_id) = 1
    ) matched ON matched.person_id IS NOT NULL
    WHERE a.status = 'ativo'
      AND a.lifecycle_status = 'active'
      AND a.user_id IS NOT NULL
      AND a.person_id IS NULL
  LOOP
    UPDATE public.ambassadors
    SET person_id = v_candidate.person_id,
        updated_at = now()
    WHERE id = v_candidate.ambassador_id
      AND person_id IS NULL;

    v_result := public.fn_service_provision_store_ambassador(
      v_candidate.ambassador_id,
      v_candidate.user_id,
      v_candidate.person_id
    );

    IF v_result->>'status' <> 'linked' THEN
      RAISE EXCEPTION 'legacy_invited_ambassador_repair_failed:%:%',
        v_candidate.ambassador_id,
        coalesce(v_result->>'status', 'unknown');
    END IF;

    UPDATE public.profiles
    SET must_change_password = v_candidate.must_change_password
    WHERE id = v_candidate.user_id;
  END LOOP;
END;
$$;

COMMIT;
