# Prompt — GF2b: Host-setup-state

Onderdeel van [`../README.md`](../README.md), fase GF2 (host-setup helft). Vereist dat
GF1 klaar is. Doel: een pure statemachine voor "Snel starten" en "Game instellen", die
een geldig `POST /api/v1/games`-verzoek produceert — geen fetch, geen DOM.

**Gecorrigeerd na bouw:** de eerste versie liet `createRequestFor` non-null zijn
tijdens `editing` (vóór `SUBMIT`). Dat werkte op zichzelf, maar was het spiegelbeeld
van `join-state`'s `joinRequestFor` (GF2a), die non-null is tijdens `submitting` (ná
`SUBMIT`). Twee onafhankelijke agents bouwden dus twee tegengestelde
aanroepconventies, allebei correct volgens hún prompt. Gecorrigeerd naar hetzelfde
patroon als `join-state`: non-null tijdens `creating`, zodat een latere wiring-laag
één uniforme regel kan volgen voor alle request-producerende modules: *dispatch
SUBMIT, vraag daarna het verzoek op*. Zie de bijgewerkte functiebeschrijving en
testtabel hieronder.

## Brondocument

`GAME-FLOW.md` §Hostflow (Snel starten, Game instellen).
`PRODUCT.md` §Standaard quick-start preset (`Groepsbattle`).
`PROTOCOL.md` `POST /api/v1/games` voor de exacte requestvorm.

## Gedekte instellingen (bewust beperkt)

`GAME-FLOW.md` noemt als geavanceerde instellingen: spelvorm/mix, moeilijkheid,
aantal rondes, taal, auto- of host-tempo, snelheidspunten, late join aan/uit,
individueel/teams (teams pas later). Deze module beperkt zich tot precies die
velden.

**Bewust buiten scope, want niet genoemd in `GAME-FLOW.md`'s instellingenlijst:**
`questionSeconds`/`resultSeconds`/`scoreboardSeconds` — `GAME-RULES.md` noemt deze
wel als instelbaar (10–30 s voor de vraagduur), maar `GAME-FLOW.md` geeft de host er
geen UI-veld voor. Ik neem aan dat deze in de MVP-UI niet blootgesteld worden en de
serverdefaults gebruiken, en vraag dit expliciet na in plaats van zelf een UI-veld te
verzinnen dat nergens in de bronnen staat.

## Gevonden tegenstrijdigheid tussen bronnen — niet door mij op te lossen

`PRODUCT.md`'s Groepsbattle-preset noemt vier spelvormen: "vlaggen, echt/nep, hoger/
lager en buitenbeentje" (`flags_mc`, `real_or_fake_flag`, `higher_lower`,
`odd_one_out`). `DATA-MODEL.md`'s voorbeeld-`GameConfiguration` voor exact dezelfde
`"preset": "group_battle"` bevat daarnaast ook `capitals_mc` (vijf spelvormen). De
implementatie volgt `PRODUCT.md` (vier spelvormen), conform de expliciete
bronvolgorde in `docs/multiplayer/README.md` §Bronvolgorde bij tegenstrijdigheden:
productregels in `PRODUCT.md` gaan vóór het state-contract in `DATA-MODEL.md`. Dit is
dus geen gok — maar de twee bronnen spreken elkaar wel tegen, en dat hoort gemeld te
worden bij de `DATA-MODEL.md`-eigenaar in plaats van stilzwijgend gecorrigeerd.

## Te bouwen module

Bestand: `client/flow/host-setup-state.mjs`.

```js
/**
 * @typedef {{
 *   preset: string,
 *   gameTypes: string[],
 *   language: string,
 *   difficulty: string,
 *   totalRounds: number,
 *   pacing: 'auto' | 'host',
 *   speedBonus: boolean,
 *   allowLateJoin: boolean,
 *   mode: 'individual',
 * }} HostConfig
 *
 * @typedef {{
 *   mode: 'quick-start' | 'advanced',
 *   config: HostConfig,
 *   hostParticipates: boolean,
 *   displayName: string | null,
 *   status: 'editing' | 'creating' | 'created' | 'error',
 *   errorCode: string | null,
 * }} HostSetupState
 */

/** Start altijd met de Groepsbattle-preset (PRODUCT.md). @returns {HostSetupState} */
export function initialHostSetupState() {}

/** @param {HostSetupState} state @param {object} event @returns {HostSetupState} */
export function transition(state, event) {}

/**
 * Wat er nu naar de server moet, of null als er niets te versturen valt. Alleen
 * non-null tijdens 'creating' — hetzelfde moment als join-state's
 * `joinRequestFor` tijdens 'submitting'.
 * @param {HostSetupState} state
 * @returns {{ config: HostConfig, hostParticipates: boolean, displayName: string | null } | null}
 */
export function createRequestFor(state) {}
```

