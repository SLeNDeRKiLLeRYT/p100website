-- Migration: Add missing background_credit fields to killers table if not present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'killers' AND column_name = 'background_credit_name' AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.killers ADD COLUMN background_credit_name TEXT;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'killers' AND column_name = 'background_credit_url' AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.killers ADD COLUMN background_credit_url TEXT;
    END IF;
END $$;

-- Migration: Add missing background_credit fields to survivors table if not present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'survivors' AND column_name = 'background_credit_name' AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.survivors ADD COLUMN background_credit_name TEXT;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'survivors' AND column_name = 'background_credit_url' AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.survivors ADD COLUMN background_credit_url TEXT;
    END IF;
END $$;

-- Ensure RLS is enabled and service role can update
ALTER TABLE public.killers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survivors ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'killers' AND policyname = 'Service role can modify killers'
    ) THEN
        EXECUTE 'CREATE POLICY "Service role can modify killers" ON public.killers FOR ALL USING (auth.role() = ''service_role'')';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'survivors' AND policyname = 'Service role can modify survivors'
    ) THEN
        EXECUTE 'CREATE POLICY "Service role can modify survivors" ON public.survivors FOR ALL USING (auth.role() = ''service_role'')';
    END IF;
END $$;
