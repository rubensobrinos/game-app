# Interfacevoorstel voor PROTOCOL.md

Onderdeel van [`README.md`](README.md), fase GF8 — uitvoering van
[`prompts/GF8-protocol-interface-proposal.md`](prompts/GF8-protocol-interface-proposal.md).
**Dit is geen ADR en geen codewijziging.** Het bundelt de aannames die de gebouwde
`client/flow/`-modules (GF0–GF6) al moesten maken omdat `PROTOCOL.md`/`DATA-MODEL.md`
op die punten nog niets vastleggen, plus de vragen die daaruit volgen — voor de
`PROTOCOL.md`-eigenaar om te beantwoorden. Geen van de tien punten hieronder wordt
hier opgelost; waar een optie geschetst staat (bijvoorbeeld de drie routes in vraag 1)
is dat neutraal bedoeld, zonder voorkeur.

Bijgesteld na [`prompts/REVIEW-GF7-GF8.md`](prompts/REVIEW-GF7-GF8.md): die review
wees uit dat een eerdere versie van dit voorstel de joinvolgorde-blocker miste en
vier andere punten te vaag liet. Dit document is uitvoerbaar zonder dat `GF7`
(teams/spectator) al gebouwd is — waar naar GF7 verwezen wordt, is dat expliciet naar
een nog niet uitgevoerde ontwerpschets, niet naar bestaande code.

Vraag 1 (joinvolgorde) staat bewust vóór vraag 2 en 3: zonder een antwoord op vraag 1
zijn 2 en 3 nog niet eens goed te formuleren als concreet contractvoorstel, omdat
beide afhangen van *wanneer* en *ten opzichte van welke sessie* een team gekozen
wordt.

## 1. Hoofdvraag — waar past teamkeuze in de joinvolgorde?

`POST /api/v1/games/join` maakt vandaag in één stap een sessie + speler aan; de
joinflow gaat daarna direct naar de lobby of de actuele gamefase. `GAME-FLOW.md`
plaatst teamkeuze echter "na naamkeuze en vóór de lobby". Dat zijn twee losse
aannames die nog niet met elkaar zijn verzoend. Minstens drie wezenlijk verschillende
contracten zijn mogelijk, hier zonder voorkeur naast elkaar gezet:

- **(a) Team in de joinrequest zelf** — `POST /api/v1/games/join` krijgt een
  optioneel `team`-veld; de speler kiest vóór er een sessie bestaat. Vereist dat de
  beschikbare teams al bekend zijn vóórdat iemand joint (bijvoorbeeld via de
  invite-validatie of een publiek deel van de roomconfig).
- **(b) Beperkte pre-join-sessie** — een tijdelijke, niet-volwaardige sessie
  uitsluitend om een team te kiezen; pas daarna volgt de "echte" join.
- **(c) Verplichte tussenstate ná formeel joinen, vóór de lobby zichtbaar wordt** —
  wat `GF7`'s ontwerpschets nu impliciet aanneemt: de sessie bestaat al, de client
  houdt de lobby-UI bewust vast totdat een team-event is afgerond.

`GF7` (nog niet uitgevoerd, staat on hold) mag pas verder zodra hier een keuze ligt —
de vorm van de reducer die daar geschetst staat hangt inhoudelijk af van welke van
deze drie routes gekozen wordt.

## 2. Team-identifier

*Afhankelijk van vraag 1 — hieronder geformuleerd als vraag, niet als concreet
contractvoorstel, zolang niet vastligt wanneer teamkeuze in de joinvolgorde valt.*

`DATA-MODEL.md` kent `teamNames: string[]` in de `GameConfiguration` en
`Player.teamId`, zonder mapping of uniciteitsregel tussen die twee. Vragen:

- Kiest de client op een stabiele `teamId`, of op de zichtbare naam?
- Komt er een lijst `{ teamId, displayName }[]` in plaats van de kale `teamNames`?
- Moeten teamnamen uniek zijn binnen een room (zoals spelersnamen dat al zijn)?

## 3. Serverbevestiging en automatische toewijzing

*Ook afhankelijk van vraag 1, om dezelfde reden als vraag 2.*

Alleen een clientevent voorstellen (zoals een `player:choose-team`) is onvoldoende —
er is ook een bevestigingspad nodig, inclusief voor het geval een speler geen keuze
maakt. Vragen:

