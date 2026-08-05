import { test } from 'node:test';
import assert from 'node:assert/strict';

import { identiteitVoor, hash, PALET, VORMEN, SERVER_KLEUREN } from './player-chip.mjs';
// Bewust de échte serverlijst en geen kopie: dit bestand bewaakt juist dat er
// geen tweede opsomming ontstaat.
import { PLAYER_COLORS } from '../../server/protocol/client-events-dispatch.mjs';

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

// ── besluit 42: het serverpalet van zestien ────────────────────────────────────

test('besluit 42: SERVER_KLEUREN volgt de gesloten serverenum, sleutel voor sleutel', () => {
  // Volgorde meegenomen: de server wijst bij join round-robin toe in deze
  // volgorde, dus een verschoven lijst betekent een andere startkleur.
  assert.deepEqual(Object.keys(SERVER_KLEUREN), [...PLAYER_COLORS]);
});

test('besluit 42: elke kleur is een echte hexwaarde', () => {
  for (const [naam, hex] of Object.entries(SERVER_KLEUREN)) {
    assert.match(hex, /^#[0-9a-f]{6}$/, `${naam} hoort een 6-cijferige hex te zijn`);
  }
});

/** WCAG 2.x relatieve luminantie. */
function luminantie(hex) {
  const kanalen = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = kanalen.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [hoog, laag] = [luminantie(a), luminantie(b)].sort((p, q) => q - p);
  return (hoog + 0.05) / (laag + 0.05);
}

const DONKER = '#14141a'; // --rounda-row: het oppervlak waar de vlakjes op staan
const LICHT = '#f4f4fa'; // --color-bg-canvas in het lichte thema

test('besluit 42: elke kleur licht op het donkere oppervlak (>= 3:1)', () => {
  for (const [naam, hex] of Object.entries(SERVER_KLEUREN)) {
    assert.ok(contrast(hex, DONKER) >= 3, `${naam}: ${contrast(hex, DONKER).toFixed(2)}:1 op donker`);
  }
});

test('besluit 42: de acht nieuwe halen 3:1 op donker én licht', () => {
  // De eerste acht zijn ontworpen om op bijna-zwart te lichten en halen op het
  // lichte thema 1,05–2,96:1; die staan vast (bestaande rooms) en vallen dus
  // bewust buiten deze eis. De acht nieuwe moesten het wél op beide doen —
  // dat is precies waarom ze dieper van toon zijn.
  for (const naam of PLAYER_COLORS.slice(8)) {
    const hex = SERVER_KLEUREN[naam];
    assert.ok(contrast(hex, LICHT) >= 3, `${naam}: ${contrast(hex, LICHT).toFixed(2)}:1 op licht`);
    assert.ok(contrast(hex, DONKER) >= 3, `${naam}: ${contrast(hex, DONKER).toFixed(2)}:1 op donker`);
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
