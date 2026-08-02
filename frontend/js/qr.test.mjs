import test from 'node:test';
import assert from 'node:assert/strict';
import { qrDataUrl } from './qr.mjs';

test('qrDataUrl levert een deterministische GIF-data-URL voor een join-URL', () => {
  const url = 'https://play.aseso.nl/j/N4x7pQm2K8tWq3ZrAbCd12';
  const first = qrDataUrl(url);
  assert.match(first, /^data:image\/gif;base64,/);
  assert.equal(qrDataUrl(url), first, 'zelfde invoer moet dezelfde QR geven');
  assert.notEqual(qrDataUrl('https://play.aseso.nl/j/andereinvite0000'), first);
});

test('langere URLs passen (automatische versiekeuze) en opties werken', () => {
  const long = `https://play.aseso.nl/j/${'x'.repeat(43)}?joinSource=qr`;
  const small = qrDataUrl(long, { cellSize: 2, margin: 8 });
  const big = qrDataUrl(long, { cellSize: 10, margin: 40 });
  assert.match(small, /^data:image\/gif;base64,/);
  assert.ok(big.length > small.length, 'grotere cellSize hoort een groter beeld te geven');
});

test('ongeldige invoer werpt TypeError', () => {
  for (const bad of ['', null, undefined, 42]) {
    assert.throws(() => qrDataUrl(bad), TypeError);
  }
});
