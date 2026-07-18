-- Add cpf column to clientes table
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cpf TEXT;
