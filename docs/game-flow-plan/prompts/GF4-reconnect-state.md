# Prompt — GF4: Reconnect-state

Onderdeel van [`../README.md`](../README.md), fase GF4. Doel: de backoff en
snapshot-aanvraag rond déze clients eigen socketverbinding — geen echte timers, geen
echte socket, alleen state + wat er nu moet gebeuren.

## Brondocument

`PROTOCOL.md` §Reconnect:

```text
1. Socket valt weg.
2. Client toont niet-blokkerende reconnectstatus.
3. Backoff: 1, 2, 4, 8, 16, maximaal 30 seconden.
4. Socketauth gebruikt dezelfde sessietoken.
5. Na verbinding vraagt client altijd een snapshot.
6. Snapshot vervangt lokale fase, score en antwoordstatus.
7. Een reeds geaccepteerd antwoord wordt niet opnieuw verzonden, behalve als de
   client geen ack heeft en dezelfde actionId kan herhalen.
```

`GAME-FLOW.md` Randgeval 2 (refresh/appwissel): sessietoken lokaal bewaard, client
probeert automatisch te rejoinen, snapshot overschrijft oude lokale state.

## Scopecorrectie

De vorige versie van [`../README.md`](../README.md)'s fasering noemde ook de
60-seconden host-tempo-wachttijd uit Randgeval 1 bij GF4. Dat is fout: die 60 s is een
**servertimer** ("daarna schakelt de server over naar auto-tempo of pauzeert") — niets
wat deze client zelf hoeft te klokken. Deze module gaat uitsluitend over déze clients
eigen socket-reconnect. Het tonen van een status zoals "host is offline" hoort bij
`edge-case-messaging` (GF5), als reactie op wat de server stuurt — niet bij een eigen
timer hier. Zie de bijgewerkte README voor de correctie.

## Te bouwen module

Bestand: `client/flow/reconnect-state.mjs`.

```js
/**
 * @typedef {{
 *   status: 'connected' | 'disconnected' | 'reconnecting',
 *   attempt: number,
 *   pendingSnapshotRequest: boolean,
 * }} ReconnectState
 */

/** @returns {ReconnectState} */
export function initialReconnectState() {}

/** @param {ReconnectState} state @param {{ type: string }} event @returns {ReconnectState} */
export function transition(state, event) {}

/**
 * Zuivere backoff-formule, geen timer. `attempt` is 1-based (de eerstvolgende poging).
 * @param {number} attempt
 * @returns {number} vertraging in milliseconden
 */
export function backoffDelayMs(attempt) {}

/**
 * Wat er nu moet gebeuren, of null.
 * @param {ReconnectState} state
 * @returns
 *   | { type: 'schedule-reconnect', delayMs: number }
 *   | { type: 'request-snapshot' }
 *   | null
 */
export function nextActionFor(state) {}
```

Events: `DISCONNECTED`, `RECONNECT_ATTEMPT_STARTED`, `RECONNECT_SUCCEEDED`,
`RECONNECT_FAILED`, `SNAPSHOT_REQUEST_SENT`.

## Regels

- `backoffDelayMs(attempt)` = `min(1000 × 2^(attempt-1), 30000)`. Dat geeft exact
  1000, 2000, 4000, 8000, 16000 voor pogingen 1–5, en 30000 vanaf poging 6 —
  overeenkomstig "1, 2, 4, 8, 16, maximaal 30 seconden".
- `DISCONNECTED` reset altijd naar `attempt: 0`, ongeacht de vorige status — een
  verse disconnect (ook middenin een lopende poging) telt niet compound op met
  eerdere pogingen. Dit staat niet letterlijk zo in `PROTOCOL.md`; expliciet gekozen
  om te voorkomen dat een flakkerende verbinding onbegrensd blijft oplopen.
- `RECONNECT_SUCCEEDED` zet `pendingSnapshotRequest: true` — punt 5 uit
  `PROTOCOL.md` is onvoorwaardelijk ("altijd een snapshot"), geen uitzondering voor
  een korte disconnect.
