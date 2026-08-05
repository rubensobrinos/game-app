// views/lobby.test.mjs — scherm 2/3 (lobby + hostinstellingen).
//
// Ontbrak volledig tot 5 aug 2026 (PLAN-CONVERGENTIE §A5): de carrousel, de
// koppeling naar `game:update-config` en de terugsynchronisatie vanuit de
// serverconfig waren gebouwd zonder één regel test. Dat is precies het soort
// werk dat groen blijft terwijl het stukgaat — de carrousel zette
// `real_or_fake_flag` op speelbaar terwijl de server hem niet kon bouwen.
//
// Stub-DOM-patroon van scoreboard.test.mjs: geen pixels, wel de datakoppeling.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLAYABLE_GAME_TYPES, GAME_CATALOG, isPlayableGameType } from '../../../shared/content/game-catalog.mjs';

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
      title: '',
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
      insertBefore: (k) => (el.children.unshift(k), k),
      querySelector: () => null,
      querySelectorAll: () => [],
      focus: () => {},
      remove: () => { el._verwijderd = true; },
      getBoundingClientRect: () => ({ top: 0, left: 0, width: 0, height: 0 }),
      style: {},
      offsetHeight: 0,
      width: 0,
      height: 0,
      // De lobby mount het minigame (rounda-flag) op een <canvas>; die tekent
      // meteen een frame. Een neutrale 2d-context is genoeg — dit bestand
      // toetst de carrousel en de configkoppeling, niet het spelletje.
      getContext: () => new Proxy({}, {
        get: (doel, sleutel) => {
          if (sleutel === 'canvas') return el;
          if (sleutel === 'measureText') return () => ({ width: 0 });
          return () => {};
        },
        set: () => true,
      }),
    };
    Object.setPrototypeOf(el, HTMLElement.prototype);
    return el;
  };
  globalThis.document = {
    createElement: maak,
    createTextNode: (tekst) => ({ textContent: tekst, children: [] }),
    addEventListener: () => {},
    removeEventListener: () => {},
    hidden: false,
  };
  globalThis.window = { matchMedia: undefined, addEventListener: () => {}, removeEventListener: () => {} };
  globalThis.navigator ??= {};
  // Het minigame vraagt een animatieframe aan; nooit uitvoeren, alleen
  // registreren — anders draait er een spelletje mee tijdens de tests.
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
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

/** Alle elementen met deze klasse. */
function vindAlle(el, klasse, gevonden = []) {
  if (typeof el?.className === 'string' && el.className.split(' ').includes(klasse)) gevonden.push(el);
  for (const kind of el?.children ?? []) vindAlle(kind, klasse, gevonden);
  return gevonden;
}

const t = (k) => k;
const tCount = (k, n) => `${k}:${n}`;

const BASIS_MODEL = {
  playerCount: 2,
  participants: [],
  capabilities: {},
  joinUrl: 'https://rounda.io/j/abc',
  gameCode: 'ABC123',
  canStart: true,
  locked: false,
  selfIsPlayer: true,
  selfName: 'Host',
  selfColor: 'orange',
  config: {
    gameTypes: ['flags_mc'],
    totalRounds: 10,
    difficulty: 'normal',
    language: 'nl',
    pacing: 'auto',
    speedBonus: true,
    allowLateJoin: true,
  },
};

async function maakLobby(overrides = {}) {
  stubDom();
  const { createLobbyView } = await import(`./lobby.mjs?t=${Math.random()}`);
  const root = document.createElement('div');
  /** @type {Array<object>} */
  const patches = [];
  const view = createLobbyView({
    root,
    t,
    tCount,
    isHost: true,
    onStart: () => {},
    onShareAction: () => {},
    onKickPlayer: () => {},
    onRename: () => {},
    onRecolor: () => {},
    onConfigChange: (patch) => { patches.push(patch); },
    ...overrides,
  });
  view.update(BASIS_MODEL);
  return { root, view, patches };
}

function klik(el) {
  el._listeners.get('click')?.({ preventDefault: () => {}, stopPropagation: () => {} });
}

test('§A5: de carrousel toont de vier wereldgames uit de gedeelde catalogus', async () => {
  const { root } = await maakLobby();
  const kaartTitel = vind(root, 'lobby-gamecard-title');
  assert.notEqual(kaartTitel, null, 'de gamekaart hoort te bestaan');
  assert.equal(kaartTitel.textContent, `lobby.game_${GAME_CATALOG[0].key}`);
});

