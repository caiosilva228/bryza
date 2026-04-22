-- Migração: Adicionar codigo_cliente auto_increment na tabela clientes

ALTER TABLE clientes
ADD COLUMN codigo_cliente SERIAL;

-- Isso adicionará a coluna de forma sequencial iniciando do 1. 
-- Clientes existentes receberão um número sequencial conforme a ordem no banco.