- Hoe komt de bevestiging terug: een ack op het client-event, een nieuw gericht
  serverevent, een uitbreiding van `room:player-changed`, of alleen via de
  eerstvolgende snapshot?
- Bij automatische indeling (geen voorafgaande clientactie): welk signaal
  informeert de speler over het toegewezen team?
- Idempotentie: wat gebeurt er bij een dubbele/herhaalde teamkeuze-poging (zelfde
  patroon als `round:answer`'s `actionId`-afhandeling in `PROTOCOL.md`, of iets
  anders)?

## 4. Spectator-auth, subscription en veilige projectie

`route-resolver`, `match-phase-state` en `edge-case-messaging` hebben als pure
reducers geen aparte spectatorvariant nodig — ze zijn herbruikbaar zoals ze nu
gebouwd zijn. Maar `PROTOCOL.md` kent alleen de rollen `host` en `player`, geen
read-only rol. Vragen:

- Hoe authenticeert/identificeert een spectator zich, zonder host- of spelersrol?
- Hoe abonneert een spectator zich op roomupdates (dezelfde socketroom? een aparte
  read-only kanaal?)
- Welke velden uit snapshot/events moeten voor een spectator wég-geprojecteerd
  worden (bijvoorbeeld individuele antwoorden of namen die niet voor een
  niet-deelnemer bedoeld zijn)?

## 5. `pausedState` — twee losse vragen, niet één

Een eerdere versie van dit voorstel koppelde de volledige `DATA-MODEL.md`-vorm van
`pausedState` (`previousPhase`, `remainingMs`, `reason`, `pausedAt`) direct aan zowel
de snapshot als het live event. Dat klopt niet vanzelfsprekend: `PROTOCOL.md` noemt
voor het live `game:paused`-event alleen "reden, vorige fase" als kernpayload. Twee
aparte vragen:

- Bevat de `room:state`-snapshot een `pausedState`-veld in de volledige
  `DATA-MODEL.md`-vorm? (`PROTOCOL.md`'s voorbeeld-snapshot toont dit veld niet,
  maar noemt zichzelf expliciet "minimale structuur" — afwezigheid in het voorbeeld
  is geen bewijs van afwezigheid in het echte contract.)
- Draagt het live `game:paused`-*event* diezelfde volledige vorm, of alleen
  `reason`/`previousPhase`, met `remainingMs`/`pausedAt` elders (bijvoorbeeld alleen
  in de snapshot) of afwezig?

(Bron van de aanname die dit blootlegde: `match-phase-state.mjs`, zie
`prompts/GF3-match-phase-state.md` §Open spec-vraag.)

## 6. Naamsuggestie vóór join

Ongewijzigd t.o.v. eerdere versies van dit voorstel: `GAME-FLOW.md` beschrijft de
volgorde *scan QR → inviteId wordt gevalideerd → naamveld met reeds voorgestelde
willekeurige naam → [Meedoen] → sessie aangemaakt*, wat een validatie-/
naamsuggestiestap vóór "Meedoen" impliceert. `PROTOCOL.md` documenteert echter geen
los validatie-/previewendpoint — alleen `POST /api/v1/games/join`, dat in één stap
valideert én de sessie aanmaakt. Twee mogelijke lezingen:

1. Er komt nog een licht `GET`-previewendpoint bij `PROTOCOL.md`.
2. De voorgestelde naam wordt puur lokaal gegenereerd (zonder servercall) en pas bij
   `POST /api/v1/games/join` definitief gemaakt, met risico op een naam die na join
   alsnog wijzigt (bijvoorbeeld bij een botsing).

(Bron: `join-state.mjs`, zie `prompts/GF2a-join-state.md` §Open spec-vraag.)

## 7. `game:paused`-reden-enum

Ongewijzigd t.o.v. eerdere versies van dit voorstel: wat is de volledige, officiële
lijst mogelijke `reason`-waarden voor `game:paused`? `PROTOCOL.md` noemt alleen
"reden, vorige fase" zonder de mogelijke waarden op te sommen; `DATA-MODEL.md`'s
`pausedState`-voorbeeld toont `"reason": "host"`, maar dat is één voorbeeld, geen
uitputtende enum. De gebouwde `edge-case-messaging`-module gokt op
`host_disconnected` en `no_answers` als redelijke namen voor twee specifieke
randgevallen uit `GAME-FLOW.md`, met een expliciete fallback (`pause.unknown`) voor
elke onbekende/toekomstige waarde — dat is een aanname, geen bevestigd contract.

