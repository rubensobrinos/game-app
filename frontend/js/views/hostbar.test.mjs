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
      focus() {},
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
const SPELERS = () => new Map([['p1', 'Ties'], ['p2', 'Noor']]);
/** De acties die `host-controls-state.mjs` tijdens een lopende ronde geeft. */
const TIJDENS_SPEL = ['pause', 'lock', 'kick', 'finish'];

async function bouw(opties = {}) {
  const { createHostBar } = await import(`./hostbar.mjs?${Math.random()}`);
  const root = document.createElement('div');
  const acties = [];
  const bar = createHostBar({ root, t, onAction: (a, p) => acties.push([a, p ?? null]) });
  bar.update({
    isHost: true,
    availableActions: TIJDENS_SPEL,
    participants: SPELERS(),
    phase: 'ROUND_ACTIVE',
    ...opties,
  });
  return { root, bar, acties };
}

// ── Punt 52 ────────────────────────────────────────────────────────────────

test('punt 52: de ⋯ van een spelerrij verdwijnt zodra Verwijder verschijnt', async () => {
  stubDom();
  const { root } = await bouw();

  const rijMenu = vind(root, 'session-hostbar-player-menu');
  const kick = vind(root, 'session-hostbar-kick');
  assert.equal(rijMenu.hidden, false, 'dicht: alleen de ⋯');
  assert.equal(kick.hidden, true);

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
  klik(rijMenu);
  klik(kick);

  assert.deepEqual(acties, [], 'annuleren verwijdert niemand');
  // Zonder deze weg terug houdt een per ongeluk geopende rij alléén nog een
  // destructieve knop over, en geen enkele uitweg.
  assert.equal(rijMenu.hidden, false);
  assert.equal(kick.hidden, true);
});

test('punt 52: bevestigen verwijdert de speler uit die rij', async () => {
  stubDom({ confirmAntwoord: true });
  const { root, acties } = await bouw();
  klik(vind(root, 'session-hostbar-player-menu'));
  klik(vind(root, 'session-hostbar-kick'));
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
  klik(rijMenu);
  assert.equal(rijMenu.hidden, true);

  klik(meer); // dichtklappen
  // Heropenen hoort dezelfde stand te tonen als de eerste keer — anders ziet
  // het menu er per keer anders uit zonder dat er iets veranderd is.
  assert.equal(rijMenu.hidden, false);
  assert.equal(vind(root, 'session-hostbar-kick').hidden, true);
});

test('punt 53: verdwijnt de laatste paneelinhoud, dan gaat het paneel ook dicht', async () => {
  stubDom();
  const { root, bar } = await bouw();
  klik(vind(root, 'session-hostbar-more'));
  assert.equal(vind(root, 'session-hostbar-panel').hidden, false);

  // Geen finish, geen kick → niets meer om te tonen.
  bar.update({ isHost: true, availableActions: ['pause', 'lock'], participants: new Map(), phase: 'ROUND_ACTIVE' });
  assert.equal(vind(root, 'session-hostbar-more').hidden, true);
  assert.equal(vind(root, 'session-hostbar-panel').hidden, true);
});

// ── Bevinding, bewust NIET gerepareerd (menu-inhoud is pakket D) ───────────

test('bevinding 53c: lock/unlock en rematch zijn hostacties zonder enige knop', async () => {
  stubDom();
  const { availableHostActions } = await import('../../../client/flow/host-controls-state.mjs');
  const { root } = await bouw({
    availableActions: availableHostActions({ phase: 'FINISHED', pacing: 'auto', playerCount: 2, locked: false }),
    phase: 'FINISHED',
  });

  // Vastgelegd zodat de volgende die hier komt ziet dat dit bekend is en van
  // wie het is: de hostbalk toont ze niet, en `nl.mjs` heeft er wél teksten
  // voor (`hostbar.lock`, `hostbar.unlock`). Pakket D bouwt de knoppen.
  assert.equal(vind(root, 'session-hostbar-lock'), null);
  assert.equal(vind(root, 'session-hostbar-rematch'), null);
});
