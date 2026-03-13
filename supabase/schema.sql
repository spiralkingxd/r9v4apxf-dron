create schema if not exists public;

grant usage on schema public to anon, authenticated, service_role;
grant create on schema public to service_role;

create extension if not exists "pgcrypto";

create or replace function public.extract_discord_id(metadata jsonb)
returns text
language sql
immutable
set search_path = public
as $$
  with candidates as (
    select
      trim(coalesce(metadata ->> 'provider_id', '')) as provider_id,
      trim(coalesce(metadata ->> 'provider_user_id', '')) as provider_user_id,
      trim(split_part(coalesce(metadata ->> 'sub', ''), '|', 2)) as sub_after_pipe,
      trim(coalesce(metadata ->> 'sub', '')) as sub_raw
  )
  select coalesce(
    (select provider_id from candidates where provider_id ~ '^[0-9]{15,22}$'),
    (select provider_user_id from candidates where provider_user_id ~ '^[0-9]{15,22}$'),
    (select sub_after_pipe from candidates where sub_after_pipe ~ '^[0-9]{15,22}$'),
    (select sub_raw from candidates where sub_raw ~ '^[0-9]{15,22}$')
  );
$$;

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

alter type public.event_status add value if not exists 'published';
alter type public.event_status add value if not exists 'paused';

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  discord_id text unique,
  display_name text,
  username text,
  email text,
  xbox_gamertag text,
  avatar_url text,
  role text not null default 'user',
  is_banned boolean not null default false,
  ban_reason text,
  banned_reason text,
  banned_at timestamptz,
  banned_by uuid references public.profiles (id) on delete set null,
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
alter table public.profiles add column if not exists is_banned boolean;
alter table public.profiles add column if not exists ban_reason text;
alter table public.profiles add column if not exists banned_reason text;
alter table public.profiles add column if not exists banned_at timestamptz;
alter table public.profiles add column if not exists banned_by uuid;
alter table public.profiles add column if not exists force_logout_after timestamptz;
alter table public.profiles add column if not exists deleted_at timestamptz;
alter table public.profiles add column if not exists deleted_by uuid;
alter table public.profiles add column if not exists created_at timestamptz;
alter table public.profiles add column if not exists updated_at timestamptz;
alter table public.profiles drop column if exists bio;

alter table public.profiles alter column is_banned set default false;
update public.profiles set is_banned = false where is_banned is null;
alter table public.profiles alter column is_banned set not null;

update public.profiles
set ban_reason = coalesce(ban_reason, banned_reason)
where ban_reason is null and banned_reason is not null;

update public.profiles
set banned_reason = coalesce(banned_reason, ban_reason)
where banned_reason is null and ban_reason is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_banned_by_fkey'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_banned_by_fkey
      foreign key (banned_by) references public.profiles (id) on delete set null;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_deleted_by_fkey'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_deleted_by_fkey
      foreign key (deleted_by) references public.profiles (id) on delete set null;
  end if;
end
$$;

update public.profiles p
set discord_id = coalesce(public.extract_discord_id(u.raw_user_meta_data), p.discord_id)
from auth.users u
where u.id = p.id
  and (
    p.discord_id is null
    or p.discord_id !~ '^[0-9]{15,22}$'
  );

update public.profiles
set discord_id = id::text
where discord_id is null;

alter table public.profiles alter column role set default 'user';
update public.profiles set role = 'user' where role is null;

do $$
declare
  role_udt_schema text;
  role_udt_name text;
begin
  select c.udt_schema, c.udt_name
  into role_udt_schema, role_udt_name
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'profiles'
    and c.column_name = 'role';

  if role_udt_name is not null and role_udt_name <> 'text' then
    begin
      execute format('alter type %I.%I add value if not exists ''owner''', role_udt_schema, role_udt_name);
    exception
      when others then null;
    end;
  end if;
end
$$;

