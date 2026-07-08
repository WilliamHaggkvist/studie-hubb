
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS email_reminders_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reminder_offsets integer[] NOT NULL DEFAULT ARRAY[10080,4320,1440,120],
  ADD COLUMN IF NOT EXISTS reminder_fallback_hour integer NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS daily_summary_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS weekly_summary_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Europe/Stockholm';

CREATE TABLE IF NOT EXISTS public.task_reminder_overrides (
  task_id uuid PRIMARY KEY REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  offsets integer[],
  disabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_reminder_overrides TO authenticated;
GRANT ALL ON public.task_reminder_overrides TO service_role;
ALTER TABLE public.task_reminder_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own overrides" ON public.task_reminder_overrides
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_task_reminder_overrides_updated
  BEFORE UPDATE ON public.task_reminder_overrides
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.email_reminders_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  kind text NOT NULL,
  dedupe_key text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, dedupe_key)
);
GRANT SELECT ON public.email_reminders_sent TO authenticated;
GRANT ALL ON public.email_reminders_sent TO service_role;
ALTER TABLE public.email_reminders_sent ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own reminder log" ON public.email_reminders_sent
  FOR SELECT USING (auth.uid() = user_id);
