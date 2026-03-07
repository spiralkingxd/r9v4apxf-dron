# Madness Arena 🏴‍☠️ (Supabase + React + Vite)

Plataforma web de gerenciamento de torneios PvP para o jogo "Sea of Thieves". Arquitetura modernizada para utilizar **Supabase** (Backend/DB/Auth) e **Vercel** (Frontend/Deploy).

## ⚓ Funcionalidades Atuais

- **Nautical Dark Mode:** Interface imersiva com tema pirata, texturas sutis e paleta de cores oceano/ouro.
- **Modo de Demonstração (Mock Mode):** Permite testar a interface e funcionalidades administrativas sem conexão com banco de dados.
- **Autenticação Discord:** Login seguro utilizando OAuth2 do Discord integrado ao Supabase Auth (simulado no modo demo).
- **Gestão de Equipes:** Registro de tripulações com gamertags e tipo de navio.
- **Calendário de Eventos:** Acompanhamento de próximos torneios e regras.
- **Chaveamento (Brackets):** Visualização em tempo real do progresso do torneio.
- **Ranking Global (Leaderboard):** Tabela classificatória com as melhores equipes da temporada.
- **Painéis Exclusivos:**
  - **User Dashboard:** Para jogadores gerenciarem suas equipes e histórico.
  - **Admin Dashboard:** Acesso restrito para gerenciamento de torneios.

---

## 🛠️ Configuração Rápida

### 1. Variáveis de Ambiente (.env)

Para conectar com o Supabase real, renomeie o arquivo `.env.example` para `.env` e preencha as variáveis:

```env
VITE_SUPABASE_URL=sua_url_do_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anonima
```

> **Nota:** Se estas variáveis não forem configuradas, a aplicação rodará automaticamente em **Modo de Demonstração**, onde o login e os dados são simulados localmente.

### 2. Instalação e Execução

```bash
# Instalar dependências
npm install

# Rodar servidor de desenvolvimento
npm run dev
```

---

## 🗄️ Configuração Supabase (Para Produção)

1. **Criar projeto:** Crie um novo projeto no [Supabase](https://supabase.com).
2. **Configurar Auth:**
   - Habilite o provedor **Discord**.
   - Adicione a URL de callback: `https://<seu-projeto>.supabase.co/auth/v1/callback`
3. **Banco de Dados:**
   - Execute o script de migração em `/supabase/migrations/20260306_final_schema.sql` no SQL Editor do Supabase. Este script já inclui as políticas de segurança (RLS) necessárias para proteger os dados.
   - **Importante:** Verifique se as políticas RLS foram aplicadas corretamente no painel do Supabase (Authentication > Policies).

---

## 🚀 Deploy na Vercel

1. Conecte seu repositório GitHub na Vercel.
2. Nas configurações do projeto (Settings > Environment Variables), adicione:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SESSION_SECRET` (Uma chave secreta para a sessão)
   - `DISCORD_CLIENT_ID`
   - `DISCORD_CLIENT_SECRET`
   - `APP_URL` (A URL da sua aplicação no Vercel)
3. O deploy será feito automaticamente.

---

## 🛡️ Segurança

- **Row Level Security (RLS):** O acesso aos dados é controlado diretamente no banco de dados.
- **Modo Mock Seguro:** O modo de demonstração roda inteiramente no navegador e não expõe dados sensíveis.

