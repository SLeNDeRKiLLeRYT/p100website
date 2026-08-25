-- ============================================================================
-- P100 WEBSITE — RLS AUDIT + LOCKDOWN
-- Run in Supabase → SQL Editor.
-- Sections 1 and 2 are READ-ONLY. Read their output before running section 3.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. WHICH TABLES HAVE RLS ENABLED?  (read-only)
--    rls_enabled = false on any public table is a hole: the anon key, which is
--    embedded in the public JS bundle by design, can read/write it freely.
-- ---------------------------------------------------------------------------
SELECT
  c.relname                                  AS table_name,
  c.relrowsecurity                           AS rls_enabled,
  c.relforcerowsecurity                      AS rls_forced,
  (SELECT count(*) FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY c.relrowsecurity ASC, c.relname;

-- ---------------------------------------------------------------------------
-- 2. WHAT DO THE EXISTING POLICIES ACTUALLY ALLOW?  (read-only)
--    Watch for: roles containing 'anon' or 'public' on INSERT/UPDATE/DELETE,
--    and any policy whose USING/WITH CHECK is simply "true".
-- ---------------------------------------------------------------------------
SELECT tablename, policyname, cmd, roles, qual AS using_expr, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;

-- ---------------------------------------------------------------------------
-- 3. LOCKDOWN  (writes — review section 1 and 2 output first)
--    Model: the public site reads with the anon key; only the submission form
--    writes, and it writes to exactly one table. Everything else is
--    admin-only, and admin now runs server-side on the secret key, which
--    bypasses RLS entirely — so admin needs no policies at all.
-- ---------------------------------------------------------------------------

ALTER TABLE public.killers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survivors           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.p100_players        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.p100_submissions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artists             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blacklisted_users   ENABLE ROW LEVEL SECURITY;

-- These may not all exist in your project; each is wrapped so the script
-- keeps going if a table is absent.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['artworks','character_artworks','artwork_artist_mappings','artist_artworks']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      RAISE NOTICE 'RLS enabled on %', t;
    ELSE
      RAISE NOTICE 'skipped (no such table): %', t;
    END IF;
  END LOOP;
END $$;

-- --- Public READ on the content the site displays -------------------------
DROP POLICY IF EXISTS "public_read" ON public.killers;
CREATE POLICY "public_read" ON public.killers          FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_read" ON public.survivors;
CREATE POLICY "public_read" ON public.survivors        FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_read" ON public.p100_players;
CREATE POLICY "public_read" ON public.p100_players     FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_read" ON public.artists;
CREATE POLICY "public_read" ON public.artists          FOR SELECT TO anon, authenticated USING (true);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['artworks','character_artworks','artwork_artist_mappings','artist_artworks']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=t) THEN
      EXECUTE format('DROP POLICY IF EXISTS "public_read" ON public.%I', t);
      EXECUTE format(
        'CREATE POLICY "public_read" ON public.%I FOR SELECT TO anon, authenticated USING (true)', t);
    END IF;
  END LOOP;
END $$;

-- --- Submissions: anyone may INSERT, nobody may read/update/delete --------
-- The status page looks submissions up by username; keep that working by
-- allowing SELECT. If you would rather submissions be private, drop the
-- select policy and move the status page onto a server action instead.
DROP POLICY IF EXISTS "public_insert" ON public.p100_submissions;
CREATE POLICY "public_insert" ON public.p100_submissions
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "public_read" ON public.p100_submissions;
CREATE POLICY "public_read" ON public.p100_submissions
  FOR SELECT TO anon, authenticated USING (true);

-- Deliberately NO update/delete policy: the submission page currently deletes
-- its own previous pending rows with the anon key. That stops working here,
-- which is intended — it let anyone delete anyone's submission. Move that
-- delete into the server action that handles the insert.

-- --- Blacklist: no anon access at all ------------------------------------
-- The submission page checks the blacklist from the BROWSER today, so this
-- WILL break that check until it moves server-side. See notes below.
-- !! LEAVE THESE COMMENTED OUT until the blacklist check moves server-side. !!
-- The submission page reads blacklisted_users from the BROWSER with the anon
-- key. Removing anon read makes that check silently FAIL OPEN (blocked users
-- would be able to submit again). Uncomment only after the check has been
-- moved into a server action.
-- DROP POLICY IF EXISTS "public_read" ON public.blacklisted_users;
-- DROP POLICY IF EXISTS "anon_read"   ON public.blacklisted_users;

-- ---------------------------------------------------------------------------
-- 4. RE-RUN SECTION 1 AND 2 TO CONFIRM
-- ---------------------------------------------------------------------------