(Bron: `edge-case-messaging.mjs`, zie `prompts/GF5-edge-case-messaging.md` §Open
spec-vraag.)

## 8. Wat al zelf is opgelost (ter info, geen actie nodig)

- **`joinSource` (`qr` vs `shared_link`):** opgelost via een `src`-queryparameter op
  de gegenereerde QR- resp. kopieerlink (`share-actions.mjs`, zie
  `prompts/GF6-share-actions.md`). `route-resolver` negeert `search` voor het
  bepalen van het routetype; `joinSourceFor` leest `search` apart voor dit doel.
  Geen wijziging aan `PROTOCOL.md` nodig.

## 9. Cross-team item, niet voor deze eigenaar

- **`PRODUCT.md` vs. `DATA-MODEL.md`:** de Groepsbattle-preset noemt in `PRODUCT.md`
  vier spelvormen (`flags_mc`, `real_or_fake_flag`, `higher_lower`, `odd_one_out`),
  terwijl `DATA-MODEL.md`'s voorbeeld-`GameConfiguration` voor exact dezelfde
  `"preset": "group_battle"` daarnaast ook `capitals_mc` bevat (vijf spelvormen). De
  gebouwde `host-setup-state`-module volgt `PRODUCT.md` (vier spelvormen), conform de
  bronvolgorde uit `docs/multiplayer/README.md` §Bronvolgorde bij
  tegenstrijdigheden — dat is dus geen open vraag over wát te implementeren, maar de
  tegenstrijdigheid zelf is nog niet gecorrigeerd in de bron. Alleen genoemd voor
  volledigheid; dit hoort bij de `DATA-MODEL.md`-eigenaar, niet bij `PROTOCOL.md`.
  (Bron: `host-setup-state.mjs`, zie `prompts/GF2b-host-setup-state.md` §Gevonden
  tegenstrijdigheid.)

## 10. Bijlage: functiesignaturen als concreet reviewmateriaal

Twee soorten materiaal, expliciet niet door elkaar gepresenteerd. Functiebodies zijn
hieronder weggelaten (`…`) waar dat de leesbaarheid van de signatuur niet verandert;
de JSDoc-typedefs en -signaturen zelf zijn woordelijk overgenomen uit de
bronbestanden.

### 10.1 Gebouwd en getest (GF0–GF6)

Zeven modules, elk als eigen bestand onder `client/flow/`, elk met eigen
`node --test`-dekking.

**`route-resolver.mjs`**

```js
/**
 * @param {string} pathname
 * @param {string} [search]
 * @returns
 *   | { route: 'home' }
 *   | { route: 'join', inviteId: string }
 *   | { route: 'game' | 'host' | 'screen', code: string }
 *   | { route: 'unknown' }
 */
export function resolveRoute(pathname, search) { … }
```

**`join-state.mjs`**

```js
/**
 * @typedef {
 *   | { type: 'invite', inviteId: string, joinSource: 'qr' | 'shared_link' | 'unknown' }
 *   | { type: 'code', code: string }
 * } Locator
 *
 * @typedef {
 *   | { status: 'idle' }
 *   | { status: 'name-entry', locator: Locator, suggestedName: string | null, displayName: string | null }
 *   | { status: 'submitting', locator: Locator, displayName: string | null }
 *   | { status: 'joined', session: object }
 *   | { status: 'error', code: string, locator: Locator }
 * } JoinState
 */

/** @returns {JoinState} */
export function initialJoinState() { … }

/** @param {JoinState} state @param {object} event @returns {JoinState} */
export function transition(state, event) { … }

/**
 * Wat er nu naar de server moet, of null als er niets te versturen valt.
 * @param {JoinState} state
 * @returns {{ inviteId?: string, gameCode?: string, displayName: string | null, joinSource: string } | null}
 */
export function joinRequestFor(state) { … }
```

**`host-setup-state.mjs`**

