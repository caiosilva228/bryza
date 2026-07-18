-- ═══════════════════════════════════════════════════════════════════
-- BRYZA — Módulo Embaixadores: Fase 5
-- Migration: 20260717140000_amb_phase5_commissions.sql
-- Descrição: Tabelas de comissões, pagamentos e itens de pagamento,
--            com triggers de imutabilidade e integridade rigorosa.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.commissions (
  id                       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id            UUID         NOT NULL REFERENCES public.ambassadors(id) ON DELETE RESTRICT,
  order_id                 UUID         NOT NULL REFERENCES public.pedidos(id) ON DELETE RESTRICT,
  customer_id              UUID         REFERENCES public.clientes(id) ON DELETE SET NULL,
  commission_plan_id       UUID         NOT NULL REFERENCES public.commission_plans(id) ON DELETE RESTRICT,
  commission_level         INTEGER      NOT NULL DEFAULT 1 CHECK (commission_level BETWEEN 1 AND 3),
  commissionable_amount    NUMERIC(12,2) NOT NULL CHECK (commissionable_amount >= 0),
  order_amount_snapshot    NUMERIC(12,2) NOT NULL CHECK (order_amount_snapshot >= 0),
  percentage_snapshot      NUMERIC(5,2)  NOT NULL CHECK (percentage_snapshot >= 0 AND percentage_snapshot <= 100),
  commission_amount        NUMERIC(12,2) NOT NULL CHECK (commission_amount >= 0),
  status                   TEXT          NOT NULL DEFAULT 'aguardando_entrega' CHECK (status IN ('aguardando_entrega', 'aguardando_pagamento', 'liberada', 'paga', 'cancelada', 'estornada')),
  available_at             TIMESTAMPTZ,
  paid_at                  TIMESTAMPTZ,
  cancelled_at             TIMESTAMPTZ,
  reversed_at              TIMESTAMPTZ,
  cancellation_reason      TEXT,
  created_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_commission_order_amb_level UNIQUE (order_id, ambassador_id, commission_level)
);

