# Prompt — PD3: Feature-gate

Onderdeel van [`docs/product-plan/README.md`](../README.md), fase PD3. **Status:
geblokkeerd — niet uitvoeren in de huidige, ID-bindende vorm.** Zie
[`REVIEW-PD2-PD3.md`](REVIEW-PD2-PD3.md) voor de volledige review. Een reductie in scope
(§"Wat wél nu kan" hieronder) is niet geblokkeerd, maar is niet automatisch wat
hier moet gebeuren — zie de vraag aan het einde van dit document.

## Wat is veranderd t.o.v. de vorige versie

- `availableGameTypes` → hernoemd naar een engere naam met een geldigheidsclaim die
  bij de werkelijke garantie past (zie Blocker 5); de oude naam suggereerde dat het
  resultaat *alles* was wat daadwerkelijk beschikbaar is, terwijl contentVersion,
  taal, moeilijkheid en aanwezige content evengoed meetellen.
- De drie geëxporteerde arrays worden bevroren (`Object.freeze`) in plaats van als
  gewone, muteerbare arrays geëxporteerd — een consumer kon voorheen
  `GOLF_1_GAME_TYPES.push(...)` doen en zo alle latere aanroepen beïnvloeden.
- README's eerdere, verouderde omschrijving van deze fase (`logoRealOrFakeEnabled`,
  alleen item 9) wordt hier vervangen door de bredere, correcte lezing
  (`logoContentEnabled`, alle drie de logo-/clubspelvormen) — al eerder gecorrigeerd
  in dit bestand, maar de tabel in `README.md` liep achter.
- Het flags-contract kiest expliciet: onbekende sleutels en verkeerde types op de
  bekende sleutels blijven een `TypeError` (fail-loud, want dit is interne
  configuratie); `logoContentEnabled: true` zonder `golf2Enabled` blijft geldig en
  heeft stilzwijgend geen effect, zoals bij vergelijkbare feature-flag-systemen
  gebruikelijk is — dit is nu een bewuste, geteste keuze in plaats van toevallig
  gedrag.

## Blockers voor de volledige, ID-bindende versie

### 1. De Golf-2-ID's zijn nieuwe schema-/protocolkeuzes, niet iets uit de bron

`typed_input`, `logo_quiz`, `football_logos`, `logo_real_or_fake` staan nergens in
`PRODUCT.md`, `DATA-MODEL.md`, `PROTOCOL.md` of `GAME-RULES.md` als canonieke ID's —
die documenten noemen alleen de Nederlandse namen. Erger: `typed_input` voegt
vlaggen- en hoofdstedeninvoer samen tot één gameType, terwijl
`docs/game-rules-plan/prompts/GR3-validators.md` en `server/rules/validators.test.js`
(game-rules-eigenaar) al `"typed_capitals"` als voorbeeld van een toekomstige,
*aparte* Golf 2-gameType gebruiken — geverifieerd met `grep`, dat voorbeeld bestaat
echt, zij het als illustratie in een testomschrijving, niet als vastgelegd contract.
Of vlaggen en hoofdsteden één of twee typed-gameTypes worden heeft gevolgen voor
vraagselectie, validators, analytics en roomconfig bij minstens twee andere
eigenaren.

**Niet mijn beslissing:** dit vraagt een gesloten, gezamenlijk game-type-register,
bevestigd door de eigenaren van `DATA-MODEL.md`, `PROTOCOL.md` en `GAME-RULES.md`.

### 2. `golf2Enabled` staat niet als runtimefeatureflag in enige bron

`PRODUCT.md` beschrijft Golf 1/Golf 2 als lanceringsfasering, niet expliciet als een
boolean in runtimeconfig of deployment. Golf 2 kan net zo goed een latere release of
een lijst servercapabilities zijn. Alleen de logo-/clubcontent heeft een met zoveel
woorden genoemde server-side feature flag (`GAME-RULES.md` §7,
`PRODUCT.md` §Juridische productgrens voor logo's).

**Niet mijn beslissing:** of Golf 2 als runtimeflag, releasefase of
servercapability-lijst wordt gemodelleerd, is een architectuurvraag die
`ARCHITECTURE.md`/`PROTOCOL.md` raakt.

### 3. `logoContentEnabled` is een naam-/opslagvoorstel, geen bevestigd contract

De inhoudelijke lezing (alle drie de logo-/clubspelvormen delen één juridische
grens) klopt en blijft ongewijzigd. Niet bevestigd: de naam, de opslagplaats, en of
merk- en clublogo's daadwerkelijk altijd samen worden vrijgegeven — mogelijk vereisen
ze aparte juridische besluiten per contentcategorie. `LOGO_GAME_TYPES` als
*beleidsclassificatie* (welke spelvormen logo-inhoud bevatten) staat vast; één
gezamenlijke boolean is een voorstel voor juridische/productreview, geen directe
transcriptie van de bron.

### 4. Beschikbaarheid is breder dan twee booleans

`contentVersion`, `rendererVersion`, taal/moeilijkheid en aanwezige content spelen
ook mee. De hernoemde functie (zie hieronder) claimt daarom expliciet alleen een
releasebeleidsfilter te zijn, geen volledige beschikbaarheidscheck.

## Wat wél nu kan, zonder op de bovenstaande blockers te wachten

Een **beleidsmatrix zonder runtime-ID's**: dezelfde inhoudelijke regels (welke
spelvormen bij Golf 1 horen, welke bij Golf 2, welke onder de logo-juridische-grens
vallen) vastgelegd met de Nederlandse namen uit `PRODUCT.md` als sleutel, in plaats
van verzonnen ID's als `typed_input`. Dat is waardevol als bevestigde bron voor de
juridische classificatie (Blocker 3 blijft dan een apart, kleiner punt) en dwingt
geen game-type-taxonomie af bij andere eigenaren. Zwakte: minder direct bruikbaar als
importeerbare code voor wie uiteindelijk wél met ID's werkt.

