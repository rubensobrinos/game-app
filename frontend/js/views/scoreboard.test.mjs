// views/scoreboard.test.mjs — scherm 5 (besluit 40): reveal + tussenstand
// als één scherm. Stub-DOM-patroon van state-message.test.mjs; dit toetst
// géén pixels maar de datakoppeling: welke reveal-elementen zichtbaar worden
// bij welk roundModel-result, en dat niets verzonnen wordt als data ontbreekt.

import { test } from 'node:test';
import assert from 'node:assert/strict';

function stubDom() {
  globalThis.HTMLElement ??= class HTMLElement {};
  const maak = () => {
    const el = {
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
      },
      setAttribute: (k, v) => el._attrs.set(k, v),
      getAttribute: (k) => el._attrs.get(k) ?? null,
      addEventListener: (soort, fn) => el._listeners.set(soort, fn),
      append: (...k) => el.children.push(...k),
      appendChild: (k) => (el.children.push(k), k),
      querySelector: () => null,
      remove: () => { el._verwijderd = true; },
      // FLIP-pad (tweede update) leest posities/stijl — neutrale stubs volstaan
      getBoundingClientRect: () => ({ top: 0, left: 0, width: 0, height: 0 }),
      style: {},
      offsetHeight: 0,
      offsetWidth: 0,
      // Punt 40: de aftelbalk zoekt zijn vulling via `firstElementChild`.
      // Zonder deze getter was die altijd `undefined` en sloeg de view het
      // hele drain-pad stil over — de reden dat de balk nooit in een test
      // opdook, ook toen hij in het echt stilstond.
      get firstElementChild() { return el.children[0] ?? null; },
    };
    Object.setPrototypeOf(el, HTMLElement.prototype);
    return el;
  };
  globalThis.document = { createElement: maak };
  globalThis.window = { matchMedia: undefined };
}

function vind(el, klasse) {
  if (typeof el?.className === 'string' && el.className.split(' ').includes(klasse)) return el;
  for (const kind of el?.children ?? []) {
    const raak = vind(kind, klasse);
    if (raak !== null) return raak;
  }
  return null;
}

const t = (k) => (k === 'reveal.countCorrect' ? '{n} van {m} zaten goed' : k);
const tCount = (k, n) => `${k}:${n}`;

const standings = {
  entries: [
    { position: 1, playerId: 'p1', effectiveName: 'Ties', score: 6240, isSelf: false },
    { position: 2, playerId: 'p2', effectiveName: 'Jij', score: 4120, isSelf: true },
  ],
  self: { position: 2, playerId: 'p2', effectiveName: 'Jij', score: 4120 },
};

test('scherm 5: reveal-kaart toont goede antwoord, eigen resultaat en telling', async () => {
  stubDom();
  const { createScoreboardView } = await import('./scoreboard.mjs?a');
  const root = document.createElement('div');
  const view = createScoreboardView({ root, t, tCount });
  view.update(standings, {
    round: {
      gameType: 'flags_mc',
      question: { optionIso2s: ['at', 'pe', 'lv', 'lb'] },
      progress: { answeredCount: 14, eligiblePlayerCount: 14 },
      result: {
        correctOptionId: 'at',
        correctChoice: null,
        correctSide: null,
        selfCorrect: true,
        selfNoAnswer: false,
        roundPoints: 847,
        distribution: [{ optionId: 'at', count: 9 }, { optionId: 'pe', count: 5 }],
      },
    },
    lang: 'nl',
    pacing: 'auto',
  });

  const kaart = vind(root, 'reveal-card');
  assert.equal(kaart.hidden, false);
  assert.equal(vind(root, 'reveal-card-answer').textContent, 'Oostenrijk');
  assert.equal(vind(root, 'reveal-card-count').textContent, '9 van {m} zaten goed'.replace('{m}', '14'));
  const zelf = vind(root, 'reveal-self');
  assert.equal(zelf.hidden, false);
  assert.equal(zelf.dataset.state, 'correct');
  assert.equal(vind(root, 'reveal-self-points').textContent, '+847');
  // auto-pacing: voet zichtbaar mét balk
  assert.equal(vind(root, 'reveal-next').hidden, false);
  assert.equal(vind(root, 'reveal-next-bar').hidden, false);
});

