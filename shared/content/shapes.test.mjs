// Tests voor de contourmigratie (docs/openstaand/raad-het-land.md, stap 1).
// Toetst het GEGENEREERDE resultaat (shapes.data.mjs/shapes-index.mjs) tegen
// de referentiecijfers uit het bouwplan — niet de generator zelf (build-
// shapes.mjs is een script, geen module om te importeren; zelfde aanpak als
// index.test.mjs voor build-content.mjs).

import test from 'node:test';
import assert from 'node:assert/strict';

import { SHAPE_ENTRIES, SHAPE_VIEWBOX } from './shapes.data.mjs';
import { SHAPE_ISO2S } from './shapes-index.mjs';
import { COUNTRY_ENTRIES } from './countries.data.mjs';

test('225 van de 230 pool-landen hebben een contour — de referentiecijfers uit het bouwplan', () => {
  assert.equal(SHAPE_ENTRIES.length, 225);
  assert.equal(COUNTRY_ENTRIES.length, 230);
});

test('de vijf landen zonder contour zijn precies de Franse overzeese gebieden uit het bouwplan', () => {
  const withShape = new Set(SHAPE_ENTRIES.map((e) => e.iso2));
  const withoutShape = COUNTRY_ENTRIES.filter((e) => !withShape.has(e.iso2)).map((e) => e.iso2).sort();
  assert.deepEqual(withoutShape, ['gf', 'gp', 'mq', 're', 'yt']);
  // Allemaal `extreme` — zie raad-het-land.md.
  for (const e of COUNTRY_ENTRIES) {
    if (!withShape.has(e.iso2)) {
      assert.equal(e.difficulty, 'extreme', `${e.iso2} zonder contour hoort 'extreme' te zijn`);
    }
  }
});

test('de vijf handmatige aliassen zijn daadwerkelijk gekoppeld', () => {
  const byIso2 = new Set(SHAPE_ENTRIES.map((e) => e.iso2));
  for (const iso2 of ['rs', 'tz', 'cg', 'hk', 'mo']) {
    assert.ok(byIso2.has(iso2), `"${iso2}" (handmatige alias) mist een contour`);
  }
});

// De twee lijsten zijn sinds 6 aug 2026 bewust NIET meer gelijk. shapes.data
// zegt wie er getekend kan worden; shapes-index zegt wie de VRAAG mag zijn.
// Een land waarvan we de echte verhouding niet kennen, staat vervormd in beeld
// — dat als vraag stellen is oneerlijk, want je kunt een vorm niet herkennen
// die niet klopt. Als afleider mag het wel: daar zie je alleen de naam.
test('shapes-index.mjs is de vraaglijst: alle tekenbare landen behalve de uitgerekte', () => {
  const tekenbaar = SHAPE_ENTRIES.map((e) => e.iso2).sort();
  const uitgerekt = SHAPE_ENTRIES.filter((e) => e.stretched === true).map((e) => e.iso2).sort();
  const magVraagZijn = [...SHAPE_ISO2S].sort();

  assert.deepEqual(
    magVraagZijn,
    tekenbaar.filter((iso2) => !uitgerekt.includes(iso2)),
    'de vraaglijst is de tekenlijst min de uitgerekte landen',
  );
  for (const iso2 of uitgerekt) {
    assert.ok(!magVraagZijn.includes(iso2), `${iso2} is uitgerekt en mag dus geen vraag zijn`);
  }
  for (const iso2 of SHAPE_ISO2S) {
    assert.equal(typeof iso2, 'string');
  }
});

test('iso2 is uniek, lowercase, en komt overeen met de pool-conventie', () => {
  const seen = new Set();
  for (const e of SHAPE_ENTRIES) {
    assert.match(e.iso2, /^[a-z]{2}$/, `iso2 "${e.iso2}" is geen 2 lowercase letters`);
    assert.ok(!seen.has(e.iso2), `dubbele iso2 "${e.iso2}"`);
    seen.add(e.iso2);
  }
});

// ─── De vervorming (opdracht E) ────────────────────────────────────────────

