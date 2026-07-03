
# StudyOS v2 — Stor omstuvning i 3 etapper

Bygger om appen enligt din feedback. Delas upp i tre etapper så du kan testa löpande. Först en gemensam **designuppdatering** som gäller allt — sen etapp för etapp.

---

## Design (görs i Etapp A, gäller hela appen)

- **Inga gradienter.** All `gradient-sunset` / `gradient-text` tas bort. Accenter = solida färger eller översatt till glas/blur.
- **Ny accentpalett:** `#f94144, #f3722c, #f8961e, #f9844a, #f9c74f, #90be6d, #43aa8b, #4d908e, #577590, #277da1` (röd → orange → gul → grön → teal → blå). Färgerna används med varierande opacity för accenter, kurs-tagging, statuschips, grafer.
- **Mjukt & rundat:** större border-radius (kort `rounded-2xl`, knappar `rounded-xl`, chips `rounded-full`), större luft, mjukare hover.
- **Translucent:** sidopanel, popovers, dialogs, taskkort och toppbar får `bg-surface/60` + `backdrop-blur-xl` + tunn border. Bakgrund är fortfarande mörk (`#0F0F12`).
- **Kompakt & mobilvänligt:** tightare typografi, sticky bottom-nav på mobil, all interaktion når med tumme.

---

## Etapp A — Design + Inställningar + Kurser

**Global inställningssida** (`/settings`) i sidomenyn:
- Profil (visningsnamn).
- **Aktuell årskurs** (1–6) — styr "Aktiva kurser" på översikten.
- **Universitet** — lista med grundvärden (KTH, Mittuniversitetet, Örebro, Linné, Stockholms). Går att lägga till, redigera, ta bort. Sparas per användare.
- **Terminsdatum per år** — höst/vår/sommar med start- och slutdatum. Används av statistiken.
- **Utseende** — kompakt/normal densitet, translucent på/av.
- **Google Calendar** — koppla/koppla bort konto (aktiveras i Etapp C).

**Kurser — utökade fält vid skapande & redigering:**
- Namn, kod, ikon, färg (från nya paletten).
- **Högskolepoäng** (siffra), **Period** (P1–P5), **Årskurs** (1–6), **Universitet** (dropdown från inställningarnas lista).
- **Veckomål studietid** (timmar/vecka).
- **Kurslitteratur** (fri text/lista).
- **Lärare + kontaktväg** (namn, e-post, telefon/annat).
- **Kursfiler** — uppladdning av kurs-PM, schema m.m. (lagras i Cloud Storage).
- **Avklarad** — checkbox som öppnar popup för **slutbetyg**.

**Kurssidan** görs om till en samlad översikt:
- Header med kurs-metadata (period, årskurs, universitet, HP, betyg om avklarad).
- **Veckomål-widget:** progress-ring "X / Y h denna vecka" med färg från paletten (röd → gul → grön beroende på uppfyllnad).
- Studietidsstatistik för kursen (mini-graf).
- Uppgifter kopplade till kursen.
- Kalenderhändelser kopplade till kursen (kommande).
- Anteckningar (kopplade till kursen — se Etapp C).
- Litteratur, lärare, filer.

---

## Etapp B — Uppgifter + Studietid

**Uppgifter — omdesign:**
- **Två separata flikar** överst: `Uppgifter` och `Examinationer`.
- **Kategori/typ** vid skapande (alfabetisk dropdown): annat, inlämningsuppgift, kontrollskrivning, laboration, modul, quiz, redovisning, seminarie, tenta, övning. "tenta", "kontrollskrivning", "modul", "quiz", "redovisning" räknas som examinationer; övriga som uppgifter (redigerbart).
- **Kanban med status:** `Ej startad` / `Pågång` / `Klar` + separat inkorg **`Väntar på bedömning`**.
- **Prioritet tas bort.**
- **Uppgiftskort** visar titel, kurs (färgprick), typ-chip, deadline, **dagar kvar** (ex "3 dagar", "Imorgon", "Försenad 2 d").
- **Klick på uppgift → modal (popup)** med all info: titel, beskrivning, kurs, typ, deadline, status-selector, betyg, poäng. Ingen full-page-vy.
- **Markera som klar → popup:** fält för betyg + poäng. Knapp "Väntar på bedömning" flyttar uppgiften till inkorgen. När båda fälten är ifyllda (siffra, bokstav eller `-`) blir uppgiften helt klar automatiskt.
- Filter: per kurs, per typ, deadline-intervall.

