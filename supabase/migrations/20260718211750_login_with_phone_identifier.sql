BEGIN;

CREATE INDEX IF NOT EXISTS ambassadors_login_phone_normalized_idx
  ON public.ambassadors ((regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g')));
CREATE INDEX IF NOT EXISTS profiles_login_phone_normalized_idx
  ON public.profiles ((regexp_replace(COALESCE(telefone, ''), '[^0-9]', '', 'g')));

-- Resolve o telefone somente no servidor. A função não é exposta a anon/authenticated
-- para impedir enumeração pública de contas e nunca devolve dados ao navegador.
CREATE OR REPLACE FUNCTION public.fn_resolve_login_phone(p_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_username TEXT;
  v_email TEXT;
  v_count INTEGER;
BEGIN
  IF p_phone IS NULL OR p_phone !~ '^[0-9]{11}$' THEN
    RETURN NULL;
  END IF;

  -- Embaixadores têm precedência, pois usam o e-mail sintético derivado do username.
  SELECT COUNT(*), MIN(a.username)
  INTO v_count, v_username
  FROM public.ambassadors a
  WHERE regexp_replace(COALESCE(a.phone, ''), '[^0-9]', '', 'g') = p_phone
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
  WHERE regexp_replace(COALESCE(p.telefone, ''), '[^0-9]', '', 'g') = p_phone;

  IF v_count = 1 THEN
    RETURN v_email;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_resolve_login_phone(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_resolve_login_phone(TEXT) TO service_role;

COMMIT;
