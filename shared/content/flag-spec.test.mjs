// Tests voor generateFlagSpec — CT2. Determinisme, contractvorm, variëteit,
// echte-vlag-wering, en de integratie met de echte vraagselectie (GR4).

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateFlagSpec,
  isKnownRealFlagSignature,
  flagSignature,
  colorClass,
  FLAG_PATTERNS,
  FLAG_PALETTES,
  FLAG_RENDERER_VERSION,
} from './flag-spec.mjs';
import { getCountryPool } from './index.mjs';

const HEX = /^#[0-9A-F]{6}$/;

test('zelfde seed ⇒ exact dezelfde spec (determinisme over herhaalde aanroepen)', () => {
  for (const seed of ['fx_91b2', 'a', 'seed-…-unicode-✓', '0']) {
    const first = generateFlagSpec(seed);
    for (let i = 0; i < 5; i++) {
      assert.deepEqual(generateFlagSpec(seed), first, `seed "${seed}" niet stabiel`);
    }
  }
});

test('contractvorm: pattern uit het vaste vocabulaire, 3 hex-kleuren, rendererVersion', () => {
  for (let i = 0; i < 300; i++) {
    const spec = generateFlagSpec(`vorm_${i}`);
    assert.ok(FLAG_PATTERNS.includes(spec.pattern), `onbekend pattern ${spec.pattern}`);
    assert.equal(spec.palette.length, 3);
    for (const c of spec.palette) assert.match(c, HEX);
    assert.equal(spec.rendererVersion, FLAG_RENDERER_VERSION);
    assert.deepEqual(Object.keys(spec).sort(), ['palette', 'pattern', 'rendererVersion']);
  }
});

test('specs zijn JSON-serialiseerbaar en overleven een roundtrip ongewijzigd', () => {
  const spec = generateFlagSpec('wire_check');
  assert.deepEqual(JSON.parse(JSON.stringify(spec)), spec);
});

test('verschillende seeds geven ruime variëteit', () => {
  const seen = new Set();
  for (let i = 0; i < 400; i++) {
    seen.add(JSON.stringify(generateFlagSpec(`var_${i}`)));
  }
  // 12 patterns × 15 paletten = 180 combinaties; verwacht een flink deel.
  assert.ok(seen.size > 100, `slechts ${seen.size} unieke specs op 400 seeds`);
});

test('wering: geen enkele gegenereerde spec matcht een bekende echte vlag', () => {
  for (let i = 0; i < 2000; i++) {
    const { pattern, palette } = generateFlagSpec(`guard_${i}`);
    assert.equal(
      isKnownRealFlagSignature(pattern, palette),
      false,
      `seed guard_${i} levert een echte vlag op: ${flagSignature(pattern, palette)}`,
    );
  }
});

test('wering: de denylijst zelf herkent de klassiekers', () => {
  // Frankrijk: verticaal blauw-wit-rood, ongeacht exacte tint.
  assert.ok(isKnownRealFlagSignature('vstripes', ['#002395', '#FFFFFF', '#ED2939']));
  assert.ok(isKnownRealFlagSignature('vstripes', ['#0055A4', '#FFFFFF', '#EF4135']));
  // Nederland/Luxemburg: horizontaal rood-wit-blauw.
  assert.ok(isKnownRealFlagSignature('hstripes', ['#CE1126', '#FFFFFF', '#003087']));
  // Duitsland: zwart-rood-geel.
  assert.ok(isKnownRealFlagSignature('hstripes', ['#000000', '#DD0000', '#FFCE00']));
  // Maar een sunburst met dezelfde kleuren is géén bestaande vlag:
  assert.equal(isKnownRealFlagSignature('sunburst', ['#002395', '#FFFFFF', '#ED2939']), false);
});

test('kleurklassen: tinten van dezelfde kleur vallen in dezelfde klasse', () => {
  assert.equal(colorClass('#002395'), colorClass('#0055A4')); // twee blauwen
  assert.equal(colorClass('#CE1126'), colorClass('#DC143C')); // rood en crimson
  assert.notEqual(colorClass('#FFFFFF'), colorClass('#000000'));
});

test('ongeldige seed werpt TypeError', () => {
  for (const bad of ['', null, undefined, 42, {}]) {
    assert.throws(() => generateFlagSpec(bad), TypeError);
  }
});

test('vocabulaire is bevroren (een renderer kan er blind op vertrouwen)', () => {
  assert.throws(() => { FLAG_PATTERNS.push('x'); }, TypeError);
  assert.throws(() => { FLAG_PALETTES[0][0] = '#123456'; }, TypeError);
});

test('integratie: buildMatchQuestionPlan draait real_or_fake_flag volledig op deze generator', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const { buildMatchQuestionPlan } = require('../../server/rules/question-selection.js');

  let s = 7;
  const random = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };

  const plan = buildMatchQuestionPlan({
    gameType: 'real_or_fake_flag',
    totalRounds: 10,
    difficulty: 'medium',
    metricMode: 'mixed',
    previousMatchQuestionKeys: [],
    pool: getCountryPool(),
    random,
    generateFlagSpec,
  });

  assert.equal(plan.length, 10);
  const fakes = plan.filter((q) => q.publicQuestionPayload.kind === 'generated');
  const reals = plan.filter((q) => q.publicQuestionPayload.kind === 'real');
  assert.equal(fakes.length + reals.length, 10);
  assert.ok(fakes.length >= 3 && reals.length >= 3, `scheve verdeling: ${fakes.length} nep / ${reals.length} echt`);
  for (const q of fakes) {
    const { seed, rendererVersion, spec } = q.publicQuestionPayload;
    assert.equal(typeof seed, 'string');
    assert.equal(rendererVersion, FLAG_RENDERER_VERSION);
    // De payload-spec moet exact reproduceerbaar zijn uit de seed (client rendert).
    const { rendererVersion: rv, ...expected } = generateFlagSpec(seed);
    assert.deepEqual(spec, expected);
    assert.deepEqual(q.correctAnswer, { choice: 'fake' });
  }
});
