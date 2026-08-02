# Prompt — DM2b: `RoomCore` (Room minus `contentVersion`/`rendererVersion`)

Onderdeel van [`docs/data-model-plan/README.md`](../README.md), fase DM2b.
Afhankelijk van DM0. Onafhankelijk van DM2a (los uit te voeren, geen gedeelde
bestanden), maar bouwt qua aanpak op dezelfde traceability-discipline voort.

**Herzien na [`REVIEW-DM2-DM9.md`](REVIEW-DM2-DM9.md).** Twee correcties: het
type heet nu `RoomCore`, niet `Room` (bevinding 9 — een shape-check die twee
canonieke velden structureel niet kent, mag niet doen alsof hij het canonieke
type bewijst), en `phase` wordt lokaal getranscribeerd i.p.v. geïmporteerd uit
`server/architecture/state-machine.js` (bevinding 10, zelfde fix als DM2a's
`pacing` en DM3's `Match.phase`).

## Context — de letterlijke bron, met één opzettelijk gat

`docs/multiplayer/DATA-MODEL.md`, sectie "Room":

```json
{
  "id": "room_01J...",
  "code": "482917",
  "inviteId": "N4x7pQm2K8tW",
  "phase": "LOBBY",
  "createdAt": 1785620000000,
  "lastActivityAt": 1785623412000,
  "hostSessionIds": ["sess_01J..."],
  "locked": false,
  "config": {},
  "currentMatchId": null,
  "contentVersion": "2026.08.1",
  "rendererVersion": "flag-renderer-1"
}
```

> `Room.phase` is een gedupliceerde, snel leesbare projectie van de actuele
> matchfase. De autoritatieve fase voor een lopende game staat in `Match.phase`;
> updates gebeuren atomair. — letterlijk uit `DATA-MODEL.md`.

**`contentVersion` en `rendererVersion` worden in deze fase NIET gebouwd.**
Checkpoint 4 (`README.md` §6) is een nog niet opgeloste cross-doc-tegenstrijdigheid:
`DATA-MODEL.md` zet ze op `Room`, `ARCHITECTURE.md` §6 zegt "iedere match pint:
contentVersion; rendererVersion", en `PROTOCOL.md`'s `round:started`-voorbeeld toont
`contentVersion` op het round-payload. Een keuze maken en die hier vastleggen zou
precies de fout herhalen die `REVIEW.md` bevinding 4 signaleerde.

**Daarom heet dit type `RoomCore`, niet `Room`** (`REVIEW-DM2-DM9.md` bevinding 9).
Een eerdere versie van dit bestand noemde het resultaat gewoon `Room` en liet
`assertRoomShape` objecten mét `contentVersion`/`rendererVersion` ongemerkt door —
dat suggereert ten onrechte dat de check het volledige, canonieke type bewijst.
`RoomCore` is expliciet een tussenvorm: alle velden die niet op checkpoint 4
wachten, niets meer. Zodra checkpoint 4 is opgelost, wordt dit ofwel uitgebreid tot
het echte `Room`-type (als de velden op Room blijken te horen), ofwel blijft het
staan als een bewust kleiner type terwijl de twee velden ergens anders landen (bv.
op `Match`) — die beslissing wordt hier niet vooruitgenomen.

## Stappen

### 1. `server/data/types/room-core.js`

JSDoc-`@typedef RoomCore` met de **tien** niet-omstreden velden, plus
`assertRoomCoreShape(value)`:

- `id`, `code`, `inviteId`: niet-lege strings.
- `phase`: gesloten enum, **lokaal getranscribeerd**:
  ```js
  // Bron: server/architecture/state-machine.js's PHASES-export
  // (ARCHITECTURE.md §State machine). Bewust NIET geïmporteerd: dat bestand is
  // een gedragslaag (transition()-reducer), geen neutrale constantsmodule, en
  // server/data -> server/architecture is de verkeerde richting zodra
  // architecture ooit zelf een repository gebruikt (REVIEW-DM2-DM9.md
  // bevinding 10). Zie HANDOFF.md voor het voorstel van een neutrale gedeelde
  // module; deze lijst moet handmatig in sync blijven totdat die bestaat.
  const ROOM_PHASE_VALUES = Object.freeze([
    'LOBBY', 'COUNTDOWN', 'ROUND_ACTIVE', 'ROUND_RESULT', 'SCOREBOARD',
    'PAUSED', 'FINISHED',
  ]);
  ```
  Dit is dezelfde lijst als DM3 voor `Match.phase` gebruikt — beide bestanden
  transcriberen onafhankelijk van elkaar vanuit dezelfde bron
  (`state-machine.js`), niet van elkaar. Een test (zie hieronder) bewaakt dat de
  twee lokale kopieën niet uit elkaar lopen.
- `createdAt`, `lastActivityAt`: eindige, niet-negatieve getallen (epoch-ms).
- `hostSessionIds`: array van niet-lege strings, **minimaal 1 element verplicht**
  — interpretatie, geen citaat: niets in de spec zegt expliciet dat een room
  zonder hostsessie kan bestaan, maar het voorbeeld toont er precies één.
- `locked`: boolean.
- `config`: moet voldoen aan `assertGameConfigurationShape` uit DM2a — importeer
  die functie, verzin geen tweede validator.
- `currentMatchId`: `string | null`.

### 2. Tests (`room-core.test.js`)

- het voorbeeld hierboven (met `contentVersion`/`rendererVersion` eruit geknipt)
  komt door de shape-check;
- elk van de tien velden faalt afzonderlijk bij afwezigheid;
- `phase` faalt op een waarde buiten `ROOM_PHASE_VALUES`, slaagt op elk van de
  zeven die er wel in zitten;
- **cross-bestand-consistentietest:** `ROOM_PHASE_VALUES` (dit bestand) en de
  lokale fase-lijst in DM3's `match.js` zijn exact gelijk (dezelfde zeven
  waarden, dezelfde volgorde niet vereist maar dezelfde *set*) — deze test
  importeert beide en vergelijkt ze, zodat een toekomstige wijziging aan één
  kant meteen opvalt aan de andere;
