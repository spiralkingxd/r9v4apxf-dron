# MadnessArena

MadnessArena é uma plataforma de gerenciamento competitivo para torneios de Sea of Thieves, construída com Next.js, Supabase e autenticação via Discord.

O projeto cobre:

- autenticação OAuth com Discord via Supabase Auth
- sincronização automática de perfil e Xbox Gamertag
- páginas públicas de eventos, equipes, chaveamento e ranking
- área autenticada de perfil
- painel administrativo protegido por papel de acesso
- ranking competitivo recalculado a partir dos resultados das partidas

## Tecnologias

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase Auth, Postgres, RLS e Realtime
- Publicação recomendada na Vercel

## Pre-requisitos

Antes de rodar ou publicar o projeto, você precisa ter:

- Node.js 20 ou superior
- npm 10 ou superior
- uma conta na Vercel
- um projeto no Supabase
- uma aplicação OAuth criada no Discord Developer Portal

## Variáveis de ambiente

Copie [.env.example](.env.example) para `.env.local`.

```bash
cp .env.example .env.local
```

Preencha as variáveis abaixo:

### Aplicação

- `NEXT_PUBLIC_APP_URL`
	URL pública da aplicação.
	Exemplo local: `http://localhost:3000`
	Exemplo produção: `https://seu-projeto.vercel.app`

- `OWNER_DISCORD_ID`
	Discord ID numérico do proprietário principal do sistema.
	Quando esse usuário faz login, o backend promove automaticamente o perfil para `role = 'admin'`.
	Essa validacao acontece apenas no servidor.

### Supabase

- `NEXT_PUBLIC_SUPABASE_URL`
	URL do projeto Supabase.

- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
	Chave pública `anon` do Supabase usada pelo app.

- `SUPABASE_SERVICE_ROLE_KEY`
	Chave administrativa do Supabase.
	Não deve ser exposta no cliente.
	O projeto atual não a utiliza diretamente nas rotas públicas, mas ela pode ser útil em futuras automações seguras.

### Discord

- `DISCORD_CLIENT_ID`
	Client ID da aplicação OAuth no Discord.

- `DISCORD_CLIENT_SECRET`
	Client Secret da aplicação OAuth no Discord.

- `DISCORD_REDIRECT_URI`
	URL de retorno usada pelo OAuth do Discord.
	Em desenvolvimento: `http://localhost:3000/auth/callback`
	Em produção: `https://seu-dominio/auth/callback`

- `DISCORD_BOT_USER_ID`
- `DISCORD_GUILD_ID`
- `DISCORD_BOT_TOKEN`
	Reservadas para integrações futuras com bot/servidor Discord.

### Xbox e ranking

- `XBOX_TITLE_ID`
	Reservada para integrações futuras com Xbox.

- `MATCH_POINTS_WIN`
	Pontos por vitória. Padrão do projeto: `3`

- `MATCH_POINTS_DRAW`
	Pontos por empate. Padrão do projeto: `1`

- `MATCH_POINTS_LOSS`
	Pontos por derrota. Padrão do projeto: `0`

### Vercel

- `VERCEL_PROJECT_PRODUCTION_URL`
	URL primária de produção na Vercel, sem `https://`.
	Exemplo: `madnessarena.vercel.app`

## Configuração do Supabase

### 1. Criar o projeto

1. Acesse o painel do Supabase.
2. Crie um novo projeto.
3. Aguarde a finalização do banco.
4. Copie a `Project URL` e a `anon public key` em `Project Settings > API`.

### 2. Aplicar o schema

1. Abra o SQL Editor do Supabase.
2. Copie todo o conteudo de [supabase/schema.sql](supabase/schema.sql).
3. Execute o script por completo.

Esse arquivo cria:

- tipos customizados de role, status de evento e status de inscricao
- tabelas `profiles`, `teams`, `team_members`, `events`, `registrations`, `matches` e `rankings`
- índices de performance
- trigger de sincronização inicial de perfil
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

No Supabase, você vai usar:

- `Project URL` -> `NEXT_PUBLIC_SUPABASE_URL`
- `anon public key` -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role key` -> `SUPABASE_SERVICE_ROLE_KEY`

## Configuração do Discord

### 1. Criar a aplicação OAuth2

1. Acesse o Discord Developer Portal.
2. Clique em `New Application`.
3. Defina um nome para a aplicação.
4. Em `OAuth2 > General`, copie:
	 - Client ID
	 - Client Secret

### 2. Configurar Redirect URI

Em `OAuth2 > Redirects`, adicione:

- `http://localhost:3000/auth/callback`
- `https://seu-dominio/auth/callback`

