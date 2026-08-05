// views/hostbar.test.mjs — UI5, de hostbalk in de chromerij.
//
// Ontbrak volledig tot 5 aug 2026. Toegevoegd bij pakket B (punten 52 en 53):
// dit bestand toetst het GEDRAG van het ⋯-menu — wanneer het bestaat, wat er
// zichtbaar is en wat er gebeurt als je het opent — niet hoe het eruitziet.
// Stub-DOM-patroon van scoreboard.test.mjs.

import { test } from 'node:test';
import assert from 'node:assert/strict';

function stubDom({ confirmAntwoord = true } = {}) {
  globalThis.HTMLElement ??= class HTMLElement {};
  const maak = (tag = 'div') => {
    const el = {
      tagName: String(tag).toUpperCase(),
      className: '',
      textContent: '',
      hidden: false,
      disabled: false,
      type: '',
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
      // Onthouden wie de focus kreeg: D3 verplaatst 'm bewust naar de uitweg
      // zodra de knop eronder verdwijnt.
      focus() { globalThis.__laatsteFocus = el; },
      style: {},
    };
    Object.setPrototypeOf(el, HTMLElement.prototype);
    return el;
  };
  globalThis.document = { createElement: maak };
  globalThis.window = { confirm: () => confirmAntwoord };
}

function vind(el, klasse) {
  if (typeof el?.className === 'string' && el.className.split(' ').includes(klasse)) return el;
  for (const kind of el?.children ?? []) {
    const raak = vind(kind, klasse);
    if (raak !== null) return raak;
  }
  return null;
}

function klik(el) {
  const fn = el._listeners.get('click');
  assert.equal(typeof fn, 'function', `geen klikhandler op ${el.className}`);
  fn();
}

const t = (k) => k;
/** Zelfde tweevormenregel als i18n.mjs's `tCount`, zonder de woordenlijst. */
const tCount = (sleutel, n) => `${sleutel}.${n === 1 ? 'one' : 'other'}(${n})`;
const SPELERS = () => new Map([['p1', 'Ties'], ['p2', 'Noor']]);
/** De acties die `host-controls-state.mjs` tijdens een lopende ronde geeft. */
const TIJDENS_SPEL = ['pause', 'lock', 'kick', 'finish'];

async function bouw(opties = {}) {
  const { createHostBar } = await import(`./hostbar.mjs?${Math.random()}`);
  const root = document.createElement('div');
  const acties = [];
  const bar = createHostBar({ root, t, tCount, onAction: (a, p) => acties.push([a, p ?? null]) });
  bar.update({
    isHost: true,
    availableActions: TIJDENS_SPEL,
    participants: SPELERS(),
    phase: 'ROUND_ACTIVE',
    ...opties,
  });
  return { root, bar, acties };
}

/** De weg naar een zichtbare Verwijder-knop: lade open, dan de rij open. */
function openSpelerRij(root) {
  klik(vind(root, 'session-hostbar-players-toggle'));
  klik(vind(root, 'session-hostbar-player-menu'));
}

// ── Punt 52 ────────────────────────────────────────────────────────────────

test('punt 52: de ⋯ van een spelerrij verdwijnt zodra Verwijder verschijnt', async () => {
  stubDom();
  const { root } = await bouw();

  const rijMenu = vind(root, 'session-hostbar-player-menu');
  const kick = vind(root, 'session-hostbar-kick');
  assert.equal(rijMenu.hidden, false, 'dicht: alleen de ⋯');
  assert.equal(kick.hidden, true);

  klik(vind(root, 'session-hostbar-players-toggle'));
  klik(rijMenu);
  // Dit is de bevinding uit IMG_0294: een omkaderde knop met alleen puntjes
  // erin, pal naast Verwijder. Toggle en actie horen elkaar af te wisselen.
  assert.equal(kick.hidden, false, 'open: Verwijder');
  assert.equal(rijMenu.hidden, true, 'open: géén lege ⋯-knop ernaast');
});

test('punt 52: het annuleren van de bevestiging brengt de rij terug naar de ⋯', async () => {
  stubDom({ confirmAntwoord: false });
  const { root, acties } = await bouw();

  const rijMenu = vind(root, 'session-hostbar-player-menu');
  const kick = vind(root, 'session-hostbar-kick');
  openSpelerRij(root);
  klik(kick);
  // D3: de bevestiging is geen `window.confirm()` meer maar een stap ín de
  // rij (punt 49/50 — een native dialoog is het meest dominante dat er is).
  klik(vind(root, 'session-hostbar-kick-no'));

  assert.deepEqual(acties, [], 'annuleren verwijdert niemand');
  // Zonder deze weg terug houdt een per ongeluk geopende rij alléén nog een
  // destructieve knop over, en geen enkele uitweg.
  assert.equal(rijMenu.hidden, false);
  assert.equal(kick.hidden, true);
});

