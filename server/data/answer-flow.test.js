'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { resolveAnswer, buildRoundContext } = require('./answer-flow');
const { scoreAnswer, validateAnswer } = (() => {
  const scoring = require('../rules/scoring');
  const validators = require('../rules/validators');
  return { scoreAnswer: scoring.scoreAnswer, validateAnswer: validators.validateAnswer };
})();

const START = 1_000_000;
const END = 1_015_000; // questionDuration = 15000ms
const DEADLINE_GRACE_MS = 150;

function makeSession(overrides = {}) {
  return { revoked: false, roomId: 'room_1', playerId: 'p_1', ...overrides };
}

function makePlayer(overrides = {}) {
  return {
    id: 'p_1', score: 0, correctCount: 0, correctResponseTimeMsTotal: 0,
    kicked: false, left: false, eligibleFromRound: 1,
    ...overrides,
  };
}

function makeRoom(overrides = {}) {
  return { id: 'room_1', config: { speedBonus: true }, ...overrides };
}

function makeMatch(overrides = {}) {
  return { id: 'match_1', roundIndex: 0, ...overrides }; // roundIndex 0 -> roundNumber 1
}

function makeRound(overrides = {}) {
  return {
    id: 'round_1', matchId: 'match_1', gameType: 'real_or_fake_flag',
    status: 'ACTIVE', startsAt: START, endsAt: END,
    correctAnswer: { choice: 'fake' },
    publicQuestionPayload: {},
    ...overrides,
  };
}

function makeCtx(overrides = {}) {
  return {
    session: makeSession(),
    player: makePlayer(),
    room: makeRoom(),
    match: makeMatch(),
    round: makeRound(),
    answer: { choice: 'fake' },
    actionId: 'act_1',
    receivedAt: START + 1000,
    deadlineGraceMs: DEADLINE_GRACE_MS,
    existingAnswerForRound: null,
    existingActionCacheEntry: null,
    ...overrides,
  };
}

describe('resolveAnswer — idempotentie EERST (regressietest bevinding 1) #1-3', () => {
  test('#1 replay met hetzelfde actionId geeft de opgeslagen ack terug, ongeacht de rest', () => {
    const cachedAck = { roundId: 'round_1' };
    const result = resolveAnswer(makeCtx({
      existingActionCacheEntry: { actionId: 'act_1', ack: cachedAck },
    }));
    assert.deepStrictEqual(result, { ok: true, replay: true, ack: cachedAck });
  });

  test('#2 replay ná de deadline geeft nog steeds de ORIGINELE ack, geen DEADLINE_PASSED', () => {
    const cachedAck = { roundId: 'round_1' };
    const result = resolveAnswer(makeCtx({
      existingActionCacheEntry: { actionId: 'act_1', ack: cachedAck },
      receivedAt: END + 10_000, // ver voorbij endsAt + deadlineGraceMs
    }));
    assert.deepStrictEqual(result, { ok: true, replay: true, ack: cachedAck });
  });

  test('#3 replay ná een faseovergang (ronde niet meer ACTIVE) geeft nog steeds de ORIGINELE ack, geen ROUND_NOT_ACTIVE', () => {
    const cachedAck = { roundId: 'round_1' };
    const result = resolveAnswer(makeCtx({
      existingActionCacheEntry: { actionId: 'act_1', ack: cachedAck },
      round: makeRound({ status: 'ENDED' }),
    }));
    assert.deepStrictEqual(result, { ok: true, replay: true, ack: cachedAck });
  });

  test('#3b een ANDER actionId in de cache (van een vorig antwoord) triggert GEEN replay', () => {
    const result = resolveAnswer(makeCtx({
      existingActionCacheEntry: { actionId: 'act_other', ack: { roundId: 'round_1' } },
    }));
    assert.strictEqual(result.replay, false); // dit pad gaat door naar writes, geen replay
    assert.strictEqual(result.ok, true);
  });
});

describe('resolveAnswer — sessie en speler (stap 2) #4-8', () => {
  test('#4 revoked session -> SESSION_REVOKED', () => {
    assert.deepStrictEqual(resolveAnswer(makeCtx({ session: makeSession({ revoked: true }) })), { ok: false, code: 'SESSION_REVOKED' });
  });
  test('#5 session.roomId komt niet overeen met room.id -> TOKEN_INVALID', () => {
    assert.deepStrictEqual(resolveAnswer(makeCtx({ session: makeSession({ roomId: 'room_other' }) })), { ok: false, code: 'TOKEN_INVALID' });
  });
  test('#6 host-only session (playerId: null) -> NOT_PLAYER', () => {
    assert.deepStrictEqual(resolveAnswer(makeCtx({ session: makeSession({ playerId: null }) })), { ok: false, code: 'NOT_PLAYER' });
  });
  test('#7 gekickte speler -> NOT_PLAYER', () => {
    assert.deepStrictEqual(resolveAnswer(makeCtx({ player: makePlayer({ kicked: true }) })), { ok: false, code: 'NOT_PLAYER' });
  });
  test('#8 vertrokken speler (left: true) -> NOT_PLAYER', () => {
    assert.deepStrictEqual(resolveAnswer(makeCtx({ player: makePlayer({ left: true }) })), { ok: false, code: 'NOT_PLAYER' });
  });
});

