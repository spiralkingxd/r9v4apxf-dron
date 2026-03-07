import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../lib/supabase';

// Extend Express Request to include user
declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: string;
      username: string;
      avatar: string;
      email: string;
    };
  }
}

/**
 * Middleware de Autenticação
 * Segurança: Verifica se o token de sessão (cookie HttpOnly) é válido no Backend.
 * Previne que rotas protegidas sejam acessadas sem autenticação real.
 */
export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.session && req.session.user) {
    req.user = req.session.user;
    return next();
  }
  
  // Segurança: Mensagem genérica e status 401 para evitar enumeração de estado
  res.status(401).json({ error: 'Não autorizado. Faça login para continuar.' });
};

/**
 * Middleware de Autorização Admin
 * Segurança: A verificação do Admin ID ocorre no servidor, não apenas ocultando
 * botões no Frontend. O ID do Admin deve vir de uma variável de ambiente ou do banco de dados.
 */
export const isAdmin = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Não autorizado.' });
  }

  const adminId = process.env.NEXT_PUBLIC_ADMIN_DISCORD_ID;
  
  // 1. Check Env Var (Super Admin)
  if (adminId && req.user.id === adminId) {
    return next();
  }

  // 2. Check Database Roles
  try {
    // We need to find the user by their Discord ID (provider_id)
    // But our users table uses UUID.
    // Wait, req.user.id from session is likely the Discord ID if using custom auth flow, 
    // OR the Supabase UUID if using Supabase Auth.
    // The server.ts shows: req.session.user = { id: string ... }
    // If we are using Supabase Auth on client but custom session on server, we need to be careful.
    // However, the prompt says "Discord OAuth2 via Supabase Auth".
    // If using Supabase Auth, the session usually contains the Access Token.
    // But server.ts uses `cookie-session` and seems to store user info manually.
    
    // Let's assume req.user.id is the Discord ID for now based on `NEXT_PUBLIC_ADMIN_DISCORD_ID` check.
    // If so, we need to find the user in `users` table by `discord_id`.
    
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('discord_id', req.user.id)
      .single();

    if (user) {
      const { data: roleData } = await supabaseAdmin
        .from('admin_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (roleData && ['super_admin', 'admin', 'moderator'].includes(roleData.role)) {
        return next();
      }
    }
    
    // Also check if req.user.id is the UUID (in case session stores UUID)
    const { data: roleDataUUID } = await supabaseAdmin
      .from('admin_roles')
      .select('role')
      .eq('user_id', req.user.id)
      .single();

    if (roleDataUUID && ['super_admin', 'admin', 'moderator'].includes(roleDataUUID.role)) {
      return next();
    }

  } catch (error) {
    console.error('Error checking admin role:', error);
  }

  // Segurança: Retorna 403 Forbidden. O usuário está logado, mas não tem permissão.
  return res.status(403).json({ error: 'Acesso negado. Privilégios insuficientes.' });
};
