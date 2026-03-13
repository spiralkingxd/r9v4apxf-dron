create schema if not exists public;

grant usage on schema public to anon, authenticated, service_role;
grant create on schema public to service_role;

create extension if not exists "pgcrypto";

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'event_status'
  ) then
    create type public.event_status as enum ('draft', 'active', 'finished');
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'registration_status'
  ) then
    create type public.registration_status as enum ('pending', 'approved', 'rejected', 'cancelled');
  end if;
end
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  discord_id text unique,
  display_name text,
  username text,
  email text,
  xbox_gamertag text,
  avatar_url text,
  role text not null default 'user',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles add column if not exists discord_id text;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists xbox_gamertag text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists role text;
alter table public.profiles add column if not exists created_at timestamptz;
alter table public.profiles add column if not exists updated_at timestamptz;
alter table public.profiles drop column if exists bio;

update public.profiles p
set discord_id = coalesce(u.raw_user_meta_data ->> 'provider_id', u.raw_user_meta_data ->> 'sub', p.id::text)
from auth.users u
where u.id = p.id
  and p.discord_id is null;

update public.profiles
set discord_id = id::text
where discord_id is null;

alter table public.profiles alter column role set default 'user';
update public.profiles set role = 'user' where role is null;

do $$
begin
  begin
    alter table public.profiles alter column role type text using role::text;
  exception
    when others then null;
  end;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_role_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_role_check check (role in ('user', 'admin'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_discord_id_key'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_discord_id_key unique (discord_id);
  end if;
end
$$;

alter table public.profiles alter column discord_id set not null;
alter table public.profiles alter column created_at set default timezone('utc', now());
alter table public.profiles alter column updated_at set default timezone('utc', now());
update public.profiles set created_at = timezone('utc', now()) where created_at is null;
update public.profiles set updated_at = timezone('utc', now()) where updated_at is null;
alter table public.profiles alter column created_at set not null;
alter table public.profiles alter column updated_at set not null;

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
    xbox_gamertag,
    avatar_url,
    role,
    updated_at
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'provider_id', new.raw_user_meta_data ->> 'sub', new.id::text),
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    coalesce(
      new.raw_user_meta_data ->> 'user_name',
      new.raw_user_meta_data ->> 'preferred_username',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    new.email,
    null,
    new.raw_user_meta_data ->> 'avatar_url',
    'user',
    timezone('utc', now())
  )
  on conflict (id) do update
  set
    discord_id = excluded.discord_id,
    display_name = excluded.display_name,
    username = excluded.username,
    email = excluded.email,
    avatar_url = excluded.avatar_url,
    updated_at = timezone('utc', now());

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

insert into public.profiles (id, discord_id, display_name, username, email, role, updated_at)
select
  id,
  coalesce(raw_user_meta_data ->> 'provider_id', raw_user_meta_data ->> 'sub', id::text),
  coalesce(raw_user_meta_data ->> 'full_name', split_part(email, '@', 1)),
  coalesce(raw_user_meta_data ->> 'user_name', split_part(email, '@', 1)),
  email,
  'user',
  timezone('utc', now())
from auth.users
on conflict (id) do update
set
  discord_id = coalesce(public.profiles.discord_id, excluded.discord_id),
  display_name = coalesce(public.profiles.display_name, excluded.display_name),
  username = coalesce(public.profiles.username, excluded.username),
  email = coalesce(public.profiles.email, excluded.email),
  updated_at = timezone('utc', now());

-- Tabela principal de equipes. Armazena metadados e o capitão atual.
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  logo_url text,
  captain_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  max_members integer not null default 10,
  constraint teams_max_members_check check (max_members > 0 and max_members <= 10)
);

comment on table public.teams is 'Tabela principal das equipes do MadnessArena.';

alter table public.teams add column if not exists logo_url text;
alter table public.teams add column if not exists captain_id uuid;
alter table public.teams add column if not exists created_at timestamptz;
alter table public.teams add column if not exists updated_at timestamptz;
alter table public.teams add column if not exists max_members integer;
alter table public.teams drop column if exists members;
comment on column public.teams.logo_url is 'URL opcional do logo da equipe.';
comment on column public.teams.captain_id is 'Usuário que lidera a equipe.';
comment on column public.teams.max_members is 'Limite máximo de membros por equipe (até 10).';
alter table public.teams alter column updated_at set default timezone('utc', now());
alter table public.teams alter column max_members set default 10;
update public.teams set updated_at = coalesce(updated_at, created_at, timezone('utc', now()));
update public.teams set max_members = 10 where max_members is null or max_members > 10 or max_members < 1;
alter table public.teams alter column updated_at set not null;
alter table public.teams alter column max_members set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'teams_max_members_check'
      and conrelid = 'public.teams'::regclass
  ) then
    alter table public.teams
      add constraint teams_max_members_check check (max_members > 0 and max_members <= 10);
  end if;
