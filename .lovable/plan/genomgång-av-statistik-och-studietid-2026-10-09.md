# Genomgång av statistik och studietid

Målet: samma studietimme och samma högskolepoäng ska visas lika överallt (Översikt, Studietid, Statistik, kurssidan, notiser), med rätt filtrering och korrekta summor.

## Vad som redan syns vid första genomsökningen
- Statistiksidan hämtar studietid från två källor (gamla tidsposter och kalenderpass). Det kan ge dubbelräkning eller gammal data som borde vara borta.
- "Genomfört pass" bestäms på olika sätt på olika ställen (ibland via klarmarkering, ibland via att sluttiden passerat).
- Beräkningen av högskolepoäng finns i två nästan identiska kopior, och "moment klart" definieras på flera ställen.
- Veckan räknas måndag–söndag på vissa ställen; övriga ställen ska kontrolleras.

Dessa är ännu inte bekräftade som fel i siffrorna – första steget är att jämföra mot din faktiska data.

## Steg
1. **Kontroll mot din data**: räkna fram studietid per kurs/vecka och HP per period direkt från databasen och jämför med vad varje sida visar. Notera varje avvikelse.
2. **En gemensam regel för studietid**: endast pass från Google Kalender räknas; ett pass räknas när sluttiden passerat; faktisk tid används om den finns, annars planerad tid. Pass som delas över midnatt/vecka fördelas korrekt.
3. **En gemensam regel för HP**: en definition av "moment klart", en beräkning för Antagen/Registrerade, samma period- och årskursmappning som terminsdatumen.
4. **Filtrering**: kontrollera tidsintervall (vecka/månad/termin/allt), kursfilter, arkiverade kurser, tidszon (Stockholm) och årskursfilter på alla vyer.
5. **Städning**: ta bort den gamla tidspostkällan om den inte längre används, och dubblettkoden.
6. **Tester** för reglerna ovan (veckogränser, pass över midnatt, kommande pass räknas ej, HP fördelat över flera omgångar).

## Teknisk del
- Ny modul `src/lib/study-time.ts` (sessionHours, isSessionDone, bucketByDay/Week/Course) och `src/lib/hp-stats.ts` (isModuleDone, aggregering Antagen/Registrerade); används i stats.tsx, dashboard.tsx, time.tsx, courses.$courseId.tsx, notifications.ts och email-jobs.ts.
- Verifiera om `time_entries` har rader; om tom/obsolet, sluta läsa den i stats/dashboard/app-shell.
- Vitest-tester bredvid modulerna; jämförelse-SQL mot din data i steg 1.
- Inga ändringar i utseende.
