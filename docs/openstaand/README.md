# Openstaand werk

**Alleen wat nog niet af is.** Afgerond werk staat in `../archief/` en komt
hier niet meer terug — anders wordt elk statusoverzicht ruis.

Peildatum: 6 aug 2026.

## Klein — uren

| Wat | Status |
| --- | --- |
| [Host wijzigt naam/kleur van een ander](host-wijzigt-naam-en-kleur.md) | klaar om te starten |
| [Solo: antwoordvolgorde na reload](solo-antwoordvolgorde.md) | klaar om te starten |

## Middel — dagen

| Wat | Status |
| --- | --- |
| [Antwoord automatisch tonen](antwoord-automatisch-tonen.md) | klaar om te starten |
| [Continentfilter](continentfilter.md) | klaar om te starten |
| Reactiezinnen naar 50–100 per taal (besluit 44) | nog niet uitgewerkt |

## Groot — weken

| Wat | Status |
| --- | --- |
| [Spelersidentiteit (*Bulgaarse Koe*)](spelersidentiteit.md) | klaar om te starten |
| [Raad het land](raad-het-land.md) | klaar om te starten |
| [Typed answers](typed-answers.md) | wacht op het scorebesluit |
| De donut-gamekeuze (besluit 45) | nog niet uitgewerkt |

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
