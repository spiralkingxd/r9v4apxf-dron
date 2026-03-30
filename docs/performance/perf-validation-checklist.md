# Performance Validation Checklist

## 1) Banco (Supabase/Postgres)
- Execute [perf_validation.sql](/d:/sav/Madness%20Arena%20-%20Site/r9v4apxf-dron/supabase/perf_validation.sql) antes da migration e salve resultados.
- Aplique a migration com índices + RLS otimizado.
- Execute novamente o mesmo script e compare:
  - `Execution Time` menor.
  - Menos `Seq Scan` em consultas de busca.
  - Mais `Index Scan`/`Bitmap Index Scan`.
  - Menos `shared read` em queries repetidas.

## 2) Frontend/Cache
- Verifique headers públicos no deploy:
  - `/`, `/events`, `/events/[id]`, `/teams`, `/ranking`, `/transmissoes`.
- Esperado: `Cache-Control` com `s-maxage` + `stale-while-revalidate`.

## 3) Imagens
- Validar páginas:
  - `/events/[id]`
  - `/profile/[id]`
- Esperado:
  - Sem layout shift em banner/logo.
  - Menor payload de imagem na aba Network.

## 4) Critério de aprovação
- P95 de consultas de busca/registro em homolog reduzido em pelo menos 20%.
- Sem regressão funcional (busca, listagens, perfil público, evento detalhado).
- Sem erro novo em logs de API/Supabase durante smoke test.

