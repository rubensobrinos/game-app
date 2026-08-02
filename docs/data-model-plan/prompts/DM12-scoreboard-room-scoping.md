# Prompt — DM12: `getScoreboardTop` expliciet op (roomId, matchId) keyen

Onderdeel van [`docs/data-model-plan/README.md`](../README.md), fase DM12.
Afhankelijk van DM6 (`in-memory-store.js`). Reactie op
[`docs/integration-plan/HANDOFF-INTB.md`](../../integration-plan/HANDOFF-INTB.md),
INTB-3 (ernst: laag). **Wordt vóór DM11 uitgevoerd** — beide fases wijzigen de
Map-structuur van dezelfde `in-memory-store.js`; DM12 zet hier de
nested-Map-conventie neer die DM11 vervolgens hergebruikt voor zijn eigen
sleutels (zie [`DM11-room-scoped-round-answer.md`](DM11-room-scoped-round-answer.md)).
Geen inhoudelijke afhankelijkheid — puur bedoeld om editconflicten in
hetzelfde bestand te voorkomen.

**Herzien na een eigen reviewronde, vóór uitvoering.** De richting was
correct; alleen de sleutelconstructie is aangepast (zie hieronder).

## Wat er ontbreekt

De fake bewaart het scoreboard in `scoreboardByMatchId`, gekeyed op **alleen**
`matchId` (`in-memory-store.js:36`), terwijl de methode wél een `roomId`
ontvangt en de echte Redis-sleutel — `scoreboardKey(roomId, matchId)` uit
`redis-keys.js` — op beide keyt. Zolang `matchId` toevallig globaal uniek is,
is het verschil onobserveerbaar; zo niet, dan geeft de fake een ander
resultaat dan de echte adapter zou geven.

## Beslissing

**Op beide keyen** — niet aannemen dat `matchId` globaal uniek is.

**Sleutelconstructie: geneste Map, geen samengestelde string.** Een eerdere
versie van dit voorstel gebruikte `` `${roomId} ${matchId}` `` als
Map-sleutel. Dat is fout: `assertNonEmptyString`/`assertRoomShape` e.d. sluiten
spaties niet uit, dus twee verschillende `(roomId, matchId)`-paren kunnen in
theorie op dezelfde samengestelde string uitkomen (bijv. `"room 1"` +
`"matchA"` versus `"room"` + `"1 matchA"`). `redis-keys.js`'s eigen
`assertSegment` bestaat precies om deze klasse fout te voorkomen voor echte
Redis-sleutels; de in-memory fake verdient dezelfde discipline voor zijn
eigen, interne sleutels. Oplossing: **geneste Maps**
(`Map<roomId, Map<matchId, Map<playerId, score>>>`) — geen stringconcatenatie,
dus geen enkel scheidingsteken om ooit mee te botsen.

## Stappen

### 1. `server/data/in-memory-store.js`

- `scoreboardByMatchId` (Map`<matchId, Map<playerId, score>>`) vervangen door
  `scoreboardByRoom` (Map`<roomId, Map<matchId, Map<playerId, score>>>`).
- `saveAcceptedAnswerAtomically`: de scoreboard-write leest/creëert eerst
  `scoreboardByRoom.get(roomId)` (of maakt een nieuwe Map als die nog niet
  bestaat), daarbinnen `get(matchId)` (idem), en zet daar `playerId → score`.
- `getScoreboardTop(roomId, matchId, limit)`: leest via dezelfde geneste
  structuur. Signatuur ongewijzigd — had `roomId` al, gebruikte hem alleen nog
  niet voor de key.

### 2. Tests (`repository.test.js`)

- **Scoping-bewijs**: twee verschillende rooms met — bewust in de test
  geconstrueerd — hetzelfde `matchId`, elk met een eigen speler en score, via
  `saveAcceptedAnswerAtomically` opgeslagen. `getScoreboardTop(roomA, matchX,
  10)` bevat alleen roomA's speler, `getScoreboardTop(roomB, matchX, 10)`
  alleen roomB's speler.
- Regressie: bestaande scoreboard-tests (één room, één match) blijven
  ongewijzigd slagen.

## Harde grenzen

- Geen signatuurwijziging aan `getScoreboardTop` of `saveAcceptedAnswerAtomically`.
- Geen wijziging aan `repository.js` — dit raakt uitsluitend de
  fake-implementatie.
- Geen samengestelde string-sleutels (spatie, `\0` of anderszins) — geneste
  Maps, zoals hierboven beschreven.
- 1 bestand gewijzigd (`in-memory-store.js`) + uitbreiding van
  `repository.test.js`.

## Definition of done

- Scoreboard-opslag in de fake is een geneste Map op `(roomId, matchId)`, geen
  samengestelde string-sleutel.
- Test bewijst dat twee rooms met eenzelfde (test-geconstrueerde) `matchId`
  onafhankelijke scoreboards hebben.
- `node --test 'server/data/**/*.test.js'` slaagt.
- [`HANDOFF.md`](../HANDOFF.md) krijgt een regel: INTB-3 beantwoord — "op
  beide keyen" gekozen, `matchId`-globale-uniciteit is geen aanname waar de
  fake (of een toekomstige adapter) op mag leunen.
