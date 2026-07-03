
# Etapp B + C — samlad plan

Slår ihop de två etapperna eftersom mycket överlappar (task-typer används av kalendern, studiepass syns i översikt och statistik, anteckningar återanvänder befintlig `pages`-tabell). Levereras i **fyra byggpaket** som var för sig ger något testbart — inte två stora leveranser.

---

## Paket 1 — Datamodell + task-omdesign

**Migration (allt i en fil):**
- `tasks`: lägg till `task_type` (enum: annat, inlämningsuppgift, kontrollskrivning, laboration, modul, quiz, redovisning, seminarie, tenta, övning), `task_kind` ('task' | 'exam'), `grade text`, `points text`, `pending_review boolean`. Ändra `status`-enum: `todo` → 'not_started', 'in_progress', 'done'. Behåll `priority`-kolumnen tills vidare (döljs bara i UI — undviker datamigrering och risk).
- Nya tabeller: `study_sessions` (user_id, course_id, planned_start, planned_end, actual_start, actual_end, notes, google_event_id, source 'local'|'google') och `study_session_tasks` (session_id, task_id). Full GRANT + RLS + updated_at-triggers.
- `calendar_events`: inget nytt fält — `source` finns redan.

**UI — `/tasks` byggs om:**
- Två toppflikar: **Uppgifter** (`task_kind='task'`) / **Examinationer** (`task_kind='exam'`).
- Kanban med tre kolumner + separat "Väntar på bedömning"-inkorg (som en fjärde panel/sektion under kanban på desktop, egen tab på mobil).
- Task-kort: kurs-prick, typ-chip, titel, "3 dagar / Imorgon / Försenad 2 d". Prioritet borttagen från UI.
- Klick → Dialog med alla fält (titel, beskrivning, kurs, typ, deadline, status, betyg, poäng, väntar på bedömning). Ingen `/tasks/$id`-route.
- Skapa → samma Dialog. Typ styr `task_kind` automatiskt (tenta/kontrollskrivning/modul/quiz/redovisning = exam), men går att växla manuellt.
- Markera klar → mini-popup: betyg + poäng, eller knappen "Väntar på bedömning" (sätter `pending_review=true`, status kvar). När båda fält ifyllda → `status='done'` automatiskt.
- Filter: kurs, typ, deadline (idag/vecka/månad/försenad).
- dnd-kit för drag mellan kolumner.

---

## Paket 2 — Studietid

**UI — `/time` byter titel till "Studietid":**
- Tre tabs: **Studiepass** (planerade + genomförda), **Timer**, **Manuellt**.
- **Studiepass:** lista + "Nytt pass"-dialog (kurs, uppgifter från kursen (multi), start, slut, anteckning). Sparas i `study_sessions`. Markera "Genomfört" → skapar `time_entry` per vald uppgift med hela passets duration (matchar din spec).
- **Timer:** befintlig timer utökas — välj kurs + valfria uppgifter (multi). Vid stopp: en `time_entry` per uppgift med samma duration. Om inga uppgifter: en post utan `task_id`.
- **Manuellt:** kurs + uppgifter (multi) + minuter + datum. Skapar entries som ovan.
- **Sammanställning:** överst i sidan — tid/kurs (bar) och tid/uppgift (topplista) för valbar period.

Timer-store i `src/lib/timer-store.ts` utökas med `taskIds: string[]`.

---

## Paket 3 — Kalender, Översikt, Statistik, Anteckningar

**Kalender (`/calendar`):**
- Read-only. "Skapa"-knappen bort. FullCalendar behålls.
- Källor: `calendar_events` + `tasks` med `due_at` (visas som markörer, klockslag + typ-chip) + `study_sessions` (planerade).
- Toggle vecko/månad.

**Översikt (`/dashboard`) — byggs om:**
- Sektion 1: **Aktiva kurser** — kort filtrerade på `user_settings.current_year` + kurser vars `period` matchar dagens period (härleds från `term_dates`). Progress-ring för veckomål.
- Sektion 2: **Idag** — deadlines + dagens studiepass.
- Sektion 3: **Denna vecka** — mini-heatmap studietid (7 dagar) + antal uppgifter kvar.
- Sektion 4: **Väntar på bedömning** — bara om ej tom.
- 1 kolumn mobil, 2 desktop.

**Statistik (`/stats`):**
- Byt "Sessioner" → "Studiepass" överallt.
- Periodväljare: Denna vecka / Senaste 30 dagar / Termin (auto från `term_dates`, listar alla terminer där data finns).
- Grafer (Recharts, palettfärger): tid/kurs (bar), tid/uppgift (topplista), snittid/vecka/kurs (line).

**Anteckningar:**
- Menypost `Sidor` → `Anteckningar`. Route `/pages` byter till `/notes` (`/pages.$pageId` → `/notes.$noteId`). Ingen datamigrering — samma `pages`-tabell.
- Ny lista med filter per kurs. Blockeditorn återanvänds oförändrad.

---

## Paket 4 — Google Calendar-synk

- Använd Lovables Google Calendar-connector. Länka i Inställningar (redan UI-plats reserverad).
- Server function `syncGoogleCalendar` (auth-required): hämtar events senaste 30 d + kommande 90 d, upsert i `calendar_events` med `source='google'`, `external_id=<google event id>`.
- "Synka nu"-knapp i Inställningar + `pg_cron` var 30:e minut → publikt endpoint `/api/public/hooks/sync-calendars` som iterar användare med aktiv koppling.
- **Studiepass i Google:** enklaste vägen väljs när connectorn är kopplad. Startvärde: prefix `[Studiepass]` i titeln → skapar/matchar rad i `study_sessions`. Kursmatch via emoji eller kod i titeln (om ingen match → session utan kurs).
- Studiepass skapade lokalt kan senare pushas till Google (Paket 4b, valfritt — inte i denna plan).

---

## Ordning & testpunkter

1. Paket 1 → du kan testa nya tasks/examinationer + kanban.
2. Paket 2 → du kan planera pass och logga timer/manuellt mot uppgifter.
3. Paket 3 → översikt, kalender, statistik, anteckningar hänger ihop.
4. Paket 4 → Google-synk på plats.

Om du vill: säg "kör alla fyra" så levererar jag i följd utan att stanna, annars börjar jag med Paket 1 och pausar för feedback.

## Öppna frågor

1. Ska `priority`-kolumnen droppas helt (kräver att jag samtidigt tar bort ev. sortering på den) eller bara döljas i UI nu och droppas senare? Föreslår dölja nu.
2. Vill du att jag byter route `/pages` → `/notes` (renare URL) eller behåller `/pages` och bara byter etikett i menyn? Föreslår byte till `/notes`.

---

## Status

- Paket 1 ✅ klar
- Paket 2 ✅ klar
- Paket 3 ✅ klar — kalender read-only + studiepass, dashboard 4 sektioner, statistik med period+termin, /notes-lista + rename av route
- Paket 4 🟡 kod klar (server fn + Synka nu-knapp i Inställningar). **Kräver att du länkar Google Calendar-connectorn** — säg till så länkar vi. Cron körs manuellt via knappen tills koppling finns.
