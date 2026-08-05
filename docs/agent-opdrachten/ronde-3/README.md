# Ronde 3 — uitgestelde punten

**Peildatum:** 5 aug 2026, na de mobiele UX-ronde. **Lead en reviewer:** regie.

Dit zijn de punten uit `docs/PLAN-OPENSTAAND.md` §3 en §4: klein en middelgroot
werk dat om uiteenlopende redenen is blijven liggen. De producteigenaar wil ze
opgepakt hebben.

Drie pakketten, **gesplitst op waar ze elkaar in de weg zitten** — niet op
omvang. De les uit ronde 2: agents die in dezelfde bestanden werken kosten meer
aan merges dan ze aan parallelliteit opleveren.

Drie agents, drie rondes. Elke ronde is één oplevering per agent; daarna
reviewt en merget de lead.

| Ronde | Agent 1 |
| --- | --- |
| 1 | Antwoord automatisch tonen · middel |
| 2 | Speler die weggaat · klein |
| 3 | Host wijzigt naam/kleur ander · klein |

| Ronde | Agent 2 |
| --- | --- |
| 1 | Continentfilter · middel |
| 2 | Home scrollt 13 px · klein |

| Ronde | Agent 3 |
| --- | --- |
| 1 | Redis-testrace · middel |
| 2 | Contrastcontrole · klein |
| 3 | Solo overleeft reload · middel |

De marktplaats-notitie verhuizen doet de lead zelf.
**Odd-one-out op kleurpatroon is geschrapt**: dat vraagt kleurannotatie
per échte vlag — 230 stuks — en dat is contentwerk dat thuishoort bij G2 (de
contourgame), waar we de landenpool tóch ingaan.

## Waarom deze verdeling

E is de enige die het protocol raakt. M1, K3 en K4 zitten alle drie in
`room-lifecycle.mjs`, `socket.mjs`, `server/protocol/` en de hostbalk; ze
splitsen over meerdere agents betekent gegarandeerd conflicten in precies die
bestanden. Eén agent doet ze achter elkaar.

Agent 2 en 3 raken agent 1 nergens: 2 zit in de vraagselectie en de lobby-instellingen, 3
in tests, contrast en de soloflow.

## Twee besluiten die de lead al genomen heeft

Zodat niemand hoeft te wachten. Beide staan uitgeschreven in de briefing die ze
raakt.

1. **"Antwoord automatisch tonen" botst met besluit 1** ("één hostactie per ronde"): zet je "antwoord
   automatisch tonen" uit, dan **ís het onthullen de hostactie**. Daarna loopt
   het door naar de volgende vraag. Eén knop per ronde, besluit 1 blijft staan.
2. **Het continentfilter botst met odd_one_out** (dat minstens twee continenten nodig heeft):
   **geen harde ondergrens.** Kiest een host één continent, dan valt "welke
   hoort er niet bij" terug op de echt-of-nep-logica — die heeft geen
   continenten nodig. Geen foutmelding, geen beperking.

## Werkafspraken

Ongewijzigd t.o.v. `../README.md`: Nederlands, `npm test` groen houden,
`devkit check-autonomy --staged` vóór elke commit, **niet pushen**, en bij elk
stoppunt de diff + testuitslag + een afvinklijst inleveren.

Eén ding is nieuw en geldt voor iedereen: **`server/` mag deze ronde wél**, mits
je briefing het noemt. In ronde 2 was dat verboden omdat het pure UX-werk was.

Meetgereedschap staat er: `tools/meet-viewport.mjs <url> <home|lobby|spel|tussenstand|podium>`
(390×650), `tools/meet-boxen.mjs`, `tools/meet-timer.mjs`.
