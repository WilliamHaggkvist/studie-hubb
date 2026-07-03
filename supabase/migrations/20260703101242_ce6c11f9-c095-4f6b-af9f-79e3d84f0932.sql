
-- task type enum (alphabetical)
CREATE TYPE public.task_type AS ENUM (
  'annat','inlamningsuppgift','kontrollskrivning','laboration','modul','quiz','redovisning','seminarie','tenta','ovning'
);

ALTER TABLE public.tasks
  ADD COLUMN task_type public.task_type NOT NULL DEFAULT 'annat',
  ADD COLUMN task_kind text NOT NULL DEFAULT 'task' CHECK (task_kind IN ('task','exam')),
  ADD COLUMN grade text,
  ADD COLUMN points text,
  ADD COLUMN pending_review boolean NOT NULL DEFAULT false;

CREATE INDEX idx_tasks_kind ON public.tasks(task_kind);
CREATE INDEX idx_tasks_pending ON public.tasks(pending_review) WHERE pending_review = true;

-- study_sessions
CREATE TABLE public.study_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  planned_start timestamptz NOT NULL,
  planned_end timestamptz NOT NULL,
  actual_start timestamptz,
  actual_end timestamptz,
  notes text,
  source text NOT NULL DEFAULT 'local' CHECK (source IN ('local','google')),
  google_event_id text,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_sessions TO authenticated;
GRANT ALL ON public.study_sessions TO service_role;
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own study sessions" ON public.study_sessions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_study_sessions_user ON public.study_sessions(user_id);
CREATE INDEX idx_study_sessions_course ON public.study_sessions(course_id);
CREATE INDEX idx_study_sessions_start ON public.study_sessions(planned_start);
CREATE TRIGGER trg_study_sessions_updated BEFORE UPDATE ON public.study_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- study_session_tasks (join)
CREATE TABLE public.study_session_tasks (
  session_id uuid NOT NULL REFERENCES public.study_sessions(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, task_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_session_tasks TO authenticated;
GRANT ALL ON public.study_session_tasks TO service_role;
ALTER TABLE public.study_session_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own session tasks" ON public.study_session_tasks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_sst_task ON public.study_session_tasks(task_id);
