# `server/composition/` — de domeinlaag

Hier woont wat er in een partij gebeurt: een room aanmaken, joinen, een match
starten, een ronde openen en sluiten, punten toekennen, herstellen na een
serverherstart.

**Deze laag beslist. De transportlaag praat alleen.** `server/transport/`
vertaalt HTTP en websockets naar een aanroep hierheen en het antwoord weer
terug; hij bevat zelf geen spelregel. Loopt een regel toch de transportlaag in,
dan bestaat hij op twee plekken en lopen ze uit elkaar.

## Wat waar staat

| Map/bestand | Waarover |
| --- | --- |
| [`room/`](room/) | rooms, spelers, sessies, configuratie, TTL |
| [`match/`](match/) | fases, rondes, antwoorden, stand, snapshot, herstel |
| `room-lifecycle.mjs` | voordeur van `room/` — exporteert dezelfde namen door |
| `match-lifecycle.mjs` | voordeur van `match/` — idem |
| `content-source.mjs` | bouwt de vraag van een ronde uit de landenpool |
| `context.mjs` | de drie ingangen (store, klok, config), hard gevalideerd bij opstarten |

De twee voordeuren blijven bestaan zodat geen enkel importpad veranderde toen
de bestanden werden opgesplitst. Wie iets toevoegt, zet het in de submap en
exporteert het door.

## Drie regels die hier gelden

**De server is de enige die de waarheid kent.** Een client krijgt een
momentopname, nooit een reeks gebeurtenissen om zelf na te spelen.

**Eén plek per uitspraak.** Een positie in de stand komt uit
`shared/rules/ranking.mjs` en nergens anders; wat speelbaar is staat in
`shared/content/game-catalog.mjs` en nergens anders. Dat is geen netheid maar
ervaring: allebei hebben ooit op drie plekken gestaan en zijn uit elkaar
gelopen.

**Wat vluchtig is, wordt niet opgeslagen.** `phaseEndsAt` bestaat alleen in het
antwoord; het staat nooit in een document. Anders overleeft een verlopen
deadline een serverherstart.

## Waar je op moet letten

De volgorde van validaties binnen een functie bepaalt wélke foutcode een client
krijgt, en daar zitten tests op. Verplaats ze niet zonder reden.
