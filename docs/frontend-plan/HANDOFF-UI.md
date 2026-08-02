# UI — HANDOFF aan andere eigenaren

Genummerde items die de frontend-realisatie blootlegt. UI bouwt niet omheen op
punten die een andere eigenaar moet bevestigen of beslissen.

Statuslegenda: 🔵 open — 🟡 in behandeling — ✅ opgelost — ⏸️ geparkeerd.

| # | Voor | Status | Onderwerp |
| --- | --- | --- | --- |
| UI-1 | INT-A | ✅ opgelost | Bevestig het transport-interfacecontract vóórdat UI verder bouwt |
| UI-2 | UI (zelf) | 🔵 open | Pauze-overlay met reden bouwen, uiterlijk bij UI5 |
| UI-3 | INT-A / ARCHITECTURE | ✅ opgelost | Hoe worden `client/flow/` en `shared/` aan de browser geserveerd? |

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

### ✅ Antwoord ontvangen — optie 2, vier correcties

INT-A heeft geantwoord in
[`docs/integration-plan/transport-contract-response.md`](../integration-plan/transport-contract-response.md):
grotendeels akkoord, met vier correcties. Alle vier zijn verwerkt in
`transport.mjs` (contract) en `transport-mock.mjs` (implementatie + tests):

1. `createGame(request)` i.p.v. `createGame(config)` — `request` bevat
   `{ config, hostParticipates, displayName }`, symmetrisch met `joinGame`.
2. `connect(sessionToken, handlers)` i.p.v. `connect(sessionToken, onEvent)` —
   `handlers` bevat zowel `onEvent` als `onStatus`
   (`'connecting'|'connected'|'disconnected'`), nodig voor
   `client/flow/reconnect-state.mjs`.
3. `send()` verwerpt ook bij een formele `{ ok: false }`-ack, met dezelfde
   `Error`+`.code`-vorm als de REST-functies — al zo geïmplementeerd, geen
   functionele wijziging nodig.
4. `actionId` blijft van de UI; bij een retry hoort dezelfde `actionId`
   hergebruikt te worden (geen interfacewijziging, alleen een gedragsafspraak).
   Zie `HANDOFF.md` INT-14 voor een apart, bekend poortprobleem hierbij — geen
   UI-omweg voor bouwen.

Twee losstaande punten blijven bewust open, maar blokkeren UI niet: de exacte
responsvorm van `previewInvite` (INT-8) en de drieledige `preset`-waarde
(`'group_battle'`/`'default'`/`'quick_start'`, INT-11) — beide bij PR belegd.
UI3 kan hierop door; een latere aanpassing aan die twee velden raakt naar
verwachting alleen `transport-mock.mjs`, niet de schermen zelf.

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

### ✅ Antwoord ontvangen — route 1, INT-A regelt het in stap 2

INT-A kiest route 1: twee extra statische mappings (`/client/*` → `client/`,
`/shared/*` → `shared/`) naast de bestaande `frontend`-regel, geen kopieer-/
symlinkstap. Zijn Fastify-entrypoint (stap 2) serveert dit rechtstreeks;
`caddy/Caddyfile`/`nginx/default.conf` volgen bij INT-B's verpakking.

Verwerkt in `frontend/index.html`: `<base href="/" />` plus absolute paden
(`/css/base.css`, `/js/app.mjs`), zodat deep links (`/j/{inviteId}`,
`/game/{code}`, `/host/{code}`) hun assets correct oplossen. `transport-mock.mjs`'s
import van `shared/content` blijft bewust relatief (`../../shared/content/index.mjs`)
— dat komt onder de `/shared/*`-mapping op hetzelfde pad uit als een absoluut
pad zou doen, en blijft daarnaast rechtstreeks bruikbaar onder `node:test`
(een absoluut `/shared/...`-specifier breekt daar, want Node interpreteert een
leidende `/` als bestandssysteemroot, niet als serverorigin).

---

## UI-4 — QR-generator staat klaar in vendor/ (van CT/regie, 2 aug 2026)

