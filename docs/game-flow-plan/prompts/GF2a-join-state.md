# Prompt — GF2a: Join-state

Onderdeel van [`../README.md`](../README.md), fase GF2 (join-state helft). Vereist dat
GF1 (route-resolver) klaar is. Doel: een pure statemachine voor de join-flow (QR/link
primair, code als fallback), die alleen state en te versturen verzoeken produceert —
geen fetch, geen sockets, geen DOM.

## Brondocument

[`GAME-FLOW.md`](../../multiplayer/GAME-FLOW.md) §Joinflow en §Naamgedrag.
[`PROTOCOL.md`](../../multiplayer/PROTOCOL.md) `POST /api/v1/games/join` voor de
exacte request-/responsevorm ("precies één locator": `inviteId` óf `gameCode`).

## Open spec-vraag — niet door mij op te lossen

`GAME-FLOW.md` beschrijft de volgorde als: *scan QR → inviteId wordt gevalideerd →
naamveld met reeds voorgestelde willekeurige naam → [Meedoen] → sessie aangemaakt*.
Dat impliceert een validatie- én naamsuggestiestap vóórdat de speler op "Meedoen"
drukt. `PROTOCOL.md` documenteert echter geen los validatie-/previewendpoint — alleen
`POST /api/v1/games/join`, dat in één stap valideert én de sessie aanmaakt.

Twee mogelijke lezingen, geen van beide door mij te kiezen — dit raakt `public_api`
en is ADR-plichtig bij de `PROTOCOL.md`-eigenaar:

1. Er komt nog een licht `GET`-previewendpoint bij `PROTOCOL.md`.
2. De voorgestelde naam wordt puur lokaal gegenereerd (zonder servercall) en pas bij
   `POST /api/v1/games/join` definitief gemaakt, met risico op een naam die na join
   alsnog wijzigt (bijvoorbeeld bij een botsing).

Deze module ontwerp ik daarom **onafhankelijk van de bron van de suggestie**: een
`LOCATOR_READY`-event draagt een optionele `suggestedName` mee, ongeacht waar die
vandaan komt. Zodra de PROTOCOL-eigenaar dit oplost, verandert alleen de aanroeper,
niet deze reducer.

## Te bouwen module

Bestand: `client/flow/join-state.mjs` (locatie/extensie per GF0).

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
export function initialJoinState() {}

/** @param {JoinState} state @param {object} event @returns {JoinState} */
export function transition(state, event) {}

/**
 * Wat er nu naar de server moet, of null als er niets te versturen valt.
 * @param {JoinState} state
 * @returns {{ inviteId?: string, gameCode?: string, displayName: string | null, joinSource: string } | null}
 */
export function joinRequestFor(state) {}
```

Events: `LOCATOR_READY` (locator + optionele `suggestedName`), `NAME_CHANGED`
(ruwe input), `SUBMIT`, `JOIN_SUCCEEDED` (sessiedata), `JOIN_FAILED` (foutcode),
`RETRY`.

## Naamvalidatie (client-side UX, niet autoritatief)

- Limiet: **20 zichtbare tekens** (`GAME-FLOW.md` §Naamgedrag). Tel met
  grafeem-clusters (`Intl.Segmenter` met `granularity: 'grapheme'`), niet
  `string.length` of `Array.from(str).length` — die tellen een vlag- of
  familie-emoji (meerdere codepoints, één zichtbaar teken) fout.
- Lege of overgeslagen invoer stuurt `displayName: null` mee; de server genereert dan
  de naam (`DATA-MODEL.md` §Naamverwerking) — deze module verzint zelf geen naam.
- Uniek maken bij botsing (`Sanne 2`) is server-side; deze module doet daar niets
  mee buiten het tonen van het uiteindelijke `effectiveName` na `JOIN_SUCCEEDED`.
- **Nooit loggen.** Een zelfgekozen naam kan een echte naam zijn en dus tijdelijk een
  persoonsgegeven (`DATA-MODEL.md` §Privacyduiding). Deze module bewaart of logt
  `displayName` nergens buiten de state zelf.

## Verplichte testgevallen

| # | Scenario | Verwacht |
| --- | --- | --- |
| 1 | `initialJoinState()` | `{ status: 'idle' }` |
| 2 | `LOCATOR_READY` met invite + suggestie | `name-entry` met die `suggestedName` |
| 3 | `LOCATOR_READY` zonder suggestie (`suggestedName: null`) | `name-entry` met `suggestedName: null`, `displayName: null` |
| 4 | `NAME_CHANGED` met tekst ≤ 20 grafeem-clusters | `displayName` bijgewerkt, status blijft `name-entry` |
| 5 | `NAME_CHANGED` met 21 gewone tekens | kies één gedrag (afkappen tot 20, of markeren als ongeldig) en test exact dát — geen "of/of" |
| 6 | `NAME_CHANGED` met een 4-codepoint familie-emoji + 19 andere tekens | telt als 20 grafeem-clusters, niet als 23+ codepoints |
| 7 | `SUBMIT` vanuit `name-entry` | `submitting`; `joinRequestFor` levert de juiste locator-vorm (`inviteId` óf `gameCode`, nooit beide) |
| 8 | `JOIN_SUCCEEDED` vanuit `submitting` | `joined` met de sessiedata |
| 9 | `JOIN_FAILED` vanuit `submitting` | `error` met foutcode, locator bewaard voor `RETRY` |
| 10 | `RETRY` vanuit `error` | terug naar `name-entry` met dezelfde locator, `suggestedName`/`displayName` gereset naar `null` |
| 11 | `SUBMIT` vanuit `idle` of `joined` | genegeerd: state ongewijzigd, geen throw |
| 12 | `joinRequestFor` buiten `submitting` | `null` |

## Niet in scope voor GF2a

- Het pre-join validatie-/suggestievraagstuk hierboven — bij de PROTOCOL-eigenaar.
- Hoe `joinSource` (`qr` vs `shared_link`) technisch onderscheiden wordt — beide
  routes zijn identiek (`/j/{inviteId}`); een webclient kan dit alleen scheiden via
  een onderscheidend queryparameter in de gegenereerde QR- vs kopieer-link-URL. Dat
  is een voorstel voor `share-actions` (GF6), niet iets wat deze reducer bepaalt; hij
  accepteert `joinSource` als gegeven input.
- Naam wijzigen ná het joinen, in de lobby (`player:rename`, "maximaal eenmaal") —
  dat hoort bij een lobby-/matchfase-module, niet bij join-state.
- De daadwerkelijke `fetch`/socket-aanroep — alleen `joinRequestFor` levert de vorm.

## Definition of done

- Alle testgevallen slagen, met `node --test client/flow/join-state.test.mjs`.
- Geen enkele transitie of helper gooit een exception.
- Geen `console.log`/opslag van `displayName` binnen deze module.
