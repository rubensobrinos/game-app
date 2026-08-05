# Openstaand werk

**Alleen wat nog niet af is.** Afgerond werk staat in `../archief/` en komt
hier niet meer terug — anders wordt elk statusoverzicht ruis.

Peildatum: 6 aug 2026.

## Bouwen

| Wat | Omvang | Uitwerking |
| --- | --- | --- |
| Antwoord automatisch tonen | 1,5 dag | [antwoord-automatisch-tonen.md](antwoord-automatisch-tonen.md) |
| Continentfilter | 1 dag | [continentfilter.md](continentfilter.md) |
| Host wijzigt naam/kleur van een ander | halve dag | [host-wijzigt-naam-en-kleur.md](host-wijzigt-naam-en-kleur.md) |
| Solo: antwoordvolgorde na reload | 1 uur | [solo-antwoordvolgorde.md](solo-antwoordvolgorde.md) |
| Spelersidentiteit (*Bulgaarse Koe*) | 5–8 dagen | [spelersidentiteit.md](spelersidentiteit.md) |
| Raad het land (vierde game) | 4 dagen | [raad-het-land.md](raad-het-land.md) |
| Typed answers (Kiezen/Mix/Typen) | 6–7 dagen | [typed-answers.md](typed-answers.md) |
| Reactiezinnen: 50–100 per taal | redactie | besluit 44 |
| De donut-gamekeuze | onbekend | besluit 45 |

## Aanzetten

| Wat | Wie |
| --- | --- |
| `METRICS_SECRET` (min. 16 tekens) in `.env` | producteigenaar |
| Deployen | regie |
| De pilot draaien (`../pilot-b-draaiboek.md`) | producteigenaar |

## Besluiten die op de producteigenaar wachten

| Vraag | Advies regie |
| --- | --- |
| De lege onderhelft van het uitslagscherm vullen? | Laten tot er spelersidentiteit is |
| Levert intypen meer punten op dan kiezen? | Ja, 150 in plaats van 100 |
| Spelersidentiteit: hoeveel landen? | 60, niet 230 |
| `capitals_mc` en `higher_lower`: weggooien of tonen? | Weggooien |
| Verlopen room vs. onbekende code: apart melden? | Ja, maar het vraagt een tombstone |

## Bewust zo gelaten

| Wat | Waarom |
| --- | --- |
| Timer stapt per hele seconde | 12 segmenten, rondeduur deelt er niet op |
| Lobby past niet in één viewport | Besluit producteigenaar: de warm-up blijft open |
| Pauzeren buiten een lopende ronde geweigerd | Besluit 12 |
| Odd-one-out op kleurpatroon | Geschrapt: vraagt kleurdata per vlag |
| `/game/{code}` naar home | Niet te reproduceren, tweemaal onderzocht |
