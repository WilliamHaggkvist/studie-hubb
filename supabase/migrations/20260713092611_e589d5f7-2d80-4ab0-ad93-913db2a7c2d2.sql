ALTER TABLE public.tasks ADD COLUMN parent_id UUID NULL REFERENCES public.tasks(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS tasks_parent_id_idx ON public.tasks(parent_id);

CREATE OR REPLACE FUNCTION public.tasks_enforce_single_level_nesting()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.tasks WHERE id = NEW.parent_id AND parent_id IS NOT NULL) THEN
      RAISE EXCEPTION 'Cannot nest tasks more than one level deep';
    END IF;
    IF EXISTS (SELECT 1 FROM public.tasks WHERE parent_id = NEW.id) THEN
      RAISE EXCEPTION 'Cannot set parent_id on a task that already has children';
    END IF;
    IF NEW.parent_id = NEW.id THEN
      RAISE EXCEPTION 'Task cannot be its own parent';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_enforce_single_level_nesting_trg ON public.tasks;
CREATE TRIGGER tasks_enforce_single_level_nesting_trg
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tasks_enforce_single_level_nesting();