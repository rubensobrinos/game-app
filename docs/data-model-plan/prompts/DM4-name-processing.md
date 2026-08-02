# Prompt — DM4: Naamverwerking

Onderdeel van [`docs/data-model-plan/README.md`](../README.md), fase DM4.
Onafhankelijk van DM2/DM3 (pure stringlogica, geen afhankelijkheid op de
typedefs). Corrigeert `REVIEW.md` bevinding 6: vaste stappen en open
algoritmische keuzes worden hier expliciet gescheiden, niet stilzwijgend
allebei als "gewoon bouwen" behandeld.

## Context — de letterlijke bron

`docs/multiplayer/DATA-MODEL.md`, sectie "Naamverwerking":

```text
1. trim;
2. Unicode NFKC-normalisatie;
3. control characters verwijderen;
4. maximaal 20 zichtbare tekens;
5. eenvoudige profanitycheck per taal;
6. uniek maken binnen room;
7. uitsluitend als tekst renderen.

Voor automatisch gegenereerde namen:
- vaste, gecontroleerde lijsten per taal;
- combinatie van adjectief + dier of `Speler {n}`;
- nooit beledigend;
- suffix bij botsing.
```

`GAME-FLOW.md` §Naamgedrag + Randgevallen 4/5 leveren twee concrete, letterlijke
voorbeelden die bevindingen 6 gedeeltelijk oplossen zonder dat er iets verzonnen
hoeft te worden:
- Randgeval 4 ("Dubbele naam"): *"De server maakt de naam uniek, bijvoorbeeld
  `Sanne 2`."* — dit legt het **suffixformaat** vast: spatie + oplopend getal,
  beginnend bij 2 voor de tweede botsing. Niet langer open.
- Randgeval 5 ("Geen naam ingevuld"): *"De server gebruikt de reeds voorgestelde
  naam of genereert `Speler {n}` / een alias."* — bevestigt het letterlijke
  `Speler {n}`-formaat naast de adjectief+dier-alias.

## Wat vast ligt (a) — stappen 1, 2, 4 (deels), 7, en het suffixformaat

### 1–2. `trim` + NFKC

```js
function normalizeWhitespaceAndForm(input) {
  return input.trim().normalize('NFKC');
}
```

### 4 (deels). Truncatie-primitief

