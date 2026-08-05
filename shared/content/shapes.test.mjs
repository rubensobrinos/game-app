// Tests voor de contourmigratie (docs/openstaand/raad-het-land.md, stap 1).
// Toetst het GEGENEREERDE resultaat (shapes.data.mjs/shapes-index.mjs) tegen
// de referentiecijfers uit het bouwplan — niet de generator zelf (build-
// shapes.mjs is een script, geen module om te importeren; zelfde aanpak als
// index.test.mjs voor build-content.mjs).

import test from 'node:test';
import assert from 'node:assert/strict';

import { SHAPE_ENTRIES, SHAPE_VIEWBOX } from './shapes.data.mjs';
import { SHAPE_ISO2S } from './shapes-index.mjs';
import { COUNTRY_ENTRIES } from './countries.data.mjs';

test('225 van de 230 pool-landen hebben een contour — de referentiecijfers uit het bouwplan', () => {
  assert.equal(SHAPE_ENTRIES.length, 225);
  assert.equal(COUNTRY_ENTRIES.length, 230);
});

test('de vijf landen zonder contour zijn precies de Franse overzeese gebieden uit het bouwplan', () => {
  const withShape = new Set(SHAPE_ENTRIES.map((e) => e.iso2));
  const withoutShape = COUNTRY_ENTRIES.filter((e) => !withShape.has(e.iso2)).map((e) => e.iso2).sort();
  assert.deepEqual(withoutShape, ['gf', 'gp', 'mq', 're', 'yt']);
  // Allemaal `extreme` — zie raad-het-land.md.
  for (const e of COUNTRY_ENTRIES) {
    if (!withShape.has(e.iso2)) {
      assert.equal(e.difficulty, 'extreme', `${e.iso2} zonder contour hoort 'extreme' te zijn`);
    }
  }
});

test('de vijf handmatige aliassen zijn daadwerkelijk gekoppeld', () => {
  const byIso2 = new Set(SHAPE_ENTRIES.map((e) => e.iso2));
  for (const iso2 of ['rs', 'tz', 'cg', 'hk', 'mo']) {
    assert.ok(byIso2.has(iso2), `"${iso2}" (handmatige alias) mist een contour`);
  }
});

test('shapes-index.mjs is de lichte tegenhanger: exact dezelfde iso2-set, geen paddata', () => {
  assert.deepEqual([...SHAPE_ISO2S].sort(), SHAPE_ENTRIES.map((e) => e.iso2).sort());
  for (const iso2 of SHAPE_ISO2S) {
    assert.equal(typeof iso2, 'string');
  }
});

test('iso2 is uniek, lowercase, en komt overeen met de pool-conventie', () => {
  const seen = new Set();
  for (const e of SHAPE_ENTRIES) {
    assert.match(e.iso2, /^[a-z]{2}$/, `iso2 "${e.iso2}" is geen 2 lowercase letters`);
    assert.ok(!seen.has(e.iso2), `dubbele iso2 "${e.iso2}"`);
    seen.add(e.iso2);
  }
});

test('elke shape is een niet-lege SVG-padstring binnen de gedeclareerde viewBox, geen markup-restjes', () => {
  assert.equal(SHAPE_VIEWBOX, '0 0 100 100');
  for (const { iso2, shape } of SHAPE_ENTRIES) {
    assert.equal(typeof shape, 'string');
    assert.ok(shape.length > 0, `"${iso2}" heeft een lege shape`);
    assert.ok(!shape.includes('<') && !shape.includes('"'), `shape van "${iso2}" bevat nog markup i.p.v. alleen de d-waarde`);
    assert.match(shape, /^M/, `shape van "${iso2}" begint niet met een SVG "moveto"`);
    const numbers = [...shape.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
    assert.ok(numbers.length > 0, `"${iso2}" heeft geen coördinaten`);
    for (const n of numbers) {
      assert.ok(n >= 0 && n <= 100, `"${iso2}" heeft een coördinaat (${n}) buiten de viewBox 0..100`);
    }
  }
});
