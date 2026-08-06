# Prompt — T4-3: Vraagtekst + de `GEEN ANTWOORD`-staat

**Status: uitgevoerd, herontworpen t.o.v. de oorspronkelijke versie** ná
reviewfeedback. Onderdeel van [`../PROGRESS.md`](../PROGRESS.md), thema 4.

## Wat er mis was met de oorspronkelijke versie

Het eerste voorstel leidde "geen antwoord" af met
`selfNoAnswer: model.answerStatus === 'idle'` — puur lokale schermstate.
Terechte kritiek: na een reconnect/reload bleef `roundModel` op
`initialRoundModel()` staan terwijl de server allang een actieve ronde had,
en soms al een geaccepteerd antwoord. `answerStatus` was dan altijd `'idle'`,
ook als er wél was geantwoord — precies het omgekeerde van server-autoritatief
gedrag dat elders in dit bestand (goed/fout, punten) wél de regel is.

## De fix: hydratatie, geen protocolwijziging

De snapshot bevat al server-autoritatieve informatie die nergens werd
gebruikt: `self.answeredCurrentRound` (`PROTOCOL.md`, ook al aanwezig in
`match-lifecycle.mjs` en `transport-mock.mjs`) én het **volledige**
`currentRound`-object (vraag, `startsAt`/`endsAt`) — niet alleen de
antwoordstatus dus, ook de vraag zelf ontbrak tot nu toe na een reload.

`views/round-model.mjs`:

```js
export function hydrateFromSnapshot(currentRoundPayload, answeredCurrentRound) {
  if (currentRoundPayload === null || typeof currentRoundPayload !== 'object' || currentRoundPayload.roundId == null) {
    return initialRoundModel();
  }
  const started = applyRoundStarted(currentRoundPayload);
  return answeredCurrentRound === true ? { ...started, answerStatus: 'accepted' } : started;
}
```

`session-shell.mjs`'s `applyRoomState()` roept dit nu aan bij élke
`room:state` (die komt alleen bij de eerste verbinding en ná een reconnect
binnen, nooit tussendoor). Geen protocolwijziging, geen nieuw serverveld —
alleen bestaande data eindelijk gebruikt.

`applyRoundEnded`'s `selfNoAnswer` is preciezer dan "was het `idle`":

```js
const selfNoAnswer =
  model.answerStatus === 'idle' ||
  (model.answerStatus === 'rejected' && model.rejectionCode === 'DEADLINE_PASSED');
```

`ALREADY_ANSWERED`-afwijzingen tellen dus terecht **niet** als "geen
antwoord" (er staat al een eerder antwoord), `DEADLINE_PASSED` wel. Het
resterende grijze gebied (`sending` — ack onderweg kwijtgeraakt, geen
snapshot ertussen) is klein en eerlijk benoemd in de code-comment, niet
weggepoetst.

## Resultaatstempel-set (reviewfeedback punt 4)

`09` §9 schrijft `JUIST`/`ONJUIST`/`GEEN ANTWOORD` voor als één
gelijkwaardige set. Nieuwe sleutels (nl/en/es):
`game.resultCorrect`/`game.resultIncorrect`/`game.resultNoAnswer`
(vervangen `game.youWereRight`/`game.youWereWrong`, die zijn verwijderd, niet
als dode sleutel achtergelaten). Hoofdletters komen van CSS
(`.gameplay-own { text-transform: uppercase }`), niet van de vertaalwaarde —
beter lokaliseerbaar.

## Vraagtekst

Ongewijzigd t.o.v. het oorspronkelijke voorstel, dat al goed was bevonden:
nieuwe sleutel `game.questionPrompt` ("Welke vlag is dit?"), zichtbaar zolang
`displayState(model) !== 'empty'`, uitsluitend `flags_mc`-specifiek — geen
generieke vraagtekst-laag voor spelvormen die nog niet bestaan.

## Definition of done — behaald

- `round-model.test.mjs`: 12/12 groen, incl. vier nieuwe tests voor
  `hydrateFromSnapshot` en de `selfNoAnswer`-onderscheiding
  (idle/DEADLINE_PASSED → true; ALREADY_ANSWERED/accepted → false).
- Handmatig tegen `transport-mock.mjs` (directe testharnas,
  `createSessionShell` + `createMockTransport()`, buiten `app.mjs`/de echte
  transportlaag om): een ronde zonder te antwoorden toont "Geen antwoord"
  (klasse `is-noanswer`); een fout antwoord toont "Onjuist" — nooit "Geen
  antwoord" voor een echt (fout) antwoord.
- `node --test` (372 tests) groen.
- `PROGRESS.md` §7 (vraagtekst) en §9 (resultaatstempel, geen-antwoord-staat)
  naar niveau 1–2.
