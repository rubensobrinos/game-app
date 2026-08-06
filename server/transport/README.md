# `server/transport/` — HTTP en websockets

De buitenkant van de server: REST voor het aanmaken en joinen, een websocket
voor alles daarna.

**Deze laag praat, hij beslist niet.** Elke spelregel staat in
`server/composition/`; hier gebeurt de vertaling van en naar de lijn. Komt er
een regel in dit mapje terecht, dan bestaat hij op twee plekken.

## Wat waar staat

| Map/bestand | Waarover |
| --- | --- |
| `rest.mjs` | de HTTP-routes, foutcodes naar statuscodes, logging |
| [`socket/`](socket/) | de websocketlaag, opgesplitst per verantwoordelijkheid |
| `socket.mjs` | voordeur van `socket/` — exporteert dezelfde zeven namen door |
| `metrics.mjs` | tellers en meters, achter een eigen secret |
| `safe-logger.mjs` | logt nooit een token, naam of IP-adres |

## Drie dingen die vastliggen

**Absolute tijdstippen, nooit tikken over de lijn.** Een client krijgt "deze
ronde eindigt om 12:04:31", geen aftelling. Zo blijft een trage verbinding een
weergaveprobleem in plaats van een spelprobleem.

**De ack gaat vóór de broadcast.** Wie antwoordt, ziet zijn eigen bevestiging
nooit ná het bericht dat erdoor veroorzaakt werd. Dat is bewust en er zit een
integratietest op die eerder één op de tien keer omviel toen die volgorde
anders werd afgedwongen.

**Geen tweede fasetabel.** De fasepomp doet één compositie-aanroep per
overgang. De vraag "welke fase komt hierna" hoort in `match/fases.mjs`.

## Waar je op moet letten

`metrics.mjs` draait alleen met `METRICS_SECRET` in de omgeving; zonder dat
geeft `/metrics` een 404 en telt er niets. Dat is expres — een open
metrics-eindpunt vertelt een vreemde hoeveel mensen er meespelen.