`maximaal 20 zichtbare tekens` is een lengte-eis; **of** overschrijding truncatie
(stilzwijgend inkorten) of afwijzing (`PROTOCOL.md`'s `NAME_TOO_LONG`) betekent, is
niet vastgelegd — zie "Wat open blijft" hieronder. Bouw hier alleen de primitief:

```js
/** Knipt af op maxVisible grafeem-clusters (zie open vraag hieronder voor de
 *  definitie van "zichtbaar teken"). Doet geen validatie, alleen transformatie. */
function truncateToVisibleLength(text, maxVisible) { /* ... */ }
```

### 7. Contractvereiste, geen transformatie

Deze module levert de naam terug als kale, ongeëscapete string. Geen server-side
HTML-escaping die de renderlaag zou kunnen vervangen. De garantie dat de naam
nooit als HTML/markup wordt geïnterpreteerd hoort bij de clientcode (tekstnodes,
geen `innerHTML`) — `REVIEW.md` bevinding 6: een Node-test kan niet bewijzen dat
`<script>` nooit rendert, dat is een client-/E2E-test. Deze module test alleen dat
zulke tekens als **inerte tekens** door de pijplijn heen komen (stap 1–6), niet
uitgevoerd, niet stilzwijgend anders verwijderd dan via de genoemde stappen.

### Suffixformaat (bevestigd door `GAME-FLOW.md` Randgeval 4)

```js
/** "Sanne" -> "Sanne" (geen botsing) | "Sanne 2" (eerste botsing) | "Sanne 3" ... */
function makeUniqueInRoom(candidateName, existingEffectiveNames) { /* ... */ }
```

## Wat open blijft (c) — gedocumenteerde defaults, geen wachtstap

Voor elk van deze geldt: **geen ADR nodig** (geen `architecture`/`deps`/`auth`/
`prod`-impact), dus geen reden om te wachten — wel een expliciet gemarkeerde,
laag-risico keuze die met één regel te wijzigen is als iemand het anders wil.

- **"Zichtbaar teken" (stap 4):** grafeem-cluster, niet Unicode-codepoint —
  gebruik `Intl.Segmenter` (`new Intl.Segmenter().segment(text)`, ingebouwd in
  Node, geen dependency). Reden: een codepoint-telling zou een familie-emoji of
  een letter-met-accent (als twee codepoints) als 2+ tekens tellen terwijl een
  gebruiker dat als één teken ziet.
- **Control/format-tekenset (stap 3):** Unicode-categorieën `Cc` (control) en
  `Cf` (format, o.a. zero-width-tekens) via `/[\p{Cc}\p{Cf}]/gu`. Reden: dit is de
  standaardinterpretatie van "control characters" in tekstverwerking en dekt ook
  onzichtbare-misbruiktekens (`PROTOCOL.md` §Inputveiligheid noemt die expliciet).
- **Case-/accentgevoeligheid bij uniciteit (stap 6):** vergelijk case- en
  accent-ongevoelig (NFKD + diacritics strippen + lowercase) om te bepalen of twee
  namen "botsen". Reden: "Sanne" en "sanne" of "café" en "cafe" naast elkaar in
  een spelerslijst is verwarrender dan een extra suffix.
- **Profanitylijst-bron (checkpoint 11) — contentbeslissing, zie "Contentgrens"
  hieronder (bevinding 14):** welke woorden per taal op de lijst staan, en welke
  talen gedekt zijn, is redactionele productcontent, geen technisch besluit dat
  deze prompt zelfstandig maakt. `isProfane(text, language,
  profanityWordsByLanguage)` neemt de lijst daarom als parameter (dependency
  injection) — de module kent, kiest of verzint zelf geen woorden. Een
  placeholder-lijst om de functie te kunnen testen is toegestaan, maar leeft als
  gelabeld testfixture-object in `name-processing.test.js`, niet als
  module-interne constante.
- **Woordenlijsten voor gegenereerde namen — idem, contentbeslissing, zie
  "Contentgrens" hieronder (bevinding 14):** welke adjectieven/dieren per taal
  gebruikt worden is redactionele productcontent. `generateName(language,
  wordListsByLanguage, existingEffectiveNames)` neemt die lijsten daarom als
  parameter; `"nooit beledigend"` is een eis aan die (latere, apart
  gereviewde) content, niet iets wat deze module kan afdwingen door zelf woorden
  te kiezen.
- **`NAME_TOO_LONG`/`NAME_INVALID` (protocol-interactie):** of een te lange of
  ongeldige naam wordt **afgewezen** (`PROTOCOL.md`-foutcode) of **stilzwijgend
  getransformeerd** (deze pijplijn), ligt niet vast. Deze module bouwt alleen de
  transformatie-primitieven; wanneer/of ze i.p.v. een afwijzing worden aangeroepen
  is een `PROTOCOL.md`-beslissing, hier niet beantwoord.

## Contentgrens: woordenlijsten zijn geen technisch besluit (bevinding 14)

`REVIEW-DM2-DM9.md` bevinding 14: placeholder-profanitylijsten en 8–10
adjectieven/dieren per taal zijn redactionele productcontent. "Eenvoudig en
onschuldig" maakt dat geen zelfstandig technisch besluit — welke woorden
precies op de lijst staan, en welke talen gedekt zijn, is een product-/
contentbeslissing die een aparte, latere contentreview-stap verdient. Deze
coderingsprompt beslist dat niet zelf en bakt het daarom niet in als
module-interne constante.

Daarom nemen de betrokken functies de woordenlijsten als parameter aan
(dependency injection) in plaats van ze zelf te bevatten:

```js
/** @param {Record<string, string[]>} profanityWordsByLanguage
 *  bijv. { nl: [...], en: [...], es: [...] } — inhoud is een contentbeslissing,
 *  niet gedefinieerd in deze module. */
function isProfane(text, language, profanityWordsByLanguage) { /* ... */ }

/** @param {Record<string, { adjectives: string[], animals: string[] }>} wordListsByLanguage
 *  inhoud is een contentbeslissing, niet gedefinieerd in deze module. */
function generateName(language, wordListsByLanguage, existingEffectiveNames) { /* ... */ }
```

`name-processing.js` bevat zelf geen enkel woord — geen adjectief, geen dier,
geen profaan woord, voor geen enkele taal. Een placeholder-lijst om de
functies te kunnen testen of demonstreren hoort niet in de pure-logica-module,
maar als expliciet gelabeld testfixture-object bovenaan
`name-processing.test.js` (bijv. `PLACEHOLDER_WORD_LISTS_FOR_TESTS_ONLY`,
`PLACEHOLDER_PROFANITY_WORDS_FOR_TESTS_ONLY`) — duidelijk gemarkeerd als
testdata, geen productcontent. De daadwerkelijke runtimelijsten (welke woorden
precies, welke talendekking) landen pas nadat een aparte product-/
contentreview ze heeft vastgesteld; dat is geen onderdeel van deze
coderingsprompt.

## Stappen

1. `server/data/name-processing.js`:
   - `normalizeWhitespaceAndForm`, `stripControlAndFormatChars`,
     `truncateToVisibleLength`, `isProfane(text, language,
     profanityWordsByLanguage)`, `makeUniqueInRoom`, en een samenstellende
     `processChosenName(rawInput, language, existingEffectiveNames)` die stappen
     1–4 en 6 combineert (stap 5, profanity, apart aanroepbaar — zie hieronder
     waarom). Geen van deze functies bevat een hardgecodeerde woordenlijst — de
     content is een parameter, geen module-interne constante (zie "Contentgrens"
     hierboven, bevinding 14).
   - `generateName(language, wordListsByLanguage, existingEffectiveNames)`: kiest
     adjectief+dier uit de meegegeven `wordListsByLanguage[language]`, valt terug
     op `Speler {n}` volgens letterlijk formaat wanneer die taal geen lijst heeft
     (ontbrekende of lege entry in `wordListsByLanguage`), past `makeUniqueInRoom`
     toe. De module kiest of kent zelf geen woorden.
   - Profanity is **apart** van `processChosenName` (niet erin verweven): een
     profane genormaliseerde naam moet tot een nieuwe generatie leiden, niet tot
     een throw midden in de pijplijn — de aanroeper (buiten deze module, in de
     join-flow) beslist wat er gebeurt bij een profane treffer (opnieuw genereren,
     of alsnog gebruiken met melding). Deze module signaleert alleen.
2. Tests (`name-processing.test.js`), inclusief:
   - bovenaan het testbestand: `PLACEHOLDER_WORD_LISTS_FOR_TESTS_ONLY`
     (adjectieven + dieren per taal, NL/EN/ES) en
     `PLACEHOLDER_PROFANITY_WORDS_FOR_TESTS_ONLY` (per taal) als expliciet
     gelabelde testfixtures — kleine, onschuldige woorden, uitsluitend om de
     geïnjecteerde parameters te kunnen testen; **geen productcontent en niet in
     `name-processing.js`** (bevinding 14, zie "Contentgrens" hierboven);
   - elke stap afzonderlijk (trim, NFKC, control-strip, truncatie op
     grafeem-clusters — test met een samengesteld emoji/accentteken dat als één
     zichtbaar teken telt maar meerdere codepoints heeft);
   - `makeUniqueInRoom` reproduceert letterlijk het `GAME-FLOW.md`-voorbeeld:
     `"Sanne"` + bestaande `["Sanne"]` → `"Sanne 2"`; een derde botsing → `"Sanne
     3"`; case-/accentvarianten van een bestaande naam tellen als botsing;
   - XSS-achtige/onzichtbare-misbruiktekens-input (`<script>`, zero-width-space,
     RTL-override-teken) komt als inerte tekenreeks door stap 1–4 heen — expliciet
     **niet** getest als "wordt nooit gerenderd" (dat is client-terrein, zie
     hierboven);
   - `isProfane(text, language, PLACEHOLDER_PROFANITY_WORDS_FOR_TESTS_ONLY)`:
     een woord uit de fixture-lijst voor een taal geeft `true`, een niet-profaan
     woord geeft `false`, en een taal zonder fixture-entry (ontbrekend of leeg)
     geeft `false` zonder te crashen — bewijst dat de module zelf geen lijst
     kent;
   - `generateName(language, PLACEHOLDER_WORD_LISTS_FOR_TESTS_ONLY,
     existingEffectiveNames)` produceert een adjectief+dier-alias uit de
     meegegeven lijst, uniek gemaakt bij botsing; en `generateName(language, {},
     existingEffectiveNames)` (ontbrekende/lege lijst voor die taal) valt terug
     op de `Speler {n}`-fallback, eveneens uniek gemaakt bij botsing.

## Harde grenzen

- Geen dependency — `Intl.Segmenter` en Unicode-property-regexes zijn Node-native.
- Geen HTML-escaping in deze module (stap 7 is een contractvereiste voor de
  renderlaag, geen transformatie hier).
- Geen beslissing over `NAME_TOO_LONG`/`NAME_INVALID`-afwijzing vs. transformatie.
- 2 bestanden (module + test).

## Definition of done

- Alle zeven stappen + de generator zijn gebouwd, met vaste stappen en open
  defaults duidelijk gescheiden in commentaar (niet stilzwijgend vermengd).
- `isProfane` en `generateName` bevatten geen hardgecodeerde woordenlijst; beide
  nemen de content (`profanityWordsByLanguage` respectievelijk
  `wordListsByLanguage`) als parameter. `name-processing.js` bevat nul woorden,
  in geen enkele taal — placeholder-lijsten leven uitsluitend als gelabelde
  testfixture in `name-processing.test.js` (bevinding 14).
- `makeUniqueInRoom` reproduceert het `GAME-FLOW.md`-voorbeeld exact.
- `node --test 'server/data/**/*.test.js'` slaagt.

**Status: prompt klaar, nog niet uitgevoerd.**
