
## Mål

Gör om Uppgifter så att vilken uppgift som helst kan vara en **behållare** för andra uppgifter. Behållaren är den som får betyg/poäng vid klarmarkering — barnen är enkla att-göra-steg. Ger tydlig struktur (t.ex. Tenta → läsa kap. 3, göra övningsuppgifter, gå på repetition) utan att låsa dig till bara "Modul".

## Datamodell

Ny kolumn på `tasks`:
- `parent_id UUID NULL REFERENCES public.tasks(id) ON DELETE CASCADE`
- Index på `parent_id` för snabb barn-lookup.
- Ingen typbegränsning — vilken `task_type` som helst kan ha barn eller vara barn.
- Endast ett nivå av nesting (barn kan inte själva ha barn) — validering i UI + DB-trigger som avvisar `parent_id` om raden själv har `parent_id IS NOT NULL`.

Ingen ändring av `task_kind`, `task_type`, `grade`, `points`.

## Regler för klarmarkering

- **Behållare (har barn)**: fungerar precis som idag — `CompleteDialog` med betyg/poäng när den markeras klar. Barnens status påverkar inte behållarens status automatiskt (men vi visar progress "3/5 klara").
- **Barn**: förenklad klarmarkering — bara todo/doing/done, inget betyg/poäng-fönster (som "Annat"/"Modul" beter sig idag).
- Om ett barn läggs till en behållare som redan var klar → behållaren förblir klar, ingen kaskad.

## Vy-omstrukturering (`tasks.tsx`)

Kanban-kolumnerna (Ej startad / Pågår / Klar) behålls, men **endast rot-uppgifter** (utan `parent_id`) renderas som kort där.

Varje kort får:
- Om behållare: en liten "N underuppgifter (X klara)"-indikator + expanderbar list under kortet (chevron), där barnen visas som kompakta rader med kryssruta för snabb klarmarkering.
- Om vanlig uppgift utan barn: som idag.

Drag-and-drop: fortsätter fungera för rot-uppgifter mellan kolumner. Barn dras inte mellan status-kolumner — status ändras via kryssruta/klick på raden.

"Väntar på bedömning"-sektionen behålls (bara behållare/vanliga uppgifter, aldrig barn).

## Dialog-ändringar

`TaskDialog` får nytt fält **"Underuppgift till"** (Select bland användarens rot-uppgifter, filtrerat på samma kurs om vald). Tomt = rot.

I behållarens edit-dialog: en sektion "Underuppgifter" med inline add/remove — snabbt sätt att bygga upp en tenta med sina delmoment utan att öppna en ny dialog per barn.

## Filter

Filter (kurs/typ/deadline) matchar mot rot-uppgifter. Om en rot matchar visas den med alla sina barn (även barn som inte matchar filtret) — så man inte tappar sammanhanget.

## Övriga vyer som listar tasks

Kontrolleras och justeras så barn inte dubbelrapporteras:
- **Dashboard** ("kommande deadlines" etc.): visa endast rot-uppgifter, eller barn utan deadline döljs.
- **Kalender**: barn med deadline visas som separata event (deadlines är deadlines).
- **Kursdetalj**: gruppera under sin rot-uppgift.
- **Deadline-reminders (email)**: skicka fortfarande på barnens deadlines om de har en; ingen dedup behövs.

## Teknisk sammanfattning

1. Migration: lägg till `parent_id` + FK + index + trigger som förbjuder två nivåer.
2. `src/lib/queries.ts`: `Task`-typ + `parent_id` i SELECT.
3. `src/integrations/supabase/types.ts` regenereras automatiskt efter migration.
4. `tasks.tsx`: bygg parent→children-map, rendera rötter i kanban, expanderbar barnlista, filter-logik, DnD oförändrad för rötter.
5. `task-dialog.tsx`: parent-select + inline barn-hantering på edit.
6. `complete-dialog.tsx`: skip betygsdialog för barn (`parent_id != null`).
7. Justera dashboard/kalender/kursdetalj/emails att inte dubbelräkna barn.

## Öppna frågor att verifiera under bygget

- Om du klarmarkerar en behållare med öppna barn — ska vi fråga "markera även barnen klara?" eller lämna dem? (Föreslår: fråga en gång via dialog.)
- Grade/points på barn som redan har det ifyllt idag — behålla som info men inte visa i UI för barn.
