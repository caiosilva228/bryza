-- ═══════════════════════════════════════════════════════════════════
-- BRYZA — Módulo Embaixadores: Fase 2
-- Migration: 20260717110000_amb_phase2_commission_plans.sql
-- Descrição: Tabela de planos de comissão + plano inicial.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_amb_set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.commission_plans (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT         NOT NULL,
  direct_percentage    NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (direct_percentage >= 0 AND direct_percentage <= 100),
  level_2_percentage   NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (level_2_percentage >= 0 AND level_2_percentage <= 100),
  level_3_percentage   NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (level_3_percentage >= 0 AND level_3_percentage <= 100),
  multilevel_enabled   BOOLEAN      NOT NULL DEFAULT FALSE,
  commission_base      TEXT         NOT NULL DEFAULT 'valor_final' CHECK (commission_base IN ('valor_final', 'valor_bruto', 'valor_liquido')),
  status               TEXT         NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'rascunho')),
  valid_from           TIMESTAMPTZ,
  valid_to             TIMESTAMPTZ,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_plan_valid_dates CHECK (valid_to IS NULL OR valid_to > valid_from)
);

DROP TRIGGER IF EXISTS trg_commission_plans_updated_at ON public.commission_plans;
CREATE TRIGGER trg_commission_plans_updated_at BEFORE UPDATE ON public.commission_plans FOR EACH ROW EXECUTE FUNCTION public.fn_amb_set_updated_at();

ALTER TABLE public.commission_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin acesso total commission_plans" ON public.commission_plans;
CREATE POLICY "Admin acesso total commission_plans" ON public.commission_plans FOR ALL TO authenticated USING (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "Leitura planos ativos para autenticados" ON public.commission_plans;
CREATE POLICY "Leitura planos ativos para autenticados" ON public.commission_plans FOR SELECT TO authenticated USING (status = 'ativo');

CREATE INDEX IF NOT EXISTS idx_commission_plans_status ON public.commission_plans (status);

INSERT INTO public.commission_plans (
  id, name, direct_percentage, level_2_percentage, level_3_percentage, multilevel_enabled, commission_base, status, valid_from
) VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Embaixador Inicial', 7.00, 0.00, 0.00, FALSE, 'valor_final', 'ativo', NOW()
) ON CONFLICT (id) DO NOTHING;

COMMIT;