test('§A5: draaien naar een speelbare game stuurt precies één gameType via game:update-config', async () => {
  const { root, patches } = await maakLobby();
  const pijlen = vindAlle(root, 'lobby-gamearrow');
  assert.equal(pijlen.length, 2, 'vorige/volgende');

  // Zoek de eerstvolgende speelbare game ná de eerste; als er maar één
  // speelbare game is, komt de carrousel na een rondje weer bij zichzelf uit.
  const speelbaar = GAME_CATALOG.filter((game) => isPlayableGameType(game.gameType));
  for (let stap = 0; stap < GAME_CATALOG.length; stap += 1) {
    klik(pijlen[1]);
  }

  assert.ok(patches.length > 0, 'een rondje langs de carrousel raakt minstens één speelbare game');
  for (const patch of patches) {
    assert.deepEqual(Object.keys(patch), ['gameTypes']);
    assert.equal(patch.gameTypes.length, 1, 'exact één gameType (§A1)');
    assert.ok(
      speelbaar.some((game) => game.gameType === patch.gameTypes[0]),
      `${patch.gameTypes[0]} hoort speelbaar te zijn`,
    );
  }
});

test('§A5: draaien naar een NIET-speelbare game wijzigt de configuratie niet', async () => {
  const { root, patches } = await maakLobby();
  const pijlen = vindAlle(root, 'lobby-gamearrow');
  const nietSpeelbaar = GAME_CATALOG.filter((game) => !isPlayableGameType(game.gameType));
  assert.ok(nietSpeelbaar.length > 0, 'er staan BINNENKORT-games in de catalogus');

  const rondje = GAME_CATALOG.length;
  for (let stap = 0; stap < rondje; stap += 1) klik(pijlen[1]);

  const verstuurdeTypes = patches.map((patch) => patch.gameTypes[0]);
  for (const game of nietSpeelbaar) {
    assert.ok(
      !verstuurdeTypes.includes(game.gameType),
      `${game.key} is niet speelbaar en mag nooit verstuurd worden`,
    );
  }
  assert.ok(
    verstuurdeTypes.every(isPlayableGameType),
    'er is nooit een onspeelbare gameType over de lijn gegaan',
  );
});

test('§A5: een BINNENKORT-game toont dat ook, een speelbare niet', async () => {
  const { root, view } = await maakLobby();
  const pijlen = vindAlle(root, 'lobby-gamearrow');
  const soon = vind(root, 'lobby-gamecard-soon');

  // Eerste kaart is speelbaar (flags_mc): geen BINNENKORT-label.
  assert.equal(soon.textContent, '');

  // Draai door tot de eerste niet-speelbare game.
  const eersteOnspeelbaar = GAME_CATALOG.findIndex((game) => !isPlayableGameType(game.gameType));
  for (let stap = 0; stap < eersteOnspeelbaar; stap += 1) klik(pijlen[1]);
  assert.equal(soon.textContent, 'lobby.gameSoonStart');
  assert.ok(vind(root, 'lobby-gamecard').classList.contains('is-soon'));
  view.destroy?.();
});

test('§A5: de serverconfig synchroniseert de carrousel terug (serverstand is de waarheid)', async () => {
  const { root, view } = await maakLobby();
  const pijlen = vindAlle(root, 'lobby-gamearrow');
  const titel = vind(root, 'lobby-gamecard-title');

  // De host bladert naar een andere kaart...
  klik(pijlen[1]);
  assert.notEqual(titel.textContent, `lobby.game_${GAME_CATALOG[0].key}`);

  // ...en dan wijzigt de serverkeuze (hier of op een ander apparaat). De
  // carrousel volgt de server, niet het laatste bladeren.
  const doel = GAME_CATALOG.find((game) => game.gameType !== null && game.key !== GAME_CATALOG[0].key);
  view.update({ ...BASIS_MODEL, config: { ...BASIS_MODEL.config, gameTypes: [doel.gameType] } });
  assert.equal(titel.textContent, `lobby.game_${doel.key}`);
});

test('§A5: een gewone update (iemand komt binnen) trekt de host niet uit een BINNENKORT-kaart', async () => {
  const { root, view } = await maakLobby();
  const pijlen = vindAlle(root, 'lobby-gamearrow');
  const titel = vind(root, 'lobby-gamecard-title');

  klik(pijlen[1]);
  const bladerde = titel.textContent;

  // Zelfde config, alleen een speler erbij: de kaart blijft staan waar de
  // host 'm liet. update() draait bij élk room-event, dus terugspringen zou
  // bladeren onmogelijk maken.
  view.update({ ...BASIS_MODEL, playerCount: 3 });
  assert.equal(titel.textContent, bladerde);
});

