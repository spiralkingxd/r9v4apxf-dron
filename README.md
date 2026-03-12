# MadnessArena

MadnessArena e uma plataforma de gerenciamento competitivo para torneios de Sea of Thieves, construída com Next.js, Supabase e autenticacao via Discord.

O projeto cobre:

- autenticacao OAuth com Discord via Supabase Auth
- sincronizacao automatica de perfil e Xbox Gamertag
- paginas publicas de eventos, equipes, bracket e ranking
- area autenticada de perfil
- dashboard administrativo protegido por role
- ranking competitivo recalculado a partir dos resultados das partidas

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase Auth, Postgres, RLS e Realtime
- Deploy recomendado na Vercel

## Pre-requisitos

Antes de rodar ou publicar o projeto, voce precisa ter:

- Node.js 20 ou superior
- npm 10 ou superior
- uma conta na Vercel
- um projeto no Supabase
- uma aplicacao OAuth criada no Discord Developer Portal

## Variaveis de ambiente

Copie [.env.example](.env.example) para `.env.local`.

```bash
cp .env.example .env.local
```

Preencha as variaveis abaixo:

### Aplicacao

- `NEXT_PUBLIC_APP_URL`
	URL publica da aplicacao.
	Exemplo local: `http://localhost:3000`
	Exemplo producao: `https://seu-projeto.vercel.app`

- `OWNER_DISCORD_ID`
	Discord ID numerico do owner principal do sistema.
	Quando esse usuario faz login, o backend promove automaticamente o perfil para `role = 'admin'`.
	Essa validacao acontece apenas no servidor.

### Supabase

- `NEXT_PUBLIC_SUPABASE_URL`
	URL do projeto Supabase.

- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
	Chave publica anon do Supabase usada pelo app.

- `SUPABASE_SERVICE_ROLE_KEY`
	Chave administrativa do Supabase.
	Nao deve ser exposta no cliente.
	O projeto atual nao a utiliza diretamente nas rotas publicas, mas ela pode ser util em futuras automacoes seguras.

### Discord

- `DISCORD_CLIENT_ID`
	Client ID da aplicacao OAuth no Discord.

- `DISCORD_CLIENT_SECRET`
	Client Secret da aplicacao OAuth no Discord.

- `DISCORD_REDIRECT_URI`
	URL de callback usada pelo Discord OAuth.
	Em desenvolvimento: `http://localhost:3000/auth/callback`
	Em producao: `https://seu-dominio/auth/callback`

- `DISCORD_BOT_USER_ID`
- `DISCORD_GUILD_ID`
- `DISCORD_BOT_TOKEN`
	Reservadas para integracoes futuras com bot/servidor Discord.

### Xbox e ranking

- `XBOX_TITLE_ID`
	Reservada para integracoes futuras Xbox.

- `MATCH_POINTS_WIN`
	Pontos por vitoria. Padrao do projeto: `3`

- `MATCH_POINTS_DRAW`
	Pontos por empate. Padrao do projeto: `1`

- `MATCH_POINTS_LOSS`
	Pontos por derrota. Padrao do projeto: `0`

### Vercel

- `VERCEL_PROJECT_PRODUCTION_URL`
	URL primaria de producao na Vercel, sem `https://`.
	Exemplo: `madnessarena.vercel.app`

## Configuracao do Supabase

### 1. Criar o projeto

1. Acesse o painel do Supabase.
2. Crie um novo projeto.
3. Aguarde a finalizacao do banco.
4. Copie a `Project URL` e a `anon public key` em `Project Settings > API`.

### 2. Aplicar o schema

1. Abra o SQL Editor do Supabase.
2. Copie todo o conteudo de [supabase/schema.sql](supabase/schema.sql).
3. Execute o script por completo.

Esse arquivo cria:

- tipos customizados de role, status de evento e status de inscricao
- tabelas `profiles`, `teams`, `team_members`, `events`, `registrations`, `matches` e `rankings`
- indices de performance
- trigger de sincronizacao inicial de perfil
- policies de Row Level Security

### 3. Configurar o provider Discord no Supabase Auth

1. No painel do Supabase, abra `Authentication > Providers`.
2. Ative o provider `Discord`.
3. Informe:
	 - Client ID
	 - Client Secret
4. Salve.

### 4. Configurar as URLs de redirecionamento no Supabase

No Supabase Auth, configure pelo menos:

- `http://localhost:3000/auth/callback`
- `https://seu-dominio-de-producao/auth/callback`

### 5. Coletar as chaves corretas

No Supabase, voce vai usar:

- `Project URL` -> `NEXT_PUBLIC_SUPABASE_URL`
- `anon public key` -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role key` -> `SUPABASE_SERVICE_ROLE_KEY`

## Configuracao do Discord

### 1. Criar a aplicacao OAuth2

1. Acesse o Discord Developer Portal.
2. Clique em `New Application`.
3. Defina um nome para a aplicacao.
4. Em `OAuth2 > General`, copie:
	 - Client ID
	 - Client Secret

### 2. Configurar Redirect URI

Em `OAuth2 > Redirects`, adicione:

- `http://localhost:3000/auth/callback`
- `https://seu-dominio/auth/callback`

Esses valores devem bater com:

- `DISCORD_REDIRECT_URI`
- configuracao do provider Discord no Supabase

### 3. Scopes necessarios

O fluxo deste projeto depende dos scopes:

