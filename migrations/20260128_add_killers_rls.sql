-- Enable Row Level Security (RLS) on killers table
ALTER TABLE public.killers ENABLE ROW LEVEL SECURITY;

-- Allow all users to read killers
CREATE POLICY "Killers are viewable by everyone"
  ON public.killers FOR SELECT
  USING (true);

-- Allow service role (admin) to insert, update, and delete
CREATE POLICY "Service role can modify killers"
  ON public.killers FOR ALL
  USING (auth.role() = 'service_role');

-- Optionally, allow authenticated users to modify (uncomment if needed)
-- CREATE POLICY "Authenticated users can modify killers"
--   ON public.killers FOR ALL
--   USING (auth.role() = 'authenticated');

-- (Optional) If you want only admins to modify, keep only the service_role policy above.

-- Note: After running this migration, updates/inserts/deletes from the admin panel using the service role key will work.
