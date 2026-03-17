# Checklist BFF + RLS (Madness Arena)

Status atual para endurecimento de segurança (Zero Trust):

## 1) BFF / Server Actions

- [x] Operações administrativas sensíveis executadas no servidor (Server Actions).
- [x] `createAdminClient` protegido para uso exclusivo server-side.
- [x] Páginas públicas principais migradas para cliente público (`anon`) server-side:
  - `/` (home)
  - `/events`
  - `/ranking`
  - `/teams`
- [x] Ações de streamers exigem `assertAdminAccess()` explicitamente.
- [ ] Revisar módulos restantes para garantir que toda escrita sensível passe por `assertAdminAccess()` ou `assertOwnerAccess()`.

## 2) Segredos e Build Runtime

- [x] Removido fallback hardcoded de owner.
- [x] Removido fallback hardcoded de credenciais do painel bot.
- [x] Scan no CI com Gitleaks.
- [x] Hook local pre-commit com Gitleaks.
- [x] Scan pós-build de bundle (`scripts/check-secrets.js`).
- [ ] Rotação periódica de `SUPABASE_SERVICE_ROLE_KEY` e segredos OAuth.

## 3) RLS (Banco)

- [x] Tabela `rules_content` com SELECT público + escrita admin via policy.
- [x] Tabela `streamers` com SELECT público + escrita admin via policy (migração 02).
- [ ] Confirmar RLS habilitado em todas as tabelas que recebem escrita do app.
- [ ] Auditar policies com foco em:
  - `USING` e `WITH CHECK` coerentes
  - ausência de policy permissiva sem filtro
  - tabelas públicas somente leitura quando necessário

## 4) Claims / RBAC avançado

- [ ] Planejar custom claims no JWT (`role`, `tenant_id`, `permissions`).
- [ ] Migrar políticas críticas para usar `auth.jwt()` quando aplicável.

## 5) Auditoria contínua

- [ ] Rodar varredura ofensiva trimestral (red team prompt).
- [ ] Monitorar logs de `admin_action_logs` e falhas de autenticação.

---

## SQL de auditoria rápida de RLS

```sql
-- Tabelas sem RLS
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and rowsecurity = false
order by tablename;

-- Policies por tabela
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

## Observação

Mesmo com BFF e Server Actions, o controle final de acesso deve continuar no banco via RLS + policies.
