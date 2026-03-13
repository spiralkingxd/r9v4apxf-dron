# MadnessArena

Plataforma competitiva para torneios de Sea of Thieves, com autenticação via Discord, backend Supabase e painel administrativo para operação de eventos.

## Sumário

- [Visão geral](#visão-geral)
- [Stack](#stack)
- [Funcionalidades](#funcionalidades)
- [Pré-requisitos](#pré-requisitos)
- [Configuração rápida](#configuração-rápida)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Configuração do Supabase](#configuração-do-supabase)
- [Configuração do Discord](#configuração-do-discord)
- [Fluxo de autenticação e permissões](#fluxo-de-autenticação-e-permissões)
- [Fluxo de equipes e solicitações](#fluxo-de-equipes-e-solicitações)
- [Rotas principais](#rotas-principais)
- [Scripts](#scripts)
- [Deploy na Vercel](#deploy-na-vercel)
- [Segurança](#segurança)
- [Solução de problemas](#solução-de-problemas)
- [Checklist de publicação](#checklist-de-publicação)
- [Estrutura do projeto](#estrutura-do-projeto)

## Visão geral

O MadnessArena oferece um fluxo completo para gestão de campeonatos:

- login com Discord (OAuth) usando Supabase Auth
- sincronização de perfil e gamertag Xbox quando disponível
- páginas públicas para eventos, times, chaveamento e ranking
- perfil autenticado para o usuário
- painel administrativo com operações de evento, partidas e permissões
- ranking recalculado com base nos resultados das partidas

## Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase (Auth, Postgres, RLS, Realtime)
- Vercel (deploy recomendado)

## Funcionalidades

### Área pública

- listagem de eventos
- detalhes de evento
- chaveamento por evento
- ranking geral
- listagem e detalhes de times

### Área autenticada

- login/logout com Discord
- página de perfil em /profile/me
- criação e gerenciamento de equipes
- solicitações de entrada em equipes com aprovação do capitão
- inscrição de time em eventos

### Área administrativa

- criação, edição e exclusão de eventos
- atualização de resultados de partidas
- gerenciamento de times
- promoção de usuários para admin

## Pré-requisitos

Antes de começar:

- Node.js 20+
- npm 10+
- projeto no Supabase
- app OAuth2 no Discord Developer Portal
- conta na Vercel (para deploy)

## Configuração rápida

1. Instale dependências:

```bash
npm install
```

2. Crie o arquivo local de ambiente:

```bash
cp .env.example .env.local
```

3. Configure as variáveis obrigatórias no .env.local.

4. Aplique o schema SQL em [supabase/schema.sql](supabase/schema.sql).

5. Execute a aplicação:

```bash
npm run dev
```

6. Acesse:

```text
http://localhost:3000
```

## Variáveis de ambiente

Use [.env.example](.env.example) como referência.

### Aplicação

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| NEXT_PUBLIC_APP_URL | Sim | URL pública da aplicação. Ex.: http://localhost:3000 ou https://seu-projeto.vercel.app |
| OWNER_DISCORD_ID | Sim | Discord ID do proprietário. Esse usuário é promovido automaticamente para role admin no login |

### Supabase

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | Sim | URL do projeto Supabase |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Sim | Chave pública anon utilizada pelo frontend |
| SUPABASE_SERVICE_ROLE_KEY | Recomendado | Chave administrativa, deve ficar apenas no servidor |

### Discord

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| DISCORD_CLIENT_ID | Sim | Client ID da aplicação OAuth |
| DISCORD_CLIENT_SECRET | Sim | Client Secret da aplicação OAuth |
| DISCORD_REDIRECT_URI | Sim | URI de callback (dev/prod) |
| DISCORD_BOT_USER_ID | Não | Reserva para integração futura com bot |
| DISCORD_GUILD_ID | Não | Reserva para integração futura com guild |
| DISCORD_BOT_TOKEN | Não | Reserva para integração futura com bot |

### Ranking

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| MATCH_POINTS_WIN | Sim | Pontos por vitória (padrão: 3) |
| MATCH_POINTS_DRAW | Sim | Pontos por empate (padrão: 1) |
| MATCH_POINTS_LOSS | Sim | Pontos por derrota (padrão: 0) |

### Vercel

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| VERCEL_PROJECT_PRODUCTION_URL | Não | Domínio principal sem https (ex.: madnessarena.vercel.app) |

## Configuração do Supabase

1. Crie o projeto no painel do Supabase.
2. Em Project Settings > API, copie Project URL e anon public key.
3. No SQL Editor, execute integralmente [supabase/schema.sql](supabase/schema.sql).
4. Em Authentication > Providers, habilite Discord e configure Client ID/Client Secret.
5. Em Authentication > URL Configuration, registre callbacks:

- http://localhost:3000/auth/callback
- https://seu-dominio/auth/callback

## Configuração do Discord

1. No Discord Developer Portal, crie uma aplicação OAuth2.
2. Copie Client ID e Client Secret.
3. Em OAuth2 > Redirects, cadastre:

- http://localhost:3000/auth/callback
- https://seu-dominio/auth/callback

4. Garanta os escopos:

- identify
- email
- connections

O escopo connections é necessário para tentar sincronizar Xbox via endpoint /users/@me/connections.

## Fluxo de autenticação e permissões

### Login e perfil

1. Usuário autentica com Discord.
2. Callback troca código por sessão no Supabase.
3. Sistema faz upsert de profile e tenta sincronizar gamertag Xbox.

Referências:

- [app/auth/callback/route.ts](app/auth/callback/route.ts)
- [lib/auth/profile.ts](lib/auth/profile.ts)
- [lib/auth/discord.ts](lib/auth/discord.ts)

### Papel de admin

- Promoção automática: se discord_id for igual a OWNER_DISCORD_ID.
- Promoção manual: por ação administrativa no painel.

## Fluxo de equipes e solicitações

### Regras de equipes

- cada usuário pode participar de até 3 equipes
- cada equipe pode ter até 10 membros
- o capitão também é registrado em team_members com role captain
- apenas o capitão pode aprovar ou rejeitar solicitações pendentes

### Tabelas envolvidas

- teams: metadados da equipe, capitão e limite de membros
- team_members: vínculo relacional entre usuário e equipe com role captain/member
- team_join_requests: fila de solicitações com status pending, approved ou rejected

### Fluxo da solicitação

1. O jogador acessa /teams/[id] e vê o botão de solicitação apenas se não for capitão nem membro da equipe.
2. O frontend bloqueia a ação quando a equipe já está cheia ou quando o usuário já atingiu o limite de 3 equipes.
3. Ao enviar a solicitação, o servidor valida autenticação, duplicidade, limite de equipes e limite de membros antes de criar o registro.
4. O capitão gerencia a fila no modal de equipe, aprovando ou rejeitando cada pedido.
5. Quando uma solicitação é aprovada, o usuário é inserido em team_members e a solicitação recebe status approved.
6. O próprio jogador pode cancelar uma solicitação pendente na página da equipe.

### Garantias de backend

- RLS restringe leitura, criação e moderação ao usuário correto ou ao capitão correto
- índices e validações evitam solicitações pendentes duplicadas
- server actions repetem as regras críticas mesmo quando o frontend já bloqueou a ação
- rotas relevantes são revalidadas após criar, aprovar, rejeitar ou cancelar solicitações

### Pontos principais no código

- [app/actions/team-requests.ts](app/actions/team-requests.ts)
- [components/join-request-button.tsx](components/join-request-button.tsx)
- [components/join-request-list.tsx](components/join-request-list.tsx)
- [components/manage-team-modal.tsx](components/manage-team-modal.tsx)
- [supabase/schema.sql](supabase/schema.sql)

### Checklist manual sugerido

1. Fazer login com um usuário sem equipe e enviar uma solicitação válida.
2. Confirmar que o botão muda para estado pendente e permite cancelamento.
3. Cancelar a solicitação e verificar se a equipe volta a aceitar novo envio.
4. Entrar como capitão e aprovar uma solicitação pendente.
5. Confirmar que o membro aparece na equipe e que a solicitação sai da fila.
6. Repetir com rejeição e validar histórico de respondidas.
7. Validar bloqueio ao atingir 3 equipes no frontend e no backend.
8. Validar bloqueio ao atingir 10 membros na equipe.

## Rotas principais

### Públicas

- /
- /teams
- /teams/[id]
- /events
- /events/[id]
- /events/[id]/bracket
- /ranking

### Autenticadas

- /auth/login
- /auth/callback
- /profile/me

### Administrativas

- /admin/dashboard

## Scripts

| Comando | Descrição |
| --- | --- |
| npm run dev | Inicia ambiente local |
| npm run build | Gera build de produção |
| npm run start | Inicia app em produção (após build) |
| npm run lint | Executa lint com ESLint |
| npx tsc --noEmit | Valida tipagem TypeScript |

## Deploy na Vercel

### Configuração recomendada

Este projeto inclui [vercel.json](vercel.json) com framework nextjs para evitar configuração incorreta de output.

### Passo a passo

1. Conecte o repositório na Vercel.
2. Em Settings > Environment Variables, replique o .env.example.
3. Verifique em Build and Output Settings:

- Framework Preset: Next.js
- Build Command: npm run build
- Output Directory: vazio

4. Execute o deploy.

### Se aparecer erro de dist

Erro comum:

No Output Directory named dist found after the Build completed.

Correção:

- remova dist do campo Output Directory
- mantenha framework Next.js
- faça novo deploy

## Segurança

### Banco de dados

- RLS habilitado com policies para operações sensíveis
- escrita administrativa protegida em tabelas como events, matches e rankings

### Middleware

- proteção de rotas privadas
- proteção de /admin para usuários com role admin

Referências:

- [middleware.ts](middleware.ts)
- [lib/supabase/middleware.ts](lib/supabase/middleware.ts)

### Imagens remotas permitidas

Definidas em [next.config.ts](next.config.ts):

- cdn.discordapp.com
- images-ext-1.discordapp.net
- images-ext-2.discordapp.net
- **.supabase.co

## Solução de problemas

### Login redireciona e não autentica

Valide se DISCORD_REDIRECT_URI está idêntico no Discord e no Supabase.

### Sessão não persiste

Revise NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e domínio/cookies.

### Acesso negado ao painel admin

Confirme role admin no profile ou correspondência com OWNER_DISCORD_ID.

## Checklist de publicação

- [ ] .env.local preenchido
- [ ] OWNER_DISCORD_ID definido
- [ ] schema aplicado em [supabase/schema.sql](supabase/schema.sql)
- [ ] provider Discord habilitado no Supabase
- [ ] callback OAuth cadastrado em Discord e Supabase
- [ ] variáveis replicadas na Vercel
- [ ] login com Discord validado
- [ ] fluxo de callback em produção validado
- [ ] acesso ao painel admin validado
- [ ] npx tsc --noEmit sem erros

## Estrutura do projeto

- [app](app)
- [components](components)
- [lib](lib)
- [supabase/schema.sql](supabase/schema.sql)
- [.env.example](.env.example)
- [next.config.ts](next.config.ts)
- [vercel.json](vercel.json)
- [vercel.json](vercel.json)
