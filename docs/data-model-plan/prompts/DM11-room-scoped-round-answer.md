# Prompt — DM11: Room-scoping op Round/Answer + action-cache-lookup

Onderdeel van [`docs/data-model-plan/README.md`](../README.md), fase DM11.
Afhankelijk van DM3 (`types/round.js`, `types/answer.js`), DM6
(`repository.js`/`in-memory-store.js`), DM7 (`answer-flow.js`) en **DM12**
(uitgevoerd vóór dit bestand — zet de nested-Map-conventie voor
`in-memory-store.js`'s interne sleutels neer, die hier wordt hergebruikt; geen
inhoudelijke afhankelijkheid, alleen editvolgorde in hetzelfde bestand). Reactie
op [`docs/integration-plan/HANDOFF-INTB.md`](../../integration-plan/HANDOFF-INTB.md),
INTB-1.

**Herzien na een eigen reviewronde, vóór uitvoering — richting omgedraaid.**
De eerste versie van dit bestand koos INTB-1's richting 2 (`roomId` op
`Round`, `roomId`+`matchId` op `Answer`). Die review wees terecht op een
correctheidsgat: nieuwe velden die de bestaande relatie (`Round.matchId` →
`Match.roomId`) dupliceren, zonder een echte integriteitscontrole tegen het
brondocument — alleen een check dat de nieuwe velden intern met elkaar
overeenkwamen, niet dat ze klopten met de werkelijke match/room. Dat opent
precies de inconsistentie (`Round.roomId` kan afwijken van de kamer van
`Round.matchId`) die deze fase juist had moeten voorkomen. Bovendien is het
toevoegen van velden aan canonieke documenttypes een grotere ingreep dan het
leek: het raakt `DATA-MODEL.md` zelf en daarmee `database_schema` (`devkit
policy` → `require_adr_for`), niet alleen de repositorypoort. Deze versie kiest
daarom **uitsluitend INTB-1's richting 1: de poortsignaturen verbreden.** Geen
enkel documenttype verandert.

## Wat er ontbreekt

`redis-keys.js` bouwt `roundKey(roomId, matchId, roundId)`,
`answersKey(roomId, matchId, roundId)` en `actionCacheKey(roomId)` — alle drie
vereisen `roomId`. Drie poortmethoden krijgen dat niet mee: `saveRound(round)`
(Round heeft `matchId`, geen `roomId`), `loadAnswer(roundId, playerId)` (geen
`roomId`, geen `matchId`), `loadActionCacheEntry(actionId)` (geen `roomId`).
`loadRound(roomId, matchId, roundId)` krijgt het wél — lees- en schrijfkant van
hetzelfde document zijn dus asymmetrisch. De huidige fake verbergt dit:
`saveRound` doet een lineaire scan over alle matches om `roomId` te
achterhalen (`in-memory-store.js:108-123`) en werpt `RangeError` als de match
nog niet bestaat; `loadAnswer`/`loadActionCacheEntry` gebruiken globale,
ongescopede Maps.

## Beslissing: alleen de poort verbreden, geen nieuwe velden op de types

- **`saveRound(round)` → `saveRound(roomId, round)`.** De aanroeper geeft
  `roomId` expliciet mee als parameter, niet als veld op `Round`. `Round`
  blijft ongewijzigd (nog steeds alleen `matchId`, geen `roomId`).
- **`loadAnswer(roundId, playerId)` → `loadAnswer(roomId, matchId, roundId,
  playerId)`.** Dit kán niet via richting 2: je kunt geen `roomId`/`matchId`
  van een `Answer` lezen die je nog moet ophalen.
- **`loadActionCacheEntry(actionId)` → `loadActionCacheEntry(roomId,
  actionId)`.** Zelfde reden.
- **`saveAcceptedAnswerAtomically(roomId, matchId, write)` — signatuur
  ongewijzigd.** Had `roomId`/`matchId` al als parameter. `write.answer`
  krijgt **geen** nieuwe velden — `Answer` blijft exact de vorm uit DM3
  (`roundId, playerId, actionId, answer, receivedAt, responseTimeMs, correct,
  points`).
