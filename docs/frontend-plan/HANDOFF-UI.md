# UI — HANDOFF aan andere eigenaren

Genummerde items die de frontend-realisatie blootlegt. UI bouwt niet omheen op
punten die een andere eigenaar moet bevestigen of beslissen.

Statuslegenda: 🔵 open — 🟡 in behandeling — ✅ opgelost — ⏸️ geparkeerd.

| # | Voor | Status | Onderwerp |
| --- | --- | --- | --- |
| UI-1 | INT-A | ✅ opgelost | Bevestig het transport-interfacecontract vóórdat UI verder bouwt |
| UI-2 | UI (zelf) | ✅ opgelost | Pauze-overlay met reden bouwen |
| UI-3 | INT-A / ARCHITECTURE | ✅ opgelost | Hoe worden `client/flow/` en `shared/` aan de browser geserveerd? |
| UI-8 | INT-A / PR | 🔵 open | `room:state` bevat geen deelnemerslijst — een joiner ziet geen namen van al aanwezige spelers |
| UI-9 | thema 3 | ✅ opgelost | Motion-tokens geleverd door thema 2; `M1` kan starten |
| UI-10 | thema 1 | ✅ opgelost | `room-header.mjs` is dode code — `D-018` daardoor nog niet zichtbaar |
| UI-11 | producteigenaar | 🔵 open | `O-002`/`O-003` blokkeren wereldmotieven en iconografie (thema 2) |
| UI-12 | PR | 🟡 informatief, klein verzoek | `PROTOCOL.md` specificeert `round:ended`'s persoonlijke velden nergens — client las ze verkeerd, nu client-side gefixt |
| UI-13 | — | ✅ ingetrokken | ~~`COUNTDOWN_MS` wijkt af van `03` §6~~ — `GAME-RULES.md` bevestigt al 3s, de mock is een zelf-gedocumenteerde testversnelling. Geen open vraag. |
| UI-14 | producteigenaar | 🔵 open, voorstel al gebouwd | Dubbele tab: `BroadcastChannel`-gebaseerde detectie toegevoegd (geen nieuwe dependency) — bevestig of dit de gewenste aanpak is |
| UI-15 | INT-A | 🔵 open | Tie-regel is al **bevestigd** (`GR2-standings.md`/`GAME-RULES.md`), maar `scoreboard:updated` en `game:finished` passen 'm inconsistent toe op de server, en client + mock lopen achter — zie herziene toelichting |
| UI-16 | INT-A | 🔵 open | S14: twee (niet drie) headline-typen echt niet bouwbaar — "streak" bleek een misverstand, zie herziene toelichting |
| UI-17 | client/flow (eigenaar) | 🔵 open | Teams zijn al volledig gespecificeerd (`GAME-RULES.md` §Teams — fase 1.5) maar niet in `HostConfig`; tijd-per-ronde heeft een bevestigde default+range (`15s, 10–30s`) zonder instelveld — zie herziene toelichting |
| UI-18 | INT-A / PR | 🔵 open | Geen server-side timeout ná `host_disconnected` — een hostloze room blijft voor onbepaalde tijd gepauzeerd, geen uitslagbehoud-event mogelijk (thema 5, T5-10) |

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

### ✅ Opgelost — gebouwd, vooruitlopend op UI5

Op verzoek van de producteigenaar (pilotwaardige UI1b-kern) nu al gebouwd in
`session-shell.mjs`, niet pas bij UI5: een overlay over de onderliggende
fase-view met `t(messageForPauseReason(pausedState.reason))`. Omdat er zonder
een manier om te pauzeren geen weg was om deze overlay ooit te bereiken, is
er ook een **minimale** hosttoggle (Pauzeer/Hervat) bijgekomen — nadrukkelijk
niet de volledige UI5-hostbalk, alleen deze ene actie. Lock/kick/finish/next
en de rest van de hostinstellingen blijven UI5-werk.

**Update:** UI5 is inmiddels gebouwd (`views/hostbar.mjs`) — pauzeren/hervatten
is daarin opgegaan, plus lock/unlock, spelers verwijderen en handmatig
volgende ronde bij hostgestuurde pacing. Zie `UI-PROGRESS.md`.

E2e geverifieerd (headless Chromium, Playwright `clock`-API): pauzeren tijdens
SCOREBOARD toont de overlay met de juiste reden, de onderliggende view blijft
zichtbaar (gedimd), hervatten sluit 'm weer. Een bug onderweg gefixt: de
overlay (`position: fixed; inset: 0`) dekte de hosttoggle af omdat die er in
de DOM vóór stond — de Hervat-knop staat daarom ín de overlay, niet op de knop
erachter.

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

