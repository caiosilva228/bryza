-- O agendamento armazena um snapshot da origem oficial da atribuição. Clientes
-- já existentes podem ter sido vinculados por fluxos mais novos do que o enum
-- histórico de agendamentos; todos os valores aceitos pelo resolvedor público
-- precisam ser convertíveis sem cancelar a compra.

ALTER TYPE public.attribution_source_type
  ADD VALUE IF NOT EXISTS 'verified_migration';

ALTER TYPE public.attribution_source_type
  ADD VALUE IF NOT EXISTS 'admin_selection';

ALTER TYPE public.attribution_source_type
  ADD VALUE IF NOT EXISTS 'manual_order_selection';

ALTER TYPE public.attribution_source_type
  ADD VALUE IF NOT EXISTS 'manual_code';

ALTER TYPE public.attribution_source_type
  ADD VALUE IF NOT EXISTS 'administrative_review';
