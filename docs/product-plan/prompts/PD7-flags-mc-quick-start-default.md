# Prompt — PD7: `FLAGS_MC_QUICK_START_DEFAULT`

Onderdeel van [`docs/product-plan/README.md`](../README.md), fase PD7. Vereist
PD2 als stijlvoorbeeld (zelfde patroon: `shared/product/` levert alleen de
canonieke waarden, consumenten importeren in plaats van overtypen). Dit is geen
heropening van PD3 en geen Groepsbattle-werk — `DECISIONS.md` #31/#34 blijven
onveranderd bevestigd uitgesteld.

## Aanleiding

`DECISIONS.md` #35 introduceert een nieuw, van Groepsbattle losstaand
quick-start-default. Op het moment van schrijven leest iedere consument
(`integration-plan`'s walking skeleton, `content-plan`'s CT1) deze waarden
rechtstreeks uit `DECISIONS.md` #35 — geen drift geconstateerd, maar ook geen
gedeelde bron die dat op termijn garandeert zodra er meer consumenten bijkomen
(met name `client/flow/host-setup-state.mjs`, dat nog het oude
`group_battle`-default gebruikt). Dit is een bewuste, kleine toevoeging, geen
reactie op een gevonden bug.

## Brontekst — `DECISIONS.md` #35 (letterlijk, het deel dat waarden vastlegt)

> Default bij `Snel starten`: `flags_mc`, 10 rondes, moeilijkheid normaal,
> individueel, auto-tempo, snelheidspunten aan, late join aan.

Zes bevestigde waarden: spelvorm `flags_mc`, `totalRounds: 10`,
`difficulty: 'normal'`, `mode: 'individual'`, `pacing: 'auto'`,
`speedBonus: true`, `allowLateJoin: true`. `gameTypes` wordt als array
gemodelleerd (`['flags_mc']`) om direct compatibel te zijn met de bestaande
`HostConfig.gameTypes: string[]`-vorm in `host-setup-state.mjs` — geen aparte
`gameType`-enkelvoudsvorm die daar weer een vertaling zou vergen.

## Te bouwen

Bestand: `shared/product/flags-mc-quick-start-default.mjs` + `.test.mjs`.

```js
// flags-mc-quick-start-default.mjs
//
// Quick-start default per DECISIONS.md #35 ("Kernflow quick-start blijft
// bestaan"). Dit vervangt niet de stopgezette Groepsbattle-preset (#31,
// quick-start-preset.mjs) — het is de nieuwe, actuele default voor de
// kern-quickstartflow. Zelfde patroon als quick-start-preset.mjs (PD2):
// shared/product/ levert alleen de canonieke waarden; consumenten
// (host-setup-state.mjs / GF, de walking skeleton / INT-A) importeren in
// plaats van over te typen.
export const FLAGS_MC_QUICK_START_DEFAULT = Object.freeze({
  gameTypes: Object.freeze(['flags_mc']),
  totalRounds: 10,
  difficulty: 'normal',
  mode: 'individual',
  pacing: 'auto',
  speedBonus: true,
  allowLateJoin: true,
});
```

## Verplichte testgevallen — `flags-mc-quick-start-default.test.mjs`

| # | Scenario | Verwacht |
| --- | --- | --- |
| 1 | `FLAGS_MC_QUICK_START_DEFAULT.gameTypes` | `['flags_mc']` |
| 2 | `.totalRounds` | `10` |
| 3 | `.difficulty` | `'normal'` |
| 4 | `.mode` | `'individual'` |
| 5 | `.pacing` | `'auto'` |
| 6 | `.speedBonus` | `true` |
| 7 | `.allowLateJoin` | `true` |
| 8 | `Object.keys(FLAGS_MC_QUICK_START_DEFAULT).length` | `7` — geen ongespecificeerde velden |
| 9 | Mutatiepoging op het top-level object en op `.gameTypes` | beide bevroren (`Object.isFrozen`), `assert.throws` + inhoud ongewijzigd, zelfde patroon als PD1/PD2/PD4/PD5 |

## Niet in scope

- `preset`/`language`-velden — #35 legt die niet vast; `host-setup-state.mjs`
  bepaalt zelf hoe het dit default in zijn volledige `HostConfig` inpast.
- Enige wijziging aan `quick-start-preset.mjs` (Groepsbattle) — blijft
  onaangeroerd staan, PD-RESUME-opdracht 3 blijft gelden.
- PD3/Golf 2 — ongewijzigd bevestigd uitgesteld.

## Definition of done

- Alle 9 testgevallen slagen: `node --test shared/product/flags-mc-quick-start-default.test.mjs`.
- Volledige `shared/product/`-suite blijft groen (was 35/35, wordt 35+9=44/44).
- HANDOFF naar GF (`host-setup-state.mjs`) en INT-A (walking skeleton) dat deze
  constante bestaat, zodat beiden importeren i.p.v. overtypen — zie
  `docs/product-plan/HANDOFF.md`.