```js
/**
 * @typedef {{
 *   preset: string,
 *   gameTypes: string[],
 *   language: string,
 *   difficulty: string,
 *   totalRounds: number,
 *   pacing: 'auto' | 'host',
 *   speedBonus: boolean,
 *   allowLateJoin: boolean,
 *   mode: 'individual',
 * }} HostConfig
 *
 * @typedef {{
 *   mode: 'quick-start' | 'advanced',
 *   config: HostConfig,
 *   hostParticipates: boolean,
 *   displayName: string | null,
 *   status: 'editing' | 'creating' | 'created' | 'error',
 *   errorCode: string | null,
 * }} HostSetupState
 */

/** Start altijd met de Groepsbattle-preset (PRODUCT.md). @returns {HostSetupState} */
export function initialHostSetupState() { … }

/** @param {HostSetupState} state @param {object} event @returns {HostSetupState} */
export function transition(state, event) { … }

/**
 * Wat er nu naar de server moet, of null als er niets te versturen valt. Alleen
 * non-null tijdens 'creating' — hetzelfde moment als join-state's
 * `joinRequestFor` tijdens 'submitting' — zodat een aanroeper altijd hetzelfde
 * patroon gebruikt: dispatch SUBMIT, vraag daarna pas het verzoek op.
 * @param {HostSetupState} state
 * @returns {{ config: HostConfig, hostParticipates: boolean, displayName: string | null } | null}
 */
export function createRequestFor(state) { … }
```

**`match-phase-state.mjs`**

```js
/**
 * @typedef {'UNINITIALIZED'|'LOBBY'|'COUNTDOWN'|'ROUND_ACTIVE'|'ROUND_RESULT'|'SCOREBOARD'|'FINISHED'|'PAUSED'} Phase
 *
 * @typedef {{
 *   phase: Phase,
 *   matchId: string | null,
 *   pausedState: { previousPhase: Phase, remainingMs: number | null, reason: string | null, pausedAt: number | null } | null,
 * }} MatchPhaseState
 */

/** @returns {MatchPhaseState} */
export function initialMatchPhaseState() { … }

/**
 * @param {MatchPhaseState} state
 * @param {{ event: string, payload: object }} serverMessage Exacte envelope-vorm uit PROTOCOL.md.
 * @returns {MatchPhaseState}
 */
export function applyServerEvent(state, serverMessage) { … }
```

**`reconnect-state.mjs`**

```js
/**
 * @typedef {{
 *   status: 'connected' | 'disconnected' | 'reconnecting',
 *   attempt: number,
 *   pendingSnapshotRequest: boolean,
 * }} ReconnectState
 */

/** @returns {ReconnectState} */
export function initialReconnectState() { … }

/** @param {ReconnectState} state @param {{ type: string }} event @returns {ReconnectState} */
export function transition(state, event) { … }

/**
 * Zuivere backoff-formule, geen timer. `attempt` is 1-based (de eerstvolgende poging).
 * @param {number} attempt
 * @returns {number} vertraging in milliseconden
 */
export function backoffDelayMs(attempt) { … }

/**
 * Wat er nu moet gebeuren, of null. Nooit meer dan één actie tegelijk: eerst
 * reconnecten, dan (na RECONNECT_SUCCEEDED) pas de snapshotaanvraag.
 * @param {ReconnectState} state
 * @returns
 *   | { type: 'schedule-reconnect', delayMs: number }
 *   | { type: 'request-snapshot' }
 *   | null
 */
export function nextActionFor(state) { … }
```

**`edge-case-messaging.mjs`**

```js
export const KNOWN_ERROR_CODES = new Set([
  'GAME_NOT_FOUND', 'INVITE_INVALID', 'GAME_FULL', 'GAME_ALREADY_STARTED',
  'LATE_JOIN_DISABLED', 'ROOM_LOCKED', 'CODE_RATE_LIMITED',
  'TOKEN_INVALID', 'TOKEN_EXPIRED', 'SESSION_REVOKED', 'NOT_HOST', 'NOT_PLAYER',
  'INVALID_PHASE', 'ROUND_NOT_ACTIVE', 'PLAYER_NOT_ELIGIBLE', 'ALREADY_ANSWERED',
  'DEADLINE_PASSED', 'INVALID_ANSWER_FORMAT', 'UNSUPPORTED_EVENT',
  'NAME_TOO_LONG', 'NAME_INVALID', 'RATE_LIMITED', 'PROTOCOL_VERSION_UNSUPPORTED',
]);

/** @param {string} errorCode @returns {string} */
export function messageForErrorCode(errorCode) { … }

/** @param {string | null | undefined} reason @returns {string} */
export function messageForPauseReason(reason) { … }

/**
 * @param {'connected' | 'disconnected' | 'reconnecting'} status
 * @returns {string | null} null voor 'connected' — niets te tonen
 */
export function messageForConnectionStatus(status) { … }

/** @param {'kicked' | 'revoked'} kind @param {string | null} [reason] @returns {string} */
export function messageForSessionTermination(kind, reason) { … }
```