test('scherm 5: zonder result blijft het het oude tussenstand-scherm', async () => {
  stubDom();
  const { createScoreboardView } = await import('./scoreboard.mjs?b');
  const root = document.createElement('div');
  const view = createScoreboardView({ root, t, tCount });
  view.update(standings, { round: { result: null }, pacing: null });

  assert.equal(vind(root, 'reveal-card').hidden, true);
  assert.equal(vind(root, 'reveal-self').hidden, true);
  assert.equal(vind(root, 'reveal-next').hidden, true);
  // de tussenstand zelf staat er gewoon
  assert.equal(root ? vind(root, 'scoreboard-list').children.length : 0, 2);
});

test('scherm 5, beat 1 (ROUND_RESULT): reveal zichtbaar, tussenstand nog verborgen', async () => {
  stubDom();
  const { createScoreboardView } = await import('./scoreboard.mjs?d');
  const root = document.createElement('div');
  const view = createScoreboardView({ root, t, tCount });
  const round = {
    gameType: 'flags_mc',
    question: { optionIso2s: ['at', 'pe'] },
    progress: { answeredCount: 2, eligiblePlayerCount: 2 },
    result: {
      correctOptionId: 'at', correctChoice: null, correctSide: null,
      selfCorrect: true, selfNoAnswer: false, roundPoints: 500,
      distribution: [{ optionId: 'at', count: 2 }],
    },
  };
  view.update(standings, { round, pacing: 'auto', phase: 'ROUND_RESULT' });
  assert.equal(vind(root, 'reveal-card').hidden, false);
  assert.equal(vind(root, 'scoreboard-title').hidden, true);
  assert.equal(vind(root, 'scoreboard-list').hidden, true);
  // beat 2: zelfde view, fase SCOREBOARD → stand verschijnt
  view.update(standings, { round, pacing: 'auto', phase: 'SCOREBOARD' });
  assert.equal(vind(root, 'scoreboard-title').hidden, false);
  assert.equal(vind(root, 'scoreboard-list').hidden, false);
  assert.equal(vind(root, 'reveal-card').hidden, false);
});

test('scherm 5: fout antwoord + host-pacing → magenta-staat en host-hint zonder balk', async () => {
  stubDom();
  const { createScoreboardView } = await import('./scoreboard.mjs?c');
  const root = document.createElement('div');
  const view = createScoreboardView({ root, t, tCount });
  view.update(standings, {
    round: {
      gameType: 'flags_mc',
      question: { optionIso2s: ['at', 'pe'] },
      progress: null, // geen teller-data → geen "N van M"-regel
      result: {
        correctOptionId: 'at', correctChoice: null, correctSide: null,
        selfCorrect: false, selfNoAnswer: false, roundPoints: 0, distribution: null,
      },
    },
    pacing: 'host',
  });

  const zelf = vind(root, 'reveal-self');
  assert.equal(zelf.dataset.state, 'wrong');
  assert.equal(vind(root, 'reveal-card-count').hidden, true);
  assert.equal(vind(root, 'reveal-next').hidden, false);
  assert.equal(vind(root, 'reveal-next-bar').hidden, true);
  assert.equal(vind(root, 'reveal-next-text').textContent, 'standings.nextHost');
});

// ── Punt 40 (B2): de aftelbalk loopt over de tijd die de speler écht wacht ──
//
// De bug was niet dat de balk niet kón lopen, maar dat hij pas bij beat 2
// startte. Beat 1 (ROUND_RESULT, `resultSeconds`) stond hij dus vol stil, en
// bij de overgang naar beat 2 sprong hij terug naar vol en begon opnieuw.
// Deze drie tests leggen alle drie de momenten vast.

