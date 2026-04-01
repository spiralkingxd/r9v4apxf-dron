-- Community streamers module
-- Execute after main schema files.

create extension if not exists pgcrypto;
create extension if not exists unaccent;

create table if not exists public.streamer_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  is_highlight boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.streamer_tag_links (
  streamer_id uuid not null references public.streamers(id) on delete cascade,
  tag_id uuid not null references public.streamer_tags(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (streamer_id, tag_id)
);

alter table public.streamers add column if not exists display_name text;
alter table public.streamers add column if not exists platform text;
alter table public.streamers add column if not exists channel_url text;
alter table public.streamers add column if not exists avatar_url text;
alter table public.streamers add column if not exists bio text;
alter table public.streamers add column if not exists is_featured boolean;
alter table public.streamers add column if not exists community_enabled boolean;
alter table public.streamers add column if not exists stream_origin text;
alter table public.streamers add column if not exists twitch_id text;
alter table public.streamers add column if not exists twitch_login text;
alter table public.streamers add column if not exists is_live boolean;
alter table public.streamers add column if not exists live_title text;
alter table public.streamers add column if not exists live_game text;
alter table public.streamers add column if not exists viewers integer;
alter table public.streamers add column if not exists live_started_at timestamptz;
alter table public.streamers add column if not exists last_seen_online timestamptz;
alter table public.streamers add column if not exists last_checked_at timestamptz;
alter table public.streamers add column if not exists twitch_live_tags jsonb;
alter table public.streamers add column if not exists has_madnessarena_tag boolean;
alter table public.streamers add column if not exists tag_checked_at timestamptz;

update public.streamers
set
  display_name = coalesce(nullif(trim(display_name), ''), nullif(trim(username), ''), 'Streamer'),
  platform = coalesce(nullif(trim(platform), ''), 'twitch'),
  channel_url = coalesce(
    nullif(trim(channel_url), ''),
    case when nullif(trim(username), '') is not null then 'https://twitch.tv/' || trim(username) else null end
  ),
  twitch_login = coalesce(nullif(trim(twitch_login), ''), nullif(trim(username), '')),
  is_featured = coalesce(is_featured, false),
  community_enabled = coalesce(community_enabled, true),
  stream_origin = coalesce(nullif(trim(stream_origin), ''), case when twitch_id is not null then 'community_auto' else 'manual_event' end),
  is_live = coalesce(is_live, false),
  viewers = coalesce(viewers, 0),
  twitch_live_tags = coalesce(twitch_live_tags, '[]'::jsonb),
  has_madnessarena_tag = coalesce(has_madnessarena_tag, false);

alter table public.streamers alter column display_name set not null;
alter table public.streamers alter column platform set not null;
alter table public.streamers alter column channel_url set not null;
alter table public.streamers alter column is_featured set default false;
alter table public.streamers alter column is_featured set not null;
alter table public.streamers alter column community_enabled set default true;
alter table public.streamers alter column community_enabled set not null;
alter table public.streamers alter column stream_origin set default 'manual_event';
alter table public.streamers alter column stream_origin set not null;
alter table public.streamers alter column is_live set default false;
alter table public.streamers alter column is_live set not null;
alter table public.streamers alter column viewers set default 0;
alter table public.streamers alter column twitch_live_tags set default '[]'::jsonb;
alter table public.streamers alter column has_madnessarena_tag set default false;
alter table public.streamers alter column has_madnessarena_tag set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'streamers_platform_check'
      and conrelid = 'public.streamers'::regclass
  ) then
    alter table public.streamers
      add constraint streamers_platform_check
      check (platform in ('twitch', 'youtube'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'streamers_origin_check'
      and conrelid = 'public.streamers'::regclass
  ) then
    alter table public.streamers
      add constraint streamers_origin_check
      check (stream_origin in ('manual_event', 'community_auto'));
  end if;
end
$$;

create unique index if not exists streamers_twitch_id_uidx on public.streamers (twitch_id) where twitch_id is not null;
create unique index if not exists streamers_twitch_login_uidx on public.streamers (lower(twitch_login)) where twitch_login is not null;
create index if not exists streamers_live_idx on public.streamers (is_live desc, is_featured desc, viewers desc, display_name);
create index if not exists streamers_madness_live_idx on public.streamers (has_madnessarena_tag, is_live desc, viewers desc);
create index if not exists streamers_active_platform_idx on public.streamers (is_active, platform);
create index if not exists streamers_community_enabled_idx on public.streamers (community_enabled, platform);
create index if not exists stl_tag_idx on public.streamer_tag_links (tag_id, streamer_id);
create index if not exists stl_streamer_idx on public.streamer_tag_links (streamer_id, tag_id);
create index if not exists streamer_tags_slug_idx on public.streamer_tags (slug);

create or replace function public.normalize_streamer_tag_slug()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.slug := lower(trim(new.slug));
  new.name := case
    when new.name is null or length(trim(new.name)) = 0 then new.slug
    else trim(new.name)
  end;
  return new;
end;
$$;

drop trigger if exists streamer_tags_normalize_slug on public.streamer_tags;
create trigger streamer_tags_normalize_slug
before insert or update on public.streamer_tags
for each row
execute function public.normalize_streamer_tag_slug();

insert into public.streamer_tags (name, slug, is_highlight)
values ('MadnessArena', 'madnessarena', true)
on conflict (slug) do update set name = excluded.name, is_highlight = true;

grant select on public.streamer_tags to anon, authenticated;
grant select on public.streamer_tag_links to anon, authenticated;
grant insert, update, delete on public.streamer_tags to authenticated;
grant insert, update, delete on public.streamer_tag_links to authenticated;

alter table public.streamer_tags enable row level security;
alter table public.streamer_tag_links enable row level security;

drop policy if exists "Public read streamer tags" on public.streamer_tags;
create policy "Public read streamer tags"
on public.streamer_tags
for select
to anon, authenticated
using (true);

drop policy if exists "Admins manage streamer tags" on public.streamer_tags;
create policy "Admins manage streamer tags"
on public.streamer_tags
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public read streamer tag links" on public.streamer_tag_links;
create policy "Public read streamer tag links"
on public.streamer_tag_links
for select
to anon, authenticated
using (true);

drop policy if exists "Admins manage streamer tag links" on public.streamer_tag_links;
create policy "Admins manage streamer tag links"
on public.streamer_tag_links
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.get_madnessarena_streamers(
  p_search text default null,
  p_status text default 'all',
  p_secondary_tag text default null
)
returns table (
  id uuid,
  display_name text,
  username text,
  platform text,
  channel_url text,
  avatar_url text,
  bio text,
  is_live boolean,
  live_title text,
  live_game text,
  viewers integer,
  is_featured boolean,
  last_seen_online timestamptz,
  tags jsonb
)
language sql
security definer
set search_path = public
as $$
  with base as (
    select s.*
    from public.streamers s
    where s.community_enabled = true
      and s.stream_origin = 'community_auto'
      and s.twitch_id is not null
      and s.has_madnessarena_tag = true
      and (
        p_secondary_tag is null
        or p_secondary_tag = ''
        or exists (
          select 1
          from jsonb_array_elements_text(coalesce(s.twitch_live_tags, '[]'::jsonb)) as tag(value)
          where lower(regexp_replace(unaccent(trim(tag.value)), '\s+', '', 'g'))
            = lower(regexp_replace(unaccent(trim(p_secondary_tag)), '\s+', '', 'g'))
        )
      )
      and (
        p_status = 'all'
        or (p_status = 'live' and s.is_live = true)
        or (p_status = 'offline' and s.is_live = false)
      )
      and (
        p_search is null
        or trim(p_search) = ''
        or lower(coalesce(s.display_name, '')) like '%' || lower(trim(p_search)) || '%'
        or lower(coalesce(s.username, '')) like '%' || lower(trim(p_search)) || '%'
      )
  )
  select
    b.id,
    b.display_name,
    b.username,
    b.platform,
    b.channel_url,
    b.avatar_url,
    b.bio,
    b.is_live,
    b.live_title,
    b.live_game,
    coalesce(b.viewers, 0) as viewers,
    b.is_featured,
    b.last_seen_online,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'name', v.tag,
            'slug', lower(regexp_replace(unaccent(trim(v.tag)), '\s+', '', 'g')),
            'is_highlight', lower(regexp_replace(unaccent(trim(v.tag)), '\s+', '', 'g')) = 'madnessarena'
          )
          order by
            (lower(regexp_replace(unaccent(trim(v.tag)), '\s+', '', 'g')) = 'madnessarena') desc,
            v.tag asc
        )
        from (
          select distinct jsonb_array_elements_text(coalesce(b.twitch_live_tags, '[]'::jsonb)) as tag
        ) v
      ),
      '[]'::jsonb
    ) as tags
  from base b
  group by
    b.id,
    b.display_name,
    b.username,
    b.platform,
    b.channel_url,
    b.avatar_url,
    b.bio,
    b.is_live,
    b.live_title,
    b.live_game,
    b.viewers,
    b.is_featured,
    b.last_seen_online,
    b.twitch_live_tags
  order by b.is_live desc, b.is_featured desc, coalesce(b.viewers, 0) desc, b.display_name asc;
$$;

grant execute on function public.get_madnessarena_streamers(text, text, text) to anon, authenticated;

create or replace function public.get_madnessarena_secondary_tags()
returns table (
  slug text,
  name text
)
language sql
security definer
set search_path = public
as $$
  select
    lower(regexp_replace(unaccent(trim(tag.value)), '\s+', '', 'g')) as slug,
    trim(tag.value) as name
  from public.streamers s,
       lateral jsonb_array_elements_text(coalesce(s.twitch_live_tags, '[]'::jsonb)) as tag(value)
  where s.community_enabled = true
    and s.stream_origin = 'community_auto'
    and s.twitch_id is not null
    and s.has_madnessarena_tag = true
    and lower(regexp_replace(unaccent(trim(tag.value)), '\s+', '', 'g')) <> 'madnessarena'
  group by
    lower(regexp_replace(unaccent(trim(tag.value)), '\s+', '', 'g')),
    trim(tag.value)
  order by name asc;
$$;

grant execute on function public.get_madnessarena_secondary_tags() to anon, authenticated;