**`share-actions.mjs`**

```js
/**
 * @param {string} joinUrl De kale joinUrl uit PROTOCOL.md (zonder querystring).
 * @returns {{ qrUrl: string, copyUrl: string }}
 */
export function shareUrlsFor(joinUrl) { … }

/**
 * Inverse van shareUrlsFor: leest de src-parameter terug.
 * @param {string} search bv. `location.search` op de `/j/{inviteId}`-route.
 * @returns {'qr' | 'shared_link' | 'unknown'}
 */
export function joinSourceFor(search) { … }

/**
 * @param {{ nativeShareAvailable: boolean }} capabilities
 * @returns {Array<'show-qr' | 'native-share' | 'copy-link' | 'show-code'>}
 */
export function shareActionsFor(capabilities) { … }

/**
 * Puur informatief (bv. voor een waarschuwing naast de deelknop) — bepaalt niet
 * of de Delen-actie zelf zichtbaar is, die is altijd beschikbaar.
 * @param {{ locked: boolean, allowLateJoin: boolean, gameHasStarted: boolean }} roomState
 * @returns {boolean} of een nieuwe joiner nu via deze link zou kunnen meedoen
 */
export function canNewJoinerUse(roomState) { … }
```

### 10.2 Nog niet gebouwd, alleen ontwerp (GF7) — onbevestigd, geen code

**Let op: dit is geen bestaand bestand.** `team-selection-state.mjs` bestaat niet in
`client/flow/` — `GF7` staat on hold in afwachting van een antwoord op vraag 1
hierboven. Wat volgt is een ontwerpschets, letterlijk overgenomen uit de markdown van
[`prompts/GF7-teams-and-spectator.md`](prompts/GF7-teams-and-spectator.md) (§Deel 1),
niet uit een `.mjs`-bronbestand. Deze signatuur is bewust nog met lege
functiebodies genoteerd in die prompt zelf — dat is geen omissie van dit
reviewdocument. Zodra vraag 1 beantwoord is, wijzigt deze schets waarschijnlijk nog
(met name de vorm van `teamRequestFor`'s return-waarde, die de prompt zelf al
aanmerkt als "placeholder").

**`team-selection-state.mjs` (ontwerp, nog geen code)**

```js
/**
 * @typedef {
 *   | { status: 'choosing', availableTeams: string[], selectedTeam: string | null }
 *   | { status: 'submitting', selectedTeam: string }
 *   | { status: 'confirmed', teamId: string }
 *   | { status: 'error', code: string, availableTeams: string[] }
 * } TeamSelectionState
 */

/** @param {string[]} availableTeams @returns {TeamSelectionState} */
export function initialTeamSelectionState(availableTeams) {}

/** @param {TeamSelectionState} state @param {object} event @returns {TeamSelectionState} */
export function transition(state, event) {}

/**
 * Wat er nu naar de server moet, of null. Vorm is een placeholder — zie de
 * blokkade hierboven: `teamRequestFor` levert alleen `{ selectedTeam }`, geen
 * vast event-envelope, totdat PROTOCOL.md dat vastlegt.
 * @param {TeamSelectionState} state
 * @returns {{ selectedTeam: string } | null}
 */
export function teamRequestFor(state) {}
```

Events die de ontwerpschets noemt: `TEAM_SELECTED` (`{ team }`), `SUBMIT`,
`TEAM_CONFIRMED` (`{ teamId }`), `TEAM_REJECTED` (`{ code }`), `RETRY` — zelfde
non-null-tijdens-in-flight-conventie als `joinRequestFor`/`createRequestFor`
hierboven.
