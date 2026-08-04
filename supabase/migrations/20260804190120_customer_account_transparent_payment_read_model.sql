-- Índice de leitura para a repetição de pagamentos online na conta do cliente.
-- A autorização continua sendo feita pelo RPC server-only e pelo endpoint;
-- este índice apenas evita varreduras ao consultar intenções transparentes.
CREATE INDEX IF NOT EXISTS payment_intents_transparent_status_idx
  ON public.payment_intents (status, updated_at DESC)
  WHERE checkout_mode = 'transparent';

COMMENT ON COLUMN public.payment_intents.checkout_mode IS
  'Modo usado pela tentativa: checkout_pro legado ou Payment Brick transparente.';

COMMENT ON COLUMN public.payment_intents.card_save_status IS
  'Estado server-side da tentativa de salvar o cartão no customer do Mercado Pago.';
