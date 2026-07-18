-- ═══════════════════════════════════════════════════════════════════
-- BRYZA — Módulo Embaixadores: Fase 6
-- Migration: 20260717150000_amb_phase6_program_settings.sql
-- Descrição: Configurações globais do programa com restrição estrita
--            de singleton (somente uma linha permitida).
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.ambassador_program_settings (
  id                            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton                     BOOLEAN       NOT NULL DEFAULT TRUE UNIQUE,
  default_commission_plan_id    UUID          REFERENCES public.commission_plans(id) ON DELETE SET NULL,
  referral_attribution_days     INTEGER       NOT NULL DEFAULT 30 CHECK (referral_attribution_days > 0),
  minimum_payment_amount        NUMERIC(12,2) NOT NULL DEFAULT 50.00 CHECK (minimum_payment_amount >= 0),
  payment_frequency             TEXT          NOT NULL DEFAULT 'mensal' CHECK (payment_frequency IN ('semanal', 'quinzenal', 'mensal')),
  referral_destination_url      TEXT,
  whatsapp_number               TEXT,
  whatsapp_message_template     TEXT,
  program_status                TEXT          NOT NULL DEFAULT 'ativo' CHECK (program_status IN ('ativo', 'pausado', 'encerrado')),
  allow_pix_edit                BOOLEAN       NOT NULL DEFAULT TRUE,
  require_pix_change_approval   BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at                    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_singleton_true CHECK (singleton = TRUE)
);

DROP TRIGGER IF EXISTS trg_program_settings_updated_at ON public.ambassador_program_settings;
CREATE TRIGGER trg_program_settings_updated_at BEFORE UPDATE ON public.ambassador_program_settings FOR EACH ROW EXECUTE FUNCTION public.fn_amb_set_updated_at();

ALTER TABLE public.ambassador_program_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin acesso total program_settings" ON public.ambassador_program_settings;
CREATE POLICY "Admin acesso total program_settings" ON public.ambassador_program_settings FOR ALL TO authenticated USING (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "Leitura de settings para autenticados" ON public.ambassador_program_settings;
CREATE POLICY "Leitura de settings para autenticados" ON public.ambassador_program_settings FOR SELECT TO authenticated USING (TRUE);

INSERT INTO public.ambassador_program_settings (
  id, singleton, default_commission_plan_id, referral_attribution_days, minimum_payment_amount, payment_frequency, program_status, allow_pix_edit, require_pix_change_approval
) VALUES (
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', TRUE, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 30, 50.00, 'mensal', 'ativo', TRUE, FALSE
) ON CONFLICT (singleton) DO NOTHING;

COMMIT;
