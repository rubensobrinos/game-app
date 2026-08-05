// views/gameplay.test.mjs — scherm 4 (de vraag).
//
// Ontbrak volledig tot 5 aug 2026 (PLAN-CONVERGENTIE §A5). Dit bestand toetst
// de datakoppeling van de shell: de ronde-header, de inline antwoordvoortgang
// ("9/14 BINNEN", feedbackronde 3) en de aftelling — plus dat de vraag per
// gameType de juiste vorm krijgt. Geen pixels, geen animatie: stub-DOM-patroon
// van scoreboard.test.mjs.

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
      disabled: false,
      src: '',
      alt: '',
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
      removeAttribute: (k) => { el._attrs.delete(k); if (k === 'src') el.src = ''; },
      addEventListener: (soort, fn) => el._listeners.set(soort, fn),
      removeEventListener: (soort) => el._listeners.delete(soort),
      append: (...k) => el.children.push(...k),
      appendChild: (k) => (el.children.push(k), k),
      querySelector: () => null,
      querySelectorAll: () => [],
      remove: () => { el._verwijderd = true; },
      getBoundingClientRect: () => ({ top: 0, left: 0, width: 0, height: 0 }),
      getContext: () => new Proxy({}, { get: () => () => {}, set: () => true }),
      style: {},
      offsetHeight: 0,
      offsetWidth: 0,
      width: 0,
      height: 0,
    };
    Object.setPrototypeOf(el, HTMLElement.prototype);
    // Echte DOM-semantiek voor `textContent = ''`: dat gooit de kinderen weg.
    // De views leunen daarop om een vorige ronde te wissen, dus een stub die
    // dat níét doet zou een lek nooit kunnen betrappen.
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
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
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

const t = (k) => {
  if (k === 'game.inCount') return '{n}/{m} BINNEN';
  return k;
};

/** Een `round-model`-achtig model in ROUND_ACTIVE, met flags_mc als default. */
function actiefModel(overrides = {}) {
  return {
    roundId: 'r1',
    roundNumber: 6,
    totalRounds: 10,
    gameType: 'flags_mc',
    question: { targetIso2: 'at', optionIso2s: ['at', 'pe', 'lv', 'lb'] },
    startsAt: 1000,
    endsAt: 16000,
    selectedOptionId: null,
    selectedChoice: null,
    selectedSide: null,
    answerStatus: 'idle',
    progress: null,
    result: null,
    ...overrides,
  };
}

/** Zelfde tweevormenregel als i18n.mjs's `tCount`, zonder de echte woordenlijst. */
const tCount = (sleutel, n) => `${n} ${sleutel}.${n === 1 ? 'one' : 'other'}`;

async function maakView(antwoorden = [], extra = {}) {
  stubDom();
  const { createGameplayView } = await import(`./gameplay.mjs?t=${Math.random()}`);
  const root = document.createElement('div');
  const view = createGameplayView({ root, t, onAnswer: (waarde) => antwoorden.push(waarde), lang: 'nl', ...extra });
  return { root, view };
}

test('§A5: de ronde-header toont 06/10 met een meevullend rad', async () => {
  const { root, view } = await maakView();
  view.update(actiefModel(), { phase: 'ROUND_ACTIVE', secondsLeft: 12 });

  const tekst = vind(root, 'gameplay-round-text');
  assert.equal(tekst.children.map((kind) => kind.textContent).join(''), '06/10');

  const dial = vind(root, 'gameplay-round-dial');
  assert.ok(
    String(dial.style.background).includes('60%'),
    `het rad hoort op 60% te staan bij ronde 6 van 10, kreeg: ${dial.style.background}`,
  );
});

test('§A5: de inline antwoordvoortgang toont "9/14 BINNEN" en verdwijnt zonder voortgang', async () => {
  const { root, view } = await maakView();

  view.update(actiefModel(), { phase: 'ROUND_ACTIVE', secondsLeft: 12 });
  assert.equal(vind(root, 'gameplay-inline-progress').hidden, true, 'zonder progress-payload niets tonen');

  view.update(
    actiefModel({ progress: { answeredCount: 9, eligiblePlayerCount: 14 } }),
    { phase: 'ROUND_ACTIVE', secondsLeft: 12 },
  );
  assert.equal(vind(root, 'gameplay-inline-progress').hidden, false);
  assert.equal(vind(root, 'gameplay-inline-progress-text').textContent, '9/14 BINNEN');

  // De oude losse voortgangsregel is leeg: de telling staat nu in de kop.
  assert.equal(vind(root, 'gameplay-progress')?.textContent ?? '', '');
});

