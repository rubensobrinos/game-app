# Prompt — M3: REST-schema's, input-safety, auth-shape

Dekt fase **M3** uit [`../README.md`](../README.md#fasering). Vereist dat
**M2** (foutcode-enum) is afgerond: elke afwijzing hieronder retourneert een
code uit `ALL_ERROR_CODES`, nooit een vrije string — zie
[`M2-error-codes.md`](M2-error-codes.md) voor die module. Dit promptbestand is
zelfstandig leesbaar — geen kennis van een eerder gesprek nodig.

## Brondocument

Alles hieronder in deze sectie is een letterlijk citaat uit
[`PROTOCOL.md`](../../multiplayer/PROTOCOL.md), tenzij anders aangegeven.

### §REST-endpoints

`POST /api/v1/games` — "Maakt een room en hostsessie aan."

Request:

```json
{
  "config": {
    "preset": "group_battle",
    "language": "nl"
  },
  "hostParticipates": true,
  "displayName": null
}
```

Response:

```json
{
  "roomId": "room_01J...",
  "gameCode": "482917",
  "inviteId": "N4x7pQm2K8tW",
  "joinUrl": "https://play.aseso.nl/j/N4x7pQm2K8tW",
  "sessionToken": "<secret>",
  "roles": ["host", "player"],
  "playerId": "p_a1b2c3",
  "effectiveName": "Vlugge Vos",
  "state": {}
}
```

"Wanneer `hostParticipates = false` zijn `playerId` en `effectiveName`
`null`."

---

`POST /api/v1/games/join` — "Joinen via code of inviteId." / "Request,
precies één locator:"

```json
{
  "inviteId": "N4x7pQm2K8tW",
  "displayName": null,
  "joinSource": "qr"
}
```

of:

```json
{
  "gameCode": "482917",
  "displayName": "Ruben",
  "joinSource": "code"
}
```

"`joinSource`: `qr | shared_link | code | unknown`."

Response:

```json
{
  "roomId": "room_01J...",
  "gameCode": "482917",
  "sessionToken": "<secret>",
  "roles": ["player"],
  "playerId": "p_8f42d1",
  "effectiveName": "Ruben",
  "state": {}
}
```

---

`GET /api/v1/games/{code}/state` — "Volledige actuele snapshot. Vereist
geldige sessietoken."

`POST /api/v1/games/{code}/leave` — "Vrijwillig verlaten. Vereist
spelerrol."

`GET /api/v1/time` — "Lichtgewicht tijdsync-endpoint:"

```json
{ "serverTime": 1785623412000 }
```

### §Authenticatie en tijdelijke sessies

REST-auth:

```http
Authorization: Bearer <sessionToken>
```

Socket-auth:

```json
{
  "auth": {
    "sessionToken": "<token>",
    "protocolVersion": "v1"
  }
}
```

### §Inputveiligheid

```
- displaynamen worden Unicode NFKC-genormaliseerd;
- control characters en onzichtbare misbruiktekens worden verwijderd;
- maximaal 20 zichtbare tekens;
- server bewaart en verstuurt naam als platte tekst;
- frontend gebruikt nooit `innerHTML` voor gebruikersinput;
- alle payloads worden schema-gevalideerd;
- payloadgrootte wordt begrensd.
```

### `../README.md` — relevante citaten

Fase M3: "`auth-shape`-validator (losstaand van het M8-tokenvoorstel): een
pure vorm-check voor de REST `Authorization: Bearer <token>`-header (correct
prefix, niet-lege tokenstring) en voor de socket-handshake-payload
`{sessionToken, protocolVersion}`, inclusief de `protocolVersion === 'v1'`-
check die bij afwijking `PROTOCOL_VERSION_UNSUPPORTED` (M2) oplevert. Dit is
letterlijk coderen van een reeds vastgelegde vorm (Uitgangspunt 1a) — geen
tokenbeslissing — en dus zelfstandig uit te voeren, onafhankelijk van en vóór
het M8-voorstel voor generatie/hashing."

Fase M3, vervolg: "Waar `GET /{code}/state` en `POST /{code}/leave` 'vereist
geldige sessietoken' schrijven, leunt dat hier op deze vorm-check; de
daadwerkelijke geldigheidscontrole tegen een echte sessiestore hoort bij het
latere serverproces, niet bij dit plan."

Fase M3, vervolg: "`joinSource`/`joinUrl` worden gevalideerd en doorgegeven
als opake velden; de constructie van `joinUrl` (basis-URL + `inviteId`) en de
opslag van `joinSource` richting analytics zijn niet hier belegd — zie Open
vragen §5–6."

Open vragen §5: "`joinUrl`-constructie (basis-URL + `inviteId`) staat nergens
gespecificeerd — waar komt de basis-URL vandaan (config/env)? Relevant voor
M3."

Open vragen §6: "`joinSource`/`share:opened.method` (incl. `\"native\"`)
hebben geen gedocumenteerd pad naar de Postgres-analytics-aggregaten. Niet
blokkerend voor schema-validatie in M3, wel voor een latere analytics-fase
buiten dit plan. [...] M3/M4 valideren `method` vooralsnog ongewijzigd (3
waarden); of `method` een vierde waarde krijgt die `joinSource` spiegelt, is
aan de `PROTOCOL.md`-eigenaar om te beslissen."

## Te bouwen functies

Voorgestelde locatie: `server/protocol/` (of de bij protocol-plan's eigen
M0-checkpoint bevestigde map — `../README.md`, fase M0), verdeeld over de drie
modules uit de modulestabel: `rest-games`, `input-safety`, `auth-shape`. Native
ESM, platte JavaScript met JSDoc-typering, geen TypeScript
(`../README.md`, Uitgangspunt 2). Test met `node:test` + `node:assert`. Dit is
meer dan 5 bestanden aan validators + fixtures + tests bij elkaar — groepeer
per module (`input-safety` los, `auth-shape` los, `rest-games`-requests en
-responses eventueel gesplitst) en verdeel over meerdere commits binnen de
autonomie-limiet (`CLAUDE.md`: max 5 bestanden/400 regels per actie).

Alle validators delen dit resultaattype:

```js
/**
 * @template T
 * @typedef {{ ok: true, value: T } | { ok: false, code: ErrorCode }} ValidationResult
 */
/** @typedef {import('../error-codes.mjs').ErrorCode} ErrorCode */
```

### 1. `input-safety` — naamvalidatie

```js
/**
 * Normaliseert en valideert een door de client aangeleverde `displayName`
 * (PROTOCOL.md §Inputveiligheid): NFKC-normalisatie, verwijdering van control
 * characters en onzichtbare misbruiktekens (bv. zero-width space), maximaal
 * 20 zichtbare tekens. `null` zelf is altijd geldig ("server genereert een
 * naam" — buiten scope van deze functie, zie 'Niet in scope'); de aanroeper
 * roept deze functie alleen aan wanneer `displayName` een string is.
 *
 * Telt "zichtbare tekens" als Unicode-codepoints ná normalisatie/opschoning
 * (`Array.from(str).length`, niet `str.length`), zodat bv. een enkel emoji
 * niet als twee tekens meetelt. `PROTOCOL.md` specificeert geen telmethode
 * voor grapheme-clusters (samengestelde emoji, combinerende diakrieten);
 * codepoint-telling is de keuze van deze validator, geen citaat.
 *
 * @param {string} rawDisplayName - nooit `null`/`undefined` hier.
 * @returns {ValidationResult<string>} bij succes: de genormaliseerde,
 *   opgeschoonde naam.
 */
export function normalizeAndValidateDisplayName(rawDisplayName) {}
```

Foutcodes: `NAME_INVALID` wanneer de string na normalisatie/opschoning leeg is
(bijvoorbeeld: alleen control characters/onzichtbare tekens, of alleen
whitespace); `NAME_TOO_LONG` wanneer het resultaat langer is dan 20 zichtbare
tekens.

### 2. `auth-shape` — vorm-check, geen tokenbeslissing

> **Expliciet gemarkeerd:** dit is letterlijk coderen van de vorm die
> `PROTOCOL.md` §Authenticatie en tijdelijke sessies al vastlegt (Bearer-
> header-prefix, `{sessionToken, protocolVersion}`-handshake-vorm) — **geen**
> tokenbeslissing. Het kiezen van een generatie-/hashingalgoritme voor
> `sessionToken` zelf is `auth`, `always_ask`, en hoort bij het M8a/M8b-
> voorstel (`../README.md`, Uitgangspunt 1 en fase M8). Deze functies nemen
> geen enkele beslissing over hoe een token wordt gemaakt of gevalideerd tegen
> een echte sessiestore — ze controleren alleen of de aangeleverde vorm klopt.

```js
/**
 * Pure vorm-check voor de REST-header `Authorization: Bearer <sessionToken>`
 * (PROTOCOL.md §REST-auth). Beoordeelt uitsluitend de vorm — niet of het
 * token bestaat, geldig is, of bij een sessie hoort (dat vereist een echte
 * sessiestore en hoort bij het latere serverproces, niet bij M8a/b zelf).
 *
 * Vergelijkt het `Bearer`-prefix hoofdlettergevoelig — `PROTOCOL.md` schrijft
 * exact `Bearer` (hoofdletter B); deze validator voegt geen eigen RFC 7235-
 * tolerantie voor scheme-namen toe die niet in de brontekst staat.
 *
 * @param {string | undefined | null} headerValue - de rauwe waarde van de
 *   `Authorization`-header, of `undefined`/`null` als de header ontbreekt.
 * @returns {{ ok: true, token: string } | { ok: false, code: 'TOKEN_INVALID' }}
 */
export function parseBearerAuthHeader(headerValue) {}

/**
 * Pure vorm-check voor de socket-handshake-payload
 * `{ sessionToken, protocolVersion }` (PROTOCOL.md §Socket-auth). Wordt
 * ongewijzigd hergebruikt bij reconnect (PROTOCOL.md §Reconnect, stap 4:
 * "Socketauth gebruikt dezelfde sessietoken") — zie M6, geen apart
 * reconnect-schema.
 *
 * Controlevolgorde (vastgelegd voor deterministische tests, geen citaat):
 * eerst de vorm van `sessionToken` (niet-lege string) → `TOKEN_INVALID` bij
 * afwijking; pas daarna `protocolVersion === 'v1'` →
 * `PROTOCOL_VERSION_UNSUPPORTED` bij afwijking of ontbreken. Zijn beide
 * ongeldig, dan retourneert deze functie `TOKEN_INVALID`.
 *
 * @param {unknown} auth - de rauwe `auth`-waarde uit de Socket.IO-handshake;
 *   mag alles zijn, inclusief `undefined` of een niet-object.
 * @returns
 *   | { ok: true, sessionToken: string, protocolVersion: 'v1' }
 *   | { ok: false, code: 'TOKEN_INVALID' | 'PROTOCOL_VERSION_UNSUPPORTED' }
 */
export function parseSocketAuthPayload(auth) {}
```

### 3. `rest-games` — request/response-validators

Path-parameter `{code}`: exact zes ASCII-cijfers (`/^[0-9]{6}$/`) — dezelfde
syntactische regel als `architecture-plan`'s A2 (room-codes) en
`game-flow-plan`'s route-resolver hanteren. Deze validator dupliceert die
regex niet als eigen bron van waarheid maar past 'm toe; een niet-matchende
`code` levert `GAME_NOT_FOUND` op (dichtstbijzijnde bestaande code uit de
Room/join-categorie — `PROTOCOL.md` heeft geen apart "ongeldig formaat"-code
voor path-parameters, dit is een toepassingskeuze van deze validator, geen
citaat).

```js
/**
 * @param {unknown} body - de rauwe, geparste JSON-requestbody van
 *   `POST /api/v1/games`.
 * @returns {ValidationResult<{
 *   config: { preset: string, language: string },
 *   hostParticipates: boolean,
 *   displayName: string | null,
 * }>}
 */
export function validateCreateGameRequest(body) {}

/**
 * @param {unknown} body - de rauwe responsebody van `POST /api/v1/games`.
 * @returns {ValidationResult<{
 *   roomId: string, gameCode: string, inviteId: string, joinUrl: string,
 *   sessionToken: string, roles: Array<'host' | 'player'>,
 *   playerId: string | null, effectiveName: string | null,
 *   state: Record<string, unknown>,
 * }>}
 */
export function validateCreateGameResponse(body) {}

/**
 * Cross-field-invariant uit `PROTOCOL.md`: "Wanneer `hostParticipates =
 * false` zijn `playerId` en `effectiveName` `null`." Losstaand van de
 * losse response-shapecheck hierboven, omdat dit een relatie tussen request
 * en response toetst, niet een enkel object.
 *
 * @param {{ hostParticipates: boolean }} request
 * @param {{ playerId: string | null, effectiveName: string | null }} response
 * @returns {boolean}
 */
export function hostParticipatesInvariantHolds(request, response) {}

/**
 * @param {unknown} body - de rauwe requestbody van `POST /api/v1/games/join`.
 *   Moet precies één van `inviteId`/`gameCode` bevatten ("Request, precies
 *   één locator"). Geen van beide, of beide tegelijk, wordt afgewezen met
 *   `INVITE_INVALID` (dichtstbijzijnde bestaande Room/join-code — er is geen
 *   aparte "MISSING_OR_DUPLICATE_LOCATOR"-code in `PROTOCOL.md`; dit is een
 *   toepassingskeuze van deze validator, geen citaat).
 * @returns {ValidationResult<
 *   | { inviteId: string, displayName: string | null,
 *       joinSource: 'qr' | 'shared_link' | 'code' | 'unknown' }
 *   | { gameCode: string, displayName: string | null,
 *       joinSource: 'qr' | 'shared_link' | 'code' | 'unknown' }
 * >}
 */
export function validateJoinGameRequest(body) {}

/**
 * @param {unknown} body - de rauwe responsebody van
 *   `POST /api/v1/games/join`.
 * @returns {ValidationResult<{
 *   roomId: string, gameCode: string, sessionToken: string,
 *   roles: ['player'], playerId: string, effectiveName: string,
 *   state: Record<string, unknown>,
 * }>}
 */
export function validateJoinGameResponse(body) {}

/**
 * Vorm-check voor `GET /api/v1/games/{code}/state`: alleen het path-
 * parameter en de auth-header. De responsebody ís de state-snapshot
 * ("Volledige actuele snapshot") — de vorm daarvan hoort bij de `snapshot`-
 * module (M5d), en wordt hier bewust niet gedupliceerd, alleen aangeroepen.
 *
 * @param {{ code: string, authorizationHeader: string | undefined | null }} input
 * @returns {ValidationResult<{ code: string, token: string }>}
 */
export function validateGetStateRequestShape(input) {}

/**
 * Vorm-check voor `POST /api/v1/games/{code}/leave`: alleen het path-
 * parameter en de auth-header. `PROTOCOL.md` documenteert geen responsebody
 * voor dit endpoint — deze module verzint er dus ook geen (zie 'Niet in
 * scope'). "Vereist spelerrol" is een autorisatiebeslissing tegen een echte
 * sessie (welke rollen hoort dit token?) en dus buiten bereik van een pure
 * vorm-check; deze functie toetst alleen dat er een sessietoken-vormige
 * header aanwezig is, niet welke rollen erbij horen.
 *
 * @param {{ code: string, authorizationHeader: string | undefined | null }} input
 * @returns {ValidationResult<{ code: string, token: string }>}
 */
export function validateLeaveGameRequestShape(input) {}

/**
 * @param {unknown} body - de rauwe responsebody van `GET /api/v1/time`.
 * @returns {ValidationResult<{ serverTime: number }>} `serverTime` moet een
 *   eindig, niet-negatief geheel getal zijn (epoch-ms).
 */
export function validateTimeResponse(body) {}
```

## Open vraag §5 — `joinUrl`-constructie: expliciet niet hier oplossen

`../README.md`, Open vragen §5: "`joinUrl`-constructie (basis-URL +
`inviteId`) staat nergens gespecificeerd — waar komt de basis-URL vandaan
(config/env)? Relevant voor M3."

