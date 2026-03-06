import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

/**
 * Segurança: Rate Limiting
 * Previne ataques de força bruta e DDoS limitando o número de requisições por IP.
 * O limite geral da API é de 100 requisições a cada 15 minutos.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Limite de 100 requisições por IP
  message: { error: 'Muitas requisições deste IP, tente novamente em 15 minutos.' },
  standardHeaders: true, // Retorna rate limit info nos headers `RateLimit-*`
  legacyHeaders: false, // Desabilita os headers `X-RateLimit-*`
});

/**
 * Segurança: Rate Limiting Estrito para Autenticação
 * Limite mais rigoroso para rotas de login/logout para evitar brute-force.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20, // Apenas 20 tentativas por IP
  message: { error: 'Muitas tentativas de login, tente novamente mais tarde.' },
});

/**
 * Segurança: Helmet
 * Adiciona headers HTTP de segurança (X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security, etc).
 * O CSP (Content Security Policy) é configurado para permitir scripts do próprio domínio e imagens de fontes confiáveis.
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Necessário para React/Vite em dev
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://cdn.discordapp.com", "https://picsum.photos"],
      connectSrc: ["'self'", "https://discord.com"],
    },
  },
  crossOriginEmbedderPolicy: false, // Desabilitado para permitir imagens de terceiros (Discord avatars)
});