- `identify`
- `email`
- `connections`

O scope `connections` e necessario para buscar `GET /users/@me/connections` e tentar sincronizar a conexao Xbox do usuario.

## Fluxo de owner e administracao

O projeto possui dois caminhos para obter role admin:

### Owner automatico

Durante o login com Discord:

1. o backend resolve o `discord_id` do usuario
2. compara com `OWNER_DISCORD_ID`
3. se houver match, faz upsert do perfil com `role = 'admin'`

Arquivo responsavel:

- [lib/auth/profile.ts](lib/auth/profile.ts)

### Promocao manual

No dashboard admin, um admin existente pode promover outro usuario para admin.

## Como rodar localmente

1. Instale as dependencias:

```bash
npm install
```

2. Configure o `.env.local`.

3. Rode o projeto:

```bash
npm run dev
```

4. Acesse:

```text
http://localhost:3000
```

## Rotas principais

### Publicas

- `/`
- `/teams`
- `/teams/[id]`
- `/events`
- `/events/[id]`
- `/events/[id]/bracket`
- `/ranking`

### Autenticadas

- `/auth/login`
- `/auth/callback`
- `/profile/me`

### Administrativas

- `/admin/dashboard`

## Deploy na Vercel

### 1. Conectar o repositorio

1. Suba o codigo para GitHub, GitLab ou Bitbucket.
2. No painel da Vercel, clique em `Add New Project`.
3. Importe o repositorio.
4. A Vercel deve detectar automaticamente que o projeto e Next.js.

### 2. Configurar as variaveis de ambiente

No painel do projeto na Vercel, abra `Settings > Environment Variables` e cadastre todas as variaveis do `.env.example`.

As mais importantes para o primeiro deploy sao:

- `NEXT_PUBLIC_APP_URL`
- `OWNER_DISCORD_ID`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_REDIRECT_URI`
- `MATCH_POINTS_WIN`
- `MATCH_POINTS_DRAW`
- `MATCH_POINTS_LOSS`

### 3. Ajustar URLs de producao

Depois de saber a URL final da Vercel:

1. atualize `NEXT_PUBLIC_APP_URL`
2. atualize `DISCORD_REDIRECT_URI`
3. adicione a URL final no Discord Developer Portal
4. adicione a URL final em `Authentication > URL Configuration` no Supabase

### 4. Fazer o deploy

Depois disso:

1. rode `git push`
2. aguarde o build na Vercel
3. teste login, callback, perfil, eventos, ranking e dashboard admin

## Imagens e URLs validas

O projeto esta configurado para aceitar imagens remotas de:

- `cdn.discordapp.com`
- `images-ext-1.discordapp.net`
- `images-ext-2.discordapp.net`
- `**.supabase.co`

Arquivo responsavel:

- [next.config.ts](next.config.ts)

Isso cobre:

- avatares vindos do Discord
- assets servidos via Supabase Storage

## Seguranca

### Console e dados sensiveis

Foi feita revisao do codigo e nao ha `console.log`, `console.error`, `console.warn`, `console.info` ou `debugger` expostos nas areas principais do app.

### RLS

As policies do schema limitam escrita administrativa em tabelas sensiveis como:

- `events`
- `matches`
- `rankings`

As validacoes de frontend nao substituem as policies do banco. O bloqueio real continua no Supabase.

### Middleware

O middleware protege:

- rotas privadas de usuario
- rotas `/admin` para admins apenas

Arquivos principais:

- [middleware.ts](middleware.ts)
- [lib/supabase/middleware.ts](lib/supabase/middleware.ts)

## Dashboard admin

O painel administrativo permite:

- criar, editar e excluir eventos
- gerenciar times
- atualizar resultados de matches
- promover usuarios a admin

Arquivos:

- [app/admin/dashboard/page.tsx](app/admin/dashboard/page.tsx)
- [app/admin/actions.ts](app/admin/actions.ts)

## Sobre vercel.json

Neste projeto, um arquivo `vercel.json` nao e obrigatorio.

Como a aplicacao usa Next.js App Router e rotas padrao, a Vercel resolve build, SSR e route handling automaticamente. Adicione `vercel.json` apenas se futuramente voce precisar de headers customizados, rewrites ou configuracoes avancadas.

## Checklist final antes do deploy

- [ ] `.env.local` preenchido corretamente
- [ ] `OWNER_DISCORD_ID` definido com o Discord ID do owner
- [ ] schema de [supabase/schema.sql](supabase/schema.sql) aplicado no projeto Supabase correto
- [ ] provider Discord habilitado no Supabase
- [ ] Redirect URI configurado no Discord e no Supabase
- [ ] variaveis de ambiente replicadas no painel da Vercel
- [ ] login com Discord funcionando
- [ ] callback `/auth/callback` funcionando em producao
- [ ] owner promovido automaticamente para admin
- [ ] acesso a `/admin/dashboard` validado
- [ ] imagens externas carregando corretamente
- [ ] `npm run dev` funcionando localmente
- [ ] `npx tsc --noEmit` sem erros

## Comandos uteis

```bash
npm install
npm run dev
npx tsc --noEmit
```

## Estrutura relevante do projeto

- [app](app)
- [components](components)
- [lib](lib)
- [supabase/schema.sql](supabase/schema.sql)
- [.env.example](.env.example)
- [next.config.ts](next.config.ts)