Concreet voor `validateCreateGameResponse`: `joinUrl` wordt gevalideerd als
een syntactisch geldige absolute URL-string (bijvoorbeeld met een `new
URL(value)`-poging die niet gooit), **niet** als een string die is
samengesteld uit een specifieke, hier aangenomen basis-URL. Deze validator
neemt geen standpunt in over waar die basis-URL vandaan komt (hardcoded,
`.env`, config-service) — dat is een `public_api`/`prod`-vraag voor de
`PROTOCOL.md`-eigenaar, niet iets om hier stilzwijgend aan te nemen.

## Open vraag §6 — `joinSource`/`method`-mismatch: expliciet niet hier oplossen

`../README.md`, Open vragen §6 (verkort, zie Brondocument hierboven voor het
volledige citaat): `share:opened.method` heeft drie waarden (`qr | link |
native`), terwijl `joinSource` er vier heeft (`qr | shared_link | code |
unknown`), inclusief `code` — "code tonen" levert dus geen onderscheidbaar
`method`-signaal op, terwijl `joinSource` dat voor binnenkomst via een code
wél kan.

Concreet voor `validateJoinGameRequest`: `joinSource` wordt gevalideerd tegen
precies de vier gedocumenteerde waarden (`qr | shared_link | code |
unknown`), als opaak veld — deze validator reconcilieert het verschil met
`share:opened.method`'s drie waarden niet, en voegt geen vijfde/vierde waarde
toe aan geen van beide enums. Of `method` ooit een vierde waarde krijgt die
`joinSource` spiegelt, is aan de `PROTOCOL.md`-eigenaar (`../README.md`, Open
vragen §6, laatste zin).

