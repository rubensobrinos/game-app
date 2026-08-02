# Prompt — GF3: Match-phase-state

Onderdeel van [`../README.md`](../README.md), fase GF3. Vereist dat GF1 klaar is (GF2a/
GF2b niet strikt, maar wel handig als voorbeeld van de reducer-stijl). Doel: een pure
reflectie van de serverfase — nooit een eigen oordeel over welke transitie "geldig"
is.

## Brondocument

`GAME-FLOW.md` §Hoofdroute. `ARCHITECTURE.md` §State machine:

```text
LOBBY → COUNTDOWN → ROUND_ACTIVE → ROUND_RESULT → SCOREBOARD
      → COUNTDOWN / ROUND_ACTIVE → FINISHED
```

`PAUSED` bewaart vorige fase, resterende tijd, reden, pauzetijdstip. "Iedere
transitie heeft precies één eigenaar: server-timer of geautoriseerde hostactie."

## Bewuste ontwerpkeuze: geen legaliteitscontrole op transities

`ARCHITECTURE.md`'s bouwsteen `state-machine` (AR1, eigendom van de
`ARCHITECTURE.md`-agent) is al een reducer die bepáált welke transitie geldig is —
dat is de server-kant, autoritair. Als deze client-module een eigen kopie van die
legaliteitstabel zou bouwen, ontstaan er twee bronnen van waarheid die uit elkaar
kunnen lopen (precies wat de "Wijzigingsdiscipline" in `docs/multiplayer/README.md`
wil voorkomen).

Concreet bewijs dat dit nodig is: `GAME-RULES.md`'s `scoreboardFrequency` kan
`every_round`, periodiek of `uit` zijn — de route ROUND_RESULT → SCOREBOARD is dus
niet altijd verplicht, en ROUND_RESULT → (direct) ROUND_ACTIVE is evengoed legitiem.
Een hardgecodeerde clienttabel zou dat verkeerd kunnen afdwingen.

