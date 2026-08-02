# Prompt — PR2: Foutcodes & errorenvelope

Dekt fase **PR2** uit [`../README.md`](../README.md#fasering). Deze module heeft
geen inhoudelijke afhankelijkheid van **PR1** — sterker, PR1's
`assertPayloadSize`-fixturetest wacht juist op "een bestaande generieke
afwijzing uit de Input-categorie van `error-codes` (PR2)" (`../README.md`, fase
PR1): welke van de 23 codes daar precies van toepassing is, wordt hier
vastgesteld, niet in PR1 aangenomen. PR1 en PR2 zijn dus onafhankelijk van elkaar
te bouwen. Dit promptbestand is zelfstandig leesbaar — geen kennis van een
eerder gesprek nodig.

## Brondocument

Alles hieronder in deze sectie is een letterlijk citaat uit
[`PROTOCOL.md`](../../multiplayer/PROTOCOL.md), sectie **Foutcodes**, tenzij
anders aangegeven.

### Room en join

```
- `GAME_NOT_FOUND`
- `INVITE_INVALID`
- `GAME_FULL`
- `GAME_ALREADY_STARTED`
- `LATE_JOIN_DISABLED`
- `ROOM_LOCKED`
- `CODE_RATE_LIMITED`
```

### Autorisatie

```
- `TOKEN_INVALID`
- `TOKEN_EXPIRED`
- `SESSION_REVOKED`
- `NOT_HOST`
- `NOT_PLAYER`
```

### Game en ronde

```
- `INVALID_PHASE`
- `ROUND_NOT_ACTIVE`
- `PLAYER_NOT_ELIGIBLE`
- `ALREADY_ANSWERED`
- `DEADLINE_PASSED`
- `INVALID_ANSWER_FORMAT`
- `UNSUPPORTED_EVENT`
```

### Input

```
- `NAME_TOO_LONG`
- `NAME_INVALID`
- `RATE_LIMITED`
- `PROTOCOL_VERSION_UNSUPPORTED`
```

Dat is 7 + 5 + 7 + 4 = **23 codes** in **4 categorieën** — exact het aantal dat
[`../README.md`](../README.md), fase PR2, aanhoudt: "Eén typed enum met alle 23
foutcodes in hun 4 categorieën (Room/join, Autorisatie, Game/ronde, Input),
als single source of truth."

De clientrespons-vorm, letterlijk uit `PROTOCOL.md` §Foutcodes:

```json
{
  "event": "error",
  "eventId": "evt_01J...",
  "serverTime": 1785623412000,
  "payload": {
    "actionId": "act_01J...",
    "code": "ROOM_LOCKED",
    "meta": {}
  }
}
```

Direct daaronder, `PROTOCOL.md`: "Debugdetails gaan alleen naar serverlogs."

Basisregel 8 (`PROTOCOL.md` §Basisregels): "Productieteksten komen client-side
uit vertalingen; de server retourneert foutcodes en veilige metadata, geen
stacktraces."

`../README.md`, fase PR2, over `buildErrorPayload`: "garandeert dat `meta` nooit
displaynaam, token, IP-adres of volledige antwoordpayload bevat (koppelt de
logging-veiligheidseisen uit de constraints direct aan een testbare functie,
niet alleen aan een procesafspraak)."

`../README.md`, fase PR2, over de contracttest: "elke code in de enum komt
exact overeen met wat in `PROTOCOL.md` staat — geen méér, geen minder — zodat
een latere wijziging van de specificatie hier meteen faalt in plaats van
onopgemerkt te blijven."

`../README.md`, Open vragen §1: "Room-TTL-verlopen (4 uur) heeft geen eigen
foutcode — hergebruikt dit impliciet `GAME_NOT_FOUND`, of komt er een aparte
code? Blokkeert een deel van PR2."

## Te bouwen functies

Voorgestelde locatie: `server/protocol/` (of de bij protocol-plan's eigen
PR0-checkpoint bevestigde map — `../README.md`, fase PR0). Dit voorstel gaat uit
van native ESM (`.mjs`, `export function`/`export const`), in lijn met de
aanpak van de zusterplannen; bevestig moduleformaat en locatie samen bij dat
PR0-checkpoint vóórdat je buiten `docs/` iets aanmaakt. Schrijf platte
JavaScript met JSDoc-typering, geen TypeScript — er is nog geen toestemming
voor die dependency (`../README.md`, Uitgangspunt 2). Test met `node:test` +
`node:assert`, zonder nieuwe packages.

Verdeel dit logisch over de enum, `buildErrorPayload` en contracttests. Splits alleen
wanneer dat de samenhang of reviewbaarheid werkelijk verbetert, niet vanwege een
zelfopgelegde strengere bestands- of regellimiet.

