import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { loadCountryShape, preloadCountryShapes, renderCountryShape } from './shape-renderer.mjs';

/**
 * Minimale canvas-dubbel. `node:test` draait zonder browser, en deze module
 * raakt maar een handvol dingen aan een 2D-context aan. Een echte canvas
 * optuigen (of `node-canvas` als dependency binnenhalen) zou hier meer
 * verbergen dan aantonen — zelfde afweging als de DOM-dubbel in
 * `button-loading.test.mjs`.
 */
function canvasDubbel() {
  const calls = [];
  const ctx = {
    clearRect: (...a) => calls.push(['clearRect', ...a]),
    beginPath: () => calls.push(['beginPath']),
    moveTo: (x, y) => calls.push(['moveTo', x, y]),
    lineTo: (x, y) => calls.push(['lineTo', x, y]),
    closePath: () => calls.push(['closePath']),
    fill: (regel) => calls.push(['fill', regel]),
    stroke: () => calls.push(['stroke']),
    set fillStyle(v) { calls.push(['fillStyle', v]); },
    set strokeStyle(v) { calls.push(['strokeStyle', v]); },
    set lineWidth(v) { calls.push(['lineWidth', v]); },
    set lineJoin(v) { calls.push(['lineJoin', v]); },
  };
  return {
    width: 0,
    height: 0,
    calls,
    getContext: () => ctx,
    van: (naam) => calls.filter((c) => c[0] === naam),
  };
}

// ─── Het gewicht: de reden dat deze module bestaat ──────────────────────────

