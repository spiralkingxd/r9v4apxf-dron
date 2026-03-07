-- Atualização do ID do Administrador
-- NOTA: O ID do admin deve ser configurado manualmente no banco de dados.
-- Exemplo: UPDATE profiles SET role = 'admin' WHERE discord_id = 'SEU_DISCORD_ID';

-- 1. Atualizar role do novo admin na tabela profiles (se já existir)
-- UPDATE profiles SET role = 'admin' WHERE discord_id = 'SEU_ID_AQUI';

-- 2. Recriar Policies com base na ROLE 'admin'

-- Tabela: profiles
DROP POLICY IF EXISTS "Admin can update all profiles." ON profiles;
CREATE POLICY "Admin can update all profiles."
  ON profiles FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Tabela: teams
DROP POLICY IF EXISTS "Admin can do everything on teams." ON teams;
CREATE POLICY "Admin can do everything on teams."
  ON teams FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Tabela: events
DROP POLICY IF EXISTS "Only admin can modify events." ON events;
CREATE POLICY "Only admin can modify events."
  ON events FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Tabela: matches
DROP POLICY IF EXISTS "Only admin can modify matches." ON matches;
CREATE POLICY "Only admin can modify matches."
  ON matches FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Tabela: registrations
DROP POLICY IF EXISTS "Only admin can update registration status." ON registrations;
CREATE POLICY "Only admin can update registration status."
  ON registrations FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Tabela: audit_logs
DROP POLICY IF EXISTS "Only admin can view audit logs." ON audit_logs;
CREATE POLICY "Only admin can view audit logs."
  ON audit_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
