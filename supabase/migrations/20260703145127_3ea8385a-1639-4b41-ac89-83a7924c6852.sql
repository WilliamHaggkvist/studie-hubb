CREATE TABLE public.google_calendar_prefs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  google_calendar_id TEXT NOT NULL,
  name TEXT NOT NULL,
  background_color TEXT,
  sync_enabled BOOLEAN NOT NULL DEFAULT false,
  counts_as_study BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, google_calendar_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_calendar_prefs TO authenticated;
GRANT ALL ON public.google_calendar_prefs TO service_role;

ALTER TABLE public.google_calendar_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own google calendar prefs"
  ON public.google_calendar_prefs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_google_calendar_prefs_updated_at
  BEFORE UPDATE ON public.google_calendar_prefs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
