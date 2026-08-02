# Review — PD2 quick-start preset en PD3 feature-gate

Reviewdatum: 2026-08-02

## Conclusie

PD2 signaleert terecht een echte brontegenstrijdigheid en mag vóór oplossing daarvan
niet worden uitgevoerd. De voorgestelde constante bevat daarnaast nog twee
contractconflicten en een onduidelijke verantwoordelijkheid voor presetexpansie.
PD3 leest de juridische grens voor alle logo-/clubcontent correct, maar kan nog niet
worden geïmplementeerd zonder nieuwe Golf-2-ID's en een nieuwe algemene runtimeflag
tot bindend product-/protocolbeleid te verheffen.

## PD2 — Quick-start preset

### 1. Blocker — vier versus vijf spelvormen moet in de brondocumenten worden opgelost

`PRODUCT.md` noemt voor Groepsbattle expliciet vier standaardspelvormen en laat
Hoofdsteden weg. Het `GameConfiguration`-voorbeeld in `DATA-MODEL.md` toont bij
`preset: "group_battle"` vijf spelvormen inclusief `capitals_mc`. Dit kan niet door
een test of lokale implementatiekeuze worden opgelost.

De repo bevat inmiddels bovendien een derde feitelijke stem:
`client/flow/host-setup-state.mjs` gebruikt al de vier PRODUCT-spelvormen. Dat maakt
de keuze niet automatisch correct; het laat vooral zien dat de tegenstrijdigheid al
in uitvoerbare code is terechtgekomen.

**Voorstel:** kies expliciet vier of vijf en wijzig daarna in één gecoördineerde
actie `PRODUCT.md`, `DATA-MODEL.md`, het host-setup-contract, PD2 en de relevante
tests. Mijn inhoudelijke voorkeur is vier, omdat dat de expliciete presetlijst uit
`PRODUCT.md` volgt; bevestiging blijft nodig.

### 2. Blocker — `presetId` wijkt af van het bestaande contractveld `preset`

PD2 zegt dat de veldnamen op `GameConfiguration` zijn afgestemd, maar stelt
`presetId` voor. Zowel `DATA-MODEL.md`, `PROTOCOL.md` als de bestaande
`host-setup-state.mjs` gebruiken `preset: "group_battle"`. Een object met `presetId`
kan niet zonder mapper als config of create-request worden gebruikt.

**Voorstel:** gebruik `preset` als dit object een `GameConfiguration`-subset is. Als
`presetId` bewust productmetadata is, geef het object dan een ander type/naam en
definieer expliciet de mapper naar `config.preset`. Doe niet beide impliciet.

### 3. Blocker — `language: "browser_detected"` is geen geldige kamertaal

`PRODUCT.md` beschrijft browsertaal als selectiestrategie. `DATA-MODEL.md` en het
protocol verwachten uiteindelijk een concrete voertaal zoals `nl`, `en` of `es`.
De sentinel `browser_detected` staat niet in het bevestigde wire-/configvocabulaire
en zou vrije-stringvalidatie doorbreken.

**Voorstel:** scheid strategie van resultaat. Bijvoorbeeld:

- product-/UI-metadata: `languageStrategy: "browser"`; of
- een factory `createQuickStartConfig(resolvedLanguage)` die na browserdetectie een
  concrete ondersteunde taal ontvangt.

Stuur of persisteer nooit `browser_detected` als `GameConfiguration.language` tenzij
het schema en protocol daar expliciet voor worden gewijzigd.

### 4. Hoog — het is onduidelijk of PD2 volledig config, overlay of UI-state levert

De prompt sluit timers, scoreboardfrequentie, grace, maxPlayers en metricMode uit.
Dat is verdedigbaar als de constante alleen een gedeeltelijke preset-overlay is. Een
server-authoritative quick start heeft uiteindelijk echter ook die waarden nodig.
Het protocolvoorbeeld stuurt slechts `preset` en `language`, wat juist suggereert dat
de server de preset canoniek expandeert. De bestaande host-setupmodule stuurt meer
velden mee. Er zijn dus drie mogelijke modellen:

