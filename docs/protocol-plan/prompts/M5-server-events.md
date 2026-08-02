# Prompt — M5: Server→client event-schema's & snapshot

Dekt fase **M5** uit [`../README.md`](../README.md) (§Fasering), gesplitst in
de sub-batches **M5a**, **M5b**, **M5c**, **M5d** en **M5e** zoals daar
beschreven. Vereist dat **M0** (locatie bevestigd), **M1**
(envelope/idempotentie), **M2** (foutcode-enum) en **M3** (REST-schema's,
`auth-shape`) al zijn afgerond, en bij voorkeur ook **M4** (client-events) —
dit plan bouwt voort op de daar opgeleverde modules en herhaalt ze niet. Dit
promptbestand is zelfstandig leesbaar: geen kennis van een eerder gesprek is
nodig.

Je werkt in de repo `game-app`. Lees voor je begint:

- [`docs/multiplayer/PROTOCOL.md`](../../multiplayer/PROTOCOL.md), secties
  **State-snapshot**, **Server → client events**, **Voorbeeld
  `round:started`** en **Foutcodes**.
- [`docs/protocol-plan/README.md`](../README.md), met name Uitgangspunt 3
  (autonomie-limieten), Uitgangspunt 4 (server is autoritair → validators
  weigeren actief), Uitgangspunt 5 ("ik bepaal geen inhoud, alleen vorm"), de
  beschrijving van de modules `snapshot` en `server-events` in de tabel
  **Modules en endpoints**, en de volledige fasering van **M5** inclusief de
  vijf sub-batches en de ingebedde open vragen.

Er bestaat nog geen `package.json` in deze repo (zie README, Uitgangspunt 2).
Schrijf platte JavaScript (`.mjs`) met JSDoc-typering, geen TypeScript, en test
met `node:test` + `node:assert` tegen fakes — geen nieuwe dependencies.

## Brondocument

Uit §State-snapshot (minimale structuur, letterlijk):

```json
{
  "protocolVersion": "v1",
  "serverTime": 1785623412000,
  "room": {
    "code": "482917",
    "phase": "ROUND_ACTIVE",
    "locked": false,
    "allowLateJoin": true,
    "joinUrl": "https://play.aseso.nl/j/N4x7pQm2K8tW",
    "playerCount": 23,
    "config": {},
    "matchId": "match_01J..."
  },
  "self": {
    "roles": ["player"],
    "playerId": "p_8f42d1",
    "effectiveName": "Ruben",
    "score": 600,
    "position": 7,
    "answeredCurrentRound": false
  },
  "currentRound": {},
  "scoreboard": {
    "top": [],
    "self": {}
  }
}
```

> Een snapshot bevat nooit het correcte antwoord van een actieve ronde.

Uit §Server → client events (volledige tabel, 16 events — bepaalt de volgorde
van de sub-batches hieronder):

| Event | Ontvangers | Kernpayload |
| --- | --- | --- |
| `room:state` | één sessie | volledige snapshot |
| `room:player-changed` | room | count + join/leave/rename/kick-delta |
| `room:lock-changed` | room | `locked` |
| `game:started` | room | `matchId`, `totalRounds`, `countdownEndsAt` |
| `game:paused` | room | reden, vorige fase |
| `game:resumed` | room | nieuwe countdown/tijden |
| `round:started` | room | vraag, opties, tijden |
| `round:answer-accepted` | één speler | `roundId` |
| `round:progress` | room | `answeredCount`, `eligiblePlayerCount` |
| `round:ended` | room + persoonlijke velden | correct antwoord, verdeling, eigen punten |
| `scoreboard:updated` | room + persoonlijke velden | top 5, eigen positie |
| `game:finished` | room + persoonlijke velden | podium, eigen samenvatting |
| `game:rematch-started` | room | nieuwe `matchId`, lobby-state |
| `session:kicked` | één sessie | reden |
| `session:revoked` | één sessie | reden |
| `error` | relevante sessie | foutcode + veilige metadata |

> `round:progress` wordt maximaal tweemaal per seconde gebroadcast.

