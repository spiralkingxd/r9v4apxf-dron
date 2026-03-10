# Madness Arena 🏴‍☠️ (Supabase + React + Express)

Plataforma web completa para gerenciamento de torneios PvP no jogo "Sea of Thieves". Esta aplicação utiliza uma arquitetura moderna com **React (Vite)** no frontend e **Express** no backend, integrados ao **Supabase** para autenticação e banco de dados.

**Status:** ✅ Production Ready  
**Deploy:** Vercel (Serverless)  
**Database:** Supabase (PostgreSQL + RLS)  
**Authentication:** Discord OAuth2

## ⚓ Funcionalidades Principais

### 👤 Gerenciamento de Perfil
- **Autenticação via Discord:** Login seguro utilizando OAuth2.
- **Sincronização de Dados:** Importação automática de Gamertag do Xbox e Avatar do Discord.
- **Perfil de Jogador:** Visualização de estatísticas e histórico de partidas.

### ⚔️ Gestão de Equipes
- **Criação de Equipes:** Capitães podem criar e gerenciar suas tripulações.
- **Sistema de Convites:** Convide membros pelo Discord ID. Os convidados podem aceitar ou recusar via painel.
- **Gestão de Membros:** Adicionar, remover e transferir a capitania da equipe.
- **Validação de Regras:** Limites de membros e verificações de unicidade de Gamertag.

### 🏆 Torneios e Eventos
- **Calendário de Eventos:** Visualização de próximos torneios.
- **Chaveamento (Brackets):** Acompanhamento visual do progresso do torneio.
- **Ranking Global:** Tabela de classificação das melhores equipes.

### 🛡️ Administração
- **Painel Admin:** Área restrita para organizadores.
- **Moderação:** Banimento de equipes e gerenciamento de usuários.
- **Logs de Auditoria:** Registro de ações críticas no sistema.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend:** React 19, Vite, Tailwind CSS v4, Framer Motion (animações), Lucide React (ícones).
- **Backend:** Node.js, Express, TypeScript.
- **Banco de Dados & Auth:** Supabase (PostgreSQL, Auth, Realtime).
- **Integrações:** Discord API (OAuth2, Connections).
- **Deploy:** Vercel (Edge Functions / Serverless).

---

## 🚀 Quick Start (Desenvolvimento Local)