- `config` faalt wanneer het meegegeven object zelf een ongeldige
  `GameConfiguration` is (delegatie-test, geen dubbele logica);
- **regressietest die het gat bewaakt:** een object MET
  `contentVersion`/`rendererVersion` erbij komt nog steeds door
  `assertRoomCoreShape` (die velden worden genegeerd, niet gevalideerd, niet
  vereist) — expliciet getest zodat een lezer dit niet als "compleet Room-bewijs"
  leest. De typenaam `RoomCore` (niet `Room`) is de eerste linie hiertegen; deze
  test is de tweede.

## Harde grenzen

- Geen `contentVersion`/`rendererVersion` — niet als veld, niet als validatie.
- Geen `require('../architecture/state-machine')` — de fasewaarden worden lokaal
  getranscribeerd, niet geïmporteerd (zie hierboven, corrigeert de vorige versie
  van dit bestand).
- Het type/de functie heten `RoomCore`/`assertRoomCoreShape`, nergens `Room`/
  `assertRoomShape` zonder kwalificatie — ook niet in commentaar of testnamen.
- 2 bestanden (module + test) — ruim binnen de 15-bestanden-grens.

## Definition of done

- `assertRoomCoreShape` accepteert het spec-voorbeeld minus de twee uitgesloten
  velden, en accepteert het ook mét die velden erbij (genegeerd).
- `ROOM_PHASE_VALUES` is aantoonbaar identiek aan DM3's lokale kopie (test).
- Typenaam is overal `RoomCore`, nooit kaal `Room`.
- `node --test 'server/data/**/*.test.js'` slaagt, inclusief DM1- en DM2a-tests.

**Status: prompt klaar, nog niet uitgevoerd.**
