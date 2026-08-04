-- Keep one active Mercado Pago intent per operational order. Expired,
-- cancelled, rejected and approved intents remain as immutable history while a
-- new payment attempt can be prepared when necessary.
CREATE UNIQUE INDEX IF NOT EXISTS payment_intents_open_order_uidx
  ON public.payment_intents (pedido_id)
  WHERE pedido_id IS NOT NULL
    AND status IN ('pendente', 'processando', 'em_analise');
