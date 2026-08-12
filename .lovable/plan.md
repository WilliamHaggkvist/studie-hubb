# Kurser som läses flera gånger — korrekt hp-statistik

Din idé är rätt väg: flera "antagningsomgångar" per kurs. Jag lägger det som en egen lista i kursinställningarna, så att en kurs kan vara antagen t.ex. "P1+P2, årskurs 2" och "P3+P4, årskurs 4".

## Så fungerar det

**Kursinställningar (Redigera kurs)**
- Ny sektion "Antagningsomgångar". Varje rad = årskurs + en eller flera perioder (P1–P5).
- Lägg till / ta bort rader. Den första (tidigaste) omgången används fortsatt för gruppering i kurslistan och på kurssidan, så inget annat ändras visuellt.
- Befintliga kurser flyttas automatiskt över: nuvarande årskurs + perioder blir omgång 1.

**HP – Antagen** (hur mycket du läser per period, termin och årskurs)
- Kursens fulla hp räknas till *varje* omgång. Läser du en 9 hp-kurs igen i åk 4 syns 9 hp både i åk 2 och åk 4.
- I "totalt antagna hp" räknas kursen en gång per omgång (det är ju faktisk studiebelastning), men kurskortslistan visar kursen en gång med båda omgångarna som chips.

**HP – Registrerade** (hur mycket du klarat per period, termin och årskurs)
- Bygger på rapporteringsmomenten, inte på hela kursen. Ett klarmarkerat moment med registreringsdatum placeras i den period/termin som datumet faller inom (via dina terminsdatum i Inställningar) och därmed i rätt årskurs.
- Exempel: 3 hp registrerat i P1–P2 åk 2 hamnar där, resterande 6 hp registrerat i P3–P4 åk 4 hamnar där.
- Moment utan registreringsdatum, eller datum utanför alla inlagda terminer, hamnar i en tydlig grupp "Ej periodiserade" så inget försvinner tyst.
- Kurser utan rapporteringsmoment: hela kursens hp registreras på kursens klarmarkeringsdatum (samma logik), så statistiken blir komplett även där.

## Teknisk del

- Ny tabell `course_reg_enrollments` (user_id, course_id, arskurs, academic_year, periods `course_period[]`, sort_order) med grants, RLS per `auth.uid()` och updated_at-trigger. Migrering kopierar in dagens `courses.arskurs` + `courses.periods` som första omgång.
- `courses.arskurs`/`courses.periods` behålls och speglas från den tidigaste omgången när man sparar, så kurslistan, dashboard och kurssidan fungerar oförändrat.
- `src/lib/queries.ts`: ny query för omgångar (hämtas för alla kurser i en batch) + fortsatt användning av `term_dates` och `course_reporting_modules`.
- Ny hjälpmodul `src/lib/academic-periods.ts`:
  - `periodWindows(termDates)` → datumintervall per (läsår, årskurs-oberoende) period: höstterminen delas i P1/P2, vårterminen i P3/P4, sommar = P5.
  - `resolvePeriod(date, windows)` → { academic_year, period, term } eller null.
- `src/routes/_authenticated/stats.tsx`:
  - "HP – Antagen": aggregering itererar över omgångar i stället för `c.arskurs`/`c.periods`.
  - "HP – Registrerade": aggregering byggs om från kurser till registrerade rapporteringsmoment (+ fallback för kurser utan moment), med nya period-/termin-/läsårsdiagram som matchar Antagen-vyn.
- `src/components/courses/edit-course-dialog.tsx` och `courses.index.tsx` (skapa kurs): UI för att lägga till/ta bort omgångar; hp-summeringsregeln för rapporteringsmoment lämnas orörd.
- `courses.$courseId.tsx`: visar alla omgångar som chips ("Åk 2 P1–P2", "Åk 4 P3–P4").
