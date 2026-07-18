-- ═══════════════════════════════════════════════════════════════════
-- BRYZA — Módulo Embaixadores: Rate Limit de Login e Restrições de Segurança
-- Migration: 20260717190000_auth_rate_limit_and_logs.sql
-- Descrição: Tabela de login_attempts, funções de rate limit e
--            grants explícitos restritos à service_role.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- 1. Tabela login_attempts com RLS e sem grants públicos
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash      TEXT         NOT NULL,
  username     TEXT         NOT NULL,
  attempted_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  success      BOOLEAN      NOT NULL
);

-- Ativar RLS
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Revogar todos os privilégios da tabela para anon/authenticated/public
REVOKE ALL ON public.login_attempts FROM PUBLIC, anon, authenticated;

-- Adicionar índices para otimização de consultas de rate limit
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time ON public.login_attempts (ip_hash, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_user_time ON public.login_attempts (username, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_user_time ON public.login_attempts (ip_hash, username, attempted_at DESC);

-- 2. Função de Verificação de Rate Limit
CREATE OR REPLACE FUNCTION public.fn_check_login_rate_limit(
  p_ip_hash TEXT,
  p_username TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_username_norm TEXT;
  v_failed_ip_user_count INTEGER;
  v_failed_ip_count INTEGER;
  v_failed_user_count INTEGER;
BEGIN
  -- Normaliza username: remove espaços em branco nas bordas e converte para minúsculas
  v_username_norm := LOWER(TRIM(p_username));

  -- Limite 1: Bloqueia se >= 5 tentativas falhas para IP + Username nos últimos 5 minutos
  SELECT COUNT(*)::INTEGER INTO v_failed_ip_user_count
  FROM public.login_attempts
  WHERE ip_hash = p_ip_hash
    AND username = v_username_norm
    AND success = FALSE
    AND attempted_at >= NOW() - INTERVAL '5 minutes';

  IF v_failed_ip_user_count >= 5 THEN
    RETURN TRUE; -- Bloqueado
  END IF;

  -- Limite 2: Bloqueia se >= 20 tentativas falhas para IP nos últimos 15 minutos
  SELECT COUNT(*)::INTEGER INTO v_failed_ip_count
  FROM public.login_attempts
  WHERE ip_hash = p_ip_hash
    AND success = FALSE
    AND attempted_at >= NOW() - INTERVAL '15 minutes';

  IF v_failed_ip_count >= 20 THEN
    RETURN TRUE; -- Bloqueado
  END IF;

  -- Limite 3: Bloqueia se >= 10 tentativas falhas para Username nos últimos 15 minutos
  SELECT COUNT(*)::INTEGER INTO v_failed_user_count
  FROM public.login_attempts
  WHERE username = v_username_norm
    AND success = FALSE
    AND attempted_at >= NOW() - INTERVAL '15 minutes';

  IF v_failed_user_count >= 10 THEN
    RETURN TRUE; -- Bloqueado
  END IF;

  RETURN FALSE; -- Liberado
END;
$$;

-- 3. Função de Registro de Tentativa de Login
CREATE OR REPLACE FUNCTION public.fn_register_login_attempt(
  p_ip_hash TEXT,
  p_username TEXT,
  p_success BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.login_attempts (ip_hash, username, success)
  VALUES (p_ip_hash, LOWER(TRIM(p_username)), p_success);
END;
$$;

-- 4. Procedure de Limpeza e Retenção de Logs (24 horas)
CREATE OR REPLACE PROCEDURE public.pr_cleanup_login_attempts()
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.login_attempts
  WHERE attempted_at < NOW() - INTERVAL '24 hours';
END;
$$;

-- 5. Revogar e conceder privilégios explícitos conforme exigido
REVOKE ALL ON FUNCTION public.fn_check_login_rate_limit(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_register_login_attempt(TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON PROCEDURE public.pr_cleanup_login_attempts() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.fn_check_login_rate_limit(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_register_login_attempt(TEXT, TEXT, BOOLEAN) TO service_role;
GRANT EXECUTE ON PROCEDURE public.pr_cleanup_login_attempts() TO service_role;

-- 6. Adição da Constraint Única de E-mail de Contato em ambassadors
CREATE UNIQUE INDEX IF NOT EXISTS idx_amb_email_lower_uniq ON public.ambassadors (LOWER(email));

COMMIT;
