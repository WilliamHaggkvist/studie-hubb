-- Migration to add columns for custom reminder email and verification
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS reminder_email text,
  ADD COLUMN IF NOT EXISTS reminder_email_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_email_verification_code text,
  ADD COLUMN IF NOT EXISTS reminder_email_verification_sent_at timestamptz;
