-- ═══════════════════════════════════════════════════════════════════
-- BRYZA — Módulo Embaixadores: Fase 4
-- Migration: 20260717130000_amb_phase4_referral_tracking.sql
-- Descrição: Tabelas de visitas e atribuições de indicação, com
--            RPC segura SECURITY DEFINER para registro público.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.referral_visits (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id      UUID         NOT NULL REFERENCES public.ambassadors(id) ON DELETE CASCADE,
  referral_code      TEXT         NOT NULL,
  session_id         TEXT,
  utm_source         TEXT,
  utm_medium         TEXT,
  utm_campaign       TEXT,
  utm_content        TEXT,
  utm_term           TEXT,
  landing_path       TEXT,
  destination_path   TEXT,
  user_agent_summary TEXT,
  ip_hash            TEXT,
  visited_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  metadata           JSONB
);

CREATE TABLE IF NOT EXISTS public.referral_attributions (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id    UUID         NOT NULL REFERENCES public.ambassadors(id) ON DELETE RESTRICT,
  customer_id      UUID         REFERENCES public.clientes(id) ON DELETE SET NULL,
  referral_code    TEXT         NOT NULL,
  source           TEXT,
  status           TEXT         NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'atribuido', 'convertido', 'expirado', 'cancelado')),
  first_visit_at   TIMESTAMPTZ,
  attributed_at    TIMESTAMPTZ,
  converted_at     TIMESTAMPTZ,
  locked_at        TIMESTAMPTZ,
  metadata         JSONB,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_referral_attributions_updated_at ON public.referral_attributions;
CREATE TRIGGER trg_referral_attributions_updated_at BEFORE UPDATE ON public.referral_attributions FOR EACH ROW EXECUTE FUNCTION public.fn_amb_set_updated_at();

-- Unicidade: Apenas uma atribuição ativa/confirmada por cliente
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_attribution_per_customer ON public.referral_attributions (customer_id) WHERE (status IN ('atribuido', 'convertido'));

-- RPC Segura para Inserção de Visitas Públicas
CREATE OR REPLACE FUNCTION public.fn_log_referral_visit(
  p_referral_code TEXT, p_session_id TEXT, p_utm_source TEXT DEFAULT NULL, p_utm_medium TEXT DEFAULT NULL, p_utm_campaign TEXT DEFAULT NULL, p_utm_content TEXT DEFAULT NULL, p_utm_term TEXT DEFAULT NULL, p_landing_path TEXT DEFAULT NULL, p_destination_path TEXT DEFAULT NULL, p_user_agent_summary TEXT DEFAULT NULL, p_ip_hash TEXT DEFAULT NULL, p_metadata JSONB DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_amb_id UUID;
  v_visit_id UUID;
BEGIN
  SELECT id INTO v_amb_id FROM public.ambassadors WHERE referral_code = p_referral_code AND status = 'ativo' LIMIT 1;
  IF v_amb_id IS NULL THEN RAISE EXCEPTION 'Código de indicação inválido ou embaixador inativo.'; END IF;

  INSERT INTO public.referral_visits (ambassador_id, referral_code, session_id, utm_source, utm_medium, utm_campaign, utm_content, utm_term, landing_path, destination_path, user_agent_summary, ip_hash, metadata) 
  VALUES (v_amb_id, p_referral_code, p_session_id, p_utm_source, p_utm_medium, p_utm_campaign, p_utm_content, p_utm_term, p_landing_path, p_destination_path, p_user_agent_summary, p_ip_hash, p_metadata) RETURNING id INTO v_visit_id;
  RETURN v_visit_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_log_referral_visit(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_log_referral_visit(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO anon, authenticated;

-- RLS
ALTER TABLE public.referral_visits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin acesso total referral_visits" ON public.referral_visits;
CREATE POLICY "Admin acesso total referral_visits" ON public.referral_visits FOR ALL TO authenticated USING (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "Embaixador ve proprias visitas" ON public.referral_visits;
CREATE POLICY "Embaixador ve proprias visitas" ON public.referral_visits FOR SELECT TO authenticated USING (ambassador_id = public.fn_amb_get_id());

ALTER TABLE public.referral_attributions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin acesso total referral_attributions" ON public.referral_attributions;
CREATE POLICY "Admin acesso total referral_attributions" ON public.referral_attributions FOR ALL TO authenticated USING (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "Embaixador ve proprias atribuicoes" ON public.referral_attributions;
CREATE POLICY "Embaixador ve proprias atribuicoes" ON public.referral_attributions FOR SELECT TO authenticated USING (ambassador_id = public.fn_amb_get_id());

CREATE INDEX IF NOT EXISTS idx_rv_ambassador_id ON public.referral_visits (ambassador_id);
CREATE INDEX IF NOT EXISTS idx_ra_customer_id ON public.referral_attributions (customer_id);

COMMIT;
