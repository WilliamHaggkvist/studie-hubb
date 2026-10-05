# Notisinkorg (klocka uppe till höger)

## Vad du får
En klockikon i övre högra hörnet (bredvid timern) med en röd siffra för olästa notiser. Klick öppnar en panel (på telefon: helskärmsark) med notiser grupperade som **Brådskande**, **Att åtgärda** och **Info**. Varje notis går att klicka för att komma direkt till rätt uppgift/kurs/sida, och kan markeras som läst eller avfärdas. Knapp "Markera alla som lästa".

## Notistyper

**Uppgifter**
- Försenad uppgift (deadline passerad, ej klar)
- Deadline idag / imorgon
- Väntar på bedömning länge (> 14 dagar) – påminnelse att fylla i betyg
- Överuppgift där alla deluppgifter är klara men själva överuppgiften inte är klarmarkerad

**Kurser – något saknas/fel**
- Rapporteringsmomentens HP summerar inte till kursens HP
- Kurs saknar period, årskurs eller HP
- Alla moment klara men kursen inte markerad som avklarad (eller saknar slutbetyg)
- Kurs pågår men har inga uppgifter
- Veckomål för studietid: under hälften uppnått när veckan nästan är slut

**Studiepass**
- Pass i Inkorgen som inte kopplats till uppgifter
- Studiepass startar snart (inom 15 min)

**System / generellt fel**
- Google Kalender-synk misslyckades eller kopplingen har gått ut
- Push-notiser avstängda på denna enhet / e-postadress ej verifierad
- Terminsdatum saknas för kommande termin (så perioder kan inte räknas ut)

**Fler idéer (valfria senare)**
- Veckosammanfattning i inkorgen (samma som mejlet)
- Milstolpar: "Du har klarat 60 HP!", studie-streak
- CSN-varning: för få HP registrerade inför terminens slut
- Arkivera gamla kurser som är klara

## Hur det fungerar
- De flesta notiser räknas fram automatiskt från dina befintliga data varje gång sidan laddas – de försvinner av sig själva när problemet är löst (t.ex. när HP-summan rättas).
- Vad du har läst/avfärdat sparas i databasen så det gäller på alla enheter. En avfärdad notis kommer tillbaka bara om läget ändras (t.ex. ny försenad uppgift).
- Inställningar: en sektion "Notisinkorg" där man kan slå av/på varje kategori.

## Tekniska detaljer
- Ny tabell `notification_states (user_id, key, read_at, dismissed_at)` med RLS per användare; `key` är stabil, t.ex. `overdue:<taskId>`, `hp-mismatch:<courseId>:<sum>`.
- Ny tabell-kolumn eller jsonb i `user_settings` för kategori-toggles.
- `src/lib/notifications.ts`: ren funktion `buildNotifications(courses, tasks, modules, enrollments, sessions, terms, settings)` som återanvänder befintliga queries i `queries.ts` (ingen extra fetch).
- Systemnotiser (Google-synkfel) kräver att synkjobbet sparar senaste fel – lägg `google_last_sync_error`/`google_last_sync_at` i `user_settings` och skriv dit i `google-calendar.server.ts`.
- `NotificationBell`-komponent i `TopBar` i `app-shell.tsx` (Popover på desktop, Sheet på mobil).
