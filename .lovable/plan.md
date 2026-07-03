## Mål

Koppla Google Calendar-events till rätt kurs via `[KURSKOD]` i eventtiteln, och låt dig välja i Inställningar vilka Google-kalendrar som ska synkas + vilka som räknas som studietid.

Bra nyhet: `courses.code` finns redan i databasen, så ingen migration behövs för kurskoden.

---

## 1. Kurskod-parser

Regex: `/\[([A-ZÅÄÖ0-9]{2,10})\]/i` — plockar första hakparentesen i titeln.

Matcha träffen (case-insensitive) mot `courses.code` för inloggad användare. Träff → sätt `calendar_events.course_id`. Ingen träff → importera ändå med `course_id = null` (visas som "okopplad" i UI, som redan finns).

Kurskod-taggen behålls i titeln så du ser den i alla vyer.

---

## 2. Valbara kalendrar (ny tabell)

```text
public.google_calendar_prefs
├─ user_id (fk auth.users, unique per calendar)
├─ google_calendar_id (text)
├─ name, background_color (cache från Google)
├─ sync_enabled (bool, default false)
├─ counts_as_study (bool, default false)
└─ timestamps
```

RLS: endast egen data. GRANT för `authenticated` + `service_role`.

---

## 3. Utökad sync-logik (`src/lib/google-calendar.functions.ts`)

Två nya server-funktioner + uppdaterad sync:

- **`listGoogleCalendars`** — hämtar `/users/me/calendarList`, upsertar rader i `google_calendar_prefs` (utan att röra `sync_enabled`/`counts_as_study` om de redan finns), returnerar listan så UI kan visa dem.
- **`updateCalendarPref`** — togglar `sync_enabled` / `counts_as_study` per kalender.
- **`syncGoogleCalendar`** (befintlig, utökas):
  1. Läs alla `google_calendar_prefs` där `sync_enabled = true`.
  2. Loopa och hämta events per kalender-id (inte bara `primary`).
  3. För varje event: parsa kurskoden, slå upp `course_id` (cacha kod→id map för användaren).
  4. Sätt `counts_as_study` från kalenderns pref (istället för hårdkodat `false`).
  5. Behåll `[Studiepass]`-detektionen som skapar `study_sessions`.
  6. Retur: `{ imported, sessions, mapped, unmapped, calendars: N }`.

Fortsatt idempotent via `external_id` unique upsert.

---

## 4. UI i Inställningar (`settings.tsx` → `GoogleCard`)

Utöka det befintliga kortet:

- Knapp **"Hämta kalendrar"** → kör `listGoogleCalendars`.
- Lista alla kalendrar med två toggles per rad: **Synka** och **Räknas som studietid**.
- Visa liten färgprick från Googles `background_color`.
- Info-ruta: *"Skriv `[KURSKOD]` i eventtiteln (t.ex. `[SG1140] Föreläsning`) för att koppla till en kurs. Kurskoderna hämtas från kortet 'Kurskod' på respektive kurs."*
- Länk/knapp till kurssidan för att sätta koder som saknas.
- Efter första `Synka nu`: visa `mapped / unmapped`-räknare så du ser vilka events som saknar kod.

---

## 5. Okopplade events i kalender-/tid-vyn

Ingen ny logik krävs — okopplade events (`course_id = null`) syns redan i kalender-vyn. Vi lägger bara till en subtil "okopplad"-badge så det är lätt att hitta events där du glömt kurskoden.

---

## Filändringar

- `supabase/migrations/…` — ny `google_calendar_prefs`-tabell + RLS + GRANT.
- `src/lib/google-calendar.functions.ts` — parser, tre server-fns, multi-calendar loop.
- `src/routes/_authenticated/settings.tsx` — utökad `GoogleCard` med kalenderlista.
- `src/routes/_authenticated/calendar.tsx` — liten "okopplad"-badge (valfri finputs).

Inget behövs för `courses` — kolumnen finns redan. Ingen ny secret. Ingen ny connector.
