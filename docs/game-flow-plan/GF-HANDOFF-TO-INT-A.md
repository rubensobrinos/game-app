# Handoff naar INT-A — GAME-FLOW.md client-side modules

Voor stap 2 (UI-aansluiting). Dit document is de overdracht, geen nieuwe spec — voor
de volledige rationale per module zie [`README.md`](README.md) en
[`GF-PROGRESS.md`](GF-PROGRESS.md); voor de bindende productbesluiten
[`docs/multiplayer/DECISIONS.md`](../multiplayer/DECISIONS.md).

## Status

**231/231 tests groen**, tien modules onder `client/flow/`, elk pure functies (geen
`fetch`, geen `Socket.IO`, geen DOM). Alle modules zijn bijgewerkt tegen
`DECISIONS.md`; er zijn geen bekende blockers binnen dit plan. Run
`node --test client/flow/*.test.mjs` om zelf te verifiëren.

`prompts/INT1-walking-skeleton.md` noemt `client/flow/` al als bekende input ("10
pure flow-reducers incl. session-store") — dit document is dus geen introductie,
maar een gerichte "wat is er vandaag veranderd"-notitie, vooral relevant als er al
tegen een eerdere versie is gewired. Gecontroleerd: er bestaat nergens in
`docs/integration-plan/` of `server/` al code die de oude `join-state`-vorm
(`LOCATOR_READY`, geen previewstap) aanneemt — de herziening hieronder is dus geen
breaking change voor bestaand werk, alleen voor nieuw te schrijven wiring-code.

## De tien modules, met wat INT-A moet weten om te wiren

| Module | Kernfuncties | Waar op letten bij wiring |
| --- | --- | --- |
| `route-resolver.mjs` | `resolveRoute(pathname, search)` | `search` wordt genegeerd voor het routetype; lees 'm apart voor `share-actions`'s `joinSourceFor`. |
| `join-state.mjs` | `initialJoinState`, `transition`, `previewRequestFor`, `joinRequestFor` | **Twee netwerkaanroepen, niet één**: eerst het (nog te bouwen) previewendpoint via `previewRequestFor` tijdens `status: 'previewing'`, dán pas `POST /api/v1/games/join` via `joinRequestFor` tijdens `status: 'submitting'`. Zie DECISIONS.md #7. |
| `host-setup-state.mjs` | `initialHostSetupState`, `transition`, `createRequestFor` | Default is nu enkelvoudig `flags_mc` (niet Groepsbattle). `preset: 'default'` is een **placeholder-waarde** — nog te bevestigen met wie het wire-formaat vaststelt. |
| `match-phase-state.mjs` | `initialMatchPhaseState`, `applyServerEvent` | Bewaart alleen fase + `matchId` + `pausedState` — geen rondedata, scoreboard of spelerscount. Andere modules/UI-state moeten dat apart bijhouden. |
| `reconnect-state.mjs` | `initialReconnectState`, `transition`, `backoffDelayMs`, `nextActionFor` | `nextActionFor` levert `{type:'schedule-reconnect', delayMs}` of `{type:'request-snapshot'}` — de daadwerkelijke timer/fetch moet de wiring-laag doen. |
| `edge-case-messaging.mjs` | `messageForErrorCode`, `messageForPauseReason`, `messageForConnectionStatus`, `messageForSessionTermination` | Retourneert sleutels, geen vertaalde tekst — koppel aan de bestaande NL/EN/ES-laag. |
| `share-actions.mjs` | `shareUrlsFor`, `joinSourceFor`, `shareActionsFor`, `canNewJoinerUse`, `shareOpenedMethodFor` | `shareOpenedMethodFor` is nieuw (DECISIONS.md #18) — gebruik die output rechtstreeks als `share:opened.method`. |
| `session-store.mjs` | `storageKeyFor`, `saveSession`, `loadSession`, `clearSession` | Storage wordt **geïnjecteerd** (`{getItem,setItem,removeItem}`) — geef gewoon het echte `localStorage`-object door, geen adapter nodig. `loadSession` gooit nooit; `saveSession`/`clearSession` laten een echte storage-fout wél doorgaan. |
| `host-controls-state.mjs` | `availableHostActions`, `hostActionRequest` | `'next'` is nu uitsluitend beschikbaar vanuit `SCOREBOARD` (DECISIONS.md #1, één hostactie per ronde) — niet meer vanuit `ROUND_RESULT`. |
| `leave-state.mjs` | `initialLeaveState`, `transition`, `leaveRequestFor` | Bevestigingsstap is verplicht in de statemachine (`confirming` vóór `leaving`) — bouw de UI-confirm niet los daarvan, anders raken UI en state uit sync. |

## Wat hier expliciet niet bij zit

- **Teams en spectators** — `DECISIONS.md` #8/#9/#33 schrapt beide voor deze MVP. Er
  is geen `team-selection-state.mjs` en geen spectator-specifieke code. Het
  geschrapte ontwerp staat in `prompts/GF7-teams-and-spectator.md`, puur ter
  historie.
- **Hostbediening-UI, spelscherm-UI, spectatorscherm** — visuele vormgeving is
  bewust buiten dit plan gehouden; de modules leveren alleen state/intenties.
- **De daadwerkelijke transportlaag** (fetch, Socket.IO-client, timers) — elke
  `*RequestFor`/`nextActionFor`-functie levert alleen de vorm van wat verstuurd moet
  worden, nooit de aanroep zelf.

## Twee losse eindjes voor iemand anders, niet voor dit plan

1. `shared/product/quick-start-preset.mjs` (`GROUP_BATTLE_DEFAULT_GAME_TYPES`, vier
   spelvormen) is **stale** volgens `DECISIONS.md` #31 — `host-setup-state.mjs`
   importeert het bewust niet meer, maar het bestand zelf is niet aangepast
   (eigendom van product-plan, buiten dit plan). Kan verwarring geven als een andere
   module het nog wél importeert.
2. `preset: 'default'` (zie tabel hierboven) is een gok, geen bevestigd
   contractveld.

## Contract-conventie tussen de modules

Elke module die iets naar de server moet sturen, volgt hetzelfde patroon: een
`*RequestFor(state)`-functie levert de payload alleen tijdens de bijbehorende
in-flight-status (`previewing`/`submitting`/`creating`/`leaving`), anders `null`.
Dispatch eerst de transitie-event, vraag daarna pas het verzoek op — nooit
andersom. Dit werd pas expliciet gemaakt nadat twee modules elkaar tegenspraken
(zie `README.md`'s "Conventies"), dus wijk er niet per ongeluk vanaf bij nieuwe
wiring-code.
