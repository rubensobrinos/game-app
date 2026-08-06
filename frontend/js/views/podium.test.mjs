// views/podium.test.mjs — besluit 53 (paspoort). Stub-DOM-patroon van
// gameplay.test.mjs/scoreboard.test.mjs. Toetst NIET de bestaande podium-
// mechaniek (reveal-stagger, confetti, delen) — alleen de nieuwe
// paspoortsectie: verborgen zonder storage/zonder landen, anders zichtbaar
// met de juiste tekst, vlaggen en "nieuw"-markering, ná de eindstand.

import { test } from 'node:test';
import assert from 'node:assert/strict';

function stubDom() {
  globalThis.HTMLElement ??= class HTMLElement {};
  const maak = (tag = 'div') => {
    const el = {
      tagName: String(tag).toUpperCase(),
      className: '',
      textContent: '',
      hidden: false,
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
      addEventListener: (soort, fn) => el._listeners.set(soort, fn),
      append: (...k) => el.children.push(...k),
      appendChild: (k) => (el.children.push(k), k),
      querySelector: () => null,
      remove: () => { el._verwijderd = true; },
      getBoundingClientRect: () => ({ top: 0, left: 0, width: 0, height: 0 }),
      // Confetti (podium.mjs) zet `--i` via setProperty — een no-op volstaat,
      // dit bestand toetst geen animatie.
      style: { setProperty: () => {}, removeProperty: () => {} },
      offsetHeight: 0,
      offsetWidth: 0,
      src: '',
      alt: '',
    };
    Object.setPrototypeOf(el, HTMLElement.prototype);
    let tekst = '';
    Object.defineProperty(el, 'textContent', {
      get: () => tekst,
      set: (waarde) => {
        tekst = String(waarde ?? '');
        el.children.length = 0;
      },
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

function vindAlle(el, klasse, gevonden = []) {
  if (typeof el?.className === 'string' && el.className.split(' ').includes(klasse)) gevonden.push(el);
  for (const kind of el?.children ?? []) vindAlle(kind, klasse, gevonden);
  return gevonden;
}

// Passthrough voor de meeste sleutels (zoals de andere testbestanden), maar
// de twee paspoortsleutels vertalen écht — anders is `.replace('{seen}', …)`
// in podium.mjs niet te bewijzen (dezelfde les als gameplay.test.mjs).
const VERTALINGEN = {
  'podium.passportSummary': 'Je hebt er nu {seen} van de {total} landen gezien.',
  'podium.passportNewFlagAlt': '{country} — nieuw!',
};
const t = (k) => VERTALINGEN[k] ?? k;

const standings = {
  entries: [
    { position: 1, playerId: 'p1', effectiveName: 'Ties', score: 6240, isSelf: false, identity: null },
    { position: 2, playerId: 'p2', effectiveName: 'Jij', score: 4120, isSelf: true, identity: null },
  ],
  self: { position: 2, playerId: 'p2', effectiveName: 'Jij', score: 4120 },
};

function createFakeStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

async function maakView({ storage, naam } = {}) {
  stubDom();
  const { createPodiumView } = await import(`./podium.mjs?${naam ?? Math.random()}`);
  const root = document.createElement('div');
  const view = createPodiumView({
    root,
    t,
    // Host, niet de niet-host-tak: die mount rounda.mjs (een los minigame-
    // widgetje voor het wachten op de host), wat een canvas/`style.setProperty`
    // nodig heeft die deze stub niet biedt — niet relevant voor het paspoort.
    isHost: true,
    capabilities: {},
    storage,
    onRematch: () => {},
    onNewGame: () => {},
    onClose: () => {},
  });
  return { root, view };
}

test('besluit 53: zonder storage blijft de paspoortsectie verborgen', async () => {
  const { root, view } = await maakView({ naam: 'a' });
  view.update(standings, { lang: 'nl' });
  assert.equal(vind(root, 'podium-passport').hidden, true);
});

test('besluit 53: met storage maar zonder enig land deze partij (bv. alleen nepvlaggen) blijft de sectie verborgen', async () => {
  const storage = createFakeStorage();
  const { resetPassportForNewMatch } = await import('../session/passport-tracker.mjs');
  resetPassportForNewMatch(storage);
  const { root, view } = await maakView({ storage, naam: 'b' });
  view.update(standings, { lang: 'nl' });
  assert.equal(vind(root, 'podium-passport').hidden, true);
});

test('besluit 53: met landen deze partij toont de sectie de telling en een vlag per land, ná de eindstand', async () => {
  const storage = createFakeStorage();
  const { resetPassportForNewMatch, recordRoundEndedForPassport } = await import('../session/passport-tracker.mjs');
  const { getCountryPool } = await import('../../../shared/content/index.mjs');
  const { countryName } = await import('./country-names.mjs');

  // 'fr' bestond al vóór deze partij, 'de' is gloednieuw.
  storage.setItem('mp:passport', JSON.stringify({ fr: 100 }));
  resetPassportForNewMatch(storage);
  recordRoundEndedForPassport(storage, 'flags_mc', {}, { optionId: 'FR' });
  recordRoundEndedForPassport(storage, 'flags_mc', {}, { optionId: 'DE' });

  const { root, view } = await maakView({ storage, naam: 'c' });
  view.update(standings, { lang: 'nl' });

  const sectie = vind(root, 'podium-passport');
  assert.equal(sectie.hidden, false);

  const totaal = getCountryPool().length;
  assert.equal(vind(root, 'podium-passport-summary').textContent, `Je hebt er nu 2 van de ${totaal} landen gezien.`);

  const vlaggen = vindAlle(root, 'podium-passport-flag');
  assert.equal(vlaggen.length, 2);
  assert.match(vlaggen[0].src, /fr\.png$/);
  assert.equal(vlaggen[0].alt, countryName('fr', 'nl'), 'fr was al bekend — geen "nieuw"-markering');
  assert.match(vlaggen[1].src, /de\.png$/);
  assert.equal(vlaggen[1].alt, `${countryName('de', 'nl')} — nieuw!`, 'de is voor het eerst gezien');

  const itemDe = vindAlle(root, 'podium-passport-flag-item')[1];
  assert.equal(itemDe.classList.contains('is-new'), true);
  const itemFr = vindAlle(root, 'podium-passport-flag-item')[0];
  assert.equal(itemFr.classList.contains('is-new'), false);

  // "Het paspoort mag het podium niet overnemen": de kop/eindstand (podium-
  // steps) staat vóór de paspoortsectie in de DOM, niet erna.
  const volgorde = root.children.map((kind) => kind.className);
  assert.ok(volgorde.indexOf('podium-steps') < volgorde.indexOf('podium-passport'));
  assert.ok(volgorde.indexOf('podium-passport') < volgorde.indexOf('podium-action'));
});