update public.profiles
set role = 'admin'
where role::text not in ('user', 'admin', 'owner');

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
  if exists (
    select 1
    from pg_constraint
    where conname = 'profiles_role_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles drop constraint profiles_role_check;
  end if;

  alter table public.profiles
    add constraint profiles_role_check check (role::text in ('user', 'admin', 'owner'));
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

create or replace function public.is_admin(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = p_user_id
      and role::text in ('admin', 'owner')
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin(auth.uid());
$$;

create or replace function public.is_owner(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = p_user_id
      and role::text = 'owner'
  );
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_owner(auth.uid());
$$;

create or replace function public.is_banned(p_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  profile_banned boolean;
  active_ban_exists boolean := false;
begin
  select coalesce(p.is_banned, false)
  into profile_banned
  from public.profiles p
  where p.id = p_user_id;

  if to_regclass('public.bans') is not null then
    execute $q$
      select exists (
        select 1
        from public.bans b
        where b.user_id = $1
          and b.is_active = true
          and (b.expires_at is null or b.expires_at > timezone('utc', now()))
      )
    $q$
    into active_ban_exists
    using p_user_id;
  end if;

  return coalesce(profile_banned, false) or active_ban_exists;
end;
$$;

create or replace function public.can_perform_action(p_user_id uuid, p_action text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.is_owner(p_user_id) then
    return true;
  end if;

  if not public.is_admin(p_user_id) then
    return false;
  end if;

  if lower(coalesce(p_action, '')) in ('owner:settings', 'owner:backup', 'owner:logs') then
    return false;
  end if;

  return true;
end;
$$;

create or replace function public.promote_owner_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_discord_id text;
begin
  owner_discord_id := nullif(current_setting('app.owner_discord_id', true), '');

  if owner_discord_id is not null and new.discord_id = owner_discord_id then
    new.role := 'owner';
  elsif new.role is null or new.role::text not in ('user', 'admin', 'owner') then
    new.role := 'user';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_promote_owner on public.profiles;
create trigger profiles_promote_owner
before insert or update of discord_id, role on public.profiles
for each row
execute function public.promote_owner_profile();

create or replace function public.enforce_profile_role_security()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_discord_id text;
  effective_discord_id text;
begin
  owner_discord_id := nullif(current_setting('app.owner_discord_id', true), '');
  effective_discord_id := coalesce(new.discord_id, old.discord_id);

  if old.role::text = 'owner' and new.role::text <> 'owner' and not public.is_owner() then
    raise exception 'owner role cannot be changed by non-owner users';
  end if;

  if new.role::text = 'owner' and old.role::text <> 'owner' then
    if not public.is_owner()
       and not (
         auth.uid() = new.id
         and owner_discord_id is not null
         and effective_discord_id = owner_discord_id
       ) then
      raise exception 'manual owner promotion is not allowed';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_role_security on public.profiles;
create trigger profiles_role_security
before update of role on public.profiles
for each row
execute function public.enforce_profile_role_security();

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
    coalesce(public.extract_discord_id(new.raw_user_meta_data), new.id::text),
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
  coalesce(public.extract_discord_id(raw_user_meta_data), id::text),
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
alter table public.teams add column if not exists dissolved_at timestamptz;
alter table public.teams add column if not exists dissolved_by uuid;
alter table public.teams add column if not exists dissolve_reason text;
alter table public.teams drop column if exists members;
comment on column public.teams.logo_url is 'URL opcional do logo da equipe.';
comment on column public.teams.captain_id is 'Usuário que lidera a equipe.';
comment on column public.teams.max_members is 'Limite máximo de membros por equipe (até 10).';
comment on column public.teams.dissolved_at is 'Data/hora em que a equipe foi dissolvida (soft delete).';
comment on column public.teams.dissolved_by is 'Admin responsável por dissolver a equipe.';
comment on column public.teams.dissolve_reason is 'Motivo informado para a dissolução da equipe.';
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

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'teams_dissolved_by_fkey'
      and conrelid = 'public.teams'::regclass
  ) then
    alter table public.teams
      add constraint teams_dissolved_by_fkey
      foreign key (dissolved_by) references public.profiles (id) on delete set null;
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
create index if not exists teams_dissolved_at_idx on public.teams (dissolved_at);
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

alter table public.events add column if not exists description text;
alter table public.events add column if not exists end_date timestamptz;
alter table public.events add column if not exists status public.event_status;
alter table public.events add column if not exists prize_pool numeric(12, 2);
alter table public.events add column if not exists rules text;
alter table public.events add column if not exists created_at timestamptz;
alter table public.events add column if not exists updated_at timestamptz;
alter table public.events add column if not exists registration_deadline timestamptz;
alter table public.events add column if not exists event_kind text;
alter table public.events add column if not exists event_type text;
alter table public.events add column if not exists visibility text;
alter table public.events add column if not exists team_size integer;
alter table public.events add column if not exists prize_description text;
alter table public.events add column if not exists logo_url text;
alter table public.events add column if not exists banner_url text;
alter table public.events add column if not exists scoring_win integer;
alter table public.events add column if not exists scoring_loss integer;
alter table public.events add column if not exists scoring_draw integer;
alter table public.events add column if not exists tournament_format text;
alter table public.events add column if not exists rounds_count integer;
alter table public.events add column if not exists seeding_method text;
alter table public.events add column if not exists max_teams integer;
alter table public.events add column if not exists duplicated_from uuid;
alter table public.events add column if not exists published_at timestamptz;
alter table public.events add column if not exists paused_at timestamptz;
alter table public.events add column if not exists finalized_at timestamptz;

alter table public.events alter column status set default 'draft';
update public.events set status = 'draft' where status is null;
alter table public.events alter column status set not null;
alter table public.events alter column prize_pool set default 0;
update public.events set prize_pool = 0 where prize_pool is null;
alter table public.events alter column prize_pool set not null;
alter table public.events alter column created_at set default timezone('utc', now());
update public.events set created_at = timezone('utc', now()) where created_at is null;
alter table public.events alter column created_at set not null;
alter table public.events alter column updated_at set default timezone('utc', now());
update public.events set updated_at = coalesce(updated_at, created_at, timezone('utc', now())) where updated_at is null;
alter table public.events alter column updated_at set not null;
alter table public.events alter column event_kind set default 'event';
update public.events set event_kind = 'event' where event_kind is null;
alter table public.events alter column event_kind set not null;
update public.events
set event_type = case
  when event_kind = 'tournament' then 'tournament'
  else 'special'
end
where event_type is null;
alter table public.events alter column event_type set default 'special';
alter table public.events alter column event_type set not null;
update public.events set visibility = 'public' where visibility is null;
alter table public.events alter column visibility set default 'public';
alter table public.events alter column visibility set not null;
alter table public.events alter column team_size set default 4;
update public.events set team_size = 4 where team_size is null or team_size < 1;
alter table public.events alter column team_size set not null;
alter table public.events alter column scoring_win set default 3;
update public.events set scoring_win = 3 where scoring_win is null;
alter table public.events alter column scoring_win set not null;
alter table public.events alter column scoring_loss set default 0;
update public.events set scoring_loss = 0 where scoring_loss is null;
alter table public.events alter column scoring_loss set not null;
alter table public.events alter column scoring_draw set default 1;
update public.events set scoring_draw = 1 where scoring_draw is null;
alter table public.events alter column scoring_draw set not null;
alter table public.events alter column seeding_method set default 'random';
update public.events set seeding_method = 'random' where seeding_method is null;
alter table public.events alter column seeding_method set not null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'events_event_kind_check'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events drop constraint events_event_kind_check;
  end if;

  alter table public.events
    add constraint events_event_kind_check check (event_kind in ('event', 'tournament'));
end
$$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'events_event_type_check'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events drop constraint events_event_type_check;
  end if;

  alter table public.events
    add constraint events_event_type_check check (event_type in ('tournament', 'special', 'scrimmage'));
end
$$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'events_visibility_check'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events drop constraint events_visibility_check;
  end if;

  alter table public.events
    add constraint events_visibility_check check (visibility in ('public', 'private'));
end
$$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'events_team_size_check'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events drop constraint events_team_size_check;
  end if;

  alter table public.events
    add constraint events_team_size_check check (team_size >= 1 and team_size <= 10);
end
$$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'events_tournament_format_check'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events drop constraint events_tournament_format_check;
  end if;

  alter table public.events
    add constraint events_tournament_format_check check (
      tournament_format is null
      or tournament_format in ('single_elimination', 'double_elimination', 'round_robin')
    );
end
$$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'events_seeding_method_check'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events drop constraint events_seeding_method_check;
  end if;

  alter table public.events
    add constraint events_seeding_method_check check (seeding_method in ('random', 'manual', 'ranking'));
end
$$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'events_rounds_count_check'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events drop constraint events_rounds_count_check;
  end if;

  alter table public.events
    add constraint events_rounds_count_check check (rounds_count is null or rounds_count >= 1);
end
$$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'events_max_teams_check'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events drop constraint events_max_teams_check;
  end if;

  alter table public.events
    add constraint events_max_teams_check check (max_teams is null or max_teams >= 2);
end
$$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'events_date_order_check'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events drop constraint events_date_order_check;
  end if;

  alter table public.events
    add constraint events_date_order_check check (end_date is null or end_date > start_date);
end
$$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'events_registration_deadline_check'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events drop constraint events_registration_deadline_check;
  end if;

  alter table public.events
    add constraint events_registration_deadline_check check (
      registration_deadline is null or registration_deadline <= start_date
    );
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'events_duplicated_from_fkey'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events
      add constraint events_duplicated_from_fkey
      foreign key (duplicated_from) references public.events (id) on delete set null;
  end if;
end
$$;

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  status public.registration_status not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  unique (event_id, team_id)
);

alter table public.registrations add column if not exists reviewed_at timestamptz;
alter table public.registrations add column if not exists reviewed_by uuid;
alter table public.registrations add column if not exists rejection_reason text;
alter table public.registrations add column if not exists source text;
alter table public.registrations add column if not exists updated_at timestamptz;
alter table public.registrations add column if not exists created_by uuid;

alter table public.registrations alter column status set default 'pending';
update public.registrations set status = 'pending' where status is null;
alter table public.registrations alter column status set not null;
alter table public.registrations alter column source set default 'self_service';
update public.registrations set source = 'self_service' where source is null;
alter table public.registrations alter column source set not null;
alter table public.registrations alter column updated_at set default timezone('utc', now());
update public.registrations set updated_at = coalesce(updated_at, created_at, timezone('utc', now())) where updated_at is null;
alter table public.registrations alter column updated_at set not null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'registrations_source_check'
      and conrelid = 'public.registrations'::regclass
  ) then
    alter table public.registrations drop constraint registrations_source_check;
  end if;

  alter table public.registrations
    add constraint registrations_source_check check (source in ('self_service', 'wildcard'));
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'registrations_reviewed_by_fkey'
      and conrelid = 'public.registrations'::regclass
  ) then
    alter table public.registrations
      add constraint registrations_reviewed_by_fkey
      foreign key (reviewed_by) references public.profiles (id) on delete set null;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'registrations_created_by_fkey'
      and conrelid = 'public.registrations'::regclass
  ) then
    alter table public.registrations
      add constraint registrations_created_by_fkey
      foreign key (created_by) references public.profiles (id) on delete set null;
  end if;
