import { test } from 'node:test';
import assert from 'node:assert/strict';

import { identityWords } from './identity-word-lists.mjs';
// identity-render.js blijft in server/data/ (stap 2, server-only grammatica-
// module — de client krijgt in stap 5 zijn eigen ESM-poort ervan,
// client/flow/identity-render.mjs). Dit bestand toetst hier alleen dat de
// DATA (identityWords) samenwerkt met de bestaande servergrammatica.
import { renderIdentityNl, renderIdentityEs } from '../../server/data/identity-render.js';

test('elk woord heeft alle drie de talen, met geslacht waar dat moet', () => {
  for (const [key, entry] of Object.entries(identityWords)) {
    assert.equal(typeof entry.nl?.text, 'string', `${key}.nl.text ontbreekt`);
    assert.ok(entry.nl.text.length > 0, `${key}.nl.text is leeg`);
    assert.ok(['de', 'het'].includes(entry.nl.gender), `${key}.nl.gender moet 'de' of 'het' zijn`);

    assert.equal(typeof entry.en?.text, 'string', `${key}.en.text ontbreekt`);
    assert.ok(entry.en.text.length > 0, `${key}.en.text is leeg`);

    assert.equal(typeof entry.es?.text, 'string', `${key}.es.text ontbreekt`);
    assert.ok(entry.es.text.length > 0, `${key}.es.text is leeg`);
    assert.ok(['m', 'f'].includes(entry.es.gender), `${key}.es.gender moet 'm' of 'f' zijn`);
  }
});

// docs/openstaand/spelersidentiteit.md: "reken niet op Engels is invariant,
// Nederlands ook, alleen Spaans is lastig" — deze test bewijst dat de lijst
// écht beide NL-verbuigingspaden en beide ES-geslachten bevat, niet alleen
// de-woorden/mannelijk zoals de oudere name-word-lists.js bewust deed.
test('de lijst bevat zowel de- als het-woorden (nl), en zowel mannelijk als vrouwelijk (es)', () => {
  const nlGenders = new Set(Object.values(identityWords).map((w) => w.nl.gender));
  const esGenders = new Set(Object.values(identityWords).map((w) => w.es.gender));
  assert.ok(nlGenders.has('de') && nlGenders.has('het'), 'mist een de- of het-woord');
  assert.ok(esGenders.has('m') && esGenders.has('f'), 'mist een mannelijk of vrouwelijk woord');
});

test('elke sleutel is uniek en een niet-lege, lowercase Engelse identifier', () => {
  const keys = Object.keys(identityWords);
  assert.equal(new Set(keys).size, keys.length, 'dubbele sleutel');
  for (const key of keys) {
    assert.match(key, /^[a-z]+$/, `"${key}" is geen lowercase identifier`);
  }
});

// Integratie met identity-render.js (stap 2, af): geen los contract, echt
// samen bruikbaar — het-woord blijft onverbogen, vrouwelijk/mannelijk geeft
// de juiste ES-vorm.
test('werkt samen met identity-render.js: nl het-woord blijft onverbogen, es kiest het juiste geslacht', () => {
  const rabbit = identityWords.rabbit;
  const nl = renderIdentityNl({
    countryName: 'Bulgarije',
    adjective: { de: 'Bulgaarse', het: 'Bulgaars' },
    word: rabbit.nl,
  });
  assert.equal(nl, 'Bulgaars Konijn');

  const cow = identityWords.cow;
  const es = renderIdentityEs({
    countryName: 'Bulgaria',
    adjective: { m: 'búlgaro', f: 'búlgara' },
    word: cow.es,
  });
  assert.equal(es, 'vaca búlgara');
});