- `RECONNECT_ATTEMPT_STARTED`/`RECONNECT_FAILED` terwijl `status === 'connected'` is
  een verlate/ingehaalde gebeurtenis (een trage callback voor een poging die al is
  ingehaald door een geslaagde reconnect) — genegeerd, state ongewijzigd. Nooit een
  goede verbinding laten verstoren door een laat binnenkomend faalsignaal.
- `nextActionFor` geeft nooit meer dan één actie tegelijk: eerst reconnecten, dán pas
  (na `RECONNECT_SUCCEEDED`) de snapshotaanvraag.

## Verplichte testgevallen

| # | Scenario | Verwacht |
| --- | --- | --- |
| 1 | `initialReconnectState()` | `{ status: 'connected', attempt: 0, pendingSnapshotRequest: false }` |
| 2 | `nextActionFor` op de initiële state | `null` |
| 3 | `backoffDelayMs(1..5)` | `1000, 2000, 4000, 8000, 16000` |
| 4 | `backoffDelayMs(6)` en `backoffDelayMs(7)` | beide `30000` |
| 5 | `DISCONNECTED` vanuit `connected` | `{ status: 'disconnected', attempt: 0, ... }` |
| 6 | `nextActionFor` bij `disconnected`, `attempt: 0` | `{ type: 'schedule-reconnect', delayMs: 1000 }` |
| 7 | `RECONNECT_ATTEMPT_STARTED` | `status: 'reconnecting'`, `attempt: 1` |
| 8 | `RECONNECT_FAILED` na test 7 | `status: 'disconnected'`, `attempt` blijft `1`; `nextActionFor` → `delayMs: 2000` |
| 9 | Vijf opeenvolgende `RECONNECT_ATTEMPT_STARTED`/`RECONNECT_FAILED`-paren | zesde `nextActionFor` → `delayMs: 30000` |
| 10 | `RECONNECT_SUCCEEDED` vanuit `reconnecting` | `status: 'connected'`, `attempt: 0`, `pendingSnapshotRequest: true` |
| 11 | `nextActionFor` na test 10 | `{ type: 'request-snapshot' }` |
| 12 | `SNAPSHOT_REQUEST_SENT` na test 10 | `pendingSnapshotRequest: false`; `nextActionFor` → `null` |
| 13 | `DISCONNECTED` terwijl `status === 'reconnecting'` met `attempt: 3` | reset naar `attempt: 0`, niet `3` |
| 14 | `RECONNECT_FAILED` terwijl `status === 'connected'` (verlaat signaal) | state exact ongewijzigd |
| 15 | `RECONNECT_ATTEMPT_STARTED` terwijl `status === 'connected'` | state exact ongewijzigd |

## Niet in scope voor GF4

- De host-tempo-60s-wachttijd (zie scopecorrectie) — servertimer, geen clientlogica.
- Statusteksten/vertaling ("niet-blokkerende reconnectstatus") — `edge-case-messaging`
  (GF5) consumeert `state.status`, deze module levert geen tekst.
- `actionId`-gebaseerde antwoord-idempotentie (`PROTOCOL.md` punt 7) — dat hoort bij
  de nog niet gemodulariseerde antwoord-inzendlogica, niet bij de
  connectiestatus zelf.
- De daadwerkelijke socket, timers en `fetch` voor de snapshotaanvraag — alleen
  `nextActionFor` beschrijft wat er moet gebeuren.
- Wat er met de snapshot gebeurt zodra hij binnenkomt — dat is `match-phase-state`
  (`room:state`-event), niet deze module.

## Definition of done

- Alle testgevallen slagen, met `node --test client/flow/reconnect-state.test.mjs`.
- Geen enkele functie gooit een exception.
- `backoffDelayMs` is een zuivere functie zonder `Date.now()`/`setTimeout`.
