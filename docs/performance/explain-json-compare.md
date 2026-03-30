# Explain JSON Compare

## Objetivo
Comparar `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` antes/depois das otimizações com tabela automática.

## 1) Coletar `before.json`
No SQL Editor da Supabase (homolog), rode cada query com:

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT ...;
```

Copie cada resultado e salve em um array JSON:

```json
[
  { "QUERY PLAN": [ { "Plan": {}, "Planning Time": 0.1, "Execution Time": 1.2 } ] },
  { "QUERY PLAN": [ { "Plan": {}, "Planning Time": 0.2, "Execution Time": 2.3 } ] }
]
```

Salve como `before.json`.

## 2) Coletar `after.json`
Depois de aplicar migration/otimizações, rode as mesmas queries e salve no mesmo formato em `after.json`.

## 3) Gerar comparação

```bash
npm run perf:compare -- before.json after.json
```

Saída: tabela Markdown com deltas de:
- `Execution Time`
- `Planning Time`
- quantidade de `Seq Scan`
- quantidade de `Index Scan / Bitmap Index Scan`

## 3.1) Gerar relatório em arquivo (com templates do projeto)

```bash
npm run perf:report
```

Saída em:
- `docs/performance/report.md`

## 4) Critério rápido de sucesso
- `Execution Time` menor na maioria das queries críticas.
- Redução de `Seq Scan` em buscas textuais/listagens principais.
- Aumento de `Index Scan` após criação de índices.
