# Rounda

Een party-quiz over de wereld die je met je telefoon speelt. Iemand maakt een
game aan, deelt een QR-code of een link, en de rest doet mee — geen account,
geen installatie, geen app-store. Binnen tien seconden speel je.

Live op **[rounda.io](https://rounda.io)**.

## De zes games

| Game | Wat je doet |
| --- | --- |
| Raad de vlag | Je ziet een vlag en kiest het land |
| Echt of nep | Bestaat deze vlag echt, of is hij verzonnen? |
| Welke hoort er niet bij | Vier vlaggen, één valt uit de toon |
| Raad het land | Je ziet de omtrek van een land |
| Hoofdsteden | Wat is de hoofdstad van Peru — en omgekeerd: Lima hoort bij welk land? |
| Hoger of lager | Twee landen: welk heeft er meer van iets? |

230 landen, drie talen (Nederlands, Engels, Spaans).

## Draaien

```bash
npm install
npm start          # server op :3000, frontend erbij
npm test           # de volledige suite
```

Zonder server spelen kan ook: open `/samen?mock=1` en de hele keten wordt
nagebootst in je browser. Dat is ook hoe "Alleen spelen" werkt.

Voor productie draait alles in Docker Compose — zie `docker-compose.yml` en
`docs/STATUS.md` voor het deploycommando.

## Hoe het in elkaar zit

| Map | Wat |
| --- | --- |
| `server/` | Node + Fastify + Socket.IO. De server bepaalt wat waar is |
| `frontend/` | De app die je op je telefoon ziet — geen framework |
| `shared/` | Wat server en browser allebei nodig hebben, o.a. de landenpool |
| `client/flow/` | Pure regels die aan beide kanten hetzelfde moeten uitpakken |
| `tests/` | Integratietests over echte HTTP en echte websockets |
| `docs/` | Zie hieronder |
| `tools/` | Meetgereedschap, draait niet mee in de suite |

De architectuur staat in [`docs/multiplayer/ARCHITECTURE.md`](docs/multiplayer/ARCHITECTURE.md).
De kern ervan: de server is de enige die de waarheid kent, een client krijgt
een momentopname en geen herhaalde gebeurtenissen, en er zijn geen accounts —
een sessie leeft zolang de room leeft.

## Documentatie

Begin bij [`docs/README.md`](docs/README.md). Dat legt de vier lagen uit:
wat canoniek is, wat er nog open staat, wat historisch is, en wat gearchiveerd.

Bij twijfel wint [`docs/multiplayer/`](docs/multiplayer/) van alles, en
[`docs/STATUS.md`](docs/STATUS.md) van elk voortgangsbestand.

## De oude solo-app

In de wortel staan nog `index.html`, `app.js` en `style.css`: de
oorspronkelijke singleplayer-quiz waar dit uit voortkomt. Die draait zonder
server — open het bestand en het werkt. Hij wordt niet meer doorontwikkeld,
maar leeft nog als `/solo` en levert nog steeds contentdata aan de nieuwe app
(zie [`data/README.md`](data/README.md)).
