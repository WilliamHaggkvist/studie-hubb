## Mål
Google-kalenderpass märkta `[Studiepass]` ska hamna i en **inkorg** på Studietid-sidan. Först när användaren valt kurs + en eller flera uppgifter räknas passet som studietid och visas i kalendern.

## Ändringar

**1. Databas**
- Lägg till kolumnen `needs_review boolean NOT NULL DEFAULT false` på `study_sessions`.

**2. Google-synk (`src/lib/google-calendar.server.ts`)**
- Nya `[Studiepass]`-events importeras med `needs_review = true`.
- Redan existerande pass uppdateras bara med nya tider/text — `needs_review` och kopplade uppgifter rörs inte, så bekräftade pass stannar bekräftade.

**3. Studietid → fliken Studiepass (`src/routes/_authenticated/time.tsx`)**
- Ny sektion **Inkorg** överst med alla pass där `needs_review = true`.
- Varje rad har: tid/datum, kursväljare, checklista med kursens öppna uppgifter, samt knappar för Bekräfta och Ta bort.
- Vid Bekräfta: sätt `needs_review = false`, spara vald `course_id` och skriv raderna till `study_session_tasks`.
- Räkna inte inkorg-pass i "denna vecka"/perioder — aggregatquerien filtreras på `needs_review = false`.

**4. Övriga vyer**
- Kalender, dashboard, statistik och kurssidan filtrerar också bort `needs_review = true` så inkorg-pass inte dyker upp där.

**5. Timer**
- Ingen ändring behövs — timerns "välj uppgifter efter kurs" finns redan.

## Utanför scope
- Ingen ändring av hur "Studiepass" skapas i Google Kalender (fortsatt via `[Studiepass]`-prefix).
- Inga ändringar i vanliga kalenderhändelser (`counts_as_study`-flödet).