**UI-kant gedaan:** `route-resolver.resolveRoute('/samen')` → `{route:'home'}`,
identiek aan `/` (met tests). Geverifieerd via SPA-navigatie (`pushState` +
`popstate`) in headless Chromium. INT-A's kant (deep-link-fallback in de
serving) staat nog open.

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

### Reactie — bevestiging, geen tweede bouwer

Ik ben de auteur van `session-shell.mjs` (en van `views/lobby.mjs`, de
foutmeldingsvertaling, `/samen`, en de CSS/i18n-toevoegingen in dit rondje) —
de analyse hierboven klopt met wat er nu staat. Er is voor zover ik weet geen
tweede, apart lopende UI-bouwer die hetzelfde probeerde; als deze grens is
opgesteld naar aanleiding van iets dat zo léék, is dat bij mij niet
uitgekomen in een dubbele montage.

Eén van de twee openstaande vragen is inmiddels beantwoord: de pauze-overlay
is gestyled (`base.css`, `.session-pause-card`/`.session-pause-resume`) —
inclusief een echte bugfix onderweg (de overlay dekte de hosttoggle af,
zie `UI-PROGRESS.md`). De andere vraag (`round-model` al dan niet naar
`client/flow/`) laat ik open — geen aanleiding om 'm nu te verplaatsen.

---

## UI-8 — `room:state` bevat geen deelnemerslijst

**Voor:** INT-A / PR. **Blokkeert:** niets hards — `views/lobby.mjs` werkt
prima met wat er is, dit is een UX-gat, geen crash.

`match-phase-state` bewaart bewust geen spelerslijst (GF-HANDOFF-TO-INT-A.md),
dus de lobby houdt 'm zelf lokaal bij. `room:state`'s snapshot geeft alleen
`room.playerCount` (betrouwbaar) en `self` (je eigen naam) — geen lijst van
wie er al meedoet. Namen van andere spelers komen alleen binnen via
`room:player-changed`-deltas, en dus alleen voor wie ná het moment van
verbinden gebeurt. Concreet: een speler die een lobby met drie bestaande
deelnemers binnenkomt ziet correct "4 spelers", maar drie van de vier namen
niet — totdat er weer iets verandert (join/leave/rename).

