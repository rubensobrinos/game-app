import { test } from 'node:test';
import assert from 'node:assert/strict';

import { setButtonLoading, isButtonLoading } from './button-loading.mjs';

/**
 * Minimale DOM-dubbel. `node:test` draait zonder browser, en deze module
 * raakt maar vier dingen aan een element (klasse, attribuut, `disabled`,
 * `textContent`) plus een breedtemeting. Een echte DOM optuigen zou hier meer
 * verbergen dan aantonen.
 */
function knop(label = 'Start direct een game', breedte = 240) {
  const el = {
    textContent: label,
    disabled: false,
    dataset: {},
    style: {},
    _klassen: new Set(),
    _attrs: new Map(),
    classList: {
      add: (c) => el._klassen.add(c),
      remove: (c) => el._klassen.delete(c),
      contains: (c) => el._klassen.has(c),
    },
    setAttribute: (k, v) => el._attrs.set(k, v),
    removeAttribute: (k) => el._attrs.delete(k),
    getBoundingClientRect: () => ({ width: breedte }),
  };
  Object.setPrototypeOf(el, HTMLElement.prototype);
  return el;
}

// `instanceof HTMLElement` moet in Node werken zonder DOM.
globalThis.HTMLElement ??= class HTMLElement {};

test('bezig: label wisselt, knop blokkeert, breedte staat vast', () => {
  const b = knop();
  setButtonLoading(b, { loading: true, label: 'Potje maken…' });

  assert.equal(b.textContent, 'Potje maken…');
  assert.equal(b.disabled, true, 'een ladende knop mag niet opnieuw vuren');
  assert.equal(b._attrs.get('aria-busy'), 'true');
  assert.ok(isButtonLoading(b));
  assert.equal(b.style.minWidth, '240px', 'breedte vastgezet tegen layoutshift');
});

test('gelukt: alles terug, oorspronkelijk label hersteld', () => {
  const b = knop();
  setButtonLoading(b, { loading: true, label: 'Potje maken…' });
  setButtonLoading(b, { loading: false });

  assert.equal(b.textContent, 'Start direct een game');
  assert.equal(b.disabled, false);
  assert.equal(b._attrs.has('aria-busy'), false);
  assert.equal(isButtonLoading(b), false);
  assert.equal(b.style.minWidth, '');
  assert.equal(b.dataset.idleLabel, undefined, 'geen residu voor een volgende ronde');
});

test('mislukt: eigen vervolglabel, knop weer bruikbaar', () => {
  const b = knop();
  setButtonLoading(b, { loading: true, label: 'Potje maken…' });
  setButtonLoading(b, { loading: false, label: 'Opnieuw proberen' });

  assert.equal(b.textContent, 'Opnieuw proberen');
  assert.equal(b.disabled, false, 'na een fout moet je het opnieuw kunnen doen');
  assert.equal(isButtonLoading(b), false);
});

test('een geslaagde retry valt terug op het oorspronkelijke label', () => {
  const b = knop();
  setButtonLoading(b, { loading: true, label: 'Potje maken…' });
  setButtonLoading(b, { loading: false, label: 'Opnieuw proberen' });
  setButtonLoading(b, { loading: true, label: 'Potje maken…' });
  setButtonLoading(b, { loading: false });

  assert.equal(b.textContent, 'Start direct een game');
});

test('twee keer laden zet het onthouden label niet over op de laadtekst', () => {
  const b = knop();
  setButtonLoading(b, { loading: true, label: 'Potje maken…' });
  setButtonLoading(b, { loading: true, label: 'Nog steeds bezig…' });
  setButtonLoading(b, { loading: false });

  assert.equal(b.textContent, 'Start direct een game');
});

test('zonder label blijft de tekst staan', () => {
  const b = knop('Meedoen');
  setButtonLoading(b, { loading: true });

  assert.equal(b.textContent, 'Meedoen');
  assert.equal(b.disabled, true);
});

test('een niet-element wordt genegeerd in plaats van te gooien', () => {
  assert.doesNotThrow(() => setButtonLoading(null, { loading: true }));
  assert.equal(isButtonLoading(null), false);
});

// BOUWSPRINT (rounda-1c): een knop met een `[data-button-loading-label]`-kind
// (home.mjs's sublabel-pattern) mag dat kind niet verliezen bij een
// laadwissel — `textContent` op de hele knop zou het wegvegen.
test('knop met een [data-button-loading-label]-kind: alleen dat kind wisselt van tekst, de rest blijft staan', () => {
  const sub = { textContent: 'Je bent de spelleider', dataset: {} };
  const label = { textContent: 'Start direct een game', dataset: {} };
  const b = knop();
  b.querySelector = (selector) => (selector === '[data-button-loading-label]' ? label : null);

  setButtonLoading(b, { loading: true, label: 'Potje maken…' });
  assert.equal(label.textContent, 'Potje maken…');
  assert.equal(sub.textContent, 'Je bent de spelleider'); // ongemoeid
  assert.equal(b.disabled, true);

  setButtonLoading(b, { loading: false });
  assert.equal(label.textContent, 'Start direct een game');
  assert.equal(sub.textContent, 'Je bent de spelleider');
});