end
$$;

-- Relação entre equipes e usuários, com papel dentro da equipe.
create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default timezone('utc', now()),
  constraint team_members_role_check check (role in ('captain', 'member')),
  constraint team_members_team_user_key unique (team_id, user_id)
);

-- Solicitações para entrar em equipes.
create table if not exists public.team_join_requests (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  responded_at timestamptz,
  responded_by uuid references public.profiles (id) on delete set null,
  constraint team_join_requests_status_check check (status in ('pending', 'approved', 'rejected'))
);

alter table public.team_members add column if not exists id uuid;
alter table public.team_members add column if not exists team_id uuid;
alter table public.team_members add column if not exists user_id uuid;
alter table public.team_members add column if not exists role text;
alter table public.team_members add column if not exists joined_at timestamptz;

comment on table public.team_members is 'Membros de cada equipe e seus cargos (capitão ou membro).';
comment on column public.team_members.role is 'Cargo do usuário dentro da equipe.';

alter table public.team_join_requests add column if not exists id uuid;
alter table public.team_join_requests add column if not exists team_id uuid;
alter table public.team_join_requests add column if not exists user_id uuid;
alter table public.team_join_requests add column if not exists status text;
alter table public.team_join_requests add column if not exists created_at timestamptz;
alter table public.team_join_requests add column if not exists updated_at timestamptz;
alter table public.team_join_requests add column if not exists responded_at timestamptz;
alter table public.team_join_requests add column if not exists responded_by uuid;

comment on table public.team_join_requests is 'Solicitações de entrada em equipes, gerenciadas por capitães.';
comment on column public.team_join_requests.status is 'Status da solicitação: pending, approved, rejected.';
comment on column public.team_join_requests.responded_by is 'Usuário que respondeu a solicitação (geralmente o capitão).';

alter table public.team_join_requests
  alter column status set default 'pending';

update public.team_join_requests
set status = 'pending'
where status is null;

update public.team_join_requests
set created_at = timezone('utc', now())
where created_at is null;

update public.team_join_requests
set updated_at = timezone('utc', now())
where updated_at is null;

alter table public.team_join_requests
  alter column status set not null;

alter table public.team_join_requests
  alter column created_at set not null;

alter table public.team_join_requests
  alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'team_join_requests_status_check'
      and conrelid = 'public.team_join_requests'::regclass
  ) then
    alter table public.team_join_requests
      add constraint team_join_requests_status_check
      check (status in ('pending', 'approved', 'rejected'));
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'team_members'
      and column_name = 'profile_id'
  ) then
    execute 'update public.team_members set user_id = profile_id where user_id is null';
  end if;
end
$$;

update public.team_members set id = gen_random_uuid() where id is null;
update public.team_members tm
set role = case when exists (
  select 1 from public.teams t where t.id = tm.team_id and t.captain_id = tm.user_id
) then 'captain' else 'member' end
where role is null or role not in ('captain', 'member');

alter table public.team_members alter column id set default gen_random_uuid();
alter table public.team_members alter column role set default 'member';
alter table public.team_members alter column joined_at set default timezone('utc', now());
update public.team_members set joined_at = timezone('utc', now()) where joined_at is null;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'team_members_pkey'
      and conrelid = 'public.team_members'::regclass
  ) then
    alter table public.team_members drop constraint team_members_pkey;
  end if;
exception
  when others then null;
end
$$;

alter table public.team_members alter column id set not null;
alter table public.team_members alter column user_id set not null;
alter table public.team_members alter column role set not null;
alter table public.team_members alter column joined_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'team_members_pkey'
      and conrelid = 'public.team_members'::regclass
  ) then
    alter table public.team_members add constraint team_members_pkey primary key (id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'team_members_role_check'
      and conrelid = 'public.team_members'::regclass
  ) then
    alter table public.team_members
      add constraint team_members_role_check check (role in ('captain', 'member'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'team_members_team_user_key'
      and conrelid = 'public.team_members'::regclass
  ) then
    alter table public.team_members
      add constraint team_members_team_user_key unique (team_id, user_id);
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'team_members'
      and column_name = 'profile_id'
  ) then
    execute 'alter table public.team_members drop column profile_id';
  end if;
end
$$;

create index if not exists teams_captain_id_idx on public.teams (captain_id);
create index if not exists team_members_user_id_idx on public.team_members (user_id);
create index if not exists team_members_team_id_idx on public.team_members (team_id);
create index if not exists team_join_requests_team_id_idx on public.team_join_requests (team_id);
create index if not exists team_join_requests_user_id_idx on public.team_join_requests (user_id);
create index if not exists team_join_requests_status_idx on public.team_join_requests (status);
create unique index if not exists team_members_one_captain_idx
  on public.team_members (team_id)
  where role = 'captain';

