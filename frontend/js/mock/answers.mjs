// mock/answers.mjs — refactor 4 (docs/openstaand/refactor/4-transport-mock.md).
// Verplaatst LETTERLIJK uit transport-mock.mjs's "Rondelogica"-kopje:
// `submitAnswer`. Geen gedragsverandering.

import { ProtocolError } from './protocol-error.mjs';
import { emitToSession, broadcast } from './events.mjs';
import { countActivePlayers } from './players.mjs';
import { correctValueOf } from './questions.mjs';

export function submitAnswer(target, playerId, payload, ctx) {
  if (target.phase !== 'ROUND_ACTIVE' || target.currentRound === null) {
    throw new ProtocolError('ROUND_NOT_ACTIVE', 'No active round to answer.');
  }
  // Fase 4 (autoReveal, besluit 51): zonder deze toets bleef een ronde met
  // autoReveal uit onbeperkt open voor antwoorden — vóór deze fase viel dat
  // nooit op, want de timer sloot de ronde toch al af rond `endsAt`. Zelfde
  // grens als de echte server zijn deadline+grace-toets (besluit 13); deze
  // mock kent geen aparte grace-periode, dus knipt hard op `endsAt`.
  if (Date.now() >= target.currentRound.endsAt) {
    throw new ProtocolError('DEADLINE_PASSED', 'The answer window for this round has closed.');
  }
  if (typeof payload.roundId !== 'string' || payload.roundId !== target.currentRound.roundId) {
    throw new ProtocolError('INVALID_ANSWER_FORMAT', 'roundId does not match the active round.');
  }
  const player = target.players.get(playerId);
  if (player === undefined || !player.active) {
    throw new ProtocolError('PLAYER_NOT_ELIGIBLE', 'Player is not part of this round.');
  }
  const currentRoundNumber = target.roundIndex + 1; // 1-based, zie eligibleFromRound.
  if (currentRoundNumber < player.eligibleFromRound) {
    throw new ProtocolError('PLAYER_NOT_ELIGIBLE', 'Player joined after this round started.');
  }
  // Besluit 54 (6 aug 2026): wijzigen mag tot de tijd om is. Geen afwijzing
  // meer op een tweede antwoord — de mock moet hetzelfde doen als de server,
  // anders wijkt solo af van samen spelen. De deadline zelf wordt hierboven
  // al bewaakt.
  // De antwoordvorm hangt van de gameType af (PROTOCOL.md §round:answer):
  // meerkeuze stuurt { optionId }, echt-of-nep stuurt { choice }.
  const antwoord = payload.answer;
  if (antwoord === null || typeof antwoord !== 'object') {
    throw new ProtocolError('INVALID_ANSWER_FORMAT', 'answer must be an object.');
  }
  let gegeven;
  if (target.gameType === 'odd_one_out') {
    if (!Number.isInteger(antwoord.cardIndex)) {
      throw new ProtocolError('INVALID_ANSWER_FORMAT', 'odd_one_out expects { cardIndex }.');
    }
    gegeven = String(antwoord.cardIndex);
  } else if (target.gameType === 'real_or_fake_flag') {
    if (antwoord.choice !== 'real' && antwoord.choice !== 'fake') {
      throw new ProtocolError('INVALID_ANSWER_FORMAT', 'real_or_fake_flag expects { choice: "real" | "fake" }.');
    }
    gegeven = antwoord.choice;
  } else if (target.gameType === 'higher_lower') {
    if (antwoord.side !== 0 && antwoord.side !== 1) {
      throw new ProtocolError('INVALID_ANSWER_FORMAT', 'higher_lower expects { side: 0 | 1 }.');
    }
    gegeven = String(antwoord.side);
  } else {
    // flags_mc EN capitals_mc: allebei { optionId }, zie buildQuestionSequence.
    if (typeof antwoord.optionId !== 'string') {
      throw new ProtocolError('INVALID_ANSWER_FORMAT', 'flags_mc/capitals_mc expect { optionId }.');
    }
    gegeven = antwoord.optionId;
  }

  // Besluit 54: bij een correctie eerst het vorige antwoord terugdraaien —
  // net als `answer-flow.js` op de server. Zonder dat levert twijfelen punten
  // op, en dat is precies waarom die keuze een besluit was.
  const vorige = target.currentRound.answers.get(playerId);
  const correcteWaarde = correctValueOf(target.currentRound.question);
  if (vorige !== undefined && vorige === correcteWaarde) {
    player.score -= 100;
    player.correctCount -= 1;
    player.correctResponseTimeMsTotal = Math.max(
      0,
      player.correctResponseTimeMsTotal - (target.currentRound.vorigeResponstijd?.get(playerId) ?? 0),
    );
  }

  player.answeredCurrentRound = true;
  target.currentRound.answers.set(playerId, gegeven);

  const isCorrect = gegeven === correcteWaarde;
  if (isCorrect) {
    const responstijd = Math.max(0, Date.now() - target.currentRound.startsAt);
    player.score += 100;
    player.correctCount += 1;
    player.correctResponseTimeMsTotal += responstijd;
    if (target.currentRound.vorigeResponstijd === undefined) {
      target.currentRound.vorigeResponstijd = new Map();
    }
    target.currentRound.vorigeResponstijd.set(playerId, responstijd);
  }

  emitToSession(target, playerId, 'round:answer-accepted', { roundId: target.currentRound.roundId }, ctx);
  broadcast(target, 'round:progress', {
    answeredCount: target.currentRound.answers.size,
    eligiblePlayerCount: countActivePlayers(target),
  }, ctx);

  return { roundId: target.currentRound.roundId };
}
