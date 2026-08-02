import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shareUrlsFor, joinSourceFor, shareActionsFor, canNewJoinerUse } from './share-actions.mjs';

test('1. shareUrlsFor appends ?src=qr and ?src=shared_link, rest of the URL intact', () => {
  const { qrUrl, copyUrl } = shareUrlsFor('https://play.aseso.nl/j/N4x7pQm2K8tW');
  assert.strictEqual(qrUrl, 'https://play.aseso.nl/j/N4x7pQm2K8tW?src=qr');
  assert.strictEqual(copyUrl, 'https://play.aseso.nl/j/N4x7pQm2K8tW?src=shared_link');
});

test('2. shareUrlsFor with an existing querystring uses &src=..., never a double ?', () => {
  const { qrUrl, copyUrl } = shareUrlsFor('https://play.aseso.nl/j/N4x7pQm2K8tW?foo=bar');
  assert.strictEqual(qrUrl, 'https://play.aseso.nl/j/N4x7pQm2K8tW?foo=bar&src=qr');
  assert.strictEqual(copyUrl, 'https://play.aseso.nl/j/N4x7pQm2K8tW?foo=bar&src=shared_link');
});

test('3. joinSourceFor reads back the two known src values', () => {
  assert.strictEqual(joinSourceFor('?src=qr'), 'qr');
  assert.strictEqual(joinSourceFor('?src=shared_link'), 'shared_link');
});

test('4. joinSourceFor is unknown for empty, undefined, bogus, and unrelated search strings', () => {
  assert.strictEqual(joinSourceFor(''), 'unknown');
  assert.strictEqual(joinSourceFor(undefined), 'unknown');
  assert.strictEqual(joinSourceFor('?src=bogus'), 'unknown');
  assert.strictEqual(joinSourceFor('?utm_source=whatsapp'), 'unknown');
});

test('5. round trip: joinSourceFor(new URL(shareUrlsFor(url).qrUrl).search) is qr', () => {
  const url = 'https://play.aseso.nl/j/N4x7pQm2K8tW';
  const { qrUrl } = shareUrlsFor(url);
  assert.strictEqual(joinSourceFor(new URL(qrUrl).search), 'qr');
});

test('6. shareActionsFor with native share available includes it in the fixed order', () => {
  assert.deepStrictEqual(shareActionsFor({ nativeShareAvailable: true }), [
    'show-qr',
    'native-share',
    'copy-link',
    'show-code',
  ]);
});

test('7. shareActionsFor without native share omits it entirely', () => {
  assert.deepStrictEqual(shareActionsFor({ nativeShareAvailable: false }), [
    'show-qr',
    'copy-link',
    'show-code',
  ]);
});

test('8. shareActionsFor(null) and shareActionsFor({}) behave as nativeShareAvailable: false, no throw', () => {
  const expected = ['show-qr', 'copy-link', 'show-code'];
  assert.deepStrictEqual(shareActionsFor(null), expected);
  assert.deepStrictEqual(shareActionsFor({}), expected);
});

test('9. canNewJoinerUse: unlocked, late join allowed, game not started yet', () => {
  assert.strictEqual(
    canNewJoinerUse({ locked: false, allowLateJoin: true, gameHasStarted: false }),
    true,
  );
});

test('10. canNewJoinerUse: locked wins even when late join is allowed and the game has not started', () => {
  assert.strictEqual(
    canNewJoinerUse({ locked: true, allowLateJoin: true, gameHasStarted: false }),
    false,
  );
});

test('11. canNewJoinerUse: game started, late join disabled', () => {
  assert.strictEqual(
    canNewJoinerUse({ locked: false, allowLateJoin: false, gameHasStarted: true }),
    false,
  );
});

test('12. canNewJoinerUse: late join is not yet relevant before the game starts', () => {
  assert.strictEqual(
    canNewJoinerUse({ locked: false, allowLateJoin: false, gameHasStarted: false }),
    true,
  );
});

test('13. canNewJoinerUse: game started, late join allowed', () => {
  assert.strictEqual(
    canNewJoinerUse({ locked: false, allowLateJoin: true, gameHasStarted: true }),
    true,
  );
});

test('14. canNewJoinerUse(null) and canNewJoinerUse({}) are false, no throw', () => {
  assert.strictEqual(canNewJoinerUse(null), false);
  assert.strictEqual(canNewJoinerUse({}), false);
});