- **Integriteit blijft bestaan, wordt alleen goedkoper.** De vorige versie liet
  `saveRound` de matchcontrole helemaal vallen ("orphan rounds toestaan
  verzwakt de integriteit" — terechte correctie). `saveRound(roomId, round)`
  controleert nog steeds dat er een `Match` bestaat met dit `roomId` +
  `round.matchId`, en werpt anders `RangeError` — nu een directe lookup (via de
  DM12-nested-Map-conventie, zie hieronder) in plaats van de huidige O(n)-scan.
  Zelfde foutcontract als vandaag, alleen niet meer op een scan gebaseerd.
- **Waarom niet richting 2 (of 1+2 gecombineerd):** een gedupliceerde relatie
  (`Round.roomId` naast `Round.matchId`, terwijl `Match.roomId` al bestaat)
  is een nieuwe plek waar twee velden uit elkaar kunnen lopen, en de enige
  manier om dat te voorkomen is een integriteitscheck tegen het echte
  `Match`-document — op dat moment heb je de match al geladen en is het losse
  veld overbodig. Richting 1 heeft dat probleem structureel niet: er is maar
  één plek waar `roomId` vandaan komt (de aanroeper, die het al van de echte
  `Room`/`Match` heeft), nooit een tweede, potentieel afwijkende kopie.

## Stappen

### 0. Consumers opnieuw opzoeken, niet aannemen

Vóór het wijzigen: `rg "saveRound\(|loadAnswer\(|loadActionCacheEntry\(|loadRoomByInviteId\("`
over de hele repo (niet alleen `server/data/`) om alle aanroepplekken te
vinden. Op het moment van schrijven van dit voorstel zijn dat uitsluitend
`server/data/repository.test.js`-regels (geverifieerd) — maar dat kan
gewijzigd zijn tegen de tijd dat dit wordt uitgevoerd, dus de vaste lijst
hieronder is een uitgangspunt, geen garantie.

### 1. `server/data/repository.js`

Signatuurwijzigingen in de `DataStore`-JSDoc-typedef en de bijbehorende
implementatie-aanroepen: `saveRound`, `loadAnswer`, `loadActionCacheEntry`
zoals hierboven. `DATA_STORE_METHOD_NAMES` verandert niet (dezelfde
methodenamen, alleen andere parameters — geen aanpassing aan de lijst nodig).

### 2. `server/data/in-memory-store.js`

- `matchesByKey`, `roundsByKey`, `answersByKey`, `actionCacheByActionId`
  worden geneste Maps in plaats van met spaties samengestelde string-sleutels
  — zelfde reden en zelfde patroon als
  [`DM12-scoreboard-room-scoping.md`](DM12-scoreboard-room-scoping.md):
  `assertNonEmptyString` sluit spaties niet uit, dus een samengestelde
  `` `${a} ${b}` ``-sleutel kan in theorie botsen tussen twee verschillende
  paren. Voorstel: `matchesByKey`: `Map<roomId, Map<matchId, Match>>`;
  `roundsByKey`: `Map<roomId, Map<matchId, Map<roundId, Round>>>`;
  `answersByKey`: `Map<roomId, Map<matchId, Map<roundId, Map<playerId,
  Answer>>>>`; `actionCacheByActionId` → `actionCacheByRoom`: `Map<roomId,
  Map<actionId, entry>>`.
- `saveRound(roomId, round)`: `matchesByKey.get(roomId)?.get(round.matchId)`
  moet bestaan, anders `RangeError` (zelfde foutcontract als vandaag, nu een
  directe lookup). Slaagt de check, dan wegschrijven onder
  `roundsByKey.get(roomId).get(round.matchId).set(round.id, ...)` (Maps
  aanmaken waar nog nodig).
- `loadAnswer(roomId, matchId, roundId, playerId)`: geneste lookup, `null` als
  een tussenstap ontbreekt.
- `loadActionCacheEntry(roomId, actionId)`: geneste lookup via
  `actionCacheByRoom`.
- `saveAcceptedAnswerAtomically`: schrijft `Answer` en de action-cache-entry
  via de geneste structuren, met de al-beschikbare `roomId`/`matchId`-
  parameters — geen nieuwe velden op `write.answer` nodig om te weten wáár het
  moet landen.

### 3. `server/data/answer-flow.js`

**Geen wijziging.** `Answer` krijgt geen nieuwe velden, dus `resolveAnswer`'s
`write.answer`-literal blijft exact zoals vandaag.

### 4. Documentatie — `DECISIONS.md` #30 expliciet maken (ongewijzigd t.o.v. de vorige versie)

Geen gedragswijziging: `setRoomAndMatchPhaseAtomically` in `repository.js` en
`in-memory-store.js` krijgt een commentaarregel die letterlijk benoemt dat
`Match.phase` autoritair is en `Room.phase` een afgeleide projectie, bijgewerkt
in dezelfde atomaire operatie (`DECISIONS.md` #30, bevestigd 2 augustus 2026).

### 5. Tests

- `repository.test.js`:
  - `saveRound(roomId, round)` slaagt als de bijbehorende `Match` bestaat bij
    dat `roomId`; werpt `RangeError` als de `Match` niet bestaat, of als hij
    bestaat bij een ANDER `roomId` (bewijst dat de integriteitscheck niet
    stilzwijgend verdwenen is, alleen sneller is geworden);
  - `loadAnswer(roomId, matchId, roundId, playerId)` voor een onbekende
    combinatie → `null`; na `saveAcceptedAnswerAtomically` → de opgeslagen
    `Answer`;
  - **scoping-bewijs**: twee verschillende rooms met — bewust in de test
    geconstrueerd — hetzelfde `actionId` krijgen elk hun eigen
    `loadActionCacheEntry`-resultaat;
  - **collision-bewijs (nested-Map, DM12-patroon)**: een `roomId`/`matchId`
    met een spatie erin (bijv. test-fixture `"room 1"` + `"1 matchA"` versus
    `"room"` + `"1 1 matchA"`) botst niet — dit zou met de oude
    string-sleutel wél kunnen.
- `answer-flow.test.js`: geen inhoudelijke wijziging nodig (write-vorm blijft
  gelijk); alleen controleren dat bestaande tests nog steeds tegen de nieuwe
  `saveAcceptedAnswerAtomically`-aanroepvorm slagen (die had `roomId`/`matchId`
  al, dus dit zou geen aanpassing mogen vergen — expliciet verifiëren, niet
  aannemen).

## Harde grenzen

- **Geen nieuwe velden op `Round` of `Answer`** — dit is de kernbeslissing van
  deze herziening, niet optioneel.
- Geen extra Redis-indexen (richting 3 uit INTB-1 blijft afgewezen).
- Geen wijziging aan `server/rules/` of bestanden van een ander plan.
- Geen samengestelde string-sleutels met een scheidingsteken (spatie, `\0` of
  anderszins) in `in-memory-store.js` — uitsluitend geneste Maps.
- `saveRound`'s matchintegriteitscontrole blijft bestaan (geen orphan rounds).
- 4 bestanden gewijzigd (`repository.js`, `in-memory-store.js`, plus eventuele
  aanpassingen aan `answer-flow.js`/`answer-flow.test.js` als stap 0's
  `rg`-zoekopdracht toch een aanroepplek buiten de hier genoemde bestanden
  vindt) + testbestanden.

## Definition of done

- `saveRound`, `loadAnswer`, `loadActionCacheEntry` hebben de verbrede
  signaturen; `Round`/`Answer`-typedefs zijn **ongewijzigd**.
- `in-memory-store.js`'s interne sleutels zijn geneste Maps, geen
  samengestelde strings — met een test die een botsingsscenario expliciet
  weerlegt.
- `saveRound`'s matchintegriteitscontrole is behouden en getest (bestaand
  gedrag, nu O(1) i.p.v. een scan).
- `answer-flow.js` blijft ongewijzigd; expliciet geverifieerd (niet
  aangenomen) dat zijn tests nog slagen.
- `node --test 'server/data/**/*.test.js'` slaagt.
- [`HANDOFF.md`](../HANDOFF.md) krijgt een regel: INTB-1 beantwoord, alleen
  richting 1 (signaturen verbreed), met de motivatie waarom richting 2 is
  afgewezen; expliciete waarschuwing dat INT-B's conformance-suite de
  `saveRound`-scan-aanname (niet het `RangeError`-gedrag zelf, dat blijft
  bestaan) moet bijwerken.
