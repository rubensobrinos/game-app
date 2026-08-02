# Prompt — DM3: Player, Match, Round, Answer, RoomPresentation

Onderdeel van [`docs/data-model-plan/README.md`](../README.md), fase DM3.
Afhankelijk van DM2a (`assertGameConfigurationShape`, `GOLF_1_GAME_TYPES`) en
DM2b (dezelfde traceability-aanpak; **niet** een importafhankelijkheid — zie
hieronder). Vijf entiteiten in één actie: 5 modules + 5 tests + 1 gedeeld
hulpbestand = 11 bestanden, past binnen de 15-bestanden-grens (zie `README.md`
Uitgangspunt 5) — geen DM3a/b/c-opsplitsing meer nodig.

**Herzien na [`REVIEW-DM2-DM9.md`](REVIEW-DM2-DM9.md).** Drie correcties:
1. `Match.phase`/`pausedState` worden **lokaal getranscribeerd**, niet
   geïmporteerd uit `server/architecture/state-machine.js` (bevinding 10 —
   zelfde fix als DM2a's `pacing` en DM2b's `RoomCore.phase`; dat bestand is een
   gedragslaag, geen neutrale constantsmodule, en `server/data →
   server/architecture` is de verkeerde richting).
2. `Round` krijgt twee nieuwe, optionele velden — `validOptionIds` en
   `resultDetails` — omdat de intussen herziene `GR4-question-selection.md`
   (`game-rules-plan`) een `SelectedQuestion`-vorm definieert die dit al
   letterlijk zo aanlevert (bevinding 6: de vorige versie van dit bestand nam
   ten onrechte aan dat `validOptionIds` uit
   `publicQuestionPayload.options[].optionId` kwam — dat bestaat niet in de
   echte GR4-output).
3. `toActiveRoundSnapshot()` controleert nu dat `round.status === 'ACTIVE'` is
   (bevinding 15), en sluit ook `resultDetails`/`validOptionIds` uit van de
   output.

Drie van de vijf entiteiten hebben een interpretatievraag die al beantwoord is in
[`HANDOFF.md`](../HANDOFF.md) — dit is precies het moment waarop die antwoorden
landen. Zie per entiteit hieronder.

## 0. Gedeeld: `server/data/types/game-types.js`

Vóór de vijf entiteiten: één bestand met de Golf 1-`gameType`-enum, zodat
`GameConfiguration.gameTypes` (DM2a) en `Round.gameType` (hieronder) niet elk hun
eigen lijst bijhouden.

```js
const GOLF_1_GAME_TYPES = Object.freeze([
  'flags_mc', 'capitals_mc', 'real_or_fake_flag', 'higher_lower', 'odd_one_out',
]);
```

`assertGameConfigurationShape` (DM2a) importeert dit i.p.v. een eigen lijst — dat
is een kleine, geïsoleerde wijziging aan een net gebouwd bestand, geen probleem
zolang DM2a en DM3 in dezelfde reeks acties landen.

## 1. Player — interpretatie beantwoord in `HANDOFF.md` §3

```json
{
  "id": "p_8f42d1", "roomId": "room_01J...", "sessionId": "sess_01J...",
  "displayName": null, "generatedName": "Vlugge Vos", "effectiveName": "Vlugge Vos",
  "nameSource": "generated", "teamId": null, "score": 4200, "correctCount": 12,
  "correctResponseTimeMsTotal": 56420, "connected": true, "eligibleFromRound": 1,
  "joinedAt": 1785620100000, "left": false, "kicked": false
}
```

