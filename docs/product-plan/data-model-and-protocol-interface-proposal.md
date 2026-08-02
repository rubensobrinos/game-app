# Interfacevoorstel — DATA-MODEL.md / PROTOCOL.md (PD6)

Dit is een **niet-bindend voorstel**, geen ADR. `DATA-MODEL.md` (`database_schema`)
en `PROTOCOL.md` (`public_api`) zijn beide ADR-plichtig volgens `devkit policy
--json` en vallen niet onder dit plan (zie
[`docs/product-plan/README.md`](README.md)) — de eigenaren van die twee documenten
beslissen zelf of, en hoe, ze onderstaande punten overnemen. Dit document wijzigt
`DATA-MODEL.md` en `PROTOCOL.md` zelf niet.

Context: `docs/product-plan/README.md` beschrijft PD0–PD5 als de realisatie van
`docs/multiplayer/PRODUCT.md` in `shared/product/`. PD6 is de laatste fase: een
voorstel naar de twee ADR-plichtige buurdocumenten, zoals ook GR7
(`game-rules-plan`), AR5 (`architecture-plan`) en GF8 (`game-flow-plan`) dat doen
richting hun eigen buren.

## Voorstel 1 — `DATA-MODEL.md`: `GameConfiguration.gameTypes`-voorbeeld corrigeren

`DATA-MODEL.md`, sectie "GameConfiguration", toont momenteel voor
`preset: "group_battle"` dit `gameTypes`-veld (vijf waarden, inclusief
`capitals_mc`):

```json
"gameTypes": [
  "flags_mc",
  "capitals_mc",
  "real_or_fake_flag",
  "higher_lower",
  "odd_one_out"
]
```

`PRODUCT.md` §Standaard quick-start preset noemt voor dezelfde preset expliciet
**vier** spelvormen (zonder Hoofdsteden Quiz). Dit conflict is al eerder
gesignaleerd en door de gebruiker beslecht — zie
[`prompts/PD2-quick-start-preset.md`](prompts/PD2-quick-start-preset.md), sectie
"Genomen beslissingen", punt 3: *"Blocker 1 (vier versus vijf) is met deze
beslissing feitelijk 'vier' voor deze concrete lijst: PRODUCT.md, de al bestaande
`host-setup-state.mjs`, en nu ook de gebruiker wijzen alle drie naar vier
spelvormen. DATA-MODEL.md's voorbeeldconfiguratie (vijf, inclusief `capitals_mc`)
blijft desondanks inconsistent — ik wijzig dat bestand niet zelf, dat is niet van
mij."*

De bevestigde waarde is sindsdien vastgelegd in
[`shared/product/quick-start-preset.mjs`](../../shared/product/quick-start-preset.mjs)
als `GROUP_BATTLE_DEFAULT_GAME_TYPES`. De exacte, huidige inhoud van dat bestand
(letterlijk geciteerd, geverifieerd door het bestand te lezen op het moment van
schrijven van dit voorstel):

```js
export const GROUP_BATTLE_DEFAULT_GAME_TYPES = Object.freeze([
  'flags_mc',
  'real_or_fake_flag',
  'higher_lower',
  'odd_one_out',
]);
```

Deze constante is al 3 tests groen (`shared/product/quick-start-preset.test.mjs`) en
wordt al daadwerkelijk gebruikt door `client/flow/host-setup-state.mjs`
(`defaultHostConfig()`, game-flow-plan) in plaats van daar hardcoded te staan.

**Het voorstel:** de `DATA-MODEL.md`-eigenaar past het `GameConfiguration`-voorbeeld
aan zodat `gameTypes` voor `preset: "group_battle"` de vier bevestigde waarden toont
(`capitals_mc` eruit), in dezelfde volgorde als `GROUP_BATTLE_DEFAULT_GAME_TYPES`
hierboven:

```json
"gameTypes": [
  "flags_mc",
  "real_or_fake_flag",
  "higher_lower",
  "odd_one_out"
]
```

Dit is een documentatiecorrectie van een voorbeeldwaarde, geen schemawijziging: het
veld `gameTypes` zelf, zijn type en de bredere enum van geldige spelvorm-ID's blijven
ongemoeid. Alleen het getoonde voorbeeld voor déze ene preset verandert.

## Voorstel 2 — Optioneel bruikbare hulpmodules uit PD1 (suggestie, geen eis)

`shared/product/hard-rules.mjs` (`HARD_RULES`) en
`shared/product/mvp-scope-guard.mjs` (`EXCLUDED_FROM_MVP`,
`isExplicitlyExcluded()`, `assertNoneExcluded()`) bestaan en zijn getest (16/16).
Onderstaande twee punten zijn concrete voorbeelden van waar ze nuttig *zouden
kunnen* zijn voor `PROTOCOL.md` en `DATA-MODEL.md` — **dit is een suggestie, geen
eis**. Beide eigenaren kunnen ervoor kiezen dit niet over te nemen; het blijft hun
beslissingsterrein.

### 2a. Aan `PROTOCOL.md`: contracttest voor de create/join-responses

