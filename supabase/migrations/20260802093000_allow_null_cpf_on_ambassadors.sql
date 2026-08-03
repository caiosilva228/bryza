BEGIN;

-- Permite que clientes cadastrados sem CPF possam ser promovidos a embaixadores
ALTER TABLE public.ambassadors ALTER COLUMN cpf DROP NOT NULL;
ALTER TABLE public.ambassadors DROP CONSTRAINT IF EXISTS chk_ambassador_cpf;
ALTER TABLE public.ambassadors ADD CONSTRAINT chk_ambassador_cpf CHECK (cpf IS NULL OR cpf ~ '^\d{11}$');

COMMIT;
