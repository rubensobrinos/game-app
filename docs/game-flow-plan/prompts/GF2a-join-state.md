# Prompt — GF2a: Join-state

**✅ Herzien na `docs/multiplayer/DECISIONS.md` #7** (2 aug 2026, regie-sessie,
bindend): "Er komt een licht pre-join-previewendpoint dat de invite valideert en een
servergegenereerde naamsuggestie levert vóór `POST /games/join`." Dat beantwoordt de
oorspronkelijke open spec-vraag van dit bestand (zie onderaan, ter historie) en is
al doorgevoerd in `client/flow/join-state.mjs` — dit document is bijgewerkt om
daarmee in de pas te lopen, geen nieuw werk.

**Tweede correctie, na het uitgeschreven `PROTOCOL.md`-contract:** `GET
/api/v1/games/preview` is **uitsluitend `inviteId`** — geen `gameCode`-variant
(`docs/protocol-plan/prompts/PR10-preview-endpoint.md`). Mijn eerste
implementatie nam symmetrische preview-ondersteuning voor beide locatortypes
aan, geschreven vóórdat die sectie van `PROTOCOL.md` bestond. Gecorrigeerd: een
`code`-locator slaat `previewing` nu over en gaat direct van `idle` naar
`name-entry` met `suggestedName: null`.

Onderdeel van [`../README.md`](../README.md), fase GF2 (join-state helft). Vereist dat
GF1 (route-resolver) klaar is. Doel: een pure statemachine voor de join-flow (QR/link
primair, code als fallback) mét een echte preview-stap, die alleen state en te
versturen verzoeken produceert — geen fetch, geen sockets, geen DOM.

## Brondocument

[`GAME-FLOW.md`](../../multiplayer/GAME-FLOW.md) §Joinflow en §Naamgedrag.
[`PROTOCOL.md`](../../multiplayer/PROTOCOL.md) `POST /api/v1/games/join` voor de
join-request-/responsevorm ("precies één locator": `inviteId` óf `gameCode`).
`DECISIONS.md` #7 voor het (nog niet in `PROTOCOL.md` uitgeschreven) previewendpoint.

## Te bouwen module

Bestand: `client/flow/join-state.mjs`.

```js
/**
 * @typedef {
 *   | { type: 'invite', inviteId: string, joinSource: 'qr' | 'shared_link' | 'unknown' }
 *   | { type: 'code', code: string }
 * } Locator
 *
 * @typedef {
 *   | { status: 'idle' }
 *   | { status: 'previewing', locator: Locator }
 *   | { status: 'name-entry', locator: Locator, suggestedName: string | null, displayName: string | null }
 *   | { status: 'submitting', locator: Locator, suggestedName: string | null, displayName: string | null }
 *   | { status: 'joined', session: object }
 *   | { status: 'error', stage: 'preview' | 'submit', code: string, locator: Locator, suggestedName: string | null }
 * } JoinState
 */

export function initialJoinState() {}
export function transition(state, event) {}

/** Non-null alleen tijdens 'previewing'. @returns {{ inviteId?: string, gameCode?: string } | null} */
export function previewRequestFor(state) {}

/** Non-null alleen tijdens 'submitting'. @returns {{ inviteId?: string, gameCode?: string, displayName: string | null, joinSource: string } | null} */
export function joinRequestFor(state) {}
```

Events: `LOCATOR_OBTAINED` (locator, alleen vanuit `idle`), `PREVIEW_SUCCEEDED`
(`suggestedName`), `PREVIEW_FAILED` (`code`), `NAME_CHANGED`, `SUBMIT`,
`JOIN_SUCCEEDED` (`session`), `JOIN_FAILED` (`code`), `RETRY`.

## Ontwerp: waarom `suggestedName` ook door `submitting`/`error` reist

De preview levert de naamsuggestie vóórdat de speler iets typt. Als een latere
`JOIN_FAILED` (bijvoorbeeld `NAME_TOO_LONG`) de speler terug naar `name-entry` stuurt,
zou een botte reset de al-opgehaalde suggestie weggooien — een onnodige extra
netwerkaanvraag en een slechtere UX voor een fout die niets met de suggestie te maken
heeft. Vandaar: `suggestedName` blijft meereizen tot `RETRY` het weer nodig heeft.

