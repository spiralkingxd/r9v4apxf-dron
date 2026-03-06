# Madness Arena 🏴‍☠️ (Supabase + Next.js + Vercel)

Plataforma web de gerenciamento de torneios PvP para o jogo "Sea of Thieves". Arquitetura modernizada para utilizar **Supabase** (Backend/DB/Auth) e **Vercel** (Frontend/Deploy).

## ⚓ Funcionalidades

- **Nautical Dark Mode:** Interface imersiva com tema pirata, texturas sutis e paleta de cores oceano/ouro.
- **Autenticação Discord:** Login seguro utilizando OAuth2 do Discord integrado ao Supabase Auth.
- **Gestão de Equipes:** Registro de tripulações com gamertags e tipo de navio.
- **Calendário de Eventos:** Acompanhamento de próximos torneios e regras.
- **Chaveamento (Brackets):** Visualização em tempo real do progresso do torneio.
- **Ranking Global (Leaderboard):** Tabela classificatória com as melhores equipes da temporada.
- **Painéis Exclusivos:**
  - **User Dashboard:** Para jogadores gerenciarem suas equipes e histórico.
  - **Admin Dashboard:** Acesso restrito via Row Level Security (RLS) no banco de dados.

---

## 🛠️ A. Pré-requisitos

Antes de começar, você precisará ter:
- [Node.js](https://nodejs.org/) (versão 18 ou superior)
- Conta na [Vercel](https://vercel.com)
- Conta no [Supabase](https://supabase.com)
- Aplicação criada no [Discord Developer Portal](https://discord.com/developers/applications)

---

## 🗄️ B. Configuração Supabase

1. **Criar projeto:** Crie um novo projeto no Supabase (escolha uma região próxima, ex: São Paulo).
2. **Configurar Discord OAuth2 Provider:**
   - Vá no Discord Developer Portal e crie uma aplicação.
   - Configure a Redirect URI no Discord: `https://[PROJECT_REF].supabase.co/auth/v1/callback`
   - Copie o **Client ID** e **Client Secret** do Discord.
   - No painel do Supabase, vá em **Authentication > Providers > Discord** e cole as credenciais.
3. **Rodar Migrations SQL:**
   - Vá em **SQL Editor** no painel do Supabase.
   - Copie o conteúdo do arquivo `supabase/migrations/20240306000000_initial_schema.sql` (encontrado na raiz deste projeto) e execute. Isso criará todas as tabelas, RLS policies e triggers de auditoria.
4. **Segurança (RLS):**
   - O script SQL já habilita o Row Level Security (RLS) em todas as tabelas.
   - O Admin (ID `717425697005502534`) já está configurado nas policies para ter acesso total.

---

## 🚀 C. Configuração Vercel

1. **Conectar Repositório:** Conecte seu repositório GitHub na Vercel.
2. **Configurar Variáveis de Ambiente:** No painel da Vercel (Settings > Environment Variables), adicione:
   ```env
   NEXT_PUBLIC_APP_URL=https://sua-url-na-vercel.vercel.app
   NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT_REF].supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=[SUA_ANON_KEY]
   SUPABASE_SERVICE_ROLE_KEY=[SUA_SERVICE_ROLE_KEY]
   NEXT_PUBLIC_ADMIN_DISCORD_ID=717425697005502534
   ```
   *Nota: Nunca exponha a `SUPABASE_SERVICE_ROLE_KEY` no frontend.*
3. **Deploy:** Clique em Deploy. A Vercel cuidará do build automaticamente.

---

## 🎮 D. Configuração Discord Developer Portal

1. Acesse o [Discord Developer Portal](https://discord.com/developers/applications).
2. Clique em **"New Application"** e dê o nome de "Madness Arena".
3. Vá em **"OAuth2" -> "General"**.
4. Em **Redirects**, adicione a URL do seu Supabase:
   `https://[PROJECT_REF].supabase.co/auth/v1/callback`
5. Salve as alterações.
6. Os escopos necessários (`identify`, `email`) já são solicitados automaticamente pelo Supabase Auth.

---

## 💻 E. Testes Locais

1. Clone o repositório e instale as dependências:
   ```bash
   npm install
   ```
2. Copie o arquivo `.env.example` para `.env.local` (ou `.env` se estiver usando Vite):
   ```bash
   cp .env.example .env.local
   ```
3. Preencha as variáveis com os dados do seu projeto Supabase.
4. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

---

## 🛡️ F. Segurança e AppSec

Este projeto foi desenhado com foco em segurança (Zero Trust):
- **Row Level Security (RLS):** O banco de dados rejeita qualquer operação que não obedeça às regras. Mesmo que um usuário mal-intencionado descubra a URL da API, o banco negará a leitura/escrita.
- **Prevenção de IDOR:** As policies do Supabase garantem que `auth.uid()` seja o dono do registro antes de permitir `UPDATE` ou `DELETE`.
- **Admin Verification:** O ID do administrador oficial é validado diretamente no PostgreSQL via RLS (`EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND discord_id = '717425697005502534')`).
- **Audit Logs:** Triggers no banco de dados registram automaticamente quem alterou o quê (tabela `audit_logs`), sem depender do frontend enviar logs.
- **CSP e Headers:** O arquivo `next.config.js` injeta headers de segurança HTTP (XSS Protection, NoSniff, etc).

---

## ❓ G. Troubleshooting

- **Login não funciona (Redireciona para localhost):** Verifique se o *Site URL* no painel do Supabase (Authentication > URL Configuration) está apontando para a sua URL da Vercel.
- **Erro 401/403 ao criar equipe:** Certifique-se de que o RLS está ativado e que o usuário está autenticado.
- **Admin não vê o painel:** Verifique se o seu Discord ID bate exatamente com o configurado nas policies SQL e no `.env`.
