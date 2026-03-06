# Guia de Segurança da Aplicação (AppSec) 🛡️

Este documento detalha as medidas de segurança implementadas na plataforma **Madness Arena**, garantindo a separação estrita entre Frontend e Backend, proteção de dados e mitigação de vulnerabilidades comuns.

## 1. Separação Frontend / Backend
A aplicação segue uma arquitetura Full-Stack (Express + Vite) onde:
- **Frontend (`/src`):** Responsável apenas pela renderização da UI. Não contém segredos, chaves de API ou lógica de validação crítica.
- **Backend (`/server` e `server.ts`):** Centraliza toda a lógica de negócio, autenticação, autorização e validação de dados.

## 2. Gerenciamento de Segredos (Zero Hardcode)
Nenhuma credencial está presente no código-fonte. Todas as configurações sensíveis são injetadas via variáveis de ambiente (`.env`).
- `DISCORD_CLIENT_SECRET`: Usado exclusivamente no backend para trocar o código OAuth2 por um token.
- `SESSION_SECRET`: Chave criptográfica para assinar os cookies de sessão.
- `ADMIN_DISCORD_ID`: O ID do administrador é validado no servidor, não apenas ocultado no frontend.

## 3. Autenticação e Sessão (Cookies Seguros)
- **HttpOnly & Secure:** O Access Token do Discord **não** é enviado ao cliente nem armazenado no `localStorage` (o que seria vulnerável a XSS). Em vez disso, o backend cria uma sessão e envia um cookie `HttpOnly`, `Secure` (em produção) e `SameSite=Lax/None`.
- **Minimização de Dados:** A rota `/api/auth/me` retorna apenas dados públicos do usuário (ID, username, avatar), omitindo tokens ou dados sensíveis.

## 4. Proteção de API e Rotas (Middlewares)
Localizados em `/server/middleware/`:
- **`isAuthenticated`:** Verifica se a sessão é válida antes de permitir acesso a rotas protegidas (ex: criar equipe, dashboard).
- **`isAdmin`:** Verifica se o `req.user.id` corresponde ao `ADMIN_DISCORD_ID` do `.env`. Impede que usuários comuns acessem rotas administrativas, mesmo que descubram a URL.

## 5. Rate Limiting (Prevenção de DDoS e Brute-Force)
Utilizamos `express-rate-limit` para proteger os endpoints:
- **Global (`apiLimiter`):** Limita a 100 requisições a cada 15 minutos por IP.
- **Autenticação (`authLimiter`):** Limite mais estrito (20 requisições/15 min) nas rotas de login/callback para prevenir ataques de força bruta.

## 6. Validação e Sanitização de Entrada (Zod)
Todas as entradas do usuário (ex: criação de equipes em `/server/routes/teams.ts`) são validadas usando a biblioteca `zod`.
- Garante tipos corretos (strings, enums, arrays).
- Remove espaços em branco (`trim()`).
- Aplica Regex para evitar caracteres maliciosos em nomes.
- **Prevenção de SQLi/NoSQLi:** Dados validados estão prontos para serem inseridos em Prepared Statements ou ORMs.

## 7. Prevenção de IDOR (Insecure Direct Object Reference)
Nas rotas de edição e exclusão de equipes (`PUT /api/teams/:id`, `DELETE /api/teams/:id`), o backend verifica explicitamente se o `req.user.id` (usuário logado) é igual ao `ownerId` da equipe no banco de dados.
- Um usuário não pode editar a equipe de outro apenas alterando o ID na requisição HTTP.

## 8. Segurança de Infraestrutura (Helmet & CORS)
- **Helmet:** Adiciona headers de segurança HTTP (ex: `Strict-Transport-Security`, `X-Content-Type-Options`).
- **Content Security Policy (CSP):** Configurado via Helmet para restringir de onde scripts, estilos e imagens podem ser carregados, mitigando ataques XSS.
- **CORS Restrito:** A API aceita requisições apenas da origem definida na variável `APP_URL`, rejeitando chamadas de domínios desconhecidos.

## 9. Proteção de Logs e Erros Genéricos
- **Produção Limpa:** Em caso de erro (ex: falha de validação ou erro interno), a API retorna mensagens genéricas (`"Erro interno do servidor"`) em vez de expor stack traces ou queries de banco de dados.
- **Auditoria:** Ações críticas (login, criação/exclusão de equipes) geram logs de auditoria no console (`[AUDIT] Usuário X fez Y`), sem imprimir dados sensíveis.

## 10. Proteção XSS no Frontend
O React (usado no frontend) automaticamente escapa variáveis renderizadas no JSX, mitigando a grande maioria dos ataques de Cross-Site Scripting (XSS). Não utilizamos `dangerouslySetInnerHTML` com dados não confiáveis.

---
*Este documento deve ser revisado periodicamente conforme novas funcionalidades são adicionadas à plataforma.*
