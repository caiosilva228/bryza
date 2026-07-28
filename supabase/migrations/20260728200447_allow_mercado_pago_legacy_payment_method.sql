-- Checkout Pro can settle with more than one Mercado Pago instrument. Keep the
-- provider visible in the legacy field while payment_source/status remain the
-- canonical financial fields.
ALTER TABLE public.pedidos
  DROP CONSTRAINT IF EXISTS pedidos_forma_pagamento_check;

ALTER TABLE public.pedidos
  ADD CONSTRAINT pedidos_forma_pagamento_check
  CHECK (forma_pagamento IN ('dinheiro', 'pix', 'cartao', 'mercado_pago'));