`server/data/types/player.js` + `assertPlayerShape`:
- `id`, `roomId`, `sessionId`: niet-lege strings.
- `displayName`: `string | null` (letterlijk: "kan `null` zijn").
- `generatedName`, `effectiveName`: niet-lege strings ("`effectiveName` is altijd
  gevuld" — letterlijk).
- `nameSource`: **niet** als gesloten enum af te dwingen — alleen `"generated"` is
  ooit als letterlijke waarde getoond. De tegenhanger voor een zelfgekozen naam
  heeft geen bevestigde string (`"chosen"`? `"user"`? niet gegeven). Shape-check
  eist een niet-lege string, geen vaste lijst; commentaar benoemt dit expliciet als
  open, niet als vergeten.
- `teamId`: `string | null`.
- `score`, `correctCount`, `correctResponseTimeMsTotal`: **niet-negatieve
  integers** — dit is geen eigen interpretatie meer, `server/rules/standings.js`'s
  `assertNonNegativeInteger` (via `assertValidPlayerForRanking`) eist dit al
  keihard van elke aanroeper. Zelfde grens hier overnemen, niet losser maken.
- `connected`, `left`, `kicked`: booleans.
- `eligibleFromRound`: integer `>= 1`.
- `joinedAt`: eindig, niet-negatief getal (epoch-ms).

**Niet in deze fase:** de rematch-resetlogica uit `HANDOFF.md` §3 (welke velden
`game:rematch` wel/niet terugzet) is een `repository`-/`answer-flow`-aangelegenheid
(DM6/DM7), geen eigenschap van de typedef zelf. Hier alleen de vorm.

## 2. Match — interpretatie beantwoord in `HANDOFF.md` §2

```json
{
  "id": "match_01J...", "roomId": "room_01J...", "sequence": 2,
  "phase": "ROUND_ACTIVE", "startedAt": 1785623000000, "finishedAt": null,
  "roundIndex": 6, "roundIds": ["round_01", "round_02"],
  "usedQuestionKeys": ["flags:jp"], "previousMatchQuestionKeys": ["flags:br"],
  "pausedState": null
}
```

`server/data/types/match.js` + `assertMatchShape`:
- `id`, `roomId`: niet-lege strings.
- `sequence`: integer `>= 1`.
- `phase` + `pausedState`: **lokaal getranscribeerd**, dezelfde vorm als
  `server/architecture/state-machine.js`'s interne `MatchState`
  (`PHASES`-export, en `{ previousPhase, remainingMs, reason, pausedAt }` voor
  `pausedState`) maar **niet geïmporteerd** — zelfde reden als DM2a/DM2b:
  `state-machine.js` is een gedragslaag (`transition()`-reducer), geen neutrale
  constantsmodule.
  ```js
  // Bron: server/architecture/state-machine.js (ARCHITECTURE.md §State
  // machine). Lokale kopie, zie DM2b's ROOM_PHASE_VALUES voor dezelfde afweging
  // en HANDOFF.md voor het voorstel van een neutrale gedeelde module.
  const MATCH_PHASE_VALUES = Object.freeze([
    'LOBBY', 'COUNTDOWN', 'ROUND_ACTIVE', 'ROUND_RESULT', 'SCOREBOARD',
    'PAUSED', 'FINISHED',
  ]);
  ```
  `pausedState` is `null`, of `{ previousPhase: string (uit
  MATCH_PHASE_VALUES), remainingMs: niet-negatief eindig getal, reason:
  niet-lege string, pausedAt: eindig getal }` — veldnamen letterlijk gelijk aan
  `state-machine.js`'s `MatchState.pausedState`, zodat een latere overstap naar
  een echte import geen veldnamen hoeft te wijzigen.
- `startedAt`: eindig getal. `finishedAt`: `number | null`.
- `roundIndex`: **0-based**, aanname uit `HANDOFF.md` §2 ("de naam suggereert een
  array-index in `roundIds`, niet een mensgericht rondenummer") — expliciet als
  aanname in commentaar, niet als citaat. Integer `>= 0`.
- `roundIds`, `usedQuestionKeys`, `previousMatchQuestionKeys`: arrays van
  niet-lege strings (mogen leeg zijn — een verse match heeft nog geen rondes).

## 3. Round — vorm bevestigd door `HANDOFF.md` §1 én de herziene GR4-prompt

```json
{
  "id": "round_07", "matchId": "match_01J...", "gameType": "real_or_fake_flag",
  "questionKey": "rof:fx_91b2", "publicQuestionPayload": {},
  "correctAnswer": { "choice": "fake" }, "startsAt": 1785623412000,
  "endsAt": 1785623427000, "status": "ACTIVE"
}
```

`docs/game-rules-plan/prompts/GR4-question-selection.md` (na diens eigen review
herzien) levert de vraagselectie als `SelectedQuestion[]`, met twee velden die
`DATA-MODEL.md`'s Round-voorbeeld niet toont maar die wél nodig zijn om GR3's
`validateAnswer()` en de round-uitslag te voeden — **Round breidt daarom uit met
deze twee, optionele velden:**

- `validOptionIds?: string[]` — **alleen** aanwezig bij `flags_mc`/`capitals_mc`
  (GR4: "`optionIso2s`" in `publicQuestionPayload`, plus een **losse**
  `validOptionIds`-lijst die daar letterlijk gelijk aan is, maar apart wordt
  meegegeven omdat `validateAnswer()`'s `roundContext.validOptionIds` dat als
  eigen parameter verwacht — niet afgeleid uit de payload). Absent bij de
  overige drie Golf-1-typen.
- `resultDetails?: object` — **alleen** aanwezig bij `higher_lower` (GR4:
  `{ values: [{ side, value }, { side, value }] }`) en `odd_one_out` (GR4:
  `{ majorityContinent, minorityContinent }`). Bevat data die de ronde-uitslag
  nodig heeft maar die het antwoord zou verklappen als hij vóór `round:ended`
  verstuurd wordt — **zelfde geheimhoudingsregel als `correctAnswer`**
  (`PROTOCOL.md` Basisregel 4, GR4 citeert die expliciet voor dit veld). Absent
  bij `flags_mc`/`capitals_mc`/`real_or_fake_flag`.

`server/data/types/round.js` + `assertRoundShape` + `toActiveRoundSnapshot`:
- `id`, `matchId`, `questionKey`: niet-lege strings.
- `gameType`: gesloten enum, hergebruikt `GOLF_1_GAME_TYPES` uit stap 0.
- `publicQuestionPayload`: plain object, verder **opaak** — de exacte vorm is nu
  weliswaar bekend per spelvorm via GR4 (zie `SelectedQuestion` in
  `GR4-question-selection.md`), maar blijft `PROTOCOL.md`/`GAME-RULES.md`-
  eigendom; `assertRoundShape` controleert alleen dat het een plain object is,
  geen `null`/array/primitive, en dupliceert niet wat GR4 al vastlegt.
- `correctAnswer`: per-`gameType` shape-check, **nu bevestigd door zowel
  `HANDOFF.md` §1 als de herziene GR4-output** (niet langer alleen mijn eigen
  afleiding) — een losse `assertCorrectAnswerShape(gameType, correctAnswer)`-
  functie met een `switch` op `gameType`, analoog aan (maar **niet dezelfde
  functie als**) `server/rules/validators.js`'s interne validators: die
  valideren een *ingezonden antwoord* tegen `correctAnswer`; dit hier valideert
  alleen dat `correctAnswer` zélf de juiste vorm heeft:
  - `flags_mc`/`capitals_mc` → `{ optionId: string (niet leeg) }`;
  - `real_or_fake_flag` → `{ choice: "real" | "fake" }`;
  - `higher_lower` → `{ side: 0 | 1 }`;
  - `odd_one_out` → `{ cardIndex: integer >= 0 }`.
- `validOptionIds`: indien aanwezig, array van exact 4 unieke niet-lege strings
  (zelfde invariant als `validators.js`'s `assertValidOptionIds`); **verplicht**
  bij `gameType` `flags_mc`/`capitals_mc`, **moet afwezig zijn** bij de overige
  drie (test op beide richtingen).
- `resultDetails`: indien aanwezig, plain object, verder opaak (vorm per
  `gameType` is GR4-eigendom); **verplicht** bij `higher_lower`/`odd_one_out`,
  **moet afwezig zijn** bij de overige drie.
- `startsAt`, `endsAt`: eindige getallen, `endsAt > startsAt`.
- `status`: **niet** als gesloten enum — alleen `"ACTIVE"` is ooit getoond, de
  volledige levenscyclus (is er een `"ENDED"`? iets anders?) staat nergens.
  Shape-check eist een niet-lege string; test bevestigt dat `"ACTIVE"` slaagt en
  dat een andere niet-lege string óók slaagt (bewust open, zie DM2a-precedent voor
  waarom dat een aparte test verdient).

**`toActiveRoundSnapshot(round)`** (hernoemd van `toPublicRound`, `REVIEW.md`
bevinding 5) — expliciete allowlist, geen denylist en geen object-spread op de
input, **plus een statuscontrole** (`REVIEW-DM2-DM9.md` bevinding 15: de vorige
versie accepteerde elke `round.status`, ondanks de naam "Active"):

```js
function toActiveRoundSnapshot(round) {
  assertRoundShape(round);
  if (round.status !== 'ACTIVE') {
    throw new RangeError(
      `toActiveRoundSnapshot expects an ACTIVE round, got status: ${round.status}`
    );
  }
  return {
    id: round.id,
    matchId: round.matchId,
    gameType: round.gameType,
    publicQuestionPayload: round.publicQuestionPayload,
    startsAt: round.startsAt,
    endsAt: round.endsAt,
    status: round.status,
  };
}
```

Bewust **niet** in de output: `correctAnswer` en `resultDetails` (de kernregel —
mogen nooit vóór `round:ended` naar de client, `PROTOCOL.md` Basisregel 4),
`validOptionIds` (servervalidatie-detail, de client heeft er niets aan — voor
`flags_mc`/`capitals_mc` staat dezelfde informatie al publiek in
`publicQuestionPayload.optionIso2s`), en `questionKey` (intern content-lookup).
Dit is de vorm voor een *actieve* ronde; een aparte, nog niet ontworpen vorm voor
het `round:ended`-resultaat (inclusief `correctAnswer` en `resultDetails`) is
`PROTOCOL.md`-terrein, niet hier.

## 4. Answer — volledig gegeven, geen open vraag

```json
{
  "roundId": "round_07", "playerId": "p_8f42d1", "actionId": "act_01J...",
  "answer": { "choice": "fake" }, "receivedAt": 1785623418451,
  "responseTimeMs": 6451, "correct": true, "points": 158
}
```

`server/data/types/answer.js` + `assertAnswerShape`:
- `roundId`, `playerId`, `actionId`: niet-lege strings.
- `answer`: plain object, opaak (vorm hangt af van `gameType`, zie
  `validators.js`'s `extractClientField` — dat blijft `GAME-RULES.md`-terrein).
- `receivedAt`: eindig, niet-negatief getal.
- `responseTimeMs`: niet-negatieve integer.
- `correct`: boolean.
- `points`: niet-negatieve integer, `<= 200` (`GAME-RULES.md` §Puntentelling:
  "maximaal 200 punten per ronde" — dit IS letterlijk gegeven, dus wel afdwingbaar
  als grens, niet als open interpretatie).

## 5. RoomPresentation (optioneel) — volledig gegeven

```json
{
  "roomId": "room_01J...", "groupName": "Team Nachtdieren", "badgeSpec": {},
  "badgeAssetUrl": null
}
```

`server/data/types/room-presentation.js` + `assertRoomPresentationShape`:
`roomId`/`groupName`: niet-lege strings; `badgeSpec`: plain object, opaak;
`badgeAssetUrl`: `string | null`. Laagste testprioriteit van de vijf — `PRODUCT.md`
merkt dit expliciet als latere uitbreiding aan.

## Testplan

Per entiteit: het letterlijke spec-voorbeeld slaagt, elk verplicht veld faalt
losstaand bij afwezigheid, elke wél-gesloten enum faalt op een ongeldige waarde,
elke bewust-open enum (`nameSource`, `Round.status`) slaagt expliciet op een
niet-voorbeeldwaarde. Specifiek voor `Round`/`toActiveRoundSnapshot`:
- `assertCorrectAnswerShape` slaagt op alle vijf tabelvormen, faalt op elk van de
  andere vier vormen toegepast op de verkeerde `gameType`;
- `validOptionIds` verplicht-en-4-uniek-niet-leeg bij `flags_mc`/`capitals_mc`,
  moet-afwezig-zijn bij de overige drie (beide richtingen getest);
- `resultDetails` verplicht-aanwezig bij `higher_lower`/`odd_one_out`,
  moet-afwezig-zijn bij de overige drie (beide richtingen getest);
- `toActiveRoundSnapshot()` werpt op elke `status` behalve `"ACTIVE"`
  (regressietest voor bevinding 15);
- `toActiveRoundSnapshot()` bevat nooit `correctAnswer`, `resultDetails`,
  `validOptionIds` of `questionKey`, ook niet wanneer `round` extra/onbekende
  velden heeft (test: voeg een willekeurig extra veld toe aan de input, bevestig
  dat het niet in de output verschijnt — bewijst dat de functie een allowlist
  is, geen spread-minus-geheime-velden).

Voor `Match.phase`/`RoomCore.phase`: één test die bevestigt dat `MATCH_PHASE_VALUES`
(dit bestand) en DM2b's `ROOM_PHASE_VALUES` exact dezelfde zeven waarden bevatten
— de twee lokale transcripties mogen niet uit elkaar lopen, ook al importeren ze
niet van elkaar.

## Harde grenzen

- Geen implementatie van de rematch-resetlogica (`HANDOFF.md` §3) — dat is DM6/DM7.
- Geen `require('../architecture/state-machine')` — `phase`/`pausedState` worden
  lokaal getranscribeerd (zie hierboven).
- Geen validatielogica die hoort te dupliceren wat `server/rules/validators.js`
  al doet (antwoord-tegen-correctAnswer-vergelijking) — hier alleen vormcontrole
  van `correctAnswer` zelf.
- Geen volledige uitwerking van `publicQuestionPayload`'s interne vorm — dat
  blijft GR4/PROTOCOL.md-eigendom, hier alleen "is het een plain object".
- 12 bestanden (1 gedeeld + 5 modules + 5 tests + 1 wijziging aan DM2a) — binnen de
  15-bestanden-grens.

## Definition of done

- Alle vijf shape-checks + `toActiveRoundSnapshot` gebouwd en getest.
- `Round.gameType` en `GameConfiguration.gameTypes` delen `game-types.js`.
- `Round` accepteert `validOptionIds`/`resultDetails` exact volgens de
  per-`gameType`-verplichting hierboven (beide richtingen getest).
- `MATCH_PHASE_VALUES` (dit bestand) en `ROOM_PHASE_VALUES` (DM2b) zijn
  aantoonbaar identiek (test).
- `toActiveRoundSnapshot()` werpt op een niet-`ACTIVE` ronde en heeft een
  allowlist-regressietest tegen velden-lekkage (`correctAnswer`,
  `resultDetails`, `validOptionIds`, `questionKey`).
- `node --test 'server/data/**/*.test.js'` slaagt, inclusief alle eerdere DM-tests.

**Status: uitgevoerd.** `server/data/types/game-types.js` (gedeeld),
`player.js`, `match.js`, `round.js` (incl. `toActiveRoundSnapshot`),
`answer.js`, `room-presentation.js` + bijbehorende tests staan er, plus een
kleine, additieve wijziging aan DM2a's `game-configuration.js` (importeert nu
`GOLF_1_GAME_TYPES` uit `game-types.js` i.p.v. een eigen kopie). Volledige
`server/data/`-testsuite: 397/397 groen (`node --test
'server/data/**/*.test.js'`). De cross-bestand-consistentietest tussen
`MATCH_PHASE_VALUES` en DM2b's `ROOM_PHASE_VALUES` staat in `match.test.js` en
slaagt.

**Bijgewerkt na `docs/multiplayer/DECISIONS.md` #21** (bevestigd door de
producteigenaar, ná deze fase geschreven): `contentVersion`/`rendererVersion`
zijn canoniek op `Match`, niet Room — dit lost checkpoint 4 op. `match.js`
heeft die twee velden nu; `toActiveRoundSnapshot(round, match)` neemt sinds
deze correctie ook `match` aan en neemt de twee velden mee in de output
("roundpayloads dragen ze mee voor clients"), met een guard dat `match.id`
overeenkomt met `round.matchId`. 402/402 tests groen na deze wijziging.