### 1. De foutcode-enum

```js
/**
 * Alle 23 foutcodes uit PROTOCOL.md §Foutcodes, in hun 4 documentcategorieën.
 * Single source of truth — elke andere module (envelope, rest-games,
 * client-events, server-events, reconnect) importeert codes uitsluitend
 * hiervandaan, nooit als losse stringliteral.
 *
 * @typedef {
 *   | 'GAME_NOT_FOUND' | 'INVITE_INVALID' | 'GAME_FULL' | 'GAME_ALREADY_STARTED'
 *   | 'LATE_JOIN_DISABLED' | 'ROOM_LOCKED' | 'CODE_RATE_LIMITED'
 *   | 'TOKEN_INVALID' | 'TOKEN_EXPIRED' | 'SESSION_REVOKED' | 'NOT_HOST'
 *   | 'NOT_PLAYER'
 *   | 'INVALID_PHASE' | 'ROUND_NOT_ACTIVE' | 'PLAYER_NOT_ELIGIBLE'
 *   | 'ALREADY_ANSWERED' | 'DEADLINE_PASSED' | 'INVALID_ANSWER_FORMAT'
 *   | 'UNSUPPORTED_EVENT'
 *   | 'NAME_TOO_LONG' | 'NAME_INVALID' | 'RATE_LIMITED'
 *   | 'PROTOCOL_VERSION_UNSUPPORTED'
 * } ErrorCode
 */

/**
 * @type {Readonly<Record<
 *   'ROOM_EN_JOIN' | 'AUTORISATIE' | 'GAME_EN_RONDE' | 'INPUT',
 *   ReadonlyArray<ErrorCode>
 * >>}
 */
export const ERROR_CODES_BY_CATEGORY = Object.freeze({
  ROOM_EN_JOIN: Object.freeze([
    'GAME_NOT_FOUND', 'INVITE_INVALID', 'GAME_FULL', 'GAME_ALREADY_STARTED',
    'LATE_JOIN_DISABLED', 'ROOM_LOCKED', 'CODE_RATE_LIMITED',
  ]),
  AUTORISATIE: Object.freeze([
    'TOKEN_INVALID', 'TOKEN_EXPIRED', 'SESSION_REVOKED', 'NOT_HOST',
    'NOT_PLAYER',
  ]),
  GAME_EN_RONDE: Object.freeze([
    'INVALID_PHASE', 'ROUND_NOT_ACTIVE', 'PLAYER_NOT_ELIGIBLE',
    'ALREADY_ANSWERED', 'DEADLINE_PASSED', 'INVALID_ANSWER_FORMAT',
    'UNSUPPORTED_EVENT',
  ]),
  INPUT: Object.freeze([
    'NAME_TOO_LONG', 'NAME_INVALID', 'RATE_LIMITED',
    'PROTOCOL_VERSION_UNSUPPORTED',
  ]),
});

/**
 * Platte set van alle 23 codes, voor snelle membership-checks
 * (`ALL_ERROR_CODES.has(code)`) — afgeleid van `ERROR_CODES_BY_CATEGORY`, geen
 * tweede handmatige lijst die uit sync kan raken.
 * @type {ReadonlySet<ErrorCode>}
 */
export const ALL_ERROR_CODES = Object.freeze(
  new Set(Object.values(ERROR_CODES_BY_CATEGORY).flat()),
);
```

### 2. `buildErrorPayload`

```js
/**
 * Sleutelnamen die nooit in `meta` mogen voorkomen — op elke nestingsdiepte,
 * hoofdletterongevoelig vergeleken. Dekt displaynaam, token, IP-adres en
 * volledige antwoordpayload (`../README.md`, fase PR2).
 * @type {ReadonlyArray<string>}
 */
export const FORBIDDEN_META_KEYS = Object.freeze([
  'displayname', 'effectivename', 'sessiontoken', 'token', 'authorization',
  'bearer', 'ip', 'ipaddress', 'answer', 'payload',
]);

/**
 * Bouwt `payload` van het server→client `error`-event (`PROTOCOL.md`
 * §Foutcodes: `{ actionId, code, meta }`) — zonder `actionId`, want die kent
 * alleen de aanroeper die de oorspronkelijke actie afhandelde en wordt door de
 * envelope-module (PR1) toegevoegd, niet hier.
 *
 * Weigert (throw) in plaats van `meta` stilzwijgend op te schonen: een lek
 * moet zichtbaar breken bij het aanroeppunt tijdens ontwikkeling/tests, niet
 * onopgemerkt de errorenvelope in glippen richting de client.
 *
 * @param {ErrorCode} code - moet voorkomen in `ALL_ERROR_CODES`.
 * @param {Record<string, unknown>} [meta] - veilige, niet-geheime metadata;
 *   standaard een leeg object.
 * @returns {{ code: ErrorCode, meta: Record<string, unknown> }}
 * @throws {Error} als `code` niet in `ALL_ERROR_CODES` voorkomt.
 * @throws {Error} als `meta` — op enige nestingsdiepte, als sleutelnaam — een
 *   naam uit `FORBIDDEN_META_KEYS` bevat.
 */
export function buildErrorPayload(code, meta = {}) {}
```

