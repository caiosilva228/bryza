-- Adiciona campos de endereço e localização aos embaixadores
ALTER TABLE ambassadors 
  ADD COLUMN IF NOT EXISTS cep TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS number TEXT,
  ADD COLUMN IF NOT EXISTS neighborhood TEXT,
  ADD COLUMN IF NOT EXISTS latitude NUMERIC,
  ADD COLUMN IF NOT EXISTS longitude NUMERIC;