Uit §Voorbeeld `round:started` (het enige server-event met een volledig
uitgewerkt JSON-voorbeeld in `PROTOCOL.md` — de overige 15 events hebben
alleen de proza-samenvatting uit de "Kernpayload"-kolom hierboven):

```json
{
  "event": "round:started",
  "eventId": "evt_01J...",
  "serverTime": 1785623411900,
  "payload": {
    "matchId": "match_01J...",
    "roundId": "round_07",
    "roundNumber": 7,
    "totalRounds": 10,
    "gameType": "real_or_fake_flag",
    "contentVersion": "2026.08.1",
    "question": {
      "promptKey": "btnRealOrFakePrompt",
      "image": {
        "kind": "generated_flag",
        "seed": "fx_91b2",
        "rendererVersion": "flag-renderer-1",
        "spec": { "pattern": "nordic", "palette": ["#003082", "#FFFFFF", "#CE1126"] }
      },
      "options": [
        { "optionId": "real", "labelKey": "btnReal" },
        { "optionId": "fake", "labelKey": "btnFake" }
      ]
    },
    "startsAt": 1785623412000,
    "endsAt": 1785623427000
  }
}
```

> De juiste optie is niet afleidbaar uit ID, volgorde, URL, seed of metadata.

Uit §Foutcodes, clientresponse (letterlijk — het enige `error`-voorbeeld):

```json
{
  "event": "error",
  "eventId": "evt_01J...",
  "serverTime": 1785623412000,
  "payload": { "actionId": "act_01J...", "code": "ROOM_LOCKED", "meta": {} }
}
```

Uit `docs/protocol-plan/README.md` §Fasering, M5:

> Eén validator per event (`room:state` … `error`), plus de losse
> snapshot-shape-validator voor `GET /state` en `room:state`.

> - **M5a** — eerste batch server-events (te beginnen bij `room:state`) +
>   ontvangersregel-tests.
> - **M5b** — tweede batch server-events + ontvangersregel-tests.
> - **M5c** — derde batch server-events + ontvangersregel-tests.
> - **M5d** — resterende server-events tot en met `error`, plus de
>   snapshot-shape-validator en de expliciete invariant-test "een snapshot
>   bevat nooit het correcte antwoord van een actieve ronde" als testbare
>   pure functie (fake-snapshot in, boolean/assert uit) — dit is letterlijk
>   een genoemd contracttest-punt in `DEPLOYMENT-AND-TESTING.md`.
> - **M5e** — `throttleRoundProgress(store, roundId, now)`: pure
>   beslisfunctie die bepaalt of een volgende `round:progress`-broadcast is
>   toegestaan, met een test die aantoont dat bij een reeks aanroepen binnen
>   één seconde voor dezelfde ronde nooit meer dan 2 emissies worden
>   toegestaan (§Server → client events: "maximaal tweemaal per seconde").
>   Dit is een pure teller/klok-functie op basis van een geïnjecteerde klok;
>   het daadwerkelijk plannen en versturen van de broadcast zelf hoort bij
>   het latere serverproces, niet bij dit plan.

### Niet hier oplossen (Open vragen)

Drie open vragen uit `../README.md` §Open vragen raken dit event-oppervlak
rechtstreeks maar worden in dit plan expliciet **niet** opgelost — het
toevoegen van een enum-waarde, veld of eigenaarschap zou een
`public_api`-besluit zijn, geen vertaling van bestaande tekst:

- **§2** — `game:paused.reason` is een vrije string, geen enum, en dekt
  minstens vier situaties: host-disconnect na 60 s → auto-tempo, drie
  opeenvolgende lege rondes, expliciete hostpauze, én een serverherstart
  (`GAME-FLOW.md` edge case #14) waarna actieve rooms automatisch gepauzeerd
  en later automatisch hervat worden met een korte nieuwe countdown. De
  client kan geen van deze vier onderscheiden, en of het vierde geval als
  live `game:paused`-broadcast reist of uitsluitend zichtbaar wordt via
  `room.phase` in de post-reconnect snapshot is evenmin vastgelegd. De M5b-
  validator voor `game:paused` hieronder toetst daarom alleen dat `reason`
  een string is (geen enum-afwijzing van onbekende waarden) — een striktere
  toets zou een van de vier scenario's stilzwijgend bevoordelen.
- **§10** — `question`-payloadvorm is alleen voor multiple-choice uitgewerkt
  (zie het `round:started`-voorbeeld hierboven); de andere vier spelvormen
  (binair, hoger/lager, buitenbeentje, typen) hebben geen gespecificeerde
  vraag-payload. De M5b-validator voor `round:started` hieronder valideert
  daarom de envelopevelden (`matchId`, `roundId`, `roundNumber`,
  `totalRounds`, `gameType`, `contentVersion`, `startsAt`, `endsAt`) altijd,
  en de `question`-vorm strikt volgens het voorbeeld alleen wanneer die
  overeenkomt met de multiple-choice-vorm (`promptKey` + `options[]`); voor
  elk ander gevonden `question`-object accepteert de validator een generiek
  object zonder diepere structuurtoets en markeert dat expliciet als
  onvolledig, in plaats van een vorm voor de andere vier spelvormen te
  verzinnen.
- **§11** — "Verdeling" (antwoordverdeling) in `round:ended` heeft geen
  genoemde eigenaar: protocol-aggregatie over ruwe antwoorden, of een
  GAME-RULES-outputveld? De M5c-validator voor `round:ended` hieronder
  toetst daarom alleen de velden waarover geen twijfel bestaat (`roundId`,
  `correctAnswer` als ondoorzichtig object, `ownPoints` als getal) en laat de
  exacte vorm van een eventueel `distribution`/"verdeling"-veld ongevalideerd
  totdat dit is vastgesteld.

### Ontwerpkeuzes die dit plan wél zelf maakt (vorm, Uitgangspunt 1a)

1. **Literaal vs. voorgesteld.** Alleen `room:lock-changed` (`locked`),
   `game:started` (`matchId`, `totalRounds`, `countdownEndsAt`),
   `round:started` (volledig voorbeeld), `round:answer-accepted` (`roundId`),
   `round:progress` (`answeredCount`, `eligiblePlayerCount`),
   `game:rematch-started` (`matchId`) en `error` (`actionId`, `code`, `meta`)
   hebben een letterlijke veldnaam of volledig voorbeeld in `PROTOCOL.md`. De
   overige velden (bv. `room:player-changed`'s delta-vorm, `game:paused`'s
   `previousPhase`, `game:resumed`'s timingvelden, `scoreboard:updated` en
   `game:finished`'s exacte vorm) zijn een **voorstel**, direct afgeleid van
   de proza in de "Kernpayload"-kolom — geen letterlijke vertaling. Elke
   validator hieronder benoemt expliciet of hij literaal of voorgesteld is.
2. **Strikte schema's waar de vorm literaal vastligt, coulanter waar
   voorgesteld.** Voor literaal vastgelegde velden wijst de validator
   onbekende sleutels af. Voor voorgestelde velden (waar `PROTOCOL.md` geen
   volledige vorm geeft) accepteert de validator ook een breder object en
   toetst alleen de wél genoemde velden — een strikter schema zou hier zelf
   een `public_api`-besluit worden.
3. **Ontvangersregel is een losse lookup, geen broadcast-implementatie.**
   `resolveRecipientRule` beslist alleen "wie zou dit moeten ontvangen"
   (`single_session` | `room` | `room_with_personal_fields`), niet hoe een
   echte Socket.IO-room dat daadwerkelijk verzendt.

## Sub-batch M5a — `room:state`, `room:player-changed`, `room:lock-changed`, `game:started`

Bestanden (voorstel binnen `server/protocol/server-events/`, te bevestigen
tegen M0's locatiekeuze): `room-and-lifecycle-a.mjs`,
`room-and-lifecycle-a.fixtures.mjs`, `room-and-lifecycle-a.test.mjs`.

```js
/** @typedef {{ ok: true } | { ok: false, code: string | null }} ValidationResult */
/** @typedef {"single_session" | "room" | "room_with_personal_fields"} RecipientRule */

/**
 * Geeft de ontvangersregel voor een serverevent terug — een pure naslag op
 * de tabel in §Server → client events, geen daadwerkelijke broadcast/emit.
 * @param {string} eventName
 * @returns {RecipientRule | null} `null` wanneer `eventName` onbekend is.
 */
function resolveRecipientRule(eventName) {}

/**
 * Valideert de payload van `room:state`. Dit is voorlopig een ondiepe
 * plaatshoudercontrole (niet-leeg object); de volledige snapshot-vorm wordt
 * pas in M5d opgeleverd via `validateSnapshotShape`, waar `room:state`'s
 * payload exact dezelfde vorm als de snapshot heeft en dus dezelfde
 * validator hergebruikt — zelfde gelaagde aanpak als M4c/M4d voor
 * `round:answer`.
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
function validateRoomStatePayload(payload) {}

/**
 * Valideert de payload van `room:player-changed`. Voorgesteld (geen
 * letterlijk voorbeeld in `PROTOCOL.md`, zie Ontwerpkeuzes #1): telt als
 * geldig wanneer `playerCount` een niet-negatief geheel getal is en
 * `delta.type` één van `"join" | "leave" | "rename" | "kick"` en
 * `delta.playerId` een niet-lege string is.
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
function validateRoomPlayerChangedPayload(payload) {}

/**
 * Valideert de payload van `room:lock-changed`. Literaal: `locked` verplicht,
 * boolean.
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
function validateRoomLockChangedPayload(payload) {}

/**
 * Valideert de payload van `game:started`. Literaal: `matchId` (string),
 * `totalRounds` (positief geheel getal), `countdownEndsAt` (epoch-ms getal)
 * — alle drie verplicht.
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
function validateGameStartedPayload(payload) {}
```

Ontvangers: `room:state` → `single_session`; de overige drie → `room`.

## Sub-batch M5b — `game:paused`, `game:resumed`, `round:started`, `round:answer-accepted`

Bestanden (voorstel): `round-lifecycle-b.mjs`, `round-lifecycle-b.fixtures.mjs`,
`round-lifecycle-b.test.mjs`.

```js
/**
 * Valideert de payload van `game:paused`. `reason` is verplicht en moet een
 * string zijn — géén enum-toets op de waarde (zie Open vraag §2: minstens
 * vier scenario's delen dit veld en zijn client-zijdig niet te
 * onderscheiden). `previousPhase` is voorgesteld (proza "vorige fase", geen
 * letterlijke veldnaam) en moet, indien aanwezig, een van de bekende
 * matchfasen zijn (`ARCHITECTURE.md`: `LOBBY | COUNTDOWN | ROUND_ACTIVE |
 * ROUND_RESULT | SCOREBOARD | PAUSED | FINISHED`, hier alleen als
 * stringlijst gebruikt — geen state-machine-kennis).
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
function validateGamePausedPayload(payload) {}

/**
 * Valideert de payload van `game:resumed`. Voorgesteld (proza "nieuwe
 * countdown/tijden", geen letterlijk voorbeeld): minimaal `countdownEndsAt`
 * (epoch-ms getal), naar analogie van `game:started`.
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
function validateGameResumedPayload(payload) {}

/**
 * Valideert de payload van `round:started` tegen het volledige, letterlijke
 * voorbeeld uit `PROTOCOL.md`. Envelopevelden (`matchId`, `roundId`,
 * `roundNumber`, `totalRounds`, `gameType`, `contentVersion`, `startsAt`,
 * `endsAt`) zijn altijd verplicht en getypeerd. `question` wordt alleen
 * strikt gevalideerd tegen de multiple-choice-vorm (`promptKey`: string,
 * `options`: array van `{ optionId: string, labelKey: string }`, `image` als
 * ondoorzichtig object) — voor elke andere `gameType` wordt `question`
 * geaccepteerd als niet-leeg object zonder diepere toets (zie Open vraag
 * §10, hier niet opgelost).
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
function validateRoundStartedPayload(payload) {}

/**
 * Valideert de payload van `round:answer-accepted`. Literaal: `roundId`
 * verplicht, niet-lege string.
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
function validateRoundAnswerAcceptedPayload(payload) {}
```

Ontvangers: `round:answer-accepted` → `single_session`; de overige drie →
`room`.

## Sub-batch M5c — `round:progress`, `round:ended`, `scoreboard:updated`, `game:finished`

Bestanden (voorstel): `scoring-c.mjs`, `scoring-c.fixtures.mjs`,
`scoring-c.test.mjs`.

```js
/**
 * Valideert de payload van `round:progress`. Literaal: `answeredCount` en
 * `eligiblePlayerCount` verplicht, beide niet-negatieve gehele getallen, met
 * `answeredCount <= eligiblePlayerCount`.
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
function validateRoundProgressPayload(payload) {}

/**
 * Valideert de payload van `round:ended`. Voorgesteld voor het gedeelte dat
 * niet ter discussie staat: `roundId` (string, verplicht), `correctAnswer`
 * (niet-leeg object, ondoorzichtig — vorm hoort bij `GAME-RULES.md`) en
 * `ownPoints` (niet-negatief getal). Een eventueel `distribution`-veld
 * ("verdeling") wordt hier bewust NIET gevalideerd (zie Open vraag §11,
 * hier niet opgelost) — aanwezigheid ervan mag de validator niet laten
 * falen, maar de vorm ervan wordt ook niet getoetst.
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
function validateRoundEndedPayload(payload) {}

/**
 * Valideert de payload van `scoreboard:updated`. Hergebruikt de letterlijke
 * `scoreboard`-vorm uit §State-snapshot (`{ top: [], self: {} }`): `top`
 * moet een array zijn, `self` een object.
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
function validateScoreboardUpdatedPayload(payload) {}

/**
 * Valideert de payload van `game:finished`. Voorgesteld (proza "podium,
 * eigen samenvatting"): `podium` als array, `self` als niet-leeg object —
 * geen diepere toets op de inhoud van beide (spelinhoud/scoring, niet vorm).
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
function validateGameFinishedPayload(payload) {}
```

Ontvangers: alle vier `room_with_personal_fields` (§Server → client events:
"room + persoonlijke velden").

## Sub-batch M5d — `game:rematch-started`, `session:kicked`, `session:revoked`, `error`, snapshot-shape-validator en de snapshot-invariant

Bestanden (voorstel): `session-and-error-d.mjs`,
`session-and-error-d.fixtures.mjs`, `session-and-error-d.test.mjs`,
`snapshot-shape.mjs`, `snapshot-shape.test.mjs` — 5 bestanden, exact op het
budget; splits in twee acties (event-validators eerst, snapshot-module
apart) als 400 regels anders wordt overschreden.

```js
/**
 * Valideert de payload van `game:rematch-started`. `matchId` is literaal
 * (backtick-genoemd in de tabel); `lobbyState` is voorgesteld (proza
 * "lobby-state") als niet-leeg object, zonder diepere toets.
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
function validateGameRematchStartedPayload(payload) {}

/**
 * Valideert de payload van `session:kicked`. Voorgesteld: `reason` verplicht,
 * niet-lege string.
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
function validateSessionKickedPayload(payload) {}

/**
 * Valideert de payload van `session:revoked`. Voorgesteld: `reason`
 * verplicht, niet-lege string — zelfde vorm als `session:kicked`, want
 * `PROTOCOL.md` geeft voor beide alleen "reden" op.
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
function validateSessionRevokedPayload(payload) {}

/**
 * Valideert de payload van `error`, tegen het letterlijke voorbeeld uit
 * §Foutcodes. Toetst alleen de VORM (`actionId`: string, `code`: string,
 * `meta`: object); toetst niet of `code` een van de 23 bekende waarden is
 * (dat is een M2-contracttest) en niet of `meta` verboden velden bevat (dat
 * is M2's `buildErrorPayload`, al elders getest).
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
function validateErrorPayload(payload) {}

/**
 * Valideert de volledige snapshot-vorm (gebruikt door zowel `GET
 * /api/v1/games/{code}/state` als `room:state`), tegen de letterlijke
 * structuur uit §State-snapshot: `protocolVersion`, `serverTime`, `room`
 * (met `code`, `phase`, `locked`, `allowLateJoin`, `joinUrl`, `playerCount`,
 * `config`, `matchId`), `self`, `currentRound`, `scoreboard` (met `top`,
 * `self`).
 * @param {unknown} snapshot
 * @returns {ValidationResult}
 */
function validateSnapshotShape(snapshot) {}

/**
 * Invariant-toets: "een snapshot bevat nooit het correcte antwoord van een
 * actieve ronde." Wanneer `snapshot.room.phase === "ROUND_ACTIVE"`, moeten
 * de sleutels van `snapshot.currentRound` een subset zijn van de bekende
 * veilige sleutels uit het `round:started`-voorbeeld (`matchId`, `roundId`,
 * `roundNumber`, `totalRounds`, `gameType`, `contentVersion`, `question`,
 * `startsAt`, `endsAt`) — een allowlist in plaats van een denylist van
 * verboden namen (`correctOptionId`, `correctAnswer`, …), zodat een
 * onbekend/nieuw correctheidsveld niet per ongeluk toch doorglipt.
 * @param {unknown} snapshot
 * @returns {ValidationResult}
 */
function assertNoActiveRoundAnswerLeak(snapshot) {}
```

Ontvangers: `game:rematch-started` → `room`; `session:kicked` en
`session:revoked` → `single_session`; `error` → `single_session` ("relevante
sessie").

## Sub-batch M5e — `throttleRoundProgress`

Bestanden (voorstel): `throttle-round-progress.mjs`,
`throttle-round-progress.test.mjs`.

```js
/** @typedef {{ emittedAtMs: number[] }} ThrottleRecord */
/** @typedef {{ get(roundId: string): ThrottleRecord | undefined }} ThrottleStore */

/**
 * Beslist of een volgende `round:progress`-broadcast voor deze ronde is
 * toegestaan op tijdstip `now`, gegeven eerdere emissies in `store`. Muteert
 * `store` niet — bij `allow: true` slaat de aanroeper het teruggegeven,
 * bijgewerkte record zelf op. Houdt maximaal 2 emissies per rollend
 * venster van 1000 ms per `roundId` aan (§Server → client events:
 * "maximaal tweemaal per seconde").
 * @param {ThrottleStore} store
 * @param {string} roundId
 * @param {number} now - epoch-ms, altijd door de aanroeper geleverd
 * @returns {{ allow: true, record: ThrottleRecord } | { allow: false }}
 */
function throttleRoundProgress(store, roundId, now) {}
```

## Verplichte testgevallen

#### M5a

| # | Event/payload | Verwacht |
| --- | --- | --- |
| 1 | `resolveRecipientRule("room:state")` | `"single_session"` |
| 2 | `resolveRecipientRule("room:player-changed")`, `resolveRecipientRule("room:lock-changed")`, `resolveRecipientRule("game:started")` | elk `"room"` |
| 3 | `resolveRecipientRule("room:teleport")` (onbekend) | `null` |
| 4 | `validateRoomStatePayload({})` en `validateRoomStatePayload(null)` | resp. ok (plaatshouder) en afgewezen |
| 5 | `{ playerCount: 23, delta: { type: "join", playerId: "p_8f42d1" } }` | ok |
| 6 | `{ playerCount: -1, ... }`, `delta.type: "teleport"`, `delta.playerId: ""` | stuk voor stuk afgewezen |
| 7 | `{ locked: true }`, `{ locked: false }` | beide ok |
| 8 | `{ locked: "true" }`, `{}` | beide afgewezen |
| 9 | `{ matchId: "match_01J...", totalRounds: 10, countdownEndsAt: 1785623412000 }` | ok |
| 10 | ontbrekend `matchId`, `totalRounds: 0`, `totalRounds: -1`, `countdownEndsAt: "straks"` | stuk voor stuk afgewezen |

#### M5b

| # | Event/payload | Verwacht |
| --- | --- | --- |
| 11 | `{ reason: "host_disconnect" }`, `{ reason: "server_restart" }` (elk van de vier scenario's uit Open vraag §2, geen van alle als foutieve waarde behandeld) | alle ok |
| 12 | `{ reason: 123 }`, `{}` | beide afgewezen |
| 13 | `{ countdownEndsAt: 1785623412000 }` | ok |
| 14 | `{ countdownEndsAt: "straks" }` | afgewezen |
| 15 | Het volledige `round:started`-voorbeeld uit `PROTOCOL.md` (letterlijk, zie Brondocument) | ok |
| 16 | Zelfde voorbeeld zonder `question.options`, zonder `startsAt`, met `endsAt < startsAt` | stuk voor stuk afgewezen (structuur; `endsAt < startsAt` is een expliciete vormcontrole, geen tijdslogica) |
| 17 | Zelfde voorbeeld met `gameType: "higher_or_lower"` en een `question`-object dat niet aan de multiple-choice-vorm voldoet (bv. alleen `{ promptKey: "x" }` zonder `options`) | ok — geaccepteerd als generiek object, niet dieper getoetst (Open vraag §10) |
| 18 | `{ roundId: "round_07" }` | ok |
| 19 | `{}`, `{ roundId: "" }`, `{ roundId: 7 }` | stuk voor stuk afgewezen |

#### M5c

| # | Event/payload | Verwacht |
| --- | --- | --- |
| 20 | `{ answeredCount: 3, eligiblePlayerCount: 5 }` | ok |
| 21 | `{ answeredCount: 5, eligiblePlayerCount: 3 }` (meer beantwoord dan gerechtigd), negatieve waarden, ontbrekend veld | stuk voor stuk afgewezen |
| 22 | `{ roundId: "round_07", correctAnswer: { optionId: "opt_2" }, ownPoints: 120 }` | ok |
| 23 | zelfde fixture met extra `distribution: { opt_1: 4, opt_2: 9 }` erbij | ok — extra veld verandert de uitkomst niet (Open vraag §11, hier niet gevalideerd noch afgewezen) |
| 24 | ontbrekend `roundId`, `ownPoints: -5` | stuk voor stuk afgewezen |
| 25 | `{ top: [{ playerId: "p_1", score: 900 }], self: { position: 4 } }` | ok |
| 26 | `top` als object i.p.v. array, `self` ontbrekend | stuk voor stuk afgewezen |
| 27 | `{ podium: [{ playerId: "p_1" }], self: { score: 900 } }` | ok |
| 28 | `podium` als string, `self` ontbrekend | stuk voor stuk afgewezen |

#### M5d

| # | Event/payload | Verwacht |
| --- | --- | --- |
| 29 | `{ matchId: "match_01J...", lobbyState: {} }` | ok |
| 30 | ontbrekend `matchId`, `lobbyState: null` | stuk voor stuk afgewezen |
| 31 | `{ reason: "kicked_by_host" }` (`session:kicked`), `{ reason: "session_revoked_elsewhere" }` (`session:revoked`) | beide ok |
| 32 | `{}` voor beide events | beide afgewezen |
| 33 | Het letterlijke `error`-voorbeeld uit `PROTOCOL.md` (`{ actionId, code: "ROOM_LOCKED", meta: {} }`) | ok |
| 34 | ontbrekend `actionId`, `code` als getal, `meta` als array | stuk voor stuk afgewezen |
| 35 | `validateSnapshotShape` tegen het volledige, letterlijke snapshot-voorbeeld uit `PROTOCOL.md` | ok |
| 36 | zelfde voorbeeld zonder `room.phase`, zonder `scoreboard.top`, met `self` als array | stuk voor stuk afgewezen |
| 37 | `assertNoActiveRoundAnswerLeak` met `room.phase: "ROUND_ACTIVE"` en `currentRound` gelijk aan het veilige `round:started`-voorbeeld (alleen de bekende sleutels) | ok |
| 38 | zelfde, maar met een extra sleutel `correctOptionId: "opt_2"` in `currentRound` | afgewezen — invariant geschonden |
| 39 | zelfde, maar met `room.phase: "SCOREBOARD"` (geen actieve ronde) en `currentRound: {}` | ok — invariant is alleen van toepassing tijdens `ROUND_ACTIVE` |

#### M5e

| # | Scenario | Verwacht |
| --- | --- | --- |
| 40 | Twee aanroepen voor dezelfde `roundId` binnen 1000 ms | beide `allow: true` |
| 41 | Een derde aanroep voor dezelfde `roundId` binnen hetzelfde venster van 1000 ms | `allow: false` |
| 42 | Een aanroep voor dezelfde `roundId` net ná het verstrijken van het venster (bv. `now + 1001`) | `allow: true` |
| 43 | Twee verschillende `roundId`'s, elk binnen hun eigen venster | onafhankelijk van elkaar, beide tot 2x `allow: true` |
| 44 | `store` wordt niet gemuteerd door `throttleRoundProgress` zelf | referentie-/deep-equal-check vóór/na |

Reken de meervoudige varianten in de tabellen hierboven door tot ruim 50 losse
`node:test`-cases.

## Niet in scope

- **Correctheid/scoring-inhoud** (of `correctAnswer` klopt, hoe `ownPoints`
  wordt berekend) — `GAME-RULES.md`, niet deze module.
- **De daadwerkelijke broadcast/emit naar een Socket.IO-room** —
  `resolveRecipientRule` levert alleen de regel, geen verzendlogica; dat hoort
  bij het latere serverproces.
- **`question`-payloadvorm voor de vier niet-multiple-choice-spelvormen**
  (Open vraag §10) — expliciet niet hier opgelost; `validateRoundStartedPayload`
  accepteert die vormen ongevalideerd, in plaats van ze te verzinnen.
- **Eigenaarschap en vorm van "verdeling" in `round:ended`** (Open vraag §11)
  — expliciet niet hier opgelost; `validateRoundEndedPayload` valideert dat
  veld niet.
- **Een enum voor `game:paused.reason`** (Open vraag §2) — expliciet niet
  hier opgelost; de validator blijft een generieke stringtoets voor alle vier
  de onderliggende scenario's, inclusief het serverherstart-geval.
- **Het daadwerkelijk plannen/versturen van de `round:progress`-broadcast** —
  `throttleRoundProgress` is een pure teller/klok-beslissing, geen timer of
  scheduler.
- **Of `error.payload.code` een van de 23 bekende foutcodes is** — dat is een
  M2-contracttest (de enum zelf), niet een taak van `validateErrorPayload`
  hier. Evenmin of `meta` verboden velden bevat — dat is al M2's
  `buildErrorPayload`.
- Nieuwe dependencies, TypeScript, een echt draaiend serverproces,
  Redis/Postgres — buiten dit plan (zie `../README.md` §Wat hier expliciet
  buiten valt).
- Meer dan 5 bestanden of 400 regels in één actie — splits per sub-batch
  (M5a–M5e) zoals hierboven, niet als één commit.

## Definition of done

- Voor elk van de 16 events uit §Server → client events bestaat een
  payloadvalidator en een ontvangersregel, gegroepeerd exact in de
  sub-batches M5a/M5b/M5c/M5d hierboven.
- `validateSnapshotShape` en `assertNoActiveRoundAnswerLeak` bestaan als losse
  functies (M5d), met minstens één slagende en één falende invariant-fixture.
- `throttleRoundProgress` staat nooit meer dan 2 emissies per rollend venster
  van 1 seconde per `roundId` toe (M5e), aangetoond met een reeks aanroepen
  binnen dat venster.
- Alle rijen uit de tabel "Verplichte testgevallen" slagen, per sub-batch.
- Geen enkel sub-batch-commit overschrijdt 5 bestanden of 400 regels
  (CLAUDE.md-autonomiegrens); M5d wordt zo nodig in twee acties gesplitst.
- Open vragen §2, §10 en §11 zijn benoemd in het opleververslag als bewust
  niet opgelost, niet stilzwijgend dichtgetimmerd.