test('punt 52 + D3: verwijderen kost drie tikken, en pas de derde doet iets', async () => {
  stubDom();
  const { root, acties } = await bouw();

  openSpelerRij(root);
  klik(vind(root, 'session-hostbar-kick'));
  assert.deepEqual(acties, [], 'de knop "Verwijder" vraagt alleen nog om bevestiging');
  assert.equal(vind(root, 'session-hostbar-confirm-row').hidden, false);

  klik(vind(root, 'session-hostbar-kick-yes'));
  assert.deepEqual(acties, [['kick', { playerId: 'p1' }]]);
});

// ── Punt 53 ────────────────────────────────────────────────────────────────

test('punt 53: in de LOBBY bestaat de hostbalk niet — JS en CSS zeiden iets anders', async () => {
  stubDom();
  const { root } = await bouw({ phase: 'LOBBY', availableActions: ['start', 'lock', 'kick', 'finish'] });

  // `rounda-1c.css` verbergt de balk in de lobby (feedbackronde 4 aug #8+#9);
  // deze module bouwde 'm daar wél op, inclusief een ⋯-knop met "Beëindigen"
  // die niemand ooit zag. Eén bron van waarheid.
  assert.equal(vind(root, 'session-hostbar').hidden, true);
});

test('punt 53: een faseovergang klapt het open ⋯-paneel dicht', async () => {
  stubDom();
  const { root, bar } = await bouw();

  const meer = vind(root, 'session-hostbar-more');
  klik(meer);
  assert.equal(vind(root, 'session-hostbar-panel').hidden, false);
  assert.equal(meer.getAttribute('aria-expanded'), 'true');

  // Zonder dit wisselde de inhoud van het paneel ONDER de vinger van de host:
  // op de eindstand verdwijnt "Beëindigen" en blijft alleen de spelerslijst
  // over, op precies dezelfde plek.
  bar.update({
    isHost: true,
    availableActions: ['lock', 'kick', 'rematch'],
    participants: SPELERS(),
    phase: 'FINISHED',
  });
  assert.equal(vind(root, 'session-hostbar-panel').hidden, true);
  assert.equal(vind(root, 'session-hostbar-more').getAttribute('aria-expanded'), 'false');
});

test('punt 53: het paneel sluiten reset ook de rijen erin', async () => {
  stubDom();
  const { root } = await bouw();

  const meer = vind(root, 'session-hostbar-more');
  klik(meer);
  const rijMenu = vind(root, 'session-hostbar-player-menu');
  openSpelerRij(root);
  assert.equal(rijMenu.hidden, true);

  klik(meer); // dichtklappen
  // Heropenen hoort dezelfde stand te tonen als de eerste keer — anders ziet
  // het menu er per keer anders uit zonder dat er iets veranderd is.
  assert.equal(rijMenu.hidden, false);
  assert.equal(vind(root, 'session-hostbar-kick').hidden, true);
  assert.equal(vind(root, 'session-hostbar-players').hidden, true, 'ook de lade zelf klapt dicht');
});

test('punt 53: verdwijnt de laatste paneelinhoud, dan gaat het paneel ook dicht', async () => {
  stubDom();
  const { root, bar } = await bouw();
  klik(vind(root, 'session-hostbar-more'));
  assert.equal(vind(root, 'session-hostbar-panel').hidden, false);

  // D3 heeft dit geval verlegd: `lock` HEEFT nu een knop, dus een host met
  // alleen pause+lock houdt wél iets in zijn menu. Zonder hostacties (een
  // speler) is de balk sowieso verborgen; dit is dus de scherpste variant
  // die overblijft: geen enkele beschikbare actie.
  bar.update({ isHost: true, availableActions: [], participants: new Map(), phase: 'ROUND_ACTIVE' });
  assert.equal(vind(root, 'session-hostbar-more').hidden, true);
  assert.equal(vind(root, 'session-hostbar-panel').hidden, true);
});

// ── D3: de rangorde in het menu ────────────────────────────────────────────