test('§A5: de niveauknoppen volgen de serverconfig, niet de laatste tik', async () => {
  const { root, view } = await maakLobby();

  const actief = () => vindAlle(root, 'lobby-seg-option')
    .filter((btn) => btn.classList.contains('is-active'))
    .map((btn) => btn.dataset.levelKey)
    .filter((key) => key !== undefined);

  assert.deepEqual(actief(), ['medium'], 'normal uit de basisconfig = Medium');

  view.update({ ...BASIS_MODEL, config: { ...BASIS_MODEL.config, difficulty: 'hard' } });
  assert.deepEqual(actief(), ['hard']);

  view.update({ ...BASIS_MODEL, config: { ...BASIS_MODEL.config, difficulty: 'easy' } });
  assert.deepEqual(actief(), ['easy']);
});

// ── C2/C3 (punten 19/20/21 en 23) ────────────────────────────────────────

test('§C2: het kleurvlakje opent het palet, kiezen sluit het weer', async () => {
  const { root } = await maakLobby();
  const vlakje = vind(root, 'lobby-self-swatch');
  const palet = vind(root, 'lobby-self-colors');
  assert.notEqual(vlakje, null, 'het kleurvlakje hoort een knop te zijn');

  // Dicht bij binnenkomst: acht blokjes onder je naam kostten ~96px voor een
  // keuze die je één keer maakt.
  assert.equal(palet.hidden, true);
  assert.equal(vlakje.getAttribute('aria-expanded'), 'false');

  klik(vlakje);
  assert.equal(palet.hidden, false);
  assert.equal(vlakje.getAttribute('aria-expanded'), 'true');

  // Een kleur kiezen sluit het paneel; de stand zelf komt van de server.
  klik(vindAlle(root, 'lobby-self-color')[2]);
  assert.equal(palet.hidden, true);
  assert.equal(vlakje.getAttribute('aria-expanded'), 'false');
});

test('§C2: het palet toont precies de kleuren die de server kent', async () => {
  const { root } = await maakLobby();
  // 36 kleuren is protocolwerk (gesloten enum): wat hier staat moet exact het
  // serverpalet zijn, anders weigert de server de keuze.
  const { SERVER_KLEUREN } = await import('../player-chip.mjs');
  assert.equal(vindAlle(root, 'lobby-self-color').length, Object.keys(SERVER_KLEUREN).length);
});

test('§C3: horizontaal vegen over de gamekaart draait de carrousel, een tik niet', async () => {
  const { root } = await maakLobby();
  const kaart = vind(root, 'lobby-gamecard');
  const titel = vind(root, 'lobby-gamecard-title');
  const begin = titel.textContent;

  const veeg = (van, naar) => {
    kaart._listeners.get('pointerdown')?.({ clientX: van });
    kaart._listeners.get('pointerup')?.({ clientX: naar });
  };

  // Korte beweging = een tik op de kaart, geen veeg: er mag niets draaien.
  veeg(300, 285);
  assert.equal(titel.textContent, begin, 'onder de drempel blijft de kaart staan');

  // Naar links vegen brengt de volgende game in beeld.
  veeg(300, 200);
  assert.notEqual(titel.textContent, begin);

  // En terug naar rechts weer de vorige.
  veeg(200, 300);
  assert.equal(titel.textContent, begin);
});

// Besluit 51 (fase 4, autoReveal): de toggle was tot 6 aug 2026 een
// BINNENKORT-rij zonder besturingselement; nu een gewone toggle, zelfde vorm
// als "Automatisch volgende vraag" (`autoNextToggle`, eerste in DOM-volgorde).
test('besluit 51: de autoReveal-toggle stuurt autoReveal:false via game:update-config', async () => {
  const { root, patches } = await maakLobby();
  const toggles = vindAlle(root, 'lobby-toggle');
  assert.ok(toggles.length >= 2, 'autoNext en autoReveal moeten allebei een lobby-toggle zijn');
  const autoRevealToggle = toggles[1];

  klik(autoRevealToggle);
  assert.deepEqual(patches, [{ autoReveal: false }], 'standaard staat autoReveal aan, dus de eerste tik zet hem uit');
});

test('besluit 51: de autoReveal-toggle volgt de serverconfig, niet alleen de laatste tik', async () => {
  const { root, view } = await maakLobby();
  const autoRevealToggle = vindAlle(root, 'lobby-toggle')[1];

  assert.equal(autoRevealToggle.classList.contains('is-on'), true, 'standaard aan');
  assert.equal(autoRevealToggle.getAttribute('aria-checked'), 'true');

  view.update({ ...BASIS_MODEL, config: { ...BASIS_MODEL.config, autoReveal: false } });
  assert.equal(autoRevealToggle.classList.contains('is-on'), false);
  assert.equal(autoRevealToggle.getAttribute('aria-checked'), 'false');
});

test('besluit 51: ontbrekend autoReveal in de config (oudere snapshot) leest als aan', async () => {
  const { root } = await maakLobby();
  const autoRevealToggle = vindAlle(root, 'lobby-toggle')[1];
  assert.equal(autoRevealToggle.classList.contains('is-on'), true);
});
