CREATE TABLE public.notification_states (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key text NOT NULL,
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_states TO authenticated;
GRANT ALL ON public.notification_states TO service_role;
ALTER TABLE public.notification_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notification states" ON public.notification_states FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
ALTER TABLE public.user_settings
  ADD COLUMN notif_categories jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN google_last_sync_at timestamptz,
  ADD COLUMN google_last_sync_error text;