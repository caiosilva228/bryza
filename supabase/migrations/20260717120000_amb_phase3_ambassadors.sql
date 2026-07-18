-- ═══════════════════════════════════════════════════════════════════
-- BRYZA — Módulo Embaixadores: Fase 3
-- Migration: 20260717120000_amb_phase3_ambassadors.sql
-- Descrição: Tabela principal de embaixadores, sequência, RLS, 
--            triggers de geração de código, status sincronizado
--            e proteção de username.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

CREATE SEQUENCE IF NOT EXISTS public.ambassador_number_seq AS INTEGER START 1 INCREMENT 1 MINVALUE 1 NO MAXVALUE NO CYCLE CACHE 1;

CREATE TABLE IF NOT EXISTS public.ambassadors (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID         UNIQUE REFERENCES auth.users(id) ON DELETE RESTRICT,
  ambassador_number    INTEGER      NOT NULL UNIQUE, 
  username             TEXT         NOT NULL UNIQUE, 
  referral_code        TEXT         NOT NULL UNIQUE, 
  full_name            TEXT         NOT NULL,
  display_name         TEXT,
  cpf                  TEXT         NOT NULL UNIQUE,
  phone                TEXT,
  email                TEXT,
  instagram            TEXT,
  city                 TEXT,
  state                CHAR(2),
  pix_key_type         TEXT CHECK (pix_key_type IN ('cpf', 'cnpj', 'email', 'telefone', 'chave_aleatoria')),
  pix_key              TEXT,
  profile_image_url    TEXT,
  parent_ambassador_id UUID         REFERENCES public.ambassadors(id) ON DELETE RESTRICT,
  commission_plan_id   UUID         NOT NULL REFERENCES public.commission_plans(id) ON DELETE RESTRICT DEFAULT 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  status               TEXT         NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'ativo', 'inativo', 'bloqueado')),
  notes                TEXT,
  activated_at         TIMESTAMPTZ,
  deactivated_at       TIMESTAMPTZ,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_ambassador_cpf             CHECK (cpf ~ '^\d{11}$'),
  CONSTRAINT chk_ambassador_state           CHECK (state IS NULL OR state ~ '^[A-Z]{2}$'),
  CONSTRAINT chk_ambassador_dates           CHECK (deactivated_at IS NULL OR activated_at IS NULL OR deactivated_at >= activated_at),
  CONSTRAINT chk_ambassador_username_ref    CHECK (username = referral_code),
  CONSTRAINT chk_ambassador_username_format CHECK (username ~ '^bryza[0-9]{2,}$'),
  CONSTRAINT chk_ambassador_username_case   CHECK (username = LOWER(username))
);

-- ──────────────────────────────────────────────────────────────────
-- 1. Trigger de Geração Unificada + Bloqueio Manual
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_amb_generate_identifiers() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_num INTEGER;
  v_code TEXT;
BEGIN
  IF NEW.ambassador_number IS NOT NULL OR NEW.username IS NOT NULL OR NEW.referral_code IS NOT NULL THEN
    RAISE EXCEPTION 'Os campos ambassador_number, username e referral_code não podem ser fornecidos manualmente. Eles são gerados automaticamente.';
  END IF;

  v_num := nextval('public.ambassador_number_seq');
  NEW.ambassador_number := v_num;
  v_code := 'bryza' || LPAD(v_num::TEXT, 2, '0');
  NEW.username := v_code;
  NEW.referral_code := v_code;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ambassadors_generate_identifiers ON public.ambassadors;
CREATE TRIGGER trg_ambassadors_generate_identifiers BEFORE INSERT ON public.ambassadors FOR EACH ROW EXECUTE FUNCTION public.fn_amb_generate_identifiers();

-- ──────────────────────────────────────────────────────────────────
-- 2. Trigger de Proteção contra Deleção Física
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_amb_prevent_physical_delete() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Deleção física de embaixadores não é permitida. Altere o status para inativo ou bloqueado.';
END;
$$;

DROP TRIGGER IF EXISTS trg_amb_prevent_delete ON public.ambassadors;
CREATE TRIGGER trg_amb_prevent_delete BEFORE DELETE ON public.ambassadors FOR EACH ROW EXECUTE FUNCTION public.fn_amb_prevent_physical_delete();

