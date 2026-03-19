-- Suporte a suspensao temporaria de inscricoes em torneios
-- Escopos:
--   full_access = bloqueio total (banimento)
--   tournament_registration = bloqueio apenas de inscricao em torneios

alter table public.bans
  add column if not exists scope text;

update public.bans
set scope = 'full_access'
where scope is null;

alter table public.bans
  alter column scope set default 'full_access';

alter table public.bans
  alter column scope set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bans_scope_check'
  ) then
    alter table public.bans
      add constraint bans_scope_check
      check (scope in ('full_access', 'tournament_registration'));
  end if;
end
$$;

create index if not exists bans_scope_active_idx
  on public.bans (scope, is_active, expires_at);