/** De omhullende van een pad, rechtstreeks uit de padstring — niet uit `box`. */
function meet(shape) {
  const t = (shape.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const xs = [];
  const ys = [];
  for (let i = 0; i + 1 < t.length; i += 2) {
    xs.push(t[i]);
    ys.push(t[i + 1]);
  }
  const w = Math.max(...xs) - Math.min(...xs);
  const h = Math.max(...ys) - Math.min(...ys);
  return { x: Math.min(...xs), y: Math.min(...ys), w, h, aspect: w / h };
}

const proportioneel = SHAPE_ENTRIES.filter((e) => e.stretched !== true);
const uitgerekt = SHAPE_ENTRIES.filter((e) => e.stretched === true);

test('landen zijn niet langer allemaal even vierkant', () => {
  // Vóór opdracht E lag de verhouding van ALLE 225 tussen 0,80 en 1,25 — elk
  // land was uitgerekt tot het zijn eigen vak vulde. Nu spreidt het.
  const verhoudingen = proportioneel.map((e) => meet(e.shape).aspect);
  assert.ok(Math.min(...verhoudingen) < 0.35, 'er hoort minstens één duidelijk smal land te zijn (Chili)');
  assert.ok(Math.max(...verhoudingen) > 2, 'er hoort minstens één duidelijk breed land te zijn (Rusland)');

  const bijnaVierkant = verhoudingen.filter((r) => r > 0.8 && r < 1.25).length;
  assert.ok(
    bijnaVierkant < proportioneel.length * 0.5,
    `${bijnaVierkant} van ${proportioneel.length} is nog bijna vierkant — dat riekt naar de oude uitrekking`,
  );
});

test('de vijf landen uit het bouwplan hebben hun echte verhouding terug', () => {
  // Marges ruim genomen: dit bewaakt de ORDE van grootte, niet het cijfer.
  // De waarden liggen wat hoger dan de "in werkelijkheid"-kolom van het
  // bouwplan, omdat dit de omhullende is inclusief de brede noordkant én met
  // de cos(breedtegraad)-correctie erin — niet de kaal geschatte lengte/breedte.
  const verwacht = { cl: [0.1, 0.3], ru: [1.8, 2.5], lu: [0.4, 0.7], no: [0.3, 0.6], fr: [0.85, 1.15] };
  for (const [iso2, [min, max]] of Object.entries(verwacht)) {
    const entry = SHAPE_ENTRIES.find((e) => e.iso2 === iso2);
    assert.ok(entry !== undefined, `${iso2} ontbreekt`);
    assert.equal(entry.stretched, undefined, `${iso2} hoort een proportionele contour te hebben`);
    const r = meet(entry.shape).aspect;
    assert.ok(r >= min && r <= max, `${iso2}: verhouding ${r.toFixed(3)} valt buiten [${min}, ${max}]`);
  }
});

// ─── Punt 1.14 ("de 51 uitgerekte landen"): geoBoundaries.org als tweede bron ──

test('45 van de 51 microstaten hebben nu ook een echte verhouding, via microstate-aspects.data.mjs', () => {
  // Steekproef, niet uitputtend — de volledige lijst staat in de header van
  // shapes.data.mjs. Marges ruim: dit bewaakt de orde van grootte (smal/breed/
  // vierkant), niet het exacte cijfer.
  const verwacht = {
    va: [1.1, 1.5], // Vaticaanstad — bijna vierkant, was het al
    mv: [0.3, 0.6], // Maldiven — smal lint van atollen
    sg: [1.4, 2.0], // Singapore — breder dan hoog
    to: [1.2, 1.7], // Tonga
    ag: [1.0, 1.5], // Antigua en Barbuda
    mu: [0.7, 1.0], // Mauritius — hoofdeiland, niet de volle spreiding met Rodrigues
  };
  for (const [iso2, [min, max]] of Object.entries(verwacht)) {
    const entry = SHAPE_ENTRIES.find((e) => e.iso2 === iso2);
    assert.ok(entry !== undefined, `${iso2} ontbreekt`);
    assert.equal(entry.stretched, undefined, `${iso2} hoort niet meer uitgerekt te zijn`);
    const r = meet(entry.shape).aspect;
    assert.ok(r >= min && r <= max, `${iso2}: verhouding ${r.toFixed(3)} valt buiten [${min}, ${max}]`);
  }
});

test('de resterende 6 uitgerekte landen zijn precies de landen die ook geoBoundaries.org niet kent', () => {
  const namen = uitgerekt.map((e) => e.iso2).sort();
  // Åland, Hongkong, Jersey, Macau, Saint-Pierre-en-Miquelon, Sint Maarten —
  // staan niet in data/shapes.js én niet in microstate-aspects.data.mjs.
  assert.deepEqual(namen, ['ax', 'hk', 'je', 'mo', 'pm', 'sx']);
});

test('elk land vult precies één richting van het vak en staat gecentreerd', () => {
  for (const entry of proportioneel) {
    const m = meet(entry.shape);
    const langste = Math.max(m.w, m.h);
    assert.ok(langste > 80, `${entry.iso2} vult geen enkele richting (langste zijde ${langste.toFixed(1)})`);
    assert.ok(langste <= 100, `${entry.iso2} loopt buiten het vak (${langste.toFixed(1)})`);
    // Gecentreerd: evenveel ruimte links als rechts, boven als onder.
    const marge = 1.5; // afronding op één decimaal in de brondata
    assert.ok(Math.abs(m.x - (100 - m.x - m.w)) < marge, `${entry.iso2} staat niet horizontaal gecentreerd`);
    assert.ok(Math.abs(m.y - (100 - m.y - m.h)) < marge, `${entry.iso2} staat niet verticaal gecentreerd`);
  }
});

test('box en aspect beschrijven het pad dat er staat', () => {
  for (const entry of SHAPE_ENTRIES) {
    const m = meet(entry.shape);
    const [x, y, w, h] = entry.box;
    assert.ok(Math.abs(x - m.x) < 0.11, `${entry.iso2}: box.x wijkt af`);
    assert.ok(Math.abs(y - m.y) < 0.11, `${entry.iso2}: box.y wijkt af`);
    assert.ok(Math.abs(w - m.w) < 0.11, `${entry.iso2}: box.breedte wijkt af`);
    assert.ok(Math.abs(h - m.h) < 0.11, `${entry.iso2}: box.hoogte wijkt af`);
    assert.ok(Math.abs(entry.aspect - m.aspect) < 0.01, `${entry.iso2}: aspect wijkt af`);
  }
});

test('center is een echte lat/lon uit de brondata — het anker voor de wereldkaart', () => {
  for (const entry of SHAPE_ENTRIES) {
    assert.ok(Array.isArray(entry.center) && entry.center.length === 2, `${entry.iso2} mist center`);
    const [lon, lat] = entry.center;
    assert.ok(Number.isFinite(lon) && lon >= -180 && lon <= 180, `${entry.iso2}: lon ${lon} is geen lengtegraad`);
    assert.ok(Number.isFinite(lat) && lat >= -90 && lat <= 90, `${entry.iso2}: lat ${lat} is geen breedtegraad`);
  }
  // Steekproef: de centroïde hoort in het juiste werelddeel te liggen.
  const nl = SHAPE_ENTRIES.find((e) => e.iso2 === 'nl');
  assert.ok(nl.center[0] > 3 && nl.center[0] < 8, 'Nederland ligt niet op zijn lengtegraad');
  assert.ok(nl.center[1] > 50 && nl.center[1] < 54, 'Nederland ligt niet op zijn breedtegraad');
});

test('de uitgerekte rest draagt een vlag en is de bekende uitzonderingslijst', () => {
  // Voor deze landen bestaat in deze repo geen proportionele bron
  // (build/world.geo.json is nooit gecommit). Ze mogen bestaan, maar niet
  // stilzwijgend: `stretched: true` maakt ze vindbaar, hier én in de header
  // van shapes.data.mjs.
  assert.ok(uitgerekt.length > 0 && uitgerekt.length < 60, `onverwacht aantal uitgerekte landen: ${uitgerekt.length}`);
  for (const entry of uitgerekt) {
    const r = meet(entry.shape).aspect;
    assert.ok(r > 0.7 && r < 1.4, `${entry.iso2} draagt stretched maar is niet bijna vierkant (${r.toFixed(2)})`);
  }
  // Geen enkel `easy`-land mag erbij zitten: dat zijn de landen die een speler
  // op hun omtrek hoort te herkennen.
  const easy = new Set(COUNTRY_ENTRIES.filter((e) => e.difficulty === 'easy').map((e) => e.iso2));
  const easyUitgerekt = uitgerekt.filter((e) => easy.has(e.iso2)).map((e) => e.iso2);
  assert.deepEqual(easyUitgerekt, [], 'een easy-land met een uitgerekte contour is niet te herkennen');
});

test('elke shape is een niet-lege SVG-padstring binnen de gedeclareerde viewBox, geen markup-restjes', () => {
  assert.equal(SHAPE_VIEWBOX, '0 0 100 100');
  for (const { iso2, shape } of SHAPE_ENTRIES) {
    assert.equal(typeof shape, 'string');
    assert.ok(shape.length > 0, `"${iso2}" heeft een lege shape`);
    assert.ok(!shape.includes('<') && !shape.includes('"'), `shape van "${iso2}" bevat nog markup i.p.v. alleen de d-waarde`);
    assert.match(shape, /^M/, `shape van "${iso2}" begint niet met een SVG "moveto"`);
    const numbers = [...shape.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
    assert.ok(numbers.length > 0, `"${iso2}" heeft geen coördinaten`);
    for (const n of numbers) {
      assert.ok(n >= 0 && n <= 100, `"${iso2}" heeft een coördinaat (${n}) buiten de viewBox 0..100`);
    }
  }
});
