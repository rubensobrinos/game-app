# Prompt — GF10: Host-controls-state

**Bijgesteld na `docs/multiplayer/DECISIONS.md` #1** (2 aug 2026, regie-sessie,
bindend): "Host-tempo gebruikt één hostactie per ronde. `ROUND_RESULT` loopt op timer
door naar `SCOREBOARD`; de host kiest daarna 'Volgende'." De oorspronkelijke versie
liet `'next'` beschikbaar zijn bij zowel `ROUND_RESULT` als `SCOREBOARD` onder
host-tempo (twee mogelijke hostmomenten per ronde) — dat is nu teruggebracht tot
uitsluitend `SCOREBOARD`. `ROUND_RESULT → SCOREBOARD` is altijd timer-gedreven, ook
onder host-tempo.

Onderdeel van [`../README.md`](../README.md), fase GF10 (nieuw — gevonden gat, stond
niet eens in de oorspronkelijke moduletabel, zie `GF-PROGRESS.md`). Doel: welke
hostknop nu zinvol te tonen is, en de bijbehorende event-payload — geen fetch, geen
DOM, geen eigen legaliteitsoordeel voorbij wat `PROTOCOL.md` al vastlegt.

## Brondocument

`GAME-FLOW.md` §Hostbediening: start, pauzeer/hervat, volgende (bij host-tempo),
room vergrendelen/ontgrendelen, speler verwijderen, game beëindigen, rematch.

`PROTOCOL.md` client→server events (exacte validatie hieronder overgenomen, niet
verzonnen):

| Event | Validatie |
| --- | --- |
| `game:start` | fase `LOBBY`, minimaal één speler |
| `game:pause` | actieve game |
| `game:resume` | fase `PAUSED` |
| `game:next` | host-tempo én wachtfase |
| `game:lock` | room bestaat |
| `game:kick` | speler bestaat, niet zichzelf als enige host |
| `game:finish` | niet reeds `FINISHED` |
| `game:rematch` | fase `FINISHED` |

