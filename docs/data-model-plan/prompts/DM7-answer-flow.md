# Prompt — DM7: Atomische antwoordverwerking (resolutielogica)

Onderdeel van [`docs/data-model-plan/README.md`](../README.md), fase DM7.
Afhankelijk van DM3 (typedefs, incl. `Round.validOptionIds`/`resultDetails`) en
DM6 (`AcceptedAnswerWrite`/`saveAcceptedAnswerAtomically`-poort). Afhankelijk van
`GAME-RULES.md`'s `scoreAnswer()` + `validateAnswer()` — **beide bestaan al en
zijn getest** (`server/rules/scoring.js`, `server/rules/validators.js`).

**Volledig herzien na [`REVIEW-DM2-DM9.md`](REVIEW-DM2-DM9.md), bevindingen 1, 2,
3 en 6 (drie Blocker, één Hoog).** Dit is de belangrijkste correctieronde van het
hele plan tot nu toe — vier afzonderlijke fouten in de vorige versie:

1. **Volgorde (bevinding 1, Blocker).** De vorige versie controleerde deadline en
   ronde vóór idempotentie. Een retry met hetzelfde `actionId` ná de deadline of
   ná een faseovergang kreeg daardoor `DEADLINE_PASSED`/`ROUND_NOT_ACTIVE` i.p.v.
   dezelfde ack als de eerste keer — een directe schending van `PROTOCOL.md`
   §Idempotentie ("zelfde actionId: zelfde ack"). **Idempotentie wordt nu als
   eerste gecontroleerd**, vóór elke andere check.
2. **Ack-lek (bevinding 2, Blocker).** De vorige versie zette `correct` en
   `points` in de directe ack. `PROTOCOL.md` Basisregel 4 verbiedt dat een
   scorebeslissing de server verlaat vóór de ronde is afgelopen; de eventtabel
   noemt voor `round:answer-accepted` alleen `roundId`. **De ack bevat nu alleen
   `{ roundId }`.**
