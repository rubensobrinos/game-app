import { test } from 'node:test';
import assert from 'node:assert/strict';

import { nl } from '../locales/nl.mjs';

/**
 * De module raakt de DOM aan, dus draait hij hier tegen een minimale dubbel —
 * dezelfde aanpak als `button-loading.test.mjs`. Wat getoetst wordt is de
 * logica: welke tekst, welk symbool, welk toegankelijk label bij welke delta.
 */
function stubDom() {
  globalThis.HTMLElement ??= class HTMLElement {};
  const maak = () => {
    const el = {
      className: '',
      textContent: '',
      title: '',
      hidden: false,
      _attrs: new Map(),
      _klassen: new Set(),
      children: [],
      classList: {
        add: (...c) => c.forEach((x) => el._klassen.add(x)),
        remove: (...c) => c.forEach((x) => el._klassen.delete(x)),
        toggle: (c, aan) => (aan ? el._klassen.add(c) : el._klassen.delete(c)),
        contains: (c) => el._klassen.has(c),
      },
      setAttribute: (k, v) => el._attrs.set(k, v),
      removeAttribute: (k) => el._attrs.delete(k),
      append: (...kids) => el.children.push(...kids),
      appendChild: (kid) => el.children.push(kid),
    };
    Object.setPrototypeOf(el, HTMLElement.prototype);
    return el;
  };
  globalThis.document = { createElement: maak };
  return maak();
}

const t = (k) => nl[k] ?? k;
const tCount = (k, n) => (nl[`${k}.${n === 1 ? 'one' : 'other'}`] ?? k).replace('{n}', String(n));

async function bouw() {
  const root = stubDom();
  const { createLeaderboardRow } = await import('./leaderboard-row.mjs?t=' + Math.random());
  const rij = createLeaderboardRow({ root, t, tCount });
  const cel = (klasse) => rij.element.children.find((c) => c.className === klasse);
  return { rij, cel };
}

test('een stijger toont pijl, getal én een voorleesbare zin', async () => {
  const { rij, cel } = await bouw();
  rij.update({ rank: 3, name: 'Sanne', score: 610, delta: 2 });

  const move = cel('leaderboard-move');
  assert.equal(move.textContent, '↑2');
  assert.equal(move._attrs.get('aria-label'), '2 plaatsen gestegen');
  assert.ok(move.classList.contains('is-up'));
});

test('één plaats krijgt enkelvoud, niet "1 plaatsen"', async () => {
  const { rij, cel } = await bouw();
  rij.update({ rank: 2, name: 'Tom', score: 500, delta: 1 });
  assert.equal(cel('leaderboard-move')._attrs.get('aria-label'), '1 plaats gestegen');
});

test('een daler krijgt de andere richting, met een positief getal', async () => {
  const { rij, cel } = await bouw();
  rij.update({ rank: 8, name: 'Tom', score: 120, delta: -3 });

  const move = cel('leaderboard-move');
  assert.equal(move.textContent, '↓3', 'geen minteken naast een pijl omlaag');
  assert.equal(move._attrs.get('aria-label'), '3 plaatsen gedaald');
  assert.ok(move.classList.contains('is-down'));
});

test('gelijk blijven toont een streepje, geen lege cel', async () => {
  const { rij, cel } = await bouw();
  rij.update({ rank: 4, name: 'Emma', score: 300, delta: 0 });

  const move = cel('leaderboard-move');
  assert.equal(move.textContent, '—', 'een lege cel leest als ontbrekende data');
  assert.equal(move._attrs.get('aria-label'), 'Geen verandering');
});

test('een ontbrekende delta gedraagt zich als gelijk, niet als fout', async () => {
  for (const delta of [null, undefined, Number.NaN]) {
    const { rij, cel } = await bouw();
    rij.update({ rank: 1, name: 'Lisa', score: 900, delta });
    assert.equal(cel('leaderboard-move').textContent, '—');
  }
});

test('de eigen rij krijgt een label, andere rijen niet', async () => {
  const { rij, cel } = await bouw();
  rij.update({ rank: 12, name: 'Ruben', score: 610, delta: 0, isSelf: true });
  assert.equal(cel('leaderboard-self-tag').hidden, false);
  assert.equal(cel('leaderboard-self-tag').textContent, 'Jij');
  assert.ok(rij.element.classList.contains('is-self'));

  rij.update({ rank: 3, name: 'Sanne', score: 700, delta: 0, isSelf: false });
  assert.equal(cel('leaderboard-self-tag').hidden, true);
  assert.equal(rij.element.classList.contains('is-self'), false);
});

test('de rank staat er expliciet, want de reeks is discontinu', async () => {
  const { rij, cel } = await bouw();
  rij.update({ rank: 12, name: 'Ruben', score: 610 });
  assert.equal(cel('leaderboard-rank').textContent, '#12');
});

test('een gedeelde plaats is aan te geven zodra het model dat meegeeft', async () => {
  const { rij, cel } = await bouw();
  rij.update({ rank: 1, name: 'Lisa', score: 900, gedeeld: true });
  assert.equal(cel('leaderboard-rank').title, 'Gedeelde plaats');
  assert.ok(rij.element.classList.contains('is-shared'));
});