describe('resolveAnswer — match en ronde (stap 3) #9-11', () => {
  test('#9 round.matchId komt niet overeen met match.id -> ROUND_NOT_ACTIVE', () => {
    assert.deepStrictEqual(resolveAnswer(makeCtx({ round: makeRound({ matchId: 'match_other' }) })), { ok: false, code: 'ROUND_NOT_ACTIVE' });
  });
  test('#10 round.status !== ACTIVE -> ROUND_NOT_ACTIVE', () => {
    assert.deepStrictEqual(resolveAnswer(makeCtx({ round: makeRound({ status: 'ENDED' }) })), { ok: false, code: 'ROUND_NOT_ACTIVE' });
  });
  test('#11 player.eligibleFromRound > huidig rondenummer -> PLAYER_NOT_ELIGIBLE', () => {
    // match.roundIndex: 0 -> roundNumber 1; speler pas vanaf ronde 2 gerechtigd.
    assert.deepStrictEqual(
      resolveAnswer(makeCtx({ player: makePlayer({ eligibleFromRound: 2 }) })),
      { ok: false, code: 'PLAYER_NOT_ELIGIBLE' }
    );
  });
});

describe('resolveAnswer — deadline (stap 4) #12-13', () => {
  test('#12 ver voorbij endsAt + deadlineGraceMs -> DEADLINE_PASSED', () => {
    assert.deepStrictEqual(resolveAnswer(makeCtx({ receivedAt: END + 10_000 })), { ok: false, code: 'DEADLINE_PASSED' });
  });
  test('#13 exact op endsAt + deadlineGraceMs (grenswaarde) wordt nog geaccepteerd', () => {
    const result = resolveAnswer(makeCtx({ receivedAt: END + DEADLINE_GRACE_MS }));
    assert.strictEqual(result.ok, true);
  });
});

// Besluit 54 (6 aug 2026) HERZIET stap 5: een tweede antwoord binnen de tijd
// is geen fout meer maar een correctie. Wat hier getest wordt is niet dát het
// mag, maar dat de BOEKHOUDING klopt — de bijdrage van het vorige antwoord
// moet er eerst af. Zonder dat levert twijfelen punten op.
describe('resolveAnswer — een tweede antwoord is een correctie (besluit 54) #14-15', () => {
  test('#14 een correctie draait de punten van het vorige antwoord terug', () => {
    const vorige = {
      roundId: 'round_1', playerId: 'p_1', answer: { choice: 'fake' },
      correct: true, points: 180, responseTimeMs: 2000,
    };
    const result = resolveAnswer(makeCtx({
      answer: { choice: 'real' },
      existingAnswerForRound: vorige,
    }));
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.write.correctie, true);
    // De speler stond op `score` mét die 180 erin; die moet eraf voordat het
    // nieuwe antwoord erbij komt.
    const basis = makeCtx().player;
    assert.strictEqual(
      result.write.updatedPlayer.score,
      basis.score - vorige.points + result.write.answer.points,
    );
    assert.strictEqual(
      result.write.updatedPlayer.correctCount,
      basis.correctCount - 1 + (result.write.answer.correct ? 1 : 0),
    );
  });
  test('#15 zonder vorig antwoord blijft het een gewone optelling, zonder correctievlag', () => {
    const result = resolveAnswer(makeCtx());
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.write.correctie, false);
    const basis = makeCtx().player;
    assert.strictEqual(
      result.write.updatedPlayer.score,
      basis.score + result.write.answer.points,
    );
  });
});

describe('resolveAnswer — valid:false geeft INVALID_ANSWER_FORMAT zonder write (regressietest bevinding 3) #16-17', () => {
  test('#16 een structureel ongeldig antwoord (verkeerd veld) -> INVALID_ANSWER_FORMAT, geen write', () => {
    const result = resolveAnswer(makeCtx({ answer: { side: 0 } })); // real_or_fake_flag verwacht 'choice', niet 'side'
    assert.deepStrictEqual(result, { ok: false, code: 'INVALID_ANSWER_FORMAT' });
  });

  test('#17 na INVALID_ANSWER_FORMAT is er niets geschreven om een latere geldige poging te blokkeren', () => {
    const invalid = resolveAnswer(makeCtx({ answer: { side: 0 } }));
    assert.strictEqual(invalid.ok, false);
    assert.strictEqual(invalid.code, 'INVALID_ANSWER_FORMAT');
    // resolveAnswer zelf schrijft nooit iets (pure functie) — dit bevestigt
    // alleen dat het resultaat geen 'write' bevat die een aanroeper per
    // ongeluk zou kunnen opslaan.
    assert.strictEqual('write' in invalid, false);
  });
});

