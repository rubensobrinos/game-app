# 7 — `room-lifecycle.mjs` opsplitsen (1057 regels)

**Geen gedragsverandering.**

## Waarom

Dit is het meest omstreden bestand van het project: het continentfilter, "host
wijzigt naam/kleur", de spelersidentiteit en het onderscheid tussen een
verlopen en een onbekende room moeten er alle vier in. Zolang het één bestand
is, kan daar één klus tegelijk aan werken.

**Pas beginnen als die klussen klaar zijn.** Anders verhuis jij code die een
ander op datzelfde moment aan het wijzigen is.

## Wat je opsplitst

Zestien exports, netjes per handeling — de naad ligt voor het oprapen:

| Nieuw bestand | Exports |
| --- | --- |
| `room/configuratie.mjs` | `resolveGameConfiguration`, `updateConfig` |
| `room/aanmaken.mjs` | `createRoom`, `claimLocators`, `buildJoinUrl`, `getShareInfo`, `previewInvite` |
| `room/deelnemers.mjs` | `joinRoom`, `leaveRoom`, `kickPlayer`, `renamePlayer`, `recolorPlayer` |
| `room/sessie.mjs` | `resolveSession` |
| `room/levensduur.mjs` | `touchRoom`, `setRoomLocked` |

De naamverwerking (`resolveNames`, de koppeling met `name-processing.js`) hoort
bij `deelnemers`.

## Let op

**`touchRoom` verlengt de TTL en dat is een reparatie van vandaag.** Een room
verdween na vier uur omdat de vindsleutels (`room:code:*`, `room:invite:*`)
niet werden verlengd tijdens het spelen. `match-lifecycle.mjs` roept `touchRoom`
aan bij elke fase-overgang. Die aanroep moet blijven werken — het is de reden
dat de pilot kan doorgaan.

**`claimLocators` heeft een pogingenlus.** Roomcodes worden willekeurig
gekozen en kunnen botsen; die lus is geen boilerplate. Verplaats hem
letterlijk.

## Hoe je oplevert

`npm test` groen, inclusief de Redis-varianten
(`REDIS_URL=redis://127.0.0.1:6380`) en de integratietests. Toon in je
oplevering expliciet dat de TTL-test nog groen is.

## Niet doen

- `match-lifecycle.mjs` aanraken — dat is opdracht 8.
- De volgorde van validaties binnen een functie wijzigen. Die bepaalt welke
  foutcode een client krijgt, en daar zitten tests op.

## Prompt

> Je werkt in de repo `game-app` (Rounda). Controleer dat `npm test` draait. Lees `docs/openstaand/refactor/7-room-lifecycle.md` en voer dat uit: `server/composition/room-lifecycle.mjs` opsplitsen per handeling, zonder gedragsverandering. De zestien exports blijven exact gelijk, ook hun importpad voor aanroepers. Let op `touchRoom` (de TTL-reparatie die de pilot mogelijk maakt) en op de pogingenlus in `claimLocators`. Draai naast `npm test` ook de Redis-varianten met `REDIS_URL=redis://127.0.0.1:6380` en toon dat de TTL-test groen is. Blijf uit `server/composition/match-lifecycle.mjs`. Nederlands. Er werken meer agents in deze map: stage en commit alleen je eigen bestanden, nooit `git add -A`. `devkit check-autonomy --staged` vóór elke commit. Niet pushen. Stop als je klaar bent en lever op.
