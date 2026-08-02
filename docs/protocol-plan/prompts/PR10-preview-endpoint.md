# Prompt — PR10: Preview-endpoint (pre-join)

**Herzien na menselijke review (2 aug 2026)** — zie "Verwerkte review-feedback"
onderaan. De vorige versie had twee conflicterende invalid-contracten (`valid:
false` náást een aparte foutcode) en een voorbeeld-`inviteId` die niet door de
echte generator/validator komt.

Dekt fase **PR10** — nieuw, volgend op
[`docs/multiplayer/DECISIONS.md`](../../multiplayer/DECISIONS.md), punt 7. Vereist
dat **PR9** is uitgevoerd (of gelijktijdig gebeurt) — PR9 voegt exact dit contract
toe aan `PROTOCOL.md`.

## Brondocument

`DECISIONS.md`, punt 7: "Er komt een licht pre-join-previewendpoint dat de invite
valideert en een servergegenereerde naamsuggestie levert vóór
`POST /games/join`." Gedrag, niet vorm — de vorm hieronder is een toepassingskeuze.

Lees ook `server/architecture/room-codes.js` voor de echte `isValidInviteId()`/
`isValidGameCode()`-functies en de daadwerkelijke lengte-eisen (16 bytes/128 bit →
22 base64url-tekens voor een gegenereerde `inviteId`, ondergrens 16 tekens/96 bit
bij validatie) — gebruik in tests een fixture die je zelf via de echte generator
opwekt of expliciet tegen `isValidInviteId()` toetst, **niet** een handgeschreven
voorbeeldstring. Een eerdere versie van dit promptbestand gebruikte
`"N4x7pQm2K8tW"` (12 tekens) — dat voorbeeld komt niet door de echte validator en
mag niet worden hergebruikt.

## Eén previewcontract (geen `valid`-veld meer)

De vorige versie liet twee contracten naast elkaar bestaan. Dit is het enige,
definitieve contract:

- **Geldige, bekende locator:** `200 { suggestedName: string }`.
- **Syntactisch ongeldige locator** (verkeerd formaat `inviteId`/`gameCode`, geen
  van beide of beide aanwezig): bestaande `INVITE_INVALID`.
- **Syntactisch geldige maar onbekende/verlopen locator:** bestaande
  `GAME_NOT_FOUND` — precies dezelfde code als een verlopen room-TTL elders
  (`DECISIONS.md` punt 2).

Er is dus **geen apart `valid`-boolean-veld**: HTTP-status/foutenvelope draagt die
informatie al, net als bij de andere `rest-games-*`-endpoints. Dit is bewust
consistent met hoe `validateGetStateRequestShape`/`validateLeaveGameRequestShape`
al werken (foutcode, geen los succes-booleaanveld).

```
GET /api/v1/games/preview?inviteId=<inviteId>
GET /api/v1/games/preview?gameCode=<gameCode>
```

Succesrespons:

```json
{ "suggestedName": "Vlugge Vos" }
```

## Privacy- en abusegrenzen (vastleggen, niet alleen uitstellen)

`DECISIONS.md` geeft geen rate-limiting-eis voor dit specifieke endpoint, en die
blijft "niet in scope" op validatorniveau (zie hieronder) — maar de **vorm** van
de respons moet vanaf het begin deze grenzen respecteren, dat is geen latere stap:

- De succesrespons onthult **geen** spelersnamen, `playerCount` of hostgegevens —
  uitsluitend `suggestedName`.
- Een onbekende of verlopen locator lekt **geen** extra roomdetails via
  `GAME_NOT_FOUND` (dezelfde foutenvelope-vorm als elders, geen `meta` met
  roominhoud).
- `suggestedName` volgt dezelfde naamlimiet als bij join (`NAME_TOO_LONG`-grens uit
  `input-safety.mjs`, 20 zichtbare tekens) — valideer dit expliciet in
  `validatePreviewResponse`.