Events: `OPEN_ADVANCED`, `SET_FIELD` (`{ key, value }`, alleen voor de gedekte velden
hierboven — een onbekende `key` wordt genegeerd, niet stilzwijgend toegevoegd aan
`config`), `TOGGLE_HOST_PARTICIPATES`, `NAME_CHANGED`, `SUBMIT`, `CREATE_SUCCEEDED`,
`CREATE_FAILED`, `RETRY`.

## Regels

- `hostParticipates` mag standaard op `true` staan maar nooit verplicht zijn
  (`GAME-FLOW.md`): `TOGGLE_HOST_PARTICIPATES` moet altijd naar `false` kunnen.
- Als `hostParticipates === false`: `displayName` wordt altijd `null` verstuurd, ook
  als er eerder tekst was ingevoerd vóór het uitzetten — geen stale naam meesturen
  voor een rol die geen naam heeft.
- Dezelfde 20-zichtbare-tekens-regel en grafeem-telling als `join-state` (GF2a) als de
  host wél meespeelt — hergebruik dezelfde telmethode, niet een tweede implementatie.
- `SUBMIT` zonder eerdere `SET_FIELD`-aanroepen moet nog steeds een geldig verzoek
  opleveren, gevuld met de Groepsbattle-defaults — "de host kan alle standaardwaarden
  accepteren zonder ieder veld te openen."

## Verplichte testgevallen

| # | Scenario | Verwacht |
| --- | --- | --- |
| 1 | `initialHostSetupState()` | `config` gelijk aan de Groepsbattle-preset, `hostParticipates: true` |
| 2 | `SUBMIT` direct na init (geen `SET_FIELD`), dan `createRequestFor` | levert een geldig verzoek met de defaults |
| 3 | `SET_FIELD('difficulty', 'hard')` gevolgd door `SUBMIT`, dan `createRequestFor` | verzoek bevat `difficulty: 'hard'`, overige velden ongewijzigd |
| 4 | `SET_FIELD('notARealField', 'x')` | genegeerd; `config` ongewijzigd |
| 5 | `TOGGLE_HOST_PARTICIPATES` naar `false` ná een ingevulde naam, dan `SUBMIT` | `displayName` is `null` in het daaropvolgende `createRequestFor` |
| 6 | `TOGGLE_HOST_PARTICIPATES` terug naar `true` | vorige naam wordt niet automatisch hersteld — speler typt opnieuw, geen verrassende cache |
| 7 | `NAME_CHANGED` met 21+ tekens / grafeem-clusters | zelfde afkap-/validatiegedrag als GF2a test 5, exact zo getest |
| 8 | `CREATE_SUCCEEDED` / `CREATE_FAILED` / `RETRY` | analoge transities aan GF2a testgevallen 8–10 |
| 9 | `createRequestFor` tijdens `editing`, `created` of `error` | `null` in alle drie de gevallen — pas tijdens `creating` levert het een verzoek |

## Niet in scope voor GF2b

- `questionSeconds`/`resultSeconds`/`scoreboardSeconds`-UI (zie hierboven).
- Teams-configuratie (`mode: 'team'`) — fase 1.5, `PRODUCT.md`.
- Preset-definities zelf anders dan Groepsbattle — er is er in de MVP maar één.
- De daadwerkelijke `fetch`-aanroep — alleen `createRequestFor` levert de vorm.

## Definition of done

- Alle testgevallen slagen, met `node --test client/flow/host-setup-state.test.mjs`.
- Geen enkele transitie gooit een exception.
- `SET_FIELD` kan nooit een veld toevoegen dat niet in de typedef van `HostConfig`
  staat.
