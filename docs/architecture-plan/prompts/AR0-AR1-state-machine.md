# Prompt — AR0 + AR1: State machine

Dekt fase **AR0** (scope-check) en **AR1** (state machine) uit
[`../README.md`](../README.md#fasering). Kopieer alles onder **Prompt** naar een
nieuwe sessie of agent-aanroep wanneer we dit daadwerkelijk gaan bouwen. De prompt is
zelfstandig leesbaar — géén kennis van dit gesprek nodig.

**Revisie:** herschreven na [`REVIEW.md`](REVIEW.md) (2026-08-02). De belangrijkste
wijziging: de reducer krijgt bij overgangs- en hervat-events een expliciete,
door de aanroeper bepaalde en gevalideerde `nextPhase` mee, in plaats van dat zelf
te bepalen. Daardoor hoeft de reducer geen kennis te hebben van ronde-aantallen,
`scoreboardFrequency` of het onderscheid handmatige pauze vs. herstelpauze — die
blijven, zoals bedoeld, buiten scope.

---

## Prompt

Je werkt in de repo `game-app`. Er bestaat een multiplayer-specificatie in
`docs/multiplayer/` en een realisatieplan voor het architectuur-onderdeel in
`docs/architecture-plan/README.md`. Lees beide bestanden voordat je begint:

- `docs/multiplayer/ARCHITECTURE.md`, sectie **State machine**.
- `docs/multiplayer/DATA-MODEL.md`, secties **Room**, **GameConfiguration** en
  **Match** (voor de exacte vorm van `phase`, `pacing` en `pausedState`).
- `docs/multiplayer/GAME-RULES.md`, sectie **Rondestructuur** (voor auto-tempo vs.
  host-tempo).
- `docs/multiplayer/PROTOCOL.md`, sectie **Client → server events** (voor
  `game:next`, `game:pause`, `game:resume`, `UNSUPPORTED_EVENT`).
- `docs/architecture-plan/README.md`, uitgangspunten 1–4 en fase AR1.

### Stap 0 — bevestig de locatie (AR0)

Er bestaat nog geen servercode in deze repo (geen `package.json`, geen `server/`
map). Voordat je een bestand buiten `docs/` aanmaakt: stel de map
`server/architecture/state-machine/` voor en wacht op een bevestiging van de
gebruiker. Ga pas door naar stap 1 na akkoord.

### Stap 1 — bouw de state machine (AR1)

Bouw een **pure, dependency-vrije** reducer voor de faseovergangen van één match.
Geen Redis, geen sockets, geen timers, geen `Date.now()`/`Math.random()` binnen de
module — tijd komt altijd als expliciet argument binnen, zodat de functie
deterministisch testbaar blijft. Schrijf platte JavaScript met JSDoc-typering, geen
TypeScript — er is nog geen toestemming voor die dependency (zie
`docs/architecture-plan/README.md`, checkpoints).

**Fasen** (exact deze waarden, uit `ARCHITECTURE.md`):
`LOBBY`, `COUNTDOWN`, `ROUND_ACTIVE`, `ROUND_RESULT`, `SCOREBOARD`, `PAUSED`,
`FINISHED`.

#### State- en eventcontract (minimaal, niet-bindend voor andere modules)

```js
/**
 * @typedef {{
 *   phase: "LOBBY" | "COUNTDOWN" | "ROUND_ACTIVE" | "ROUND_RESULT" |
 *          "SCOREBOARD" | "PAUSED" | "FINISHED",
 *   pausedState: null | {
 *     previousPhase: string,
 *     remainingMs: number,
 *     reason: string,
 *     pausedAt: number,
 *   },
 * }} MatchState
 */
```

`pacing` (`"auto" | "host"`, uit `GameConfiguration.pacing` in `DATA-MODEL.md`) is
**geen** onderdeel van `MatchState` — het hoort bij `Room.config`, niet bij `Match`.
Geef het als apart argument mee, geprojecteerd door de aanroeper:

```js
/**
 * @param {MatchState} state
 * @param {Event} event
 * @param {"auto" | "host"} pacing
 * @param {number} now - epoch-ms, altijd door de aanroeper geleverd
 * @returns {{ ok: true, state: MatchState } | { ok: false, code: string }}
 */
function transition(state, event, pacing, now) { /* ... */ }
```

**Events** (discriminated union — dit is het volledige toegestane alfabet, elk ander
`type` levert `UNSUPPORTED_EVENT` op):

```js
/**
 * @typedef {
 *   | { type: "HOST_START" }
 *   | { type: "TIMER_ELAPSED", nextPhase: string }
 *   | { type: "HOST_NEXT", nextPhase: string }
 *   | { type: "HOST_PAUSE", reason: string, remainingMs: number }
 *   | { type: "HOST_RESUME", nextPhase: string }
 *   | { type: "HOST_FINISH" }
 * } Event
 */
```

`nextPhase` wordt dus altijd door de aanroeper bepaald en aangeleverd — de reducer
*valideert* alleen of die bestemming is toegestaan vanuit de huidige fase/pacing, hij
*kiest* hem niet. Zo hoeft deze module niets te weten over `roundIndex`,
`totalRounds` of `scoreboardFrequency` (die blijven bewust buiten scope), en hoeft
`HOST_RESUME` niet zelf te beslissen tussen "terug naar `previousPhase`" (handmatige
pauze) en "naar `COUNTDOWN` met nieuwe timing" (herstel na serverrestart, zie
`ARCHITECTURE.md` §10 en `PROTOCOL.md` `game:resumed`) — de aanroeper kent dat
onderscheid, deze reducer niet.

#### Toegestane overgangen

| Bronfase | Event | Pacing | Geldige `nextPhase`-waarden |
| --- | --- | --- | --- |
| `LOBBY` | `HOST_START` | auto, host | `COUNTDOWN` |
| `COUNTDOWN` | `TIMER_ELAPSED` | auto, host | `ROUND_ACTIVE` |
| `ROUND_ACTIVE` | `TIMER_ELAPSED` | auto, host | `ROUND_RESULT` |
| `ROUND_RESULT` | `TIMER_ELAPSED` | **auto** | `SCOREBOARD`, `COUNTDOWN`, `ROUND_ACTIVE`, `FINISHED` |
| `ROUND_RESULT` | `HOST_NEXT` | **host** | `SCOREBOARD`, `COUNTDOWN`, `ROUND_ACTIVE`, `FINISHED` |
| `SCOREBOARD` | `TIMER_ELAPSED` | **auto** | `COUNTDOWN`, `ROUND_ACTIVE`, `FINISHED` |
| `SCOREBOARD` | `HOST_NEXT` | **host** | `COUNTDOWN`, `ROUND_ACTIVE`, `FINISHED` |

`TIMER_ELAPSED` vanuit `ROUND_RESULT`/`SCOREBOARD` bij `pacing: "host"` wordt
afgewezen (`INVALID_PHASE`); `HOST_NEXT` vanuit diezelfde fasen bij `pacing: "auto"`
eveneens. `COUNTDOWN` en `ROUND_ACTIVE` zijn altijd timer-gedreven, ongeacht pacing
(`GAME-RULES.md`: alleen de uitslag- en tussenstand-wachtfasen zijn host-tempo
gevoelig). Dat SCOREBOARD soms wordt overgeslagen (`scoreboardFrequency`) en of de
volgende ronde met een nieuwe `COUNTDOWN` begint, is precies waarom `nextPhase`
door de aanroeper komt in plaats van hardcoded te zijn — de reducer valideert
lidmaatschap van de tabel hierboven, niet de reden achter de keuze.

**Pauzeren:**
- `HOST_PAUSE` is alleen geldig vanuit `COUNTDOWN`, `ROUND_ACTIVE`, `ROUND_RESULT`
  of `SCOREBOARD` (niet vanuit `LOBBY`, `PAUSED` of `FINISHED`).
- Resultaat: `phase: "PAUSED"`,
  `pausedState: { previousPhase: <bronfase>, remainingMs: event.remainingMs, reason: event.reason, pausedAt: now }`.
- Wijs af bij `remainingMs < 0` of niet-eindig (`INVALID_ANSWER_FORMAT` is hier niet
  van toepassing; gebruik `INVALID_PAUSE_STATE`) en bij een lege/ontbrekende
  `reason`.

**Hervatten:**
- `HOST_RESUME` is alleen geldig vanuit `PAUSED`.
- `nextPhase` moet één van `COUNTDOWN`, `ROUND_ACTIVE`, `ROUND_RESULT`, `SCOREBOARD`
  zijn (nooit `LOBBY`, `PAUSED` of `FINISHED`); de reducer valideert alleen
  lidmaatschap van die set, niet of het gelijk is aan `pausedState.previousPhase` —
  dat laatste is een bewuste keuze van de aanroeper (zie hierboven).
- Resultaat: `phase: event.nextPhase`, `pausedState: null`.

**Beëindigen:**
- `HOST_FINISH` is geldig vanuit elke fase behalve `FINISHED`, inclusief `PAUSED`.
- Resultaat: `phase: "FINISHED"`, `pausedState: null` (ook als de bronfase `PAUSED`
  was — de invariant hieronder geldt altijd).

#### Invarianten

1. Elke staat met `phase !== "PAUSED"` heeft `pausedState: null`. Geldt voor elk
   resultaat, inclusief `HOST_FINISH` vanuit `PAUSED`.
2. `transition` muteert `state` nooit. Bij succes: een nieuw state-object. Bij
   afwijzing: het originele `state`-object blijft ongewijzigd en wordt niet
   opnieuw aangemaakt (test dit met een referentie- of deep-equal-check).
3. Een afgewezen transitie levert altijd `{ ok: false, code }` op, nooit een throw.
4. Onbekend `event.type` → `{ ok: false, code: "UNSUPPORTED_EVENT" }` (zelfde code
   als `PROTOCOL.md` gebruikt voor dit scenario — bewuste aansluiting, geen ADR
   namens `PROTOCOL.md`).
5. Een ongeldige combinatie van bronfase/event/pacing/`nextPhase` →
   `{ ok: false, code: "INVALID_PHASE" }`.

### Tests (vóór of samen met de implementatie)

Geen losse categorieën — een tabelgedreven fixture-set met exacte rijen. Elke rij:
`{ description, fromState, pacing, event, now, expected }` waarbij `expected` ofwel
`{ ok: true, state: {...} }` ofwel `{ ok: false, code: "..." }` is. Dek minimaal:

1. Elke rij uit de overgangstabel hierboven, voor beide toepasselijke pacingwaarden.
2. Losse fixture voor de "volgende ronde"-tak (`ROUND_RESULT`/`SCOREBOARD` →
   `COUNTDOWN` of `ROUND_ACTIVE`), de "laatste ronde"-tak (→ `FINISHED`) en de
   "scoreboard overslaan"-tak (`ROUND_RESULT` → `COUNTDOWN`/`ROUND_ACTIVE` zonder
   `SCOREBOARD`).
3. `HOST_NEXT` afgewezen bij `pacing: "auto"`; `TIMER_ELAPSED` afgewezen bij
   `pacing: "host"` vanuit `ROUND_RESULT` en `SCOREBOARD`.
4. `nextPhase` buiten de toegestane set voor de betreffende rij → `INVALID_PHASE`.
5. `HOST_PAUSE` vanuit elk van de vier toegestane fasen (succes) én vanuit `LOBBY`,
   `PAUSED`, `FINISHED` (afwijzing). Plus: negatieve `remainingMs`, `Infinity`/`NaN`
   als `remainingMs`, en lege `reason` → elk afgewezen.
6. `HOST_RESUME` met een geldige `nextPhase` (succes, `pausedState` wordt `null`) en
   met `nextPhase: "LOBBY"` / `"PAUSED"` / `"FINISHED"` (afwijzing).
7. `HOST_FINISH` vanuit elke fase behalve `FINISHED` (inclusief vanuit `PAUSED`, met
   assertie dat `pausedState` daarna `null` is); vanuit `FINISHED` afgewezen.
8. `HOST_START` vanuit `LOBBY` (succes) en vanuit elke andere fase (afwijzing).
9. Onbekend event-`type` → `UNSUPPORTED_EVENT`, vanuit minstens twee verschillende
   fasen.
10. Eén test die aantoont dat een afgewezen transitie het originele state-object
    niet muteert (referentiegelijkheid of deep-equal vóór/na).
11. Geen enkele test hangt af van de systeemklok — `now` wordt altijd als vaste
    waarde meegegeven.

### Wat hier buiten valt

- Redis, sockets, REST, echte timers/`setTimeout` — dat komt pas bij het
  server-skeleton (AR5/AR6), niet nu.
- `roundIndex`/`totalRounds`/matchopbouw en `scoreboardFrequency`-interpretatie —
  dat is `Match`-/`GameConfiguration`-bookkeeping uit `DATA-MODEL.md`; deze module
  valideert alleen de door de aanroeper aangeleverde `nextPhase`, ze bepaalt hem
  niet.
- Het onderscheid handmatige pauze vs. herstelpauze na serverrestart — dat bepaalt
  de aanroeper via de `nextPhase` op `HOST_RESUME`, niet deze reducer.
- Absolute `startsAt`/`endsAt`-planning — dat hoort bij de timer-/socketlaag, niet
  bij deze pure fasetransitie.
- Nieuwe dependencies, inclusief TypeScript. Gebruik `node:test` en `node:assert`
  met JSDoc voor typering.
- Meer dan 15 bestanden of 5.000 regels in één keer (CLAUDE.md-autonomiegrens); splits
  zo nodig in meerdere commits (bijv. reducer + tests apart).

### Opleveren

Kort verslag: welke bestanden, hoeveel fixture-rijen, en of alle rijen uit de
overgangstabel en alle elf testpunten hierboven daadwerkelijk gedekt zijn. Geen
aanpassing aan `docs/architecture-plan/README.md` nodig tenzij de fasering zelf
wijzigt.