create unique index if not exists team_join_requests_unique_pending_idx
  on public.team_join_requests (team_id, user_id)
  where status = 'pending';

create or replace function public.touch_team_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.touch_join_request_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());

  if old.status = 'pending' and new.status in ('approved', 'rejected') then
    new.responded_at = coalesce(new.responded_at, timezone('utc', now()));
    new.responded_by = coalesce(new.responded_by, auth.uid());
  end if;

  if new.status = 'pending' then
    new.responded_at = null;
    new.responded_by = null;
  end if;

  return new;
end;
$$;

create or replace function public.prevent_duplicate_pending_join_request()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.team_join_requests r
    where r.team_id = new.team_id
      and r.user_id = new.user_id
      and r.status = 'pending'
  ) then
    raise exception 'Já existe uma solicitação pendente para esta equipe.';
  end if;

  return new;
end;
$$;

create or replace function public.check_user_team_limit(p_user_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select count(distinct tm.team_id) < 3
  from public.team_members tm
  where tm.user_id = p_user_id;
$$;

create or replace function public.check_team_member_limit(p_team_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select count(tm.id) < coalesce(t.max_members, 10)
  from public.teams t
  left join public.team_members tm on tm.team_id = t.id
  where t.id = p_team_id
  group by t.id, t.max_members;
$$;

create or replace function public.get_user_teams(p_user_id uuid)
returns setof public.teams
language sql
stable
set search_path = public
as $$
  select t.*
  from public.teams t
  join public.team_members tm on tm.team_id = t.id
  where tm.user_id = p_user_id
  order by t.created_at desc;
$$;

create or replace function public.enforce_team_member_rules()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  current_members integer;
  allowed_members integer;
begin
  if new.role not in ('captain', 'member') then
    raise exception 'team_members.role inválido: %', new.role;
  end if;

  if tg_op = 'INSERT' or new.user_id <> old.user_id then
    if not public.check_user_team_limit(new.user_id) then
      raise exception 'Usuário já participa de 3 equipes.';
    end if;
  end if;

  if tg_op = 'INSERT' or new.team_id <> old.team_id then
    select max_members into allowed_members
    from public.teams
    where id = new.team_id;

    select count(*) into current_members
    from public.team_members tm
    where tm.team_id = new.team_id;

    if current_members >= coalesce(allowed_members, 10) then
      raise exception 'Equipe atingiu o limite máximo de membros.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.check_team_limit()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  team_count integer;
begin
  if new.role <> 'captain' then
    return new;
  end if;

  select count(*) into team_count
  from public.team_members
  where user_id = new.user_id
    and role = 'captain';

  if team_count >= 3 then
    raise exception 'Usuário já possui 3 equipes. Limite máximo atingido.';
  end if;

  return new;
end;
$$;

create or replace function public.check_member_limit()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  member_count integer;
begin
  select count(*) into member_count
  from public.team_members
  where team_id = new.team_id;

  if member_count >= 10 then
    raise exception 'Equipe atingiu o limite de 10 membros.';
  end if;

  return new;
end;
$$;

create or replace function public.sync_team_captain_membership()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.team_members
  set role = 'member'
  where team_id = new.id
    and role = 'captain'
    and user_id <> new.captain_id;

  insert into public.team_members (team_id, user_id, role)
  values (new.id, new.captain_id, 'captain')
  on conflict (team_id, user_id)
  do update set role = 'captain';

  return new;
end;
$$;

drop trigger if exists teams_set_updated_at on public.teams;
create trigger teams_set_updated_at
before update on public.teams
for each row
execute function public.touch_team_updated_at();

drop trigger if exists team_members_enforce_limits on public.team_members;
create trigger team_members_enforce_limits
before insert or update on public.team_members
for each row
execute function public.enforce_team_member_rules();

drop trigger if exists team_join_requests_touch_updated_at on public.team_join_requests;
create trigger team_join_requests_touch_updated_at
before update on public.team_join_requests
for each row
execute function public.touch_join_request_updated_at();

drop trigger if exists team_join_requests_prevent_duplicate_pending on public.team_join_requests;
create trigger team_join_requests_prevent_duplicate_pending
before insert on public.team_join_requests
for each row
execute function public.prevent_duplicate_pending_join_request();

drop trigger if exists enforce_team_limit on public.team_members;
create trigger enforce_team_limit
before insert on public.team_members
for each row
when (new.role = 'captain')
execute function public.check_team_limit();

drop trigger if exists enforce_member_limit on public.team_members;
create trigger enforce_member_limit
before insert on public.team_members
for each row
execute function public.check_member_limit();

drop trigger if exists sync_team_captain_membership on public.teams;
create trigger sync_team_captain_membership
after insert or update of captain_id on public.teams
for each row
execute function public.sync_team_captain_membership();

-- Backfill: garante que todo capitão atual tenha vínculo como capitão em team_members.
insert into public.team_members (id, team_id, user_id, role, joined_at)
select gen_random_uuid(), t.id, t.captain_id, 'captain', t.created_at
from public.teams t
where not exists (
  select 1
  from public.team_members tm
  where tm.team_id = t.id
    and tm.user_id = t.captain_id
);

update public.team_members tm
set role = 'captain'
from public.teams t
where t.id = tm.team_id
  and t.captain_id = tm.user_id;

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
create index if not exists events_status_idx on public.events (status);
create index if not exists registrations_event_id_idx on public.registrations (event_id);
create index if not exists registrations_team_id_idx on public.registrations (team_id);
create index if not exists matches_event_id_idx on public.matches (event_id);
create index if not exists rankings_points_idx on public.rankings (points desc);

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.team_join_requests enable row level security;
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
with check (captain_id = auth.uid());

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

drop policy if exists "Users can read own participations" on public.team_members;
create policy "Users can read own participations"
on public.team_members
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Captains and admins insert team members" on public.team_members;
create policy "Captains and admins insert team members"
on public.team_members
for insert
to authenticated
with check (
  exists (
    select 1
    from public.teams
    where teams.id = team_members.team_id
      and (teams.captain_id = auth.uid() or public.is_admin())
  )
);

drop policy if exists "Captains and admins update team members" on public.team_members;
create policy "Captains and admins update team members"
on public.team_members
for update
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

drop policy if exists "Captains and admins delete team members" on public.team_members;
create policy "Captains and admins delete team members"
on public.team_members
for delete
to authenticated
using (
  exists (
    select 1
    from public.teams
    where teams.id = team_members.team_id
      and (teams.captain_id = auth.uid() or public.is_admin())
  )
);

-- Team join requests: usuários veem as próprias solicitações.
drop policy if exists "Users read own join requests" on public.team_join_requests;
create policy "Users read own join requests"
on public.team_join_requests
for select
to authenticated
using (user_id = auth.uid());

-- Team join requests: capitães veem solicitações da equipe que lideram.
drop policy if exists "Captains read team join requests" on public.team_join_requests;
create policy "Captains read team join requests"
on public.team_join_requests
for select
to authenticated
using (
  exists (
    select 1
    from public.teams t
    where t.id = team_join_requests.team_id
      and t.captain_id = auth.uid()
  )
);

-- Team join requests: usuário logado cria solicitação para si, se não for membro da equipe.
drop policy if exists "Users create own join requests" on public.team_join_requests;
create policy "Users create own join requests"
on public.team_join_requests
for insert
to authenticated
with check (
  user_id = auth.uid()
  and not exists (
    select 1
    from public.team_members tm
    where tm.team_id = team_join_requests.team_id
      and tm.user_id = auth.uid()
  )
);

-- Team join requests: capitão aprova/rejeita solicitações da própria equipe.
drop policy if exists "Captains update join requests" on public.team_join_requests;
create policy "Captains update join requests"
on public.team_join_requests
for update
to authenticated
using (
  exists (
    select 1
    from public.teams t
    where t.id = team_join_requests.team_id
      and t.captain_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.teams t
    where t.id = team_join_requests.team_id
      and t.captain_id = auth.uid()
  )
  and status in ('approved', 'rejected')
);

-- Team join requests: usuário pode cancelar (rejeitar) solicitação pendente própria.
drop policy if exists "Users cancel own pending join requests" on public.team_join_requests;
create policy "Users cancel own pending join requests"
on public.team_join_requests
for update
to authenticated
using (
  user_id = auth.uid()
  and status = 'pending'
)
with check (
  user_id = auth.uid()
  and status = 'rejected'
);

-- Team join requests: usuário deleta solicitação pendente própria.
drop policy if exists "Users delete own pending join requests" on public.team_join_requests;
create policy "Users delete own pending join requests"
on public.team_join_requests
for delete
to authenticated
using (
  user_id = auth.uid()
  and status = 'pending'
);

-- Team join requests: capitão pode deletar solicitações da própria equipe.
drop policy if exists "Captains delete team join requests" on public.team_join_requests;
create policy "Captains delete team join requests"
on public.team_join_requests
for delete
to authenticated
using (
  exists (
    select 1
    from public.teams t
    where t.id = team_join_requests.team_id
      and t.captain_id = auth.uid()
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