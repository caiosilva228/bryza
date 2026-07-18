-- ═══════════════════════════════════════════════════════════════════
-- BRYZA — Módulo Embaixadores: Fase 1
-- Migration: 20260717100000_amb_phase1_profiles_enum.sql
-- Descrição: Adiciona 'embaixador' ao enum app_role e estende
--            profiles com campos de autenticação compartilhados.
-- ═══════════════════════════════════════════════════════════════════

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'embaixador';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username              TEXT,
  ADD COLUMN IF NOT EXISTS must_change_password  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_login_at         TIMESTAMPTZ;

-- Constraints e Validações
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_username_lowercase_chk;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_lowercase_chk 
  CHECK (username = LOWER(username));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_username_format_chk;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_format_chk 
  CHECK (username IS NULL OR username ~ '^bryza[0-9]{2,}$');

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_username_unique' AND conrelid = 'public.profiles'::regclass) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_unique UNIQUE (username);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles (username) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_role_ativo ON public.profiles (role, ativo);