CREATE TABLE IF NOT EXISTS public.commission_payments (
  id                       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id            UUID         NOT NULL REFERENCES public.ambassadors(id) ON DELETE RESTRICT,
  amount                   NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_method           TEXT          NOT NULL DEFAULT 'pix' CHECK (payment_method IN ('pix', 'transferencia', 'outro')),
  ambassador_name_snapshot TEXT          NOT NULL,
  cpf_masked_snapshot      TEXT          NOT NULL,
  pix_key_type_snapshot    TEXT,
  pix_key_snapshot         TEXT,
  payment_reference        TEXT,
  receipt_url              TEXT,
  status                   TEXT          NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'processando', 'paga', 'cancelada', 'estornada')),
  paid_at                  TIMESTAMPTZ,
  notes                    TEXT,
  created_by               UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.commission_payment_items (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id    UUID         NOT NULL REFERENCES public.commission_payments(id) ON DELETE CASCADE,
  commission_id UUID         NOT NULL UNIQUE REFERENCES public.commissions(id) ON DELETE RESTRICT,
  amount        NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_commissions_updated_at ON public.commissions;
CREATE TRIGGER trg_commissions_updated_at BEFORE UPDATE ON public.commissions FOR EACH ROW EXECUTE FUNCTION public.fn_amb_set_updated_at();

DROP TRIGGER IF EXISTS trg_commission_payments_updated_at ON public.commission_payments;
CREATE TRIGGER trg_commission_payments_updated_at BEFORE UPDATE ON public.commission_payments FOR EACH ROW EXECUTE FUNCTION public.fn_amb_set_updated_at();

-- 1. Imutabilidade das Comissões
CREATE OR REPLACE FUNCTION public.fn_amb_protect_commission_snapshots() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.ambassador_id IS DISTINCT FROM NEW.ambassador_id OR OLD.order_id IS DISTINCT FROM NEW.order_id OR OLD.commission_plan_id IS DISTINCT FROM NEW.commission_plan_id OR OLD.commission_level IS DISTINCT FROM NEW.commission_level OR OLD.commissionable_amount IS DISTINCT FROM NEW.commissionable_amount OR OLD.order_amount_snapshot IS DISTINCT FROM NEW.order_amount_snapshot OR OLD.percentage_snapshot IS DISTINCT FROM NEW.percentage_snapshot OR OLD.commission_amount IS DISTINCT FROM NEW.commission_amount THEN
    RAISE EXCEPTION 'Dados financeiros e snapshots de comissão já gerados são imutáveis.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_commission_snapshots ON public.commissions;
CREATE TRIGGER trg_protect_commission_snapshots BEFORE UPDATE ON public.commissions FOR EACH ROW EXECUTE FUNCTION public.fn_amb_protect_commission_snapshots();

-- 2. Imutabilidade Constante de Pagamentos Consolidados (Imutável após INSERT)
CREATE OR REPLACE FUNCTION public.fn_amb_protect_payment_snapshots() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.amount IS DISTINCT FROM NEW.amount OR OLD.ambassador_id IS DISTINCT FROM NEW.ambassador_id OR OLD.ambassador_name_snapshot IS DISTINCT FROM NEW.ambassador_name_snapshot OR OLD.cpf_masked_snapshot IS DISTINCT FROM NEW.cpf_masked_snapshot OR OLD.pix_key_type_snapshot IS DISTINCT FROM NEW.pix_key_type_snapshot OR OLD.pix_key_snapshot IS DISTINCT FROM NEW.pix_key_snapshot THEN
    RAISE EXCEPTION 'Snapshots e valores principais de pagamentos não podem ser alterados após a criação.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_payment_snapshots ON public.commission_payments;
CREATE TRIGGER trg_protect_payment_snapshots BEFORE UPDATE ON public.commission_payments FOR EACH ROW EXECUTE FUNCTION public.fn_amb_protect_payment_snapshots();

-- 3. Trigger de Integridade em commission_payment_items (Validações de Regras de Negócio)
CREATE OR REPLACE FUNCTION public.fn_amb_validate_payment_item()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_payment_status TEXT;
  v_payment_amb_id UUID;
  v_comm_amb_id UUID;
  v_comm_amount NUMERIC(12,2);
  v_comm_status TEXT;
BEGIN
  -- A. Deleção: Impedir se o pagamento estiver finalizado
  IF TG_OP = 'DELETE' THEN
    SELECT status INTO v_payment_status FROM public.commission_payments WHERE id = OLD.payment_id;
    IF v_payment_status IN ('paga', 'cancelada', 'estornada') THEN
      RAISE EXCEPTION 'Não é permitido remover itens de um pagamento finalizado (paga/cancelada/estornada).';
    END IF;
    RETURN OLD;
  END IF;

  -- B. Inserção ou Alteração: Obter dados do pagamento
  SELECT status, ambassador_id INTO v_payment_status, v_payment_amb_id
  FROM public.commission_payments
  WHERE id = NEW.payment_id;

  IF v_payment_status IN ('paga', 'cancelada', 'estornada') THEN
    RAISE EXCEPTION 'Não é permitido adicionar ou alterar itens de um pagamento finalizado (paga/cancelada/estornada).';
  END IF;

  -- Obter dados da comissão associada
  SELECT ambassador_id, commission_amount, status INTO v_comm_amb_id, v_comm_amount, v_comm_status
  FROM public.commissions
  WHERE id = NEW.commission_id;

  -- Validação 1: Comissão e pagamento pertencem ao mesmo embaixador
  IF v_payment_amb_id IS DISTINCT FROM v_comm_amb_id THEN
    RAISE EXCEPTION 'A comissão e o pagamento devem pertencer ao mesmo embaixador.';
  END IF;

  -- Validação 2: Amount do item é igual ao amount da comissão
  IF NEW.amount IS DISTINCT FROM v_comm_amount THEN
    RAISE EXCEPTION 'O valor do item (%) deve ser igual ao valor da comissão (%).', NEW.amount, v_comm_amount;
  END IF;

  -- Validação 3: Somente comissão com status "liberada" pode entrar no pagamento (se for insert ou se a comissão mudou)
  IF v_comm_status IS DISTINCT FROM 'liberada' AND (TG_OP = 'INSERT' OR OLD.commission_id IS DISTINCT FROM NEW.commission_id) THEN
    RAISE EXCEPTION 'Apenas comissões com status "liberada" podem ser associadas a um pagamento.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_amb_validate_payment_item ON public.commission_payment_items;
CREATE TRIGGER trg_amb_validate_payment_item
  BEFORE INSERT OR UPDATE OR DELETE ON public.commission_payment_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_amb_validate_payment_item();

-- RLS
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin acesso total commissions" ON public.commissions;
CREATE POLICY "Admin acesso total commissions" ON public.commissions FOR ALL TO authenticated USING (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "Embaixador ve proprias comissoes" ON public.commissions;
CREATE POLICY "Embaixador ve proprias comissoes" ON public.commissions FOR SELECT TO authenticated USING (ambassador_id = public.fn_amb_get_id());

ALTER TABLE public.commission_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin acesso total commission_payments" ON public.commission_payments;
CREATE POLICY "Admin acesso total commission_payments" ON public.commission_payments FOR ALL TO authenticated USING (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "Embaixador ve proprios pagamentos" ON public.commission_payments;
CREATE POLICY "Embaixador ve proprios pagamentos" ON public.commission_payments FOR SELECT TO authenticated USING (ambassador_id = public.fn_amb_get_id());

ALTER TABLE public.commission_payment_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin acesso total payment_items" ON public.commission_payment_items;
CREATE POLICY "Admin acesso total payment_items" ON public.commission_payment_items FOR ALL TO authenticated USING (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "Embaixador ve proprios itens" ON public.commission_payment_items;
CREATE POLICY "Embaixador ve proprios itens" ON public.commission_payment_items FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.commission_payments cp WHERE cp.id = commission_payment_items.payment_id AND cp.ambassador_id = public.fn_amb_get_id())
);

COMMIT;