### 3. Contracttest-extractor

```js
/**
 * Leest de tekst van PROTOCOL.md en extraheert alle foutcodes uit de vier
 * subsecties onder "## Foutcodes" (Room en join / Autorisatie / Game en ronde
 * / Input), in documentvolgorde — puur tekstparsing, zonder kennis van de
 * enum hierboven, zodat de vergelijking niet met zichzelf circulair is.
 *
 * @param {string} markdown - de volledige tekst van
 *   `docs/multiplayer/PROTOCOL.md`.
 * @returns {Array<{ category: 'Room en join' | 'Autorisatie' |
 *   'Game en ronde' | 'Input', code: string }>}
 */
export function extractErrorCodesFromProtocolDoc(markdown) {}
```

De contracttest zelf is geen losse productiemodule maar onderdeel van de
testsuite: lees `docs/multiplayer/PROTOCOL.md` van schijf via `node:fs`
(pad relatief vanaf het testbestand, niet hardgecodeerd absoluut), roep
`extractErrorCodesFromProtocolDoc` aan, en vergelijk het resultaat met
`ERROR_CODES_BY_CATEGORY` — zowel als volledige verzameling (geen ontbrekende,
geen extra codes) als per categorie (zelfde codes in dezelfde categorie;
volgorde binnen een categorie is niet relevant). Faalt de vergelijking, dan
betekent dat: `PROTOCOL.md` is gewijzigd zonder dat de enum is bijgewerkt, of
andersom — in beide gevallen moet de test rood staan, nooit stilzwijgend
doorlopen.

## Open vraag §1 — expliciet niet hier oplossen

`../README.md`, Open vragen §1: "Room-TTL-verlopen (4 uur) heeft geen eigen
foutcode — hergebruikt dit impliciet `GAME_NOT_FOUND`, of komt er een aparte
code? Blokkeert een deel van PR2."

Deze prompt lost die vraag niet op. Concreet:

- `GAME_NOT_FOUND` blijft in de enum precies zoals `PROTOCOL.md` het
  opschrijft — er wordt hier **geen** nieuwe code (bijvoorbeeld
  `ROOM_EXPIRED`/`ROOM_TTL_EXPIRED`) toegevoegd, want dat zou een
  `public_api`-wijziging van `PROTOCOL.md` zijn, niet het vertalen van
  bestaande tekst (`../README.md`, Uitgangspunt 1).
- Voeg bij `GAME_NOT_FOUND` in het enum-bestand een niet-normatieve
  codecommentaar toe die naar deze open vraag verwijst (bijvoorbeeld: `// zie
  protocol-plan/README.md, Open vragen §1 — TTL-verval nog onbeslist`), zodat
  een latere lezer de ambiguïteit tegenkomt zonder dat de enum zelf een
  aanname vastlegt.
- Schrijf **geen** test die aanneemt dat TTL-verval `GAME_NOT_FOUND`
  retourneert — dat zou de open vraag stilzwijgend beslissen in plaats van
  hem open te laten. Schrijf wel de negatieve test uit de tabel hieronder
  (rij 14), die alleen vaststelt dat de enum vandaag geen aparte TTL-code
  bevat.

## Verplichte testgevallen

