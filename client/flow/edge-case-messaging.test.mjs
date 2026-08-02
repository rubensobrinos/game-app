import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  KNOWN_ERROR_CODES,
  messageForErrorCode,
  messageForPauseReason,
  messageForConnectionStatus,
  messageForSessionTermination,
} from './edge-case-messaging.mjs';

// PROTOCOL.md §Foutcodes lists 23 codes (7 room/join + 5 autorisatie + 7
// game/ronde + 4 input); the spec's own KNOWN_ERROR_CODES literal matches
// that exhaustive list exactly, even though its prose says "22" — an
// off-by-one in the prose count, not in the enumerated set.
test('1. messageForErrorCode returns each of the known codes unchanged', () => {
  assert.strictEqual(KNOWN_ERROR_CODES.size, 23);
  for (const code of KNOWN_ERROR_CODES) {
    assert.strictEqual(messageForErrorCode(code), code);
  }
});

test("2. messageForErrorCode('ROOM_EXPIRED') falls back — no invented code for edge case 13", () => {
  assert.strictEqual(messageForErrorCode('ROOM_EXPIRED'), 'UNKNOWN_ERROR');
});

test('3. messageForErrorCode(null/undefined/42) falls back, no throw', () => {
  assert.strictEqual(messageForErrorCode(null), 'UNKNOWN_ERROR');
  assert.strictEqual(messageForErrorCode(undefined), 'UNKNOWN_ERROR');
  assert.strictEqual(messageForErrorCode(42), 'UNKNOWN_ERROR');
});

test("4. messageForPauseReason('host_disconnected') and ('no_answers') map to their own keys", () => {
  assert.strictEqual(messageForPauseReason('host_disconnected'), 'pause.host_disconnected');
  assert.strictEqual(messageForPauseReason('no_answers'), 'pause.no_answers');
});

test("5. messageForPauseReason(null) and an unconfirmed future reason both fall back", () => {
  assert.strictEqual(messageForPauseReason(null), 'pause.unknown');
  assert.strictEqual(messageForPauseReason('some_future_reason'), 'pause.unknown');
});

test("6. messageForConnectionStatus('connected') is null", () => {
  assert.strictEqual(messageForConnectionStatus('connected'), null);
});

test("7. messageForConnectionStatus('disconnected') and ('reconnecting') are distinct, non-empty keys", () => {
  const disconnected = messageForConnectionStatus('disconnected');
  const reconnecting = messageForConnectionStatus('reconnecting');
  assert.strictEqual(typeof disconnected, 'string');
  assert.ok(disconnected.length > 0);
  assert.strictEqual(typeof reconnecting, 'string');
  assert.ok(reconnecting.length > 0);
  assert.notStrictEqual(disconnected, reconnecting);
});

test("8. messageForConnectionStatus('bogus') does not throw and returns null", () => {
  assert.strictEqual(messageForConnectionStatus('bogus'), null);
});

test("9. messageForSessionTermination('kicked') and ('revoked') map to their own keys", () => {
  assert.strictEqual(messageForSessionTermination('kicked'), 'session.kicked');
  assert.strictEqual(messageForSessionTermination('revoked'), 'session.revoked');
});

test("10. messageForSessionTermination('bogus') falls back, no throw", () => {
  assert.strictEqual(messageForSessionTermination('bogus'), 'session.unknown');
});

test("11. GAME_NOT_FOUND and INVITE_INVALID both come back unchanged — edge cases 9 and 13 share one path", () => {
  assert.strictEqual(messageForErrorCode('GAME_NOT_FOUND'), 'GAME_NOT_FOUND');
  assert.strictEqual(messageForErrorCode('INVITE_INVALID'), 'INVITE_INVALID');
});

// Beyond the required table: defensive no-throw checks matching the sibling
// modules' contract (route-resolver, join-state, reconnect-state, ...).

test('messageForErrorCode does not throw for objects, arrays, or empty string', () => {
  assert.strictEqual(messageForErrorCode({}), 'UNKNOWN_ERROR');
  assert.strictEqual(messageForErrorCode([]), 'UNKNOWN_ERROR');
  assert.strictEqual(messageForErrorCode(''), 'UNKNOWN_ERROR');
});

test('messageForPauseReason does not throw for non-string input', () => {
  assert.strictEqual(messageForPauseReason(undefined), 'pause.unknown');
  assert.strictEqual(messageForPauseReason(42), 'pause.unknown');
  assert.strictEqual(messageForPauseReason({}), 'pause.unknown');
});

test('messageForConnectionStatus does not throw for null or undefined', () => {
  assert.strictEqual(messageForConnectionStatus(null), null);
  assert.strictEqual(messageForConnectionStatus(undefined), null);
});

test('messageForSessionTermination does not throw for null, undefined, or a reason argument', () => {
  assert.strictEqual(messageForSessionTermination(null), 'session.unknown');
  assert.strictEqual(messageForSessionTermination(undefined), 'session.unknown');
  assert.strictEqual(messageForSessionTermination('kicked', 'some_reason'), 'session.kicked');
  assert.strictEqual(messageForSessionTermination('revoked', null), 'session.revoked');
});