`GAME-RULES.md`: bij host-tempo wacht de game op `Volgende`. **Bijgesteld
(DECISIONS.md #1): "wachtfase" is uitsluitend `SCOREBOARD`** — `ROUND_RESULT →
SCOREBOARD` verloopt altijd via timer, één hostactie per ronde.

## Ontwerpkeuze: geen strenger dan het wire-contract

Net als `match-phase-state` (GF3) mag deze module geen eigen, strengere regels
verzinnen dan wat hierboven staat. Concreet voorbeeld waarom dat ertoe doet:
`game:finish`'s enige validatie is "niet reeds FINISHED" — er staat nergens dat de
game al gestart moet zijn. `beëindigen` moet dus ook vanuit `LOBBY` beschikbaar zijn,
ook al voelt dat ongebruikelijk. Verzin geen extra restrictie die er niet staat.

## Anders dan `join-state`/`host-setup-state`

Die twee modelleren een *submission-lifecycle* (`editing → submitting → …`) met een
`*RequestFor` die alleen tijdens de in-flight-status iets teruggeeft. Hostbediening
heeft geen zo'n lifecycle per actie — elke actie is een direct, op zichzelf staand
commando gebaseerd op de huidige context, geen meerstaps-formulier. Vandaar een
andere vorm hieronder (`availableHostActions` + `hostActionRequest`), bewust niet
hetzelfde patroon geforceerd.

## Te bouwen module

Bestand: `client/flow/host-controls-state.mjs`.

```js
/**
 * @typedef {import('./match-phase-state.mjs').Phase} Phase
 *
 * @typedef {{
 *   phase: Phase,
 *   pacing: 'auto' | 'host',
 *   playerCount: number,
 *   locked: boolean,
 * }} HostControlContext
 *
 * @typedef {'start'|'pause'|'resume'|'next'|'lock'|'unlock'|'kick'|'finish'|'rematch'} HostAction
 */

/** @param {HostControlContext} context @returns {HostAction[]} */
export function availableHostActions(context) {}

/**
 * Bouwt de eventpayload voor een actie. Controleert zelf opnieuw of de actie nog
 * beschikbaar is volgens `context` (geen vertrouwen op een verouderde UI-lijst).
 * @param {HostAction} action
 * @param {HostControlContext} context
 * @param {{ playerId?: string, reason?: string }} [params]
 * @returns {{ event: string, payload: object } | null}
 */
export function hostActionRequest(action, context, params) {}
```

`Phase` hergebruikt de enum uit `match-phase-state.mjs` (`UNINITIALIZED`, `LOBBY`,
`COUNTDOWN`, `ROUND_ACTIVE`, `ROUND_RESULT`, `SCOREBOARD`, `FINISHED`, `PAUSED`) —
geen tweede definitie ervan.

## Regels

- `UNINITIALIZED`: geen enkele actie beschikbaar (nog niets bekend over de room).
- `'start'`: alleen bij `phase === 'LOBBY'` én `playerCount >= 1`.
- `'pause'`: alleen bij een actieve fase — `COUNTDOWN`, `ROUND_ACTIVE`,
  `ROUND_RESULT`, `SCOREBOARD`.
- `'resume'`: alleen bij `phase === 'PAUSED'`.
- `'next'`: alleen bij `pacing === 'host'` én `phase === 'SCOREBOARD'` (niet
  `ROUND_RESULT` — DECISIONS.md #1, één hostactie per ronde).
- `'lock'` / `'unlock'`: wederzijds exclusief, gebaseerd op `context.locked` — nooit
  allebei tegelijk in de lijst.
- `'kick'`: beschikbaar zodra `playerCount >= 1`, ongeacht fase. Welke specifieke
  speler wel/niet gekickt mag worden (bijv. niet jezelf als enige host) is een
  per-speler renderbeslissing voor de aanroeper, niet iets wat deze aggregaat-context
  kan bepalen.
- `'finish'`: beschikbaar bij elke fase behalve `FINISHED` (zie Ontwerpkeuze
  hierboven — ook vanuit `LOBBY`).
- `'rematch'`: alleen bij `phase === 'FINISHED'`.
- `hostActionRequest` retourneert `null` als `action` niet voorkomt in
  `availableHostActions(context)` op het moment van aanroepen.

## Verplichte testgevallen

| # | Scenario | Verwacht |
| --- | --- | --- |
| 1 | `phase: 'LOBBY'`, `playerCount: 1` | bevat `'start'` en `'finish'`, niet `'pause'`/`'resume'`/`'next'`/`'rematch'` |
| 2 | `phase: 'LOBBY'`, `playerCount: 0` | bevat geen `'start'` |
| 3 | Elk van `COUNTDOWN`/`ROUND_ACTIVE`/`ROUND_RESULT`/`SCOREBOARD` | bevat `'pause'`, niet `'resume'` |
| 4 | `phase: 'PAUSED'` | bevat `'resume'`, niet `'pause'` |
| 5 | `pacing: 'host'`, `phase: 'SCOREBOARD'` | bevat `'next'`; `phase: 'ROUND_RESULT'` bevat het niet (DECISIONS.md #1) |
| 6 | `pacing: 'auto'`, `phase: 'ROUND_RESULT'` | bevat geen `'next'` |
| 7 | `pacing: 'host'`, `phase: 'ROUND_ACTIVE'` (geen wachtfase) | bevat geen `'next'` |
| 8 | `locked: true` vs. `locked: false` | respectievelijk `'unlock'` en `'lock'`, nooit beide tegelijk |
| 9 | `phase: 'FINISHED'` | bevat `'rematch'`, niet `'finish'` |
| 10 | `phase: 'LOBBY'` | bevat wél `'finish'` — expliciete regressietest voor de Ontwerpkeuze hierboven |
| 11 | `phase: 'UNINITIALIZED'` | lege array, ongeacht overige velden |
| 12 | `hostActionRequest('start', ctx-met-start-beschikbaar)` | `{ event: 'game:start', payload: {} }` |
| 13 | `hostActionRequest('lock', ctx met locked:false)` en `('unlock', ctx met locked:true)` | `{ event: 'game:lock', payload: { locked: true } }` resp. `{ locked: false }` |
| 14 | `hostActionRequest('kick', ctx, { playerId: 'p_1' })` | `{ event: 'game:kick', payload: { playerId: 'p_1' } }` |
| 15 | `hostActionRequest('kick', ctx, {})` (geen `playerId`) | `null` |
| 16 | `hostActionRequest('resume', ctx met phase: 'LOBBY')` | `null` — defensieve herchecking, `'resume'` staat niet in de beschikbare lijst |
| 17 | `hostActionRequest('bogus-action', ctx)` | `null`, geen throw |
| 18 | `availableHostActions`/`hostActionRequest` met `null`/`undefined`/malformed `context` | geen throw; conservatief resultaat (lege lijst resp. `null`) |

## Niet in scope voor GF10

- De inklapbare bedieningsbalk zelf (UI) — visuele vormgeving, buiten dit plan.
- Per-speler kick-restricties (bijv. "niet jezelf als enige host") — renderbeslissing
  van de aanroeper met de volledige spelerslijst, niet deze aggregaat-context.
- `game:pause`'s optionele `reason`-veld verder specificeren dan doorgeven wat is
  meegegeven — geen vaste redenenlijst verzinnen (dat raakt `GF8`'s open vraag 7 over
  de `game:paused`-reden-enum).

## Definition of done

- Alle testgevallen slagen, met `node --test client/flow/host-controls-state.test.mjs`.
- Geen enkele functie gooit een exception.
- Geen enkele regel voegt een restrictie toe die niet letterlijk in de
  brondocumenten-tabel hierboven staat.