describe('resolveAnswer — geen scorelek in de ack (regressietest bevinding 2) #18-19', () => {
  test('#18 een geslaagde, niet-replay aanroep heeft een ack die uitsluitend roundId bevat', () => {
    const result = resolveAnswer(makeCtx());
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.replay, false);
    assert.deepStrictEqual(Object.keys(result.write.actionCacheEntry.ack), ['roundId']);
  });
  test('#19 correct/points/bonus komen NERGENS voor in write.actionCacheEntry.ack', () => {
    const result = resolveAnswer(makeCtx());
    const ackKeys = Object.keys(result.write.actionCacheEntry.ack);
    assert.strictEqual(ackKeys.includes('correct'), false);
    assert.strictEqual(ackKeys.includes('points'), false);
    assert.strictEqual(ackKeys.includes('bonus'), false);
  });
});

describe('resolveAnswer — roundContext (regressietest bevinding 6) #20-23', () => {
  test('#20 flags_mc gebruikt Round.validOptionIds, niet publicQuestionPayload.options', () => {
    const round = makeRound({
      gameType: 'flags_mc',
      correctAnswer: { optionId: 'nl' },
      validOptionIds: ['nl', 'de', 'fr', 'be'],
      publicQuestionPayload: { targetIso2: 'nl', optionIso2s: ['nl', 'de', 'fr', 'be'] },
    });
    const ctx = buildRoundContext(round);
    assert.deepStrictEqual(ctx, { validOptionIds: ['nl', 'de', 'fr', 'be'] });
  });

  test('#21 odd_one_out leidt optionCount af uit publicQuestionPayload.cards.length', () => {
    const round = makeRound({
      gameType: 'odd_one_out',
      correctAnswer: { cardIndex: 2 },
      resultDetails: { majorityContinent: 'Europe', minorityContinent: 'Asia' },
      publicQuestionPayload: { cards: [{ cardIndex: 0 }, { cardIndex: 1 }, { cardIndex: 2 }, { cardIndex: 3 }] },
    });
    assert.deepStrictEqual(buildRoundContext(round), { optionCount: 4 });
  });

  test('#22 real_or_fake_flag/higher_lower hebben een lege roundContext', () => {
    assert.deepStrictEqual(buildRoundContext(makeRound({ gameType: 'real_or_fake_flag' })), {});
    assert.deepStrictEqual(
      buildRoundContext(makeRound({ gameType: 'higher_lower', correctAnswer: { side: 0 }, resultDetails: {} })),
      {}
    );
  });

  test('#23 flags_mc-antwoord via resolveAnswer end-to-end tegen echte validateAnswer()', () => {
    const round = makeRound({
      gameType: 'flags_mc',
      correctAnswer: { optionId: 'nl' },
      validOptionIds: ['nl', 'de', 'fr', 'be'],
      publicQuestionPayload: { targetIso2: 'nl', optionIso2s: ['nl', 'de', 'fr', 'be'] },
    });
    const result = resolveAnswer(makeCtx({ round, answer: { optionId: 'nl' } }));
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.write.answer.correct, true);
  });
});

describe('resolveAnswer — punten/correctheid identiek aan scoreAnswer()/validateAnswer() (geen parallelle herimplementatie) #24-26', () => {
  test('#24 correct, tijdig antwoord: points komt exact overeen met scoreAnswer()', () => {
    const receivedAt = START + 3000;
    const result = resolveAnswer(makeCtx({ receivedAt }));
    const expected = scoreAnswer({
      correct: true, receivedAt, startsAt: START, endsAt: END,
      deadlineGraceMs: DEADLINE_GRACE_MS, speedBonusEnabled: true,
    });
    assert.strictEqual(result.write.answer.points, expected.points);
    assert.strictEqual(result.write.answer.correct, true);
  });

  test('#25 fout antwoord: correct/points komen overeen met validateAnswer()+scoreAnswer()', () => {
    const receivedAt = START + 3000;
    const result = resolveAnswer(makeCtx({ answer: { choice: 'real' }, receivedAt })); // correctAnswer is 'fake'
    const validation = validateAnswer('real_or_fake_flag', { choice: 'real' }, { choice: 'fake' }, {});
    const expected = scoreAnswer({
      correct: validation.correct, receivedAt, startsAt: START, endsAt: END,
      deadlineGraceMs: DEADLINE_GRACE_MS, speedBonusEnabled: true,
    });
    assert.strictEqual(result.write.answer.correct, validation.correct);
    assert.strictEqual(result.write.answer.points, expected.points);
  });

  test('#26 write.updatedPlayer.score is de ABSOLUTE nieuwe waarde (player.score + points), geen delta', () => {
    const result = resolveAnswer(makeCtx({ player: makePlayer({ score: 4000 }), receivedAt: START + 3000 }));
    assert.strictEqual(result.write.updatedPlayer.score, 4000 + result.write.answer.points);
  });
});

describe('resolveAnswer — write.answer volgt de Answer-vorm #27', () => {
  test('#27 responseTimeMs = receivedAt - round.startsAt', () => {
    const receivedAt = START + 4321;
    const result = resolveAnswer(makeCtx({ receivedAt }));
    assert.strictEqual(result.write.answer.responseTimeMs, 4321);
  });
});
