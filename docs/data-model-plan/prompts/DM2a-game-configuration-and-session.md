# Prompt — DM2a: GameConfiguration & Session

Onderdeel van [`docs/data-model-plan/README.md`](../README.md), fase DM2a.
Afhankelijk van DM0 (`server/data/` bestaat). Niet afhankelijk van checkpoint 4 —
geen van beide entiteiten heeft een `contentVersion`/`rendererVersion`-veld.

## Context — de letterlijke bron

`docs/multiplayer/DATA-MODEL.md`, secties "GameConfiguration" en "Session":

```json
// GameConfiguration
{
  "preset": "group_battle",
  "gameTypes": ["flags_mc", "capitals_mc", "real_or_fake_flag", "higher_lower", "odd_one_out"],
  "language": "nl",
  "difficulty": "normal",
  "totalRounds": 10,
  "questionSeconds": 15,
  "resultSeconds": 5,
  "scoreboardSeconds": 4,
  "scoreboardFrequency": "every_round",
  "pacing": "auto",
  "speedBonus": true,
  "deadlineGraceMs": 150,
  "mode": "individual",
  "teamNames": [],
  "metricMode": "mixed",
  "maxPlayers": 100,
  "allowLateJoin": true
}
```

```json
// Session
{
  "id": "sess_01J...",
  "roomId": "room_01J...",
  "roles": ["host", "player"],
  "playerId": "p_8f42d1",
  "tokenHash": "sha256:...",
  "createdAt": 1785620000000,
  "lastSeenAt": 1785623412000,
  "connectedSocketIds": ["socket_..."],
  "revoked": false
}
```

`DATA-MODEL.md` zelf: *"Enums worden in implementatie en protocolschema gedeeld;
vrije strings zijn niet toegestaan."* — dat is een eis dát er gesloten enums moeten
komen, geen volledige lijst (`REVIEW.md` bevinding 2). Onderscheid per veld hieronder.

**Herzien na [`REVIEW-DM2-DM9.md`](REVIEW-DM2-DM9.md).** Drie correcties t.o.v. de
vorige versie van dit bestand: `gameTypes` wordt nu een échte gesloten enum
(bevinding 7 — "vrije strings zijn niet toegestaan" staat er niet voor niets),
`pacing` wordt lokaal getranscribeerd i.p.v. geïmporteerd uit
`server/architecture/state-machine.js` (bevinding 10, zie ook DM2b/DM3 en het
nieuwe `HANDOFF.md`-punt over een neutrale gedeelde-constantsmodule), en
`tokenHash` valideert niet langer een `"sha256:"`-prefix (bevinding 8).

## Stappen

### 1. `server/data/types/game-configuration.js`

