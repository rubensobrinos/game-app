// views/scoreboard.test.mjs — scherm 5 (besluit 40): reveal + tussenstand
// als één scherm. Stub-DOM-patroon van state-message.test.mjs; dit toetst
// géén pixels maar de datakoppeling: welke reveal-elementen zichtbaar worden
// bij welk roundModel-result, en dat niets verzonnen wordt als data ontbreekt.

import { test } from 'node:test';
import assert from 'node:assert/strict';

function stubDom() {
  globalThis.HTMLElement ??= class HTMLElement {};
  const maak = (tag = 'div') => {
    const el = {
      // B3: het revealscherm kiest tussen een <img> en een <canvas> voor de
      // vlag, dus de stub moet die twee uit elkaar kunnen houden.
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
      // B3: de revealkaart tekent een gegenereerde vlag op een canvas.
      getContext: () => new Proxy({}, { get: () => () => {}, set: () => true }),
      src: '',
      alt: '',
      removeAttribute: (k) => el._attrs.delete(k),
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

// ══ B3: kleur, vlag en je eigen antwoord op het revealscherm ══════════════
//
// Drie besluiten van de producteigenaar (5 aug), plus punt 42 (de lege
// onderhelft). De kaart was altijd lime — ook bij "Geen antwoord +0".

function rondeFlagsMc({ correct = 'at', gekozen = null, self = 'correct' } = {}) {
  return {
    roundId: 'r1',
    gameType: 'flags_mc',
    question: { targetIso2: correct, optionIso2s: [correct, 'pe', 'ro', 'md'] },
    selectedOptionId: gekozen,
    selectedChoice: null,
    selectedSide: null,
    selectedCardIndex: null,
    progress: { eligiblePlayerCount: 4 },
    result: {
      correctOptionId: correct, correctChoice: null, correctSide: null, correctCardIndex: null,
      selfCorrect: self === 'correct',
      selfNoAnswer: self === 'noanswer',
      roundPoints: self === 'correct' ? 800 : 0,
      distribution: [],
    },
  };
}

async function toon(ronde, naam) {
  const { createScoreboardView } = await import(`./scoreboard.mjs?${naam}`);
  const root = document.createElement('div');
  const view = createScoreboardView({ root, t, tCount });
  view.update(standings, { round: ronde, lang: 'nl', pacing: 'auto', phase: 'ROUND_RESULT' });
  return root;
}

test('B3: goed is lime, fout is magenta, geen antwoord is gedempt', async () => {
  stubDom();
  const goed = await toon(rondeFlagsMc({ self: 'correct' }), 'b3a');
  assert.equal(vind(goed, 'reveal-card').dataset.state, 'correct');

  stubDom();
  const fout = await toon(rondeFlagsMc({ self: 'wrong', gekozen: 'ro' }), 'b3b');
  assert.equal(vind(fout, 'reveal-card').dataset.state, 'wrong');

  stubDom();
  const geen = await toon(rondeFlagsMc({ self: 'noanswer' }), 'b3c');
  // Bewust NIET magenta: je hebt niets fout gedaan, je was er niet bij.
  assert.equal(vind(geen, 'reveal-card').dataset.state, 'noanswer');
});

test('B3: de vlag van het juiste antwoord staat op de kaart', async () => {
  stubDom();
  const root = await toon(rondeFlagsMc({ correct: 'at' }), 'b3d');
  const vlag = vind(root, 'reveal-card-flag');
  assert.equal(vlag.tagName, 'IMG');
  assert.equal(vlag.hidden, false);
  assert.match(vlag.src, /at\.png$/);
  // De landnaam blijft ernaast staan — vlag én land, niet vlag óf land.
  assert.equal(vind(root, 'reveal-card-answer').textContent, 'Oostenrijk');
});

test('B3: een gegenereerde vlag wordt getekend, niet als afbeelding geladen', async () => {
  stubDom();
  // real_or_fake_flag met een nepvlag: er is geen bestaand asset om te laden.
  const root = await toon({
    roundId: 'r1',
    gameType: 'real_or_fake_flag',
    question: { kind: 'fake', spec: { pattern: 'hstripes', palette: ['#f00', '#0f0', '#00f'] } },
    selectedChoice: 'real',
    progress: { eligiblePlayerCount: 2 },
    result: {
      correctOptionId: null, correctChoice: 'fake', correctSide: null, correctCardIndex: null,
      selfCorrect: false, selfNoAnswer: false, roundPoints: 0, distribution: [],
    },
  }, 'b3e');

  const doek = vind(root, 'reveal-card-flag-canvas');
  assert.equal(doek.hidden, false, 'de getekende vlag is zichtbaar');
  const img = vind(root, 'reveal-card-flag');
  assert.equal(img.tagName, 'IMG');
  assert.equal(img.hidden, true, 'geen <img> die een niet-bestaand asset probeert te laden');
});

test('B3: bij odd_one_out toont de kaart de vlag die het juiste antwoord was', async () => {
  stubDom();
  const root = await toon({
    roundId: 'r1',
    gameType: 'odd_one_out',
    question: {
      cards: [
        { cardIndex: 0, iso2: 'fr' },
        { cardIndex: 1, iso2: 'de' },
        { cardIndex: 2, iso2: 'br' }, // de vreemde eend
        { cardIndex: 3, iso2: 'it' },
      ],
    },
    selectedCardIndex: 0,
    progress: { eligiblePlayerCount: 3 },
    result: {
      correctOptionId: null, correctChoice: null, correctSide: null, correctCardIndex: 2,
      selfCorrect: false, selfNoAnswer: false, roundPoints: 0, distribution: [],
      resultDetails: null,
    },
  }, 'b3f');

  // Niet de eerste kaart en niet de gekozen kaart: die van het juiste antwoord.
  assert.match(vind(root, 'reveal-card-flag').src, /br\.png$/);
  assert.equal(vind(root, 'reveal-card-answer').textContent, 'Brazilië');
});

test('B3: je eigen antwoord verschijnt alleen als je ernaast zat', async () => {
  stubDom();
  const fout = await toon(rondeFlagsMc({ correct: 'md', gekozen: 'ro', self: 'wrong' }), 'b3g');
  const mijn = vind(fout, 'reveal-mine');
  assert.equal(mijn.hidden, false);
  // De leuke bijna-goed: Moldavië en Roemenië verwarren.
  assert.equal(mijn.textContent, 'reveal.yourAnswer');
  assert.equal(vind(fout, 'reveal-card-answer').textContent, 'Moldavië');

  stubDom();
  const goed = await toon(rondeFlagsMc({ gekozen: 'at', self: 'correct' }), 'b3h');
  assert.equal(vind(goed, 'reveal-mine').hidden, true, 'bij goed staat het antwoord al groot bovenaan');

  stubDom();
  const geen = await toon(rondeFlagsMc({ self: 'noanswer' }), 'b3i');
  assert.equal(vind(geen, 'reveal-mine').hidden, true, 'geen antwoord = niets te tonen');
});

test('B3: hoger/lager noemt de metric erbij (overgenomen uit de dode gameplay-variant)', async () => {
  stubDom();
  const root = await toon({
    roundId: 'r1',
    gameType: 'higher_lower',
    question: { metric: 'population', sides: [{ side: 0, iso2: 'fr' }, { side: 1, iso2: 'de' }] },
    selectedSide: 0,
    progress: { eligiblePlayerCount: 2 },
    result: {
      correctOptionId: null, correctChoice: null, correctSide: 1, correctCardIndex: null,
      selfCorrect: false, selfNoAnswer: false, roundPoints: 0, distribution: [],
    },
  }, 'b3j');

  assert.equal(vind(root, 'reveal-card-answer').textContent, 'game.higherLowerResult');
  assert.match(vind(root, 'reveal-card-flag').src, /de\.png$/, 'de vlag van de winnende kant');
});

test('besluit 49: capitals_mc toont de hoofdstad als goede antwoord bij de gewone richting (ask-capital)', async () => {
  stubDom();
  // fr + deze optieset hasht op 'ask-capital' (country-names.test.mjs bewijst
  // de functie zelf) — het juiste antwoord is dan de hoofdstad, niet het land.
  const root = await toon({
    roundId: 'r1',
    gameType: 'capitals_mc',
    question: { targetIso2: 'fr', optionIso2s: ['fr', 'de', 'es', 'it'] },
    selectedOptionId: 'de',
    selectedChoice: null,
    selectedSide: null,
    selectedCardIndex: null,
    progress: { eligiblePlayerCount: 4 },
    result: {
      correctOptionId: 'fr', correctChoice: null, correctSide: null, correctCardIndex: null,
      selfCorrect: false, selfNoAnswer: false, roundPoints: 0, distribution: [],
    },
  }, 'capmc-a');

  assert.equal(vind(root, 'reveal-card-answer').textContent, 'Parijs', 'de hoofdstad van Frankrijk, niet "Frankrijk"');
  assert.equal(vind(root, 'reveal-mine').textContent, 'reveal.yourAnswer', 'sleutel, want t() vertaalt niet in deze test');
});

test('besluit 49: capitals_mc toont het land als goede antwoord bij de omgekeerde richting (ask-country)', async () => {
  stubDom();
  // pe + deze optieset hasht op 'ask-country' — het juiste antwoord is dan
  // het land ("Lima hoort bij welk land?" -> "Peru"), niet de hoofdstad.
  const root = await toon({
    roundId: 'r1',
    gameType: 'capitals_mc',
    question: { targetIso2: 'pe', optionIso2s: ['pe', 'at', 'lv', 'lb'] },
    selectedOptionId: 'lv',
    selectedChoice: null,
    selectedSide: null,
    selectedCardIndex: null,
    progress: { eligiblePlayerCount: 4 },
    result: {
      correctOptionId: 'pe', correctChoice: null, correctSide: null, correctCardIndex: null,
      selfCorrect: false, selfNoAnswer: false, roundPoints: 0, distribution: [],
    },
  }, 'capmc-b');

  assert.equal(vind(root, 'reveal-card-answer').textContent, 'Peru', 'het land, niet "Lima"');
});

test('B3: zonder bruikbare vlagbron blijft het beeld leeg in plaats van verkeerd', async () => {
  stubDom();
  const root = await toon({
    roundId: 'r1',
    gameType: 'flags_mc',
    question: {}, // geen targetIso2
    selectedOptionId: null,
    progress: null,
    result: {
      correctOptionId: null, correctChoice: null, correctSide: null, correctCardIndex: null,
      selfCorrect: false, selfNoAnswer: true, roundPoints: 0, distribution: [],
    },
  }, 'b3k');

  assert.equal(vind(root, 'reveal-card').hidden, true, 'geen antwoordtekst → geen kaart');
  assert.equal(vind(root, 'reveal-card-flag').hidden, true);
});

// ══ De streakreactie, hersteld op scherm 5 ════════════════════════════════
//
// 11-verzoek (BOUWSPRINT doel 4). Stond in gameplay.mjs's uitslagblok en was
// daarmee onzichtbaar sinds besluit 40 de reveal naar dít scherm verhuisde.
// De producteigenaar vroeg erom en heeft 'm nooit gezien.

async function metStreak(streak, ronde, naam) {
  const { createScoreboardView } = await import(`./scoreboard.mjs?${naam}`);
  const root = document.createElement('div');
  const view = createScoreboardView({ root, t, tCount });
  view.update(standings, { round: ronde, lang: 'nl', pacing: 'auto', phase: 'ROUND_RESULT', streak });
  return root;
}

test('streak: vanaf drie op een rij verschijnt de reactie, daaronder niet', async () => {
  for (const n of [0, 1, 2]) {
    stubDom();
    const root = await metStreak(n, rondeFlagsMc({ self: 'correct' }), `st${n}`);
    assert.equal(vind(root, 'reveal-streak').hidden, true, `${n} op een rij is geen reactie waard`);
  }

  stubDom();
  const root = await metStreak(3, rondeFlagsMc({ self: 'correct' }), 'st3');
  const regel = vind(root, 'reveal-streak');
  assert.equal(regel.hidden, false);
  // Besluit 44: negen varianten per situatie, dus de sleutel eindigt op een
  // index. Welke variant het wordt is willekeurig; dát het er één uit de
  // streakfamilie is, is de eis.
  assert.match(regel.textContent, /^headline\.streak\.[0-8]$/);
});

test('streak: een onderbroken reeks toont niets — dit is een beloning, geen mededeling', async () => {
  // streak-model.mjs zet de teller op 0 bij fout of geen antwoord, dus dit is
  // de stand die scherm 5 dan binnenkrijgt.
  stubDom();
  const fout = await metStreak(0, rondeFlagsMc({ self: 'wrong', gekozen: 'ro' }), 'st4');
  assert.equal(vind(fout, 'reveal-streak').hidden, true);

  stubDom();
  const geen = await metStreak(0, rondeFlagsMc({ self: 'noanswer' }), 'st5');
  assert.equal(vind(geen, 'reveal-streak').hidden, true);
});

test('streak: uitgezette reactiezinnen komen als 0 binnen en tonen dus niets', async () => {
  // session-shell.mjs stuurt `0` i.p.v. het echte getal als de speler
  // reactiezinnen heeft uitgezet — dit scherm kent die voorkeur niet.
  stubDom();
  const root = await metStreak(0, rondeFlagsMc({ self: 'correct' }), 'st6');
  assert.equal(vind(root, 'reveal-streak').hidden, true);
});

test('streak en je eigen antwoord kunnen nooit samen in beeld staan', async () => {
  // Ze delen dezelfde plek onder de uitslagregel. Dat mag alleen omdat een
  // streak `selfCorrect` impliceert en "Jij: …" uitsluitend bij fout komt.
  stubDom();
  const goed = await metStreak(5, rondeFlagsMc({ self: 'correct' }), 'st7');
  assert.equal(vind(goed, 'reveal-streak').hidden, false);
  assert.equal(vind(goed, 'reveal-mine').hidden, true);

  stubDom();
  const fout = await metStreak(0, rondeFlagsMc({ self: 'wrong', gekozen: 'ro' }), 'st8');
  assert.equal(vind(fout, 'reveal-streak').hidden, true);
  assert.equal(vind(fout, 'reveal-mine').hidden, false);
});

test('streak: zonder uitslag (herladen middenin de stand) staat er niets', async () => {
  stubDom();
  const { createScoreboardView } = await import('./scoreboard.mjs?st9');
  const root = document.createElement('div');
  const view = createScoreboardView({ root, t, tCount });
  view.update(standings, { round: { result: null }, pacing: null, streak: 7 });
  assert.equal(vind(root, 'reveal-streak').hidden, true);
});