1. server ontvangt alleen preset-ID + overrides en expandeert;
2. gedeelde module bouwt client- en server-side dezelfde volledige config;
3. client stuurt een volledige config die de server valideert.

**Voorstel:** bevestig eerst één model. Mijn voorkeur is server-side canonieke
expansie met een gedeelde pure presetfactory voor UI-preview; de server blijft dan
autoritair en client/serverdefaults kunnen niet stil uiteenlopen. Leg vast welke
velden overridebaar zijn.

### 5. Hoog — exact negen keys maakt alsnog een schema

Test 2 eist exact negen properties, terwijl PD2 tegelijk stelt geen schema te bepalen.
Een exacte objectshape die door client en server wordt geladen is feitelijk een
intern contract. Het ontbreken van timer- en limietvelden wordt daarmee net zo
bindend als de aanwezige waarden.

**Voorstel:** test waarden en afwezigheid van bewust verboden velden alleen nadat de
rol van het object uit bevinding 4 is vastgesteld. Voor een overlay is een exacte
keyset prima, maar noem en review hem dan expliciet als `QuickStartPresetOverlay`.

### 6. Middel — PD2 mag niet conditioneel van uitvoeringsvolgorde afhangen

Test 3 importeert de Golf-1-lijst uit PD3 "als PD3 al bestaat" en gebruikt anders een
andere bron. Daardoor kan dezelfde PD2-prompt afhankelijk van uitvoeringsvolgorde een
ander testcontract krijgen.

**Voorstel:** bevestig eerst één canoniek game-type-register en importeer dat altijd,
of houd PD2 zelfstandig met een vaste, in de prompt bevestigde verwachting. Geen
conditionele testarchitectuur.

### 7. Middel — de bestaande host-setupdefault moet worden gede-dupliceerd

`client/flow/host-setup-state.mjs` bevat al `GROEPSBATTLE_CONFIG` met de vier
spelvormen en overige defaults. Als PD2 daarnaast een tweede constante toevoegt,
ontstaat precies de defaultdrift die `shared/product/` moest voorkomen.

**Voorstel:** laat host-setup na bevestiging de gedeelde presetfactory importeren, of
verwijder de nieuwe runtimeconstante als host-setup bewust eigenaar blijft. Houd één
bron voor defaults en aparte tests voor de mapping naar request/UI-state.

## PD3 — Feature-gate

### 8. Blocker — de Golf-2-ID's zijn nieuwe schema-/protocolkeuzes

`typed_input`, `logo_quiz`, `football_logos` en `logo_real_or_fake` staan niet als
canonieke IDs in de specificatie. De prompt erkent dit, maar wil ze vervolgens wel
exporteren en exact testen. Vooral `typed_input` voegt vlaggen- en hoofdstedeninvoer
samen tot één gameType, terwijl elders al het voorlopige voorbeeld
`typed_capitals` voorkomt. Eén of twee typed gameTypes heeft gevolgen voor
vraagselectie, validators, analytics en roomconfig.

**Voorstel:** laat de DATA-MODEL-/PROTOCOL-/GAME-RULES-eigenaren eerst het gesloten
game-type-register bevestigen. PD3 kan tot die tijd een beleidsmatrix met menselijke
namen leveren, maar geen runtime-ID's exporteren.

### 9. Hoog — `golf2Enabled` staat niet als runtimefeatureflag in de bron

`PRODUCT.md` maakt een fasering Golf 1/Golf 2. Dat betekent niet automatisch dat er
een boolean `golf2Enabled` in runtimeconfig of deploymentflags bestaat. Golf 2 kan
ook simpelweg een latere release of een lijst servercapabilities zijn. De expliciete
server-side featureflag in de bronnen betreft logo-/clubcontent.

**Voorstel:** bevestig of Golf 2 een releasefase, servercapability of runtimeflag is.
Als er geen runtimeflag nodig is, laat `availableGameTypes()` een bevestigde
servercapabilitylijst filteren in plaats van zelf productfasering als boolean te
modelleren.

### 10. Hoog — de brede juridische logoflag is correct, de precieze flagvorm niet

De inhoudelijke lezing klopt: `GAME-RULES.md` noemt Logo Quiz, Voetballogo's en
Logo: Echt of Nep? gezamenlijk achter een server-side featureflag. Alleen
`logo_real_or_fake` afschermen zou te smal zijn.

