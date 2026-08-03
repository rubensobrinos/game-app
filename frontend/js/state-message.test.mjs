import { test } from 'node:test';
import assert from 'node:assert/strict';

function stubDom() {
  globalThis.HTMLElement ??= class HTMLElement {};
  const maak = () => {
    const el = {
      className: '',
      textContent: '',
      type: '',
      _attrs: new Map(),
      _listeners: new Map(),
      children: [],
      setAttribute: (k, v) => el._attrs.set(k, v),
      getAttribute: (k) => el._attrs.get(k) ?? null,
      addEventListener: (soort, fn) => el._listeners.set(soort, fn),
      append: (...k) => el.children.push(...k),
      appendChild: (k) => (el.children.push(k), k),
      remove: () => { el._verwijderd = true; },
      klik: () => el._listeners.get('click')?.(),
    };
    Object.setPrototypeOf(el, HTMLElement.prototype);
    return el;
  };
  globalThis.document = { createElement: maak };
  return maak();
}

async function laad() {
  return import('./state-message.mjs?t=' + Math.random());
}

const kind = (el, klasse) => el.children.find((c) => c.className.includes(klasse));

test('lege staat toont kop, uitleg en actie', async () => {
  const root = stubDom();
  const { createEmptyState } = await laad();
  let geklikt = 0;
  const s = createEmptyState({
    root,
    title: 'Nog niemand binnen',
    hint: 'Laat iemand de QR scannen om te beginnen.',
    action: { label: 'Uitnodigen', onClick: () => geklikt++ },
  });

  assert.equal(kind(s.element, 'state-title').textContent, 'Nog niemand binnen');
  assert.equal(kind(s.element, 'state-hint').textContent, 'Laat iemand de QR scannen om te beginnen.');
  kind(s.element, 'state-action').klik();
  assert.equal(geklikt, 1);
});

test('lege staat zonder uitleg of actie rendert alleen de kop', async () => {
  const root = stubDom();
  const { createEmptyState } = await laad();
  const s = createEmptyState({ root, title: 'Niets gevonden' });

  assert.equal(s.element.children.length, 1);
  assert.equal(kind(s.element, 'state-hint'), undefined);
});

test('een fout wordt altijd aangekondigd, ook zonder dat de aanroeper iets doet', async () => {
  const root = stubDom();
  const { createErrorState } = await laad();
  const s = createErrorState({ root, message: 'Deze game bestaat niet (meer).' });

  assert.equal(s.element.getAttribute('role'), 'alert');
});

test('inline is compact en heeft geen kop, ook niet als je er een meegeeft', async () => {
  const root = stubDom();
  const { createErrorState } = await laad();
  const s = createErrorState({ root, title: 'Oeps', message: 'Mislukt', variant: 'inline' });

  assert.ok(s.element.className.includes('is-inline'));
  assert.equal(kind(s.element, 'state-title'), undefined, 'inline draagt geen kop');
});

test('paginabreed toont wél een kop', async () => {
  const root = stubDom();
  const { createErrorState } = await laad();
  const s = createErrorState({
    root, title: 'Deze game is afgelopen', message: 'De host heeft het potje beëindigd.', variant: 'page',
  });

  assert.ok(s.element.className.includes('is-page'));
  assert.equal(kind(s.element, 'state-title').textContent, 'Deze game is afgelopen');
});

test('de herstelactie zit in de component, niet bij de aanroeper', async () => {
  const root = stubDom();
  const { createErrorState } = await laad();
  let terug = 0;
  const s = createErrorState({
    root, message: 'Je sessie is verlopen.', variant: 'page',
    action: { label: 'Terug naar start', onClick: () => terug++ },
  });

  const knop = kind(s.element, 'state-action');
  assert.ok(knop.className.includes('btn-primary'), 'op een paginafout is dit de hoofdactie');
  knop.klik();
  assert.equal(terug, 1);
});

test('een inline-actie is secundair, geen hoofdactie', async () => {
  const root = stubDom();
  const { createErrorState } = await laad();
  const s = createErrorState({
    root, message: 'Kopiëren lukte niet', action: { label: 'Opnieuw', onClick() {} },
  });
  assert.ok(kind(s.element, 'state-action').className.includes('btn-secondary'));
});

test('de tekst is bij te werken zonder de component opnieuw te bouwen', async () => {
  const root = stubDom();
  const { createErrorState } = await laad();
  const s = createErrorState({ root, message: 'Verbinding verbroken…' });
  s.setMessage('Opnieuw verbinden…');
  assert.equal(kind(s.element, 'state-message').textContent, 'Opnieuw verbinden…');
});

test('geen tekst wordt hardgecodeerd — alles komt van de aanroeper', async () => {
  const bron = await import('node:fs').then((fs) =>
    fs.readFileSync(new URL('./state-message.mjs', import.meta.url), 'utf8'),
  );
  const codeRegels = bron
    .split('\n')
    .filter((r) => !r.trim().startsWith('*') && !r.trim().startsWith('//') && !r.trim().startsWith('/*'));
  // Enige toegestane letterlijke strings zijn klassenamen en attribuutwaarden.
  const verdacht = codeRegels.filter((r) => /'[A-Z][a-z]{3,}/.test(r));
  assert.deepEqual(verdacht, [], 'gevonden tekst die naar de locales hoort');
});
