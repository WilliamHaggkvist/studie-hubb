## Mål
Bygg om kursdetaljsidan (`src/routes/_authenticated/courses.$courseId.tsx`) så att den matchar din spec: breadcrumbs, kompakt info-header, studiepass, uppgifter uppdelat i uppgifter/examinationer, anteckningar, vecko-statistik, samt redigera/ta bort.

## Ändringar

### 1. Breadcrumbs
Ersätt nuvarande "← Alla kurser"-länk med en `Breadcrumb`-komponent (finns redan i `components/ui/breadcrumb.tsx`):
`Kurser / [Kursnamn]`. Fungerar identiskt på mobil och dator.

### 2. Header (kompakt info-kort)
Behåll nuvarande glasmorf-header, men se till att **alla** dessa fält visas som chips/rader: ikon, kursnamn, kurskod, HP, årskurs, period, universitet, veckomål (h/v). Redigera- och ta-bort-knappar ligger kvar högst upp till höger (redan implementerat via `EditCourseDialog` + `remove`-mutation).

### 3. Statistikpanel (ny)
Under headern: 4 små kort i en responsiv grid:
- **Denna vecka** — timmar + progressbar mot veckomål (finns redan, återanvänds).
- **Snitt/vecka** — medelvärde h/v över alla veckor kursen haft tidsposter.
- **Max vecka** — högsta veckans timmar + datumintervall.
- **Min vecka** — lägsta veckans timmar (bland veckor med aktivitet) + datumintervall.

Beräkning: gruppera `time_entries` för kursen per ISO-vecka (måndag-söndag, `startOfWeek weekStartsOn:1`), summera `duration_seconds`, ta `avg / max / min`.

### 4. Studiepass kopplade till kursen (ny sektion)
Ny query: `study_sessions` där `course_id = courseId`, sorterat på `planned_start desc`, visa senaste 10 i ett kompakt kort (datum, tid, ✔ om `completed`). Länk "Se alla" till `/time`.

### 5. Uppgifter uppdelade (ny layout)
Ersätt nuvarande generella "Uppgifter"-kort med **två kort sida-vid-sida**:
- **Uppgifter** — `tasks` där `course_id = courseId` AND `task_kind IS DISTINCT FROM 'exam'` (dvs. `assignment` eller null).
- **Examinationer** — `tasks` där `task_kind = 'exam'`.

Varje rad: titel, förfallodatum, status-prick. Klick öppnar `/tasks` (befintlig sida hanterar redigering).

### 6. Anteckningar (ny sektion)
Ny query mot `pages` där `course_id = courseId AND archived = false`. Visa som lista med ikon + titel; klick går till `/notes/$noteId`. Knapp "+ Ny anteckning" som skapar en `pages`-rad med `course_id` satt och navigerar dit.

### 7. Behåll / rensa
- Behåll `EditCourseDialog`, `FilesCard`, kurslitteratur och lärare/kontakt (litet kort längre ned).
- Ta bort de tre KPI-korten som redan finns i headern (Denna vecka / Total / Öppna uppgifter) — ersätts av nya statistikpanelen.

### 8. Klickbarhet från kurslistan
Verifiera att kortet i `/courses` redan navigerar till `/courses/$courseId` (route finns). Om inte, wrappa kortet i `<Link to="/courses/$courseId" params={{ courseId: c.id }} />`.

## Teknisk sammanfattning
- Endast frontend-ändringar i `src/routes/_authenticated/courses.$courseId.tsx` (+ eventuellt `courses.tsx` för länken).
- Nya queries: `study_sessions`-per-kurs, `pages`-per-kurs. Befintliga: `courses`, `tasks`, `time_entries`, `course_files`.
- Ingen migration, ingen ny secret, ingen backend-ändring.
- Använder befintliga UI-komponenter (`Breadcrumb`, `Card`, `Button`, `Dialog`).