-- ═══════════════════════════════════════════════════════════════════
-- BRYZA — Módulo Embaixadores: Fase 7
-- Migration: 20260717160000_amb_phase7_integrations.sql
-- Descrição: Integração das tabelas de Clientes e Pedidos com campos
--            de indicação, comissões, snapshots e trigger de proteção
--            completa contra overrides do role vendedor.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS ambassador_id          UUID REFERENCES public.ambassadors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referral_code          TEXT,
  ADD COLUMN IF NOT EXISTS referral_source        TEXT,
  ADD COLUMN IF NOT EXISTS referral_attributed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS referral_locked_at     TIMESTAMPTZ;

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS ambassador_id                  UUID REFERENCES public.ambassadors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referral_code_snapshot         TEXT,
  ADD COLUMN IF NOT EXISTS commission_plan_id_snapshot    UUID,
  ADD COLUMN IF NOT EXISTS commission_percentage_snapshot NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS commissionable_amount_snapshot NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS commission_amount_snapshot     NUMERIC(12,2);

CREATE OR REPLACE FUNCTION public.fn_amb_protect_seller_overrides() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_role app_role;
BEGIN
  v_role := public.get_user_role();
  IF v_role = 'vendedor' THEN
    IF TG_TABLE_NAME = 'clientes' THEN
      IF TG_OP = 'INSERT' THEN
        IF NEW.ambassador_id IS NOT NULL OR NEW.referral_code IS NOT NULL OR NEW.referral_source IS NOT NULL OR NEW.referral_attributed_at IS NOT NULL OR NEW.referral_locked_at IS NOT NULL THEN
          RAISE EXCEPTION 'Vendedores não possuem permissão para inserir clientes com dados de indicação preenchidos.';
        END IF;
      ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.ambassador_id IS DISTINCT FROM NEW.ambassador_id OR OLD.referral_code IS DISTINCT FROM NEW.referral_code OR OLD.referral_source IS DISTINCT FROM NEW.referral_source OR OLD.referral_attributed_at IS DISTINCT FROM NEW.referral_attributed_at OR OLD.referral_locked_at IS DISTINCT FROM NEW.referral_locked_at THEN
          RAISE EXCEPTION 'Vendedores não possuem permissão para alterar dados de indicação do cliente.';
        END IF;
      END IF;
    END IF;

    IF TG_TABLE_NAME = 'pedidos' THEN
      IF TG_OP = 'INSERT' THEN
        IF NEW.ambassador_id IS NOT NULL OR NEW.referral_code_snapshot IS NOT NULL OR NEW.commission_plan_id_snapshot IS NOT NULL OR NEW.commission_percentage_snapshot IS NOT NULL OR NEW.commissionable_amount_snapshot IS NOT NULL OR NEW.commission_amount_snapshot IS NOT NULL THEN
          RAISE EXCEPTION 'Vendedores não possuem permissão para criar pedidos contendo snapshots de embaixadores/comissões.';
        END IF;
      ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.ambassador_id IS DISTINCT FROM NEW.ambassador_id OR OLD.referral_code_snapshot IS DISTINCT FROM NEW.referral_code_snapshot OR OLD.commission_plan_id_snapshot IS DISTINCT FROM NEW.commission_plan_id_snapshot OR OLD.commission_percentage_snapshot IS DISTINCT FROM NEW.commission_percentage_snapshot OR OLD.commissionable_amount_snapshot IS DISTINCT FROM NEW.commissionable_amount_snapshot OR OLD.commission_amount_snapshot IS DISTINCT FROM NEW.commission_amount_snapshot THEN
          RAISE EXCEPTION 'Vendedores não possuem permissão para alterar snapshots e comissões de pedidos.';
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_seller_clientes ON public.clientes;
CREATE TRIGGER trg_protect_seller_clientes BEFORE INSERT OR UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.fn_amb_protect_seller_overrides();

DROP TRIGGER IF EXISTS trg_protect_seller_pedidos ON public.pedidos;
CREATE TRIGGER trg_protect_seller_pedidos BEFORE INSERT OR UPDATE ON public.pedidos FOR EACH ROW EXECUTE FUNCTION public.fn_amb_protect_seller_overrides();

COMMIT;
