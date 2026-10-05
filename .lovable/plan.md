# Total genomgång: städning, prestanda och lägre driftkostnad

## Vad kostar idag (senaste ~2 veckorna)
- Databasen (minsta storleken) står för nästan all driftkostnad: ca 13 credits för ca 170 timmar igång.
- Funktioner, nätverk och fillagring är nästan gratis (under 0,3 credits totalt).
- Resten är byggkostnad (när vi ändrar appen), inte drift.

Slutsats: det som går att spara är främst **att databasen får sova oftare**. Det som håller den vaken är schemalagda jobb var 15:e minut och appen som frågar efter data i bakgrunden.

## 1. Lägre driftkostnad
- Glesa ut schemalagda jobb: påminnelser och Google Kalender-synk körs mer sällan (förslag: varje timme i stället för var 15:e minut, och inte alls nattetid 00–06), och jobben avbryts direkt om det inte finns något att göra.
- Ta bort gamla e-postkö-funktioner i databasen från före e-postbytet (de gamla 5-sekunders-jobben och tillhörande delar).
- Sluta fråga efter notiser var 2:a minut i bakgrunden; uppdatera i stället när fliken öppnas eller får fokus.
- Längre "färskhetstid" för data som sällan ändras (kurser, inställningar, terminsdatum) så att appen inte hämtar om samma sak vid varje sidbyte.

## 2. Prestanda
- Dela upp de största sidorna (Statistik ~3800 rader, Tips, Inställningar, Översikt) i mindre delar som laddas först när de behövs.
- Sekundklockor (timer, översikt) uppdaterar bara den lilla delen som visar tiden, inte hela sidan.
- Samla dubblerade datahämtningar till de gemensamma hämtarna.
- Lägga till saknade sökindex i databasen där frågor blir långsamma (kontrolleras först).

## 3. Städning
- Ta bort oanvända komponenter, filer och paket (t.ex. UI-bitar som aldrig används).
- Ta bort död kod och gamla rester från tidigare versioner (manuella studiepass, gamla e-postvägar m.m.).
- Ingen funktion du använder idag tas bort.

## Fråga till dig
Förslaget gör att påminnelser och kalendersynk kan komma upp till en timme senare än idag. Säg till om du hellre vill behålla 15 minuter för något av dem.

## Tekniska detaljer
- Cron: ändra email-jobs och sync-google-calendar i pg_cron till `0 6-23 * * *` (Stockholm-justerat), tidig retur när inga användare/uppgifter matchar; email-jobs-fönster anpassas så deadline-offsets och daglig/veckosummering fortfarande träffas.
- Migration: DROP av email_queue_dispatch, email_queue_wake, enqueue_email, read_email_batch, delete_email, move_to_dlq, email_send_state samt unschedule av process-email-queue (kräver ditt godkännande eftersom det raderar).
- app-shell.tsx: ta bort setInterval(2 min), använd refetchOnWindowFocus; isolera 1s-klockor i egna små komponenter.
- QueryClient: staleTime 5 min standard, längre för courses/settings/term_dates.
- Route-level code splitting (`.lazy`-routes / lazy-komponenter) för stats, tips, settings, dashboard; dela stats.tsx i filer under src/components/stats.
- Kör `knip`-liknande sökning efter oanvända exports/filer och `bun remove` oanvända paket; slow_queries + EXPLAIN innan nya index.
- Verifiering: typecheck, build, Playwright-genomklick av huvudsidorna; jämför databastimmar i kostnadsunderlaget efter ~1 vecka.
