-- ============================================================================
-- CRITICAL: remove blanket public ALL policies.
-- Four tables currently allow anon INSERT/UPDATE/DELETE via USING(true).
-- The anon key ships in the public JS bundle, so this is open to the internet.
--
-- Model: anon may READ display data and INSERT submissions. Nothing else.
-- Admin runs server-side on the service-role key, which bypasses RLS entirely
-- and therefore needs no policies at all.
--
-- Run AFTER the server-side admin refactor is deployed (it is).
-- ============================================================================

BEGIN;

-- --- p100_players: read-only for the public --------------------------------
DROP POLICY IF EXISTS "allp100playertable" ON public.p100_players;
-- keeps: "Allow public read access to p100_players" (SELECT, true)

-- --- killers: read-only for the public -------------------------------------
DROP POLICY IF EXISTS "all"    ON public.killers;
DROP POLICY IF EXISTS "INSERT" ON public.killers;
-- keeps: "Killers are viewable by everyone" + "Service role can modify killers"

-- --- artists: read-only for the public -------------------------------------
DROP POLICY IF EXISTS "dev_allow_all" ON public.artists;
-- keeps: "Artists are viewable by everyone"

-- --- p100_submissions: INSERT + SELECT only --------------------------------
-- The blanket policy is the only thing granting SELECT today, so both
-- replacements must be created in the same transaction as the drop.
DROP POLICY IF EXISTS "all" ON public.p100_submissions;

CREATE POLICY "public_insert" ON public.p100_submissions
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "public_read" ON public.p100_submissions
  FOR SELECT TO anon, authenticated USING (true);
-- deliberately NO update/delete: those let anyone edit or delete
-- another person's submission.

COMMIT;

-- --- verify -----------------------------------------------------------------
SELECT tablename, policyname, cmd, roles, qual AS using_expr, with_check
FROM pg_policies WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;
