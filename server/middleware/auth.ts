import { Request, Response, NextFunction } from 'express';

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
 * botões no Frontend. O ID do Admin deve vir de uma variável de ambiente.
 */
export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Não autorizado.' });
  }

  const adminId = process.env.ADMIN_DISCORD_ID;
  
  if (!adminId) {
    console.error('CRITICAL: ADMIN_DISCORD_ID não configurado no .env');
    return res.status(500).json({ error: 'Erro de configuração do servidor.' });
  }

  if (req.user.id !== adminId) {
    // Segurança: Retorna 403 Forbidden. O usuário está logado, mas não tem permissão.
    // Log de auditoria pode ser adicionado aqui: console.warn(`Tentativa de acesso admin negada para usuário ${req.user.id}`);
    return res.status(403).json({ error: 'Acesso negado. Privilégios insuficientes.' });
  }

  next();
};
