-- Add is_super column for partial/contains matching
ALTER TABLE public.blacklisted_users ADD COLUMN IF NOT EXISTS is_super BOOLEAN DEFAULT false;