## Verplichte testgevallen

| # | Functie | Fixture(s) | Verwacht |
| --- | --- | --- | --- |
| 1 | `validateCreateGameRequest` | exacte fixture uit Brondocument (`hostParticipates: true`) | `ok: true` |
| 2 | `validateCreateGameRequest` | dezelfde fixture met `hostParticipates: false, displayName: null` | `ok: true` |
| 3 | `validateCreateGameRequest` | `config` ontbreekt; `config.preset` is een getal i.p.v. string; `hostParticipates` is `"true"` (string, geen boolean) | stuk voor stuk `ok: false` — drie losse tests |
| 4 | `validateCreateGameRequest` → `normalizeAndValidateDisplayName` | `displayName: 'Ruben'` | `ok: true`, waarde `'Ruben'` |
| 5 | `normalizeAndValidateDisplayName` | een string met een control character (bv. `'Ruben'`) en een string met een zero-width space (`'Ru​ben'`) die na opschoning niet-leeg blijft | `ok: true`, opgeschoonde waarde zonder het onzichtbare teken |
| 6 | `normalizeAndValidateDisplayName` | een string die volledig uit control characters/onzichtbare tekens bestaat (bv. `'​​'`) | `ok: false`, `NAME_INVALID` |
| 7 | `normalizeAndValidateDisplayName` | precies 20 zichtbare tekens; 21 zichtbare tekens | `ok: true` resp. `ok: false` met `NAME_TOO_LONG` |
| 8 | `normalizeAndValidateDisplayName` | een NFKC-ligatuur zoals `'ﬁ'` ("ﬁ") die na normalisatie naar twee tekens (`'fi'`) uitvouwt, net op de grens van 20 | telling gebeurt ná normalisatie — controleer dat de grenswaarde overeenkomt met de genormaliseerde lengte, niet de rauwe invoerlengte |
| 9 | `validateCreateGameResponse` | exacte fixture-response (`hostParticipates: true`) | `ok: true` |
| 10 | `validateCreateGameResponse` + `hostParticipatesInvariantHolds` | request `{ hostParticipates: false }` met response `{ playerId: null, effectiveName: null }` | response geldig, invariant houdt stand |
| 11 | `hostParticipatesInvariantHolds` | request `{ hostParticipates: false }` met response `{ playerId: 'p_a1b2c3', effectiveName: 'Vlugge Vos' }` | `false` — schending |
| 12 | `hostParticipatesInvariantHolds` | request `{ hostParticipates: true }` met response `{ playerId: null, effectiveName: null }` | `false` — schending |
| 13 | `validateCreateGameResponse` | `joinUrl: 'not-a-url'`; `roles: ['host', 'admin']` (onbekende rol); `gameCode: '12345'` (5 cijfers) | stuk voor stuk `ok: false` — drie losse tests |
| 14 | `validateJoinGameRequest` | beide exacte fixtures uit Brondocument (`inviteId`-variant en `gameCode`-variant) | stuk voor stuk `ok: true` |
| 15 | `validateJoinGameRequest` | body met zowel `inviteId` als `gameCode`; body met geen van beide | stuk voor stuk `ok: false`, code `INVITE_INVALID` |
| 16 | `validateJoinGameRequest` | `joinSource` elk van `'qr'`, `'shared_link'`, `'code'`, `'unknown'` | stuk voor stuk `ok: true` — vier losse tests |
| 17 | `validateJoinGameRequest` | `joinSource: 'native'` (bestaat wel bij `share:opened.method`, niet bij `joinSource`) | `ok: false` |
| 18 | `validateJoinGameResponse` | exacte fixture-response | `ok: true` |
| 19 | `validateJoinGameResponse` | `roles: ['host']` i.p.v. `['player']` | `ok: false` |
| 20 | `validateGetStateRequestShape` | `{ code: '482917', authorizationHeader: 'Bearer abc123' }` | `ok: true` |
| 21 | `validateGetStateRequestShape` | `code: '12345'` (5 cijfers); `code: 'abcdef'` | stuk voor stuk `ok: false`, `GAME_NOT_FOUND` |
| 22 | `validateGetStateRequestShape` | `authorizationHeader: undefined`; `'Token abc123'` (verkeerd prefix); `'Bearer '` (leeg token) | stuk voor stuk `ok: false`, `TOKEN_INVALID` — drie losse tests |
| 23 | `validateLeaveGameRequestShape` | `{ code: '482917', authorizationHeader: 'Bearer abc123' }` | `ok: true` |
| 24 | `validateLeaveGameRequestShape` | ontbrekende `authorizationHeader` | `ok: false`, `TOKEN_INVALID` |
| 25 | `validateTimeResponse` | exacte fixture `{ serverTime: 1785623412000 }` | `ok: true` |
| 26 | `validateTimeResponse` | `serverTime: '1785623412000'` (string); `serverTime: -5`; `serverTime` ontbreekt | stuk voor stuk `ok: false` — drie losse tests |
| 27 | `parseBearerAuthHeader` | `'Bearer abc123'` | `{ ok: true, token: 'abc123' }` |
| 28 | `parseBearerAuthHeader` | `undefined`; `null`; `''`; `'Bearer'` (geen spatie/token); `'Bearer  '` (alleen whitespace als token); `'bearer abc123'` (kleine letter) | stuk voor stuk `{ ok: false, code: 'TOKEN_INVALID' }` — zes losse tests |
| 29 | `parseSocketAuthPayload` | exacte fixture `{ sessionToken: '<token>', protocolVersion: 'v1' }` (met een niet-lege tokenstring, bv. `'tok_abc123'`) | `{ ok: true, sessionToken: 'tok_abc123', protocolVersion: 'v1' }` |
| 30 | `parseSocketAuthPayload` | `protocolVersion: 'v2'`; `protocolVersion` ontbreekt | stuk voor stuk `{ ok: false, code: 'PROTOCOL_VERSION_UNSUPPORTED' }` |
| 31 | `parseSocketAuthPayload` | `sessionToken` ontbreekt/leeg, met geldige `protocolVersion: 'v1'` | `{ ok: false, code: 'TOKEN_INVALID' }` |
| 32 | `parseSocketAuthPayload` | `auth` is een string, `auth` is `undefined`, `auth` is `{}` | stuk voor stuk `{ ok: false, code: 'TOKEN_INVALID' }` — drie losse tests |
| 33 | `parseSocketAuthPayload` | zowel `sessionToken` als `protocolVersion` ongeldig tegelijk | `{ ok: false, code: 'TOKEN_INVALID' }` — vastgelegde precedentie (zie functie-JSDoc) |

