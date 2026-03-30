# Streamers `/streamers` - Guia de Produção

## 1) Banco
Execute:
- `supabase/schema.sql`
- `supabase/supabase_streamers_schema.sql`
- `supabase/community_streamers_schema.sql`

## 2) Variáveis de ambiente
Defina no Vercel:
- `TWITCH_CLIENT_ID`
- `TWITCH_CLIENT_SECRET`
- `TWITCH_EVENTSUB_SECRET`
- `STREAMERS_CRON_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`

## 3) Nova página
- Rota: `/streamers`
- Backend usa função SQL `public.get_madnessarena_streamers(...)`
- Filtro principal é garantido no SQL (`slug = 'madnessarena'`)

## 4) Sync automático de status online
- Cron endpoint: `GET /api/cron/streamers-sync`
- Header obrigatório:
  - `Authorization: Bearer <STREAMERS_CRON_SECRET>`
- Recomendações:
  - cron a cada 2-5 min
  - manter `revalidate = 60` na página para leitura rápida

## 5) Webhook Twitch EventSub
- Endpoint: `POST /api/twitch/eventsub`
- Implementado:
  - verificação HMAC de assinatura
  - challenge response
  - eventos `stream.online` e `stream.offline`

### 5.1) Registro automático de subscriptions
- Endpoint: `POST /api/twitch/eventsub/register`
- Header obrigatório:
  - `Authorization: Bearer <STREAMERS_CRON_SECRET>`
- O endpoint cria subscriptions `stream.online` e `stream.offline` para streamers Twitch ativos com `twitch_id`.
- Callback:
  - usa `TWITCH_EVENTSUB_WEBHOOK_URL` se definido
  - senão usa `NEXT_PUBLIC_APP_URL + /api/twitch/eventsub`

## 6) Ordem recomendada de entrega
1. Aplicar SQL
2. Cadastrar tags e vincular streamers (`madnessarena` obrigatório)
3. Validar `/streamers` e filtros
4. Configurar cron
5. Registrar subscriptions EventSub (`/api/twitch/eventsub/register`)
6. Configurar webhook EventSub
7. Monitorar logs de sync/webhook nas primeiras 24h
