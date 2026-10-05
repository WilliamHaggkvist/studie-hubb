CREATE TABLE IF NOT EXISTS public.csn_periods (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  start_date date NOT NULL,
  end_date date NOT NULL,
  weeks numeric NOT NULL DEFAULT 20,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.csn_periods TO authenticated;
GRANT ALL ON public.csn_periods TO service_role;

ALTER TABLE public.csn_periods ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'csn_periods' AND policyname = 'Users manage own csn periods'
  ) THEN
    CREATE POLICY "Users manage own csn periods"
    ON public.csn_periods FOR ALL TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_csn_periods_user ON public.csn_periods(user_id);
