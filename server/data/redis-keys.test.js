'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  roomsActiveKey,
  roomCodeLookupKey,
  roomInviteLookupKey,
  sessionTokenLookupKey,
  roomKey,
  roomSessionsKey,
  roomPlayersKey,
  matchKey,
  roundKey,
  answersKey,
  scoreboardKey,
  revokedSessionsKey,
  actionCacheKey,
} = require('./redis-keys');

describe('globale sessietoken-index — INTB-10 (+ INT-18)', () => {
  // INT-18-les (AGENTS.md-aanbeveling van DT): fixtures komen uit de échte
  // producerende functie, niet uit een handgeschreven waarde die er ongeveer
  // op lijkt. De oude fixture 'v1_abc123' kon de bug (':' in de echte
  // hashToken-uitvoer `v1:<hex>`) principieel niet raken.
  test('sessionTokenLookupKey accepteert de échte hashToken-uitvoer (INT-18)', async () => {
    const { hashToken } = await import('../protocol/auth-session.mjs');
    const realHash = hashToken('een-testtoken-van-voldoende-lengte-12345', {
      version: 'v1',
      pepper: 'test-pepper-1234567890',
    });
    assert.ok(realHash.includes(':'), 'precondition: echte opslagvorm bevat de versiescheider');
    assert.strictEqual(sessionTokenLookupKey(realHash), `session:token:${realHash}`);
    assert.strictEqual(sessionTokenLookupKey.length, 1);
  });

  test('sessionTokenLookupKey weigert lege en glob-onveilige segmenten (":" mag: laatste segment)', () => {
    for (const invalid of ['', 'a*b', 'a?b', 'a[b', 'a]b']) {
      assert.throws(() => sessionTokenLookupKey(invalid), TypeError);
    }
    // ':' is in het LAATSTE sleutelsegment niet dubbelzinnig en dus toegestaan
    // — dit is precies INT-18.
    assert.strictEqual(sessionTokenLookupKey('v1:abc'), 'session:token:v1:abc');
  });
});

describe('sleutelpatronen — happy path, exact match met DATA-MODEL.md #1-11', () => {
  const cases = [
    { n: 1, label: 'roomsActiveKey()', call: () => roomsActiveKey(), expected: 'rooms:active' },
    { n: 2, label: 'roomCodeLookupKey', call: () => roomCodeLookupKey('482917'), expected: 'room:code:482917' },
    { n: 3, label: 'roomInviteLookupKey', call: () => roomInviteLookupKey('N4x7pQm2K8tW'), expected: 'room:invite:N4x7pQm2K8tW' },
    { n: 4, label: 'roomKey', call: () => roomKey('room_1'), expected: 'room:room_1' },
    { n: 5, label: 'roomSessionsKey', call: () => roomSessionsKey('room_1'), expected: 'room:room_1:sessions' },
    { n: 6, label: 'roomPlayersKey', call: () => roomPlayersKey('room_1'), expected: 'room:room_1:players' },
    { n: 7, label: 'matchKey', call: () => matchKey('room_1', 'match_1'), expected: 'room:room_1:match:match_1' },
    { n: 8, label: 'roundKey', call: () => roundKey('room_1', 'match_1', 'round_07'), expected: 'room:room_1:match:match_1:round:round_07' },
    { n: 9, label: 'answersKey (roundId-aanname, zie module-commentaar)', call: () => answersKey('room_1', 'match_1', 'round_07'), expected: 'room:room_1:match:match_1:answers:round_07' },
    { n: 10, label: 'scoreboardKey', call: () => scoreboardKey('room_1', 'match_1'), expected: 'room:room_1:match:match_1:scoreboard' },
    { n: 11, label: 'revokedSessionsKey', call: () => revokedSessionsKey('room_1'), expected: 'room:room_1:revoked-sessions' },
  ];

  for (const c of cases) {
    test(`#${c.n} ${c.label}`, () => {
      assert.strictEqual(c.call(), c.expected);
    });
  }
});

describe('actionCacheKey is room-scoped — regressietest REVIEW.md bevinding 1 #12-13', () => {
  test('#12 actionCacheKey(roomId) -> room:{roomId}:action-cache', () => {
    assert.strictEqual(actionCacheKey('room_1'), 'room:room_1:action-cache');
  });

  test('#13 actionCacheKey heeft arity 1 (geen matchId-parameter)', () => {
    assert.strictEqual(actionCacheKey.length, 1);
  });
});

describe('invoervalidatie — lege en ongeldige segmenten, alle single-segment builders #14-57', () => {
  const invalidSegments = ['', 'a:b', 'a*b', 'a?b', 'a[b', 'a]b'];

  const singleSegmentBuilders = [
    ['roomCodeLookupKey', roomCodeLookupKey],
    ['roomInviteLookupKey', roomInviteLookupKey],
    ['roomKey', roomKey],
    ['roomSessionsKey', roomSessionsKey],
    ['roomPlayersKey', roomPlayersKey],
    ['revokedSessionsKey', revokedSessionsKey],
    ['actionCacheKey', actionCacheKey],
  ];

  let n = 14;
  for (const [label, fn] of singleSegmentBuilders) {
    for (const bad of invalidSegments) {
      const caseNum = n++;
      test(`#${caseNum} ${label}(${JSON.stringify(bad)}) -> TypeError`, () => {
        assert.throws(() => fn(bad), TypeError);
      });
    }
  }

  test(`#${n++} roomCodeLookupKey(123) (niet-string) -> TypeError`, () => {
    assert.throws(() => roomCodeLookupKey(123), TypeError);
  });

  test(`#${n++} roomKey(undefined) -> TypeError`, () => {
    assert.throws(() => roomKey(undefined), TypeError);
  });
});

describe('invoervalidatie — multi-segment builders (matchKey, roundKey, answersKey, scoreboardKey) #58-65', () => {
  let n = 58;

  test(`#${n++} matchKey met ongeldig eerste segment -> TypeError`, () => {
    assert.throws(() => matchKey('a:b', 'match_1'), TypeError);
  });

  test(`#${n++} matchKey met ongeldig tweede segment -> TypeError`, () => {
    assert.throws(() => matchKey('room_1', 'a:b'), TypeError);
  });

  test(`#${n++} roundKey met leeg derde segment -> TypeError`, () => {
    assert.throws(() => roundKey('room_1', 'match_1', ''), TypeError);
  });

  test(`#${n++} roundKey met glob-teken in tweede segment -> TypeError`, () => {
    assert.throws(() => roundKey('room_1', 'a*b', 'round_1'), TypeError);
  });

  test(`#${n++} answersKey met ongeldig eerste segment -> TypeError`, () => {
    assert.throws(() => answersKey('a*b', 'match_1', 'round_1'), TypeError);
  });

  test(`#${n++} answersKey met ongeldig derde segment -> TypeError`, () => {
    assert.throws(() => answersKey('room_1', 'match_1', 'a]b'), TypeError);
  });

  test(`#${n++} scoreboardKey met ongeldig tweede segment -> TypeError`, () => {
    assert.throws(() => scoreboardKey('room_1', 'a]b'), TypeError);
  });

  test(`#${n++} scoreboardKey met niet-string eerste segment -> TypeError`, () => {
    assert.throws(() => scoreboardKey(42, 'match_1'), TypeError);
  });
});
