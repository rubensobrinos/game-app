import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveRoute } from './route-resolver.mjs';

test('/ resolves to home', () => {
  assert.deepStrictEqual(resolveRoute('/'), { route: 'home' });
});

test('/j/{inviteId} resolves to join', () => {
  assert.deepStrictEqual(resolveRoute('/j/N4x7pQm2K8tW'), {
    route: 'join',
    inviteId: 'N4x7pQm2K8tW',
  });
});

test('/game/{code} resolves to game', () => {
  assert.deepStrictEqual(resolveRoute('/game/482917'), { route: 'game', code: '482917' });
});

test('/host/{code} resolves to host', () => {
  assert.deepStrictEqual(resolveRoute('/host/482917'), { route: 'host', code: '482917' });
});

test('/screen/{code} resolves to screen', () => {
  assert.deepStrictEqual(resolveRoute('/screen/482917'), { route: 'screen', code: '482917' });
});

test('a single trailing slash after a valid code is ignored', () => {
  assert.deepStrictEqual(resolveRoute('/game/482917/'), { route: 'game', code: '482917' });
});

test('search is ignored and never changes the route', () => {
  assert.deepStrictEqual(resolveRoute('/game/482917', '?utm_source=whatsapp'), {
    route: 'game',
    code: '482917',
  });
});

test('matching is case-sensitive: /JOIN/foo', () => {
  assert.deepStrictEqual(resolveRoute('/JOIN/foo'), { route: 'unknown' });
});

test('matching is case-sensitive: /Game/482917', () => {
  assert.deepStrictEqual(resolveRoute('/Game/482917'), { route: 'unknown' });
});

test('no prefix-fuzzy-match: /g/482917', () => {
  assert.deepStrictEqual(resolveRoute('/g/482917'), { route: 'unknown' });
});

test('no prefix-fuzzy-match: /hosts/482917', () => {
  assert.deepStrictEqual(resolveRoute('/hosts/482917'), { route: 'unknown' });
});

test('code must be exactly 6 digits: non-numeric code', () => {
  assert.deepStrictEqual(resolveRoute('/game/foo'), { route: 'unknown' });
});

test('code must be exactly 6 digits: 5-digit code', () => {
  assert.deepStrictEqual(resolveRoute('/game/12345'), { route: 'unknown' });
});

test('code must be exactly 6 digits: 7-digit code', () => {
  assert.deepStrictEqual(resolveRoute('/game/1234567'), { route: 'unknown' });
});

test('code must be exactly 6 digits: 6 chars but not all digits', () => {
  assert.deepStrictEqual(resolveRoute('/game/12345a'), { route: 'unknown' });
});

test('encoded traversal-like segment: no decoding, no second resolve attempt', () => {
  assert.deepStrictEqual(resolveRoute('/game/..%2Fhost%2F482917'), { route: 'unknown' });
});

test('/j/ without an identifier', () => {
  assert.deepStrictEqual(resolveRoute('/j/'), { route: 'unknown' });
});

test('/game/ without an identifier', () => {
  assert.deepStrictEqual(resolveRoute('/game/'), { route: 'unknown' });
});

test('/host/ without an identifier', () => {
  assert.deepStrictEqual(resolveRoute('/host/'), { route: 'unknown' });
});

test('/screen/ without an identifier', () => {
  assert.deepStrictEqual(resolveRoute('/screen/'), { route: 'unknown' });
});

test('a full URL with scheme and host is unknown, not a throw', () => {
  assert.deepStrictEqual(resolveRoute('https://play.aseso.nl/game/482917'), {
    route: 'unknown',
  });
});

test('null pathname is unknown, not a throw', () => {
  assert.deepStrictEqual(resolveRoute(null), { route: 'unknown' });
});

test('empty string pathname is unknown, not a throw', () => {
  assert.deepStrictEqual(resolveRoute(''), { route: 'unknown' });
});

test('a pathname without a leading slash is unknown, not a throw', () => {
  assert.deepStrictEqual(resolveRoute('game/482917'), { route: 'unknown' });
});

test('shape invariant: a host route result has only route and code keys', () => {
  const result = resolveRoute('/host/482917');
  assert.deepStrictEqual(Object.keys(result).sort(), ['code', 'route']);
  assert.strictEqual('role' in result, false);
  assert.strictEqual('isHost' in result, false);
});

// Beyond the required table: additional cases the input contract calls out
// explicitly (no silent cleanup of double slashes/extra segments; undefined
// input; a literal separator breaking an inviteId match).

test('undefined pathname is unknown, not a throw', () => {
  assert.deepStrictEqual(resolveRoute(undefined), { route: 'unknown' });
});

test('double slash before the identifier is not silently cleaned up', () => {
  assert.deepStrictEqual(resolveRoute('/game//482917'), { route: 'unknown' });
});

test('a double trailing slash is not silently cleaned up', () => {
  assert.deepStrictEqual(resolveRoute('/game/482917//'), { route: 'unknown' });
});

test('an extra path segment after the code is unknown', () => {
  assert.deepStrictEqual(resolveRoute('/game/482917/extra'), { route: 'unknown' });
});

test('a literal slash inside the inviteId segment breaks the match', () => {
  assert.deepStrictEqual(resolveRoute('/j/abc/def'), { route: 'unknown' });
});

test('an encoded slash (%2F) inside the inviteId segment breaks the match', () => {
  assert.deepStrictEqual(resolveRoute('/j/abc%2Fdef'), { route: 'unknown' });
});

test('a single trailing slash after a join inviteId is ignored, same as game/host/screen', () => {
  assert.deepStrictEqual(resolveRoute('/j/N4x7pQm2K8tW/'), {
    route: 'join',
    inviteId: 'N4x7pQm2K8tW',
  });
});

test('a literal # inside the pathname is not a valid code/inviteId character', () => {
  assert.deepStrictEqual(resolveRoute('/game/482917#section'), { route: 'unknown' });
});
