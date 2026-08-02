import { test } from 'node:test';
import assert from 'node:assert/strict';
import { availableHostActions, hostActionRequest } from './host-controls-state.mjs';

function ctx(overrides = {}) {
  return { phase: 'LOBBY', pacing: 'auto', playerCount: 1, locked: false, ...overrides };
}

test('1. LOBBY with a player has start and finish, not pause/resume/next/rematch', () => {
  const actions = availableHostActions(ctx({ phase: 'LOBBY', playerCount: 1 }));
  assert.ok(actions.includes('start'));
  assert.ok(actions.includes('finish'));
  assert.ok(!actions.includes('pause'));
  assert.ok(!actions.includes('resume'));
  assert.ok(!actions.includes('next'));
  assert.ok(!actions.includes('rematch'));
});

test('2. LOBBY with zero players has no start', () => {
  const actions = availableHostActions(ctx({ phase: 'LOBBY', playerCount: 0 }));
  assert.ok(!actions.includes('start'));
});

test('3. each active phase has pause, not resume', () => {
  for (const phase of ['COUNTDOWN', 'ROUND_ACTIVE', 'ROUND_RESULT', 'SCOREBOARD']) {
    const actions = availableHostActions(ctx({ phase }));
    assert.ok(actions.includes('pause'), `expected pause for ${phase}`);
    assert.ok(!actions.includes('resume'), `expected no resume for ${phase}`);
  }
});

test('4. PAUSED has resume, not pause', () => {
  const actions = availableHostActions(ctx({ phase: 'PAUSED' }));
  assert.ok(actions.includes('resume'));
  assert.ok(!actions.includes('pause'));
});

// DECISIONS.md #1: one host action per round. ROUND_RESULT -> SCOREBOARD is
// always timer-driven; the host only acts from SCOREBOARD.
test('5. host pacing in SCOREBOARD has next; ROUND_RESULT does not', () => {
  assert.ok(availableHostActions(ctx({ pacing: 'host', phase: 'SCOREBOARD' })).includes('next'));
  assert.ok(!availableHostActions(ctx({ pacing: 'host', phase: 'ROUND_RESULT' })).includes('next'));
});

test('6. auto pacing in ROUND_RESULT has no next', () => {
  const actions = availableHostActions(ctx({ pacing: 'auto', phase: 'ROUND_RESULT' }));
  assert.ok(!actions.includes('next'));
});

test('7. host pacing in ROUND_ACTIVE (not a waiting phase) has no next', () => {
  const actions = availableHostActions(ctx({ pacing: 'host', phase: 'ROUND_ACTIVE' }));
  assert.ok(!actions.includes('next'));
});

test('8. lock/unlock are mutually exclusive based on context.locked', () => {
  const lockedActions = availableHostActions(ctx({ locked: true }));
  const unlockedActions = availableHostActions(ctx({ locked: false }));
  assert.ok(lockedActions.includes('unlock'));
  assert.ok(!lockedActions.includes('lock'));
  assert.ok(unlockedActions.includes('lock'));
  assert.ok(!unlockedActions.includes('unlock'));
});

test('9. FINISHED has rematch, not finish', () => {
  const actions = availableHostActions(ctx({ phase: 'FINISHED' }));
  assert.ok(actions.includes('rematch'));
  assert.ok(!actions.includes('finish'));
});

test('10. LOBBY has finish — regression test for the "no stricter than the wire contract" design rule', () => {
  const actions = availableHostActions(ctx({ phase: 'LOBBY', playerCount: 1 }));
  assert.ok(actions.includes('finish'));
});

test('11. UNINITIALIZED is an empty list regardless of other fields', () => {
  const actions = availableHostActions({
    phase: 'UNINITIALIZED',
    pacing: 'host',
    playerCount: 5,
    locked: true,
  });
  assert.deepStrictEqual(actions, []);
});

test('12. hostActionRequest(start) with start available', () => {
  const result = hostActionRequest('start', ctx({ phase: 'LOBBY', playerCount: 1 }));
  assert.deepStrictEqual(result, { event: 'game:start', payload: {} });
});

test('13. hostActionRequest(lock/unlock) toggles the locked payload', () => {
  const lockResult = hostActionRequest('lock', ctx({ locked: false }));
  const unlockResult = hostActionRequest('unlock', ctx({ locked: true }));
  assert.deepStrictEqual(lockResult, { event: 'game:lock', payload: { locked: true } });
  assert.deepStrictEqual(unlockResult, { event: 'game:lock', payload: { locked: false } });
});

test('14. hostActionRequest(kick) with a playerId', () => {
  const result = hostActionRequest('kick', ctx({ playerCount: 2 }), { playerId: 'p_1' });
  assert.deepStrictEqual(result, { event: 'game:kick', payload: { playerId: 'p_1' } });
});

test('15. hostActionRequest(kick) without a playerId is null', () => {
  const result = hostActionRequest('kick', ctx({ playerCount: 2 }), {});
  assert.strictEqual(result, null);
});

test('16. hostActionRequest re-checks availability — resume from LOBBY is null', () => {
  const result = hostActionRequest('resume', ctx({ phase: 'LOBBY' }));
  assert.strictEqual(result, null);
});

test('17. hostActionRequest with a bogus action is null, no throw', () => {
  assert.doesNotThrow(() => {
    const result = hostActionRequest('bogus-action', ctx());
    assert.strictEqual(result, null);
  });
});

test('18. null/undefined/malformed context never throws and resolves conservatively', () => {
  assert.doesNotThrow(() => {
    assert.deepStrictEqual(availableHostActions(null), []);
    assert.deepStrictEqual(availableHostActions(undefined), []);
    assert.deepStrictEqual(availableHostActions({}), []);
    assert.deepStrictEqual(
      availableHostActions({ phase: 42, pacing: 'host', playerCount: 'three', locked: 'no' }),
      [],
    );
  });
  assert.doesNotThrow(() => {
    assert.strictEqual(hostActionRequest('start', null), null);
    assert.strictEqual(hostActionRequest('start', undefined), null);
    assert.strictEqual(hostActionRequest('start', {}), null);
  });
});