**Regel voor deze module:** elk bekend servergebeurtenis-type zet de fase op de
bijbehorende waarde, punt. Onbekende of niet-fase-gerelateerde events
(`error`, `session:kicked`, `room:player-changed`, iets toekomstigs) laten de state
ongewijzigd (`PROTOCOL.md` basisregel 7: "onbekende serverevents mogen clients
negeren"). Geen enkele combinatie van fases wordt als "ongeldig" geweigerd.

## Gecorrigeerd na bouw

De oorspronkelijke event→fase-tabel noemde voor `room:state` alleen een override van
`phase`. Dat was onvolledig: `PROTOCOL.md`'s eigen snapshot-voorbeeld bevat wél
degelijk `room.matchId`. Zonder dat mee te nemen blijft `matchId` op `null` hangen
voor een client die start met een snapshot vóórdat er ooit een `game:started`/
`game:rematch-started` is binnengekomen (bijvoorbeeld bij reconnect, zie GF4). "Volledige
override" (de kern van dit ontwerp) moet dus ook `matchId` omvatten. Zie de
bijgewerkte tabel hieronder en de implementatie.

## Open spec-vraag — niet door mij op te lossen

`PROTOCOL.md`'s voorbeeld-snapshot toont `room.phase`, maar geen `pausedState`-veld,
terwijl `DATA-MODEL.md`'s `Match`-object wél een `pausedState` kent
(`previousPhase`, `remainingMs`, `reason`, `pausedAt`). Ik neem aan dat een snapshot
tijdens een pauze `payload.room.pausedState` in diezelfde vorm meestuurt, maar dat
is een `public_api`-detail dat de `PROTOCOL.md`-eigenaar moet bevestigen — de
snapshot in `PROTOCOL.md` heet zelf expliciet "minimale structuur", dus afwezigheid
in het voorbeeld is geen bewijs van afwezigheid in het echte contract.

## Te bouwen module

Bestand: `client/flow/match-phase-state.mjs`.

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
export function initialMatchPhaseState() {}

/**
 * @param {MatchPhaseState} state
 * @param {{ event: string, payload: object }} serverMessage Exacte envelope-vorm uit PROTOCOL.md.
 * @returns {MatchPhaseState}
 */
export function applyServerEvent(state, serverMessage) {}
```

Deze module bewaart uitdrukkelijk **geen** rondedata, scoreboard-inhoud, podium,
spelerscount of lock-status — alleen de fase zelf en pauze-boekhouding. Die andere
payload-inhoud hoort bij een nog niet benoemde weergave-module, buiten dit plan
zoals het nu staat.

## Event → fase-mapping

| Event | Nieuwe `phase` | Overig |
| --- | --- | --- |
| `room:state` | `payload.room.phase`, ongewijzigd overgenomen (ook een onbekende toekomstige waarde) | volledige override, ongeacht huidige state — snapshot is leidend (`ARCHITECTURE.md` §3, `PROTOCOL.md` §Basisregels 6). **Ook `matchId` wordt overgenomen uit `payload.room.matchId`** wanneer aanwezig; ontbreekt het veld, dan blijft de laatst bekende `matchId` staan (geen aanname dat afwezigheid "geen match" betekent). |
| `game:started` | `COUNTDOWN` | `matchId` bijgewerkt |
| `round:started` | `ROUND_ACTIVE` | |
| `round:ended` | `ROUND_RESULT` | |
| `scoreboard:updated` | `SCOREBOARD` | niet gegarandeerd elke ronde — geen aanname hierover in deze module |
| `game:paused` | `PAUSED` | `pausedState = { previousPhase: payload.previousPhase, reason: payload.reason ?? null, remainingMs: payload.remainingMs ?? null, pausedAt: payload.pausedAt ?? null }` |
| `game:resumed` | `state.pausedState?.previousPhase` | `pausedState` → `null`. Als er geen `pausedState` was: state ongewijzigd, niet gokken. |
| `game:finished` | `FINISHED` | |
| `game:rematch-started` | `LOBBY` | `matchId` bijgewerkt naar de nieuwe |
| alles anders (onbekend, of expliciet niet-fase: `error`, `session:kicked`, `session:revoked`, `room:player-changed`, `room:lock-changed`, `round:progress`, `round:answer-accepted`) | ongewijzigd | zie basisregel 7 hierboven |

## Verplichte testgevallen

| # | Scenario | Verwacht |
| --- | --- | --- |
| 1 | `initialMatchPhaseState()` | `{ phase: 'UNINITIALIZED', matchId: null, pausedState: null }` |
| 2 | `room:state` met `payload.room.phase = 'ROUND_ACTIVE'` vanuit elke beginstate | `phase` wordt exact die waarde, ook al "past" de overgang niet in het lineaire diagram |
| 3 | `room:state` met een onbekende toekomstige fasewaarde (bv. `'BONUS_ROUND'`) | wordt zonder throw overgenomen — geen validatie tegen een vaste enum |
| 4 | `game:started` vanuit `LOBBY` | `COUNTDOWN`, `matchId` bijgewerkt |
| 5 | `round:started` → `round:ended` → `scoreboard:updated` → opnieuw `round:started` | `ROUND_ACTIVE` → `ROUND_RESULT` → `SCOREBOARD` → `ROUND_ACTIVE`, geen enkele stap geweigerd |
| 6 | `round:ended` direct gevolgd door `round:started` (scoreboard overgeslagen) | `ROUND_RESULT` → `ROUND_ACTIVE`, geen fout — bewijst dat SCOREBOARD niet verplicht is |
| 7 | `game:paused` vanuit `ROUND_ACTIVE` met volledige payload | `phase: 'PAUSED'`, `pausedState.previousPhase === 'ROUND_ACTIVE'` en de overige velden overgenomen |
| 8 | `game:paused` met een payload die `remainingMs`/`pausedAt` mist | geen throw; ontbrekende velden worden `null`, niet `undefined` |
| 9 | `game:resumed` na test 7 | `phase` terug naar `'ROUND_ACTIVE'`, `pausedState: null` |
| 10 | `game:resumed` zonder voorafgaande `game:paused` (`state.pausedState === null`) | state volledig ongewijzigd |
| 11 | `game:finished` | `FINISHED` |
| 12 | `game:rematch-started` met nieuwe `matchId` | `LOBBY`, `matchId` bijgewerkt |
| 13 | Elk van `error`, `session:kicked`, `session:revoked`, `room:player-changed`, `room:lock-changed`, `round:progress` als event | state exact ongewijzigd (diepe gelijkheid), voor elk apart getest |
| 14 | Een volledig onbekend/verzonnen eventtype (`foo:bar`) | state ongewijzigd, geen throw |
| 15 | `applyServerEvent` met `payload: {}` voor elk faseveranderend event | geen throw, resulterende `phase` klopt, ontbrekende subvelden worden `null` |
| 16 | `room:state` met `payload.room.matchId` na een eerdere `game:started` | `matchId` wordt overschreven met de nieuwe waarde uit de snapshot |
| 17 | `room:state` zónder `matchId`-veld, ná een eerdere `game:started` | laatst bekende `matchId` blijft staan |
| 18 | `room:state` als allereerste event (nooit een `game:started` gehad) mét `matchId` in de payload | `matchId` wordt direct gezet — dekt de reconnect-bij-eerste-load-situatie (GF4) |

## Niet in scope voor GF3

- Rondedata, scoreboard-inhoud, podium, spelerscount, lock-status — geen eigendom
  van deze module.
- `session:kicked`/`session:revoked` — hoort bij `session-store`/`reconnect-state`
  (GF4), niet bij de matchfase.
- Live aftellen/`remainingMs` omrekenen naar een tikkende UI-waarde — dat vereist de
  serveroffset uit `ARCHITECTURE.md`'s `server-time`-bouwsteen (AR4) en is een
  renderconcern, niet deze reducer.
- Enige vorm van "is deze transitie logisch" valideren — zie de ontwerpkeuze
  hierboven.

## Definition of done

- Alle testgevallen slagen, met `node --test client/flow/match-phase-state.test.mjs`.
- `applyServerEvent` gooit nooit een exception, voor geen enkel event/payload uit de
  tabel.
- Geen enkele branch bevat een hardgecodeerde lijst van "toegestane" fase-paren.
