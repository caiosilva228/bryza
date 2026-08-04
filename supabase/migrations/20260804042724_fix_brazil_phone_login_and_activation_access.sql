BEGIN;

-- Keep phone login aligned with the canonical Brazilian format used by the
-- application: DDD + 8 digits for landlines or DDD + 9 digits for mobiles.
-- The resolver is server-only, so it may normalize presentation formatting
-- before comparing the value stored in the canonical identity tables.
CREATE OR REPLACE FUNCTION public.fn_resolve_login_phone(p_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_phone TEXT;
  v_username TEXT;
  v_email TEXT;
  v_count INTEGER;
BEGIN
  v_phone := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');

  IF length(v_phone) IN (12, 13) AND left(v_phone, 2) = '55' THEN
    v_phone := substr(v_phone, 3);
  END IF;

  IF v_phone !~ '^([1-9][1-9][2-5][0-9]{7}|[1-9][1-9]9[0-9]{8})$' THEN
    RETURN NULL;
  END IF;

  -- Embaixadores têm precedência, pois usam o e-mail sintético derivado do
  -- username. Contas sem user_id ainda não podem autenticar.
  SELECT COUNT(*), MIN(a.username)
  INTO v_count, v_username
  FROM public.ambassadors a
  WHERE regexp_replace(COALESCE(a.phone, ''), '[^0-9]', '', 'g') = v_phone
    AND a.user_id IS NOT NULL;

  IF v_count = 1 THEN
    RETURN v_username || '@usuarios.bryza.internal';
  ELSIF v_count > 1 THEN
    RETURN NULL;
  END IF;

  -- Para os demais papéis, telefones duplicados são rejeitados por segurança.
  SELECT COUNT(*), MIN(p.email)
  INTO v_count, v_email
  FROM public.profiles p
  WHERE regexp_replace(COALESCE(p.telefone, ''), '[^0-9]', '', 'g') = v_phone;

  IF v_count = 1 THEN
    RETURN v_email;
  END IF;

  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_resolve_login_phone(TEXT)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_resolve_login_phone(TEXT) TO service_role;

COMMIT;
