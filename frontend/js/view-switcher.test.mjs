import { test } from 'node:test';
import assert from 'node:assert/strict';
import { viewFor } from './view-switcher.mjs';

test('route: home -> home', () => {
  assert.equal(viewFor({ route: 'home' }), 'home');
});

test('route: join -> preview-join', () => {
  assert.equal(viewFor({ route: 'join', inviteId: 'abc123' }), 'preview-join');
});

test('route: game without a phase -> preview-join (no session yet)', () => {
  assert.equal(viewFor({ route: 'game', code: '482917' }), 'preview-join');
});

test('route: host without a phase -> preview-join (no session yet)', () => {
  assert.equal(viewFor({ route: 'host', code: '482917' }), 'preview-join');
});

test('route: game with phase UNINITIALIZED -> preview-join (initialMatchPhaseState, not yet an active session)', () => {
  assert.equal(viewFor({ route: 'game', code: '482917', phase: 'UNINITIALIZED' }), 'preview-join');
});

test('route: game, phase LOBBY -> lobby', () => {
  assert.equal(viewFor({ route: 'game', code: '482917', phase: 'LOBBY' }), 'lobby');
});

test('route: host, phase LOBBY -> lobby', () => {
  assert.equal(viewFor({ route: 'host', code: '482917', phase: 'LOBBY' }), 'lobby');
});

for (const phase of ['COUNTDOWN', 'ROUND_ACTIVE', 'ROUND_RESULT']) {
  test(`route: game, phase ${phase} -> gameplay`, () => {
    assert.equal(viewFor({ route: 'game', code: '482917', phase }), 'gameplay');
  });
}

test('route: game, phase SCOREBOARD -> scoreboard', () => {
  assert.equal(viewFor({ route: 'game', code: '482917', phase: 'SCOREBOARD' }), 'scoreboard');
});

test('route: game, phase FINISHED -> podium', () => {
  assert.equal(viewFor({ route: 'game', code: '482917', phase: 'FINISHED' }), 'podium');
});

test('route: screen -> unknown (spectators out of scope, DECISIONS.md #9)', () => {
  assert.equal(viewFor({ route: 'screen', code: '482917' }), 'unknown');
});

test('route: unknown -> unknown', () => {
  assert.equal(viewFor({ route: 'unknown' }), 'unknown');
});

// Corrected after review: pausing is a normal MVP flow (DECISIONS.md
// #10/#11), not an unknown state -- the underlying view stays visible.
test('route: game, phase PAUSED with pausedState.previousPhase ROUND_ACTIVE -> gameplay', () => {
  assert.equal(
    viewFor({
      route: 'game',
      code: '482917',
      phase: 'PAUSED',
      pausedState: { previousPhase: 'ROUND_ACTIVE' },
    }),
    'gameplay',
  );
});

test('route: game, phase PAUSED with pausedState.previousPhase LOBBY -> lobby', () => {
  assert.equal(
    viewFor({ route: 'game', code: '482917', phase: 'PAUSED', pausedState: { previousPhase: 'LOBBY' } }),
    'lobby',
  );
});

test('route: game, phase PAUSED with pausedState.previousPhase SCOREBOARD -> scoreboard', () => {
  assert.equal(
    viewFor({
      route: 'game',
      code: '482917',
      phase: 'PAUSED',
      pausedState: { previousPhase: 'SCOREBOARD' },
    }),
    'scoreboard',
  );
});

test('route: game, phase PAUSED without pausedState -> unknown (defensive fallback, should not happen in practice)', () => {
  assert.equal(viewFor({ route: 'game', code: '482917', phase: 'PAUSED' }), 'unknown');
});

test('route: game, phase PAUSED with pausedState.previousPhase missing/non-string -> unknown', () => {
  assert.equal(
    viewFor({ route: 'game', code: '482917', phase: 'PAUSED', pausedState: {} }),
    'unknown',
  );
  assert.equal(
    viewFor({ route: 'game', code: '482917', phase: 'PAUSED', pausedState: null }),
    'unknown',
  );
});

test('route: game, phase PAUSED with pausedState.previousPhase PAUSED (malformed) -> unknown, no infinite recursion', () => {
  assert.equal(
    viewFor({ route: 'game', code: '482917', phase: 'PAUSED', pausedState: { previousPhase: 'PAUSED' } }),
    'unknown',
  );
});

test('malformed context (null) -> unknown', () => {
  assert.equal(viewFor(null), 'unknown');
});

test('malformed context (missing route) -> unknown', () => {
  assert.equal(viewFor({ phase: 'LOBBY' }), 'unknown');
});

test('malformed context (non-string route) -> unknown', () => {
  assert.equal(viewFor({ route: 42 }), 'unknown');
});