end
$$;

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

alter table public.matches add column if not exists status text;
alter table public.matches add column if not exists scheduled_at timestamptz;
alter table public.matches add column if not exists started_at timestamptz;
alter table public.matches add column if not exists ended_at timestamptz;
alter table public.matches add column if not exists duration_minutes integer;
alter table public.matches add column if not exists evidence jsonb;
alter table public.matches add column if not exists cancel_reason text;
alter table public.matches add column if not exists updated_at timestamptz;
alter table public.matches add column if not exists updated_by uuid;
alter table public.matches add column if not exists next_match_id uuid;
alter table public.matches add column if not exists next_slot text;

alter table public.matches alter column status set default 'pending';
alter table public.matches alter column team_a_id drop not null;
alter table public.matches alter column team_b_id drop not null;
update public.matches
set status = case
  when coalesce(score_a, 0) > 0 or coalesce(score_b, 0) > 0 or winner_id is not null then 'finished'
  else 'pending'
end
where status is null;
alter table public.matches alter column status set not null;
alter table public.matches alter column evidence set default '[]'::jsonb;
update public.matches set evidence = '[]'::jsonb where evidence is null;
alter table public.matches alter column evidence set not null;
alter table public.matches alter column updated_at set default timezone('utc', now());
update public.matches set updated_at = coalesce(updated_at, created_at, timezone('utc', now())) where updated_at is null;
alter table public.matches alter column updated_at set not null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'matches_team_a_id_fkey'
      and conrelid = 'public.matches'::regclass
  ) then
    alter table public.matches drop constraint matches_team_a_id_fkey;
  end if;

  if exists (
    select 1
    from pg_constraint
    where conname = 'matches_team_b_id_fkey'
      and conrelid = 'public.matches'::regclass
  ) then
    alter table public.matches drop constraint matches_team_b_id_fkey;
  end if;

  alter table public.matches
    add constraint matches_team_a_id_fkey
    foreign key (team_a_id) references public.teams (id) on delete set null;

  alter table public.matches
    add constraint matches_team_b_id_fkey
    foreign key (team_b_id) references public.teams (id) on delete set null;
