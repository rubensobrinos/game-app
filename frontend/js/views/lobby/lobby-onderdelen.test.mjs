// views/lobby/lobby-onderdelen.test.mjs — docs/openstaand/refactor/11-lobby.md.
//
// `lobby.test.mjs` (één map hoger) bewijst al dat de SAMENGESTELDE lobby zich
// nog precies zo gedraagt als vóór de splitsing — dat bestand is ongewijzigd
// gebleven en slaagt nog steeds. Dit bestand bewijst het andere deel: dat elk
// onderdeel ook écht op zichzelf staat, met alleen zijn eigen props — geen
// verborgen afhankelijkheid van de dingen die alleen lobby.mjs toevallig al
// klaarzette (bijvoorbeeld gamekeuze's `gameRow`/`gameCardSub`, die
// instellingen.mjs als kale parameter moet krijgen, niet via een gedeelde
// root). Zelfde stub-DOM-patroon als lobby.test.mjs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAME_CATALOG, isPlayableGameType } from '../../../../shared/content/game-catalog.mjs';

function stubDom() {
  globalThis.HTMLElement ??= class HTMLElement {};
  const maak = (tag = 'div') => {
    const el = {
      tagName: String(tag).toUpperCase(),
      className: '',
      textContent: '',
      value: '',
      type: '',
      hidden: false,
      disabled: false,
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
      append: (...k) => { k.forEach((kind) => { kind.parentNode = el; }); el.children.push(...k); },
      appendChild: (k) => { k.parentNode = el; el.children.push(k); return k; },
      insertBefore: (k) => { k.parentNode = el; el.children.unshift(k); return k; },
      // spelers.mjs leest `chip.querySelector('.player-chip-name')` (echt
      // DOM-gedrag: alleen afstammelingen, nooit `el` zelf) — hergebruikt
      // `vind()` hieronder (functiedeclaraties zijn hoisted).
      querySelector: (sel) => {
        if (typeof sel === 'string' && sel.startsWith('.')) {
          for (const kind of el.children) {
            const raak = vind(kind, sel.slice(1));
            if (raak !== null) return raak;
          }
        }
        return null;
      },
      querySelectorAll: () => [],
      focus: () => {},
      select: () => {},
      // Echt DOM-gedrag: uit de children-array van de ouder halen, niet
      // alleen markeren — anders vindt `vind()`/`querySelector` een
      // "verwijderde" rij nog gewoon terug (spelersidentiteit.md stap 5's
      // rebuild-pad in spelers.mjs leunt hierop).
      remove: () => {
        el._verwijderd = true;
        if (el.parentNode?.children) {
          el.parentNode.children = el.parentNode.children.filter((kind) => kind !== el);
        }
      },
      style: {},
      offsetWidth: 0,
    };
    Object.setPrototypeOf(el, HTMLElement.prototype);
    return el;
  };
  globalThis.document = {
    createElement: maak,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  globalThis.window = { confirm: () => true };
  globalThis.navigator ??= {};
  globalThis.navigator.clipboard = undefined;
}

/** Eerste element (diepte-eerst) met deze klasse. */
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

const t = (k) => k;
const tCount = (k, n) => `${k}:${n}`;

function klik(el) {
  el._listeners.get('click')?.({ preventDefault: () => {}, stopPropagation: () => {} });
}

// ── gamekeuze.mjs ────────────────────────────────────────────────────────

test('gamekeuze.mjs staat op zichzelf: draaien naar een speelbare game stuurt precies één gameType', async () => {
  stubDom();
  const { createGamekeuzeView } = await import(`./gamekeuze.mjs?t=${Math.random()}`);
  const patches = [];
  const view = createGamekeuzeView({ t, onConfigChange: (patch) => patches.push(patch) });

  assert.equal(vind(view.gameRow, 'lobby-gamecard-title').textContent, `lobby.game_${GAME_CATALOG[0].key}`);

  const pijlen = vindAlle(view.gameRow, 'lobby-gamearrow');
  for (let i = 0; i < GAME_CATALOG.length; i += 1) klik(pijlen[1]);

  assert.ok(patches.length > 0);
  for (const patch of patches) {
    assert.deepEqual(Object.keys(patch), ['gameTypes']);
    assert.ok(isPlayableGameType(patch.gameTypes[0]));
  }
});

test('gamekeuze.mjs: update() synchroniseert de kaart met de serverconfig', async () => {
  stubDom();
  const { createGamekeuzeView } = await import(`./gamekeuze.mjs?t=${Math.random()}`);
  const view = createGamekeuzeView({ t, onConfigChange: () => {} });
  const doel = GAME_CATALOG.find((g) => g.gameType !== null && g.key !== GAME_CATALOG[0].key);

  view.update({ config: { gameTypes: [doel.gameType] } });
  assert.equal(vind(view.gameRow, 'lobby-gamecard-title').textContent, `lobby.game_${doel.key}`);
});

// ── delen.mjs ────────────────────────────────────────────────────────────

test('delen.mjs staat op zichzelf: capabilities bepalen welke deelknoppen zichtbaar zijn', async () => {
  stubDom();
  const { createDelenView } = await import(`./delen.mjs?t=${Math.random()}`);
  const acties = [];
  const view = createDelenView({ t, onShareAction: (a) => acties.push(a) });

  view.update({ capabilities: { nativeShareAvailable: false }, joinUrl: 'https://rounda.io/j/abc' });
  const copyBtn = vind(view.shareSection, 'lobby-share-copy-link');
  const nativeBtn = vind(view.shareSection, 'lobby-share-native-share');
  assert.equal(copyBtn.hidden, false);
  assert.equal(nativeBtn.hidden, true);

  klik(copyBtn);
  assert.deepEqual(acties, ['copy-link']);
});

// ── spelers.mjs ──────────────────────────────────────────────────────────

test('spelers.mjs staat op zichzelf: lege staat, dan een rij per deelnemer, met werkende kick', async () => {
  stubDom();
  const { createSpelersView } = await import(`./spelers.mjs?t=${Math.random()}`);
  const gekickt = [];
  const view = createSpelersView({
    t, tCount, isHost: true,
    onKickPlayer: (id) => gekickt.push(id),
    onHostRenamePlayer: () => {},
    onHostRecolorPlayer: () => {},
  });

  view.update({ playerCount: 0, participants: new Map(), canKick: true });
  assert.equal(view.emptyState.hidden, false);

  view.update({ playerCount: 1, participants: new Map([['p_1', 'Speler 7']]), canKick: true });
  assert.equal(view.emptyState.hidden, true);
  const rij = vind(view.list, 'lobby-player');
  assert.notEqual(rij, null);

  klik(vind(rij, 'lobby-player-kick'));
  assert.deepEqual(gekickt, ['p_1']);
});

test('spelersidentiteit stap 5: spelers.mjs toont de identiteit gerenderd in de apptaal, met vlag; een rename wist hem weer', async () => {
  stubDom();
  const { createSpelersView } = await import(`./spelers.mjs?t=${Math.random()}`);
  const view = createSpelersView({
    t, tCount, isHost: false,
    onKickPlayer: () => {},
    onHostRenamePlayer: () => {},
    onHostRecolorPlayer: () => {},
  });

  view.update({
    playerCount: 1,
    participants: new Map([['p_1', 'Bulgaarse Koe']]),
    participantIdentities: new Map([['p_1', { country: 'bg', word: 'cow' }]]),
    lang: 'es',
  });
  let rij = vind(view.list, 'lobby-player');
  assert.equal(vind(rij, 'player-chip-name').textContent, 'vaca búlgara');
  assert.equal(vind(rij, 'player-chip-flag').src, 'flags/bg.png');

  // player:rename wist de identiteit altijd — de rij valt terug op de kale naam.
  view.update({
    playerCount: 1,
    participants: new Map([['p_1', 'Nieuwe naam']]),
    participantIdentities: new Map([['p_1', null]]),
    lang: 'es',
  });
  rij = vind(view.list, 'lobby-player');
  assert.equal(vind(rij, 'player-chip-name').textContent, 'Nieuwe naam');
  assert.equal(vind(rij, 'player-chip-flag'), null);
});

// ── zelf.mjs ─────────────────────────────────────────────────────────────

test('zelf.mjs staat op zichzelf: selfSection verschijnt alleen voor een speler, hernoemen roept onRename aan', async () => {
  stubDom();
  const { createZelfView } = await import(`./zelf.mjs?t=${Math.random()}`);
  const hernoemd = [];
  const view = createZelfView({ t, isHost: false, onRename: (naam) => hernoemd.push(naam), onRecolor: () => {} });

  view.update({ selfIsPlayer: false, selfName: null, selfColor: null });
  assert.equal(view.selfSection.hidden, true);

  view.update({ selfIsPlayer: true, selfName: 'Ruben', selfColor: 'orange' });
  assert.equal(view.selfSection.hidden, false);
  assert.equal(vind(view.selfSection, 'lobby-self-name').textContent, 'Ruben');

  klik(vind(view.selfSection, 'lobby-self-rename'));
  const input = vind(view.selfSection, 'lobby-self-input');
  input.value = 'Nieuwe naam';
  klik(vind(view.selfSection, 'lobby-self-save'));
  await Promise.resolve();
  assert.deepEqual(hernoemd, ['Nieuwe naam']);
});

test('spelersidentiteit stap 5: zelf.mjs toont de eigen identiteit gerenderd in de apptaal, met vlag', async () => {
  stubDom();
  const { createZelfView } = await import(`./zelf.mjs?t=${Math.random()}`);
  const view = createZelfView({ t, isHost: false, onRename: () => {}, onRecolor: () => {} });

  view.update({
    selfIsPlayer: true,
    selfName: 'Bulgaarse Koe',
    selfColor: 'orange',
    selfIdentity: { country: 'bg', word: 'cow' },
    lang: 'en',
  });
  assert.equal(vind(view.selfSection, 'lobby-self-name').textContent, 'Bulgarian Cow');
  assert.equal(vind(view.selfSection, 'lobby-self-flag').hidden, false);
  assert.equal(vind(view.selfSection, 'lobby-self-flag').src, 'flags/bg.png');

  // Zelfgekozen naam (identity: null): kale naam, vlag verborgen.
  view.update({ selfIsPlayer: true, selfName: 'Ruben', selfColor: 'orange', selfIdentity: null, lang: 'en' });
  assert.equal(vind(view.selfSection, 'lobby-self-name').textContent, 'Ruben');
  assert.equal(vind(view.selfSection, 'lobby-self-flag').hidden, true);
});

// ── instellingen.mjs ─────────────────────────────────────────────────────

test('instellingen.mjs staat op zichzelf met geïnjecteerde gamekeuze-elementen, in de juiste volgorde', async () => {
  stubDom();
  const { createInstellingenView } = await import(`./instellingen.mjs?t=${Math.random()}`);
  const gameRow = { className: 'lobby-gamerow-stub', children: [] };
  const gameCardSub = { className: 'lobby-gamecard-sub-stub', children: [] };
  const patches = [];
  const view = createInstellingenView({
    t, isHost: true, onConfigChange: (patch) => patches.push(patch),
    gamekeuzeElements: [gameRow, gameCardSub],
  });

  // De carrousel-elementen staan VOOR instellingen.mjs's eigen rijen, zoals
  // in het ongesplitste bestand.
  assert.equal(view.settingsSection.children.length > 0, true);
  const body = vind(view.settingsSection, 'lobby-settings-body');
  assert.equal(body.children[0], gameRow);
  assert.equal(body.children[1], gameCardSub);

  view.update({ config: { difficulty: 'hard' } });
  const hardBtn = vindAlle(view.settingsSection, 'lobby-seg-option').find((b) => b.dataset.levelKey === 'hard');
  assert.equal(hardBtn.classList.contains('is-active'), true);

  klik(vindAlle(view.settingsSection, 'lobby-toggle')[1]); // autoReveal
  assert.deepEqual(patches, [{ autoReveal: false }]);
});

test('instellingen.mjs: continenten zijn multi-select en weigeren de laatste uit te zetten', async () => {
  stubDom();
  const { createInstellingenView } = await import(`./instellingen.mjs?t=${Math.random()}`);
  const patches = [];
  const view = createInstellingenView({
    t, isHost: true, onConfigChange: (patch) => patches.push(patch),
    gamekeuzeElements: [],
  });
  const continentBtns = vindAlle(view.settingsSection, 'lobby-seg-option').slice(-6);
  assert.equal(continentBtns.length, 6);

  for (const btn of continentBtns.slice(0, 5)) klik(btn);
  patches.length = 0;
  klik(continentBtns[5]);
  assert.equal(patches.length, 0, 'de laatste overgebleven continent blijft aan staan');
});
