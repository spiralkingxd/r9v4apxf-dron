import express from 'express';
import cookieSession from 'cookie-session';
import cookieParser from 'cookie-parser';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import cors from 'cors';

// Import Security Middlewares
import { apiLimiter, authLimiter, securityHeaders } from './server/middleware/security';
import { isAuthenticated, isAdmin } from './server/middleware/auth';

// Import Routes
import teamRoutes from './server/routes/teams';

dotenv.config();

const app = express();
const PORT = 3000;

// Segurança: Trust Proxy (Necessário para Vercel e Rate Limiting)
app.set('trust proxy', 1);

// Segurança: Headers HTTP e CSP (Helmet)
app.use(securityHeaders);

// Segurança: CORS Restrito
// Apenas o domínio do Frontend autorizado pode fazer requisições
const allowedOrigins = process.env.APP_URL ? [process.env.APP_URL, `http://localhost:${PORT}`] : [`http://localhost:${PORT}`];
app.use(cors({
  origin: allowedOrigins,
  credentials: true, // Permite envio de cookies (Sessão)
}));

// Segurança: Rate Limiting Global para API
app.use('/api/', apiLimiter);

// Middleware
app.use(express.json());
app.use(cookieParser());

// Segurança: Armazenamento de Tokens e Sessão
// O token JWT/Access Token do Discord não vai para o localStorage do cliente.
// Ele fica armazenado na sessão do servidor, e o cliente recebe apenas um Cookie HttpOnly.
// Usamos cookie-session para compatibilidade com Serverless (Vercel).
app.use(
  cookieSession({
    name: 'session',
    keys: [process.env.SESSION_SECRET || 'madness_arena_secret_key_123'],
    maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
    secure: process.env.NODE_ENV === 'production', // True em produção (HTTPS obrigatório)
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Strict ou Lax dependendo do fluxo OAuth
    httpOnly: true, // Impede acesso via JavaScript (Mitiga XSS)
  })
);

// Types for session
declare module 'express-serve-static-core' {
  interface Request {
    session?: {
      user?: {
        id: string;
        username: string;
        avatar: string;
        email: string;
      };
      accessToken?: string;
    } | null;
  }
}

// OAuth2 Configuration
// Segurança: Zero Hardcode. Segredos vivem apenas no Backend.
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;
const REDIRECT_URI = `${APP_URL}/auth/callback`;

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Auth URL Endpoint
// Segurança: Rate Limiting Estrito
app.get('/api/auth/url', authLimiter, (req, res) => {
  if (!DISCORD_CLIENT_ID) {
    // Segurança: Erro genérico em produção
    return res.status(500).json({ error: 'Erro de configuração do servidor: DISCORD_CLIENT_ID ausente. Configure as variáveis de ambiente na Vercel.' });
  }

  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'identify email',
  });

  const authUrl = `https://discord.com/api/oauth2/authorize?${params.toString()}`;
  res.json({ url: authUrl });
});

// Auth Callback Endpoint
app.get(['/auth/callback', '/auth/callback/'], authLimiter, async (req, res) => {
  const code = req.query.code as string;

  if (!code) {
    return res.status(400).send('Código de autorização não fornecido');
  }

  try {
    // Exchange code for token
    const tokenResponse = await axios.post(
      'https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id: DISCORD_CLIENT_ID!,
        client_secret: DISCORD_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token } = tokenResponse.data;

    // Get user info
    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const userData = userResponse.data;

    // Segurança: Minimização de Dados
    // Salvamos apenas o necessário na sessão. O Access Token fica no backend.
    req.session = {
      user: {
        id: userData.id,
        username: userData.username,
        avatar: userData.avatar,
        email: userData.email,
      },
      accessToken: access_token
    };

    // Auditoria: Log de Login
    console.log(`[AUDIT] Usuário ${userData.id} (${userData.username}) fez login.`);

    // Send success message to parent window and close popup
    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Autenticação concluída. Esta janela fechará automaticamente.</p>
        </body>
      </html>
    `);
  } catch (error) {
    // Segurança: Proteção de Logs
    // Não logamos o objeto de erro completo que pode conter tokens ou secrets.
    console.error('[SECURITY] Erro no fluxo OAuth2 Discord.');
    res.status(500).send('Falha na autenticação. Tente novamente.');
  }
});

// Get current user
// Segurança: Rota protegida pelo middleware isAuthenticated
app.get('/api/auth/me', isAuthenticated, (req, res) => {
  // Segurança: Retorna apenas os dados públicos do usuário, sem tokens ou senhas
  res.json({ user: req.user });
});

// Logout
app.post('/api/auth/logout', isAuthenticated, (req, res) => {
  const userId = req.user?.id;
  req.session = null;
  res.clearCookie('session');
  console.log(`[AUDIT] Usuário ${userId} fez logout.`);
  res.json({ success: true });
});

// Rotas Modulares
// Segurança: Todas as rotas de equipes passam pela validação e proteção de IDOR
app.use('/api/teams', teamRoutes);

// Exemplo de Rota Admin Protegida
// Segurança: Apenas o Admin real (validado no backend) pode acessar
app.get('/api/admin/stats', isAdmin, (req, res) => {
  res.json({ message: 'Dados sensíveis do painel admin', stats: { users: 1204, teams: 342 } });
});

// Vite Middleware for Development
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Segurança: Produção Limpa
    // Serve arquivos estáticos sem expor stack traces ou ferramentas de dev
    app.use(express.static(path.join(process.cwd(), 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
    });
  }

  // Não iniciar o servidor se estiver rodando no Vercel (Serverless)
  if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

startServer();

export default app;
