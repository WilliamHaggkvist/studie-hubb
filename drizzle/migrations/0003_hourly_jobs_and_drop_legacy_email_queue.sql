DO $$ BEGIN
  PERFORM cron.alter_job((SELECT jobid FROM cron.job WHERE jobname='studiehubb-email-jobs'), schedule := '0 4-21 * * *');
  PERFORM cron.alter_job((SELECT jobid FROM cron.job WHERE jobname='sync-google-calendar-every-15-min'), schedule := '0 4-21 * * *');
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='process-email-queue') THEN
    PERFORM cron.unschedule('process-email-queue');
  END IF;
END $$;
DROP FUNCTION IF EXISTS public.email_queue_dispatch();
DROP FUNCTION IF EXISTS public.read_email_batch(text, integer, integer);
DROP FUNCTION IF EXISTS public.delete_email(text, bigint);
DROP FUNCTION IF EXISTS public.move_to_dlq(text, text, bigint, jsonb);
DROP FUNCTION IF EXISTS public.enqueue_email(text, jsonb);