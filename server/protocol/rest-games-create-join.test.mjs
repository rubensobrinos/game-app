import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateCreateGameRequest,
  validateCreateGameResponse,
  hostParticipatesInvariantHolds,
  validateJoinGameRequest,
  validateJoinGameResponse,
} from './rest-games-create-join.mjs';

// Exacte voorbeeldpayloads, letterlijk overgenomen uit PROTOCOL.md
// §REST-endpoints (niet geparafraseerd).

const CREATE_GAME_REQUEST_FIXTURE = {
  config: {
    preset: 'group_battle',
    language: 'nl',
  },
  hostParticipates: true,
  displayName: null,
};

const CREATE_GAME_RESPONSE_FIXTURE = {
  roomId: 'room_01J...',
  gameCode: '482917',
  inviteId: 'N4x7pQm2K8tW',
  joinUrl: 'https://play.aseso.nl/j/N4x7pQm2K8tW',
  sessionToken: '<secret>',
  roles: ['host', 'player'],
  playerId: 'p_a1b2c3',
  effectiveName: 'Vlugge Vos',
  // docs/openstaand/spelersidentiteit.md, stap 4.
  identity: { country: 'bg', word: 'cow' },
  state: {},
};

const JOIN_GAME_REQUEST_INVITE_FIXTURE = {
  inviteId: 'N4x7pQm2K8tW',
  displayName: null,
  joinSource: 'qr',
};

const JOIN_GAME_REQUEST_CODE_FIXTURE = {
  gameCode: '482917',
  displayName: 'Ruben',
  joinSource: 'code',
};

const JOIN_GAME_RESPONSE_FIXTURE = {
  roomId: 'room_01J...',
  gameCode: '482917',
  sessionToken: '<secret>',
  roles: ['player'],
  playerId: 'p_8f42d1',
  effectiveName: 'Ruben',
  // docs/openstaand/spelersidentiteit.md, stap 4.
  identity: null,
  state: {},
};

// Rij 1 — exacte fixture (hostParticipates: true) -> ok: true.
test('validateCreateGameRequest: exacte fixture (hostParticipates: true) -> ok: true', () => {
  assert.deepEqual(validateCreateGameRequest(CREATE_GAME_REQUEST_FIXTURE), {
    ok: true,
    value: {
      config: { preset: 'group_battle', language: 'nl' },
      hostParticipates: true,
      displayName: null,
    },
  });
});

// Rij 2 — dezelfde fixture met hostParticipates: false, displayName: null -> ok: true.
test('validateCreateGameRequest: hostParticipates false, displayName null -> ok: true', () => {
  const body = { ...CREATE_GAME_REQUEST_FIXTURE, hostParticipates: false, displayName: null };
  assert.deepEqual(validateCreateGameRequest(body), {
    ok: true,
    value: {
      config: { preset: 'group_battle', language: 'nl' },
      hostParticipates: false,
      displayName: null,
    },
  });
});

// Rij 3 — drie losse ongeldige varianten: config ontbreekt; config.preset is
// een getal; hostParticipates is een string i.p.v. boolean.

test('validateCreateGameRequest: config ontbreekt -> ok: false', () => {
  const { config, ...withoutConfig } = CREATE_GAME_REQUEST_FIXTURE;
  assert.equal(validateCreateGameRequest(withoutConfig).ok, false);
});

test('validateCreateGameRequest: config.preset is een getal i.p.v. string -> ok: false', () => {
  const body = { ...CREATE_GAME_REQUEST_FIXTURE, config: { preset: 123, language: 'nl' } };
  assert.equal(validateCreateGameRequest(body).ok, false);
});

test('validateCreateGameRequest: hostParticipates is een string i.p.v. boolean -> ok: false', () => {
  const body = { ...CREATE_GAME_REQUEST_FIXTURE, hostParticipates: 'true' };
  assert.equal(validateCreateGameRequest(body).ok, false);
});

// Rij 4 — displayName: 'Ruben' -> ok: true, waarde 'Ruben' (via
// normalizeAndValidateDisplayName).
test('validateCreateGameRequest: displayName "Ruben" -> ok: true, waarde "Ruben"', () => {
  const body = { ...CREATE_GAME_REQUEST_FIXTURE, displayName: 'Ruben' };
  const result = validateCreateGameRequest(body);
  assert.equal(result.ok, true);
  assert.equal(result.value.displayName, 'Ruben');
});

// Rij 9 — exacte fixture-response (hostParticipates: true) -> ok: true.
test('validateCreateGameResponse: exacte fixture-response -> ok: true', () => {
  assert.deepEqual(validateCreateGameResponse(CREATE_GAME_RESPONSE_FIXTURE), {
    ok: true,
    value: {
      roomId: 'room_01J...',
      gameCode: '482917',
      inviteId: 'N4x7pQm2K8tW',
      joinUrl: 'https://play.aseso.nl/j/N4x7pQm2K8tW',
      sessionToken: '<secret>',
      roles: ['host', 'player'],
      playerId: 'p_a1b2c3',
      effectiveName: 'Vlugge Vos',
      identity: { country: 'bg', word: 'cow' },
      state: {},
    },
  });
});

// Rij 10 — validateCreateGameResponse + hostParticipatesInvariantHolds:
// request { hostParticipates: false } met response { playerId: null,
// effectiveName: null } -> response geldig, invariant houdt stand.
test('validateCreateGameResponse + hostParticipatesInvariantHolds: hostParticipates false, playerId/effectiveName null -> beide geldig', () => {
  const response = {
    ...CREATE_GAME_RESPONSE_FIXTURE,
    roles: ['host'],
    playerId: null,
    effectiveName: null,
    identity: null,
  };
  const validation = validateCreateGameResponse(response);
  assert.equal(validation.ok, true);
  assert.equal(
    hostParticipatesInvariantHolds({ hostParticipates: false }, { playerId: null, effectiveName: null }),
    true,
  );
});

