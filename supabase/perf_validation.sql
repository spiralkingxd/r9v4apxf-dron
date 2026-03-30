-- Performance validation script (run in homolog/staging)
-- Goal: compare BEFORE vs AFTER migration metrics using EXPLAIN ANALYZE.
--
-- How to use:
-- 1) Run each EXPLAIN block before applying new indexes/RLS updates and save output.
-- 2) Apply migration.
-- 3) Run the same blocks again and compare:
--    - Planning Time
--    - Execution Time
--    - Buffers (shared hit/read)
--    - Scan type (Seq Scan -> Index Scan/Bitmap)

-- Optional (safe in homolog): enable timing in psql
-- \timing on

-- ---------------------------------------------------------------------------
-- Profiles search (global search / user search)
-- ---------------------------------------------------------------------------
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, display_name, username, xbox_gamertag, avatar_url
FROM public.profiles
WHERE lower(display_name) LIKE lower('%mad%')
   OR lower(username) LIKE lower('%mad%')
   OR lower(xbox_gamertag) LIKE lower('%mad%')
LIMIT 15;

-- ---------------------------------------------------------------------------
-- Teams name search
-- ---------------------------------------------------------------------------
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, name, logo_url
FROM public.teams
WHERE lower(name) LIKE lower('%arena%')
LIMIT 15;

-- ---------------------------------------------------------------------------
-- Events search by name/title
-- ---------------------------------------------------------------------------
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, name, title, event_type, banner_url
FROM public.events
WHERE lower(name) LIKE lower('%cup%')
   OR lower(title) LIKE lower('%cup%')
LIMIT 15;

-- ---------------------------------------------------------------------------
-- RLS-heavy path: registrations visible to a captain
-- Replace UUID with a real captain user id in homolog.
-- ---------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

EXPLAIN (ANALYZE, BUFFERS)
SELECT r.id, r.event_id, r.team_id, r.status
FROM public.registrations r
ORDER BY r.created_at DESC
LIMIT 50;

RESET ROLE;

-- ---------------------------------------------------------------------------
-- RLS-heavy path: team notifications for current user/team membership checks
-- Replace UUID with a real member user id in homolog.
-- ---------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);

EXPLAIN (ANALYZE, BUFFERS)
SELECT id, team_id, kind, created_at
FROM public.team_notifications
ORDER BY created_at DESC
LIMIT 50;

RESET ROLE;

