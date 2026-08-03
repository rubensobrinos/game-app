# Play Aseso — UX, Game Design en UI-documentatie

**Versie:** 1.0  
**Datum:** 3 augustus 2026  
**Status:** ontwerpbaseline voor review en uitvoering

Deze repositorymap vertaalt twee ontvangen onderzoeksrapporten naar een samenhangende ontwerp- en uitvoeringsset voor Play Aseso.

De documenten maken bewust onderscheid tussen:

- **onderzoek:** wat er is waargenomen bij Play Aseso en vergelijkbare producten;
- **besluiten:** welke product- en ontwerpkeuzes als baseline gelden;
- **specificaties:** hoe schermen, states en componenten moeten functioneren;
- **uitvoering:** in welke volgorde het werk wordt gebouwd en gecontroleerd;
- **open punten:** keuzes die nog expliciet door de Product Owner moeten worden bevestigd.

## Indeling

De elf documenten zijn ondergebracht in **vijf gebieden**, elk met een eigen
`PROGRESS.md` en één eigenaar. De documentnummers zitten in de bestandsnamen en
zijn niet veranderd — een verwijzing als "zie `05` §2.3" blijft dus kloppen.

| Gebied | Documenten |
|---|---|
| [`1-schermen-en-flow/`](../design/1-schermen-en-flow/) | 03 game flow en states, 04 schermspecificaties |
| [`2-vorm-en-systeem/`](../design/2-vorm-en-systeem/) | 02 ontwerpprincipes, 05 designsysteem |
| [`3-beweging-en-gevoel/`](../design/3-beweging-en-gevoel/) | 06 motion, sound en feedback |
| [`4-taal-en-tekst/`](../design/4-taal-en-tekst/) | 09 content en microcopy |
| [`5-toegankelijk-en-robuust/`](../design/5-toegankelijk-en-robuust/) | 07 responsive modes, 08 accessibility en resilience |

Vier documenten horen bij géén enkel gebied omdat ze over alle vijf gaan; die
staan los in `design/`:

- `00-DESIGN-INDEX.md` — besluitregister en autoriteitsvolgorde;
- `01-PRODUCT-EXPERIENCE-NORTH-STAR.md` — de meetlat;
- `10-IMPLEMENTATION-ROADMAP.md` — de volgorde van uitvoering;
- `11-DESIGN-QA-CHECKLIST.md` — de checks waaruit de niveaucriteria per gebied
  worden afgeleid.

## Aanbevolen leesvolgorde

1. `design/00-DESIGN-INDEX.md`
2. `design/01-PRODUCT-EXPERIENCE-NORTH-STAR.md`
3. `design/2-vorm-en-systeem/02-DESIGN-PRINCIPLES.md`
4. `design/1-schermen-en-flow/03-GAME-FLOW-AND-STATES.md`
5. `design/1-schermen-en-flow/04-SCREEN-SPECIFICATIONS.md`
6. `design/2-vorm-en-systeem/05-DESIGN-SYSTEM.md`
7. `design/3-beweging-en-gevoel/06-MOTION-SOUND-AND-FEEDBACK.md`
8. `design/5-toegankelijk-en-robuust/07-RESPONSIVE-HOST-PLAYER-MODES.md`
9. `design/5-toegankelijk-en-robuust/08-ACCESSIBILITY-AND-RESILIENCE.md`
10. `design/4-taal-en-tekst/09-CONTENT-AND-MICROCOPY.md`
11. `design/10-IMPLEMENTATION-ROADMAP.md`
12. `design/11-DESIGN-QA-CHECKLIST.md`

## Voortgang

Waar we per gebied staan, staat in de `PROGRESS.md` van dat gebied, op een
schaal van 0 tot 3. Het samengestelde beeld is te openen als lokale pagina —
zie [`docs/progress/`](../../progress/).

## Bronrapporten

De ontvangen rapporten zijn opgenomen onder `docs/research/` en blijven de onderbouwing. De documenten onder `docs/design/` zijn leidend voor nieuwe ontwerpen en implementaties.

## Documentstatussen

- **BESLOTEN:** onderdeel van de ontwerpbaseline; niet zelfstandig wijzigen door een ontwerp- of bouwagent.
- **VOORGESTELD:** sterke werkhypothese; valideren in ontwerp of gebruikstest.
- **OPEN:** Product Owner-besluit of technisch onderzoek nodig.
- **BUITEN SCOPE:** bewust niet opnemen in de huidige redesign.

## Belangrijkste productzin

> Play Aseso is een premium, telefoon-eerste world-party-game waarmee een groep zonder account, download of verplicht gedeeld scherm binnen enkele seconden samen speelt.
