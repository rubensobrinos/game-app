# Prompt — M4: Client→server event-schema's

Dekt fase **M4** uit [`../README.md`](../README.md) (§Fasering), gesplitst in de
sub-batches **M4a**, **M4b**, **M4c** en **M4d** zoals daar beschreven. Vereist dat
**M0** (locatie bevestigd), **M1** (envelope/idempotentie), **M2**
(foutcode-enum) en **M3** (REST-schema's, `auth-shape`, `input-safety`) al zijn
afgerond — dit plan bouwt voort op de daar opgeleverde modules en herhaalt ze
niet. Dit promptbestand is zelfstandig leesbaar: geen kennis van een eerder
gesprek is nodig.

Je werkt in de repo `game-app`. Lees voor je begint:

- [`docs/multiplayer/PROTOCOL.md`](../../multiplayer/PROTOCOL.md), secties
  **Basisregels** (met name regel 3 en 7), **Client → server events**,
  **Idempotentie van antwoorden** en **Foutcodes**.
- [`docs/protocol-plan/README.md`](../README.md), met name Uitgangspunt 3
  (autonomie-limieten), Uitgangspunt 4 (server is autoritair → validators
  weigeren actief), de beschrijving van de module `client-events` in de tabel
  **Modules en endpoints**, en de volledige fasering van **M4** inclusief de
  vier sub-batches.

Er bestaat nog geen `package.json` in deze repo (zie README, Uitgangspunt 2).
Schrijf platte JavaScript (`.mjs`) met JSDoc-typering, geen TypeScript, en test
met `node:test` + `node:assert` tegen fakes — geen nieuwe dependencies.

## Brondocument

Uit `PROTOCOL.md` §Basisregels:

> 3. Bearer tokens worden niet in iedere eventpayload herhaald.
>
> 7. Onbekende serverevents mogen clients negeren; onbekende clientevents
>    leveren `UNSUPPORTED_EVENT`.

Uit §Client → server events (volledige tabel, 12 events — bepaalt de volgorde
van de sub-batches hieronder):

| Event | Vereiste rol | Payload | Belangrijkste validatie |
| --- | --- | --- | --- |
| `game:start` | host | `{}` | fase LOBBY, minimaal één speler |
| `game:pause` | host | `{ reason?: string }` | actieve game |
| `game:resume` | host | `{}` | fase PAUSED |
| `game:next` | host | `{}` | host-tempo en wachtfase |
| `game:lock` | host | `{ locked: boolean }` | room bestaat |
| `game:kick` | host | `{ playerId }` | speler bestaat, niet zichzelf als enige host |
| `game:finish` | host | `{}` | niet reeds FINISHED |
| `game:rematch` | host | `{}` | fase FINISHED |
| `player:rename` | player | `{ displayName }` | alleen lobby, maximaal eenmaal |
| `player:leave` | player | `{}` | actieve sessie |
| `round:answer` | player | zie hieronder | ronde actief, speelgerechtigd, niet eerder geantwoord |
| `share:opened` | host/player | `{ method: "qr" \| "link" \| "native" }` | analytics, mag falen zonder UX-effect |

Uit §`round:answer` (de 5 varianten, letterlijk overgenomen):

```json
// Meerkeuze
{ "roundId": "round_07", "answer": { "optionId": "opt_2" }, "clientAnsweredAt": 1785623418451 }
// Binair
{ "roundId": "round_07", "answer": { "choice": "real" }, "clientAnsweredAt": 1785623418451 }
// Hoger/lager
{ "roundId": "round_07", "answer": { "side": 0 }, "clientAnsweredAt": 1785623418451 }
// Buitenbeentje
{ "roundId": "round_07", "answer": { "cardIndex": 3 }, "clientAnsweredAt": 1785623418451 }
// Typen
{ "roundId": "round_07", "answer": { "text": "Argentinie" }, "clientAnsweredAt": 1785623418451 }
```

> `clientAnsweredAt` is uitsluitend diagnostiek. `receivedAt` op de server
> bepaalt deadline en bonus.

Uit `docs/protocol-plan/README.md` §Fasering, M4:

> Eén validator per event (`game:start` … `share:opened`), inclusief
> rolcontrole (host/player) uit de tabel in §Client → server events, plus vijf
> losse validators voor de `round:answer`-varianten (`optionId`, `choice`,
> `side`, `cardIndex`, `text`) — elk toetst alleen structuur, niet correctheid
> (dat is `GAME-RULES.md`'s validator-module, niet deze).

> - **M4a** — eerste 3-4 client-events (te beginnen bij `game:start`) +
>   rolcontrole-tests.
> - **M4b** — volgende 3-4 client-events + rolcontrole-tests.
> - **M4c** — resterende client-events tot en met `share:opened`, plus
>   `resolveEventValidator(eventName)` — pure lookup die elke eventnaam buiten
>   de bekende 12 herleidt naar `UNSUPPORTED_EVENT` (Basisregel 7), getest met
>   een willekeurige onbekende eventstring.
> - **M4d** — de 5 `round:answer`-varianten (`optionId`, `choice`, `side`,
>   `cardIndex`, `text`) als aparte structuurvalidators.

> Expliciete negatieve test (cross-cutting over alle 17 schema's, hoort bij
> M4c): geen enkel client-eventpayload-schema vereist of accepteert
> stilzwijgend een `sessionToken`/bearer-token-achtig veld (Basisregel 3:
> "Bearer tokens worden niet in iedere eventpayload herhaald") — de token
> reist alleen via de envelope/handshake (`auth-shape`), nooit via de payload
> zelf.

### Niet hier oplossen (Open vragen)

Twee open vragen uit `../README.md` §Open vragen raken dit event-oppervlak
rechtstreeks maar worden in dit plan expliciet **niet** opgelost — het
toevoegen van een veld of het herinterpreteren van `POST /leave` zou een
`public_api`-besluit zijn, geen vertaling van bestaande tekst:

- **§3** — geen proactief `eligible`-veld (bv. in `round:started` of `self`)
  voor late joiners die pas vanaf een volgende ronde mogen meedoen. Dit plan
  valideert `round:answer` daarom uitsluitend reactief (via de bestaande
  rol-/structuurvalidatie; `PLAYER_NOT_ELIGIBLE` wordt elders, op basis van
  roomstate, bepaald), zonder een eligibility-veld te verzinnen in enige
  client-eventpayload.
- **§4** — `POST /leave` specificeert niet of dit de `sessionToken` intrekt, en
  er is geen "verlaten"-statusveld in scoreboard/`game:finished`. De
  `player:leave`-validator hieronder toetst uitsluitend de (lege) payloadvorm
  en rolvereiste; of `player:leave` en `POST /leave` dezelfde
  revocatiesemantiek delen, blijft openstaan voor de `PROTOCOL.md`-eigenaar.

### Ontwerpkeuzes die dit plan wél zelf maakt (vorm, Uitgangspunt 1a)

1. **Strikte schema's.** Elke payloadvalidator wijst onbekende/extra sleutels
   af (geen "silently ignore"). Dit is nodig om de cross-cutting
   Bearer-token-test (M4c) betekenisvol te maken: een schema dat extra
   sleutels stilzwijgend toestaat, zou een `sessionToken`-veld ook stilzwijgend
   doorlaten.
2. **Rolcontrole is een aparte stap vóór payloadvalidatie.** `hasRequiredRole`
   wordt los getest van de payloadvorm, zodat een event met correcte payload
   maar verkeerde rol altijd `NOT_HOST`/`NOT_PLAYER` oplevert, nooit een
   payload-foutcode.
3. **Foutcode bij malformed payload:** alleen voor `round:answer` noemt
   `PROTOCOL.md` expliciet een code (`INVALID_ANSWER_FORMAT`, §Foutcodes).
   Voor de overige 11 events noemt de specificatie geen eigen code voor
   "payload voldoet niet aan schema" — dit plan laat die validators daarom
   `{ ok: false, code: null }` teruggeven (structurele afwijzing zonder
   aangenomen wire-code) en markeert de uiteindelijke codetoewijzing als een
   latere M2/M7-integratievraag, net zoals `assertPayloadSize` in M1 dat al
   doet voor payloadgrootte. Verzin hier geen nieuwe foutcode.

## Sub-batch M4a — `game:start`, `game:pause`, `game:resume`, `game:next`

Bestanden (voorstel binnen `server/protocol/client-events/`, te bevestigen
tegen M0's locatiekeuze): `game-lifecycle-a.mjs`,
`game-lifecycle-a.fixtures.mjs`, `game-lifecycle-a.test.mjs` — 3 bestanden,
ruim binnen het budget van 5 bestanden/400 regels.

```js
/** @typedef {{ ok: true } | { ok: false, code: string | null }} ValidationResult */

/**
 * Controleert of de sessierollen de vereiste rol voor een event dekken.
 * @param {readonly string[]} sessionRoles - bv. session.roles, zie
 *   PROTOCOL.md §Authenticatie en tijdelijke sessies
 * @param {"host" | "player" | "host_or_player"} requiredRole
 * @returns {boolean}
 */
function hasRequiredRole(sessionRoles, requiredRole) {}

/**
 * Valideert de payload van `game:start`. Verwacht een leeg object.
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
function validateGameStartPayload(payload) {}

/**
 * Valideert de payload van `game:pause`.
 * @param {unknown} payload
 * @returns {ValidationResult} `reason` is optioneel; indien aanwezig moet het
 *   een string zijn, anders afwijzing.
 */
function validateGamePausePayload(payload) {}

/**
 * Valideert de payload van `game:resume`. Verwacht een leeg object.
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
function validateGameResumePayload(payload) {}

/**
 * Valideert de payload van `game:next`. Verwacht een leeg object.
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
function validateGameNextPayload(payload) {}
```

Alle vier vereisen rol `"host"`.

## Sub-batch M4b — `game:lock`, `game:kick`, `game:finish`, `game:rematch`

Bestanden (voorstel): `game-lifecycle-b.mjs`, `game-lifecycle-b.fixtures.mjs`,
`game-lifecycle-b.test.mjs`.

```js
/**
 * Valideert de payload van `game:lock`.
 * @param {unknown} payload
 * @returns {ValidationResult} `locked` is verplicht en moet een boolean zijn.
 */
function validateGameLockPayload(payload) {}

/**
 * Valideert de payload van `game:kick`.
 * @param {unknown} payload
 * @returns {ValidationResult} `playerId` is verplicht, niet-lege string. Of de
 *   speler bestaat en niet de enige host is, valt buiten deze
 *   structuurvalidator (vereist roomstate — zie "Niet in scope").
 */
function validateGameKickPayload(payload) {}

/**
 * Valideert de payload van `game:finish`. Verwacht een leeg object.
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
function validateGameFinishPayload(payload) {}

/**
 * Valideert de payload van `game:rematch`. Verwacht een leeg object.
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
function validateGameRematchPayload(payload) {}
```

Alle vier vereisen rol `"host"`.

## Sub-batch M4c — `player:rename`, `player:leave`, `round:answer` (envelopeniveau), `share:opened`, `resolveEventValidator` en de cross-cutting Bearer-test

Bestanden (voorstel): `player-and-dispatch.mjs`,
`player-and-dispatch.fixtures.mjs`, `player-and-dispatch.test.mjs`, plus een
los `no-bearer-field.test.mjs` voor de cross-cutting test — 4 bestanden,
binnen budget.

```js
/**
 * Valideert de payload van `player:rename`. Toetst alleen aanwezigheid en
 * stringtype van `displayName` — NFKC-normalisatie, control-character-
 * verwijdering en de 20-tekenlimiet horen bij `input-safety` (M3), niet hier.
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
function validatePlayerRenamePayload(payload) {}

/**
 * Valideert de payload van `player:leave`. Verwacht een leeg object.
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
function validatePlayerLeavePayload(payload) {}

/**
 * Valideert de envelopevelden van `round:answer` (`roundId`,
 * `clientAnsweredAt` en dat `answer` een niet-lege, niet-array object is). De
 * inhoud van `answer` zelf wordt hier NIET verder gevalideerd — dat gebeurt
 * in M4d door de vijf variant-validators; deze functie behandelt `answer`
 * bewust als ondoorzichtig totdat M4d is opgeleverd (zelfde gelaagde aanpak
 * als M1's `assertPayloadSize` vóór M2's foutcode-toewijzing).
 * @param {unknown} payload
 * @returns {ValidationResult}
 */
function validateRoundAnswerEnvelope(payload) {}

/**
 * Valideert de payload van `share:opened`.
 * @param {unknown} payload
 * @returns {ValidationResult} `method` is verplicht, exact één van
 *   `"qr" | "link" | "native"`.
 */
function validateShareOpenedPayload(payload) {}

/**
 * @typedef {{
 *   validate: (payload: unknown) => ValidationResult,
 *   requiredRole: "host" | "player" | "host_or_player",
 * }} EventValidatorEntry
 */

/**
 * Zoekt de validator en rolvereiste op voor een clientevent-naam. Dit is de
 * enige plek waar de 12 bekende eventnamen worden opgesomd als geldig
 * alfabet — alles daarbuiten levert `UNSUPPORTED_EVENT` op (Basisregel 7),
 * nooit een throw en nooit een stille passthrough.
 * @param {string} eventName
 * @returns {{ ok: true, entry: EventValidatorEntry } | { ok: false, code: "UNSUPPORTED_EVENT" }}
 */
function resolveEventValidator(eventName) {}
```

`round:answer` vereist rol `"player"`; `share:opened` vereist
`"host_or_player"`; `player:rename`/`player:leave` vereisen `"player"`.

### Cross-cutting negatieve test (Basisregel 3)

Geen productiefunctie, maar een verplichte test die over **alle 17 schema's**
(12 events + 5 `round:answer`-varianten uit M4d) heen loopt: neem voor elk
schema een minimale geldige fixture, voeg er telkens één extra sleutel aan toe
uit de set `sessionToken`, `token`, `bearer`, `authorization`
(case-insensitive), en assert dat de validator dat resultaat alsnog afwijst —
dankzij de strikte schema's (zie "Ontwerpkeuzes" hierboven) volstaat dit zonder
dat de validator het veld expliciet bij naam hoeft te kennen.

## Sub-batch M4d — de 5 `round:answer`-varianten

Bestanden (voorstel): `round-answer-variants.mjs`,
`round-answer-variants.fixtures.mjs`, `round-answer-variants.test.mjs`.

```js
/**
 * Valideert de "optionId"-vorm van `round:answer.answer` (meerkeuze).
 * @param {unknown} answer
 * @returns {ValidationResult} `optionId` is verplicht, niet-lege string.
 */
function validateOptionIdAnswer(answer) {}

/**
 * Valideert de "choice"-vorm van `round:answer.answer` (binair).
 * @param {unknown} answer
 * @returns {ValidationResult} `choice` is verplicht, niet-lege string. Geen
 *   vaste enum: PROTOCOL.md geeft alleen het voorbeeld `"real"`, geen
 *   volledige waardenset — vaste waarden zijn (indien nodig) een latere
 *   `GAME-RULES.md`-verantwoordelijkheid, niet deze structuurvalidator.
 */
function validateChoiceAnswer(answer) {}

/**
 * Valideert de "side"-vorm van `round:answer.answer` (hoger/lager).
 * @param {unknown} answer
 * @returns {ValidationResult} `side` is verplicht, geheel getal. Beperking
 *   tot `0 | 1` is een afleiding uit de binaire aard van "hoger/lager" (twee
 *   kaarten), geen letterlijke PROTOCOL.md-waarde — expliciet als zodanig
 *   gecommentarieerd in de implementatie.
 */
function validateSideAnswer(answer) {}

/**
 * Valideert de "cardIndex"-vorm van `round:answer.answer` (buitenbeentje).
 * @param {unknown} answer
 * @returns {ValidationResult} `cardIndex` is verplicht, geheel getal >= 0.
 *   Geen bovengrens: het aantal kaarten is spelinhoud, niet protocolvorm.
 */
function validateCardIndexAnswer(answer) {}

/**
 * Valideert de "text"-vorm van `round:answer.answer` (typen).
 * @param {unknown} answer
 * @returns {ValidationResult} `text` is verplicht, string, na `.trim()`
 *   niet-leeg. Geen maximale lengte hier: dat is generieke payloadgrootte
 *   (M1's `assertPayloadSize`), niet een veldspecifieke regel uit
 *   PROTOCOL.md.
 */
function validateTextAnswer(answer) {}
```

Welke van de vijf variant-validators bij een binnenkomend antwoord hoort (op
basis van het `gameType` van de actieve ronde) is geen vorm-beslissing van dit
event-schema en wordt hier niet bepaald — zie "Niet in scope".

## Verplichte testgevallen

#### M4a

| # | Event/payload | Rol | Verwacht |
| --- | --- | --- | --- |
| 1 | `game:start`, `{}` | host | ok |
| 2 | `game:start`, `{}` | player | `NOT_HOST` |
| 3 | `game:start`, `{ extra: 1 }` | host | afgewezen (extra sleutel) |
| 4 | `game:pause`, `{}` en `{ reason: "host offline" }` | host | beide ok |
| 5 | `game:pause`, `{ reason: 123 }` | host | afgewezen (verkeerd type) |
| 6 | `game:resume`, `{}` | host | ok |
| 7 | `game:next`, `{}` | host | ok |
| 8 | Elk van de vier M4a-events met payload `null`, `[]`, `"string"` | host | stuk voor stuk afgewezen, geen throw |

#### M4b

| # | Event/payload | Rol | Verwacht |
| --- | --- | --- | --- |
| 9 | `game:lock`, `{ locked: true }` en `{ locked: false }` | host | beide ok |
| 10 | `game:lock`, `{ locked: "true" }` | host | afgewezen (string i.p.v. boolean) |
| 11 | `game:kick`, `{ playerId: "p_8f42d1" }` | host | ok |
| 12 | `game:kick`, `{}` en `{ playerId: "" }` | host | beide afgewezen |
| 13 | `game:finish`, `{}` | host | ok |
| 14 | `game:rematch`, `{}` | host | ok |
| 15 | Elk van de vier M4b-events door een sessie met rol `["player"]` | player | stuk voor stuk `NOT_HOST` |

#### M4c

| # | Event/payload | Rol | Verwacht |
| --- | --- | --- | --- |
| 16 | `player:rename`, `{ displayName: "Ruben" }` | player | ok |
| 17 | `player:rename`, `{}` en `{ displayName: 42 }` | player | beide afgewezen |
| 18 | `player:leave`, `{}` | player | ok |
| 19 | `round:answer`-envelope, `{ roundId: "round_07", answer: { optionId: "opt_2" }, clientAnsweredAt: 1785623418451 }` | player | ok (envelopeniveau; `answer`-inhoud niet verder getoetst, zie M4d) |
| 20 | `round:answer`-envelope zonder `roundId`, met `answer: null`, met `answer: []`, met `clientAnsweredAt: "gisteren"` | player | stuk voor stuk afgewezen |
| 21 | `share:opened`, `{ method: "qr" }`, `{ method: "link" }`, `{ method: "native" }` | host, player | alle ok, voor beide rollen |
| 22 | `share:opened`, `{ method: "code" }` | host of player | afgewezen — niet in de drie toegestane waarden (zie Open vraag §6 in `../README.md`, niet hier op te lossen) |
| 23 | `resolveEventValidator("game:start")` … `resolveEventValidator("share:opened")` | n.v.t. | elk van de 12 levert `{ ok: true, entry }` |
| 24 | `resolveEventValidator("room:teleport")` (willekeurige onbekende string) | n.v.t. | `{ ok: false, code: "UNSUPPORTED_EVENT" }` |
| 25 | Cross-cutting: elk van de 17 schema's (12 events + 5 M4d-varianten) met een extra `sessionToken`/`token`/`bearer`/`authorization`-sleutel toegevoegd aan een overigens geldige fixture | n.v.t. | alle 17 afgewezen |

#### M4d

| # | Answer-payload | Verwacht |
| --- | --- | --- |
| 26 | `{ optionId: "opt_2" }` | ok |
| 27 | `{ optionId: "" }`, `{ optionId: 2 }` | beide afgewezen |
| 28 | `{ choice: "real" }`, `{ choice: "fake" }` | beide ok |
| 29 | `{ choice: "" }`, `{ choice: 1 }` | beide afgewezen |
| 30 | `{ side: 0 }`, `{ side: 1 }` | beide ok |
| 31 | `{ side: -1 }`, `{ side: 1.5 }`, `{ side: "0" }` | stuk voor stuk afgewezen |
| 32 | `{ cardIndex: 0 }`, `{ cardIndex: 3 }` | beide ok |
| 33 | `{ cardIndex: -1 }`, `{ cardIndex: 1.5 }` | beide afgewezen |
| 34 | `{ text: "Argentinie" }` | ok |
| 35 | `{ text: "" }`, `{ text: "   " }`, `{ text: 123 }` | stuk voor stuk afgewezen |
| 36 | Elke variant-validator met een tweede, vreemde sleutel erbij (bv. `{ optionId: "opt_2", correctOptionId: "opt_2" }`) | stuk voor stuk afgewezen (strikt schema, zie Ontwerpkeuzes) |

Reken de meervoudige varianten in de tabellen hierboven door tot ruim 40 losse
`node:test`-cases.

## Niet in scope

- **Correctheid van een antwoord** (of `opt_2` het juiste antwoord is, of
  `text` overeenkomt met een land) — `GAME-RULES.md`'s validator-module, niet
  deze.
- **Of de `roundId` bestaat, actief is, en of de speler speelgerechtigd/nog
  niet eerder heeft geantwoord** — dat vereist roomstate en hoort bij het
  latere serverproces, niet bij een pure structuurvalidator. Ook `game:kick`'s
  "speler bestaat, niet zichzelf als enige host" en `game:start`'s "minimaal
  één speler" zijn roomstate-afhankelijk en dus buiten scope van deze
  structuurvalidators.
- **Idempotentie/`actionId`-deduplicatie** — dat is M1's
  `resolveDuplicateAction`, niet dit event-schema.
- **Welke van de vijf M4d-varianten van toepassing is voor een gegeven
  `gameType`** — dat is een dispatch op basis van roomstate/rondecontext
  (`GAME-RULES.md`/het latere serverproces), niet een vorm-beslissing van dit
  schema; dit plan levert vijf onafhankelijke, per-vorm validators, geen
  gameType→variant-mapping.
- **Open vraag §3** (geen proactief `eligible`-veld voor late joiners) en
  **§4** (`POST /leave` vs. `sessionToken`-intrekking, ontbrekend
  "verlaten"-statusveld) uit `../README.md` — expliciet niet hier opgelost;
  zie "Niet hier oplossen" hierboven.
- **Definitieve foutcode voor malformed payload op de 11 niet-`round:answer`-
  events** — zie "Ontwerpkeuzes" hierboven; dit blijft `{ ok: false, code:
  null }` totdat een latere fase (M2-vervolg/M7) dit expliciet aan een van de
  23 codes koppelt.
- Nieuwe dependencies, TypeScript, een echt draaiend serverproces,
  Redis/Postgres — buiten dit plan (zie `../README.md` §Wat hier expliciet
  buiten valt).
- Meer dan 5 bestanden of 400 regels in één actie — splits per sub-batch
  (M4a/M4b/M4c/M4d) zoals hierboven, niet als één commit.

## Definition of done

- Voor elk van de 12 events uit §Client → server events bestaat een
  payloadvalidator en een rolcontrole, gegroepeerd exact in de sub-batches
  M4a/M4b/M4c hierboven.
- `resolveEventValidator` dekt alle 12 bekende eventnamen en levert
  `UNSUPPORTED_EVENT` voor minstens één willekeurige onbekende naam (M4c).
- De 5 `round:answer`-variant-validators uit M4d bestaan los van elkaar en los
  van `validateRoundAnswerEnvelope` (M4c).
- De cross-cutting Bearer-token-test loopt over alle 17 schema's (12 + 5) en
  slaagt voor elk (M4c).
- Alle rijen uit de tabel "Verplichte testgevallen" slagen, per sub-batch.
- Geen enkel sub-batch-commit overschrijdt 5 bestanden of 400 regels
  (CLAUDE.md-autonomiegrens).
- Open vragen §3 en §4 zijn benoemd in het opleververslag, niet stilzwijgend
  opgelost.
