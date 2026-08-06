# Refactor — de tien grootste bestanden

**Doel: parallel kunnen werken.** Vier bestanden zijn nu zo groot dat bijna
elke klus erin moet zijn, en dat is de reden dat er niet meer dan vijf agents
tegelijk kunnen werken. Dit is geen opruimwerk, het is de rem eraf halen.

**Regel voor alle acht: geen gedragsverandering.** Een verhuizing, geen
herontwerp. Zie je onderweg iets dat beter kan — melden, niet meenemen.

| # | Bestand | Regels | Kan starten |
| --- | --- | --: | --- |
| [1](1-css-base-en-components.md) | `base.css` + `components.css` | 2421 | ja |
| [2](2-serveradapters.md) | `index.mjs` + redis + analytics | 3591 | ja |
| [3](3-rounda-1c-css.md) | `rounda-1c.css` | 1912 | ná het uitslagscherm |
| [4](4-transport-mock.md) | `transport-mock.mjs` | 1548 | ja |
| [5](5-session-shell.md) | `session-shell.mjs` | 1169 | zodra vrij |
| [6](6-socket.md) | `socket.mjs` | 1399 | zodra vrij |
| [7](7-room-lifecycle.md) | `room-lifecycle.mjs` | 1057 | ná ronde 2 |
| [8](8-match-lifecycle.md) | `match-lifecycle.mjs` | 1764 | **als laatste** |
| [9](9-transport-client.md) | `transport.mjs` | 978 | ja |
| [10](10-rest-test.md) | `rest.test.mjs` | 1120 | ja |

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
