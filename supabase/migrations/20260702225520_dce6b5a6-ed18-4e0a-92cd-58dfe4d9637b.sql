
-- =========================
-- universities
-- =========================
CREATE TABLE public.universities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.universities TO authenticated;
GRANT ALL ON public.universities TO service_role;
ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own universities" ON public.universities FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_universities_updated_at BEFORE UPDATE ON public.universities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- user_settings
-- =========================
CREATE TABLE public.user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_year integer NOT NULL DEFAULT 1,
  density text NOT NULL DEFAULT 'comfortable',
  translucent boolean NOT NULL DEFAULT true,
  google_connected boolean NOT NULL DEFAULT false,
  google_calendar_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO service_role;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own settings" ON public.user_settings FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_user_settings_updated_at BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- term_dates
-- =========================
CREATE TYPE public.term_kind AS ENUM ('host', 'var', 'sommar');

CREATE TABLE public.term_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year integer NOT NULL,
  term public.term_kind NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, year, term)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.term_dates TO authenticated;
GRANT ALL ON public.term_dates TO service_role;
ALTER TABLE public.term_dates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own term_dates" ON public.term_dates FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_term_dates_updated_at BEFORE UPDATE ON public.term_dates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- courses — new columns
-- =========================
CREATE TYPE public.course_period AS ENUM ('P1','P2','P3','P4','P5');

ALTER TABLE public.courses
  ADD COLUMN hp numeric(5,1),
  ADD COLUMN period public.course_period,
  ADD COLUMN arskurs integer,
  ADD COLUMN university_id uuid REFERENCES public.universities(id) ON DELETE SET NULL,
  ADD COLUMN weekly_goal_hours numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN literature text,
  ADD COLUMN teacher_name text,
  ADD COLUMN teacher_contact text,
  ADD COLUMN completed boolean NOT NULL DEFAULT false,
  ADD COLUMN final_grade text;

-- =========================
-- course_files (metadata; actual bytes live in storage bucket "course-files")
-- =========================
CREATE TABLE public.course_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_files TO authenticated;
GRANT ALL ON public.course_files TO service_role;
ALTER TABLE public.course_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own course_files" ON public.course_files FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_course_files_course ON public.course_files(course_id);

-- =========================
-- Seed defaults for new users (update handle_new_user)
-- =========================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)));

  INSERT INTO public.user_settings (user_id) VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.universities (user_id, name, sort_order) VALUES
    (NEW.id, 'Kungliga tekniska högskolan', 1),
    (NEW.id, 'Mittuniversitetet', 2),
    (NEW.id, 'Örebro universitet', 3),
    (NEW.id, 'Linnéuniversitetet', 4),
    (NEW.id, 'Stockholms universitet', 5)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- Backfill for the existing user (if any)
INSERT INTO public.user_settings (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.universities (user_id, name, sort_order)
SELECT u.id, x.name, x.sort_order FROM auth.users u
CROSS JOIN (VALUES
  ('Kungliga tekniska högskolan', 1),
  ('Mittuniversitetet', 2),
  ('Örebro universitet', 3),
  ('Linnéuniversitetet', 4),
  ('Stockholms universitet', 5)
) AS x(name, sort_order)
ON CONFLICT DO NOTHING;
