# UI — HANDOFF aan andere eigenaren

Genummerde items die de frontend-realisatie blootlegt. UI bouwt niet omheen op
punten die een andere eigenaar moet bevestigen of beslissen.

Statuslegenda: 🔵 open — 🟡 in behandeling — ✅ opgelost — ⏸️ geparkeerd.

| # | Voor | Status | Onderwerp |
| --- | --- | --- | --- |
| UI-1 | INT-A | 🔵 open | Bevestig het transport-interfacecontract vóórdat UI verder bouwt |
| UI-2 | UI (zelf) | 🔵 open | Pauze-overlay met reden bouwen, uiterlijk bij UI5 |
| UI-3 | INT-A / ARCHITECTURE | 🔵 open | Hoe worden `client/flow/` en `shared/` aan de browser geserveerd? |

---

## UI-1 — bevestig het transport-interfacecontract

**Voor:** INT-A (eigenaar van stap 2: de draaiende server/transportlaag).
**Blokkeert:** UI3 zeker, maar in de praktijk ook UI1/UI2 — die zijn al tegen
deze aanname geschreven (`docs/frontend-plan/prompts/UI1-home-and-join.md`,
`UI2-lobby-and-share.md`), simpelweg omdat er nog geen server was om tegen te
bouwen. Hoe eerder bevestigd, hoe minder er later moet worden herzien.

### Wat er nu staat

`docs/frontend-plan/prompts/UI0-scaffold.md` legt één interface vast waar alle
UI-schermen tegen programmeren, met een gemockte implementatie ernaast
(`frontend/js/transport-mock.mjs`) totdat een echte bestaat:

```js
/**
 * @typedef {{
 *   createGame: (config: object) => Promise<object>,
 *   previewInvite: (inviteId: string) => Promise<object>,
 *   joinGame: (request: object) => Promise<object>,
 *   fetchState: (code: string, sessionToken: string) => Promise<object>,
 *   leaveGame: (code: string, sessionToken: string) => Promise<void>,
 *   fetchServerTime: () => Promise<{ serverTime: number }>,
 *   connect: (sessionToken: string, onEvent: (envelope: object) => void) => {
 *     send: (event: string, actionId: string, payload: object) => Promise<object>,
 *     close: () => void,
 *   },
 * }} Transport
 */
```

Elke functie wrapt precies één `PROTOCOL.md`-eindpunt:

| Functie | PROTOCOL.md-eindpunt |
| --- | --- |
| `createGame` | `POST /api/v1/games` |
| `previewInvite` | `GET /api/v1/games/preview?inviteId=` (invite-only, geen `gameCode`) |
| `joinGame` | `POST /api/v1/games/join` |
| `fetchState` | `GET /api/v1/games/{code}/state` |
| `leaveGame` | `POST /api/v1/games/{code}/leave` |
| `fetchServerTime` | `GET /api/v1/time` |
| `connect` | socketauth + alle client↔server events |

Foutresponses gooien een `Error` met `.code` gezet op de `PROTOCOL.md`-foutcode,
zodat de UI direct `edge-case-messaging.messageForErrorCode(err.code)` kan
gebruiken.

### Waarom dit nu, en niet stilzwijgend

Dit is de belangrijkste naad van het systeem: UI en INT-A hebben allebei een
eigen beeld nodig van exact hetzelfde aansluitpunt, en niemand anders
controleert of die beelden overeenkomen. Als ze uiteenlopen, ontstaat precies
het patroon van `docs/integration-plan/HANDOFF.md` INT-1 (de room-codes-race
door twee losse aannames over dezelfde operatie) — maar dan op de laag waar
elk scherm doorheen moet, niet op één geïsoleerde methode.

### Concreet verzoek

Eén van drie antwoorden, geen van alle drie door mij te kiezen:

1. **Akkoord** — dit is (functioneel) ook hoe stap 2 het gaat aanbieden. UI
   bouwt door; de swap mock → echt wordt dan één import in
   `frontend/js/app.mjs` (`transport-mock.mjs` → `transport.mjs`), verder
   niets.
2. **Grotendeels akkoord, met afwijkingen** — geef aan welke functienamen,
   argumenten of foutvorm anders liggen, dan pas ik `transport.mjs`/
   `transport-mock.mjs` aan vóór UI3 verder bouwt.