Reken de meervoudige varianten in rijen 3, 13, 22, 26 en 28 door tot losse
`node:test`-cases — dat brengt de tabel op ruim 45 `node:test`-cases.

## Niet in scope

- Het daadwerkelijk opzoeken of een `code`/`inviteId` bij een bestaande room
  hoort (→ `GAME_NOT_FOUND`, `INVITE_INVALID`, `GAME_FULL`,
  `GAME_ALREADY_STARTED`, `LATE_JOIN_DISABLED`, `ROOM_LOCKED`,
  `CODE_RATE_LIMITED` als staat-afhankelijke uitkomst) — dat vereist een
  echte Redis-/Postgres-lookup en hoort bij het latere serverproces, niet bij
  deze pure schemavalidatie.
- De geldigheidscontrole van een `sessionToken` tegen een echte sessiestore
  (bestaat het token nog, is het niet verlopen/`SESSION_REVOKED`) — dat is
  `auth`/M8, niet deze vorm-check. Zie de gemarkeerde sectie hierboven.
  Idem: welke rollen (`host`/`player`) bij een token horen, en dus of "vereist
  spelerrol" (`POST /leave`) daadwerkelijk klopt — autorisatie, geen vorm.
- De daadwerkelijke `generateSessionToken()`/`hashToken()`-implementatie —
  `auth`, `always_ask`, M8a/M8b, expliciet niet hier.