test('§A5: de aftelling is alleen zichtbaar in COUNTDOWN', async () => {
  const { root, view } = await maakView();

  view.update(actiefModel(), { phase: 'COUNTDOWN', countdownSecondsLeft: 3 });
  assert.equal(vind(root, 'gameplay-countdown').hidden, false);
  assert.equal(vind(root, 'gameplay-countdown-value').textContent, '3');

  view.update(actiefModel(), { phase: 'ROUND_ACTIVE', secondsLeft: 12 });
  assert.equal(vind(root, 'gameplay-countdown').hidden, true);
});

test('R2-8: tijdens het aftellen staat er geen leeg vlagkader', async () => {
  const { root, view } = await maakView();

  // Met een gevuld model: hervatten na een pauze telt af terwijl de vorige
  // ronde nog in het model zit (§A2). Ook dán hoort de vlag weg te zijn.
  view.update(actiefModel(), { phase: 'COUNTDOWN', countdownSecondsLeft: 3 });
  const vlag = vind(root, 'gameplay-flag');
  assert.equal(vlag.hidden, true, 'de vlag-img hoort verborgen te zijn, niet leeg zichtbaar');
  assert.equal(vlag.src, '', 'geen achtergebleven src van de vorige ronde');
  assert.equal(vind(root, 'gameplay-question').hidden, true);
  assert.equal(vindAlle(root, 'gameplay-option').length, 0);

  // En daarna staat de vraag er weer volledig, ondanks hetzelfde roundId.
  view.update(actiefModel(), { phase: 'ROUND_ACTIVE', secondsLeft: 12 });
  assert.equal(vind(root, 'gameplay-flag').hidden, false);
  assert.equal(vindAlle(root, 'gameplay-option').length, 4);
});

test('R2-8: het aftelscherm meldt hoeveel spelers klaar zijn', async () => {
  const { root, view } = await maakView([], { tCount });

  view.update(actiefModel(), { phase: 'COUNTDOWN', countdownSecondsLeft: 3, playerCount: 5 });
  const spelers = vind(root, 'gameplay-countdown-players');
  assert.equal(spelers.hidden, false);
  assert.equal(spelers.textContent, '5 game.countdownPlayersReady.other');

  // Eén speler krijgt de enkelvoudsvorm, niet "1 spelers".
  view.update(actiefModel(), { phase: 'COUNTDOWN', countdownSecondsLeft: 2, playerCount: 1 });
  assert.equal(vind(root, 'gameplay-countdown-players').textContent, '1 game.countdownPlayersReady.one');

  // Zonder telling geen regel — liever niets dan "0 spelers klaar".
  view.update(actiefModel(), { phase: 'COUNTDOWN', countdownSecondsLeft: 1, playerCount: null });
  assert.equal(vind(root, 'gameplay-countdown-players').hidden, true);
});

test('R2-8: zonder tCount blijft de spelersregel weg in plaats van een sleutelnaam te tonen', async () => {
  const { root, view } = await maakView();

  view.update(actiefModel(), { phase: 'COUNTDOWN', countdownSecondsLeft: 3, playerCount: 5 });
  assert.equal(vind(root, 'gameplay-countdown-players').hidden, true);
});

test('§A5: flags_mc rendert vier landknoppen en geeft de iso2 door aan onAnswer', async () => {
  const antwoorden = [];
  const { root, view } = await maakView(antwoorden);
  view.update(actiefModel(), { phase: 'ROUND_ACTIVE', secondsLeft: 12 });

  const opties = vindAlle(root, 'gameplay-option');
  assert.equal(opties.length, 4);
  opties[0]._listeners.get('click')?.();
  assert.deepEqual(antwoorden, ['at'], 'de eerste optie is de targetIso2 uit de vaste optievolgorde');
});

