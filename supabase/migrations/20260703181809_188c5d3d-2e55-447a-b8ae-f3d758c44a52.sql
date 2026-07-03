
-- Flytta calendar_events (counts_as_study=true) från Google till study_sessions som inkorgs-pass
INSERT INTO public.study_sessions
  (user_id, course_id, planned_start, planned_end, notes, source, google_event_id, needs_review)
SELECT
  ce.user_id,
  ce.course_id,
  ce.starts_at,
  ce.ends_at,
  ce.title,
  'google',
  ce.external_id,
  true
FROM public.calendar_events ce
WHERE ce.counts_as_study = true
  AND ce.source = 'google'
  AND NOT EXISTS (
    SELECT 1 FROM public.study_sessions ss
    WHERE ss.google_event_id = ce.external_id
  );

-- Rensa så vi inte dubbelräknar
DELETE FROM public.calendar_events
WHERE counts_as_study = true AND source = 'google';