Esses valores devem bater com:

- `DISCORD_REDIRECT_URI`
- configuração do provider Discord no Supabase

### 3. Escopos necessários

O fluxo deste projeto depende dos escopos:

- `identify`
- `email`
- `connections`

O escopo `connections` é necessário para buscar `GET /users/@me/connections` e tentar sincronizar a conexão Xbox do usuário.

## Fluxo de proprietário e administração

O projeto possui dois caminhos para obter papel de admin:

### Proprietário automático

Durante o login com Discord:

1. o backend resolve o `discord_id` do usuário
2. compara com `OWNER_DISCORD_ID`
3. se houver correspondência, faz `upsert` do perfil com `role = 'admin'`

Arquivo responsavel:

- [lib/auth/profile.ts](lib/auth/profile.ts)

### Promoção manual

No painel administrativo, um admin existente pode promover outro usuário para admin.

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

### Públicas

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

## Publicação na Vercel

### 1. Conectar o repositório

1. Suba o código para GitHub, GitLab ou Bitbucket.
2. No painel da Vercel, clique em `Add New Project`.
3. Importe o repositorio.
4. A Vercel deve detectar automaticamente que o projeto é Next.js.

### 2. Configurar as variáveis de ambiente

No painel do projeto na Vercel, abra `Settings > Environment Variables` e cadastre todas as variáveis do `.env.example`.

As mais importantes para a primeira publicação são:

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

### 3. Ajustar URLs de produção

Depois de saber a URL final da Vercel:

1. atualize `NEXT_PUBLIC_APP_URL`
2. atualize `DISCORD_REDIRECT_URI`
3. adicione a URL final no Discord Developer Portal
4. adicione a URL final em `Authentication > URL Configuration` no Supabase

### 4. Fazer a publicação

Depois disso:

1. rode `git push`
2. aguarde o build na Vercel
3. teste login, retorno OAuth, perfil, eventos, ranking e painel admin

## Imagens e URLs validas

O projeto está configurado para aceitar imagens remotas de:

- `cdn.discordapp.com`
- `images-ext-1.discordapp.net`
- `images-ext-2.discordapp.net`
- `**.supabase.co`

Arquivo responsavel:

- [next.config.ts](next.config.ts)

Isso cobre:

- avatares vindos do Discord
- arquivos servidos via Supabase Storage

## Seguranca

### Console e dados sensíveis

Foi feita revisão do código e não há `console.log`, `console.error`, `console.warn`, `console.info` ou `debugger` expostos nas áreas principais do app.

### RLS

As policies do schema limitam escrita administrativa em tabelas sensíveis como:

- `events`
- `matches`
- `rankings`

As validações de frontend não substituem as policies do banco. O bloqueio real continua no Supabase.

### Middleware

O middleware protege:

- rotas privadas de usuário
- rotas `/admin` para admins apenas

Arquivos principais:

- [middleware.ts](middleware.ts)
- [lib/supabase/middleware.ts](lib/supabase/middleware.ts)

## Painel Admin

O painel administrativo permite:

- criar, editar e excluir eventos
- gerenciar times
- atualizar resultados de partidas
- promover usuários a admin

Arquivos:

- [app/admin/dashboard/page.tsx](app/admin/dashboard/page.tsx)
- [app/admin/actions.ts](app/admin/actions.ts)

## Sobre vercel.json

Neste projeto, um arquivo `vercel.json` não é obrigatório.

Como a aplicação usa Next.js App Router e rotas padrão, a Vercel resolve build, SSR e roteamento automaticamente. Adicione `vercel.json` apenas se futuramente você precisar de headers customizados, rewrites ou configurações avançadas.

## Checklist final antes da publicação

- [ ] `.env.local` preenchido corretamente
- [ ] `OWNER_DISCORD_ID` definido com o Discord ID do proprietário
- [ ] schema de [supabase/schema.sql](supabase/schema.sql) aplicado no projeto Supabase correto
- [ ] provider Discord habilitado no Supabase
- [ ] Redirect URI configurado no Discord e no Supabase
- [ ] variáveis de ambiente replicadas no painel da Vercel
- [ ] login com Discord funcionando
- [ ] retorno `/auth/callback` funcionando em produção
- [ ] proprietário promovido automaticamente para admin
- [ ] acesso a `/admin/dashboard` validado
- [ ] imagens externas carregando corretamente
- [ ] `npm run dev` funcionando localmente
- [ ] `npx tsc --noEmit` sem erros

## Comandos úteis

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
