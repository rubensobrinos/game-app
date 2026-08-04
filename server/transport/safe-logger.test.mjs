// Tests voor de gedeelde veilige logger (INT4a deel 2).
//
// Twee dingen worden hier bewezen, en het tweede is het punt: elk TOEGESTAAN
// veld komt aantoonbaar door, én een onbekend veld wordt aantoonbaar
// weggegooid. Een test die alleen het tweede doet bewijst niets — een logger
// die álles weggooit haalt hem ook.

import assert from 'node:assert/strict';
import test from 'node:test';

import { ALL_ERROR_CODES } from '../protocol/error-codes.mjs';
import {
  LOGGABLE_FIELDS,
  LOG_SOURCES,
  OUTCOME,
  UNSAFE_VALUE,
  classifyOutcome,
  createSafeLogger,
  errorLabel,
  pickSafeFields,
  safeFastifyOptions,
  withSafeSerializers,
} from './safe-logger.mjs';

/** Vangt op wat er werkelijk de logger uit komt. */
function makeCapturingLogger() {
  /** @type {Array<{ level: string, record: object, message: string }>} */
  const lines = [];
  return {
    lines,
    logger: {
      info: (record, message) => lines.push({ level: 'info', record, message }),
      warn: (record, message) => lines.push({ level: 'warn', record, message }),
      error: (record, message) => lines.push({ level: 'error', record, message }),
    },
  };
}

/**
 * Eén geldige waarde per toegestaan veld, in de vorm die de guard eist. Bewust
 * met de hand geschreven en niet afgeleid: als iemand een guard versoepelt,
 * moet die versoepeling hier zichtbaar worden.
 */
const VALID_VALUE_BY_FIELD = Object.freeze({
  roomId: 'room_K-0uiRYO98y2',
  sessionId: 'sess_abc123',
  requestId: 'req-7',
  actionId: 'act_lock_1',
  eventId: 'evt_9f8e7d',
  event: 'room:player-changed',
  code: 'INVALID_PHASE',
  outcome: OUTCOME.PHASE_RACE_LOST,
  reason: 'ECONNREFUSED',
  method: 'POST',
  expectedPhase: 'ROUND_RESULT',
  actualPhase: 'SCOREBOARD',
  source: 'timer',
  layer: 'socket',
  port: 3000,
  signal: 'SIGTERM',
  store: 'redis',
  endpoint: 'redis://***@127.0.0.1:6379',
});

// ─────────────────────────────────────────────────────────────────────────────
// De allowlist
// ─────────────────────────────────────────────────────────────────────────────

test('allowlist: elk toegestaan veld komt aantoonbaar door', () => {
  // OPZETCONTROLE EERST: de tabel hierboven moet de volledige allowlist dekken,
  // anders bewijst de assertie hieronder alleen iets over de velden die iemand
  // toevallig heeft opgeschreven.
  assert.deepEqual(
    Object.keys(VALID_VALUE_BY_FIELD).sort(),
    [...LOGGABLE_FIELDS].sort(),
    'de testtabel moet exact de allowlist dekken',
  );

  const safe = pickSafeFields({ ...VALID_VALUE_BY_FIELD });

  assert.deepEqual(safe, VALID_VALUE_BY_FIELD, 'elk toegestaan veld hoort ongewijzigd door te komen');
  for (const field of LOGGABLE_FIELDS) {
    assert.ok(Object.hasOwn(safe, field), `veld "${field}" is weggevallen`);
    assert.notEqual(safe[field], UNSAFE_VALUE, `veld "${field}" haalde zijn eigen vormtoets niet`);
  }

  // De minimale set die INT4a expliciet eist, apart genoemd zodat een
  // toekomstige inperking hier struikelt en niet stilzwijgend slaagt.
  for (const field of [
    'roomId', 'sessionId', 'requestId', 'actionId', 'eventId',
    'event', 'code', 'outcome', 'reason', 'method',
    'expectedPhase', 'actualPhase', 'source', 'layer',
  ]) {
    assert.ok(LOGGABLE_FIELDS.includes(field), `"${field}" hoort in de allowlist`);
  }
});

test('allowlist: een onbekend veld wordt aantoonbaar weggegooid', () => {
  const safe = pickSafeFields({
    roomId: 'room_1',
    // Alles hieronder is het soort veld dat iemand "even" meegeeft.
    sessionToken: 'tok_geheim',
    displayName: 'Jan Jansen',
    gameCode: '123456',
    inviteId: 'inv_abcdef',
    ip: '203.0.113.9',
    headers: { authorization: 'Bearer tok_geheim' },
    answer: { optionId: 'NL' },
    stack: 'Error: boem\n    at x',
  });

  assert.deepEqual(safe, { roomId: 'room_1' }, 'alleen het toegestane veld blijft over');
  const serialized = JSON.stringify(safe);
  for (const secret of ['tok_geheim', 'Jan Jansen', '123456', 'inv_abcdef', '203.0.113.9', 'boem']) {
    assert.ok(!serialized.includes(secret), `de waarde "${secret}" mag nergens in de logregel staan`);
  }
});

test('allowlist: een toegestaan veld met een verkeerde VORM wordt vervangen, niet doorgegeven', () => {
  // Dit is het gat dat een allowlist op NAAM alleen niet dicht: `reason` staat
  // op de lijst, dus een `error.message` zou er zo doorheen glippen.
  const safe = pickSafeFields({
    reason: 'Verbinden met Redis op redis://user:wachtwoord@host:6379 is mislukt',
    event: 'ik ben Jan en dit is mijn naam',
    actionId: 'Jan Jansen speelt mee',
    code: 'niet eens schreeuwend',
    source: 'iemand-anders',
    layer: 'stiekem',
    port: 'geen poort',
  });

  for (const [field, value] of Object.entries(safe)) {
    assert.equal(value, UNSAFE_VALUE, `veld "${field}" had vervangen moeten worden`);
  }
  const serialized = JSON.stringify(safe);
  assert.ok(!serialized.includes('wachtwoord'));
  assert.ok(!serialized.includes('Jan'));
});

