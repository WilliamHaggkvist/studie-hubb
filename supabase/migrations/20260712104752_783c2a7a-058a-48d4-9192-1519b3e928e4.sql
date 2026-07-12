ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS periods public.course_period[] NULL;

-- Backfill: seed the new array from the existing single period so nothing regresses.
UPDATE public.courses SET periods = ARRAY[period]::public.course_period[] WHERE period IS NOT NULL AND (periods IS NULL OR array_length(periods, 1) IS NULL);