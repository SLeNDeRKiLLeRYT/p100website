-- ============================================================================
-- VIP SYSTEM (invoice item 13)
--
-- Modelled on blacklisted_users: VIP status belongs to a USERNAME, not to an
-- individual P100 row, so one entry covers every character that player owns
-- and every submission they make in future.
--
--   tier 1 = one star below the name
--   tier 2 = four stars, one per corner
--   tier 3 = four spinning stars + red aura around the name box
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.vip_users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username    varchar NOT NULL,
  tier        smallint NOT NULL DEFAULT 1 CHECK (tier BETWEEN 1 AND 3),
  reason      text,
  created_by  varchar DEFAULT 'admin',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- One VIP entry per player, case-insensitive, so "Grid" and "grid" cannot
-- both be added with different tiers.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_vip_users_username_ci
  ON public.vip_users (lower(username));

ALTER TABLE public.vip_users ENABLE ROW LEVEL SECURITY;

-- Public read: character pages render the badges server-side with the anon
-- key, so the list has to be readable. It is cosmetic and already visible on
-- the site, so nothing is exposed that a visitor cannot see anyway.
DROP POLICY IF EXISTS "public_read" ON public.vip_users;
CREATE POLICY "public_read" ON public.vip_users
  FOR SELECT TO anon, authenticated USING (true);

-- Deliberately NO insert/update/delete policy for anon. The admin panel writes
-- with the service-role key, which bypasses RLS.

-- Keep updated_at honest.
CREATE OR REPLACE FUNCTION public.touch_vip_users_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_vip_users_updated_at ON public.vip_users;
CREATE TRIGGER trg_vip_users_updated_at
  BEFORE UPDATE ON public.vip_users
  FOR EACH ROW EXECUTE FUNCTION public.touch_vip_users_updated_at();

-- --- verify -----------------------------------------------------------------
SELECT tablename, policyname, cmd, roles
FROM pg_policies WHERE schemaname = 'public' AND tablename = 'vip_users';