end
$$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'matches_check'
      and conrelid = 'public.matches'::regclass
  ) then
    alter table public.matches drop constraint matches_check;
  end if;

  if exists (
    select 1
    from pg_constraint
    where conname = 'matches_team_distinct_check'
      and conrelid = 'public.matches'::regclass
  ) then
    alter table public.matches drop constraint matches_team_distinct_check;
  end if;

  alter table public.matches
    add constraint matches_team_distinct_check check (
      team_a_id is null
      or team_b_id is null
      or team_a_id <> team_b_id
    );
end
$$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'matches_status_check'
      and conrelid = 'public.matches'::regclass
  ) then
    alter table public.matches drop constraint matches_status_check;
  end if;

  alter table public.matches
    add constraint matches_status_check check (status in ('pending', 'in_progress', 'finished', 'cancelled'));
end
$$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'matches_next_slot_check'
      and conrelid = 'public.matches'::regclass
  ) then
    alter table public.matches drop constraint matches_next_slot_check;
  end if;

  alter table public.matches
    add constraint matches_next_slot_check check (next_slot is null or next_slot in ('team_a', 'team_b'));
end
$$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'matches_duration_minutes_check'
      and conrelid = 'public.matches'::regclass
  ) then
    alter table public.matches drop constraint matches_duration_minutes_check;
  end if;

  alter table public.matches
    add constraint matches_duration_minutes_check check (duration_minutes is null or duration_minutes >= 0);
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'matches_updated_by_fkey'
      and conrelid = 'public.matches'::regclass
  ) then
    alter table public.matches
      add constraint matches_updated_by_fkey
      foreign key (updated_by) references public.profiles (id) on delete set null;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'matches_next_match_id_fkey'
      and conrelid = 'public.matches'::regclass
  ) then
    alter table public.matches
      add constraint matches_next_match_id_fkey
      foreign key (next_match_id) references public.matches (id) on delete set null;
  end if;
