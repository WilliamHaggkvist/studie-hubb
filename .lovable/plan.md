# Rapporteringsmoment för kurser

Varje kurs kan få ett antal rapporteringsmoment (t.ex. "TEN1") med namn och högskolepoäng. Momenten kan klarmarkeras med betyg, poäng och registreringsdatum. En kurs kan bara klarmarkeras när alla dess moment är avklarade.

## Datamodell

Ny tabell `course_reporting_modules`:
- kurs, namn (t.ex. TEN1), hp
- betyg, poäng, registreringsdatum, avklarad
- sortering, standardfält (id, tidsstämplar)
- Åtkomst: bara den inloggade användaren ser och ändrar sina egna moment.

## Hantera moment (kursens inställningsdialog)

I redigeringsdialogen för kursen kommer en ny sektion "Rapporteringsmoment":
- Rad per moment med namn + hp, knapp för att lägga till rad och ta bort rad.
- Summan av momentens hp visas löpande mot kursens hp.
- Sparning blockeras om summan inte är exakt lika med kursens hp (tydligt felmeddelande, t.ex. "Momenten summerar till 6 hp men kursen är 7,5 hp"). Har kursen inga moment alls är det tillåtet att spara.

## Sektion på kurssidan

Nytt kompakt kort "Rapporteringsmoment" på kurssidan:
- Lista med namn, hp, status, och när avklarad: betyg, poäng, registreringsdatum.
- Klarmarkering per moment via samma stil av dialog som för uppgifter — men utan "Väntar på bedömning" och med extra fält för registreringsdatum.
- Möjlighet att ångra klarmarkering.
- Rad som visar hur många moment som är klara samt summerade hp klara / totalt.

## Kursens klarmarkering

Knappen "Markera kurs som klar" blir inaktiv så länge något moment är oavklarat, med förklarande text ("Alla rapporteringsmoment måste vara avklarade"). Har kursen inga moment fungerar det som idag.

## Tekniska detaljer

- Migration: ny tabell `course_reporting_modules` med GRANT till `authenticated`/`service_role`, RLS scoped på `auth.uid()`, samt `updated_at`-trigger via befintlig `set_updated_at()`.
- Ny query i `src/lib/queries.ts` (`reportingModulesQuery`) med typ, delad cache-nyckel.
- `src/components/courses/edit-course-dialog.tsx`: momentlista i formuläret + hp-validering före sparning; skapa/uppdatera/ta bort rader vid sparning.
- Ny komponent `src/components/courses/complete-module-dialog.tsx` (betyg, poäng, registreringsdatum) återanvänder samma dialog-styling som `tasks/complete-dialog.tsx`.
- `src/routes/_authenticated/courses.$courseId.tsx`: nytt kort, mutationer för klarmarkering, och spärr i den befintliga `toggleComplete`-flödet.
- Ingen koppling mellan uppgifter och moment i den här versionen.