test('allowlist: `source` heeft een gesloten waardeverzameling', () => {
  assert.deepEqual([...LOG_SOURCES].sort(), ['host', 'recovery', 'timer']);
  for (const source of LOG_SOURCES) {
    assert.equal(pickSafeFields({ source }).source, source);
  }
  assert.equal(pickSafeFields({ source: 'client' }).source, UNSAFE_VALUE);
});

// ─────────────────────────────────────────────────────────────────────────────
// De binding
// ─────────────────────────────────────────────────────────────────────────────

test('createSafeLogger stempelt de laag en laat die niet vervalsen', () => {
  const { lines, logger } = makeCapturingLogger();
  const logSafe = createSafeLogger({ logger, layer: 'rest' });

  logSafe('warn', 'verzoek afgewezen', { roomId: 'room_1', layer: 'socket', code: 'NOT_HOST' });

  assert.equal(lines.length, 1);
  assert.equal(lines[0].level, 'warn');
  assert.equal(lines[0].message, 'verzoek afgewezen');
  assert.deepEqual(lines[0].record, { roomId: 'room_1', layer: 'rest', code: 'NOT_HOST' });
});

test('createSafeLogger weigert een onbekende laag', () => {
  assert.throws(() => createSafeLogger({ logger: null, layer: 'database' }), TypeError);
});

test('createSafeLogger zonder logger schrijft nergens heen en werpt niet', () => {
  const logSafe = createSafeLogger({ logger: null, layer: 'server' });
  assert.doesNotThrow(() => logSafe('info', 'stil', { port: 3000 }));
});

// ─────────────────────────────────────────────────────────────────────────────
// Labels en classificatie
// ─────────────────────────────────────────────────────────────────────────────

test('errorLabel geeft een stabiele klasse, nooit een message of stacktrace', () => {
  const error = new TypeError('dit is een gevoelige melding over Jan');
  assert.equal(errorLabel(error), 'TypeError');
  assert.equal(errorLabel(Object.assign(new Error('x'), { code: 'ECONNREFUSED' })), 'ECONNREFUSED');
  assert.equal(errorLabel('niet eens een object'), 'unknown');
  assert.equal(errorLabel(null), 'unknown');
});

test('classifyOutcome geeft interne codes hun eigen label en publieke codes "rejected"', () => {
  // De kern van INT4a deel 3: `toPublicErrorCode()` maakt van allebei
  // `INVALID_PHASE`, waardoor het log niet meer laat zien wat er echt gebeurde.
  assert.equal(classifyOutcome('PHASE_RACE_LOST'), 'phase_race_lost');
  // Dezelfde vermomming trof `INTERNAL_ERROR_CODES` uit state-machine.js.
  assert.equal(classifyOutcome('INVALID_PAUSE_STATE'), 'invalid_pause_state');
  // Een toekomstige interne code krijgt vanzelf zijn eigen label: dit is een
  // allowlist-toets tegen ALL_ERROR_CODES, geen lijstje bekende namen.
  assert.equal(classifyOutcome('EEN_NOG_NIET_BEDACHTE_INTERNE_CODE'), 'een_nog_niet_bedachte_interne_code');
  for (const code of ALL_ERROR_CODES) {
    assert.equal(classifyOutcome(code), OUTCOME.REJECTED, `${code} is gepubliceerd en dus "rejected"`);
  }
  assert.equal(classifyOutcome(undefined), OUTCOME.SERVER_ERROR);
});

// ─────────────────────────────────────────────────────────────────────────────
// Fastify/Pino — de logweg die niemand schrijft
// ─────────────────────────────────────────────────────────────────────────────

test('de veilige serializers laten headers, url, remote address en stacktrace vallen', () => {
  const { serializers } = withSafeSerializers({ level: 'trace' });

  const req = serializers.req({
    id: 'req-3',
    method: 'POST',
    url: '/api/v1/games/123456/state',
    headers: { authorization: 'Bearer tok_geheim', 'x-forwarded-for': '203.0.113.9' },
    ip: '203.0.113.9',
    remoteAddress: '203.0.113.9',
    body: { displayName: 'Jan Jansen' },
  });
  assert.deepEqual(req, { id: 'req-3', method: 'POST' });

  const res = serializers.res({ statusCode: 500, getHeaders: () => ({ 'set-cookie': 'x' }) });
  assert.deepEqual(res, { statusCode: 500 });

  const err = serializers.err(new RangeError('gevoelige melding'));
  assert.deepEqual(err, { type: 'RangeError' });

  const serialized = JSON.stringify({ req, res, err });
  for (const secret of ['tok_geheim', '203.0.113.9', 'Jan Jansen', 'gevoelige melding', '123456']) {
    assert.ok(!serialized.includes(secret), `"${secret}" mag niet door de serializer komen`);
  }
});

test('withSafeSerializers laat een uitgezette logger uit staan', () => {
  assert.equal(withSafeSerializers(false), false);
  assert.equal(withSafeSerializers(undefined), false);
  assert.equal(withSafeSerializers(true).serializers.err(new Error('x')).type, 'Error');
});

test('safeFastifyOptions zet de automatische requestlogging uit, per instantie', () => {
  const first = safeFastifyOptions();
  const second = safeFastifyOptions();
  assert.equal(first.logController.isLogDisabled({}), true);
  assert.notEqual(first.logController, second.logController, 'de controller draagt state en is nooit gedeeld');
});