| # | Testgeval | Verwacht |
| --- | --- | --- |
| 1 | Aantal codes in `ALL_ERROR_CODES` | exact 23 |
| 2 | Aantal codes per categorie in `ERROR_CODES_BY_CATEGORY` | Room en join: 7, Autorisatie: 5, Game en ronde: 7, Input: 4 |
| 3 | `extractErrorCodesFromProtocolDoc` op de daadwerkelijke inhoud van `docs/multiplayer/PROTOCOL.md` | exact dezelfde 23 codes, in exact dezelfde 4 categorieën, als in `ERROR_CODES_BY_CATEGORY` |
| 4 | Set-verschil tussen de PROTOCOL.md-extractie en `ALL_ERROR_CODES` | leeg in beide richtingen — geen code in de enum die niet in het document staat, en omgekeerd |
| 5 | `buildErrorPayload('ROOM_LOCKED', {})` | `{ code: 'ROOM_LOCKED', meta: {} }` |
| 6 | `buildErrorPayload('ROOM_LOCKED')` (geen `meta`-argument) | identiek aan #5 — `meta` defaultet naar `{}` |
| 7 | `buildErrorPayload('NOT_A_REAL_CODE', {})` | throw |
| 8 | `buildErrorPayload('ROOM_LOCKED', { displayName: 'Ruben' })` | throw |
| 9 | `buildErrorPayload('ROOM_LOCKED', meta)` met `meta` telkens één van `{ sessionToken: 'abc' }`, `{ token: 'abc' }`, `{ authorization: 'Bearer abc' }`, `{ ip: '1.2.3.4' }`, `{ ipAddress: '1.2.3.4' }`, `{ answer: { optionId: 'opt_2' } }`, `{ payload: {} }` | stuk voor stuk throw — zeven losse `node:test`-cases |
| 10 | `buildErrorPayload('ROOM_LOCKED', { details: { token: 'abc' } })` (geneste sleutel) | throw — nesting wordt niet overgeslagen |
| 11 | `buildErrorPayload('ROOM_LOCKED', { DisplayName: 'Ruben' })` (afwijkende hoofdletters) | throw — hoofdletterongevoelige vergelijking |
| 12 | `buildErrorPayload('ROOM_LOCKED', { reason: 'room is locked' })` | geen throw — niet-verboden sleutel blijft toegestaan |
| 13 | Retourwaarde van elke geslaagde `buildErrorPayload`-aanroep | bevat nooit een `stack`- of `message`-sleutel (Basisregel 8: geen stacktraces) |
| 14 | Open vraag §1 — negatieve test | `ALL_ERROR_CODES` bevat geen `ROOM_EXPIRED`, `TTL_EXPIRED`, `ROOM_TTL_EXPIRED` of vergelijkbare naam |

## Niet in scope

- Het daadwerkelijk detecteren van room-TTL-verval (4 uur) — dat vereist een
  echte Redis-verbinding/scheduler en hoort bij het latere serverproces
  (`../README.md`, "Wat hier expliciet buiten valt"), niet bij deze pure
  module.
- Het oplossen van Open vraag §1 door zelf een nieuwe code te verzinnen — dat
  is een `public_api`-besluit over `PROTOCOL.md`, `always_ask` volgens
  `CLAUDE.md`.
- Koppeling van `buildErrorPayload` aan de volledige server→client
  event-envelope (`event`, `eventId`, `serverTime`) — dat is de
  `envelope`-module (PR1); deze functie levert uitsluitend `payload.code` en
  `payload.meta`.
- Een uitputtende whitelist van toegestane `meta`-vormen per foutcode — deze
  module legt alleen een denylist vast (wat nooit mag), niet wat elke
  aanroeper wél mag meesturen; dat is aan het aanroeppunt.
- REST-foutresponses (HTTP-statuscodes, response-bodyvorm buiten de
  socket-`error`-eventvorm) — dat hoort bij `rest-games` (PR3).
- Vertaalde, voor mensen leesbare foutteksten — die komen client-side uit
  vertalingen (Basisregel 8), niet uit deze module.
- Nieuwe dependencies; test uitsluitend met `node:test` + `node:assert`.
- Meer dan 15 bestanden of 5.000 regels in één actie (CLAUDE.md-autonomiegrens);
  splits zo nodig de enum, `buildErrorPayload` en de contracttest-extractor
  over meerdere kleine bestanden/commits.

## Definition of done

- `ERROR_CODES_BY_CATEGORY` bevat exact de 23 codes uit `PROTOCOL.md`
  §Foutcodes, verdeeld over exact de 4 documentcategorieën, in dezelfde
  groepering.
- `extractErrorCodesFromProtocolDoc` draait tegen de daadwerkelijke inhoud van
  `docs/multiplayer/PROTOCOL.md` op schijf (niet tegen een hardgecodeerde
  kopie), en de contracttest faalt zodra dat bestand en de enum uit elkaar
  lopen.
- `buildErrorPayload` gooit voor elke sleutel in `FORBIDDEN_META_KEYS`, op elke
  geteste nestingsdiepte, en levert anders exact `{ code, meta }` terug, nooit
  `stack`/`message`.
- Alle 14 rijen uit de testtabel slagen.
- Open vraag §1 is zichtbaar gemarkeerd (codecommentaar + negatieve test in de
  testsuite), niet stilzwijgend beslist.
- Kort verslag bij oplevering: welke bestanden, hoeveel testgevallen, en of de
  contracttest tegen de echte `PROTOCOL.md` slaagt.
