-- ═══════════════════════════════════════════════════════════════════
-- BRYZA — Módulo de Motoristas e Remuneração
-- Migration: 20260712220000_create_drivers.sql
-- ═══════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────
-- TABELA: drivers
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.drivers (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name                 TEXT NOT NULL,
  phone                     TEXT NOT NULL,
  city                      TEXT,

  vehicle_type              TEXT,
  vehicle_model             TEXT,
  vehicle_plate             TEXT,

  status                    TEXT NOT NULL DEFAULT 'active',

  notes                     TEXT,

  compensation_model        TEXT NOT NULL DEFAULT 'per_delivery',

  amount_per_delivery       NUMERIC(10,2),
  amount_per_route          NUMERIC(10,2),
  daily_amount              NUMERIC(10,2),

  pay_failed_attempt        BOOLEAN NOT NULL DEFAULT FALSE,
  amount_per_failed_attempt NUMERIC(10,2),

  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_drivers_status    ON public.drivers(status);
CREATE INDEX IF NOT EXISTS idx_drivers_full_name ON public.drivers(full_name);

-- ──────────────────────────────────────────────────────────────────
-- TABELA: driver_route_compensations
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.driver_route_compensations (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id                  TEXT NOT NULL,
  driver_id                 UUID NOT NULL REFERENCES public.drivers(id) ON DELETE RESTRICT,

  compensation_model        TEXT NOT NULL,
  amount_per_delivery       NUMERIC(10,2),
  amount_per_route          NUMERIC(10,2),
  daily_amount              NUMERIC(10,2),
  pay_failed_attempt        BOOLEAN NOT NULL DEFAULT FALSE,
  amount_per_failed_attempt NUMERIC(10,2),

  completed_deliveries      INTEGER NOT NULL DEFAULT 0,
  paid_failed_attempts      INTEGER NOT NULL DEFAULT 0,

  base_amount               NUMERIC(10,2) NOT NULL DEFAULT 0,
  deliveries_amount         NUMERIC(10,2) NOT NULL DEFAULT 0,
  failed_attempts_amount    NUMERIC(10,2) NOT NULL DEFAULT 0,
  calculated_amount         NUMERIC(10,2) NOT NULL DEFAULT 0,

  manual_adjustment         NUMERIC(10,2) NOT NULL DEFAULT 0,
  adjustment_reason         TEXT,

  final_amount              NUMERIC(10,2) NOT NULL DEFAULT 0,

  status                    TEXT NOT NULL DEFAULT 'open',

  approved_at               TIMESTAMPTZ,
  paid_at                   TIMESTAMPTZ,

  notes                     TEXT,

  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ,

  CONSTRAINT unique_route_compensation UNIQUE (route_id, driver_id)
);

CREATE INDEX IF NOT EXISTS idx_drc_driver_id  ON public.driver_route_compensations(driver_id);
CREATE INDEX IF NOT EXISTS idx_drc_route_id   ON public.driver_route_compensations(route_id);
CREATE INDEX IF NOT EXISTS idx_drc_status     ON public.driver_route_compensations(status);
CREATE INDEX IF NOT EXISTS idx_drc_created_at ON public.driver_route_compensations(created_at DESC);

-- ──────────────────────────────────────────────────────────────────
-- RLS
-- ──────────────────────────────────────────────────────────────────
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_route_compensations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin acesso total drivers"
  ON public.drivers FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin');

CREATE POLICY "Logistica le drivers"
  ON public.drivers FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('logistica', 'admin'));

CREATE POLICY "Admin acesso total driver_compensations"
  ON public.driver_route_compensations FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin');

CREATE POLICY "Logistica le compensations"
  ON public.driver_route_compensations FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('logistica', 'admin'));

-- ──────────────────────────────────────────────────────────────────
-- CAMPOS DE OVERRIDE EM delivery_routes
-- ──────────────────────────────────────────────────────────────────
ALTER TABLE public.delivery_routes
  ADD COLUMN IF NOT EXISTS use_driver_default_compensation BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS compensation_model_override     TEXT,
  ADD COLUMN IF NOT EXISTS amount_per_delivery_override    NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS amount_per_route_override       NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS daily_amount_override           NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS pay_failed_attempt_override     BOOLEAN,
  ADD COLUMN IF NOT EXISTS amount_per_failed_override      NUMERIC(10,2);
