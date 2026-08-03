import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initialRoundaState,
  start,
  rotate,
  drop,
  land,
  nextRound,
  roundaOutcomeFor,
  fallDurationMsFor,
} from './rounda-model.mjs';

test('initialRoundaState: attract-stand, cyaan als eerste bal', () => {
  const state = initialRoundaState();
  assert.equal(state.phase, 'idle');
  assert.equal(state.ballColor, 'cyan');
  assert.equal(state.streak, 0);
});

test('start: idle naar waiting bij aanraking', () => {
  const state = start(initialRoundaState());
  assert.equal(state.phase, 'waiting');
});

test('start: negeert een tweede aanroep buiten idle', () => {
  const waiting = start(initialRoundaState());
  assert.equal(start(waiting).phase, 'waiting');
});

test('rotate: verandert de hoek tijdens waiting', () => {
  const waiting = start(initialRoundaState());
  const rotated = rotate(waiting, 30);
  assert.equal(rotated.angleDeg, 30);
});

test('rotate: normaliseert negatieve en >360 hoeken naar 0-360', () => {
  const waiting = start(initialRoundaState());
  assert.equal(rotate(waiting, -30).angleDeg, 330);
  assert.equal(rotate(waiting, 390).angleDeg, 30);
});

test('rotate: toegestaan tijdens falling', () => {
  const falling = drop(start(initialRoundaState()));
  assert.equal(rotate(falling, 10).angleDeg, 10);
});

test('rotate: genegeerd tijdens idle en result', () => {
  assert.equal(rotate(initialRoundaState(), 30).angleDeg, 0);
  const resultState = land(drop(start(initialRoundaState())));
  assert.equal(rotate(resultState, 30).angleDeg, resultState.angleDeg);
});

test('drop: alleen vanuit waiting', () => {
  assert.equal(drop(initialRoundaState()).phase, 'idle');
  assert.equal(drop(start(initialRoundaState())).phase, 'falling');
});

test('roundaOutcomeFor: cyaan vangt rond hoek 0', () => {
  assert.equal(roundaOutcomeFor({ angleDeg: 0, ballColor: 'cyan' }), 'catch');
  assert.equal(roundaOutcomeFor({ angleDeg: 20, ballColor: 'cyan' }), 'catch');
  assert.equal(roundaOutcomeFor({ angleDeg: 340, ballColor: 'cyan' }), 'catch');
});

test('roundaOutcomeFor: cyaan mist buiten de openingsbreedte', () => {
  assert.equal(roundaOutcomeFor({ angleDeg: 30, ballColor: 'cyan' }), 'miss');
  assert.equal(roundaOutcomeFor({ angleDeg: 90, ballColor: 'cyan' }), 'miss');
});

test('roundaOutcomeFor: magenta vangt rond hoek 180, niet rond 0', () => {
  assert.equal(roundaOutcomeFor({ angleDeg: 180, ballColor: 'magenta' }), 'catch');
  assert.equal(roundaOutcomeFor({ angleDeg: 0, ballColor: 'magenta' }), 'miss');
});

test('land: catch verhoogt streak en best, reset bij miss', () => {
  const caught = land(rotate(drop(start(initialRoundaState())), 0));
  assert.equal(caught.lastOutcome, 'catch');
  assert.equal(caught.streak, 1);
  assert.equal(caught.best, 1);

  const missed = land(rotate(drop(start(initialRoundaState())), 90));
  assert.equal(missed.lastOutcome, 'miss');
  assert.equal(missed.streak, 0);
});

test('land: best blijft het hoogst-bereikte, ook ná een latere miss', () => {
  let state = land(rotate(drop(start(initialRoundaState())), 0));
  state = land(drop(nextRound(state)));
  // tweede beurt is magenta (nextRound wisselt) — hoek 0 mist die dus
  assert.equal(state.ballColor, 'magenta');
  assert.equal(state.lastOutcome, 'miss');
  assert.equal(state.streak, 0);
  assert.equal(state.best, 1);
});

test('nextRound: wisselt balkleur en wist lastOutcome', () => {
  const result = land(drop(start(initialRoundaState())));
  const next = nextRound(result);
  assert.equal(next.phase, 'waiting');
  assert.equal(next.ballColor, 'magenta');
  assert.equal(next.lastOutcome, null);
});

test('nextRound: genegeerd buiten result', () => {
  const waiting = start(initialRoundaState());
  assert.equal(nextRound(waiting).phase, 'waiting');
  assert.equal(nextRound(waiting).ballColor, 'cyan');
});

test('fallDurationMsFor: korter bij hogere streak, geclamped op een minimum', () => {
  assert.equal(fallDurationMsFor(0), 1600);
  assert.equal(fallDurationMsFor(5), 1200);
  assert.equal(fallDurationMsFor(100), 700);
});

test('fallDurationMsFor: negatieve of ongeldige streak valt terug op 0', () => {
  assert.equal(fallDurationMsFor(-3), 1600);
  assert.equal(fallDurationMsFor(NaN), 1600);
});
