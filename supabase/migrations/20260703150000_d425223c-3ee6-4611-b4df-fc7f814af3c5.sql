-- Ta bort ev. dubbletter innan constraint läggs på
DELETE FROM public.calendar_events a
USING public.calendar_events b
WHERE a.ctid < b.ctid
  AND a.user_id = b.user_id
  AND a.external_id IS NOT NULL
  AND a.external_id = b.external_id;

ALTER TABLE public.calendar_events
  ADD CONSTRAINT calendar_events_user_external_unique
  UNIQUE (user_id, external_id);