`PROTOCOL.md`, secties `POST /api/v1/games` en `POST /api/v1/games/join`,
specificeert de volgende response-vormen:

`POST /api/v1/games` response:

```json
{
  "roomId": "room_01J...",
  "gameCode": "482917",
  "inviteId": "N4x7pQm2K8tW",
  "joinUrl": "https://play.aseso.nl/j/N4x7pQm2K8tW",
  "sessionToken": "<secret>",
  "roles": ["host", "player"],
  "playerId": "p_a1b2c3",
  "effectiveName": "Vlugge Vos",
  "state": {}
}
```

`POST /api/v1/games/join` response:

```json
{
  "roomId": "room_01J...",
  "gameCode": "482917",
  "sessionToken": "<secret>",
  "roles": ["player"],
  "playerId": "p_8f42d1",
  "effectiveName": "Ruben",
  "state": {}
}
```

Geen van beide bevat een account- of e-mailveld. Een contracttest die dit expliciet
vastlegt (bijvoorbeeld: assert dat de response-sleutels geen `email`, `account*` of
vergelijkbaar veld bevatten) zou als gedocumenteerde herkomst kunnen citeren:

```js
HARD_RULES.find((r) => r.id === 'no-mandatory-account')
// → { id: 'no-mandatory-account', text: 'Iedere gebruiker kan binnen enkele
//     seconden een game starten of joinen zonder account, e-mailadres of andere
//     verplichte registratie.' }
```

in plaats van de regel opnieuw te formuleren in een test- of docstring in
`PROTOCOL.md`'s eigen repository-omgeving. Dat houdt de regel op één plek
geformuleerd (`PRODUCT.md`, gespiegeld in `hard-rules.mjs`) in plaats van los
herhaald.

### 2b. Aan `DATA-MODEL.md`: consistentietest tussen `EXCLUDED_FROM_MVP` en "Wat niet persistent wordt opgeslagen"

`DATA-MODEL.md` §"Wat niet persistent wordt opgeslagen" noemt onder meer:

> - zelfgekozen of gegenereerde namen;
> - permanente speler-ID's;

Dit dekt inhoudelijk al het item `persistent_player_names` uit
`EXCLUDED_FROM_MVP`:

```js
{ id: 'persistent_player_names', text: 'permanente opslag van spelersnamen' }
```

Op dit moment zijn dat twee onafhankelijk geformuleerde bronnen die *toevallig*
hetzelfde zeggen. Een test die ze expliciet aan elkaar knoopt — bijvoorbeeld
`isExplicitlyExcluded('persistent_player_names')` combineren met een test dat de
daadwerkelijke opslagmodellen (`game_sessions`, `round_stats`, `daily_metrics` of
vergelijkbare structuren in `DATA-MODEL.md`) geen persistent naamveld bevatten —
zou de twee documenten *aantoonbaar* consistent houden in plaats van alleen
toevallig consistent. Zonder zo'n test kan `DATA-MODEL.md` in een latere wijziging
afdwalen van `PRODUCT.md`'s uitsluitingslijst zonder dat iets dat automatisch
signaleert.

## Wat hier niet in staat

Dit voorstel bevat **geen** voorstel voor de transportvorm van feature-flags
(`golf2Enabled`, `logoContentEnabled`) richting `PROTOCOL.md`, en evenmin voor hoe
`DATA-MODEL.md` zulke vlaggen zou moeten opslaan. Dat zou het onderwerp zijn van het
`feature-gate`-bouwsteen (PD3), maar PD3 is **on hold**: de gebruiker heeft expliciet
gekozen voor "wachten" totdat de canonieke Golf-2-spelvorm-ID's (`typed_input` versus
het elders al gebruikte `typed_capitals`, zie
[`prompts/PD3-feature-gate.md`](prompts/PD3-feature-gate.md), Blocker 1) en de
`golf2Enabled`-runtimeflagsemantiek (bestaat die als boolean, releasefase, of
servercapability-lijst — Blocker 2) zijn afgestemd tussen de eigenaren van
`DATA-MODEL.md`, `PROTOCOL.md` en `GAME-RULES.md`. Zonder die afstemming bestaat er
geen `feature-gate`-module in `shared/product/` om iets uit voor te stellen, en zou
een verzonnen voorstel hier een schijnbare afronding suggereren die er niet is.

Zie [`prompts/PD3-feature-gate.md`](prompts/PD3-feature-gate.md) voor de volledige
blocker-analyse en de expliciete gebruikersbeslissing ("Route (a): wachten"). Zodra
PD3 ontgrendeld wordt, is dit het punt waar het feature-gate-deel van een
interfacevoorstel alsnog aan toegevoegd kan worden — niet met terugwerkende kracht
in dit document, maar als vervolg.

Ook buiten scope van dit voorstel: `later-extensions-registry` (PD4) en
`acceptance-criteria` (PD5) — beide zijn primair traceability-artefacten zonder
directe schema- of protocolimplicatie voor `DATA-MODEL.md`/`PROTOCOL.md`
specifiek, zie `docs/product-plan/README.md` §"Wat hier expliciet buiten valt".
