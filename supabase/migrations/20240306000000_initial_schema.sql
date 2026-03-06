-- Habilitar a extensão pgcrypto para UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. PROFILES TABLE
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  discord_id TEXT UNIQUE,
  username TEXT NOT NULL,
  avatar_url TEXT,
  email TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone."
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own profile."
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile."
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admin can update all profiles."
  ON profiles FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND discord_id = '717425697005502534'));

-- 2. TEAMS TABLE
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  ship_name TEXT,
  captain_id UUID REFERENCES profiles(id) NOT NULL,
  members JSONB DEFAULT '[]'::jsonb,
  stats JSONB DEFAULT '{"wins": 0, "losses": 0}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teams are viewable by everyone."
  ON teams FOR SELECT
  USING (true);

CREATE POLICY "Users can create teams."
  ON teams FOR INSERT
  WITH CHECK (auth.uid() = captain_id);

CREATE POLICY "Captain can update their team."
  ON teams FOR UPDATE
  USING (auth.uid() = captain_id);

CREATE POLICY "Admin can do everything on teams."
  ON teams FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND discord_id = '717425697005502534'));

-- 3. EVENTS TABLE
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'ongoing', 'completed')),
  rules TEXT,
  prize_pool TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Events are viewable by everyone."
  ON events FOR SELECT
  USING (true);

CREATE POLICY "Only admin can modify events."
  ON events FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND discord_id = '717425697005502534'));

-- 4. MATCHES TABLE
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  team_a_id UUID REFERENCES teams(id),
  team_b_id UUID REFERENCES teams(id),
  winner_id UUID REFERENCES teams(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'ongoing', 'completed')),
  bracket_position TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Matches are viewable by everyone."
  ON matches FOR SELECT
  USING (true);

CREATE POLICY "Only admin can modify matches."
  ON matches FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND discord_id = '717425697005502534'));

-- 5. REGISTRATIONS TABLE
CREATE TABLE registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, team_id)
);

ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Registrations are viewable by everyone."
  ON registrations FOR SELECT
  USING (true);

CREATE POLICY "Captains can register their teams."
  ON registrations FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM teams WHERE id = team_id AND captain_id = auth.uid()));

CREATE POLICY "Only admin can update registration status."
  ON registrations FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND discord_id = '717425697005502534'));

-- 6. AUDIT LOGS TABLE
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  table_affected TEXT NOT NULL,
  record_id UUID,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admin can view audit logs."
  ON audit_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND discord_id = '717425697005502534'));

-- TRIGGERS FOR AUDIT LOGS
CREATE OR REPLACE FUNCTION log_audit_event() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (user_id, action, table_affected, record_id)
  VALUES (auth.uid(), TG_OP, TG_TABLE_NAME, COALESCE(NEW.id, OLD.id));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_teams_changes
  AFTER INSERT OR UPDATE OR DELETE ON teams
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();

CREATE TRIGGER audit_events_changes
  AFTER INSERT OR UPDATE OR DELETE ON events
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();

-- TRIGGER TO AUTO-CREATE PROFILE ON SIGNUP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, discord_id, username, avatar_url, email)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'provider_id',
    new.raw_user_meta_data->>'custom_claims'->>'global_name',
    new.raw_user_meta_data->>'avatar_url',
    new.email
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
