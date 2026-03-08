# Madness Arena 🏴‍☠️ (Supabase + React + Express)

Plataforma web completa para gerenciamento de torneios PvP no jogo "Sea of Thieves". Esta aplicação utiliza uma arquitetura moderna com **React (Vite)** no frontend e **Express** no backend, integrados ao **Supabase** para autenticação e banco de dados.

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

---

## 🚀 Configuração do Ambiente

### 1. Pré-requisitos
- Node.js 18+
- Conta no [Supabase](https://supabase.com)
- Aplicação criada no [Discord Developer Portal](https://discord.com/developers/applications)

### 2. Variáveis de Ambiente (.env)

Crie um arquivo `.env` na raiz do projeto com as seguintes chaves:

```env
# Frontend (Vite)
VITE_SUPABASE_URL=sua_url_do_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anonima_publica
VITE_ADMIN_DISCORD_ID=seu_discord_id_para_admin

# Backend (Express)
SUPABASE_SERVICE_ROLE_KEY=sua_chave_service_role_secreta
NEXT_PUBLIC_ADMIN_DISCORD_ID=seu_discord_id_para_admin
PORT=3000
```

### 3. Configuração do Supabase

1.  **Crie um novo projeto** no Supabase.
2.  **Autenticação:**
    *   Habilite o provedor **Discord**.
    *   Adicione a URL de callback: `https://<seu-projeto>.supabase.co/auth/v1/callback`
    *   Configure o `Client ID` e `Client Secret` do Discord.
3.  **Banco de Dados:**
    *   Acesse o **SQL Editor** no painel do Supabase.
    *   Copie e execute o conteúdo do arquivo `/supabase/migrations/20260307_full_schema.sql`.
    *   Isso criará todas as tabelas (profiles, teams, invites, etc.) e configurará as políticas de segurança (RLS).

### 4. Instalação e Execução

```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento (Frontend + Backend)
npm run dev
```

O servidor iniciará em `http://localhost:3000`.

---

## 📂 Estrutura do Projeto

- `/src`: Código fonte do Frontend (React).
  - `/components`: Componentes reutilizáveis (UI, Teams, Auth).
  - `/pages`: Páginas da aplicação (Dashboard, Home, Admin).
  - `/services`: Integração com API Backend.
  - `/context`: Contexto de Autenticação.
- `/server`: Código fonte do Backend (Express).
  - `/routes`: Rotas da API (Auth, Teams, Invites).
  - `/middleware`: Middlewares de autenticação e validação.
- `/supabase`: Arquivos de migração do banco de dados.

---

## 🛡️ Segurança

- **Row Level Security (RLS):** Todas as tabelas do banco de dados são protegidas por políticas RLS, garantindo que usuários só acessem dados permitidos.
- **Validação no Backend:** Todas as entradas de dados são validadas com `Zod` no backend antes de processar.
- **HttpOnly Cookies:** A sessão é gerenciada de forma segura.

---

## 📄 Licença

Este projeto é desenvolvido para a comunidade de Sea of Thieves.
