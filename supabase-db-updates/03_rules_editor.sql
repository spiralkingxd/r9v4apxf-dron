-- 03_rules_editor.sql
-- Estrutura e políticas para editor de regras dinâmicas

create extension if not exists pgcrypto;

create table if not exists public.rules_content (
  id uuid primary key default gen_random_uuid(),
  "order" integer not null,
  title text not null,
  content text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists rules_content_order_key on public.rules_content ("order");

create or replace function public.set_rules_content_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_set_rules_content_updated_at on public.rules_content;
create trigger trg_set_rules_content_updated_at
before update on public.rules_content
for each row
execute function public.set_rules_content_updated_at();

alter table public.rules_content enable row level security;

-- leitura pública (página /regras)
drop policy if exists "Public can read rules content" on public.rules_content;
create policy "Public can read rules content"
on public.rules_content
for select
using (true);

-- admins e owners podem gerenciar regras
drop policy if exists "Admins manage rules content" on public.rules_content;
create policy "Admins manage rules content"
on public.rules_content
for all
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'owner')
      and coalesce(p.is_banned, false) = false
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'owner')
      and coalesce(p.is_banned, false) = false
  )
);

-- permitir admin atualizar apenas general_rules em system_settings via API
-- (se já existir policy mais permissiva para owner, ela continua válida)
drop policy if exists "Admins update system settings rules" on public.system_settings;
create policy "Admins update system settings rules"
on public.system_settings
for update
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'owner')
      and coalesce(p.is_banned, false) = false
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'owner')
      and coalesce(p.is_banned, false) = false
  )
);

-- seed inicial, só se vazio
insert into public.rules_content ("order", title, content)
select *
from (
  values
    (1, 'Conduta e Fair Play', 'Todos os participantes devem manter o respeito. Comportamento tóxico, racismo ou qualquer tipo de discriminação resultará em banimento imediato e permanente.'),
    (2, 'Inscrições e Equipes', 'Capitães são responsáveis por inscrever sua equipe nos eventos. Verifique o tamanho exigido da equipe para cada campeonato (Sloop, Brigantine ou Galleon).'),
    (3, 'Horários', 'Tolerância máxima de 10 minutos de atraso para check-in. Caso a equipe não esteja pronta, perderá a partida por W.O.'),
    (4, 'Gravação e Provas', 'É obrigatório que pelo menos um jogador de cada tripulação grave a partida, ou transmita na Twitch, para validação de resultados em caso de disputa.')
) as seed ("order", title, content)
where not exists (select 1 from public.rules_content);
