CREATE TYPE public.course_mode AS ENUM ('campus', 'distans');

ALTER TABLE public.courses
  ADD COLUMN mode public.course_mode NOT NULL DEFAULT 'campus';