end
$$;

create table if not exists public.match_result_logs (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  admin_user_id uuid not null references public.profiles (id) on delete cascade,
  action text not null,
  note text,
  previous_state jsonb,
  next_state jsonb,
  created_at timestamptz not null default timezone('utc', now())
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

create table if not exists public.admin_action_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.profiles (id) on delete cascade,
  action text not null,
  target_type text not null,
  target_id text,
  details jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.admin_action_logs add column if not exists severity text;
alter table public.admin_action_logs add column if not exists suspicious boolean;
alter table public.admin_action_logs add column if not exists previous_state jsonb;
alter table public.admin_action_logs add column if not exists next_state jsonb;
alter table public.admin_action_logs add column if not exists ip_address text;

update public.admin_action_logs set severity = 'info' where severity is null;
update public.admin_action_logs set suspicious = false where suspicious is null;

alter table public.admin_action_logs alter column severity set default 'info';
alter table public.admin_action_logs alter column suspicious set default false;
alter table public.admin_action_logs alter column severity set not null;
alter table public.admin_action_logs alter column suspicious set not null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'admin_action_logs_severity_check'
      and conrelid = 'public.admin_action_logs'::regclass
  ) then
    alter table public.admin_action_logs drop constraint admin_action_logs_severity_check;
  end if;

  alter table public.admin_action_logs
    add constraint admin_action_logs_severity_check
    check (severity in ('info', 'warning', 'critical'));
end
$$;

create table if not exists public.admin_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  ip_address text,
  created_at timestamptz not null default timezone('utc', now()),
  check (entity_type in ('user', 'team', 'event', 'match', 'tournament'))
);

create table if not exists public.bans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  banned_by uuid not null references public.profiles (id) on delete restrict,
  reason text not null,
  duration integer,
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  is_active boolean not null default true,
  check (duration is null or duration >= 1),
  check (expires_at is null or expires_at >= created_at)
);

create table if not exists public.team_rankings (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null unique references public.teams (id) on delete cascade,
  points integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  rank_position integer,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (points >= 0),
  check (wins >= 0),
  check (losses >= 0)
);

create table if not exists public.ranking_adjustments (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  points_delta integer not null,
  reason text not null,
  season text,
  archived boolean not null default false,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  check (entity_type in ('player', 'team'))
);