-- ──────────────────────────────────────────────────────────────────
-- 3. Triggers de Sincronismo de Status (INSERT e UPDATE)
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_sync_ambassador_to_profile() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'ativo' THEN
    UPDATE public.profiles SET ativo = TRUE WHERE id = NEW.user_id AND ativo = FALSE;
  ELSIF NEW.status IN ('pendente', 'inativo', 'bloqueado') THEN
    UPDATE public.profiles SET ativo = FALSE WHERE id = NEW.user_id AND ativo = TRUE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_amb_to_profile ON public.ambassadors;
CREATE TRIGGER trg_sync_amb_to_profile AFTER INSERT OR UPDATE OF status ON public.ambassadors FOR EACH ROW EXECUTE FUNCTION public.fn_sync_ambassador_to_profile();

CREATE OR REPLACE FUNCTION public.fn_sync_profile_to_ambassador() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.role = 'embaixador' THEN
    IF NEW.ativo = TRUE THEN
      UPDATE public.ambassadors SET status = 'ativo' WHERE user_id = NEW.id AND status != 'ativo';
    ELSE
      UPDATE public.ambassadors SET status = 'bloqueado' WHERE user_id = NEW.id AND status NOT IN ('inativo', 'bloqueado', 'pendente');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_to_amb ON public.profiles;
CREATE TRIGGER trg_sync_profile_to_amb AFTER INSERT OR UPDATE OF ativo ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.fn_sync_profile_to_ambassador();

-- ──────────────────────────────────────────────────────────────────
-- 4. Triggers de Sincronismo e Proteção de Username (Profiles <-> Ambassadors)
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_sync_amb_username_to_profile() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.profiles
  SET username = NEW.username
  WHERE id = NEW.user_id AND (username IS DISTINCT FROM NEW.username OR username IS NULL);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_amb_username_to_profile ON public.ambassadors;
CREATE TRIGGER trg_sync_amb_username_to_profile
  AFTER INSERT OR UPDATE OF username ON public.ambassadors
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_amb_username_to_profile();

CREATE OR REPLACE FUNCTION public.fn_protect_profile_username_divergence() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.role = 'embaixador' AND EXISTS (SELECT 1 FROM public.ambassadors WHERE user_id = NEW.id) THEN
    IF NEW.username IS DISTINCT FROM (SELECT username FROM public.ambassadors WHERE user_id = NEW.id) THEN
      RAISE EXCEPTION 'O username do profile do embaixador não pode divergir do username registrado em ambassadors.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_username_divergence ON public.profiles;
CREATE TRIGGER trg_protect_profile_username_divergence
  BEFORE UPDATE OF username ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_protect_profile_username_divergence();

-- ──────────────────────────────────────────────────────────────────
-- 5. Funções de Proteção do Código + Segurança da RPC
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_amb_protect_referral_code() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.referral_code IS DISTINCT FROM NEW.referral_code OR OLD.username IS DISTINCT FROM NEW.username THEN
    RAISE EXCEPTION 'referral_code e username são imutáveis após a criação.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ambassadors_protect_referral_code ON public.ambassadors;
CREATE TRIGGER trg_ambassadors_protect_referral_code BEFORE UPDATE ON public.ambassadors FOR EACH ROW EXECUTE FUNCTION public.fn_amb_protect_referral_code();

CREATE OR REPLACE FUNCTION public.fn_amb_get_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.ambassadors WHERE user_id = auth.uid() LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_amb_get_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_amb_get_id() TO authenticated;

-- RLS
ALTER TABLE public.ambassadors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin acesso total ambassadors" ON public.ambassadors;
CREATE POLICY "Admin acesso total ambassadors" ON public.ambassadors FOR ALL TO authenticated USING (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "Embaixador ve proprio perfil" ON public.ambassadors;
CREATE POLICY "Embaixador ve proprio perfil" ON public.ambassadors FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_ambassadors_user_id ON public.ambassadors (user_id);
CREATE INDEX IF NOT EXISTS idx_ambassadors_status ON public.ambassadors (status);
CREATE INDEX IF NOT EXISTS idx_ambassadors_referral_code ON public.ambassadors (referral_code);

COMMIT;
