// views/home.test.mjs — scherm 1 (home).
//
// Toetst de twee ingangen van dit scherm: samen spelen (START, de belofte) en
// alleen spelen (besluit C-1, 5 aug 2026 — solo is een modus van deze app
// geworden, geen tweede app). Stub-DOM-patroon van scoreboard.test.mjs.

import { test } from 'node:test';
import assert from 'node:assert/strict';

function stubDom() {
  globalThis.HTMLElement ??= class HTMLElement {};
  const maak = (tag = 'div') => {
    const el = {
      tagName: String(tag).toUpperCase(),
      className: '',
      hidden: false,
      disabled: false,
      type: '',
      value: '',
      maxLength: 0,
      inputMode: '',
      id: '',
      dataset: {},
      _attrs: new Map(),
      _listeners: new Map(),
      children: [],
      classList: {
        _set: new Set(),
        add(...k) { k.forEach((c) => this._set.add(c)); },
        remove(...k) { k.forEach((c) => this._set.delete(c)); },
        toggle(c, on) { on ? this._set.add(c) : this._set.delete(c); },
        contains(c) { return this._set.has(c); },
      },
      setAttribute: (k, v) => el._attrs.set(k, v),
      getAttribute: (k) => el._attrs.get(k) ?? null,
      removeAttribute: (k) => el._attrs.delete(k),
      addEventListener: (soort, fn) => el._listeners.set(soort, fn),
      removeEventListener: (soort) => el._listeners.delete(soort),
      append: (...k) => el.children.push(...k),
      appendChild: (k) => (el.children.push(k), k),
      querySelector: () => null,
      querySelectorAll: () => [],
      focus: () => {},
      remove: () => { el._verwijderd = true; },
      getBoundingClientRect: () => ({ top: 0, left: 0, width: 0, height: 0 }),
      style: {},
      offsetHeight: 0,
    };
    Object.setPrototypeOf(el, HTMLElement.prototype);
    let tekst = '';
    Object.defineProperty(el, 'textContent', {
      get: () => tekst,
      set: (waarde) => { tekst = String(waarde ?? ''); el.children.length = 0; },
      configurable: true,
    });
    return el;
  };
  globalThis.document = { createElement: maak, addEventListener: () => {}, removeEventListener: () => {} };
  globalThis.window = { matchMedia: undefined, addEventListener: () => {}, removeEventListener: () => {} };
}

function vind(el, klasse) {
  if (typeof el?.className === 'string' && el.className.split(' ').includes(klasse)) return el;
  for (const kind of el?.children ?? []) {
    const raak = vind(kind, klasse);
    if (raak !== null) return raak;
  }
  return null;
}

const t = (k) => k;

const geheugen = () => {
  const map = new Map();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  };
};

async function maakHome({ onSolo = null } = {}) {
  stubDom();
  const { createHomeView } = await import(`./home.mjs?t=${Math.random()}`);
  const root = document.createElement('div');
  const view = createHomeView({
    root,
    t,
    transport: { createGame: async () => { throw new Error('niet gebruikt in deze test'); } },
    storage: geheugen(),
    onNavigate: () => {},
    onCodeLocator: () => {},
    onSolo,
  });
  return { root, view };
}

test('C-1: het homescherm biedt "Alleen spelen" aan zodra de app een solomodus heeft', async () => {
  let gestart = 0;
  const { root } = await maakHome({ onSolo: () => { gestart += 1; } });

  const solo = vind(root, 'home-solo-link');
  assert.notEqual(solo, null, 'de solo-ingang hoort te bestaan');
  assert.equal(solo.hidden, false);
  assert.equal(solo.textContent, 'home.soloStart');

  solo._listeners.get('click')?.();
  assert.equal(gestart, 1, 'de knop start een solopartij via de aanroeper, niet zelf');
});

test('C-1: zonder solomodus blijft de knop verborgen (geen dode ingang)', async () => {
  const { root } = await maakHome({ onSolo: null });
  const solo = vind(root, 'home-solo-link');
  assert.notEqual(solo, null);
  assert.equal(solo.hidden, true);
});

test('C-1: samen spelen blijft de primaire actie — solo staat er ná het codeveld', async () => {
  const { root } = await maakHome({ onSolo: () => {} });
  const scherm = vind(root, 'home-screen');
  const klassen = scherm.children.map((kind) => kind.className);

  const start = klassen.findIndex((klasse) => klasse.includes('home-quick-start'));
  const code = klassen.findIndex((klasse) => klasse.includes('home-code'));
  const solo = klassen.findIndex((klasse) => klasse.includes('home-solo-link'));

  assert.ok(start < code, 'START staat boven het codeveld');
  assert.ok(code < solo, 'solo staat onder het codeveld — het is een uitwijk, geen belofte');
});
