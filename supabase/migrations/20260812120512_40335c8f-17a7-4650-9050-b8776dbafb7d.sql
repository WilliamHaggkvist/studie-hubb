CREATE TABLE public.course_reg_enrollments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  arskurs integer,
  periods course_period[] NOT NULL DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_reg_enrollments TO authenticated;
GRANT ALL ON public.course_reg_enrollments TO service_role;

ALTER TABLE public.course_reg_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own course enrollments"
ON public.course_reg_enrollments FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_course_reg_enrollments_course ON public.course_reg_enrollments(course_id);
CREATE INDEX idx_course_reg_enrollments_user ON public.course_reg_enrollments(user_id);

CREATE TRIGGER trg_course_reg_enrollments_updated
BEFORE UPDATE ON public.course_reg_enrollments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.course_reg_enrollments (user_id, course_id, arskurs, periods, sort_order)
SELECT c.user_id, c.id, c.arskurs,
  CASE
    WHEN c.periods IS NOT NULL AND array_length(c.periods, 1) > 0 THEN c.periods
    WHEN c.period IS NOT NULL THEN ARRAY[c.period]::course_period[]
    ELSE '{}'::course_period[]
  END,
  0
FROM public.courses c;