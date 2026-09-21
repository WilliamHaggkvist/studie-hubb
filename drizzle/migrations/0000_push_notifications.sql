CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  device_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_success_at timestamptz,
  failure_count integer NOT NULL DEFAULT 0
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users manage own push subscriptions"
ON public.push_subscriptions FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx ON public.push_subscriptions(user_id);

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS push_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS push_deadline_reminders boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_offsets integer[] NOT NULL DEFAULT '{1440,120}'::integer[],
  ADD COLUMN IF NOT EXISTS push_daily_summary boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS push_weekly_summary boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS push_session_reminders boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_session_offset_minutes integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS push_quiet_hours_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS push_quiet_start_hour integer NOT NULL DEFAULT 23,
  ADD COLUMN IF NOT EXISTS push_quiet_end_hour integer NOT NULL DEFAULT 7;