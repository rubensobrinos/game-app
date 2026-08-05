'use strict';

// Controleert de vormcontract van tests/fixtures/index.js op twee manieren:
//
//   1. Elke factory zonder argumenten moet daadwerkelijk door de bijbehorende
//      `assert*Shape` uit server/data/types/ heen komen — INTB-8's eigen
//      voorstel. Zonder deze check kan een fixture stilzwijgend afwijken van
//      wat de validators in productie accepteren, en dan slaagt een test op
//      data die de echte store zou weigeren (precies wat INTB-8 meldde:
//      `makeRoom()` en `makeMatch()` faalden allebei op hun eigen validator).
//   2. Elke factory moet exact de veldenset uit het bijbehorende
//      DATA-MODEL.md-voorbeeld teruggeven — geen extra, geen ontbrekende
//      velden. Dit is een aparte, strengere check dan (1): `assert*Shape`
//      controleert per veld maar merkt geen onverwachte EXTRA velden op
//      (zoals de contentVersion/rendererVersion die hier ooit ten onrechte op
//      Room stonden i.p.v. op Match — DECISIONS.md #21).
//
// Waardecontroles horen niet hier: die volgen de defaults 1-op-1 uit de spec
// en zouden alleen de implementatie herhalen.

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  makeGameConfiguration,
  makeRoom,
  makeSession,
  makePlayer,
  makeMatch,
  makeRound,
  makeAnswer,
} = require('./index');

const { assertGameConfigurationShape } = require('../../server/data/types/game-configuration');
const { assertRoomShape } = require('../../server/data/types/room');
const { assertSessionShape } = require('../../server/data/types/session');
const { assertPlayerShape } = require('../../server/data/types/player');
const { assertMatchShape } = require('../../server/data/types/match');
const { assertRoundShape } = require('../../server/data/types/round');
const { assertAnswerShape } = require('../../server/data/types/answer');

/** Sorteert keys zodat volgorde in de fixture er niet toe doet. */
function keys(obj) {
  return Object.keys(obj).sort();
}

test('elke factory produceert een document dat zijn eigen assert*Shape doorstaat (INTB-8)', () => {
  assert.doesNotThrow(() => assertGameConfigurationShape(makeGameConfiguration()));
  assert.doesNotThrow(() => assertRoomShape(makeRoom()));
  assert.doesNotThrow(() => assertSessionShape(makeSession()));
  assert.doesNotThrow(() => assertPlayerShape(makePlayer()));
  assert.doesNotThrow(() => assertMatchShape(makeMatch()));
  assert.doesNotThrow(() => assertRoundShape(makeRound()));
  assert.doesNotThrow(() => assertAnswerShape(makeAnswer()));
});

test('makeGameConfiguration() dekt exact de 17 velden uit GameConfiguration', () => {
  const expected = [
    'preset',
    'gameTypes',
    'language',
    'difficulty',
    'totalRounds',
    'questionSeconds',
    'resultSeconds',
    'scoreboardSeconds',
    'scoreboardFrequency',
    'pacing',
    'autoReveal',
    'speedBonus',
    'deadlineGraceMs',
    'mode',
    'teamNames',
    'metricMode',
    'maxPlayers',
    'allowLateJoin',
  ].sort();
  assert.deepStrictEqual(keys(makeGameConfiguration()), expected);
});

test('makeRoom() dekt exact de velden uit DATA-MODEL.md "Room" (zonder contentVersion/rendererVersion, DECISIONS.md #21)', () => {
  const expected = [
    'id',
    'code',
    'inviteId',
    'phase',
    'createdAt',
    'lastActivityAt',
    'hostSessionIds',
    'locked',
    'config',
    'currentMatchId',
  ].sort();
  assert.deepStrictEqual(keys(makeRoom()), expected);
});

test('makeSession() dekt exact de velden uit DATA-MODEL.md "Session"', () => {
  const expected = [
    'id',
    'roomId',
    'roles',
    'playerId',
    'tokenHash',
    'createdAt',
    'lastSeenAt',
    'connectedSocketIds',
    'revoked',
  ].sort();
  assert.deepStrictEqual(keys(makeSession()), expected);
});

test('makePlayer() dekt exact de velden uit DATA-MODEL.md "Player"', () => {
  const expected = [
    'id',
    'roomId',
    'sessionId',
    'displayName',
    'generatedName',
    'effectiveName',
    'nameSource',
    'teamId',
    'score',
    'correctCount',
    'correctResponseTimeMsTotal',
    'connected',
    'eligibleFromRound',
    'joinedAt',
    'left',
    'kicked',
  ].sort();
  assert.deepStrictEqual(keys(makePlayer()), expected);
});

test('makeMatch() dekt exact de velden uit DATA-MODEL.md "Match", inclusief contentVersion/rendererVersion (DECISIONS.md #21)', () => {
  const expected = [
    'id',
    'roomId',
    'sequence',
    'phase',
    'startedAt',
    'finishedAt',
    'roundIndex',
    'roundIds',
    'usedQuestionKeys',
    'previousMatchQuestionKeys',
    'pausedState',
    'contentVersion',
    'rendererVersion',
  ].sort();
  assert.deepStrictEqual(keys(makeMatch()), expected);
});

test('makeRound() dekt exact de velden uit DATA-MODEL.md "Round"', () => {
  const expected = [
    'id',
    'matchId',
    'gameType',
    'questionKey',
    'publicQuestionPayload',
    'correctAnswer',
    'startsAt',
    'endsAt',
    'status',
  ].sort();
  assert.deepStrictEqual(keys(makeRound()), expected);
});

test('makeAnswer() dekt exact de velden uit DATA-MODEL.md "Answer"', () => {
  const expected = [
    'roundId',
    'playerId',
    'actionId',
    'answer',
    'receivedAt',
    'responseTimeMs',
    'correct',
    'points',
  ].sort();
  assert.deepStrictEqual(keys(makeAnswer()), expected);
});

test('overrides mergen ondiep zonder de veldenset te veranderen', () => {
  const room = makeRoom({ phase: 'FINISHED', locked: true });
  assert.equal(room.phase, 'FINISHED');
  assert.equal(room.locked, true);
  assert.deepStrictEqual(keys(room), keys(makeRoom()));
});
