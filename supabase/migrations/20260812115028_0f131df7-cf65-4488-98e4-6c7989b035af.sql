CREATE TABLE public.course_reporting_modules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  name text NOT NULL,
  hp numeric NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  grade text,
  points text,
  registered_on date,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_reporting_modules TO authenticated;
GRANT ALL ON public.course_reporting_modules TO service_role;

ALTER TABLE public.course_reporting_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own reporting modules"
ON public.course_reporting_modules
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX course_reporting_modules_course_idx ON public.course_reporting_modules(course_id);

CREATE TRIGGER trg_course_reporting_modules_updated
BEFORE UPDATE ON public.course_reporting_modules
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();