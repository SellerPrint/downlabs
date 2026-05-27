
-- Tags column
ALTER TABLE public.apps ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_apps_tags ON public.apps USING GIN(tags);

-- Admin write access on apps
GRANT INSERT, UPDATE, DELETE ON public.apps TO authenticated;

DROP POLICY IF EXISTS "Admins can insert apps" ON public.apps;
CREATE POLICY "Admins can insert apps" ON public.apps
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update apps" ON public.apps;
CREATE POLICY "Admins can update apps" ON public.apps
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete apps" ON public.apps;
CREATE POLICY "Admins can delete apps" ON public.apps
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Public bucket for app files (icons, screenshots, APKs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('app-files', 'app-files', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public can read app-files" ON storage.objects;
CREATE POLICY "Public can read app-files" ON storage.objects
  FOR SELECT USING (bucket_id = 'app-files');

DROP POLICY IF EXISTS "Admins can upload app-files" ON storage.objects;
CREATE POLICY "Admins can upload app-files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'app-files' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update app-files" ON storage.objects;
CREATE POLICY "Admins can update app-files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'app-files' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete app-files" ON storage.objects;
CREATE POLICY "Admins can delete app-files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'app-files' AND public.has_role(auth.uid(), 'admin'));