3. **Fundamenteel anders vormgegeven** (bijvoorbeeld: stap 2 levert geen los
   "transport"-object maar een kant-en-klare socketclient met een ander
   aanroeppatroon) — dan hoor ik dat liever nu, met een schets van de
   werkelijke vorm, dan na UI3.

Tot een van deze drie is bevestigd, blijft elk UI-scherm op 🔵/🟡 in
`UI-PROGRESS.md` — nooit ✅, want dat vereist sowieso een echte server, niet
alleen een bevestigd contract.

---

## UI-2 — pauze-overlay met reden bouwen

**Voor:** UI zelf. **Uiterlijk bij:** UI5 (hostbalk, die de pauzeknop krijgt).

Een review van UI0 signaleerde terecht dat `view-switcher.mjs` elke `PAUSED`-
fase liet verdwijnen naar `'unknown'`. Dat routeringsgat is inmiddels gefixed:
`viewFor()` leest nu `pausedState.previousPhase` en blijft de onderliggende
view (lobby/gameplay/scoreboard) tonen tijdens een pauze, met een defensieve
`'unknown'`-fallback alleen als `pausedState`/`previousPhase` echt ontbreekt
(zou niet moeten gebeuren — `match-phase-state` zet 'm altijd bij `PAUSED`).

**Wat nog niet bestaat:** de daadwerkelijke pauze-overlay zelf — een zichtbare
banner/melding met de reden, via `edge-case-messaging.messageForPauseReason()`
(DECISIONS.md #11: `host`, `host_disconnected`, `no_answers`,
`server_recovery`, met generieke fallback). Dat hoort inhoudelijk bij UI5,
maar wordt hier expliciet vastgelegd zodat het niet als terloopse code-comment
wegzakt.

---

## UI-3 — hoe worden `client/flow/` en `shared/` aan de browser geserveerd?

**Voor:** INT-A (serving-configuratie) en/of ARCHITECTURE (routingtabel).
**Blokkeert:** geen enkel UI1a-scherm nu al hard (de mock/tests draaien lokaal
prima), maar wél de eerste échte deploy — dit is dus dringender dan het lijkt.

### Het probleem

`frontend/js/*.mjs` importeert `client/flow/*.mjs` en `shared/**/*.mjs` via
relatieve paden (`../../client/flow/route-resolver.mjs` enz.), wat lokaal
werkt zolang de repo-root wordt geserveerd. Maar:

- `ARCHITECTURE.md` §Routing wijst `/`, `/j/*`, `/game/*`, `/host/*`,
  `/screen/*` en `/assets/*` allemaal naar de `frontend`-container, die naar
  verwachting **uitsluitend `frontend/` (of straks `frontend/dist`) als eigen
  root serveert** — niet de repo-root. Een statische server die zo is
  ingericht, staat `../../`-paden die boven zijn eigen root uitkomen normaal
  niet toe (path-traversal-bescherming), dus `client/flow/` en `shared/` zijn
  vanuit die root simpelweg niet bereikbaar.
- Los daarvan: deze pagina wordt op meerdere paden geserveerd
  (`/j/{inviteId}`, `/game/{code}`, `/host/{code}`, niet alleen `/`). Zonder
  `<base>`-tag of absolute paden lossen relatieve assetverwijzingen vanaf zo'n
  deep link verkeerd op (bijv. `/j/css/base.css` in plaats van `/css/base.css`).
  Bewust nog niet gefixed met `<base href="/">` in `index.html`, omdat dat
  alleen zin heeft ná een antwoord op het punt hierboven.

### Mogelijke routes, geen van beide door mij te kiezen

1. De reverse proxy krijgt twee extra statische mappings (`/client/*` →
   `client/`, `/shared/*` → `shared/`) naast de bestaande `frontend`-regel —
   geen build-stap, twee regels config.
2. Er komt alsnog een lichte kopieer-/symlinkstap die `client/flow/` en
   `shared/` in `frontend/` plaatst vóór deploy — geen bundelaar, maar wel een
   nieuwe stap in het releaseproces (`DEPLOYMENT-AND-TESTING.md`).
3. Iets anders dat ik niet zie vanuit alleen `frontend/`.

Zodra dit is bevestigd, kan `index.html` de bijbehorende `<base>`-tag of
absolute paden krijgen — nu zou dat alleen een aanname vastklikken.
