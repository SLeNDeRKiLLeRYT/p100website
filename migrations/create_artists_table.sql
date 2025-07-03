-- Create artists table
CREATE TABLE IF NOT EXISTS public.artists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('twitter', 'instagram', 'youtube')),
  slug TEXT GENERATED ALWAYS AS (LOWER(REPLACE(REPLACE(name, ' ', '-'), '_', '-'))) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_artists_name ON public.artists(name);
CREATE INDEX IF NOT EXISTS idx_artists_platform ON public.artists(platform);
CREATE INDEX IF NOT EXISTS idx_artists_slug ON public.artists(slug);

-- Add RLS (Row Level Security) policies
ALTER TABLE public.artists ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Artists are viewable by everyone" 
ON public.artists FOR SELECT 
USING (true);

-- Only authenticated users can insert/update/delete (for admin panel)
CREATE POLICY "Only authenticated users can modify artists" 
ON public.artists FOR ALL 
USING (auth.role() = 'authenticated');

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_artists_updated_at 
BEFORE UPDATE ON public.artists 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert existing artists data
INSERT INTO public.artists (name, url, platform) VALUES
('Emilu', 'https://x.com/HavesomePotat0', 'twitter'),
('Enigma', 'https://x.com/enigma_system', 'twitter'),
('DECO', 'https://x.com/you_blender3d', 'twitter'),
('Verihihi', 'https://x.com/HiiriVeri', 'twitter'),
('tori si ro', 'https://x.com/tori_si_ro', 'twitter'),
('Vivi', 'https://x.com/vivi_llain', 'twitter'),
('Davood', 'https://x.com/davoodisatwat', 'twitter'),
('CIII', 'https://x.com/C3_laTooth', 'twitter'),
('Polina Butterfly', 'https://x.com/LePapillonPo', 'twitter'),
('RAZZ', 'https://www.instagram.com/razz_pazazz/', 'instagram'),
('あなご', 'https://x.com/yuzukan02', 'twitter'),
('ZozosDarkRoom', 'https://x.com/ZozosDarkRoom', 'twitter'),
('Riversknife', 'https://x.com/riversknife', 'twitter'),
('Horceror', 'https://x.com/horceror', 'twitter'),
('Angelolo', 'https://x.com/angelolooTW', 'twitter'),
('eefernal', 'https://x.com/eefernal', 'twitter'),
('ZMPixie', 'https://x.com/zmpixie', 'twitter'),
('SadakosPuppy', 'https://x.com/SadakosPuppy', 'twitter'),
('BUMBLEBI!', 'https://x.com/bumblebi713', 'twitter'),
('Genpac', 'https://x.com/Genn_pacc', 'twitter'),
('koi boi', 'https://x.com/itkoi', 'twitter'),
('Rohguu', 'https://x.com/Rohguu', 'twitter'),
('Julcanda', 'https://x.com/julcanda', 'twitter'),
('Dessa', 'https://x.com/Dessa_nya', 'twitter'),
('YM', 'https://x.com/_kabo66', 'twitter'),
('AKA', 'https://x.com/akanothere', 'twitter'),
('DATA', 'https://x.com/data_key00', 'twitter'),
('Luds', 'https://x.com/SplendidSneb', 'twitter'),
('Esskay', 'https://x.com/EsskayAU', 'twitter'),
('Diet Soda', 'https://x.com/diet_soda13', 'twitter'),
('FeverDBD', 'https://x.com/FeverDBD', 'twitter'),
('Kayaya', 'https://x.com/kayadesu_yo', 'twitter'),
('YoCyanide', 'https://x.com/YoCyanide_', 'twitter'),
('YoichiBear', 'https://x.com/yoichibear', 'twitter'),
('Kingsleykys', 'https://x.com/kingsleykys', 'twitter'),
('RatLivers', 'https://x.com/RatLivers', 'twitter'),
('Bubba Dreemurr', 'https://x.com/BubbaDreemurr/media', 'twitter'),
('Shaggy', 'https://x.com/HaddieTh3Baddie', 'twitter'),
('RaspberryRipley', 'https://www.instagram.com/RaspberryRipley/', 'instagram'),
('AVA', 'https://youtube.com/@cupidbirds?si=6j71WgiOg6sJJRyJ', 'youtube')
ON CONFLICT (name) DO NOTHING;
