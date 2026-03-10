import express from 'express';
import fs from 'fs';
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
import adminRoutes from './server/routes/admin';
import authRoutes from './server/routes/auth';

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

// Diagnostic Health Endpoint
// Validates all critical environment variables and returns detailed status
app.get('/api/health', (req, res) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sessionSecret = process.env.SESSION_SECRET;
  const appUrl = process.env.APP_URL;
  
  const checks = {
    supabase_url: !!supabaseUrl,
    service_role_key: !!serviceKey,
    session_secret: !!sessionSecret,
    app_url: !!appUrl,
    discord_client_id: !!process.env.DISCORD_CLIENT_ID,
    discord_client_secret: !!process.env.DISCORD_CLIENT_SECRET,
  };

  const allOk = Object.values(checks).every(Boolean);
  
  // If any critical var is missing, return 503 with diagnostic info
  if (!allOk) {
    const missing = Object.entries(checks)
      .filter(([_, ok]) => !ok)
      .map(([key, _]) => key);
    
    return res.status(503).json({
      status: 'degraded',
      message: 'Missing required environment variables',
      missing_vars: missing,
      hint: 'Configure these in Vercel Project Settings > Environment Variables',
      docs_url: 'https://github.com/spiralkingxd/madnessarena/blob/main/.env.example'
    });
  }

  res.json({ status: 'ok', checks });
});

// Safe Route Registration with Error Boundaries
// Wraps route registration to prevent import errors from crashing the server
const registerRoutes = () => {
  try {
    app.use('/api/teams', teamRoutes);
  } catch (err) {
    console.error('[ERROR] Failed to load team routes:', err);
    app.use('/api/teams', (req, res) => res.status(503).json({ error: 'Team service unavailable' }));
  }

  try {
    app.use('/api/admin', adminRoutes);
  } catch (err) {
    console.error('[ERROR] Failed to load admin routes:', err);
    app.use('/api/admin', (req, res) => res.status(503).json({ error: 'Admin service unavailable' }));
  }

  try {
    app.use('/api/auth', authRoutes);
  } catch (err) {
    console.error('[ERROR] Failed to load auth routes:', err);
    app.use('/api/auth', (req, res) => res.status(503).json({ error: 'Auth service unavailable' }));
  }
};

registerRoutes();

// Global Error Handler for API Routes
// Catches Supabase initialization errors and returns diagnostic response
app.use('/api', (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const message = err?.message || 'Internal Server Error';
  
  // Check if error is related to missing Supabase config
  if (message.includes('Missing required environment variables') || message.includes('Supabase')) {
    console.error('Supabase config error:', message);
    return res.status(503).json({
      error: 'Service Unavailable - Configuration Error',
      message: message,
      hint: 'The API server is waiting for environment variables to be configured. Check /api/health for details.'
    });
  }

  console.error('API Error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'An error occurred' : message
  });
});

// Vite Middleware for Development
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
    });
    app.use(vite.middlewares);
    
    // Fallback handler for SPA in dev mode
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        // 1. Read index.html
        let template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        // 2. Apply Vite HTML transforms
        template = await vite.transformIndexHtml(url, template);
        // 3. Send the rendered HTML
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        console.error('Vite SSR Error:', e);
        next(e);
      }
    });
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
