# Prompt — PD2: Quick-start preset (scope versmald na gebruikersbeslissing)

Onderdeel van [`docs/product-plan/README.md`](../README.md), fase PD2. **Status:
gedeeltelijk ontgrendeld.** Zie [`REVIEW-PD2-PD3.md`](REVIEW-PD2-PD3.md) voor de
volledige review. De gebruiker heeft drie blokkerende vragen expliciet beantwoord;
dit bestand verwerkt die beslissingen.

## Genomen beslissingen (bevestigd door de gebruiker, niet aangenomen)

1. **Eigenaarschap (Blocker 2):** "Kleine gedeelde bron" — `shared/product/` levert
   alleen de canonieke Groepsbattle-default-`gameTypes`-lijst; hij is niet de eigenaar
   van de volledige preset. `client/flow/host-setup-state.mjs` (game-flow-eigenaar)
   wordt aangepast om die lijst te importeren in plaats van hem te hardcoden. Dit is
   een bestand van een andere eigenaar — de bevestiging via de vraag aan de gebruiker
   is de expliciete toestemming om dat te wijzigen, geen eenzijdige keuze van mij.
2. **Taalveld (Blocker 3):** "Vaste fallback 'nl' overnemen" — sluit aan bij wat
   `host-setup-state.mjs` al doet. Wordt door de versmalde scope hieronder feitelijk
   niet meer relevant: deze fase levert alleen de `gameTypes`-lijst, geen taalveld.
   Bewaard voor als de scope ooit weer wordt verbreed naar de volledige preset (zie
   "Nog steeds niet gebouwd" hieronder).
3. **Blocker 1 (vier versus vijf)** is met deze beslissing feitelijk "vier" voor
   *deze* concrete lijst: `PRODUCT.md`, de al bestaande `host-setup-state.mjs`, en nu
   ook de gebruiker wijzen alle drie naar vier spelvormen. `DATA-MODEL.md`'s
   voorbeeldconfiguratie (vijf, inclusief `capitals_mc`) blijft desondanks
   inconsistent — **ik wijzig dat bestand niet zelf**, dat is niet van mij. Meld dit
   aan de `DATA-MODEL.md`-eigenaar of corrigeer het zelf; het blokkeert deze fase niet
   langer, want de vier-items-lijst is nu een bevestigde waarde, geen aanname.

## Wat deze fase bouwt

Bestand: `shared/product/quick-start-preset.mjs` + `.test.mjs`.

```js
// quick-start-preset.mjs
//
// Groepsbattle-preset, default gameTypes (PRODUCT.md §Standaard quick-start
// preset). Dit is NIET de volledige lijst van alle Golf 1-spelvormen (dat wordt
// ooit GOLF_1_GAME_TYPES in feature-gate.mjs, PD3, nog geblokkeerd) — dit is de
// kleinere, specifiek voor déze preset bevestigde standaardselectie (4 van de 5
// Golf 1-spelvormen; Hoofdsteden Quiz zit er bewust niet in).
//
// "Vier, niet vijf" is bevestigd door de gebruiker na een echte tegenstrijdigheid
// tussen PRODUCT.md (vier) en DATA-MODEL.md's voorbeeldconfiguratie (vijf, incl.
// capitals_mc). DATA-MODEL.md's voorbeeld is daarmee nog niet gecorrigeerd — dat
// bestand valt niet onder dit plan.
export const GROUP_BATTLE_DEFAULT_GAME_TYPES = Object.freeze([
  'flags_mc',
  'real_or_fake_flag',
  'higher_lower',
  'odd_one_out',
]);
```

## Verplichte testgevallen — `shared/product/quick-start-preset.test.mjs`

| # | Scenario | Verwacht |
| --- | --- | --- |
| 1 | `GROUP_BATTLE_DEFAULT_GAME_TYPES` | exact `['flags_mc', 'real_or_fake_flag', 'higher_lower', 'odd_one_out']`, in die volgorde |
| 2 | `GROUP_BATTLE_DEFAULT_GAME_TYPES.length` | `4`, niet 5 — `capitals_mc` zit er bewust niet in |
| 3 | `GROUP_BATTLE_DEFAULT_GAME_TYPES.push('x')` (of een andere mutatiepoging) | verandert de constante niet (`Object.freeze`); test met `'use strict'`/module-context dat de inhoud ongewijzigd blijft |

## Aan te passen — `client/flow/host-setup-state.mjs` (game-flow-eigenaar, gewijzigd met bevestiging)

In `defaultHostConfig()`: vervang de hardcoded
`gameTypes: ['flags_mc', 'real_or_fake_flag', 'higher_lower', 'odd_one_out']` door
een import van `GROUP_BATTLE_DEFAULT_GAME_TYPES` uit
`../../shared/product/quick-start-preset.mjs`, gespreid in een nieuwe array
(`[...GROUP_BATTLE_DEFAULT_GAME_TYPES]`) zodat elke aanroep van
`defaultHostConfig()` nog steeds zijn eigen, onafhankelijke array teruggeeft — precies
zoals nu, alleen niet meer los hardcoded.

**Niets anders in dat bestand wijzigen.** Geen andere velden, geen herstructurering,
geen opruimacties — dit is uitsluitend het vervangen van één array-literal door een
import, om defaultdrift tussen de twee modules te voorkomen.

### Verificatie dat niets breekt

`client/flow/host-setup-state.test.mjs` bevat al een lokale
`GROEPSBATTLE_CONFIG`-constante met dezelfde vier waarden en gebruikt
`assert.deepStrictEqual` (waardevergelijking, geen referentievergelijking) — dat
bestand hoeft dus niet gewijzigd te worden. Draai het na de wijziging opnieuw:
`node --test client/flow/host-setup-state.test.mjs` moet nog steeds volledig slagen,
inclusief de bestaande test "createRequestFor does not leak a shared gameTypes array
reference".

## Nog steeds niet gebouwd (uit de oorspronkelijke, bredere PD2-scope)

- Een volledige preset-constante met taal/moeilijkheid/tempo/etc. — `preset` versus
  `presetId`, het rol-model (overlay/volledige config/UI-default) en de
  taalrepresentatie zijn beantwoord (zie Genomen beslissingen), maar er is geen
  aanleiding om dat nu alsnog als apart object te bouwen zolang
  `host-setup-state.mjs` deze rol al vervult voor de UI-kant. Als dat verandert, is
  dit document het startpunt.
- `later-extensions-registry` en `acceptance-criteria` — nog ongepland, komen als
  PD4/PD5 zoals in `README.md`.

## Definition of done

- `shared/product/quick-start-preset.mjs` + test bestaan, alle 3 testgevallen slagen:
  `node --test shared/product/quick-start-preset.test.mjs`.
- `client/flow/host-setup-state.mjs` importeert `GROUP_BATTLE_DEFAULT_GAME_TYPES` in
  plaats van de lijst te hardcoden; geen andere wijziging in dat bestand.
- `node --test client/flow/host-setup-state.test.mjs` slaagt nog steeds volledig,
  ongewijzigd.
- Precies 3 bestanden aangeraakt (1 nieuw + 1 nieuwe test in `shared/product/`, 1 edit
  in `client/flow/`), ruim binnen de 15-bestanden-grens.
