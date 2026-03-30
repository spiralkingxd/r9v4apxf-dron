-- Complemento do schema principal (supabase/schema.sql)
-- Este script adiciona tabelas usadas pelo app e que nao estao no schema principal:
-- 1) notifications
-- 2) rules_content
-- 3) streamers
--
-- Execute este arquivo APOS executar supabase/schema.sql

create extension if not exists "pgcrypto";

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  data jsonb,
  read boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.rules_content (
  id uuid primary key default gen_random_uuid(),
  "order" integer not null,
  title text not null,
  content text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint rules_content_order_positive check ("order" > 0),
  constraint rules_content_order_unique unique ("order")
);

alter table public.rules_content add column if not exists "order" integer;
alter table public.rules_content add column if not exists title text;
alter table public.rules_content add column if not exists content text;
alter table public.rules_content add column if not exists created_at timestamptz;
alter table public.rules_content add column if not exists updated_at timestamptz;
update public.rules_content set created_at = coalesce(created_at, timezone('utc', now()));
update public.rules_content set updated_at = coalesce(updated_at, timezone('utc', now()));
alter table public.rules_content alter column created_at set default timezone('utc', now());
alter table public.rules_content alter column updated_at set default timezone('utc', now());
alter table public.rules_content alter column created_at set not null;
alter table public.rules_content alter column updated_at set not null;

create table if not exists public.streamers (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  is_official boolean not null default false,
  is_active boolean not null default true,
  selected_for_multiview boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.streamers add column if not exists username text;
alter table public.streamers add column if not exists is_official boolean;
alter table public.streamers add column if not exists is_active boolean;
alter table public.streamers add column if not exists selected_for_multiview boolean;
alter table public.streamers add column if not exists active boolean;
alter table public.streamers add column if not exists created_at timestamptz;
alter table public.streamers add column if not exists updated_at timestamptz;

update public.streamers set is_official = coalesce(is_official, false);
update public.streamers set is_active = coalesce(is_active, true);
update public.streamers set selected_for_multiview = coalesce(selected_for_multiview, true);
update public.streamers set active = coalesce(active, true);
update public.streamers set created_at = coalesce(created_at, timezone('utc', now()));
update public.streamers set updated_at = coalesce(updated_at, timezone('utc', now()));

alter table public.streamers alter column is_official set default false;
alter table public.streamers alter column is_active set default true;
alter table public.streamers alter column selected_for_multiview set default true;
alter table public.streamers alter column active set default true;
alter table public.streamers alter column created_at set default timezone('utc', now());
alter table public.streamers alter column updated_at set default timezone('utc', now());

alter table public.streamers alter column is_official set not null;
alter table public.streamers alter column is_active set not null;
alter table public.streamers alter column selected_for_multiview set not null;
alter table public.streamers alter column active set not null;
alter table public.streamers alter column created_at set not null;
alter table public.streamers alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'streamers_username_key'
      and conrelid = 'public.streamers'::regclass
  ) then
    alter table public.streamers add constraint streamers_username_key unique (username);
  end if;
end
$$;

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_read_idx
  on public.notifications (user_id, read);
create index if not exists streamers_active_idx
  on public.streamers (is_active, selected_for_multiview, active);
create index if not exists rules_content_order_idx
  on public.rules_content ("order");

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists rules_content_touch_updated_at on public.rules_content;
create trigger rules_content_touch_updated_at
before update on public.rules_content
for each row
execute function public.touch_updated_at();

drop trigger if exists streamers_touch_updated_at on public.streamers;
create trigger streamers_touch_updated_at
before update on public.streamers
for each row
execute function public.touch_updated_at();

grant select, insert, update, delete on public.notifications to authenticated;
grant select on public.notifications to anon;
grant select on public.rules_content to anon, authenticated;
grant select on public.streamers to anon, authenticated;
grant insert, update, delete on public.rules_content to authenticated;
grant insert, update, delete on public.streamers to authenticated;

alter table public.notifications enable row level security;
alter table public.rules_content enable row level security;
alter table public.streamers enable row level security;

drop policy if exists "Users read own notifications" on public.notifications;
create policy "Users read own notifications"
on public.notifications
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users update own notifications" on public.notifications;
create policy "Users update own notifications"
on public.notifications
for update
to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users delete own notifications" on public.notifications;
create policy "Users delete own notifications"
on public.notifications
for delete
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Admins insert notifications" on public.notifications;
create policy "Admins insert notifications"
on public.notifications
for insert
to authenticated
with check (public.is_admin() or user_id = auth.uid());

drop policy if exists "Public read rules content" on public.rules_content;
create policy "Public read rules content"
on public.rules_content
for select
to anon, authenticated
using (true);

drop policy if exists "Admins manage rules content" on public.rules_content;
create policy "Admins manage rules content"
on public.rules_content
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public read streamers" on public.streamers;
create policy "Public read streamers"
on public.streamers
for select
to anon, authenticated
using (true);

drop policy if exists "Admins manage streamers" on public.streamers;
create policy "Admins manage streamers"
on public.streamers
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