function rondeMetUitslag(roundId) {
  return {
    roundId,
    gameType: 'flags_mc',
    question: { optionIso2s: ['at', 'pe'] },
    progress: { answeredCount: 2, eligiblePlayerCount: 2 },
    result: {
      correctOptionId: 'at', correctChoice: null, correctSide: null,
      selfCorrect: true, selfNoAnswer: false, roundPoints: 500,
      distribution: [{ optionId: 'at', count: 2 }],
    },
  };
}

test('punt 40: de balk start al bij beat 1 en loopt over beat 1 + beat 2 samen', async () => {
  stubDom();
  const { createScoreboardView } = await import('./scoreboard.mjs?p40a');
  const root = document.createElement('div');
  const view = createScoreboardView({ root, t, tCount });
  const round = rondeMetUitslag('r1');

  view.update(standings, {
    round, pacing: 'auto', phase: 'ROUND_RESULT', resultSeconds: 5, scoreboardSeconds: 4,
  });

  const vulling = vind(root, 'reveal-next-bar').firstElementChild;
  // 5 + 4: de speler wacht op beide beats, dus daar loopt de balk overheen.
  assert.equal(vulling.style.animation, 'reveal-drain 9s linear forwards');
});

test('punt 40: de overgang naar beat 2 zet de balk NIET terug op vol', async () => {
  stubDom();
  const { createScoreboardView } = await import('./scoreboard.mjs?p40b');
  const root = document.createElement('div');
  const view = createScoreboardView({ root, t, tCount });
  const round = rondeMetUitslag('r1');

  view.update(standings, {
    round, pacing: 'auto', phase: 'ROUND_RESULT', resultSeconds: 5, scoreboardSeconds: 4,
  });
  const vulling = vind(root, 'reveal-next-bar').firstElementChild;
  const naBeatEen = vulling.style.animation;

  // Beat 2 én een gewone her-render binnen dezelfde ronde laten 'm doorlopen.
  view.update(standings, {
    round, pacing: 'auto', phase: 'SCOREBOARD', resultSeconds: 5, scoreboardSeconds: 4,
  });
  assert.equal(vulling.style.animation, naBeatEen, 'geen herstart bij de faseovergang');
  view.update(standings, {
    round, pacing: 'auto', phase: 'SCOREBOARD', resultSeconds: 5, scoreboardSeconds: 4,
  });
  assert.equal(vulling.style.animation, naBeatEen, 'geen herstart bij een her-render');

  // Een NIEUWE ronde start de balk wel opnieuw.
  view.update(standings, {
    round: rondeMetUitslag('r2'), pacing: 'auto', phase: 'ROUND_RESULT', resultSeconds: 5, scoreboardSeconds: 4,
  });
  assert.equal(vulling.style.animation, 'reveal-drain 9s linear forwards');
});

test('punt 40: wie pas bij beat 2 binnenkomt krijgt alleen de resterende beat', async () => {
  stubDom();
  const { createScoreboardView } = await import('./scoreboard.mjs?p40c');
  const root = document.createElement('div');
  const view = createScoreboardView({ root, t, tCount });

  // Herladen middenin SCOREBOARD: beat 1 is al voorbij, die tijd beloven we
  // niet nog een keer.
  view.update(standings, {
    round: rondeMetUitslag('r1'), pacing: 'auto', phase: 'SCOREBOARD', resultSeconds: 5, scoreboardSeconds: 4,
  });
  assert.equal(vind(root, 'reveal-next-bar').firstElementChild.style.animation, 'reveal-drain 4s linear forwards');
});

test('punt 40: zonder serverconfig valt de balk terug op de serverdefaults, niet op stilstand', async () => {
  stubDom();
  const { createScoreboardView } = await import('./scoreboard.mjs?p40d');
  const root = document.createElement('div');
  const view = createScoreboardView({ root, t, tCount });

  view.update(standings, { round: rondeMetUitslag('r1'), pacing: 'auto', phase: 'ROUND_RESULT' });
  // room-lifecycle.mjs: resultSeconds 5 + scoreboardSeconds 4
  assert.equal(vind(root, 'reveal-next-bar').firstElementChild.style.animation, 'reveal-drain 9s linear forwards');
});
