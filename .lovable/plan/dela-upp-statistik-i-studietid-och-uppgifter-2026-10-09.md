# Dela upp Statistik i Studietid och Uppgifter

Idag blandar fliken "Studietid" grafer om studietid med grafer om uppgifter. Förslaget är att lägga till en egen flik, **Uppgifter**, bredvid Studietid, Högskolepoäng och Betyg.

## Flikar efter ändringen

```text
[ Studietid ] [ Uppgifter ] [ Högskolepoäng ] [ Betyg ]
```

**Studietid** (bara tid):
- Total tid, snitt per dag, studiepass
- Streaks, denna period jämfört med föregående
- Studieaktivitet senaste året
- Studietid per kurs över tid, Tid per kurs
- Studietid per veckodag och per klockslag
- Planerat jämfört med faktiskt (studiepass)

**Uppgifter** (nytt, flyttas hit):
- Antal klara uppgifter (nyckeltal flyttas från Studietid)
- Uppgiftsstatus (att göra / pågår / klar)
- Slutförandegrad per kurs
- Topp uppgifter (där du lagt mest tid; länkar tillbaka till studietiden)
- Nya nyckeltal: försenade, väntar på bedömning, klara denna period, kommande deadlines 7 dagar
- Ny graf: klarmarkerade uppgifter per vecka

## Filtrering
- Periodvalet (vecka / 30 dagar / termin / all tid) och "Inkludera arkiverade" visas på både Studietid och Uppgifter och gäller båda.
- Fliken sparas i adressen (`?tab=tasks`), så den går att länka till och ligger kvar vid omladdning.

## Teknisk del
- `stats.tsx`: ny `TabsContent value="tasks"`; flytta korten Uppgiftsstatus, Slutförandegrad per kurs, Topp uppgifter och kortet Klara uppgifter dit. Visa periodväljaren när `activeTab` är `time` eller `tasks`.
- Nya nyckeltal och veckograf räknas från `tasksQuery` (status, due_at, completed_at, pending_review) filtrerat på valt intervall och arkiverade kurser.
- Ingen databasändring. Undersidor görs som flikar i samma sida (samma mönster som idag) för att inte dubblera datahämtningen.