- De vorm van de `state`-snapshot zelf (`GET /{code}/state`-response,
  `state`-veld in de create/join-responses) — dat is de `snapshot`-module
  (M5d); deze prompt valideert alleen dat het een object is, niet de inhoud.
- Het oplossen van Open vragen §5 en §6 door zelf een basis-URL-bron te kiezen
  of `share:opened.method` een vierde waarde te geven — dat is een
  `public_api`/`prod`-besluit over `PROTOCOL.md`, `always_ask`.
- Content-validatie van `config.preset`/`config.language` (welke presets/talen
  bestaan) — eigendom van `game-rules-plan` resp. de content-module, niet van
  deze vorm-check.
- Rate-limiting zelf (`CODE_RATE_LIMITED`, `RATE_LIMITED`) — dat is
  statelijk/tijdgebonden servergedrag, geen pure requestvalidatie.
- Nieuwe dependencies; test uitsluitend met `node:test` + `node:assert`.
- Meer dan 5 bestanden of 400 regels in één actie (CLAUDE.md-autonomiegrens);
  splits per module (`input-safety`, `auth-shape`, `rest-games`) en zo nodig
  verder over meerdere commits.

## Definition of done

- Alle drie modules (`input-safety`, `auth-shape`, `rest-games`) bestaan als
  losse bestanden met eigen tests.
- Alle 33 rijen uit de testtabel slagen, inclusief de doorgerekende varianten
  (rijen 3, 13, 22, 26, 28).
- Elke exacte voorbeeldpayload uit `PROTOCOL.md` §REST-endpoints (beide
  create-varianten qua `hostParticipates`, beide join-varianten qua locator,
  de `GET /time`-fixture) is letterlijk overgenomen als testfixture, niet
  parafraseerd.
- `auth-shape`-functies bevatten geen enkele aanroep naar tokengeneratie,
  -hashing of een sessiestore — puur synchrone vorm-checks op de
  aangeleverde string/object.
- Open vragen §5 en §6 zijn zichtbaar gemarkeerd bij de betreffende
  validators (`joinUrl`, `joinSource`), niet stilzwijgend opgelost.
- Kort verslag bij oplevering: welke bestanden, hoeveel testgevallen, en
  bevestiging dat geen van de auth-shape-tests een echte token- of
  sessiestore aanroept.