// Rij 11 — hostParticipatesInvariantHolds: request { hostParticipates: false }
// met response { playerId: 'p_a1b2c3', effectiveName: 'Vlugge Vos' } -> false
// (schending).
test('hostParticipatesInvariantHolds: hostParticipates false maar playerId/effectiveName niet-null -> false', () => {
  assert.equal(
    hostParticipatesInvariantHolds(
      { hostParticipates: false },
      { playerId: 'p_a1b2c3', effectiveName: 'Vlugge Vos' },
    ),
    false,
  );
});

// Rij 12 — hostParticipatesInvariantHolds: request { hostParticipates: true }
// met response { playerId: null, effectiveName: null } -> false (schending).
test('hostParticipatesInvariantHolds: hostParticipates true maar playerId/effectiveName null -> false', () => {
  assert.equal(
    hostParticipatesInvariantHolds({ hostParticipates: true }, { playerId: null, effectiveName: null }),
    false,
  );
});

// Rij 13 — drie losse ongeldige varianten: joinUrl: 'not-a-url';
// roles: ['host', 'admin'] (onbekende rol); gameCode: '12345' (5 cijfers).

test('validateCreateGameResponse: joinUrl "not-a-url" -> ok: false', () => {
  const body = { ...CREATE_GAME_RESPONSE_FIXTURE, joinUrl: 'not-a-url' };
  assert.equal(validateCreateGameResponse(body).ok, false);
});

test('validateCreateGameResponse: roles bevat onbekende rol "admin" -> ok: false', () => {
  const body = { ...CREATE_GAME_RESPONSE_FIXTURE, roles: ['host', 'admin'] };
  assert.equal(validateCreateGameResponse(body).ok, false);
});

test('validateCreateGameResponse: gameCode "12345" (5 cijfers) -> ok: false', () => {
  const body = { ...CREATE_GAME_RESPONSE_FIXTURE, gameCode: '12345' };
  assert.equal(validateCreateGameResponse(body).ok, false);
});

// Rij 14 — beide exacte fixtures uit Brondocument (inviteId-variant en
// gameCode-variant) -> stuk voor stuk ok: true.

test('validateJoinGameRequest: exacte inviteId-fixture -> ok: true', () => {
  assert.deepEqual(validateJoinGameRequest(JOIN_GAME_REQUEST_INVITE_FIXTURE), {
    ok: true,
    value: { inviteId: 'N4x7pQm2K8tW', displayName: null, joinSource: 'qr' },
  });
});

test('validateJoinGameRequest: exacte gameCode-fixture -> ok: true', () => {
  assert.deepEqual(validateJoinGameRequest(JOIN_GAME_REQUEST_CODE_FIXTURE), {
    ok: true,
    value: { gameCode: '482917', displayName: 'Ruben', joinSource: 'code' },
  });
});

// Rij 15 — body met zowel inviteId als gameCode; body met geen van beide ->
// stuk voor stuk ok: false, code INVITE_INVALID.

test('validateJoinGameRequest: zowel inviteId als gameCode aanwezig -> ok: false, INVITE_INVALID', () => {
  const body = {
    inviteId: 'N4x7pQm2K8tW',
    gameCode: '482917',
    displayName: null,
    joinSource: 'qr',
  };
  assert.deepEqual(validateJoinGameRequest(body), { ok: false, code: 'INVITE_INVALID' });
});

test('validateJoinGameRequest: geen van beide (inviteId/gameCode) aanwezig -> ok: false, INVITE_INVALID', () => {
  const body = { displayName: null, joinSource: 'qr' };
  assert.deepEqual(validateJoinGameRequest(body), { ok: false, code: 'INVITE_INVALID' });
});

// Rij 16 — joinSource elk van 'qr', 'shared_link', 'code', 'unknown' -> stuk
// voor stuk ok: true (vier losse tests).

const validJoinSources = ['qr', 'shared_link', 'code', 'unknown'];

for (const joinSource of validJoinSources) {
  test(`validateJoinGameRequest: joinSource "${joinSource}" -> ok: true`, () => {
    const body = { ...JOIN_GAME_REQUEST_INVITE_FIXTURE, joinSource };
    const result = validateJoinGameRequest(body);
    assert.equal(result.ok, true);
    assert.equal(result.value.joinSource, joinSource);
  });
}

// Rij 17 — joinSource: 'native' (bestaat wel bij share:opened.method, niet
// bij joinSource) -> ok: false.
test('validateJoinGameRequest: joinSource "native" (onbekend voor joinSource) -> ok: false', () => {
  const body = { ...JOIN_GAME_REQUEST_INVITE_FIXTURE, joinSource: 'native' };
  assert.equal(validateJoinGameRequest(body).ok, false);
});

// Rij 18 — exacte fixture-response -> ok: true.
test('validateJoinGameResponse: exacte fixture-response -> ok: true', () => {
  assert.deepEqual(validateJoinGameResponse(JOIN_GAME_RESPONSE_FIXTURE), {
    ok: true,
    value: {
      roomId: 'room_01J...',
      gameCode: '482917',
      sessionToken: '<secret>',
      roles: ['player'],
      playerId: 'p_8f42d1',
      effectiveName: 'Ruben',
      identity: null,
      state: {},
    },
  });
});

// Rij 19 — roles: ['host'] i.p.v. ['player'] -> ok: false.
test('validateJoinGameResponse: roles ["host"] i.p.v. ["player"] -> ok: false', () => {
  const body = { ...JOIN_GAME_RESPONSE_FIXTURE, roles: ['host'] };
  assert.equal(validateJoinGameResponse(body).ok, false);
});