- Preview maakt **geen** sessie of `Player`-record aan (dat gebeurt pas bij
  `POST /games/join`) — vermeld dit expliciet als "niet in scope" én als
  contract-eis (de responsvorm bevat dus nooit `sessionToken`/`playerId`).
- De voorgestelde naam is niet definitief: `POST /games/join` bepaalt de
  uiteindelijke, unieke naam (kan afwijken bij een botsing).

## Te bouwen functies

Bestand: `server/protocol/preview-endpoint.mjs` (native ESM, JSDoc, geen
dependencies, zelfde `ValidationResult<T>`-patroon als de rest van `rest-games-*`).

```js
/**
 * @param {unknown} query - de rauwe querystring-parameters van
 *   GET /api/v1/games/preview. Precies één van inviteId/gameCode, net als
 *   POST /games/join.
 * @returns {ValidationResult<
 *   | { inviteId: string }
 *   | { gameCode: string }
 * >}
 */
export function validatePreviewRequest(query) {}

/**
 * Valideert alleen dat de responsvorm klopt: uitsluitend `suggestedName`,
 * binnen de bestaande naamlimiet, en geen sessie-/spelerachtige velden.
 * @param {unknown} body
 * @returns {ValidationResult<{ suggestedName: string }>}
 */
export function validatePreviewResponse(body) {}
```

## Verplichte testgevallen

| # | Functie | Scenario | Verwacht |
| --- | --- | --- | --- |
| 1 | `validatePreviewRequest` | een via de echte generator opgewekte, geldige `inviteId` (22 tekens) | `ok: true` |
| 2 | `validatePreviewRequest` | `{ gameCode: '482917' }` | `ok: true` |
| 3 | `validatePreviewRequest` | beide aanwezig, of geen van beide | `ok: false`, `INVITE_INVALID` — 2 losse tests |
| 4 | `validatePreviewRequest` | `gameCode` met verkeerd formaat (niet 6 cijfers) | `ok: false`, `GAME_NOT_FOUND` (zelfde conventie als `rest-games-session.mjs`) |
| 5 | `validatePreviewRequest` | `inviteId` korter dan de echte ondergrens (bv. het oude, foutieve 12-tekens-voorbeeld) | `ok: false` — bewijst dat dit bestand niet dezelfde fout herhaalt |
| 6 | `validatePreviewResponse` | `{ suggestedName: 'Vlugge Vos' }` | `ok: true` |
| 7 | `validatePreviewResponse` | `suggestedName` als getal, ontbrekend, of langer dan de naamlimiet | `ok: false` — 3 losse tests |
| 8 | `validatePreviewResponse` | body bevat een extra `sessionToken`/`playerId`-veld | `ok: false` — bewijst dat de responsvorm geen sessie-/spelervelden toestaat |

## Niet in scope

- De daadwerkelijke invite-/code-lookup tegen een echte room.
- De daadwerkelijke servergegenereerde-naam-logica (welke naam wordt voorgesteld).
- Rate limiting op dit endpoint (wel: de vormgrenzen hierboven, die zijn wél in
  scope).
- Sessie- of `Player`-aanmaak.

## Definition of done

- `preview-endpoint.mjs` + `.test.mjs` bestaan, alle 8 testgevallen slagen.
- Precies één invalid-contract (geen `valid`-veld); geverifieerd tegen de echte
  `isValidInviteId()`/`isValidGameCode()` uit `server/architecture/room-codes.js`.
- Geen nieuwe foutcode verzonnen.
- Kort verslag: bevestiging dat het testvoorbeeld voor `inviteId` daadwerkelijk
  door `isValidInviteId()` komt (niet aangenomen).

## Verwerkte review-feedback

- Eén previewcontract gekozen (geen `valid`-veld) — bevinding 2.
- Voorbeeld-`inviteId` vervangen door een eis om de echte generator/validator te
  gebruiken, met een expliciete regressietest tegen het oude, te korte voorbeeld
  — bevinding 3.
- Privacy-/abusegrenzen (geen playerCount/hostdata, naamlimiet, geen sessie-
  aanmaak) toegevoegd als contracteis, niet alleen als latere stap — bevinding 13.