test('§A5: real_or_fake_flag rendert twee keuzes en geeft "real"/"fake" door', async () => {
  const antwoorden = [];
  const { root, view } = await maakView(antwoorden);
  view.update(
    actiefModel({ gameType: 'real_or_fake_flag', question: { kind: 'real', iso2: 'at' } }),
    { phase: 'ROUND_ACTIVE', secondsLeft: 12 },
  );

  const opties = vindAlle(root, 'gameplay-option');
  assert.equal(opties.length, 2);
  opties[0]._listeners.get('click')?.();
  opties[1]._listeners.get('click')?.();
  assert.deepEqual(antwoorden, ['real', 'fake']);
});

test('§A5: higher_lower rendert een duel met twee kanten en geeft de kant door', async () => {
  const antwoorden = [];
  const { root, view } = await maakView(antwoorden);
  view.update(
    actiefModel({
      gameType: 'higher_lower',
      question: { metric: 'population', sides: [{ side: 0, iso2: 'at' }, { side: 1, iso2: 'pe' }] },
    }),
    { phase: 'ROUND_ACTIVE', secondsLeft: 12 },
  );

  const opties = vindAlle(root, 'gameplay-option-duel');
  assert.equal(opties.length, 2);
  opties[1]._listeners.get('click')?.();
  assert.deepEqual(antwoorden, [1]);
});

test('§A5: een lege ronde laat niets van de vorige staan', async () => {
  const { root, view } = await maakView();
  view.update(actiefModel({ progress: { answeredCount: 3, eligiblePlayerCount: 5 } }), { phase: 'ROUND_ACTIVE' });
  view.update({ ...actiefModel(), roundId: null, question: null }, { phase: 'LOBBY' });

  assert.equal(vind(root, 'gameplay-inline-progress').hidden, true);
  assert.equal(vind(root, 'gameplay-round-text').textContent, '');
  assert.equal(vindAlle(root, 'gameplay-option').length, 0);
});

test('C-2: odd_one_out rendert vier kaarten en geeft de kaartindex door', async () => {
  const antwoorden = [];
  const { root, view } = await maakView(antwoorden);
  view.update(
    actiefModel({
      gameType: 'odd_one_out',
      question: {
        cards: [
          { cardIndex: 0, iso2: 'fr' },
          { cardIndex: 1, iso2: 'de' },
          { cardIndex: 2, iso2: 'es' },
          { cardIndex: 3, iso2: 'jp' },
        ],
      },
    }),
    { phase: 'ROUND_ACTIVE', secondsLeft: 12 },
  );

  const kaarten = vindAlle(root, 'gameplay-option-card');
  assert.equal(kaarten.length, 4, 'vier kaarten, geen vraagafbeelding erboven — de kaarten zijn de vraag');

  kaarten[3]._listeners.get('click')?.();
  assert.deepEqual(antwoorden, [3], 'de kaartindex gaat door, niet de rijvolgorde of de iso2');
});

test('punt 11: een odd_one_out-kaart met een vlagspec wordt getekend, niet als afbeelding geladen', async () => {
  const antwoorden = [];
  const { root, view } = await maakView(antwoorden);
  view.update(
    actiefModel({
      gameType: 'odd_one_out',
      question: {
        cards: [
          { cardIndex: 0, iso2: 'fr' },
          { cardIndex: 1, iso2: 'de' },
          { cardIndex: 2, spec: { pattern: 'hstripes', palette: ['#000', '#fff', '#f00'] }, seed: 'fx_1' },
          { cardIndex: 3, iso2: 'es' },
        ],
      },
    }),
    { phase: 'ROUND_ACTIVE', secondsLeft: 12 },
  );

  const kaarten = vindAlle(root, 'gameplay-option-card');
  assert.equal(kaarten.length, 4);

  // Geen landnamen onder de kaarten: de echte kaarten zouden er dan één hebben
  // en de gegenereerde niet — dat wijst het antwoord aan.
  for (const kaart of kaarten) {
    assert.equal(kaart.textContent, '', 'een kaart toont alleen de vlag');
    assert.match(kaart.getAttribute('aria-label') ?? '', /oddOneOutCard/);
  }

  // De nepvlag hangt aan een canvas, de echte aan een <img>.
  const soorten = kaarten.map((kaart) => kaart.children[0].tagName);
  assert.deepEqual(soorten, ['IMG', 'IMG', 'CANVAS', 'IMG']);
});