**Studietid** (sidan får nytt namn "Studietid"):
- Tre lägen: **Studiepass**, **Manuellt (Studiepass, manuellt)**, **Timer**.
- **Studiepass:** planera pass — välj kurs + 1+ uppgifter från kursen + tid. Visas på egen lista och synkas med Google Calendar i Etapp C (i Etapp B finns UI + lokal lagring).
- **Timer:** starta timer, välj kurs + valfria uppgifter att jobba med. Vid stopp fördelas tiden **lika** mellan valda uppgifter.
- **Manuellt:** logga tid retroaktivt (kurs + uppgifter + minuter).
- **Sammanställning per kurs och per uppgift.** Ett pass med flera uppgifter → varje uppgift får hela passets tid inräknad (enligt din spec).

---

## Etapp C — Kalender + Översikt + Statistik + Anteckningar + Google-synk

**Kalender:**
- Endast **läsvy**. Ingen "Skapa händelse"-knapp.
- Visar (a) importerade Google-händelser (b) uppgifter/examinationer på sin deadline.
- Uppgifter visar **klockslag + typ-chip**.
- **Vecko-** och **månadsvy** (toggle).

**Översikt** (görs om från grunden):
- "Vad ska vi jobba med idag?" **borttaget**.
- Först: **Aktiva kurser** — filtrerade på inställningarnas aktuella årskurs + pågående period. Rutnät av kompakta kurskort med veckomål-ring.
- Sedan: **Idag** — dagens deadlines + planerade studiepass (kompakt lista).
- Sedan: **Denna vecka** — mini-heatmap av studietid + antal uppgifter kvar.
- Sedan: **Väntar på bedömning** — snabb inkorg (om ej tom).
- Allt kompakt, en kolumn på mobil, två på desktop.

**Statistik:**
- "Sessioner" → **Studiepass** överallt.
- **Perioder:** Denna vecka, Senaste 30 dagar, Terminer (Höst/Vår/Sommar per år från inställningarna).
- **Tid per kurs**, **tid per uppgift**, **snittid per kurs** (per vecka).
- Grafer i palettens färger.

**Anteckningar:**
- **Sidor tas bort** som eget koncept ur menyn.
- Ny meny-post **Anteckningar** — en lista med alla anteckningar (fristående + kursbundna), filtrerbar per kurs. Blockeditorn återanvänds. Databasmässigt: `pages`-tabellen behålls men presenteras som anteckningar.

**Google Calendar-synk (enkel lösning):**
- Använder Lovables **inbyggda Google Calendar-connector** — inget eget OAuth-projekt behövs.
- Vid koppling i Inställningar: importerar händelser till `calendar_events` (märkta `source='google'`).
- Manuell "Synka nu"-knapp + periodisk synk via server-funktion.
- **Studiepass planerade i Google Calendar** identifieras via prefix/tagg i händelsetitel (t.ex. `[Studiepass]` eller taggning per kurs-emoji). Alternativt: händelser i en dedikerad Google-kalender kallad "StudyOS". Slutgiltig regel bestäms när kopplingen är på plats — enklaste vägen väljs.

---

## Teknisk sammanfattning (för mig, inte kritiskt för dig)

- **DB-migration:** utökar `courses` (hp, period, arskurs, universitet_id, weekly_goal_hours, literature, teacher_name, teacher_contact, completed, final_grade); ny `universities`; ny `settings` (per user: current_year, density, translucent); ny `term_dates`; utökar `tasks` (task_type, task_kind='task'|'exam', grade, points, pending_review); ny `study_sessions` + `study_session_tasks` (för planerade pass); Storage-bucket `course-files`.
- **Google Calendar** via befintlig Lovable-connector, ingen ny OAuth-app krävs.
- **UI-bibliotek:** shadcn Dialog för uppgifts-popup, dnd-kit för kanban, Recharts för grafer, FullCalendar behålls för kalendervyn (read-only).
- **Design tokens:** paletten läggs som CSS-variabler `--c-1` … `--c-10`; gradient-utilities tas bort.

---

## Vad jag startar med om du godkänner

**Etapp A** direkt: designtokens + translucent-look, inställningssida, utökade kurser, ny kurssida med veckomål och filuppladdning. Etapp B och C följer efter din feedback.
