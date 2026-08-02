import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  backoffDelaySeconds,
  resolveReconnectResend,
  buildReconnectSocketAuth,
} from './reconnect.mjs';

// Rij 1
test('backoffDelaySeconds: eerste 5 waarden van een verse generator zijn [1, 2, 4, 8, 16]', () => {
  const gen = backoffDelaySeconds();
  const values = [
    gen.next().value,
    gen.next().value,
    gen.next().value,
    gen.next().value,
    gen.next().value,
  ];
  assert.deepEqual(values, [1, 2, 4, 8, 16]);
});

// Rij 2
test('backoffDelaySeconds: 6e, 7e en 10e waarde zijn telkens 30', () => {
  const gen = backoffDelaySeconds();
  for (let i = 0; i < 5; i += 1) gen.next(); // verbruik de ramp-up 1, 2, 4, 8, 16
  const sixth = gen.next().value;
  const seventh = gen.next().value;
  gen.next(); // 8e
  gen.next(); // 9e
  const tenth = gen.next().value;
  assert.equal(sixth, 30);
  assert.equal(seventh, 30);
  assert.equal(tenth, 30);
});

// Rij 3
test('backoffDelaySeconds: twee onafhankelijke generatorinstanties delen geen state', () => {
  const genA = backoffDelaySeconds();
  const genB = backoffDelaySeconds();
  assert.equal(genA.next().value, 1);
  assert.equal(genA.next().value, 2);
  // genB start pas hierna, moet zelf ook bij 1 beginnen ondanks dat genA al
  // twee stappen verder is — geen gedeelde/module-brede state.
  assert.equal(genB.next().value, 1);
  assert.equal(genA.next().value, 4);
  assert.equal(genB.next().value, 2);
});

// Rij 4
test('backoffDelaySeconds: 50 achtereenvolgende .next()-aanroepen, nooit done, altijd een eindig getal', () => {
  const gen = backoffDelaySeconds();
  for (let i = 0; i < 50; i += 1) {
    const { value, done } = gen.next();
    assert.equal(done, false);
    assert.equal(typeof value, 'number');
    assert.ok(Number.isFinite(value));
  }
});

// Rij 5
test('resolveReconnectResend: pendingAnswer null → { ok: true, resend: false }', () => {
  assert.deepEqual(resolveReconnectResend(null), { ok: true, resend: false });
});

// Rij 6
test('resolveReconnectResend: reeds ge-ackt antwoord → { ok: true, resend: false }', () => {
  assert.deepEqual(resolveReconnectResend({ actionId: 'act_1', ackReceived: true }), {
    ok: true,
    resend: false,
  });
});

// Rij 7
test('resolveReconnectResend: geen ack ontvangen → resend met dezelfde actionId', () => {
  assert.deepEqual(resolveReconnectResend({ actionId: 'act_1', ackReceived: false }), {
    ok: true,
    resend: true,
    actionId: 'act_1',
  });
});

// Rij 8 — ongeldige invoer: string, getal, object zonder actionId/ackReceived, en
// nabijgelegen malvormde varianten. Samen met rij 9 hieronder minstens 15 losse
// node:test-cases, zoals de testtabel voorschrijft.
const invalidPendingAnswers = [
  ['string', 'act_1'],
  ['getal', 42],
  ['boolean true', true],
  ['boolean false', false],
  ['array', ['act_1', true]],
  ['object zonder actionId/ackReceived', {}],
  ['object met alleen actionId', { actionId: 'act_1' }],
  ['object met alleen ackReceived', { ackReceived: false }],
  ['object met lege actionId-string', { actionId: '', ackReceived: false }],
  ['object met numerieke actionId', { actionId: 42, ackReceived: false }],
  ['object met stringy ackReceived', { actionId: 'act_1', ackReceived: 'false' }],
  ['object met ackReceived = null', { actionId: 'act_1', ackReceived: null }],
  ['object met ackReceived = undefined', { actionId: 'act_1', ackReceived: undefined }],
  ['undefined', undefined],
];

for (const [label, pendingAnswer] of invalidPendingAnswers) {
  test(`resolveReconnectResend: ongeldige invoer (${label}) → ok:false, nooit een throw`, () => {
    assert.doesNotThrow(() => resolveReconnectResend(pendingAnswer));
    const result = resolveReconnectResend(pendingAnswer);
    assert.equal(result.ok, false);
    assert.equal(typeof result.reason, 'string');
    assert.ok(result.reason.length > 0);
  });
}

// Rij 9 — shape-toets over minstens 10 willekeurige actionId-waarden: bij
// resend:true is actionId altijd exact gelijk aan pendingAnswer.actionId.
const actionIdSamples = [
  'act_1',
  'act_2',
  'act_xyz',
  'action-with-dashes',
  'ACTION_UPPER',
  '12345',
  'a',
  `act_${'x'.repeat(50)}`,
  'unicode-🚀-id',
  'act.with.dots',
];

for (const actionId of actionIdSamples) {
  test(`resolveReconnectResend: resend:true behoudt exact actionId "${actionId}"`, () => {
    const result = resolveReconnectResend({ actionId, ackReceived: false });
    assert.deepEqual(result, { ok: true, resend: true, actionId });
  });
}

// Rij 10
test('buildReconnectSocketAuth: geldige sessionToken, fake validator geeft payload terug als { ok: true, payload }', () => {
  const fakeValidate = (payload) => ({ ok: true, payload });
  const result = buildReconnectSocketAuth('tok_abc123', fakeValidate);
  assert.deepEqual(result, {
    ok: true,
    payload: { sessionToken: 'tok_abc123', protocolVersion: 'v1' },
  });
});

// Rij 11
test('buildReconnectSocketAuth: fake validator wijst af → afwijzing ongewijzigd doorgegeven', () => {
  const fakeValidate = () => ({ ok: false, reason: 'TOKEN_INVALID' });
  const result = buildReconnectSocketAuth('tok_abc123', fakeValidate);
  assert.deepEqual(result, { ok: false, reason: 'TOKEN_INVALID' });
});

// Rij 12
test('buildReconnectSocketAuth: injectie-toets — resultaat volgt telkens de geïnjecteerde validator', () => {
  const acceptingValidator = (payload) => ({ ok: true, payload });
  const rejectingValidator = () => ({ ok: false, reason: 'SESSION_REVOKED' });

  const acceptedResult = buildReconnectSocketAuth('tok_same', acceptingValidator);
  const rejectedResult = buildReconnectSocketAuth('tok_same', rejectingValidator);

  assert.deepEqual(acceptedResult, {
    ok: true,
    payload: { sessionToken: 'tok_same', protocolVersion: 'v1' },
  });
  assert.deepEqual(rejectedResult, { ok: false, reason: 'SESSION_REVOKED' });
});