create table if not exists public.ranking_seasons (
  id uuid primary key default gen_random_uuid(),
  season text not null,
  archived_by uuid not null references public.profiles (id) on delete cascade,
  player_snapshot jsonb not null default '[]'::jsonb,
  team_snapshot jsonb not null default '[]'::jsonb,
  archived_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.system_settings (
  id integer primary key,
  platform_name text not null default 'MadnessArena',
  logo_url text,
  branding jsonb not null default '{}'::jsonb,
  social_links jsonb not null default '{}'::jsonb,
  terms_of_use text,
  general_rules text,
  tournament jsonb not null default '{"points_win":3,"points_loss":0,"points_draw":1,"max_teams_per_tournament":64,"max_members_per_team":10,"max_teams_per_user":3}'::jsonb,
  discord jsonb not null default '{}'::jsonb,
  email jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default timezone('utc', now()),
  check (id = 1)
);

insert into public.system_settings (id)
values (1)
on conflict (id) do nothing;

create table if not exists public.admin_security_alerts (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  risk_level text not null default 'medium',
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null,
  check (risk_level in ('low', 'medium', 'high', 'critical'))
);

create table if not exists public.backup_jobs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'queued',
  backup_type text not null default 'manual',
  scheduled_for timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  requested_by uuid references public.profiles (id) on delete set null,
  file_name text,
  payload jsonb,
  checksum text,
  restore_token text,
  restored_at timestamptz,
  restored_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  check (status in ('queued', 'running', 'completed', 'failed', 'restored')),
  check (backup_type in ('manual', 'scheduled'))
);

