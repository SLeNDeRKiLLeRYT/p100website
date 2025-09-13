-- Add favorite field to p100_players table if it doesn't exist
-- This ensures compatibility for existing database instances

DO $$ 
BEGIN
    -- Check if the column exists, if not add it
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'p100_players' 
        AND column_name = 'favorite'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.p100_players 
        ADD COLUMN favorite BOOLEAN DEFAULT false;
        
        -- Update existing records to have favorite = false by default
        UPDATE public.p100_players 
        SET favorite = false 
        WHERE favorite IS NULL;
    END IF;
END $$;
