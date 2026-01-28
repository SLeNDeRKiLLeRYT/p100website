-- Create a table to store blacklisted users
CREATE TABLE IF NOT EXISTS public.blacklisted_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  reason TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for security
ALTER TABLE public.blacklisted_users ENABLE ROW LEVEL SECURITY;

-- Allow admin (service role) to insert, delete, and select
CREATE POLICY "Service role can manage blacklist"
  ON public.blacklisted_users FOR ALL
  USING (auth.role() = 'service_role');

-- Allow all users to select (optional, for public viewing)
CREATE POLICY "Blacklist is viewable by everyone"
  ON public.blacklisted_users FOR SELECT
  USING (true);
