import { test } from 'node:test';
import assert from 'node:assert/strict';

import { identiteitVoor, hash, PALET, VORMEN } from './player-chip.mjs';

test('dezelfde speler krijgt altijd dezelfde identiteit', () => {
  const a = identiteitVoor('p-abc123');
  const b = identiteitVoor('p-abc123');
  assert.deepEqual(a, b);
});

test('de identiteit valt altijd binnen het palet en de vormenset', () => {
  for (let i = 0; i < 500; i++) {
    const { kleur, vorm } = identiteitVoor(`speler-${i}`);
    assert.ok(PALET.includes(kleur), `onbekende kleur bij speler-${i}`);
    assert.ok(VORMEN.includes(vorm), `onbekende vorm bij speler-${i}`);
  }
});

test('kleur en vorm zitten niet aan elkaar vast', () => {
  // Zouden ze uit dezelfde afgeleide komen, dan had elke rode speler ook
  // dezelfde vorm en waren er acht combinaties in plaats van vierenzestig.
  const combinaties = new Set();
  for (let i = 0; i < 500; i++) {
    const { kleurIndex, vormIndex } = identiteitVoor(`speler-${i}`);
    combinaties.add(`${kleurIndex}-${vormIndex}`);
  }
  assert.ok(combinaties.size > 40, `slechts ${combinaties.size} combinaties gezien`);
});

test('de verdeling over het palet is redelijk vlak', () => {
  const tellingen = new Array(PALET.length).fill(0);
  for (let i = 0; i < 800; i++) {
    tellingen[identiteitVoor(`p${i}`).kleurIndex]++;
  }
  const verwacht = 800 / PALET.length;
  for (const n of tellingen) {
    assert.ok(n > verwacht * 0.5, `een kleur kwam maar ${n}x voor, verwacht ~${verwacht}`);
  }
});

test('lege of rare invoer geeft nog steeds een geldige identiteit', () => {
  for (const invoer of ['', null, undefined, '   ', '🙂']) {
    const { kleur, vorm } = identiteitVoor(invoer);
    assert.ok(PALET.includes(kleur));
    assert.ok(VORMEN.includes(vorm));
  }
});

test('de hash is niet-negatief en stabiel', () => {
  assert.equal(hash('abc'), hash('abc'));
  assert.notEqual(hash('abc'), hash('abd'));
  for (const s of ['', 'a', 'een langere naam met spaties', '🙂']) {
    assert.ok(hash(s) >= 0);
    assert.ok(Number.isInteger(hash(s)));
  }
});
