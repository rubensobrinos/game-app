# Prompt — GF11: Leave-state

Onderdeel van [`../README.md`](../README.md), fase GF11 (nieuw — gevonden gat,
Randgeval 11 had geen module, zie `GF-PROGRESS.md`). Doel: de bevestiging-vóór-verlaten
en de `player:leave`-aanroep als pure statemachine.

## Brondocument

`GAME-FLOW.md` Randgeval 11 — Speler verlaat vrijwillig:

```text
- bevestiging vóór verlaten;
- speler telt niet meer mee voor antwoordvoortgang;
- bestaande score kan in de eindstand als 'verlaten' blijven staan;
- sessie kan binnen de room-TTL opnieuw worden geactiveerd zolang niet gekickt.
```

`PROTOCOL.md`: `player:leave` — vereiste rol `player`, payload `{}`, validatie
"actieve sessie".

De laatste drie bullets (niet meetellen, score-status, heractivering) zijn
server-/boekhoudgedrag, geen clientstate — die horen niet in deze module thuis. Wat
overblijft is precies de bevestigingsstap vóór het versturen.

## Te bouwen module

Bestand: `client/flow/leave-state.mjs`.

```js
/**
 * @typedef {
 *   | { status: 'idle' }
 *   | { status: 'confirming' }
 *   | { status: 'leaving' }
 *   | { status: 'left' }
 * } LeaveState
 */

/** @returns {LeaveState} */
export function initialLeaveState() {}

/** @param {LeaveState} state @param {{ type: string }} event @returns {LeaveState} */
export function transition(state, event) {}

/**
 * Wat er nu naar de server moet, of null. Non-null alleen tijdens 'leaving' —
 * zelfde conventie als `joinRequestFor`/`createRequestFor`.
 * @param {LeaveState} state
 * @returns {{} | null}
 */
export function leaveRequestFor(state) {}
```

Events: `REQUEST_LEAVE`, `CANCEL`, `CONFIRM`, `LEFT`.

## Regels

- `REQUEST_LEAVE` werkt alleen vanuit `idle` → `confirming`. Geen shortcut die de
  bevestigingsstap overslaat.
- `CONFIRM` werkt alleen vanuit `confirming` → `leaving`. Vanuit elke andere status
  genegeerd — er is geen route die rechtstreeks naar `leaving` gaat zonder eerst
  `confirming` te zijn geweest.
- `CANCEL` werkt alleen vanuit `confirming` → `idle`.
- `LEFT` werkt alleen vanuit `leaving` → `left`.
- `leaveRequestFor` levert `{}` (het exacte, lege `PROTOCOL.md`-payload) alleen
  tijdens `leaving`, anders `null`.

## Verplichte testgevallen

| # | Scenario | Verwacht |
| --- | --- | --- |
| 1 | `initialLeaveState()` | `{ status: 'idle' }` |
| 2 | `REQUEST_LEAVE` vanuit `idle` | `confirming` |
| 3 | `CANCEL` vanuit `confirming` | `idle` |
| 4 | `CONFIRM` vanuit `confirming` | `leaving`; `leaveRequestFor` → `{}` |
| 5 | `LEFT` vanuit `leaving` | `left` |
| 6 | `leaveRequestFor` buiten `leaving` (`idle`, `confirming`, `left`) | `null` in alle drie de gevallen |
| 7 | `CONFIRM` vanuit `idle` (bevestiging overslaan) | genegeerd, state ongewijzigd |
| 8 | `REQUEST_LEAVE` vanuit `leaving` of `left` | genegeerd, state ongewijzigd |
| 9 | `CANCEL` vanuit `idle`, `leaving` of `left` | genegeerd, state ongewijzigd |
| 10 | `transition` met `null`/`undefined` state, of `undefined` event, of een onbekend eventtype | geen throw, state (indien geldig) ongewijzigd |

## Niet in scope voor GF11

- Het daadwerkelijke bevestigingsdialoogvenster (UI) — buiten dit plan.
- Niet meetellen in antwoordvoortgang, score-status "verlaten", heractivering binnen
  de room-TTL — server-/boekhoudgedrag, niet deze module.
- De daadwerkelijke `fetch`/socket-aanroep — alleen `leaveRequestFor` levert de vorm.

## Definition of done

- Alle testgevallen slagen, met `node --test client/flow/leave-state.test.mjs`.
- Geen enkele functie gooit een exception.
- Geen enkele transitie bereikt `leaving` zonder via `confirming` te zijn gegaan.
