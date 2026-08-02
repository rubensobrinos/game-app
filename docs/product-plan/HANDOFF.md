# HANDOFF — voor andere realisatiesessies

Deze map (`docs/product-plan/`) realiseert
[`docs/multiplayer/PRODUCT.md`](../multiplayer/PRODUCT.md) via
`shared/product/`. Dit bestand meldt wat hier klaarstaat voor andere sessies om
te importeren — er is geen directe verbinding tussen deze sessie en die van
`client/flow/` (game-flow-plan) of `docs/integration-plan/` (INT-A/INT-B), dus
dit is het kanaal: gevonden via `docs/`, of doorgestuurd door een mens.

Statuslegenda: 🔵 open — 🟡 in behandeling — ✅ opgelost — ⏸️ geparkeerd.

---

## 1. Aan `game-flow-plan` (`client/flow/host-setup-state.mjs`) — actie gevraagd

**Status: 🔵 open — nieuwe export beschikbaar, geen bestaand gedrag gewijzigd.**

`shared/product/flags-mc-quick-start-default.mjs` exporteert
`FLAGS_MC_QUICK_START_DEFAULT`, de quick-start-default uit `DECISIONS.md` #35
(letterlijk: "Default bij `Snel starten`: `flags_mc`, 10 rondes, moeilijkheid
normaal, individueel, auto-tempo, snelheidspunten aan, late join aan"), 9/9
tests, direct compatibel met de bestaande `HostConfig`-vorm:

```js
{
  gameTypes: ['flags_mc'],
  totalRounds: 10,
  difficulty: 'normal',
  mode: 'individual',
  pacing: 'auto',
  speedBonus: true,
  allowLateJoin: true,
}
```

`client/flow/host-setup-state.mjs`'s `defaultHostConfig()` gebruikt op dit
moment nog het oude Groepsbattle-default (`preset: 'group_battle'`,
`GROUP_BATTLE_DEFAULT_GAME_TYPES`) — dat is niet fout, alleen achterhaald door
`DECISIONS.md` #31 (Groepsbattle wordt nu niet verder gebouwd). Zelfde patroon
als eerder: importeer de zes gedeelde velden uit `FLAGS_MC_QUICK_START_DEFAULT`
(`gameTypes`, `totalRounds`, `difficulty`, `mode`, `pacing`, `speedBonus`,
`allowLateJoin`) in plaats van ze opnieuw te typen. `preset`- en
`language`-velden legt `DECISIONS.md` #35 niet vast; dat blijft aan
`host-setup-state.mjs` zelf.

**Wat ik niet doe:** zelf `host-setup-state.mjs` aanpassen zonder gevraagd te
worden — dat bestand is van game-flow-plan. Bij PD2 gebeurde die koppeling wél
door mij, maar toen na expliciete bevestiging door de gebruiker in het gesprek;
die bevestiging is er dit keer niet, dus dit blijft een melding, geen actie.

---

## 2. Aan `integration-plan` (INT-A, walking skeleton) — informatief

**Status: 🔵 open — geen actie vereist, alleen ter kennisgeving.**

`docs/integration-plan/prompts/INT1-walking-skeleton.md` citeert `DECISIONS.md`
#35 al rechtstreeks (`flags_mc`, 10 rondes) voor de vertical-slice-happy-path.
Dat is prima en niet fout — er was geen drift. Sinds vandaag bestaat er een
canonieke, geteste bron voor diezelfde zes waarden:
`shared/product/flags-mc-quick-start-default.mjs`. Overweeg die te importeren
in plaats van de letterlijke waarden uit `DECISIONS.md` over te typen in de
walking-skeleton-tests — voorkomt dat de twee ooit uit elkaar kunnen lopen als
`DECISIONS.md` #35 ooit wordt aangevuld of gecorrigeerd. Geen blokkade: de
huidige aanpak (rechtstreeks uit `DECISIONS.md` lezen) is intern consistent en
mag zo blijven als jullie een gedeelde `shared/product/`-dependency in de
walking-skeleton-laag niet wenselijk vinden.

---

## Wat hier expliciet buiten valt

- Dit HANDOFF-item creëert geen nieuwe beslissing — alle zes waarden komen
  letterlijk uit `DECISIONS.md` #35, al bevestigd door de producteigenaar.
- Geen wijziging aan `quick-start-preset.mjs` (Groepsbattle, PD2) — blijft
  onaangeroerd staan.
- Geen wijziging aan PD3/Golf 2 — blijft bevestigd uitgesteld (`DECISIONS.md`
  #34).
