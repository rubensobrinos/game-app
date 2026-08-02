# Prompt — PD6: Interfacevoorstel voor DATA-MODEL.md / PROTOCOL.md

Onderdeel van [`docs/product-plan/README.md`](../README.md), fase PD6, de laatste
fase van dit plan. Doel: een niet-bindend voorstel schrijven voor de eigenaren van
`DATA-MODEL.md` en `PROTOCOL.md` (beide ADR-plichtig — `database_schema` /
`public_api` volgens `devkit policy --json`) over wat ze uit PD1–PD5 kunnen
overnemen. **Geen ADR, geen wijziging aan hun bestanden** — een voorstel, net als
GR7 in `game-rules-plan`, AR5 in `architecture-plan` en GF8 in `game-flow-plan`.

## Belangrijk: dit is een versmalde PD6, niet de oorspronkelijk geplande

De oorspronkelijke omschrijving in `README.md` noemde ook "welke beslisregel uit
`feature-gate` (PD3)" — maar PD3 is on hold (gebruikersbeslissing: wachten tot Golf-
2-ID's en `golf2Enabled`-semantiek zijn afgestemd, zie
[`prompts/PD3-feature-gate.md`](PD3-feature-gate.md)). Er bestaat dus geen
`feature-gate`-module om iets uit voor te stellen. **Schrijf dit deel niet als
alsnog-verzonnen voorstel** — vermeld expliciet dat dit onderdeel van PD6 nog open
staat en pas volgt zodra PD3 ontgrendeld wordt.

## Wat er wél is om voor te stellen

### 1. Aan de `DATA-MODEL.md`-eigenaar: `GameConfiguration.gameTypes`-voorbeeld corrigeren

Dit is het belangrijkste, concrete punt. Achtergrond (allemaal al gebeurd, dit is
geen nieuw onderzoek):

- `DATA-MODEL.md`'s `GameConfiguration`-voorbeeld toont voor `preset: "group_battle"`
  vijf spelvormen, inclusief `capitals_mc`.
- `PRODUCT.md` §Standaard quick-start preset noemt er expliciet vier (zonder
  Hoofdsteden Quiz).
- De gebruiker heeft dit conflict expliciet beslecht op "vier" (zie
  [`prompts/PD2-quick-start-preset.md`](PD2-quick-start-preset.md), sectie "Genomen
  beslissingen"). De bevestigde waarde staat nu in
  [`shared/product/quick-start-preset.mjs`](../../shared/product/quick-start-preset.mjs)
  als `GROUP_BATTLE_DEFAULT_GAME_TYPES` — bevroren array
  `['flags_mc', 'real_or_fake_flag', 'higher_lower', 'odd_one_out']`, 3 tests, en wordt
  al daadwerkelijk gebruikt door `client/flow/host-setup-state.mjs` (game-flow-plan).
- `DATA-MODEL.md` zelf is tot nu toe niet aangepast — dat bestand is niet van het
  product-plan.

Het voorstel: de `DATA-MODEL.md`-eigenaar past het `GameConfiguration`-voorbeeld aan
zodat `gameTypes` voor `group_battle` de vier bevestigde waarden toont, in dezelfde
volgorde als `GROUP_BATTLE_DEFAULT_GAME_TYPES`. Citeer het exacte bestand en de
exacte waarde, niet parafraseren.

### 2. Aan beide eigenaren: optioneel bruikbare hulpmodules uit PD1

`shared/product/hard-rules.mjs` (`HARD_RULES`) en `shared/product/mvp-scope-guard.mjs`
(`EXCLUDED_FROM_MVP`, `isExplicitlyExcluded()`, `assertNoneExcluded()`) bestaan en
zijn getest (16/16). Noem concreet, zonder het voor te schrijven, waar ze nuttig
*zouden kunnen* zijn:

- `PROTOCOL.md`-eigenaar: een contracttest die aantoont dat de response van
  `POST /api/v1/games` en `POST /api/v1/games/join` nooit een account-/e-mailveld
  bevat, zou `HARD_RULES.find(r => r.id === 'no-mandatory-account')` als
  gedocumenteerde herkomst kunnen citeren in plaats van de regel opnieuw te
  formuleren.
- `DATA-MODEL.md`-eigenaar: `DATA-MODEL.md` §"Wat niet persistent wordt opgeslagen"
  dekt inhoudelijk al `persistent_player_names` uit `EXCLUDED_FROM_MVP` — een test
  die dat expliciet aan elkaar knoopt (bijvoorbeeld
  `isExplicitlyExcluded('persistent_player_names')` naast een test dat
  `game_sessions`/`round_stats`/`daily_metrics` geen naamveld hebben) zou de twee
  documenten aantoonbaar consistent houden in plaats van toevallig consistent.

Dit is **suggestie, geen eis** — beide eigenaren kunnen ervoor kiezen dit niet over
te nemen; het is hun beslissingsterrein.

### 3. Wat hier expliciet niet in staat

- Geen voorstel voor de transportvorm van feature-flags (`golf2Enabled`,
  `logoContentEnabled`) — dat hoort bij `feature-gate` (PD3), on hold. Vermeld dit als
  een open, later punt, verzin er niets voor in de plaats.
- Geen voorstel over `later-extensions-registry` (PD4) of `acceptance-criteria` (PD5)
  richting `DATA-MODEL.md`/`PROTOCOL.md` — die twee zijn primair traceability-
  artefacten zonder directe schema-implicatie voor die twee documenten specifiek.

## Te schrijven

Eén nieuw document: `docs/product-plan/data-model-and-protocol-interface-proposal.md`.
Structuur (vrij in bewoording, niet in inhoud — de drie secties hierboven moeten er
alle drie in staan, inclusief sectie 3 als expliciete "niet nu"-vermelding, niet
weggelaten):

1. Korte intro: niet-bindend voorstel, geen ADR, `docs/product-plan/README.md` als
   context.
2. Voorstel 1 (DATA-MODEL.md, gameTypes-voorbeeld) — met citaten/links naar de
   exacte bestanden en waarden, niet parafraseren.
3. Voorstel 2 (optionele hulpmodules) — met de twee concrete voorbeelden hierboven,
   expliciet gemarkeerd als suggestie.
4. Wat hier niet in staat (feature-gate/PD3) — met een link naar
   `prompts/PD3-feature-gate.md` en de reden.

## Niet in scope

- `DATA-MODEL.md` of `PROTOCOL.md` zelf wijzigen — dat is aan hun eigenaren.
- Nieuwe code in `shared/product/` — PD6 is een voorstel, geen module.
- Iets verzinnen voor de feature-gate-transportvorm om PD6 "compleet" te laten lijken.

## Definition of done

- `docs/product-plan/data-model-and-protocol-interface-proposal.md` bestaat, bevat
  alle drie secties (inclusief expliciete "niet nu"-sectie voor PD3).
- Elk citaat/elke waarde in het document is geverifieerd tegen het daadwerkelijke
  bestand (bijv. `GROUP_BATTLE_DEFAULT_GAME_TYPES`'s inhoud rechtstreeks uit
  `shared/product/quick-start-preset.mjs` overgenomen, niet uit het geheugen
  geparafraseerd).
- Geen enkel bestand buiten dit ene nieuwe document is gewijzigd.
- `docs/product-plan/README.md` en `docs/product-plan/PD-PROGRESS.md` kort
  aangevuld (niet herschreven) met: PD6 afgerond, link naar het voorstel, en de
  aantekening dat het feature-gate-deel nog open staat tot PD3 ontgrendelt.