3. **`valid: false` (bevinding 3, Blocker).** De vorige versie behandelde een
   structureel ongeldig antwoord (`validateAnswer()`'s `valid: false`) als een
   geaccepteerd fout antwoord (0 punten, wél een `Answer`-record). Dat zou een
   speler die per ongeluk een onbekende `optionId` verstuurt permanent
   blokkeren via `ALREADY_ANSWERED`, zonder dat er echt geantwoord is. **`valid:
   false` retourneert nu `INVALID_ANSWER_FORMAT`, zonder writes.**
4. **`roundContext`-bron (bevinding 6, Hoog).** De vorige versie leidde
   `validOptionIds` af uit `round.publicQuestionPayload.options[].optionId` —
   die vorm bestaat niet in de echte, herziene GR4-output. **`validOptionIds`
   komt nu rechtstreeks van `round.validOptionIds`** (DM3, zie daar).

## Context — de tien stappen, herordend

`docs/multiplayer/DATA-MODEL.md` noemt de stappen in deze volgorde: sessie/
speler, match/ronde, deadline, actionId/idempotentie, bestaand antwoord,
correctheid/punten, schrijf Answer, werk Player bij, werk scoreboard bij, bewaar
ack. **Die volgorde is hier bewust NIET de uitvoeringsvolgorde** — de
idempotentiecontrole moet vóór alle andere controles staan, anders is een
retry niet idempotent (zie boven, bevinding 1). De inhoud van elke stap blijft
ongewijzigd; alleen stap 4 (idempotentie) schuift naar voren.

`PROTOCOL.md` §Idempotentie van antwoorden: zelfde `actionId` → zelfde ack;
nieuwe `actionId` na een al geaccepteerd antwoord (zelfde of ander) →
`ALREADY_ANSWERED`; score/state veranderen nooit tweemaal.

## Ontwerp: pure resolutiefunctie, geen uitvoering

`answer-flow.js` **beslist**; het voert niets uit. `resolveAnswer(context)` geeft
terug óf een foutcode, óf de precieze schrijfacties + het ack-resultaat, die de
aanroeper via DM6's `saveAcceptedAnswerAtomically` laat uitvoeren. Dit is een
bewuste grens: deze functie kan bewijzen dat de write-set *compleet* is, niet
dat opslag ze *atomair* uitvoert — dat laatste is DM6's/de adapter's
verantwoordelijkheid ná de Lua/MULTI-ADR (checkpoint 5).

```js
/**
 * @param {{
 *   session: Session, player: Player, room: RoomCore, match: Match, round: Round,
 *   answer: unknown, actionId: string, receivedAt: number,
 *   deadlineGraceMs: number, existingAnswerForRound: Answer | null,
 *   existingActionCacheEntry: { actionId: string, ack: object } | null,
 * }} ctx
 * @returns {
 *   | { ok: false, code: string }
 *   | { ok: true, replay: true, ack: { roundId: string } }
 *   | { ok: true, replay: false, write: AcceptedAnswerWrite }
 * }
 */
function resolveAnswer(ctx) { /* ... */ }
```

`AcceptedAnswerWrite` is DM6's typedef (`{ answer, updatedPlayer,
actionCacheEntry }`) — `resolveAnswer` bouwt exact dat object, niets ernaast.

## Stappen, in uitvoeringsvolgorde, elk met de echte bron

### Stap 1 (was stap 4) — ActionId/idempotentie, EERST

Als `ctx.existingActionCacheEntry !== null` en
`ctx.existingActionCacheEntry.actionId === ctx.actionId`: retourneer
`{ ok: true, replay: true, ack: ctx.existingActionCacheEntry.ack }` en stop —
geen van de onderstaande stappen wordt uitgevoerd, ook niet als de ronde
intussen is afgelopen of de deadline is verstreken (`PROTOCOL.md`: "retourneert
dezelfde logische ack zonder de mutatie opnieuw uit te voeren"). Dit lost
bevinding 1 op: een replay ná de deadline of ná een faseovergang krijgt nu
altijd dezelfde ack als de oorspronkelijke, geslaagde aanroep.

### Stap 2 (was stap 1) — Sessie en speler

`PROTOCOL.md`-foutcodes `TOKEN_INVALID`/`SESSION_REVOKED`/`NOT_PLAYER`:
`session.revoked === false`; `session.roomId === room.id`; `session.playerId
!== null` (een host-only sessie kan niet antwoorden → `NOT_PLAYER`);
`player.kicked === false` en `player.left === false`. **Buiten scope hier:** de
daadwerkelijke `tokenHash`-vergelijking die `session` in de eerste plaats
oplevert — dat gebeurt vóór deze functie wordt aangeroepen (`auth`, checkpoint
10). Deze functie krijgt een al-geauthenticeerde `session` binnen.

### Stap 3 (was stap 2) — Match en ronde

`ROUND_NOT_ACTIVE`, `PLAYER_NOT_ELIGIBLE`: `round.matchId === match.id`;
`round.status === "ACTIVE"`; speelgerechtigdheid via `player.eligibleFromRound
<= (match.roundIndex + 1)` — gebruikt de `roundIndex`-aanname uit DM3/
`HANDOFF.md` §2 (0-based, dus `+1` voor het 1-based rondenummer waarmee
`eligibleFromRound` vergeleken wordt).

### Stap 4 (was stap 3) — Deadline

`DEADLINE_PASSED`: `isAnswerAcceptable({ receivedAt: ctx.receivedAt, endsAt:
round.endsAt, deadlineGraceMs: ctx.deadlineGraceMs })` uit
`server/rules/scoring.js` — **hergebruikt**, niet opnieuw geïmplementeerd.

### Stap 5 — Reeds bestaand antwoord

`ALREADY_ANSWERED`: als `ctx.existingAnswerForRound !== null` (en stap 1 al is
gepasseerd zonder replay-match) → `ALREADY_ANSWERED`, ongeacht of het nieuwe
antwoord hetzelfde is als het oude.

### Stap 6 — Correctheid en punten, met de `valid: false`-correctie

```js
const roundContext = buildRoundContext(round); // zie hieronder
const validation = validateAnswer(round.gameType, ctx.answer, round.correctAnswer, roundContext);
if (!validation.valid) {
  return { ok: false, code: 'INVALID_ANSWER_FORMAT' };
}
const score = scoreAnswer({
  correct: validation.correct,
  receivedAt: ctx.receivedAt,
  startsAt: round.startsAt,
  endsAt: round.endsAt,
  deadlineGraceMs: ctx.deadlineGraceMs,
  speedBonusEnabled: ctx.room.config.speedBonus,
});
```

**`valid: false` → `INVALID_ANSWER_FORMAT`, geen writes** (bevinding 3). Dit is
iets anders dan `PROTOCOL.md`'s schema-gate (die valideert of de payload
*structureel* bij het protocol past, vóór deze functie wordt aangeroepen) — GR3
valideert daarnaast ook *inhoudelijke* waarden zoals lidmaatschap van
`validOptionIds`, wat een eerdere schema-gate niet kan zien. Een algemene
schema-check vervangt deze stap dus niet.

**`buildRoundContext(round)`** — dit is de correctie voor bevinding 6:

```js
function buildRoundContext(round) {
  switch (round.gameType) {
    case 'flags_mc':
    case 'capitals_mc':
      return { validOptionIds: round.validOptionIds }; // DM3-veld, NIET publicQuestionPayload
    case 'odd_one_out':
      return { optionCount: round.publicQuestionPayload.cards.length }; // Golf 1: altijd 4
    default:
      return {};
  }
}
```

`round.validOptionIds` bestaat (DM3) alleen bij `flags_mc`/`capitals_mc` —
precies de twee `gameType`s waarvoor `validateOptionChoice` het nodig heeft.
Voor `odd_one_out` volstaat `round.publicQuestionPayload.cards.length` (GR4's
vorm), Golf 1-invariant altijd 4.

### Stappen 7–10 — De write, in één keer voor DM6

```js
return {
  ok: true,
  replay: false,
  write: {
    answer: {
      roundId: round.id,
      playerId: player.id,
      actionId: ctx.actionId,
      answer: ctx.answer,
      receivedAt: ctx.receivedAt,
      responseTimeMs: ctx.receivedAt - round.startsAt,
      correct: validation.correct,
      points: score.points,
    },
    updatedPlayer: {
      id: player.id,
      score: player.score + score.points,
      correctCount: player.correctCount + (validation.correct ? 1 : 0),
      correctResponseTimeMsTotal: accumulateCorrectResponseTime(
        player.correctResponseTimeMsTotal,
        { correct: validation.correct, responseTimeMs: ctx.receivedAt - round.startsAt }
      ),
    },
    actionCacheEntry: {
      actionId: ctx.actionId,
      ack: { roundId: round.id }, // GEEN correct/points — bevinding 2
    },
  },
};
```

`accumulateCorrectResponseTime` komt uit `scoring.js` — wéér hergebruikt, niet
opnieuw geschreven. **Let op:** stap 4 heeft de deadline al gecontroleerd, dus
`scoreAnswer`'s eigen `accepted`-veld zou hier nooit `false` mogen zijn — een
test bevestigt dat, in plaats van het stilzwijgend aan te nemen.

## Tests (`answer-flow.test.js`)

- **idempotentie eerst (regressietest bevinding 1):** een replay met hetzelfde
  `actionId` ná een gesimuleerde deadlineoverschrijding (`ctx.receivedAt` ver
  voorbij `round.endsAt + deadlineGraceMs`) EN ná een gesimuleerde
  faseovergang (`round.status !== 'ACTIVE'`) geeft alsnog `{ replay: true, ack:
  <dezelfde ack als origineel> }`, geen `DEADLINE_PASSED`/`ROUND_NOT_ACTIVE`;
- **geen scorelek (regressietest bevinding 2):** de ack van een niet-replay
  succesvolle aanroep bevat uitsluitend `{ roundId }` — een test die expliciet
  controleert dat `correct`/`points`/`bonus` NIET in `write.actionCacheEntry.ack`
  voorkomen;
- **`valid: false` (regressietest bevinding 3):** een structureel ongeldig
  antwoord (bijv. onbekende `optionId`, `cardIndex` buiten bereik als vrije
  invoer — niet de servercontext-throw-gevallen van `validators.js`) geeft
  `{ ok: false, code: 'INVALID_ANSWER_FORMAT' }`, geen `write`, en een
  vervolgpoging met een nieuwe `actionId` wordt NIET geblokkeerd door
  `ALREADY_ANSWERED` (er is immers niets geschreven);
- **`roundContext` (regressietest bevinding 6):** alle vijf Golf-1-`gameType`s
  minstens één keer, met `buildRoundContext` gevoed vanuit een representatieve
  `Round` die `validOptionIds`/`publicQuestionPayload.cards` bevat zoals DM3 ze
  nu vastlegt — geen enkele test gaat uit van
  `publicQuestionPayload.options[].optionId`;
- elk van de overige stappen (2, 3, 4, 5) heeft minstens één test die het
  bijbehorende faalpad raakt met de juiste foutcode;
- `ALREADY_ANSWERED` bij zowel identieke als afwijkende herhaalde inhoud (na
  een eerdere geslaagde, niet-replay aanroep);
- een correct, tijdig antwoord levert een `write.answer` met `correct: true` en
  `points` gelijk aan wat `scoreAnswer` voor diezelfde parameters teruggeeft
  (cross-check tegen de echte functie, geen losstaande herberekening);
  `write.updatedPlayer.score` is aantoonbaar `player.score + points` (absolute
  waarde, geen delta-object — consistent met DM6's `AcceptedAnswerWrite`).

## Harde grenzen

- Geen eigen implementatie van scoring/validatielogica — alleen aanroepen van
  `server/rules/scoring.js` en `server/rules/validators.js`.
- Geen daadwerkelijke Redis/opslag-aanroep — deze functie retourneert een
  write-beschrijving, ze voert niets uit.
- Geen `correct`/`points`/`bonus` in enige ack, ook niet in de replay-ack.
- Geen `INVALID_ANSWER_FORMAT`-afhandeling vervangen door een aanname dat een
  eerdere schema-gate dit al afvangt.
- 2 bestanden (module + test).

## Definition of done

- Idempotentiecontrole is aantoonbaar de eerste stap (test: replay slaagt ook
  ná deadline/faseovergang).
- Geen enkele ack bevat `correct`/`points`/`bonus`.
- `valid: false` geeft `INVALID_ANSWER_FORMAT` zonder write, getest.
- `buildRoundContext` gebruikt `round.validOptionIds` en
  `round.publicQuestionPayload.cards.length`, nooit
  `publicQuestionPayload.options[].optionId`.
- `write` volgt exact DM6's `AcceptedAnswerWrite`-vorm, met `updatedPlayer` als
  absolute waarden.
- Elke geretourneerde `points`/`correct`-waarde is aantoonbaar identiek aan wat
  `scoreAnswer`/`validateAnswer` zelf teruggeven.
- `node --test 'server/data/**/*.test.js'` slaagt.

**Status: prompt klaar, nog niet uitgevoerd.**