## Te bouwen (huidige, ID-bindende versie — geblokkeerd, ter illustratie/review)

```js
// feature-gate.mjs — NIET UITVOEREN vóór Blocker 1 en 2 zijn beantwoord
export const GOLF_1_GAME_TYPES = Object.freeze([
  'flags_mc', 'capitals_mc', 'real_or_fake_flag', 'higher_lower', 'odd_one_out',
]);
export const GOLF_2_GAME_TYPES = Object.freeze([
  'typed_input', 'logo_quiz', 'football_logos', 'logo_real_or_fake',
]);
export const LOGO_GAME_TYPES = Object.freeze(['logo_quiz', 'football_logos', 'logo_real_or_fake']);

const KNOWN_FLAG_KEYS = new Set(['golf2Enabled', 'logoContentEnabled']);

/**
 * Beleidsfilter op basis van releasefasering en juridische vrijgave — GEEN
 * volledige beschikbaarheidscheck (contentVersion, taal, moeilijkheid en aanwezige
 * content tellen ook mee, elders).
 * @param {{ golf2Enabled?: boolean, logoContentEnabled?: boolean }} [flags]
 * @returns {string[]} nieuwe, niet-gedeelde array
 */
export function gameTypesAllowedByReleasePolicy(flags = {}) {
  if (typeof flags !== 'object' || flags === null) {
    throw new TypeError('gameTypesAllowedByReleasePolicy: flags must be an object');
  }
  for (const key of Object.keys(flags)) {
    if (!KNOWN_FLAG_KEYS.has(key)) {
      throw new TypeError(`gameTypesAllowedByReleasePolicy: unknown flag "${key}"`);
    }
  }
  const { golf2Enabled = false, logoContentEnabled = false } = flags;
  if (typeof golf2Enabled !== 'boolean' || typeof logoContentEnabled !== 'boolean') {
    throw new TypeError('gameTypesAllowedByReleasePolicy: golf2Enabled and logoContentEnabled must be booleans');
  }
  const types = [...GOLF_1_GAME_TYPES];
  if (golf2Enabled) {
    for (const type of GOLF_2_GAME_TYPES) {
      if (LOGO_GAME_TYPES.includes(type) && !logoContentEnabled) continue;
      types.push(type);
    }
  }
  return types;
}
```

## Verplichte testgevallen (voor wanneer dit ontgrendeld wordt)

Zelfde 10 gevallen als de vorige versie, plus:

| # | Scenario | Verwacht |
| --- | --- | --- |
| 11 | `GOLF_1_GAME_TYPES.push('x')` / `.pop()` | throws (`Object.freeze`), of faalt stil in non-strict — test expliciet met `'use strict'`/module-context dat de array-inhoud ongewijzigd blijft |
| 12 | `gameTypesAllowedByReleasePolicy({ onbekendeSleutel: true })` | throws `TypeError` |
| 13 | `gameTypesAllowedByReleasePolicy({ logoContentEnabled: true })` (zonder `golf2Enabled`) | alleen Golf 1 — geen throw, gedocumenteerd als geldige no-op-combinatie |

## Niet in scope

- De transportvorm van de flags — `PROTOCOL.md`, `public_api`.
- Opslag van de flag-waarden — `DATA-MODEL.md`.
- Per-spelvorm-validatie — `GAME-RULES.md`.
- Definitieve Golf-2-game-type-ID's — cross-agent, zie Blocker 1.

## Beslissing van de gebruiker

**Route (a): wachten.** Bevestigd — niets bouwen, ook niet de beleidsmatrix zonder
ID's, totdat Blocker 1 (canonieke Golf-2-ID's) en Blocker 2 (bestaat `golf2Enabled`
als runtimeflag) zijn afgestemd met de eigenaren van `DATA-MODEL.md`, `PROTOCOL.md`
en `GAME-RULES.md`. Deze fase levert dus voorlopig geen code.
