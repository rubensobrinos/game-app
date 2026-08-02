import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseClientEnvelope,
  buildServerEnvelope,
  buildAck,
  assertPayloadSize,
} from './envelope.mjs';

test('parseClientEnvelope: valid envelope (incl. empty-object payload)', () => {
  const result = parseClientEnvelope({
    event: 'round:answer',
    actionId: 'act_01J',
    payload: { roundId: 'round_07' },
  });
  assert.deepEqual(result, {
    ok: true,
    event: 'round:answer',
    actionId: 'act_01J',
    payload: { roundId: 'round_07' },
  });
  assert.equal(parseClientEnvelope({ event: 'game:start', actionId: 'act_02', payload: {} }).ok, true);
});

test('parseClientEnvelope: raw is not an object', () => {
  for (const raw of ['not-an-object', null, 42, ['event'], undefined]) {
    const result = parseClientEnvelope(raw);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'invalid-envelope-shape');
  }
});

test('parseClientEnvelope: missing/empty event', () => {
  for (const event of [undefined, '', 42]) {
    const result = parseClientEnvelope({ event, actionId: 'act_01J', payload: {} });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'missing-event');
  }
});

test('parseClientEnvelope: missing/empty actionId', () => {
  for (const actionId of [undefined, '', 42]) {
    const result = parseClientEnvelope({ event: 'game:start', actionId, payload: {} });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'missing-action-id');
  }
});

test('parseClientEnvelope: payload as array/null/string/missing is rejected', () => {
  for (const raw of [
    { event: 'game:start', actionId: 'act_01J', payload: [] },
    { event: 'game:start', actionId: 'act_01J', payload: null },
    { event: 'game:start', actionId: 'act_01J', payload: 'not-an-object' },
    { event: 'game:start', actionId: 'act_01J' },
  ]) {
    const result = parseClientEnvelope(raw);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'invalid-payload');
  }
});

test('buildServerEnvelope: valid envelope matches round:started shape', () => {
  const result = buildServerEnvelope('round:started', { roundId: 'round_07' }, 1785623411900, 'evt_01J');
  assert.deepEqual(result, {
    ok: true,
    envelope: {
      event: 'round:started',
      eventId: 'evt_01J',
      serverTime: 1785623411900,
      payload: { roundId: 'round_07' },
    },
  });
});

test('buildServerEnvelope: missing/empty event', () => {
  for (const event of [undefined, '']) {
    const result = buildServerEnvelope(event, {}, 1785623411900, 'evt_01J');
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'missing-event');
  }
});

test('buildServerEnvelope: missing/wrong-type eventId', () => {
  for (const eventId of [undefined, '', 123]) {
    const result = buildServerEnvelope('round:started', {}, 1785623411900, eventId);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'missing-event-id');
  }
});

test('buildServerEnvelope: missing/wrong-type/non-finite serverTime', () => {
  for (const serverTime of [undefined, '1785623411900', NaN, Infinity]) {
    const result = buildServerEnvelope('round:started', {}, serverTime, 'evt_01J');
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'invalid-server-time');
  }
});

test('buildAck: valid ack matches Ack example shape', () => {
  const result = buildAck('act_01J', true, 1785623412050, {});
  assert.deepEqual(result, {
    ok: true,
    envelope: { actionId: 'act_01J', ok: true, serverTime: 1785623412050, payload: {} },
  });
});

test('buildAck: missing/empty actionId', () => {
  for (const actionId of [undefined, '']) {
    const result = buildAck(actionId, true, 1785623412050, {});
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'missing-action-id');
  }
});

test('buildAck: wrong-type ok flag', () => {
  const result = buildAck('act_01J', 'true', 1785623412050, {});
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'invalid-ok-flag');
});

test('buildAck: missing/wrong-type/non-finite serverTime', () => {
  for (const serverTime of [undefined, '1785623412050', NaN]) {
    const result = buildAck('act_01J', true, serverTime, {});
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'invalid-server-time');
  }
});

test('assertPayloadSize: exactly at maxBytes succeeds, one byte over fails', () => {
  const raw = 'a'.repeat(10);
  assert.deepEqual(assertPayloadSize(raw, 10), { ok: true });
  assert.deepEqual(assertPayloadSize(raw, 9), { ok: false, reason: 'payload-too-large' });
});

test('assertPayloadSize: counts UTF-8 bytes, not string length', () => {
  const raw = 'é'; // 1 UTF-16 code unit, 2 UTF-8 bytes
  assert.equal(Buffer.byteLength(raw, 'utf8'), 2);
  assert.deepEqual(assertPayloadSize(raw, 2), { ok: true });
  assert.deepEqual(assertPayloadSize(raw, 1), { ok: false, reason: 'payload-too-large' });
});
