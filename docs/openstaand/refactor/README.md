# Refactor — de tien grootste bestanden

**Doel: parallel kunnen werken.** Vier bestanden zijn nu zo groot dat bijna
elke klus erin moet zijn, en dat is de reden dat er niet meer dan vijf agents
tegelijk kunnen werken. Dit is geen opruimwerk, het is de rem eraf halen.

**Regel voor alle acht: geen gedragsverandering.** Een verhuizing, geen
herontwerp. Zie je onderweg iets dat beter kan — melden, niet meenemen.

| # | Bestand | Was | Nu | Stand |
| --- | --- | --: | --: | --- |
| 1 | `base.css` + `components.css` | 2421 | 9 bestanden | af |
| 2 | `index.mjs`, redis, analytics | 3591 | 3 gesplitst | af |
| 3 | `rounda-1c.css` | 1912 | 10 (facade) | af |
| 4 | `transport-mock.mjs` | 1548 | 651 | af |
| 5 | `session-shell.mjs` | 1169 | 734 | af |
| 6 | `socket.mjs` | 1399 | 369 | af |
| 7 | `room-lifecycle.mjs` | 1057 | 59 | af |
| 8 | `match-lifecycle.mjs` | 1764 | 64 | af |
| 9 | `transport.mjs` | 978 | 59 | af |
| 10 | `rest.test.mjs` | 1120 | — | geschrapt |
| 11 | `views/lobby.mjs` | 1090 | 191 | af |
| 12 | `match-lifecycle.test.mjs` | 2337 | — | geschrapt |
| 13 | `socket.test.mjs` | 1158 | — | geschrapt |
| 14 | `1c-overrides.css` platslaan | — | 0 duplicaten | af |

**De lijst is klaar.** Negen productiebestanden opgesplitst, drie
testbestanden geschrapt, de CSS-overschrijvingen platgeslagen.

Eén ding blijft over en dat is optioneel: `1c-overrides.css` (1571 regels) is
nu splitsbaar maar niet gesplitst. Doe dat pas als twee mensen er tegelijk in
moeten.

Daarna nog, zodra ze vrij zijn: `match-lifecycle.test.mjs` (2337),
`data-store-conformance.mjs` (2218), `redis/data-store.test.mjs` (1695),
`transport-mock.test.mjs` (1161), `socket.test.mjs` (1158) en `lobby.mjs`
(1031, over de grens gegaan door het continentfilter). De testbestanden zijn
samen groter dan de code die ze testen — begin per onderwerp pas aan het
testbestand als de bron ervan gesplitst is.

Eén bestand per opdracht. Twee van deze in één opdracht betekent dat de agent
halverwege leegloopt en je met een half gesplitste boel achterblijft.

**8 gaat als laatste.** Daar zitten fases, rondes, scoring en herstel in
elkaar, met een testbestand van 2315 regels eromheen. Als er één verhuizing
stil iets kan breken, is het die.

## De testbestanden zijn geschrapt (producteigenaar, 6 aug 2026)

Opdracht 10, 12 en 13 gaan niet door. De documenten blijven staan voor als het
ooit alsnog nodig is, maar ze worden niet ingepland.

**Waarom.** Een groot testbestand blokkeert parallel werk alleen als twee
mensen tegelijk aan dezelfde bron werken — en dan is die bron de rem, niet de
test. Bij `rest.test.mjs` komen twee agents elkaar vrijwel nooit tegen.
Daarbij is elke verhuizing een kans om stil iets te breken; dat is in deze
ronde twee keer bijna gebeurd, en beide keren vonden de tests het niet.

En het maakt het product voor geen enkele speler beter. Het maakt óns sneller,
en dat is alleen winst zolang we nog veel gaan bouwen.

**Wanneer wél.** Zodra een testbestand daadwerkelijk in de weg zit: twee
agents die er tegelijk in moeten, of een merge die erop stukloopt. Dan ligt de
opdracht klaar.
