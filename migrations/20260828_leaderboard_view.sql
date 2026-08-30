-- ============================================================================
-- HALL OF FAME LEADERBOARD — aggregate view (invoice item 10)
--
-- Ranking rules agreed with SLeNDeR_KiLLeR:
--   * ordered by number of P100s, highest first
--   * ties share a rank and are listed alphabetically
--     e.g. two players on 20 P100s are BOTH 14th, and the next is 16th
--     (that is exactly what rank() does; dense_rank() would give 15th)
--   * the creator is NOT excluded here — she has her own showcase, so the
--     exclusion is done in the app where it can be changed without a migration
-- ============================================================================

CREATE OR REPLACE VIEW public.v_p100_leaderboard AS
SELECT
  username,
  count(*)::int                                   AS p100_count,
  rank() OVER (ORDER BY count(*) DESC)::int       AS rank,
  min(added_at)                                   AS first_added_at
FROM public.p100_players
WHERE username IS NOT NULL AND btrim(username) <> ''
GROUP BY username;

-- The view runs with owner rights, so it is readable by anon without needing
-- policies on p100_players beyond the public SELECT it already has.
GRANT SELECT ON public.v_p100_leaderboard TO anon, authenticated;

-- Counting 98 characters across every player is cheap, but this keeps the
-- group-by off a sequential scan as the table grows.
CREATE INDEX IF NOT EXISTS idx_p100_players_username ON public.p100_players (username);

-- --- sanity check -----------------------------------------------------------
-- Expect: rank 1 at the top, ties sharing a number, next rank skipping.
SELECT rank, username, p100_count
FROM public.v_p100_leaderboard
ORDER BY rank ASC, lower(username) ASC
LIMIT 20;