### 1. Pré-requisitos
- Node.js 18+
- Conta no [Supabase](https://supabase.com)
- Aplicação criada no [Discord Developer Portal](https://discord.com/developers/applications)

### 2. Clonar e Instalar

```bash
git clone https://github.com/spiralkingxd/madnessarena.git
cd madnessarena
npm install
```

### 3. Configurar Variáveis de Ambiente

Copie `.env.example` para `.env`:

```bash
cp .env.example .env
```

Edite `.env` e preencha com seus dados:

```env
# ============================================================
# FRONTEND (Vite) — Acessíveis via import.meta.env.VITE_*
# ============================================================
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anonima-publica
VITE_ADMIN_DISCORD_ID=seu-discord-id-opcional

# ============================================================
# BACKEND (Express / Node.js) — OBRIGATÓRIAS
# ============================================================
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-chave-service-role-secreta
SESSION_SECRET=gere-uma-string-aleatoria-com-openssl-rand-hex-32
APP_URL=http://localhost:3000
DISCORD_CLIENT_ID=seu-discord-client-id
DISCORD_CLIENT_SECRET=seu-discord-client-secret
```

### 4. Configurar Supabase

1. **Crie um novo projeto** no Supabase.

2. **Habilite Autenticação via Discord:**
   - Project Settings → Authentication → Providers → Discord
   - Adicione seu Discord Client ID e Secret
   - Redirect URL: `http://localhost:3000/auth/callback` (local) ou `https://seu-dominio.vercel.app/auth/callback` (produção)

3. **Execute a Migração SQL:**
   - Vá em SQL Editor no painel Supabase
   - Copie o conteúdo de `supabase/migrations/20260309_full_schema_compatible.sql`
   - Cole e execute

4. **Copie as Credenciais:**
   - Project Settings → API → URLs: copie `VITE_SUPABASE_URL`
   - Project Settings → API → Anon public: copie `VITE_SUPABASE_ANON_KEY`
   - Project Settings → API → Service role secret: copie `SUPABASE_SERVICE_ROLE_KEY` (NÃO exponha no frontend!)

### 5. Executar Localmente

```bash
npm run dev
```

Abra `http://localhost:3000`

---

## 🌐 Deploy no Vercel

### Pré-requisitos
- Repositório no GitHub sincronizado
- Conta no [Vercel](https://vercel.com)

### 1. Conectar Repositório

1. Vá em [vercel.com](https://vercel.com/new)
2. Clique em "Import Project"
3. Selecione o repositório GitHub
4. Configure:
   - **Framework Preset:** Other
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`

### 2. Configurar Environment Variables (CRÍTICO ⚠️)

No painel Vercel, vá em **Settings → Environment Variables** e adicione:

| Variável | Valor | Exemplo |
|---|---|---|
| `VITE_SUPABASE_URL` | Copy de Supabase → Settings → API | `https://abc123.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Copy de Supabase → Settings → API (Anon key) | `eyJ0...` |
| `NEXT_PUBLIC_SUPABASE_URL` | Mesma que `VITE_SUPABASE_URL` | `https://abc123.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | **Supabase → Settings → API → Service Role Secret** | `eyJ0...` (SECRETO!) |
| `SESSION_SECRET` | String aleatória | `gere: openssl rand -hex 32` |
| `APP_URL` | Sua URL do Vercel | `https://madnessarena.vercel.app` |
| `DISCORD_CLIENT_ID` | Discord Developer Portal | `12345...` |
| `DISCORD_CLIENT_SECRET` | Discord Developer Portal (SECRETO!) | `abcde...` |
| `VITE_ADMIN_DISCORD_ID` | Seu Discord ID (opcional) | `987654...` |

⚠️ **Importante:** 
- `SUPABASE_SERVICE_ROLE_KEY` e `DISCORD_CLIENT_SECRET` são secretos — **NUNCA** commite no git
- Marque como "Encrypted" no Vercel se disponível
- Variáveis com prefixo `VITE_` também ficam visíveis no frontend (seguro, pois são públicas)

### 3. Deploy

```bash
git push # Vercel detects and auto-deploys
```

Ou clique em "Deploy" no painel Vercel.

---

## 📊 Diagnosticando Problemas

### Verificar Saúde da API

Acesse: `https://seu-dominio.vercel.app/api/health`

**Resposta de sucesso (HTTP 200):**
```json
{
  "status": "ok",
  "checks": {
    "supabase_url": true,
    "service_role_key": true,
    "session_secret": true,
    "app_url": true,
    "discord_client_id": true,
    "discord_client_secret": true
  }
}
```

**Resposta de erro (HTTP 503):**
```json
{
  "status": "degraded",
  "message": "Missing required environment variables",
  "missing_vars": ["SUPABASE_SERVICE_ROLE_KEY", "SESSION_SECRET"],
  "hint": "Configure these in Vercel Project Settings > Environment Variables",
  "docs_url": "https://github.com/spiralkingxd/madnessarena/blob/main/.env.example"
}
```

### Troubleshooting HTTP 500

| Erro | Causa | Solução |
|---|---|---|
| `/api/health` retorna 503 + `missing_vars` | Faltam env vars no Vercel | Adicione em Settings > Environment Variables |
| `GET /api/teams retorna 500` | Supabase não conectado | Verifique `SUPABASE_SERVICE_ROLE_KEY` |
| `POST /auth/discord/sync retorna 500` | Discord token expirado | Tente fazer logout/login novamente |
| `FUNCTION_INVOCATION_FAILED` no Vercel | Server crash ao startup | Veja logs: `vercel logs --follow` |

### Logs em Tempo Real

```bash
# Instalar Vercel CLI
npm install -g vercel

# Ver logs ao vivo
vercel logs --follow

# Ou via dashboard
# Vercel Project > Deployments > Logs
```

---

## 📂 Estrutura do Projeto

```
madnessarena/
├── src/                         # Frontend (React)
│   ├── components/
│   │   ├── admin/               # Componentes do painel admin
│   │   ├── teams/               # Componentes de times
│   │   ├── profile/             # Perfil do usuário
│   │   └── ...
│   ├── pages/                   # Páginas da aplicação
│   ├── services/                # Integração com API
│   ├── context/                 # React Context (Auth)
│   ├── lib/                     # Utilitários
│   └── App.tsx
├── server/                      # Backend (Express)
│   ├── routes/
│   │   ├── auth.ts              # Autenticação + Discord sync
│   │   ├── teams.ts             # CRUD de times + convites
│   │   └── admin.ts             # Endpoints admin
│   ├── middleware/
│   │   ├── auth.ts              # JWT validation + role checks
│   │   └── security.ts          # Rate limiting, headers
│   └── lib/
│       └── supabase.ts          # Cliente Supabase (lazy init)
├── supabase/
│   └── migrations/
│       └── 20260309_full_schema_compatible.sql  # Schema SQL
├── .env.example                 # Template de env vars
├── server.ts                    # Entry point do servidor
├── vite.config.ts               # Configuração Vite
├── vercel.json                  # Configuração Vercel
└── package.json
```

---

## 🔐 Segurança

- **Row Level Security (RLS):** Todas as tabelas do banco de dados são protegidas por políticas RLS, garantindo que usuários só acessem dados permitidos.
- **Validação no Backend:** Todas as entradas de dados são validadas com `Zod` no backend antes de processar.
- **HttpOnly Cookies:** Sessões gerenciadas de forma segura, sem exposição ao JavaScript.
- **Service Role Key Isolation:** A chave de serviço do Supabase é usada **apenas no backend** (nunca exponha no frontend).
- **Environment Variables:** Secretos são injetados via Vercel, não commitados no git.
- **CORS Restrito:** API aceita apenas requisições do domínio autorizado.

---

## 🐛 Contribuindo

Encontrou um bug ou quer adicionar uma feature?

1. Fork o repositório
2. Crie uma branch: `git checkout -b feature/nome-da-feature`
3. Commit suas mudanças: `git commit -m 'Add: descrição'`
4. Push: `git push origin feature/nome-da-feature`
5. Abra um Pull Request

---

## 📄 Licença

Este projeto é desenvolvido para a comunidade de Sea of Thieves.
