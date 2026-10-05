# Fler notiser i notisinkorgen

## Vad du får
Nya notiser i klockan uppe till höger, alla med svensk text och länk till rätt sida. De räknas fram automatiskt och försvinner när läget är löst.

**Studieframsteg & mål**
- HP-milstolpar: "Grattis, du har klarat 60 HP!" vid 30/60/90/120/150/180 HP (summa av klara moment + avklarade kurser utan moment). Info, visas en gång per milstolpe tills du avfärdar den.
- Veckomål: söndag kväll till måndag – "Veckomål nått: KURS (6/5 h)" eller "Veckomål missat: KURS (2/5 h)" om under 75 %. Baseras på genomförda studiepass i förra/aktuella veckan.
- Kurs nästan klar: när alla rapporteringsmoment utom ett är klara.

**CSN**
- CSN-varning: när en CSN-period slutar inom 30 dagar och registrerade HP är under kravet – "CSN: 8 hp kvar till kravet (22 hp) före 2027-01-17". Brådskande om under 14 dagar kvar.

**Uppgifter**
- Försenad uppgift: finns redan i inkorgen – behålls (kontrolleras).
- Väntar på bedömning länge: gränsen blir inställbar (standard 14 dagar) i Inställningar → Notisinkorg.
- Tom kurs: kurs utan uppgifter och utan moment när perioden slutar inom 21 dagar (ersätter dagens mer allmänna "Inga uppgifter"-notis, som blir mindre tjatig).

**Studiepass & kalender**
- Inget studiepass på länge: kurs med veckomål > 0, ej avklarad, som inte haft ett genomfört pass på 10 dagar.
- Kalendersynk: utöver felnotisen även "Synken har inte kört på 2 timmar" om Google är kopplat.
- Pass i inkorgen väntar: blir Brådskande om något pass legat okopplat i mer än 2 dagar.

**System**
- Nyheter i appen: en liten lista med uppdateringar i koden; nya poster syns som notis "Nytt: ..." tills de läses/avfärdas.
- Ny inloggning: notis när ett nytt inloggningstillfälle upptäcks på en enhet som inte setts förut (lagras per enhet i databasen). Info-nivå.

## Inställningar
Sektionen Notisinkorg får två nya kategorier att slå av/på – "Framsteg & mål" och "CSN" – samt fältet "Dagar innan påminnelse om bedömning".

## Tekniska detaljer
- `src/lib/notifications.ts`: nya kategorier `progress` och `csn`; utökad input med `csnPeriods`, `devices`, hela session-fälten (`course_id`, `actual_start/end`, `created_at`) och `reviewDays`. Stabila nycklar, t.ex. `hp-milestone:60`, `week-goal:<courseId>:<isoWeek>`, `csn:<periodId>`, `changelog:<id>`, `new-device:<deviceId>`.
- Tom kurs: periodslut från enrollments/kursens perioder via `src/lib/academic-periods.ts` + `term_dates`.
- CSN: återanvänder `useCsnPeriods` och beräkningarna i `src/lib/csn.ts` (registrerade moduler per period).
- `src/lib/changelog.ts`: statisk lista `{ id, date, title, body }`.
- Ny migration: `user_devices (id, user_id, device_id, user_agent, first_seen_at, last_seen_at)` med GRANT + RLS per användare; kolumn `notif_review_days int default 14` i `user_settings`. Enhets-id genereras i localStorage och registreras vid inloggning i `notification-bell.tsx`; den första enheten markeras inte som ny.
- `notification-bell.tsx`: studiepass-frågan breddas (fler fält) och hämtar enheter + CSN-perioder; ikoner för nya kategorier.
- `settings.tsx` (InboxCategoriesCard): nya toggles + fält för bedömningsdagar.
