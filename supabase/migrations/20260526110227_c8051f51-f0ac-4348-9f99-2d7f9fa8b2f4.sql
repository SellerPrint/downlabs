
CREATE TABLE public.apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  publisher TEXT,
  category TEXT,
  description TEXT,
  icon_url TEXT,
  version TEXT,
  rating NUMERIC(3,2),
  downloads_count TEXT,
  size TEXT,
  uptodown_url TEXT NOT NULL UNIQUE,
  download_url TEXT,
  screenshots JSONB DEFAULT '[]'::jsonb,
  platform TEXT DEFAULT 'android',
  last_scraped_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_apps_category ON public.apps(category);
CREATE INDEX idx_apps_name ON public.apps USING gin(to_tsvector('simple', name));

ALTER TABLE public.apps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Apps are publicly readable"
ON public.apps FOR SELECT
USING (true);

CREATE TABLE public.scrape_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  apps_found INT DEFAULT 0,
  apps_inserted INT DEFAULT 0,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);

ALTER TABLE public.scrape_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Scrape jobs are publicly readable"
ON public.scrape_jobs FOR SELECT
USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_apps_updated_at
BEFORE UPDATE ON public.apps
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
