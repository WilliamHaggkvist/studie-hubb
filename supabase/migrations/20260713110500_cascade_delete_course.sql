-- Drop old foreign key constraints if they exist
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_course_id_fkey;
ALTER TABLE public.study_sessions DROP CONSTRAINT IF EXISTS study_sessions_course_id_fkey;
ALTER TABLE public.time_entries DROP CONSTRAINT IF EXISTS time_entries_course_id_fkey;
ALTER TABLE public.calendar_events DROP CONSTRAINT IF EXISTS calendar_events_course_id_fkey;

-- Re-create them with ON DELETE CASCADE
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_course_id_fkey
  FOREIGN KEY (course_id)
  REFERENCES public.courses(id)
  ON DELETE CASCADE;

ALTER TABLE public.study_sessions
  ADD CONSTRAINT study_sessions_course_id_fkey
  FOREIGN KEY (course_id)
  REFERENCES public.courses(id)
  ON DELETE CASCADE;

ALTER TABLE public.time_entries
  ADD CONSTRAINT time_entries_course_id_fkey
  FOREIGN KEY (course_id)
  REFERENCES public.courses(id)
  ON DELETE CASCADE;

ALTER TABLE public.calendar_events
  ADD CONSTRAINT calendar_events_course_id_fkey
  FOREIGN KEY (course_id)
  REFERENCES public.courses(id)
  ON DELETE CASCADE;
