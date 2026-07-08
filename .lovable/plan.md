# Plan: Mejlnotiser för uppgifter

## Översikt
Bygg mejlpåminnelser inför uppgifters deadline samt daglig och veckovis sammanfattning. Använder Lovables inbyggda e-postinfrastruktur (ingen tredjepart).

## Steg 1 – E-postdomän
Du behöver koppla en avsändardomän. Efter att du klickat på knappen nedan fortsätter jag automatiskt med resten av uppsättningen.

Detta krävs innan mejl kan skickas — DNS behöver inte vara klart innan vi bygger, bara initierat.

## Steg 2 – E-postinfrastruktur & mallar
- Sätt upp kö, cron och send-log (Lovable Emails infrastruktur)
- Scaffolda transaktionella mejlmallar (React Email) och registrera:
  - `deadline-reminder` – påminnelse inför en uppgift
  - `daily-summary` – morgonens uppgifter och studiepass
  - `weekly-summary` – veckans uppgifter (söndag kväll)
- Branda mallar med appens sunset-gradient och typografi

## Steg 3 – Inställningar (per användare)
Utöka `user_settings` med kolumner:
- `email_reminders_enabled` (bool, default true)
- `reminder_offsets` (int[], minuter före deadline – default `[10080, 4320, 1440, 120]` = 1v/3d/1d/2h)
- `reminder_fallback_hour` (int, default 8) – används om uppgiften saknar klockslag
- `daily_summary_enabled` (bool)
- `weekly_summary_enabled` (bool)
- `timezone` (text, default `Europe/Stockholm`)

Ny tabell `task_reminder_overrides`:
- `task_id`, `offsets int[]`, `disabled bool` – för per-uppgift-inställning

Ny tabell `email_reminders_sent`:
- `task_id`, `offset_minutes`, `sent_at` – idempotens så samma påminnelse inte skickas två gånger

## Steg 4 – UI
- **Inställningar → Notiser**: toggles + multiselect för standardintervall (1v / 3d / 1d / 2h / 08:00 samma dag) + daglig/vecka
- **Uppgiftsdialog** (`tasks.tsx`): sektion "Påminnelser" – ärver globala men går att åsidosätta per uppgift (checkboxar för intervall + "stäng av påminnelser")

## Steg 5 – Cron-jobb
En server-route `/api/public/hooks/send-reminders` som körs var 15:e minut via `pg_cron`:
1. Hämtar uppgifter med `due_at` inom nästa vecka som inte är klara
2. För varje aktivt offset (globalt + override): räkna ut sändningsfönster
   - Har uppgiften klockslag → skicka `offset` minuter före
   - Saknar klockslag → skicka kl 08:00 den dag som motsvarar offset
3. Skippa om rad finns i `email_reminders_sent`
4. Anropa `/lovable/email/transactional/send` per uppgift
5. Logga i `email_reminders_sent`

Två extra cron:
- Dagligen 07:00 → `daily-summary` till användare med toggle på
- Söndag 19:00 → `weekly-summary`

## Tekniska detaljer
- Bygger på TanStack server-routes + Lovable Emails-kön (retry, suppression, unsubscribe hanteras automatiskt)
- Ingen tredjepart, inga extra API-nycklar
- Tidszon hanteras via `Europe/Stockholm` i cron-frågan
- `idempotencyKey` = `reminder-<task_id>-<offset>` respektive `daily-<user>-<date>` / `weekly-<user>-<week>`

## Vad du behöver göra
1. Klicka på knappen nedan för att välja avsändardomän
2. Jag bygger resten

<presentation-actions>
<presentation-open-email-setup>Konfigurera e-postdomän</presentation-open-email-setup>
</presentation-actions>