Niet vastgelegd zijn echter de naam `logoContentEnabled`, de opslagplaats, of merk-
en clublogo's samen één vrijgave krijgen. Mogelijk vereisen brandlogo's en clublogo's
verschillende juridische besluiten.

**Voorstel:** behoud `LOGO_GAME_TYPES` als beleidsclassificatie nadat de IDs zijn
bevestigd. Behandel één gezamenlijke boolean als voorstel voor juridische/product-
review, niet als directe transcriptie. Werk ook de verouderde PD3-omschrijving in
`docs/product-plan/README.md` bij; die noemt nog `logoRealOrFakeEnabled` en alleen
item 9.

### 11. Hoog — geëxporteerde arrays zijn mutabel

`availableGameTypes()` retourneert terecht een nieuwe array, maar de drie constants
zelf worden als gewone arrays geëxporteerd. Een consumer kan
`GOLF_1_GAME_TYPES.push(...)` uitvoeren en daarmee latere resultaten veranderen.
Test 10 muteert alleen de returnwaarde en bewijst deze grens niet.

**Voorstel:** gebruik intern frozen arrays en exporteer frozen/read-only waarden of
kopieën. Voeg tests toe die directe mutatie van de geëxporteerde registries niet
mogelijk maken en die bewijzen dat geen referentie tussen registries wordt gedeeld.

### 12. Middel — het flagscontract is half strikt

`null` en niet-booleans worden afgewezen, maar arrays en objecten met onbekende
velden worden geaccepteerd. Dat kan bewust tolerant zijn, maar is niet vastgelegd.
Daarnaast betekent `logoContentEnabled: true` zonder Golf 2 stil "geen effect";
dat kan een geldige combinatie zijn of een configuratiefout die zichtbaar hoort te
worden.

**Voorstel:** kies expliciet tolerant of strikt gedrag. Voor interne configuratie
heeft fail-loud op incompatibele vlagcombinaties en onbekende keys mijn voorkeur;
voor een capabilityfilter kan tolerant negeren beter zijn. Test arrays, onbekende
velden en de afhankelijke-vlagcombinatie volgens die keuze.

### 13. Middel — beschikbaarheid kent mogelijk meer dan twee dimensies

De host kiest één spelvorm of een mix, maar beschikbaarheid kan tevens afhangen van
contentVersion, rendererVersion, taal/difficulty, aanwezige content en juridische
vrijgave. PD3 presenteert twee booleans als volledige waarheid over beschikbaarheid.

**Voorstel:** noem de functie specifieker, bijvoorbeeld
`gameTypesAllowedByReleasePolicy()`, of laat haar één beleidsfilter zijn binnen een
latere capabilitypipeline. Claim niet dat het resultaat zonder verdere checks alle
daadwerkelijk beschikbare spelvormen bevat.

## Wat al goed staat

- PD2 stopt terecht bij de vier-versus-vijf-tegenstrijdigheid.
- De expliciete PRODUCT-presetlijst is inhoudelijk sterker dan een toevallige
  voorbeeldconfiguratie, al blijft gecoördineerde bevestiging nodig.
- PD2 voegt geen timers of gracewaarden toe die niet in de presetsectie staan.
- PD3 begrijpt correct dat alle merk- en clublogospelvormen juridische vrijgave
  vereisen.
- `typed_input` wordt terecht niet onder de logovrijgave geschaard.
- PD3 houdt transport en opslag van flags buiten scope.
- Beide prompts gebruiken expliciete testbestanden en het bevestigde ESM-formaat.

## Advies vóór uitvoering

Los PD2 eerst op als één gecoördineerde presetbeslissing: vier/vijf spelvormen,
`preset` versus `presetId`, browsertaalresolutie en de eigenaar van presetexpansie.
Herbruik daarna de gedeelde bron in `host-setup-state.mjs`. Voer PD3 pas uit nadat
het canonieke Golf-2-game-type-register en de semantiek van Golf-2- en logoflags zijn
bevestigd. De brede juridische classificatie kan daarbij ongewijzigd blijven.
