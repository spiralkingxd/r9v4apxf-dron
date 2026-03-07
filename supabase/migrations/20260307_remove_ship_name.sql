-- Remover coluna ship_name da tabela teams
ALTER TABLE teams DROP COLUMN IF EXISTS ship_name;