`RETRY` gedraagt zich daarom per foutstadium anders:

- `stage: 'preview'` → terug naar `previewing` (opnieuw de invite/code proberen).
- `stage: 'submit'` → terug naar `name-entry`, met de **bestaande** `suggestedName`,
  alleen `displayName` wordt leeg zodat de speler opnieuw kan typen.

## Naamvalidatie (client-side UX, niet autoritatief)

- Limiet: **20 zichtbare tekens** (`GAME-FLOW.md` §Naamgedrag), geteld met
  grafeem-clusters (`Intl.Segmenter`), niet `string.length`.
- Lege/overgeslagen invoer stuurt `displayName: null`; de server genereert dan de
  naam. Uniek maken bij botsing is server-side.
- **Nooit loggen** — een zelfgekozen naam kan tijdelijk een persoonsgegeven zijn
  (`DATA-MODEL.md` §Privacyduiding).

## Verplichte testgevallen

| # | Scenario | Verwacht |
| --- | --- | --- |
| 1 | `LOCATOR_OBTAINED` vanuit `idle` (invite of code) | `previewing` met die locator |
| 2 | `LOCATOR_OBTAINED` buiten `idle` | genegeerd |
| 3 | `previewRequestFor` tijdens `previewing` | `{inviteId}` óf `{gameCode}`, nooit beide |
| 4 | `previewRequestFor` buiten `previewing` | `null`, voor alle overige statussen |
| 5 | `PREVIEW_SUCCEEDED` met/zonder suggestie | `name-entry` met die `suggestedName` (of `null`), `displayName: null` |
| 6 | `PREVIEW_FAILED` | `error` met `stage: 'preview'`, `suggestedName: null`, locator bewaard |
| 7 | `NAME_CHANGED` ≤ 20 grafeem-clusters | bijgewerkt, blijft `name-entry` |
| 8 | `NAME_CHANGED` met 21 tekens / een familie-emoji | afgekapt tot 20 grafeem-clusters, niet codepoints |
| 9 | `SUBMIT` vanuit `name-entry` | `submitting`, met `suggestedName` én `displayName` bewaard; `joinRequestFor` levert de juiste locator-vorm |
| 10 | `JOIN_SUCCEEDED` vanuit `submitting` | `joined` met sessiedata |
| 11 | `JOIN_FAILED` vanuit `submitting` | `error` met `stage: 'submit'`, `suggestedName` bewaard |
| 12 | `RETRY` vanuit `error(stage: preview)` | `previewing` met dezelfde locator |
| 13 | `RETRY` vanuit `error(stage: submit)` | `name-entry` met dezelfde `suggestedName`, `displayName: null` |
| 14 | `joinRequestFor`/`previewRequestFor` buiten hun eigen in-flight-status | `null` in alle andere gevallen |

## Niet in scope voor GF2a

- Hoe `joinSource` technisch wordt onderscheiden — dat lost `share-actions` (GF6) op.
- Naam wijzigen ná het joinen (`player:rename`) — een lobby-/matchfase-module.
- De daadwerkelijke `fetch`-aanroep — alleen `previewRequestFor`/`joinRequestFor`
  leveren de vorm.

## Definition of done

- Alle testgevallen slagen, met `node --test client/flow/join-state.test.mjs`.
- Geen enkele transitie of helper gooit een exception.
- Geen `console.log`/opslag van `displayName` of `suggestedName`.

---

## Ter historie: de oorspronkelijke open spec-vraag (nu beantwoord)

`GAME-FLOW.md` beschrijft de volgorde als: *scan QR → inviteId wordt gevalideerd →
naamveld met reeds voorgestelde willekeurige naam → [Meedoen] → sessie aangemaakt*,
wat een validatie-/naamsuggestiestap vóór "Meedoen" impliceerde. `PROTOCOL.md`
documenteerde geen los previewendpoint — dat leek dus twee mogelijke lezingen toe te
staan (een echt previewendpoint, of een lokaal geraden naam). `DECISIONS.md` #7 kiest
expliciet voor de eerste lezing.