**Voor:** UI (ter info, scheelt je UI2-werk). De goedgekeurde QR-dependency is
gevendord: `frontend/vendor/qrcode-generator.mjs` (qrcode-generator 2.0.4,
officiële ESM-build, MIT, herkomstheader in het bestand) met wrapper
`frontend/js/qr.mjs` — één functie `qrDataUrl(joinUrl)` die een data-URL voor
een `<img>` teruggeeft (bewust geen SVG-string: dat zou innerHTML vergen; de
CSP staat `img-src data:` al toe). 3 tests groen (`frontend/js/qr.test.mjs`).
Voor UI2: `img.src = qrDataUrl(shareUrlsFor(joinUrl).qrUrl)` en klaar.

---

## UI-5 — visuele eenheid is een harde DoD (producteigenaar, 2 aug 2026)

De producteigenaar heeft de huidige ongestylede schermen afgekeurd ("het lijkt
wel twee werelden, terwijl het 1 game moet zijn"). Vanaf nu geldt als harde
definition of done voor élk scherm: **naast de singleplayer gelegd is het
onmiskenbaar hetzelfde product** — zelfde donkere achtergrond, zelfde paarse
accenten, zelfde gradient-titels, zelfde kaart- en knopstijl.

Om dit te versnellen staat er nu `frontend/css/components.css` (gelinkt in
index.html): de volledige componentlaag in de visuele taal van style.css,
voor alle bestaande klassen (btn-primary/secondary, field-input, gameplay-*,
scoreboard-*, podium-*). Gebruik bij UI2 en verder dezelfde klassen/tokens;
schermspecifieke layout blijft van jou. Wijkt een scherm visueel af van de
singleplayer, dan is het niet af — hoe groen de tests ook zijn.

---

## UI-6 — route `/samen` = multiplayer-home (producteigenaar, 2 aug 2026)

De ingang naar multiplayer op play.aseso.nl wordt een kaart "🎉 Samen spelen"
in het singleplayer-menu (gebouwd in `public-mode.js`, verborgen achter
`SHOW_MULTIPLAYER = false` tot livegang). Die linkt naar **`/samen`**.
Actie UI: leer `route-resolver`/`view-switcher` de route `/samen` → view
`home` (de multiplayer-home met Snel starten + code-invoer). Actie INT-A:
neem `/samen` op in de deep-link-fallback van de statische serving (zelfde
behandeling als `/j/*`/`/game/*`). Caddy routeert `/samen` al naar de
game-server.

---

## UI-7 — eigenaarsgrens rond `session-shell.mjs` (2 aug 2026)

**Voor:** de twee UI-bouwers onderling. **Aanleiding:** de producteigenaar
vroeg expliciet om dit af te stemmen vóór er een tweede bouwer op hetzelfde
scherm begint — de fout waarmee deze dag begon.

**Bevinding, uit de code en niet uit overleg:** `frontend/js/session-shell.mjs`
is geen lobby-module. Het is de eigenaar van élke lopende sessie
(`/host/{code}`, `/game/{code}`): het houdt de socketverbinding vast, voert
`match-phase-state`/`reconnect-state`/`round-model`, en mount én unmount
zelf `lobby`/`gameplay`/`scoreboard`/`podium` via `view-switcher.viewFor()`.
Het importeert `createGameplayView`, `createScoreboardView` en
`createPodiumView` al, drijft de rondetimer en bedraadt `sendAnswer` en
`scoreboard:updated`.

**Gevolg:** de "UI3/UI4 DOM-montage" die in `UI-PROGRESS.md` nog als 🟡 staat
(view-modellen klaar, scherm niet) is daarmee feitelijk gebouwd — door de
session-shell-bouwer, niet als los UI3/UI4-werk. Wie op dat punt alsnog een
eigen montage begint, bouwt een tweede mechanisme naast dat van een eigenaar
(AGENTS.md).

**Grens die hieruit volgt, tot iemand hem expliciet verlegt:**

- **session-shell-bouwer:** verbinding, fase-/reconnect-/pauzelogica, mounten
  en verversen van alle faseschermen, en de overlays zonder eigen route
  (statusbalk, pauze-overlay).
- **De ander:** de faseschermen zelf als pure view-modules
  (`views/*.mjs` — DOM erin, callbacks eruit, geen transport), de gedeelde
  CSS-lagen (`base.css`/`components.css`), i18n-sleutels in alle drie de
  locales tegelijk, en toegankelijkheid.

Vragen die deze grens níét beslecht (voor wie het eerst raakt, als los item
hier melden): wie de pauze-overlay stylet zodra ze inhoudelijk af is, en of
`round-model` op termijn naar `client/flow/` verhuist — nu bewust lokaal.