Geen giswerk hiervoor gebouwd (geen placeholder-namen, geen "3 onbekende
spelers"-tekst) — gewoon het betrouwbare aantal getoond en de lijst laten
groeien met wat er binnenkomt. Als `PROTOCOL.md`'s `room:state` op termijn een
spelerslijst krijgt, is de fix in `session-shell.mjs`'s `applyRoomState()`
lokaal (één plek, geen schermwijziging nodig).

---

## UI-9 — motion-tokens hebben twee eigenaren (thema 2, 3 aug 2026)

**Voor:** thema 3 (beweging en gevoel). **Blokkeert:** thema 3's `M1`, en
daarmee alle animatie.

`06` §3 vraagt om een schaal `--motion-instant` t/m `--motion-stage`. Die
bestaat niet; er staan losse `0.12s`- en `0.18s`-waarden verspreid door
`base.css` en `components.css`.

Het probleem is niet dát ze ontbreken maar dat twee thema's ze claimen. Ze
staan als fundament in `2-vorm-en-systeem/PROGRESS.md` én in
`3-beweging-en-gevoel/PROGRESS.md`, en thema 3's prompt
`M1-motion-tokens-en-e01.md` schrijft ze in stap 1 in `base.css`'s
`:root` — het tokenblok van thema 2. Twee schrijvers op één blok is het
patroon dat vandaag al een keer misging (het gedeelde knopblok, `05` §15).

**Voorstel, geen besluit:** thema 2 levert de tokens omdat het designsysteem
(`05` §2) daar de plek voor is; thema 3 consumeert ze en houdt `E01`–`E16`
bij. `M1` verliest dan stap 1 en houdt stap 2 en 3. Andersom kan ook — dan
schrapt thema 2 de regel `Motion-tokens` uit zijn `PROGRESS.md`. Wat niet kan
is allebei.

### ✅ Opgelost — thema 2 heeft geleverd

Thema 3 accepteerde het voorstel en herschreef `M1` tot "E01 op álle controls
(consumeert thema 2's motion-tokens)". Daarna bleef thema 2 er nog even op
zitten — dat was de werkelijke blokkade, niet het meningsverschil.

De tokens staan nu in `base.css`'s `:root`:

```css
--motion-instant: 100ms;    /*  80–120ms  — indrukken, directe respons */
--motion-fast: 160ms;       /* 140–180ms  — kleine statuswissels */
--motion-base: 250ms;       /* 220–280ms  — verschijnen en verdwijnen */
--motion-emphasis: 400ms;   /* 350–500ms  — reveal, rangwisseling */
--motion-stage: 900ms;      /* 700–1200ms — podium, finale */

--ease-press:  cubic-bezier(0.4, 0, 1, 1);       /* snelle ease-out */
--ease-enter:  cubic-bezier(0.16, 1, 0.3, 1);    /* zachte deceleratie */
--ease-rank:   cubic-bezier(0.34, 1.56, 0.64, 1); /* spring, beheerst */
--ease-stage:  cubic-bezier(0.22, 1, 0.36, 1);   /* podium */
```

Meegenomen bij het landen: alle harde duraties in `base.css` en
`components.css` zijn vervangen, en `transition: all` op `.btn-opt` is een
expliciete eigenschappenlijst geworden — `all` animeerde ook layout, wat `06`
§9 juist wil vermijden.

Geverifieerd in de browser met en zonder `prefers-reduced-motion`: de tokens
worden toegepast (`.btn-primary` 0,1s met `--ease-press`, `.btn-opt` 0,16s) en
met `reduce` zakt alles naar 0,001s — het vangnet uit `M0` wint nog steeds van
elke token.

Thema 3 kan `M1` starten. Beheer van de schaal blijft bij thema 2: wie een duur
nodig heeft die er niet in past meldt dat, in plaats van er een losse waarde
naast te zetten.

### ✅ Akkoord — thema 2 levert, thema 3 consumeert

Eens met het voorstel. `3-beweging-en-gevoel/prompts/M1-motion-tokens-en-e01.md`
is aangepast: stap 1 (tokens vastleggen) is geschrapt, `M1` wacht nu op
`--motion-instant` t/m `--motion-stage` uit thema 2 en past ze alleen toe op
`E01`. `3-beweging-en-gevoel/PROGRESS.md`'s `Motion-tokens`-regel verwijst nu
naar thema 2 i.p.v. zelf een niveau bij te houden.

---

## UI-10 — `room-header.mjs` is dode code (thema 2, 3 aug 2026)

**Voor:** thema 1 (schermen en flow), scherm `S05`. **Urgentie:** laag qua
techniek, hoog qua zichtbaarheid — het is de reden dat `D-018` nog niet
zichtbaar is.

`frontend/js/views/room-header.mjs` bestaat sinds `d3c900e`: een volledige
implementatie van `D-018` (code permanent in de appheader, QR-pictogram
ernaast, modal met kaart/code/URL, focusbeheer, Escape). **Hij is nergens
ingehangen.**

Gevolg: de gamecode zit nog steeds achter de knop `Toon code` in de lobby,
terwijl `00-DESIGN-INDEX.md` §5 "geen verborgen roomcode of QR in de
hostlobby" als expliciet *bewust niet doen* noemt en `09` §15 `Show code` op
de verboden-copylijst zet. Dat is de laatste term van die lijst die er nog
staat.

Dat de module dood is, is niet de schuld van thema 1 — die heeft er nooit om
gevraagd. Ik heb hem gebouwd zonder hem in te hangen en dat had niet gemoeten.

**Voorstel:** thema 1 hangt hem in (het is een scherm) en haalt daarbij
`Toon code` en `Toon QR-code` uit de lobby; thema 2 onderhoudt de component.
Volledige beschrijving inclusief de drie ongeteste aannames in
`2-vorm-en-systeem/prompts/T2-5-qr-kaart-en-room-header.md`.

**Opgelost (thema 1, 3 aug 2026):** `session-shell.mjs` mount `room-header.mjs`
nu permanent in `#app-header` zolang de sessie loopt (`headerRoot`-parameter,
zelfde patroon als `hostBarRoot`), roept `setJoinUrl()` aan bij elke
`room:state`, en ruimt 'm op bij `destroy()`/`terminate()`. `lobby.mjs`'s eigen
`show-qr`/`show-code` zijn verwijderd — precies het voorstel hierboven.
Geverifieerd met Playwright: code zichtbaar tijdens lobby/gameplay/pauze en
ná vergrendelen, QR-modal met Escape/focusbeheer werkt, verdwijnt bij het
verlaten van de sessie. Volledige details in
`1-schermen-en-flow/prompts/02-S05-permanente-qr-code.md`.

---

## UI-11 — `O-002` en `O-003` blokkeren twee thema's (thema 2, 3 aug 2026)

**Voor:** de producteigenaar. **Blokkeert:** thema 2 (wereldmotieven,
iconografie).

_Correctie op de eerste versie: daar stond dat het ook thema 5's medium/tablet-
en podiumcomposities blokkeert. Thema 5 heeft die claim inmiddels expliciet
ingetrokken en de prompts alsnog geschreven (`T5-7`, `T5-8`) — een tweekoloms
breakpoint is een layoutvraag, geen kleurvraag. Deze blokkade raakt dus alleen
thema 2._

Twee onderdelen staan **on hold** (⏸) door een ontbrekende keuze, niet door
capaciteit. Ze staan bewust niet op niveau 0: aan een 0 kan iemand werken, aan
deze twee niet.

| Onderdeel | Wacht op |
| --- | --- |
| Wereldmotieven (`05` §2.7) | `O-003` — de exacte accentkleur |
| Iconografie (`05` §3) | een merkontwerper; `O-002` is bijzaak, want `05` §3 stelt geen eis aan de letterkeuze |

Samen zijn ze precies wat `10-IMPLEMENTATION-ROADMAP.md` als risico `R3`
benoemt: zonder eigen visuele grammatica blijft dit generieke donkere
gaming-esthetiek, hoe netjes elk scherm verder ook wordt.

Drie antwoorden zijn geldig, óók "nog niet beslissen" — maar dan hoort `R3`
als geaccepteerd risico in `docs/STATUS.md` in plaats van als openstaand punt.
Wat niet werkt is de vraag open laten en tegelijk verwachten dat het product
er eigen uitziet.

Onderbouwing per vraag, met wat wij vandaag hebben en wat het besluit raakt,
in `2-vorm-en-systeem/prompts/T2-7-besluitverzoek-o002-o003.md`.

---

## UI-12 — `round:ended`'s persoonlijke velden staan nergens in `PROTOCOL.md` (thema 4, 3 aug 2026)

**Voor:** PR (protocoleigenaar). **Urgentie:** laag — de client is inmiddels
zelf gecorrigeerd, dit is een documentatiegat, geen blokkade.

`round-model.mjs` las tot vandaag `payload.selfCorrect`/`selfScore` uit de
`round:ended`-payload. De échte server stuurt `ownPoints`/`ownCorrect`/
`ownResponseTimeMs` (`server/transport/socket.mjs:534-536`), en valideert daar
ook hard op (`server/protocol/server-events-scoring.mjs:64-69`:
`typeof ownPoints !== 'number'` → afgewezen). Sinds de transportlaag-swap naar
de echte server (`98a114d`) toonde het resultaatstempel daardoor altijd
"Onjuist" en verdween de scoreregel volledig — alleen `transport-mock.mjs`
stuurde (tot vandaag) de velden die de client verwachtte.

**Grondoorzaak:** `PROTOCOL.md`'s `round:ended`-sectie (rond regel 493-500)
gaat uitsluitend over `resultDetails`-lekkage en de eventtabel zegt alleen
"room + persoonlijke velden ... eigen punten" — nergens staat `ownPoints`,
`ownCorrect` of `ownResponseTimeMs` met naam. Zonder die drie veldnamen in het
protocoldocument kon client en server wegdrijven zonder dat een test of review
het ving; het risico herhaalt zich bij het volgende persoonlijke veld.

**Al gedaan (geen actie nodig van PR):** `round-model.mjs`, `transport-mock.mjs`
en `round-model.test.mjs` zijn gecorrigeerd naar `ownCorrect`/`ownPoints`,
inclusief het onderscheid dat `ownPoints` punten van déze ronde zijn, geen
cumulatief totaal (dat bestaat alleen in `scoreboard:updated`). Zie
`design-documentation/design/4-taal-en-tekst/PROGRESS.md` §9 voor de volledige
analyse.

**Verzoek:** `PROTOCOL.md`'s `round:ended`-sectie aanvullen met de drie
persoonlijke velden (`ownPoints`, `ownCorrect`, `ownResponseTimeMs`) en hun
vorm/semantiek, zodat dit specifieke gat niet terugkeert. Geen haast, geen
codewijziging nodig — puur het protocoldocument in lijn brengen met wat de
server al (correct) doet.

---

## UI-13 — Countdown-duur: mock (1,2s) vs. `03` §6 (2,5–3,0s) (thema 1, 3 aug 2026)

**Voor:** INT-A (eigenaar van `transport-mock.mjs`/het protocol — dit is een
serverwaarde, geen clientkeuze).

Bij het bouwen van `S07` (countdown, `1-schermen-en-flow/prompts/
04-S07-countdown.md`) bleek `transport-mock.mjs`'s `COUNTDOWN_MS` vast op
1200ms te staan, terwijl `03-GAME-FLOW-AND-STATES.md` §6 een richtduur van
2,5–3,0s noemt. Dat is geen afrondingsverschil: bij 1,2s past een aftelling
met discrete hele-secondestappen (`3`→`2`→`1`) domweg niet — in de praktijk
telt de client nu af vanaf `2`, niet vanaf `3`.

**Client-side al robuust tegen beide:** `gameplay.mjs`'s countdown-substaat
rekent het getal uit `secondsRemaining(countdownEndsAt, offsetMs)`, geen
vaste 3-2-1-reeks aangenomen — welke duur de server ook uiteindelijk stuurt,
de weergave klopt zonder clientwijziging. Dit item is dus puur ter
bevestiging van de juiste waarde, niet blokkerend voor `S07` zelf (al
opgeleverd op niveau 1).

**Verzoek:** bevestig welke van de twee leidend is — een bewuste
mock-vereenvoudiging die in productie richting 2,5–3,0s gaat, of is `03` §6
verouderd en is 1,2s de werkelijke waarde? Update de afwijkende bron zodat
de twee documenten niet langer tegenspreken.

**Ingetrokken (thema 1, 3 aug 2026), principe 8 — met de reden:** ik had
`GAME-RULES.md` niet geraadpleegd vóór dit item te schrijven. Regel 10 daar
("Startcountdown | 3 s | nee") bevestigt de duur al, en `transport-mock.mjs`'s
eigen headercommentaar zegt al expliciet dat zijn kortere tijden ("enkele
seconden") een bewuste testversnelling zijn, "geen uitspraak over de echte
serverpacing" — precies het antwoord dat ik hierboven vroeg. Er is dus geen
open vraag: 3s is leidend, de mock wijkt bewust en gedocumenteerd af, en
`gameplay.mjs`'s duur-onafhankelijke implementatie klopt al. Geen actie nodig
van INT-A. Zie ook `UI-15`/`UI-17` — dezelfde misser (brondocument niet
volledig geraadpleegd) kwam daar ook voor.

---

## UI-14 — Dubbele tab: `BroadcastChannel`-detectie (thema 1, 3 aug 2026)

**Voor:** de producteigenaar (`00-DESIGN-INDEX.md` §6 punt 9 — een nieuwe
aanpak/afhankelijkheid vastleggen als voorstel, niet stilzwijgend beslissen).

Bij het uitvoeren van `1-schermen-en-flow/prompts/05-randgevallen.md` is het
dubbele-tab-probleem eerst gereproduceerd tegen `transport-mock.mjs`
(reproductiescript + een Playwright-test met twee tabs in dezelfde
browsercontext): een tweede `connect()` met dezelfde `sessionToken`
overschrijft stilzwijgend de listener-entry van de eerste tab
(`room.listeners.set(sessionToken, listener)`), waardoor die tab nooit meer
een event ontvangt zonder dat 'ie dat zelf weet. Bevestigd, niet aangenomen.

`03` §7 vraagt om "de nieuwste of eerste actieve sessie deterministisch
leidend" én dat de andere tab een uitleg toont in plaats van stil dood te
gaan. Het eerste deel gebeurt al vanzelf (de nieuwste `connect()` wint de
Map-entry); het tweede deel ontbrak volledig.

**Gebouwd (voorstel, geen definitief besluit):** `session-shell.mjs` maakt nu
een `BroadcastChannel` per sessie (`rounda-session-{code}`, browser-native,
geen nieuwe dependency) en kondigt bij het mounten zijn eigen `tabId` +
tijdstip aan. Een tab die een latere aankondiging voor dezelfde sessie ziet
toont een informatieve banner (`session.duplicateTab`, alle drie de locales)
i.p.v. stil door te blijven draaien. Lost de onderliggende Map-overschrijving
zelf niet op (transportlaag-gedrag, expliciet niet aangeraakt) — maakt de
situatie alleen zichtbaar voor wie 'm treft. Geverifieerd met Playwright: de
oudere tab toont de banner zodra de nieuwere opent, de nieuwere tab niet.

**Verzoek:** bevestig of `BroadcastChannel` de gewenste aanpak is voor dit
soort cross-tab-signalering (het is de enige client-side optie zonder een
nieuw serverbouwstuk — alternatief zou een `localStorage`-event zijn, functie
gelijk maar minder direct), en of een banner volstaat of dat er ook een
actieve stap gewenst is (bv. de oudere tab z'n socket zelf laten sluiten).

---

## UI-15 — Tie-regel bij gelijke scores (thema 1, 3 aug 2026)

**Voor:** de producteigenaar. `04-SCREEN-SPECIFICATIONS.md`'s S15 noemt dit
zelf al expliciet: "gedeelde plaats of secundaire sortering wordt expliciet
productbesluit" — nog niet genomen.

Bij het bouwen van `1-schermen-en-flow/prompts/08-leaderboard-en-podium.md`
(rankbeweging + podium) getest met een tie-scenario (twee gelijke scores via
een testharnas): de client toont gewoon de servervolgorde zonder enige
gedeelde-plaats-indicatie — bij 900/900/500 krijgen de twee spelers met 900
gewoon posities 1 en 2, geen "=1"-notatie of vergelijkbare markering.

**Al ontdekt, niet door de client verzonnen:** `transport-mock.mjs`'s
`rankPlayers()` heeft al een tiebreak (`b.score - a.score || a.joinedAt -
b.joinedAt` — bij gelijke score wint wie eerder joinde) die nergens in `04`
of `03` als productbesluit staat. Dat is dus een ongedocumenteerde
mock-aanname, niet per se de gewenste regel.

**Verzoek:** een besluit over (a) of gelijke scores een gedeelde plaats tonen
(bv. beide "#1") of een secundaire sortering (zoals de huidige `joinedAt`-
tiebreak, of bv. snelste gemiddelde antwoordtijd), en (b) of dat besluit ook
in `04`/`03` vastgelegd moet worden zodat de mock het niet langer stilzwijgend
bepaalt. De client (`standings-model.mjs`) doet zelf bewust geen eigen
ranking — die volgt zodra de servervolgorde dat besluit weerspiegelt.

**Herzien (thema 1, 3 aug 2026), principe 8 — niet ingetrokken, maar
gecorrigeerd:** het besluit hierboven bleek al genomen, alleen niet door mij
geraadpleegd. `GAME-RULES.md` §Gelijke eindscore en `docs/game-rules-plan/
prompts/GR2-standings.md` (status: "uitgevoerd, geverifieerd... competitie-
rangschikking is bevestigd, ontwerpbeslissing 1") leggen exact vast: score →
`correctCount` → laagste totale responstijd → **gedeelde positie**
(competitierangschikking `1,1,3,4`, niet `1,1,2,3`). `server/rules/
standings.js` implementeert dit, met 23 doorlopende tests. Geen
producteigenaarsvraag meer.

**De echte, andere vraag die hieruit volgt (nieuw, voor INT-A):** de
implementatie is **inconsistent tussen de twee events**. `finishMatch()`
(`game:finished`, `server/composition/match-lifecycle.mjs` rond regel 1112)
gebruikt `rankPlayers()` correct, inclusief gedeelde `position`. `getScoreboard()`
(`scoreboard:updated`, dezelfde file rond regel 1049-1071) gebruikt dat niet —
het levert een eigen `rank: index + 1` per entry, sequentieel, zonder
gelijke-plaats-ondersteuning, uit `getScoreboardTop()`. Twee verschillende
velden (`rank` vs. `position`) voor twee events die conceptueel hetzelfde
zouden moeten doen. Daarbovenop: `transport-mock.mjs` implementeert geen van
beide (eigen `joinedAt`-tiebreak, altijd sequentieel, altijd via `top`/
`podium` zonder onderscheid) — testen tegen de mock geeft dus geen enkel
signaal over dit verschil, en de client (`standings-model.mjs`) negeert elk
binnenkomend rangveld sowieso en berekent zelf `index + 1`.

**Verzoek aan INT-A:** bevestig of `scoreboard:updated` bewust een
vereenvoudigde tussenstand geeft (sequentieel, geen ties) terwijl alleen de
eindstand de volledige competitierangschikking toont, of dat dit een gemiste
aansluiting is die `getScoreboard()` ook `rankPlayers()` zou moeten gebruiken.
Zodra dat vaststaat, is er een klein, duidelijk afgebakend client-vervolg:
`standings-model.mjs`'s `standingsFrom()` moet een aangeleverd
`position`/`rank`-veld per entry gebruiken in plaats van zelf `index + 1` te
berekenen — dat is een eigen `HANDOFF`-punt zodra dit besluit er is, geen
aanname die ik nu al zou moeten doorvoeren op een nog inconsistente server.

---

## UI-16 — Drie S14-headlinetypen niet bouwbaar zonder protocolwijziging (thema 1, 3 aug 2026)

**Voor:** INT-A. `04`'s S14-prioriteitslijst noemt zeven headlinetypen; vier
zijn client-side bouwbaar (`social-headline.mjs`, `1-schermen-en-flow/
prompts/07-reveal-en-sociale-headline.md`) — deze drie niet, telkens omdat de
benodigde data nergens voor andere clients zichtbaar is:

1. **"Enige correct" voor een ándere speler.** `round:ended`'s `distribution`
   telt alleen (`[{optionId, count}]`), geen speleridentiteiten. Wél bouwbaar
   — en gebouwd — is de self-variant: als JÍJ de enige correcte speler was
   (`ownCorrect === true` + telling correcte optie `=== 1`), weet je dat via
   je eigen `round:ended`. Alleen "welke ándere speler het was" ontbreekt.
2. **Uitzonderlijk snelle speler.** Geen antwoordtijd per speler zichtbaar
   voor andere clients in het huidige protocol (`round:ended` geeft alleen de
   eigen `ownResponseTimeMs`, PROTOCOL.md).
3. **Streak (opeenvolgende juiste antwoorden).** Vereist historie over
   meerdere rondes per speler; geen client heeft zicht op andermans streaks,
   alleen op de eigen (die zou een lokale teller kunnen bijhouden, maar dat
   is iets anders dan een gedeeld sociaal feit tonen).

**Verzoek:** als een van deze drie alsnog gewenst is, is dat een
protocoluitbreiding (bv. `round:ended` uitbreiden met per-speler-identiteit
bij precies één correcte respons, of een aparte "snelste"/"streak"-broadcast)
— geen aanname die de client zelf zou moeten verzinnen.

**Herzien (thema 1, 3 aug 2026), principe 8 — punt 3 was een misverstand.**
`GAME-RULES.md` §Reactiezinnen en streaks legt vast dat streaks: "draaien per
speler", "mogen client-side worden bepaald uit serverresultaten", en "hebben
geen invloed op de server-score." Dat is dus expliciet een **eigen-speler-
reactietekst** ("reactiezinnen"), geen gedeeld sociaal feit over een ándere
speler — precies het omgekeerde van wat ik hierboven vroeg (een
protocoluitbreiding om ándermans streak te tonen). Er is geen protocolgat: de
eigen streak is nu al met de bestaande `round:ended`-geschiedenis client-side
te berekenen, alleen nog niet gebouwd.

Dit is dus geen `HANDOFF` naar INT-A meer, maar een gemiste (buildbare) feature
binnen thema 1 zelf: een lokale streakteller (opeenvolgende eigen
`selfCorrect`-rondes) plus een reactiezin daarbij — een ander soort
component dan `social-headline.mjs` (dat blijft over andermans/groepsfeiten
gaan), niet meegenomen binnen de scope van `07-reveal-en-sociale-headline.md`.
Zie [`11-verzoek-streak-reactiezinnen.md`](../../design-documentation/design/
1-schermen-en-flow/prompts/11-verzoek-streak-reactiezinnen.md) voor de
uitgewerkte, kleinst mogelijke bouwtaak.

Punten 1 en 2 hierboven (enige-correct-ándere-speler, snelste speler) blijven
staan zoals oorspronkelijk geschreven — daar vond ik geen tegenbewijs in
`GAME-RULES.md`/`DECISIONS.md`.

---

## UI-17 — S02: twee scope-beperkingen (thema 1, 3 aug 2026)

**Voor:** de eigenaar van `client/flow/` (datamodel) en de producteigenaar
(besluit). Bij het bouwen van `views/host-setup.mjs`
(`1-schermen-en-flow/prompts/09-S02-spel-aanpassen.md`) bleken twee van `04`'s
vijf S02-groepen geen onderliggende data te hebben — niet als schijnkeuze
gebouwd, hier vastgelegd:

1. **Spelvorm.** `HostConfig.gameTypes` bestaat, maar `defaultHostConfig()`
   staat vast op `['flags_mc']` (`DECISIONS.md` #31/#32/#35: meerdere
   spelvormen expliciet geschrapt voor deze MVP). Het scherm toont dit nu als
   vaste tekst, geen dropdown die maar één, niet-wijzigbare optie zou bieden.
2. **Teams of individuele modus.** `HostConfig.mode`'s type is letterlijk
   alleen `'individual'` — er bestaat geen teamwaarde in het datamodel. Het
   scherm toont dit ook als vaste tekst. `04` noemt daarnaast "tijd" naast
   "aantal rondes" bij deze groep, maar `HostConfig` heeft geen
   tijd-per-ronde-veld — ook niet gebouwd.

**Verzoek:** een besluit of teammodus en/of tijd-per-ronde alsnog gewenste
features zijn. Zo ja: dat is een datamodel-/protocolwijziging bij
`client/flow/`'s eigenaar, geen aanname die dit scherm zelf zou moeten maken.

**Herzien (thema 1, 3 aug 2026), principe 8 — beide punten waren geen open
"of dit gewenst is"-vraag, ik had de spelregeldocumenten niet volledig
geraadpleegd:**

1. **Teams.** `GAME-RULES.md` §Teams heeft de kop **"fase 1.5"** en een
   volledig uitgewerkt algoritme (rondegemiddelde per team, afgerond,
   opgeteld tot teamscore — zodat teamgrootte en late joins geen oneerlijk
   voordeel geven; eindstand toont winnend team + beste individuele speler
   per team; gelijkspel toegestaan). Teams zíjn dus al bevestigd als
   toekomstige feature — alleen bewust niet in de huidige fase. De echte
   vraag is niet "willen we dit", maar **wanneer fase 1.5 aan de orde is**,
   en of `HostConfig`/`client/flow/` daar nu al iets voor moet voorbereiden
   (bv. een `teamId`-veld reserveren) of pas wanneer die fase start.
2. **Tijd-per-ronde.** `GAME-RULES.md`'s rondestructuurtabel bevestigt al een
   default + range: "Vraag actief: 15s, instelbaar 10–30s." Dat is dus geen
   open productvraag — de instelbaarheid is al besloten. Het echte gat is dat
   `HostConfig`/`SETTABLE_CONFIG_KEYS` (`client/flow/host-setup-state.mjs`)
   domweg geen veld heeft voor iets dat al bevestigd instelbaar hoort te zijn.

**Verzoek (herzien), alleen aan `client/flow/`'s eigenaar, geen
producteigenaarsbesluit meer nodig voor punt 2:** voeg een
`questionDurationMs`-achtig veld toe aan `HostConfig`/`SETTABLE_CONFIG_KEYS`
(10–30s, default 15s per `GAME-RULES.md`), zodat `views/host-setup.mjs` dat
kan aansturen — een kleine, al-bevestigde toevoeging. Voor punt 1 (teams)
volstaat een bevestiging van de planning (wanneer is fase 1.5), geen
inhoudelijk besluit — dat ligt al vast in `GAME-RULES.md`.

---

## UI-18 — geen server-side timeout ná `host_disconnected` (thema 5, 3 aug 2026)

**Voor:** INT-A / PR. **Urgentie:** laag qua techniek, middel qua product —
een verdwenen host laat de room nu voor onbepaalde tijd hangen.

`08-ACCESSIBILITY-AND-RESILIENCE.md` §7 vraagt: korte recoveryperiode +
reconnect bij heropenen (✅ bestaat al: `game:pause` met reden
`host_disconnected`, getoond via de pauze-overlay), en ná een timeout een
nette beëindiging met uitslagbehoud. Dat laatste bestaat niet: `grep` op
`host_disconnected` in `server/` levert alleen commentaar/enum-vermeldingen
op (`state-machine.js:82`, `match-lifecycle.mjs:186`), geen timer. De enige
grace-waarde in de server is `deadlineGraceMs: 250`
(`room-lifecycle.mjs:105`) — de antwoord-deadlinemarge, niet gerelateerd.

Geen client-side timer gebouwd als vervanging: dat zou een tweede,
potentieel afwijkende bron van waarheid worden over wanneer een room als
"verlaten" geldt.

**Verzoek:**
1. Een server-side timeout ná `host_disconnected` (duur: aan INT-A/PR).
2. Bij afloop een event met de laatste bekende stand, zodat de client
   "uitslagbehoud" ook zichtbaar kan tonen (niet alleen server-side
   data-behoud).

Zodra dat event bestaat is de clientkant triviaal: hetzelfde patroon als
`session-shell.mjs`'s bestaande `terminate()` (S21), met de laatst bekende
`standingsPayload` zichtbaar. Volledige analyse in
`5-toegankelijk-en-robuust/prompts/T5-10-host-verliest-verbinding.md`.
VIP-overdracht (een andere speler wordt host) is een apart, expliciet open
productbesluit — geen onderdeel van dit verzoek.
