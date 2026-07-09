ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS reminder_email TEXT,
  ADD COLUMN IF NOT EXISTS reminder_email_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_email_verification_code TEXT,
  ADD COLUMN IF NOT EXISTS reminder_email_verification_sent_at TIMESTAMPTZ;