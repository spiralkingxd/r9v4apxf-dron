create extension if not exists "pgcrypto";

create type public.app_role as enum ('user', 'admin');
create type public.event_status as enum ('draft', 'active', 'finished');
create type public.registration_status as enum ('pending', 'approved', 'rejected', 'cancelled');

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    discord_id,
    display_name,
    username,
    email,
    avatar_url
  )
  values (
    new.id,
    new.raw_user_meta_data ->> 'provider_id',
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'user_name', new.raw_user_meta_data ->> 'preferred_username', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
  set
    discord_id = excluded.discord_id,
    display_name = excluded.display_name,
    username = excluded.username,
    email = excluded.email,
    avatar_url = excluded.avatar_url;

  return new;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  discord_id text unique,
  display_name text not null,
  username text not null,
  email text,
  bio text,
  xbox_gamertag text,
  avatar_url text,
  role public.app_role not null default 'user',
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles add column if not exists bio text;

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  captain_id uuid not null references public.profiles (id) on delete restrict,
  members jsonb not null default '[]'::jsonb,
  logo_url text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.team_members (
  team_id uuid not null references public.teams (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default timezone('utc', now()),
  primary key (team_id, profile_id)
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  start_date timestamptz not null,
  end_date timestamptz,
  status public.event_status not null default 'draft',
  prize_pool numeric(12, 2) not null default 0,
  rules text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  status public.registration_status not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  unique (event_id, team_id)
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  team_a_id uuid not null references public.teams (id) on delete restrict,
  team_b_id uuid not null references public.teams (id) on delete restrict,
  winner_id uuid references public.teams (id) on delete set null,
  score_a integer not null default 0,
  score_b integer not null default 0,
  round integer not null,
  bracket_position text,
  created_at timestamptz not null default timezone('utc', now()),
  check (team_a_id <> team_b_id),
  check (score_a >= 0),
  check (score_b >= 0)
);

create table if not exists public.rankings (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  points integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  rank_position integer,
  created_at timestamptz not null default timezone('utc', now()),
  check (points >= 0),
  check (wins >= 0),
  check (losses >= 0)
);

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists teams_captain_id_idx on public.teams (captain_id);
create index if not exists events_status_idx on public.events (status);
create index if not exists registrations_event_id_idx on public.registrations (event_id);
create index if not exists registrations_team_id_idx on public.registrations (team_id);
create index if not exists matches_event_id_idx on public.matches (event_id);
create index if not exists rankings_points_idx on public.rankings (points desc);

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.events enable row level security;
alter table public.registrations enable row level security;
alter table public.matches enable row level security;
alter table public.rankings enable row level security;

drop policy if exists "Public can read active data from events" on public.events;
create policy "Public can read active data from events"
on public.events
for select
to anon, authenticated
using (true);

drop policy if exists "Admins manage events" on public.events;
create policy "Admins manage events"
on public.events
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read teams" on public.teams;
create policy "Public can read teams"
on public.teams
for select
to anon, authenticated
using (true);

drop policy if exists "Authenticated users can create teams" on public.teams;
create policy "Authenticated users can create teams"
on public.teams
for insert
to authenticated
with check (captain_id = auth.uid() or public.is_admin());

drop policy if exists "Captains and admins update teams" on public.teams;
create policy "Captains and admins update teams"
on public.teams
for update
to authenticated
using (captain_id = auth.uid() or public.is_admin())
with check (captain_id = auth.uid() or public.is_admin());

drop policy if exists "Captains and admins delete teams" on public.teams;
create policy "Captains and admins delete teams"
on public.teams
for delete
to authenticated
using (captain_id = auth.uid() or public.is_admin());

drop policy if exists "Public can read team members" on public.team_members;
create policy "Public can read team members"
on public.team_members
for select
to anon, authenticated
using (true);

drop policy if exists "Captains and admins manage team members" on public.team_members;
create policy "Captains and admins manage team members"
on public.team_members
for all
to authenticated
using (
  exists (
    select 1
    from public.teams
    where teams.id = team_members.team_id
      and (teams.captain_id = auth.uid() or public.is_admin())
  )
)
with check (
  exists (
    select 1
    from public.teams
    where teams.id = team_members.team_id
      and (teams.captain_id = auth.uid() or public.is_admin())
  )
);

drop policy if exists "Public can read rankings" on public.rankings;
create policy "Public can read rankings"
on public.rankings
for select
to anon, authenticated
using (true);

drop policy if exists "Admins manage rankings" on public.rankings;
create policy "Admins manage rankings"
on public.rankings
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Public can read profiles" on public.profiles;
create policy "Public can read profiles"
on public.profiles
for select
to anon, authenticated
using (true);

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile"
on public.profiles
for update
to authenticated
using (id = auth.uid() or public.is_admin())
with check (
  (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()))
  or public.is_admin()
);

drop policy if exists "Users insert own profile" on public.profiles;
create policy "Users insert own profile"
on public.profiles
for insert
to authenticated
with check (id = auth.uid() or public.is_admin());

drop policy if exists "Event admins manage registrations" on public.registrations;
create policy "Event admins manage registrations"
on public.registrations
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Authenticated users create registrations" on public.registrations;
create policy "Authenticated users create registrations"
on public.registrations
for insert
to authenticated
with check (
  exists (
    select 1
    from public.teams
    where teams.id = registrations.team_id
      and (teams.captain_id = auth.uid() or public.is_admin())
  )
);

drop policy if exists "Authenticated users read registrations for owned teams" on public.registrations;
create policy "Authenticated users read registrations for owned teams"
on public.registrations
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.teams
    where teams.id = registrations.team_id
      and teams.captain_id = auth.uid()
  )
);

drop policy if exists "Public can read matches" on public.matches;
create policy "Public can read matches"
on public.matches
for select
to anon, authenticated
using (true);

drop policy if exists "Admins manage matches" on public.matches;
create policy "Admins manage matches"
on public.matches
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_user();

insert into public.profiles (id, display_name, username, email, role)
select id,
       coalesce(raw_user_meta_data ->> 'full_name', split_part(email, '@', 1)),
       coalesce(raw_user_meta_data ->> 'user_name', split_part(email, '@', 1)),
       email,
       'user'
from auth.users
on conflict (id) do nothing;