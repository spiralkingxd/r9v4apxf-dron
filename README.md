# Madness Arena 🏴‍☠️

Plataforma web de gerenciamento de torneios PvP para o jogo "Sea of Thieves". Construída com React, TypeScript, Tailwind CSS e integração de login via Discord OAuth2.

## ⚓ Funcionalidades

- **Nautical Dark Mode:** Interface imersiva com tema pirata, texturas sutis e paleta de cores oceano/ouro.
- **Autenticação Discord:** Login seguro utilizando OAuth2 do Discord.
- **Gestão de Equipes:** Registro de tripulações com gamertags e tipo de navio.
- **Calendário de Eventos:** Acompanhamento de próximos torneios e regras.
- **Chaveamento (Brackets):** Visualização em tempo real do progresso do torneio.
- **Ranking Global (Leaderboard):** Tabela classificatória com as melhores equipes da temporada.
- **Painéis Exclusivos:**
  - **User Dashboard:** Para jogadores gerenciarem suas equipes e histórico.
  - **Admin Dashboard:** Acesso restrito para gerenciamento total da plataforma.

## 🛠️ Pré-requisitos

Antes de começar, você precisará ter instalado em sua máquina:
- [Node.js](https://nodejs.org/) (versão 18 ou superior)
- npm, yarn ou pnpm

## 🚀 Instalação e Execução Local

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/seu-usuario/madness-arena.git
   cd madness-arena
   ```

2. **Instale as dependências:**
   ```bash
   npm install
   ```

3. **Configure as Variáveis de Ambiente:**
   Copie o arquivo `.env.example` para `.env` e preencha com suas credenciais (veja o tutorial do Discord abaixo).
   ```bash
   cp .env.example .env
   ```

4. **Inicie o servidor de desenvolvimento:**
   ```bash
   npm run dev
   ```
   A aplicação estará disponível em `http://localhost:3000`.

## 🎮 Tutorial: Configuração do Discord OAuth2

Para que o login com Discord funcione, você precisa criar uma aplicação no portal de desenvolvedores do Discord.

### Passo 1: Criar a Aplicação
1. Acesse o [Discord Developer Portal](https://discord.com/developers/applications).
2. Faça login com sua conta do Discord.
3. Clique no botão **"New Application"** no canto superior direito.
4. Dê o nome de "Madness Arena" (ou o nome que preferir) e concorde com os termos. Clique em **"Create"**.

### Passo 2: Obter Credenciais
1. No menu lateral esquerdo, vá em **"OAuth2"** -> **"General"**.
2. Aqui você encontrará o **Client ID** e o **Client Secret** (clique em "Reset Secret" se for a primeira vez).
3. Copie esses valores e cole no seu arquivo `.env`:
   ```env
   DISCORD_CLIENT_ID="seu_client_id_aqui"
   DISCORD_CLIENT_SECRET="seu_client_secret_aqui"
   ```

### Passo 3: Configurar Redirect URIs
Ainda na página **"OAuth2"** -> **"General"**:
1. Encontre a seção **"Redirects"**.
2. Clique em **"Add Redirect"**.
3. Adicione as seguintes URLs (dependendo do seu ambiente):
   - Para desenvolvimento local: `http://localhost:3000/auth/callback`
   - Para produção (exemplo Vercel): `https://sua-url-de-producao.vercel.app/auth/callback`
4. **IMPORTANTE:** Salve as alterações clicando no botão verde "Save Changes" que aparece na parte inferior da tela.

## 👑 Configuração do Administrador Oficial

O acesso ao Painel Admin é restrito por código (hardcoded) ao ID do Discord do administrador oficial.

1. O ID configurado atualmente é: `717425697005502534`.
2. Para alterar, abra o arquivo `src/context/AuthContext.tsx`.
3. Modifique a constante `ADMIN_ID`:
   ```typescript
   const ADMIN_ID = '717425697005502534'; // Substitua pelo ID desejado
   ```

## 📁 Estrutura de Pastas

```text
madness-arena/
├── public/             # Assets estáticos
├── src/
│   ├── components/     # Componentes reutilizáveis (Layout, etc)
│   ├── context/        # Contextos React (AuthContext)
│   ├── pages/          # Páginas da aplicação (Home, Teams, Admin, etc)
│   ├── App.tsx         # Configuração de Rotas
│   ├── index.css       # Estilos globais (Tailwind + Custom CSS)
│   └── main.tsx        # Ponto de entrada do React
├── server.ts           # Servidor Express (Backend/API/OAuth2)
├── .env.example        # Exemplo de variáveis de ambiente
├── package.json        # Dependências e scripts
└── vite.config.ts      # Configuração do Vite
```

## 🌐 Guia de Deploy (Produção)

A aplicação é Full-Stack (Express + Vite). Para fazer o deploy em plataformas como Vercel ou Render:

### Deploy no Render (Recomendado para Full-Stack Node.js)
1. Crie uma conta no [Render](https://render.com/).
2. Conecte seu repositório GitHub.
3. Crie um novo **"Web Service"**.
4. Configurações:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm run start`
5. Adicione as variáveis de ambiente (`.env`) na aba "Environment" do Render.
   - Não esqueça de atualizar a variável `APP_URL` com a URL fornecida pelo Render.
   - Atualize a Redirect URI no Discord Developer Portal com a nova URL do Render.

---
*Que os ventos sejam favoráveis e seus canhões nunca falhem!* 🏴‍☠️
