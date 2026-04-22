-- Tabela de metas da empresa
CREATE TABLE IF NOT EXISTS metas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_meta text NOT NULL DEFAULT 'faturamento',
  valor_meta numeric(12,2) NOT NULL DEFAULT 0,
  periodo text NOT NULL, -- formato: YYYY-MM (mês de vigência)
  usuario_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tipo_meta, periodo)
);

ALTER TABLE metas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read metas" ON metas
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated insert metas" ON metas
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated update metas" ON metas
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE OR REPLACE FUNCTION update_metas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER metas_updated_at
  BEFORE UPDATE ON metas
  FOR EACH ROW EXECUTE FUNCTION update_metas_updated_at();
