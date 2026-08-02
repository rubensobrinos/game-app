# Prompt — UI0: Scaffold + mock-transportlaag

Onderdeel van [`../README.md`](../README.md), fase UI0. Harde vereiste voor
UI1–UI5: dit legt de mapstructuur, de viewswitcher, i18n, de servertijd-offset
en het transport-interfacecontract vast die alle latere schermen gebruiken.
Geen enkel scherm wordt hier inhoudelijk gevuld.

## Brondocument

[`UI1-multiplayer-ui.md`](UI1-multiplayer-ui.md) (de volledige opdracht).
[`GAME-FLOW.md`](../../multiplayer/GAME-FLOW.md) §Routes.
[`PROTOCOL.md`](../../multiplayer/PROTOCOL.md) voor de exacte REST-/socketvorm.
[`docs/game-flow-plan/GF-HANDOFF-TO-INT-A.md`](../../game-flow-plan/GF-HANDOFF-TO-INT-A.md)
voor de tien `client/flow/`-modules die je importeert.

## Mapstructuur (voorstel)

```text
frontend/
  index.html
  css/
    base.css
  js/
    app.mjs                 (entry point, module script)
    view-switcher.mjs
    server-time.mjs
    i18n.mjs
    transport.mjs           (interface + placeholder; INT-A's echte implementatie
                              landt hier zodra stap 2 bestaat)
    transport-mock.mjs       (in-memory fake, alleen voor lokaal doorklikken)
    views/                  (één bestand per scherm, gevuld in UI1–UI5)
  locales/
    nl.mjs
  vendor/                   (leeg tot UI2's QR-generator)
```

`frontend/` importeert `client/flow/*.mjs` en `shared/**/*.mjs` via relatieve
paden (`../client/flow/route-resolver.mjs` enz.) — geen kopie, geen bundelaar.
Lokaal testen kan met elke simpele statische server geworteld op de repo-root
(bijvoorbeeld `npx serve .` of `python3 -m http.server`), want browsers laden
ES-modules niet via `file://`.

## Transport-interfacecontract

Dit is de enige plek waar dit contract wordt vastgelegd. UI1–UI5 programmeren
ertegen; INT-A's echte implementatie en de mock hieronder vullen 'm allebei in.

```js
/**
 * @typedef {{
 *   createGame: (config: object) => Promise<object>,
 *   previewInvite: (inviteId: string) => Promise<object>,
 *   joinGame: (request: object) => Promise<object>,
 *   fetchState: (code: string, sessionToken: string) => Promise<object>,
 *   leaveGame: (code: string, sessionToken: string) => Promise<void>,
 *   fetchServerTime: () => Promise<{ serverTime: number }>,
 *   connect: (sessionToken: string, onEvent: (envelope: object) => void) => { send: (event: string, actionId: string, payload: object) => Promise<object>, close: () => void },
 * }} Transport
 */
```

Elke functie geeft de payload/response terug **exact zoals `PROTOCOL.md` ze
beschrijft** (zie de endpointsecties: `POST /api/v1/games`,
`GET /api/v1/games/preview` — **invite-only**, geen `gameCode`-variant —,
`POST /api/v1/games/join`, `GET /api/v1/games/{code}/state`,
`POST /api/v1/games/{code}/leave`, `GET /api/v1/time`, en de socket-envelope
voor client→server/server→client events). Foutresponses gooien een `Error`
met `.code` gezet op de PROTOCOL.md-foutcode, zodat een aanroeper
`edge-case-messaging.messageForErrorCode(err.code)` direct kan gebruiken.

## `transport-mock.mjs`

Eén in-memory, single-process fake die `Transport` volledig implementeert:
één room in geheugen, een vaste `flags_mc`-vraagreeks uit `shared/content`,
een simpele in-process "socket" (een callback-lijst in plaats van een echte
WebSocket) die bij elke serverfase-overgang een event afvuurt. Genoeg om
UI1–UI5 zonder INT-A's server te doorlopen en visueel te controleren — **niet**
genoeg voor de UI1a-DoD (twee browsertabs), dat vereist de echte transportlaag
en blijft ⛔ tot die er is (zie `UI-PROGRESS.md`).

Documenteer in de module zelf dat dit een tijdelijke stand-in is, geen tweede
protocolimplementatie — bij twijfel over een responsvorm is `PROTOCOL.md`
leidend, niet wat het handigst mockt.

## Viewswitcher

Pure koppeling tussen `route-resolver` (welke route) en `match-phase-state`
(welke fase, ná join) naar "welke view-module tonen". Geen eigen
routeringslogica — hergebruik `resolveRoute()` ongewijzigd.

```js
/**
 * @param {{ route: string, phase?: string }} context
 * @returns {'home' | 'preview-join' | 'lobby' | 'gameplay' | 'scoreboard' | 'podium' | 'unknown'}
 */
export function viewFor(context) {}
```

Regels: `route: 'home'` → `'home'`. `route: 'join'` óf `route: 'game'`/`'host'`
zonder een lopende sessie → `'preview-join'`. Ná join: `phase` bepaalt de rest
— `LOBBY` → `'lobby'`, `COUNTDOWN`/`ROUND_ACTIVE`/`ROUND_RESULT` → `'gameplay'`,
`SCOREBOARD` → `'scoreboard'`, `FINISHED` → `'podium'`. `route: 'screen'` →
`'unknown'` (spectators zijn uit scope, DECISIONS.md #9). Dit is een pure
functie — zet 'm als `.mjs` neer met `node --test`.

## Servertijd-offset

```js
/** @param {number[]} roundTripSamples @param {{serverTime:number}[]} responses @returns {number} offsetMs */
export function estimateServerOffset(samples) {}
/** @param {number} startsAt @param {number} endsAt @param {number} offsetMs @returns {number} secondsRemaining (nooit negatief) */
export function secondsRemaining(startsAt, endsAt, offsetMs) {}
```

`ARCHITECTURE.md` principe 2: nooit een eigen seconde-tick op clienttijd — elke
render van een aftimer roept `secondsRemaining()` opnieuw aan met de actuele
`Date.now() + offsetMs`, in plaats van een lokale teller bij te houden. Beide
functies zijn pure `.mjs`-helpers met `node --test`.

## i18n

Hergebruik het patroon uit `app.js` (`T[lang][key]`, `data-i18n`/
`data-i18n-placeholder`-attributen, `applyI18n()`). NL is leidend voor deze
fase; `locales/nl.mjs` exporteert een vlak `{ key: string }`-object. EN/ES
volgen in UI1b.

## Regels

- Nooit `innerHTML` voor tekst die uit gebruikersinvoer of serverdata komt
  (namen, chatachtige velden) — altijd `textContent`.
- Geen enkele view-module raakt hier al gevuld — dat is UI1–UI5.
- Geen nieuwe dependency. `transport-mock.mjs` gebruikt alleen wat al in de
  repo staat (`shared/content`, `client/flow`).

## Definition of done

- `frontend/index.html` laadt en toont een lege shell zonder consolefouten,
  geserveerd via een simpele statische server.
- `viewFor()`, `estimateServerOffset()`/`secondsRemaining()` hebben eigen
  `node --test`-bestanden en zijn groen.
- `transport-mock.mjs` implementeert alle zeven functies uit het contract en
  kan handmatig een room aanmaken + previewen + joinen (geverifieerd via de
  browserconsole of een tijdelijk testscherm — geen UI nodig om dit te
  bewijzen).
- `UI-PROGRESS.md` bijgewerkt: UI0 op 🟡 of ✅.
