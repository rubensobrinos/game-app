// Tests voor flag-renderer.mjs — S09. Geen jsdom/canvas-omgeving in dit
// project (zie package.json) — een minimale duck-typed 2D-context volstaat om
// te bevestigen dat elk pattern zonder runtime-fout tekent (regressietest op
// de poort uit app.js), niet om het pixelresultaat te controleren. Visuele
// verificatie gebeurt via een losse Playwright-check (zie 14-S09-S10's DoD).

import test from 'node:test';
import assert from 'node:assert/strict';
import { renderFlagSpec } from './flag-renderer.mjs';
import { FLAG_PATTERNS, generateFlagSpec } from '../../../shared/content/flag-spec.mjs';

function fakeCanvas() {
  const calls = [];
  const ctx = new Proxy(
    {},
    {
      get(target, prop) {
        if (prop === 'fillStyle' || prop === 'lineWidth') return target[prop];
        return (...args) => { calls.push([prop, ...args]); };
      },
      set(target, prop, value) {
        target[prop] = value;
        return true;
      },
    },
  );
  return { canvas: { getContext: () => ctx }, calls };
}

test('elk bekend pattern (shared/content/flag-spec.mjs) tekent zonder te throwen', () => {
  for (const pattern of FLAG_PATTERNS) {
    const { canvas } = fakeCanvas();
    assert.doesNotThrow(() => {
      renderFlagSpec(canvas, { pattern, palette: ['#111111', '#222222', '#333333'] });
    }, `pattern "${pattern}" gooide een fout`);
  }
});

test('palette met maar twee kleuren (geen c3) tekent ook zonder te throwen', () => {
  for (const pattern of FLAG_PATTERNS) {
    const { canvas } = fakeCanvas();
    assert.doesNotThrow(() => {
      renderFlagSpec(canvas, { pattern, palette: ['#111111', '#222222'] });
    }, `pattern "${pattern}" (2 kleuren) gooide een fout`);
  }
});

test('onbekend pattern tekent een kale vulling, geen throw', () => {
  const { canvas, calls } = fakeCanvas();
  assert.doesNotThrow(() => {
    renderFlagSpec(canvas, { pattern: 'nonexistent-pattern-xyz', palette: ['#abcdef', '#123456'] });
  });
  assert.ok(calls.some(([method]) => method === 'fillRect'));
});

test('canvas.width/height staan op de vaste afmeting', () => {
  const { canvas } = fakeCanvas();
  renderFlagSpec(canvas, { pattern: 'hstripes', palette: ['#111111', '#222222', '#333333'] });
  assert.equal(canvas.width, 480);
  assert.equal(canvas.height, 300);
});

test('een echte, deterministisch gegenereerde spec (generateFlagSpec) tekent ook zonder te throwen', () => {
  const spec = generateFlagSpec('fx_test_seed');
  const { canvas } = fakeCanvas();
  assert.doesNotThrow(() => {
    renderFlagSpec(canvas, spec);
  });
});
