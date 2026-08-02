# shared/product/

Deze map realiseert [`docs/multiplayer/PRODUCT.md`](../../docs/multiplayer/PRODUCT.md)
volgens het uitvoeringsplan in
[`docs/product-plan/README.md`](../../docs/product-plan/README.md) en de voortgang in
[`docs/product-plan/PD-PROGRESS.md`](../../docs/product-plan/PD-PROGRESS.md).

## Locatie: voorlopig

Deze plek staat naast `server/rules/` (game-rules-plan), `server/architecture/`
(architecture-plan), `server/protocol/` (protocol-plan) en `client/flow/`
(game-flow-plan), en is **niet definitief** — net als bij die mappen kan ze
verschuiven zodra architecture-plan een bindende serverskeleton-structuur oplevert.
Locatie en moduleformaat zijn bevestigd via het gesprek met de gebruiker, niet via
een ADR (zie
[`docs/product-plan/prompts/PD0-scope-check.md`](../../docs/product-plan/prompts/PD0-scope-check.md)).

## Moduleformaat

- Platte JavaScript, native ES modules via de `.mjs`-extensie — laadt zonder
  bundler of `package.json`, zowel onder Node als via
  `<script type="module">` in de browser.
- Testrunner: Node's ingebouwde `node --test`, altijd tegen expliciete
  bestandspaden, bijv. `node --test shared/product/hard-rules.test.mjs` — nooit
  tegen een directorypad (faalt met `MODULE_NOT_FOUND`).
- Geen `package.json`, geen enkele nieuwe dependency.

## Modules

| Module | PD-fase | Status | Levert |
| --- | --- | --- | --- |
| `hard-rules.mjs` | PD1 | ✅ | `HARD_RULES` — de 3 harde productregels, elk `{ id, text }` met volledige brontekst |
| `mvp-scope-guard.mjs` | PD1 | ✅ | `EXCLUDED_FROM_MVP` (12 items) + `isExplicitlyExcluded(id)` + `assertNoneExcluded(ids)` |
| `quick-start-preset.mjs` | PD2 | 🟡 versmald | `GROUP_BATTLE_DEFAULT_GAME_TYPES` — alleen de 4 bevestigde default-spelvormen; niet de volledige preset (taal/moeilijkheid/tempo), die rol vervult `client/flow/host-setup-state.mjs` al |
| `later-extensions-registry.mjs` | PD4 | ✅ | `LATER_EXTENSIONS` (8 items) met `qualifies`-links naar `EXCLUDED_FROM_MVP` waar relevant |
| `acceptance-criteria.mjs` | PD5 | ✅ | `ACCEPTANCE_CRITERIA` (9 items) — traceability-snapshot van bestaand bewijs, géén oordeel of een criterium "voldaan" is |

`feature-gate.mjs` (PD3) bestaat nog niet: on hold in afwachting van canonieke
Golf-2-gameType-ID's en `golf2Enabled`-flagsemantiek, cross-agent af te stemmen. Zie
[`docs/product-plan/prompts/PD3-feature-gate.md`](../../docs/product-plan/prompts/PD3-feature-gate.md).

Voor het niet-bindende interfacevoorstel richting `DATA-MODEL.md`/`PROTOCOL.md` op
basis van deze modules, zie
[`docs/product-plan/data-model-and-protocol-interface-proposal.md`](../../docs/product-plan/data-model-and-protocol-interface-proposal.md).

## Draaien

Alle modules samen:

```
node --test shared/product/hard-rules.test.mjs \
  shared/product/mvp-scope-guard.test.mjs \
  shared/product/quick-start-preset.test.mjs \
  shared/product/later-extensions-registry.test.mjs \
  shared/product/acceptance-criteria.test.mjs
```

35/35 tests groen (laatst geverifieerd bij afronding van PD6).
