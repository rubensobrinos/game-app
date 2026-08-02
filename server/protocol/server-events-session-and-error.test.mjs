import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateGameRematchStartedPayload,
  validateSessionKickedPayload,
  validateSessionRevokedPayload,
  validateErrorPayload,
} from './server-events-session-and-error.mjs';

// Rij 29
test('validateGameRematchStartedPayload: { matchId, lobbyState: {} } → ok:true', () => {
  assert.deepEqual(
    validateGameRematchStartedPayload({ matchId: 'match_01J...', lobbyState: {} }),
    { ok: true },
  );
});

// Rij 30 — twee losse gevallen
test('validateGameRematchStartedPayload: ontbrekend matchId → afgewezen', () => {
  const result = validateGameRematchStartedPayload({ lobbyState: {} });
  assert.deepEqual(result, { ok: false, code: null });
});
test('validateGameRematchStartedPayload: lobbyState: null → afgewezen', () => {
  const result = validateGameRematchStartedPayload({ matchId: 'match_01J...', lobbyState: null });
  assert.deepEqual(result, { ok: false, code: null });
});

// Rij 31 — beide events, ok
test('validateSessionKickedPayload: { reason: "kicked_by_host" } → ok:true', () => {
  assert.deepEqual(validateSessionKickedPayload({ reason: 'kicked_by_host' }), { ok: true });
});
test('validateSessionRevokedPayload: { reason: "session_revoked_elsewhere" } → ok:true', () => {
  assert.deepEqual(
    validateSessionRevokedPayload({ reason: 'session_revoked_elsewhere' }),
    { ok: true },
  );
});

// Rij 32 — beide events afgewezen bij {}
test('validateSessionKickedPayload: {} → afgewezen', () => {
  assert.deepEqual(validateSessionKickedPayload({}), { ok: false, code: null });
});
test('validateSessionRevokedPayload: {} → afgewezen', () => {
  assert.deepEqual(validateSessionRevokedPayload({}), { ok: false, code: null });
});

// Rij 33 — het letterlijke error-voorbeeld uit PROTOCOL.md §Foutcodes
test('validateErrorPayload: het letterlijke { actionId, code: "ROOM_LOCKED", meta: {} } → ok:true', () => {
  assert.deepEqual(
    validateErrorPayload({ actionId: 'act_01J...', code: 'ROOM_LOCKED', meta: {} }),
    { ok: true },
  );
});

// Rij 34 — drie losse gevallen
test('validateErrorPayload: ontbrekend actionId → afgewezen', () => {
  const result = validateErrorPayload({ code: 'ROOM_LOCKED', meta: {} });
  assert.deepEqual(result, { ok: false, code: null });
});
test('validateErrorPayload: code als getal → afgewezen', () => {
  const result = validateErrorPayload({ actionId: 'act_01J...', code: 42, meta: {} });
  assert.deepEqual(result, { ok: false, code: null });
});
test('validateErrorPayload: meta als array → afgewezen', () => {
  const result = validateErrorPayload({ actionId: 'act_01J...', code: 'ROOM_LOCKED', meta: [] });
  assert.deepEqual(result, { ok: false, code: null });
});
