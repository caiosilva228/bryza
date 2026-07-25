-- Remote migration 20260724204834.
CREATE OR REPLACE FUNCTION private.prevent_independent_personal_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_old jsonb := to_jsonb(OLD);
  v_new jsonb := to_jsonb(NEW);
BEGIN
  IF coalesce(current_setting('bryza.canonical_identity_write', true), '') = 'true'
     OR nullif(v_old->>'person_id', '') IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'clientes'
     AND (
       v_new->'nome' IS DISTINCT FROM v_old->'nome'
       OR v_new->'cpf' IS DISTINCT FROM v_old->'cpf'
       OR v_new->'email' IS DISTINCT FROM v_old->'email'
       OR v_new->'telefone' IS DISTINCT FROM v_old->'telefone'
     ) THEN
    RAISE EXCEPTION 'canonical_identity_write_required' USING ERRCODE = '42501';
  ELSIF TG_TABLE_NAME = 'profiles'
     AND (
       v_new->'nome' IS DISTINCT FROM v_old->'nome'
       OR v_new->'cpf' IS DISTINCT FROM v_old->'cpf'
       OR v_new->'email' IS DISTINCT FROM v_old->'email'
       OR v_new->'telefone' IS DISTINCT FROM v_old->'telefone'
     ) THEN
    RAISE EXCEPTION 'canonical_identity_write_required' USING ERRCODE = '42501';
  ELSIF TG_TABLE_NAME = 'ambassadors'
     AND (
       v_new->'full_name' IS DISTINCT FROM v_old->'full_name'
       OR v_new->'cpf' IS DISTINCT FROM v_old->'cpf'
       OR v_new->'email' IS DISTINCT FROM v_old->'email'
       OR v_new->'phone' IS DISTINCT FROM v_old->'phone'
     ) THEN
    RAISE EXCEPTION 'canonical_identity_write_required' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.prevent_independent_personal_write()
  FROM PUBLIC, anon, authenticated;