test('D3: beëindigen staat niet op het eerste niveau, vergrendelen wel', async () => {
  stubDom();
  const { root } = await bouw();

  // Besluit producteigenaar: "Beëindigen moet in de hostinstellingen verstopt
  // zijn." Vóór D3 was dit de eerste en meest opvallende knop van het menu.
  assert.equal(vind(root, 'session-hostbar-settings').hidden, true, 'de lade is dicht');
  assert.equal(vind(root, 'session-hostbar-lock').hidden, false);
  assert.equal(vind(root, 'session-hostbar-lock').textContent, 'hostbar.lock');

  const paneel = vind(root, 'session-hostbar-panel');
  const eerste = paneel.children.filter((k) => k.hidden !== true)[0];
  assert.equal(eerste.className.includes('session-hostbar-lock'), true, 'vergrendelen staat bovenaan');
});

test('D3: beëindigen kost drie tikken en de vraag noemt het aantal spelers', async () => {
  stubDom();
  const { root, acties } = await bouw();

  klik(vind(root, 'session-hostbar-settings-toggle'));
  assert.equal(vind(root, 'session-hostbar-settings').hidden, false);

  klik(vind(root, 'session-hostbar-finish'));
  assert.deepEqual(acties, [], 'de tweede tik vraagt alleen om bevestiging');
  // Binnen de lade zoeken: de spelerslijst heeft ook confirm-vragen, en die
  // staan eerder in de boom.
  assert.equal(
    vind(vind(root, 'session-hostbar-settings'), 'session-hostbar-confirm-question').textContent,
    'hostbar.finishConfirmCount.other(2)',
    'het aantal spelers hoort in de vraag',
  );

  klik(vind(root, 'session-hostbar-finish-yes'));
  assert.deepEqual(acties, [['finish', null]]);
});

test('D3: annuleren en het menu sluiten brengen beëindigen terug naar stap 0', async () => {
  stubDom();
  const { root, bar } = await bouw();

  klik(vind(root, 'session-hostbar-settings-toggle'));
  klik(vind(root, 'session-hostbar-finish'));
  klik(vind(root, 'session-hostbar-finish-no'));
  assert.equal(vind(root, 'session-hostbar-confirm').hidden, true);
  assert.equal(vind(root, 'session-hostbar-finish').hidden, false);

  // "Als je verkeerd klikt moet je weer opnieuw beginnen": een half ingezette
  // bevestiging mag geen faseovergang overleven.
  klik(vind(root, 'session-hostbar-settings-toggle'));
  klik(vind(root, 'session-hostbar-finish'));
  bar.update({ isHost: true, availableActions: TIJDENS_SPEL, participants: SPELERS(), phase: 'SCOREBOARD' });
  assert.equal(vind(root, 'session-hostbar-settings').hidden, true);
  assert.equal(vind(root, 'session-hostbar-confirm').hidden, true);
});

test('D3: de bevestigingsstap zet de focus op de uitweg, niet op de rode knop', async () => {
  stubDom();
  const { root } = await bouw();
  globalThis.__laatsteFocus = null;

  klik(vind(root, 'session-hostbar-settings-toggle'));
  klik(vind(root, 'session-hostbar-finish'));

  // Gemeten in de browser: zonder dit viel de focus terug naar `body` (de
  // geklikte knop wordt immers verborgen), waarna Escape het menu niet meer
  // sloot. En bewust "Annuleren": twee keer Enter mag nooit een potje
  // beëindigen.
  assert.equal(globalThis.__laatsteFocus?.className.includes('session-hostbar-finish-no'), true);
});

test('D3: terug in de LOBBY (revanche) verdwijnt de hele hostsectie uit het menu', async () => {
  stubDom();
  const { root, bar } = await bouw();
  assert.equal(vind(root, 'session-hostbar-more').hidden, false);

  // `session-shell.mjs` leest `menuButton.hidden` om te bepalen of de sectie
  // in het voorkeurenmenu bestaat. Bleef die vlag staan, dan zag een host in
  // de lobby nog steeds zijn hostacties — precies wat de producteigenaar
  // aanwees ("óók in de lobby").
  bar.update({ isHost: true, availableActions: ['start', 'lock', 'kick', 'finish'], participants: SPELERS(), phase: 'LOBBY' });
  assert.equal(vind(root, 'session-hostbar-more').hidden, true);
  assert.equal(vind(root, 'session-hostbar-panel').hidden, true);
});

test('D3: zonder tCount valt de vraag terug op de zin zonder getal', async () => {
  stubDom();
  const { createHostBar } = await import(`./hostbar.mjs?${Math.random()}`);
  const root = document.createElement('div');
  const bar = createHostBar({ root, t, onAction: () => {} });
  bar.update({ isHost: true, availableActions: TIJDENS_SPEL, participants: SPELERS(), phase: 'ROUND_ACTIVE' });

  assert.equal(
    vind(vind(root, 'session-hostbar-settings'), 'session-hostbar-confirm-question').textContent,
    'hostbar.finishConfirm',
  );
});