JSDoc-`@typedef GameConfiguration` met alle 16 velden, plus een lichte
`assertGameConfigurationShape(value)` die **alleen** controleert:
- aanwezigheid en primitief type per veld (string/number/boolean/array);
- drie velden die over meerdere brondocumenten heen daadwerkelijk gesloten zijn
  (niet zomaar het ene voorbeeld uit `DATA-MODEL.md`) — `language`, `mode`,
  `gameTypes` — plus `preset`, dat juist NIET gesloten is (zie hieronder), en
  `pacing`, apart behandeld direct hierna omdat de bron ervan anders ligt:
  - `language`: `"nl" | "en" | "es"` — `PRODUCT.md` §Talen: "Nederlands, Engels en
    Spaans", drie waarden, geen andere genoemd;
  - `mode`: `"individual" | "teams"` — `PRODUCT.md` preset ("modus: individueel"),
    `GAME-FLOW.md` ("individueel of teams"), geen derde waarde ergens genoemd;
  - `gameTypes` (elementen van de array): **echte gesloten enum**, exact
    `"flags_mc" | "capitals_mc" | "real_or_fake_flag" | "higher_lower" |
    "odd_one_out"` — letterlijk deze vijf, cross-bevestigd door `PRODUCT.md`
    §Spelvormen "Golf 1" en `GAME-RULES.md` §Spelvormen. **Correctie t.o.v. de
    vorige versie:** die liet ook onbekende toekomstige strings door
    ("voorbereid op Golf 2"), maar dat botst rechtstreeks met `DATA-MODEL.md`'s
    eigen eis dat vrije strings niet toegestaan zijn (`REVIEW-DM2-DM9.md`
    bevinding 7). Golf-2-waarden (`logo_quiz`, `real_or_fake_logo`,
    football-logo's, `typed_*`-varianten) staan achter een featureflag
    (`PRODUCT.md`) en zijn hier dus gewoon **niet toegestaan** totdat die vlag
    omgaat — op dat moment is uitbreiden van deze enum een kleine, geïsoleerde
    wijziging aan dit ene bestand, geen `database_schema`-ADR (het is een
    letterlijke transcriptie van al bestaande spec-tekst, niet een nieuw
    ontwerp);
  - `preset`: alleen `"group_battle"` is ooit genoemd (`PRODUCT.md` §Standaard
    quick-start preset). Andere presets zijn niet uitgesloten door de tekst ("De
    eerste launchversie bevat **minimaal** één preset") — dus geen gesloten enum,
    wel een test die het gegeven voorbeeld accepteert.
- **`pacing`: gesloten enum, `"auto" | "host"`, maar LOKAAL getranscribeerd, niet
  geïmporteerd.** `server/architecture/state-machine.js` gebruikt intern dezelfde
  twee waarden (`PACING.AUTO`/`PACING.HOST`), maar exporteert die constante niet
  — en zelfs als hij dat wel deed, zou `server/data/` niet het hele
  `state-machine.js`-bestand moeten importeren alleen voor twee stringwaarden:
  dat bestand bevat een gedragslaag (`transition()`, een reducer met
  bijbehorende invarianten), geen neutrale constantsmodule, en `server/data` →
  `server/architecture` is de verkeerde afhankelijkheidsrichting zodra
  `architecture` ooit zelf een repository gaat gebruiken (`REVIEW-DM2-DM9.md`
  bevinding 10). Definieer daarom hier een eigen, lokale
  `const PACING_VALUES = Object.freeze(['auto', 'host'])`, met een commentaarregel
  die letterlijk verwijst naar `server/architecture/state-machine.js` als de
  bron-van-waarheid en het risico op divergentie benoemt. Zie ook het nieuwe
  punt in `HANDOFF.md` dat een neutrale gedeelde-constantsmodule voorstelt —
  zodra die bestaat, vervangt een latere, kleine wijziging deze lokale kopie
  door een import.
- **NIET afgedwongen als gesloten enum** (categorie (c), expliciet in commentaar
  benoemd, niet stilzwijgend genegeerd): `difficulty` (alleen "normal" als
  voorbeeld, geen volledige lijst ergens), `scoreboardFrequency` (`GAME-RULES.md`
  §Rondestructuur noemt in proza "elke ronde / periodiek / uit", maar niet de
  letterlijke string-identifiers — is "periodiek" het exacte enum-lid, of iets
  anders? niet te weten), `metricMode` (`"mixed"` als voorbeeld, `GAME-RULES.md`
  noemt "inwoners, oppervlakte, BBP" en "mix" in proza, geen letterlijke
  identifiers voor de losse metrieken).
- Verplicht/optioneel: alle 16 velden zijn in het voorbeeld aanwezig (geen enkel
  veld toont `null` of ontbreekt) — behandel ze dus als verplicht totdat een ADR/
  voorstel anders zegt; `teamNames` mag een lege array zijn (`[]` staat letterlijk
  in het voorbeeld).

### 2. `server/data/types/session.js`

Zelfde aanpak. `roles` is een array met elementen uit `"host" | "player"` — dat IS
een gesloten enum: `PRODUCT.md` §Rollen kent alleen deze twee rollen, en
`DATA-MODEL.md`'s eigen twee voorbeelden (`["host","player"]` en `["host"]`, met
`playerId: null`) bevestigen het.

`tokenHash`: **alleen een niet-lege string, geen prefixcheck.** Het voorbeeld in
`DATA-MODEL.md` toont `"sha256:..."`, maar dat is één illustratieve waarde, geen
formaatgarantie — het hashalgoritme zelf is checkpoint 10 (`auth`, ADR-plichtig).
Een validator die specifiek `"sha256:"` afdwingt legt die nog niet genomen
beslissing feitelijk al vast (`REVIEW-DM2-DM9.md` bevinding 8). Test daarom
alleen "niet-lege string", en test expliciet dat een string ZONDER die prefix
ook slaagt (dezelfde discipline als bij de andere bewust-open velden hierboven —
een test die vastlegt dat het bewust open is, niet vergeten).

`playerId` is `string | null` (host-only sessie heeft `null`, expliciet in de
spec).

### 3. Tests

`game-configuration.test.js`, `session.test.js`:
- de twee voorbeeld-JSON's uit `DATA-MODEL.md` hierboven komen door de shape-check;
- elk verplicht veld laat de check falen bij afwezigheid;
- de wél-gesloten enums (`language`, `mode`, `gameTypes`-Golf1-waarden, `pacing`,
  `roles`) falen op een willekeurige ongeldige waarde;
- `gameTypes` faalt specifiek ook op een plausibele-maar-niet-Golf-1-waarde
  (bijv. `"logo_quiz"`) — regressietest voor bevinding 7, zodat dit niet weer
  stilzwijgend een open string wordt;
- de bewust-open velden (`difficulty`, `scoreboardFrequency`, `metricMode`) falen
  **niet** op een andere string dan het voorbeeld — een test die dat expliciet
  vastlegt (bijv. `difficulty: "expert"` moet slagen), zodat een toekomstige
  contributor niet per ongeluk alsnog een gesloten enum toevoegt zonder de
  onderliggende vraag op te lossen;
- `tokenHash` slaagt op het voorbeeld ÉN op een string zonder `"sha256:"`-prefix
  (regressietest voor bevinding 8 — bewijst dat dit bewust geen prefixcheck is);
- `playerId: null` slaagt voor Session (host-only geval).

## Harde grenzen

- Geen dependency, geen `package.json`-wijziging.
- Geen enum-afdwinging op velden die hierboven als open zijn aangemerkt.
- Geen hashing-implementatie, geen tokengeneratie — alleen vormcontrole.
- 4 bestanden (2 modules + 2 tests) — past ruim binnen de 15-bestanden-grens.

## Definition of done

- `assertGameConfigurationShape`/`assertSessionShape` accepteren de letterlijke
  spec-voorbeelden en falen op ontbrekende verplichte velden.
- Alleen de vijf hierboven genoemde velden (`language`, `mode`,
  `gameTypes`-Golf1-elementen, `pacing`, `roles`) hebben een gesloten-enum-check;
  een test bewijst expliciet dat de overige open velden dat niet hebben.
- `node --test 'server/data/**/*.test.js'` slaagt, inclusief de bestaande DM1-tests.

**Status: uitgevoerd.** `server/data/types/game-configuration.js` en
`server/data/types/session.js` + bijbehorende testbestanden staan er. 44/44
tests groen (`node --test server/data/types/game-configuration.test.js
server/data/types/session.test.js`). `gameTypes` is een echte gesloten enum
(Golf 1-only), `pacing` lokaal getranscribeerd, `tokenHash` zonder prefixcheck —
alle drie zoals gecorrigeerd na `REVIEW-DM2-DM9.md`.
