# Prompt — UI1: Home + Preview/join

Onderdeel van [`../README.md`](../README.md), fase UI1. Vereist UI0 (viewswitcher,
i18n, transport-mock, servertijd-offset). Bouwt schermen 1–2 van UI1a.

## Brondocument

`GAME-FLOW.md` §Hoofdroute, §Hostflow (Snel starten), §Joinflow, §Naamgedrag.
`PRODUCT.md` harde regel 2 (altijd een zichtbare naam, invullen optioneel).
`PROTOCOL.md` `POST /api/v1/games`, `GET /api/v1/games/preview`,
`POST /api/v1/games/join`.

## Scherm 1 — Home

Route `/` (`route-resolver` → `'home'`). Twee ingangen, geen account, geen
verplichte velden:

- **`Snel starten`** — één tik. Wiring: `host-setup-state.initialHostSetupState()`
  (draagt al de `flags_mc`-default) → dispatch `SUBMIT` → `createRequestFor()` →
  `transport.createGame(request)`. Bij succes: `session-store.saveSession()` met
  de teruggekomen `sessionToken`/`roomCode`/`playerId`, dan navigeren naar
  `/host/{code}`.
- **Code-invoer** — een zescijferig veld. Bij versturen: bouw een
  `{ type: 'code', code }`-locator, dispatch `LOCATOR_OBTAINED` op
  `join-state`. Let op: een code-locator slaat preview over en gaat direct naar
  `name-entry` (`PROTOCOL.md`'s previewendpoint is invite-only) — toon dus
  meteen het naamveld van scherm 2, geen aparte tussenstap.

Geavanceerde instellingen ("Game instellen") mogen ingeklapt/verborgen blijven
in UI1a — de default moet zonder ze te openen werken.

## Scherm 2 — Preview + join

Bereikt via `/j/{inviteId}` (`route-resolver` → `{route:'join', inviteId}`) of
via de code-invoer hierboven.

1. Voor een invite: dispatch `LOCATOR_OBTAINED` met
   `{ type: 'invite', inviteId, joinSource }` — bepaal `joinSource` met
   `share-actions.joinSourceFor(location.search)`. Dit zet `join-state` op
   `'previewing'`.
2. `previewRequestFor(state)` → `transport.previewInvite(inviteId)`. Bij succes
   dispatch `PREVIEW_SUCCEEDED` met de `suggestedName` uit de respons — toon
   die **vooringevuld** in het naamveld (niet als placeholder: de speler moet
   'm met één tik kunnen accepteren zonder te typen, harde regel 2). Bij een
   foutcode dispatch `PREVIEW_FAILED`; toon de melding via
   `edge-case-messaging.messageForErrorCode(code)` (nog geen vertaalde tekst
   nodig in UI1a, de sleutel volstaat als tijdelijke tekst).
3. Naamveld: `NAME_CHANGED` bij elke wijziging. **Render de waarde altijd via
   `textContent`/`.value`, nooit via `innerHTML`.** Leeg laten is geldig —
   toon geen validatiefout bij een leeg veld.
4. `[Meedoen]` → dispatch `SUBMIT` → `joinRequestFor(state)` →
   `transport.joinGame(request)`. Bij succes: `session-store.saveSession()`,
   navigeren naar `/game/{code}`. Bij fout: dispatch `JOIN_FAILED`, toon de
   foutmelding, bied een `RETRY`-knop (gedraagt zich per foutstadium anders —
   zie `join-state.mjs`'s `handleRetry`, dat hoef je hier niet te herimplementeren).

## Regels

- Geen enkele DOM-node voor de naam gebruikt `innerHTML` — dit is expliciet
  gebruikersinvoer.
- Geen eigen validatie die verder gaat dan wat `join-state` al doet (20
  grafeem-clusters, stil afgekapt) — geen extra foutmeldingen verzinnen.
- De sessie wordt pas opgeslagen ná een succesvolle create/join, nooit eerder.
- `viewFor()` uit UI0 bepaalt of dit scherm getoond wordt — geen eigen
  routeringslogica in dit bestand.

## Definition of done

- Tegen `transport-mock.mjs` (UI0): Snel starten → lobby-route werkt in één tik.
  Code-invoer → direct naamveld, geen preview-aanroep. Een invite-URL → preview
  → vooringevulde naam → join → game-route.
- Leeg naamveld accepteren werkt voor beide paden.
- Geen consolefouten, geen `innerHTML` op user-inputvelden (grep het bestand
  erop na).
- `UI-PROGRESS.md` bijgewerkt.
