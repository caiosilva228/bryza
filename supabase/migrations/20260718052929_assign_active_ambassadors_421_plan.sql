-- Aplica o plano atual 4/2/1 somente a vendas futuras dos embaixadores ativos.
-- Comissoes e pedidos existentes mantem seus snapshots historicos.
BEGIN;

UPDATE public.ambassadors
SET commission_plan_id = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    updated_at = NOW()
WHERE status = 'ativo'
  AND commission_plan_id IS DISTINCT FROM 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

COMMIT;
