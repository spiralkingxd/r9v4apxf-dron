-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles Table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  email TEXT UNIQUE,
  role TEXT DEFAULT 'user',
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Admin Roles Table
CREATE TABLE IF NOT EXISTS admin_roles (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Teams Table
CREATE TABLE IF NOT EXISTS teams (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  ship_name TEXT,
  captain_id UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Events Table
CREATE TABLE IF NOT EXISTS events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  start_date TIMESTAMP WITH TIME ZONE,
  max_teams INTEGER DEFAULT 16,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Matches Table
CREATE TABLE IF NOT EXISTS matches (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  team_a_id UUID REFERENCES teams(id),
  team_b_id UUID REFERENCES teams(id),
  score_a INTEGER DEFAULT 0,
  score_b INTEGER DEFAULT 0,
  status TEXT DEFAULT 'scheduled',
  start_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Reports Table
CREATE TABLE IF NOT EXISTS reports (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  reporter_id UUID REFERENCES profiles(id),
  reported_user_id UUID REFERENCES profiles(id),
  reported_team_id UUID REFERENCES teams(id),
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Admin Logs Table
CREATE TABLE IF NOT EXISTS admin_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  admin_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- System Settings Table
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Profiles: Users can read their own profile, update their own profile
CREATE POLICY "Usuários podem ler seu próprio perfil" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Usuários podem atualizar seu próprio perfil" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Teams: Everyone can read, only captain can update
CREATE POLICY "Qualquer um pode ler equipes" ON teams FOR SELECT USING (true);
CREATE POLICY "Capitão pode atualizar sua equipe" ON teams FOR UPDATE USING (auth.uid() = captain_id);
CREATE POLICY "Usuários podem criar equipes" ON teams FOR INSERT WITH CHECK (auth.uid() = captain_id);

-- Events: Everyone can read
CREATE POLICY "Qualquer um pode ler eventos" ON events FOR SELECT USING (true);

-- Matches: Everyone can read
CREATE POLICY "Qualquer um pode ler partidas" ON matches FOR SELECT USING (true);

-- Reports: Users can insert their own reports
CREATE POLICY "Usuários podem criar denúncias" ON reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Usuários podem ler suas denúncias" ON reports FOR SELECT USING (auth.uid() = reporter_id);

-- Admin Logs: Only admin can read
CREATE POLICY "Admins podem ler logs" ON admin_logs FOR SELECT USING (EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid()));

-- System Settings: Everyone can read
CREATE POLICY "Qualquer um pode ler configurações" ON system_settings FOR SELECT USING (true);