create table if not exists public.team_notifications (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  event_id uuid references public.events (id) on delete cascade,
  kind text not null,
  title text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.notification_templates (
  id uuid primary key default gen_random_uuid(),
  type text not null unique,
  label text not null,
  template text not null,
  enabled boolean not null default true,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.notifications_outbox (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  webhook_kind text not null,
  payload jsonb not null default '{}'::jsonb,
  rendered_message text,
  status text not null default 'scheduled',
  scheduled_at timestamptz,
  sent_at timestamptz,
  failed_at timestamptz,
  attempts integer not null default 0,
  response_code integer,
  error_message text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  check (status in ('scheduled', 'sent', 'failed', 'cancelled')),
  check (webhook_kind in ('announcements', 'admin_logs'))
);

insert into public.notification_templates (type, label, template)
values
  ('tournament_published', 'Novo torneio publicado', 'Novo torneio publicado: {{title}}. Inicio: {{startDate}}.'),
  ('event_finalized', 'Evento finalizado', 'Evento finalizado: {{title}}.'),
  ('registration_approved', 'Inscricao aprovada', 'Inscricao aprovada para {{teamName}} em {{eventTitle}}.'),
  ('registration_rejected', 'Inscricao rejeitada', 'Inscricao rejeitada para {{teamName}} em {{eventTitle}}. Motivo: {{reason}}.'),
  ('match_scheduled', 'Partida agendada', 'Partida agendada em {{eventTitle}}: {{teamA}} vs {{teamB}} em {{scheduledAt}}.'),
  ('match_result_published', 'Resultado publicado', 'Resultado em {{eventTitle}}: {{teamA}} {{scoreA}}x{{scoreB}} {{teamB}}. Vencedor: {{winner}}.'),
  ('ranking_updated', 'Ranking atualizado', 'Ranking atualizado por {{source}}.'),
  ('user_banned', 'Usuario banido', 'Usuario banido: {{userId}}. Motivo: {{reason}}.'),
  ('team_dissolved', 'Equipe dissolvida', 'Equipe dissolvida: {{teamName}}.'),
  ('admin_log', 'Log administrativo', '[ADMIN] {{message}}')
on conflict (type) do nothing;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'team_notifications_kind_check'
      and conrelid = 'public.team_notifications'::regclass
  ) then
    alter table public.team_notifications drop constraint team_notifications_kind_check;
  end if;

  alter table public.team_notifications
    add constraint team_notifications_kind_check check (
      kind in ('event_published', 'registration_approved', 'registration_rejected', 'event_starting_soon', 'event_finished')
    );
end
$$;

create index if not exists admin_action_logs_admin_idx on public.admin_action_logs (admin_user_id, created_at desc);
create index if not exists admin_action_logs_target_idx on public.admin_action_logs (target_type, target_id);
create index if not exists admin_action_logs_suspicious_idx on public.admin_action_logs (suspicious, created_at desc);
create index if not exists admin_action_logs_ip_idx on public.admin_action_logs (ip_address, created_at desc);
create index if not exists admin_logs_user_idx on public.admin_logs (user_id, created_at desc);
create index if not exists admin_logs_entity_idx on public.admin_logs (entity_type, entity_id, created_at desc);
create index if not exists bans_user_active_idx on public.bans (user_id, is_active, expires_at);
create index if not exists bans_created_at_idx on public.bans (created_at desc);
create index if not exists ranking_adjustments_entity_idx on public.ranking_adjustments (entity_type, entity_id, created_at desc);
create index if not exists ranking_adjustments_archived_idx on public.ranking_adjustments (archived, created_at desc);
create index if not exists ranking_seasons_season_idx on public.ranking_seasons (season, archived_at desc);
create index if not exists team_rankings_points_idx on public.team_rankings (points desc);
create index if not exists admin_security_alerts_risk_idx on public.admin_security_alerts (risk_level, created_at desc);
create index if not exists backup_jobs_status_idx on public.backup_jobs (status, created_at desc);
create index if not exists backup_jobs_created_idx on public.backup_jobs (created_at desc);

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists events_status_idx on public.events (status);
create index if not exists events_kind_idx on public.events (event_kind, status);
create index if not exists events_start_date_idx on public.events (start_date desc);
create index if not exists registrations_event_id_idx on public.registrations (event_id);
create index if not exists registrations_team_id_idx on public.registrations (team_id);
create index if not exists registrations_status_idx on public.registrations (event_id, status);
create index if not exists matches_event_id_idx on public.matches (event_id);
create index if not exists matches_status_idx on public.matches (event_id, status, round);
create index if not exists matches_schedule_idx on public.matches (scheduled_at);
create index if not exists rankings_points_idx on public.rankings (points desc);
create index if not exists team_notifications_team_idx on public.team_notifications (team_id, created_at desc);
create index if not exists team_notifications_event_idx on public.team_notifications (event_id, kind);
create index if not exists notifications_outbox_status_idx on public.notifications_outbox (status, scheduled_at);
create index if not exists notifications_outbox_type_idx on public.notifications_outbox (type, created_at desc);
create index if not exists notification_templates_type_idx on public.notification_templates (type);
create index if not exists match_result_logs_match_idx on public.match_result_logs (match_id, created_at desc);
create index if not exists match_result_logs_event_idx on public.match_result_logs (event_id, created_at desc);
create unique index if not exists team_notifications_unique_kind_per_team_event_idx
  on public.team_notifications (team_id, event_id, kind)
  where event_id is not null;

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.team_join_requests enable row level security;
alter table public.events enable row level security;
alter table public.registrations enable row level security;
alter table public.matches enable row level security;
alter table public.rankings enable row level security;
alter table public.team_rankings enable row level security;
alter table public.ranking_adjustments enable row level security;
alter table public.ranking_seasons enable row level security;
alter table public.system_settings enable row level security;
alter table public.admin_action_logs enable row level security;
alter table public.admin_logs enable row level security;
alter table public.admin_security_alerts enable row level security;
alter table public.backup_jobs enable row level security;
alter table public.bans enable row level security;
alter table public.team_notifications enable row level security;
alter table public.notification_templates enable row level security;
alter table public.notifications_outbox enable row level security;
alter table public.match_result_logs enable row level security;

drop policy if exists "Public can read active data from events" on public.events;
create policy "Public can read active data from events"
on public.events
for select
to anon, authenticated
using (
  public.is_admin()
  or (
    visibility = 'public'
    and status::text in ('published', 'active', 'finished')
  )
);

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

drop policy if exists "Public can read team rankings" on public.team_rankings;
create policy "Public can read team rankings"
on public.team_rankings
for select
to anon, authenticated
using (true);

drop policy if exists "Admins manage team rankings" on public.team_rankings;
create policy "Admins manage team rankings"
on public.team_rankings
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins read ranking adjustments" on public.ranking_adjustments;
create policy "Admins read ranking adjustments"
on public.ranking_adjustments
for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins manage ranking adjustments" on public.ranking_adjustments;
create policy "Admins manage ranking adjustments"
on public.ranking_adjustments
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins read ranking seasons" on public.ranking_seasons;
create policy "Admins read ranking seasons"
on public.ranking_seasons
for select
to authenticated
using (public.is_admin());

drop policy if exists "Owners manage ranking seasons" on public.ranking_seasons;
create policy "Owners manage ranking seasons"
on public.ranking_seasons
for all
to authenticated
using (public.is_owner())
with check (public.is_owner());

drop policy if exists "Public can read system settings" on public.system_settings;
create policy "Public can read system settings"
on public.system_settings
for select
to anon, authenticated
using (true);

drop policy if exists "Owners manage system settings" on public.system_settings;
create policy "Owners manage system settings"
on public.system_settings
for all
to authenticated
using (public.is_owner())
with check (public.is_owner());

drop policy if exists "Admins manage admin logs" on public.admin_action_logs;
create policy "Admins manage admin logs"
on public.admin_action_logs
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins read admin_logs" on public.admin_logs;
create policy "Admins read admin_logs"
on public.admin_logs
for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins insert admin_logs" on public.admin_logs;
create policy "Admins insert admin_logs"
on public.admin_logs
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Admins manage bans" on public.bans;
create policy "Admins manage bans"
on public.bans
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Users read own bans" on public.bans;
create policy "Users read own bans"
on public.bans
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Admins read security alerts" on public.admin_security_alerts;
create policy "Admins read security alerts"
on public.admin_security_alerts
for select
to authenticated
using (public.is_admin());

drop policy if exists "Owners manage security alerts" on public.admin_security_alerts;
create policy "Owners manage security alerts"
on public.admin_security_alerts
for all
to authenticated
using (public.is_owner())
with check (public.is_owner());

drop policy if exists "Admins read backup jobs" on public.backup_jobs;
create policy "Admins read backup jobs"
on public.backup_jobs
for select
to authenticated
using (public.is_admin());

drop policy if exists "Owners manage backup jobs" on public.backup_jobs;
create policy "Owners manage backup jobs"
on public.backup_jobs
for all
to authenticated
using (public.is_owner())
with check (public.is_owner());

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
  (
    id = auth.uid()
    and role = (select p.role from public.profiles p where p.id = auth.uid())
    and is_banned = (select p.is_banned from public.profiles p where p.id = auth.uid())
    and coalesce(ban_reason, '') = coalesce((select p.ban_reason from public.profiles p where p.id = auth.uid()), '')
    and coalesce(banned_reason, '') = coalesce((select p.banned_reason from public.profiles p where p.id = auth.uid()), '')
    and banned_at is not distinct from (select p.banned_at from public.profiles p where p.id = auth.uid())
    and banned_by is not distinct from (select p.banned_by from public.profiles p where p.id = auth.uid())
    and force_logout_after is not distinct from (select p.force_logout_after from public.profiles p where p.id = auth.uid())
    and deleted_at is not distinct from (select p.deleted_at from public.profiles p where p.id = auth.uid())
    and deleted_by is not distinct from (select p.deleted_by from public.profiles p where p.id = auth.uid())
  )
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

drop policy if exists "Public can read approved registrations" on public.registrations;
create policy "Public can read approved registrations"
on public.registrations
for select
to anon, authenticated
using (
  status = 'approved'
  and exists (
    select 1
    from public.events
    where events.id = registrations.event_id
      and events.status::text in ('published', 'active', 'finished')
  )
);

drop policy if exists "Team members read notifications" on public.team_notifications;
create policy "Team members read notifications"
on public.team_notifications
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.team_members tm
    where tm.team_id = team_notifications.team_id
      and tm.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.teams t
    where t.id = team_notifications.team_id
      and t.captain_id = auth.uid()
  )
);

drop policy if exists "Admins manage notifications" on public.team_notifications;
create policy "Admins manage notifications"
on public.team_notifications
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins read notification templates" on public.notification_templates;
create policy "Admins read notification templates"
on public.notification_templates
for select
to authenticated
using (public.is_admin());

drop policy if exists "Owners manage notification templates" on public.notification_templates;
create policy "Owners manage notification templates"
on public.notification_templates
for all
to authenticated
using (public.is_owner())
with check (public.is_owner());

drop policy if exists "Admins read notifications outbox" on public.notifications_outbox;
create policy "Admins read notifications outbox"
on public.notifications_outbox
for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins insert notifications outbox" on public.notifications_outbox;
create policy "Admins insert notifications outbox"
on public.notifications_outbox
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Owners manage notifications outbox" on public.notifications_outbox;
create policy "Owners manage notifications outbox"
on public.notifications_outbox
for update
to authenticated
using (public.is_owner())
with check (public.is_owner());

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

drop policy if exists "Admins manage match result logs" on public.match_result_logs;
create policy "Admins manage match result logs"
on public.match_result_logs
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());