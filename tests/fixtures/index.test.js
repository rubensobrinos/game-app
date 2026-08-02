'use strict';

// Controleert alleen de vormcontract van tests/fixtures/index.js: elke
// factory zonder argumenten moet exact de veldenset uit het bijbehorende
// DATA-MODEL.md-voorbeeld teruggeven — geen extra, geen ontbrekende velden.
// Waardecontroles horen niet hier: die volgen de defaults 1-op-1 uit de spec
// en zouden alleen de implementatie herhalen.

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  makeRoom,
  makeSession,
  makePlayer,
  makeMatch,
  makeRound,
  makeAnswer,
} = require('./index');

/** Sorteert keys zodat volgorde in de fixture er niet toe doet. */
function keys(obj) {
  return Object.keys(obj).sort();
}

test('makeRoom() dekt exact de velden uit DATA-MODEL.md "Room"', () => {
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
    'contentVersion',
    'rendererVersion',
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

test('makeMatch() dekt exact de velden uit DATA-MODEL.md "Match"', () => {
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