test('de 234 KB paddata staat NIET in een statische import — alleen in een await import()', () => {
  const bron = readFileSync(new URL('./shape-renderer.mjs', import.meta.url), 'utf8');
  const staticheImports = bron.match(/^\s*import\s[^(].*$/gm) ?? [];
  assert.deepEqual(
    staticheImports,
    [],
    'shape-renderer.mjs mag helemaal geen statische import hebben; de paddata zou dan meeliften met elk potje',
  );
  assert.match(bron, /await import\(|import\('\.\.\/\.\.\/\.\.\/shared\/content\/shapes\.data\.mjs'\)/);
});

test('renderCountryShape werkt zonder dat de paddata ooit geladen is', () => {
  // Het bewijs in miniatuur: tekenen kan met een padstring in de hand, dus een
  // aanroeper die geen contourgame speelt haalt de data nooit op.
  const canvas = canvasDubbel();
  renderCountryShape(canvas, 'M0 0 L100 0 L100 100 L0 100 Z');
  assert.equal(canvas.van('fill').length, 1);
});

// ─── Tekenen ────────────────────────────────────────────────────────────────

test('een vierkant pad levert vier punten, een gesloten pad en één vulling', () => {
  const canvas = canvasDubbel();
  renderCountryShape(canvas, 'M0 0 L100 0 L100 100 L0 100 Z');

  assert.equal(canvas.width, 480);
  assert.equal(canvas.height, 480, 'vierkant, anders dan de 480x300 van een vlag');
  assert.equal(canvas.van('moveTo').length, 1);
  assert.equal(canvas.van('lineTo').length, 3);
  assert.equal(canvas.van('closePath').length, 1);
  assert.equal(canvas.van('fill').length, 1);
});

test('het pad blijft binnen het canvas, met marge aan alle kanten', () => {
  const canvas = canvasDubbel();
  renderCountryShape(canvas, 'M0 0 L100 0 L100 100 L0 100 Z');
  const punten = [...canvas.van('moveTo'), ...canvas.van('lineTo')].map(([, x, y]) => [x, y]);

  for (const [x, y] of punten) {
    assert.ok(x > 0 && x < 480, `x ${x} valt buiten het canvas`);
    assert.ok(y > 0 && y < 480, `y ${y} valt buiten het canvas`);
  }
  // De marge is symmetrisch: het uiterste punt links ligt even ver van de rand
  // als het uiterste punt rechts.
  const xs = punten.map(([x]) => x);
  assert.ok(Math.abs(Math.min(...xs) - (480 - Math.max(...xs))) < 0.001);
});

test('meerdere subpaden (een land met eilanden) worden allemaal getekend', () => {
  const canvas = canvasDubbel();
  renderCountryShape(canvas, 'M0 0 L10 0 L10 10 Z M50 50 L60 50 L60 60 Z');

  assert.equal(canvas.van('moveTo').length, 2, 'elk subpad begint met een moveTo');
  assert.equal(canvas.van('closePath').length, 2);
  assert.equal(canvas.van('fill').length, 1, 'één vulling over alle subpaden heen');
});

test('vullen gebeurt met evenodd, zodat een enclave een gat blijft', () => {
  // Italië/San Marino, Zuid-Afrika/Lesotho: het binnenpad hoort een gat te
  // zijn. Met de standaard `nonzero` hangt dat af van de winding-richting van
  // de brondata, en die is niet gegarandeerd.
  const canvas = canvasDubbel();
  renderCountryShape(canvas, 'M0 0 L100 0 L100 100 L0 100 Z M40 40 L60 40 L60 60 L40 60 Z');
  assert.deepEqual(canvas.van('fill'), [['fill', 'evenodd']]);
});

test('standaard tekent hij lime, met een dunne lijn in dezelfde kleur', () => {
  const canvas = canvasDubbel();
  renderCountryShape(canvas, 'M0 0 L10 0 L10 10 Z');

  assert.deepEqual(canvas.van('fillStyle'), [['fillStyle', '#d8ff3e']]);
  assert.deepEqual(canvas.van('strokeStyle'), [['strokeStyle', '#d8ff3e']]);
  assert.equal(canvas.van('stroke').length, 1);
});

test('kleuren zijn mee te geven — het paspoort kleurt landen per status', () => {
  const canvas = canvasDubbel();
  renderCountryShape(canvas, 'M0 0 L10 0 L10 10 Z', { fill: '#ff3ea5', stroke: '#000000' });

  assert.deepEqual(canvas.van('fillStyle'), [['fillStyle', '#ff3ea5']]);
  assert.deepEqual(canvas.van('strokeStyle'), [['strokeStyle', '#000000']]);
});

test('stroke: null zet de omlijning uit', () => {
  const canvas = canvasDubbel();
  renderCountryShape(canvas, 'M0 0 L10 0 L10 10 Z', { stroke: null });
  assert.equal(canvas.van('stroke').length, 0);
});

test('een eigen size maakt het canvas groter of kleiner', () => {
  const canvas = canvasDubbel();
  renderCountryShape(canvas, 'M0 0 L10 0 L10 10 Z', { size: 96 });
  assert.equal(canvas.width, 96);
  assert.equal(canvas.height, 96);
});

// ─── Onbekende invoer: niets tonen, nooit werpen ────────────────────────────

test('een lege of ontbrekende padstring wist het canvas en tekent verder niets', () => {
  for (const leeg of ['', null, undefined, 42]) {
    const canvas = canvasDubbel();
    assert.doesNotThrow(() => renderCountryShape(canvas, leeg));
    assert.equal(canvas.van('clearRect').length, 1, 'wissen gebeurt altijd');
    assert.equal(canvas.van('fill').length, 0);
  }
});

test('een onbekend padcommando stopt het tekenen, het werpt niet', () => {
  // De brondata kent vandaag alleen M/L/Z. Komt daar ooit een `C` bij, dan
  // hoort deze renderer een kalere contour te tonen — niet het spelscherm om
  // te trekken. Zelfde afweging als het default-geval in flag-renderer.mjs.
  const canvas = canvasDubbel();
  assert.doesNotThrow(() => renderCountryShape(canvas, 'M0 0 L10 0 L10 10 Z C1 1 2 2 3 3'));
  assert.equal(canvas.van('fill').length, 1, 'wat vóór het onbekende commando stond is wél getekend');
});

test('een pad zonder enkel bruikbaar punt tekent niets', () => {
  const canvas = canvasDubbel();
  renderCountryShape(canvas, 'Z');
  assert.equal(canvas.van('fill').length, 0);
});

// ─── Laden ──────────────────────────────────────────────────────────────────

test('loadCountryShape levert het pad van een bestaand land', async () => {
  const nl = await loadCountryShape('nl');
  assert.equal(typeof nl, 'string');
  assert.ok(nl.startsWith('M'), 'een SVG-pad begint met een moveTo');
  assert.ok(nl.length > 50);
});

test('loadCountryShape is hoofdletterongevoelig — de pool gebruikt kleine letters', async () => {
  assert.equal(await loadCountryShape('NL'), await loadCountryShape('nl'));
});

test('een land zonder contour levert null, geen fout', async () => {
  // Réunion is een van de vijf pool-landen die bewust geen contour heeft.
  assert.equal(await loadCountryShape('re'), null);
  assert.equal(await loadCountryShape('bestaat-niet'), null);
  assert.equal(await loadCountryShape(null), null);
});

test('preloadCountryShapes laadt dezelfde data en laadt niet twee keer', async () => {
  await preloadCountryShapes();
  const a = await loadCountryShape('fr');
  const b = await loadCountryShape('fr');
  assert.equal(a, b);
  assert.ok(a.length > 50);
});

test('alle 225 contouren zijn tekenbaar: elk pad levert minstens drie punten op', async () => {
  const { SHAPE_ENTRIES } = await import('../../../shared/content/shapes.data.mjs');
  assert.equal(SHAPE_ENTRIES.length, 225);

  const teKaal = [];
  for (const entry of SHAPE_ENTRIES) {
    const canvas = canvasDubbel();
    renderCountryShape(canvas, entry.shape);
    const punten = canvas.van('moveTo').length + canvas.van('lineTo').length;
    if (punten < 3 || canvas.van('fill').length !== 1) {
      teKaal.push(entry.iso2);
    }
  }
  assert.deepEqual(teKaal, [], 'deze landen leveren geen tekenbare contour op');
});

test('elk pad blijft binnen het canvas — geen enkel land loopt eraf', async () => {
  const { SHAPE_ENTRIES } = await import('../../../shared/content/shapes.data.mjs');
  const buitenBeeld = [];
  for (const entry of SHAPE_ENTRIES) {
    const canvas = canvasDubbel();
    renderCountryShape(canvas, entry.shape);
    for (const [, x, y] of [...canvas.van('moveTo'), ...canvas.van('lineTo')]) {
      if (x < 0 || x > 480 || y < 0 || y > 480) {
        buitenBeeld.push(entry.iso2);
        break;
      }
    }
  }
  assert.deepEqual(buitenBeeld, []);
});
