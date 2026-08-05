// shared/content/build-shapes.mjs — migratiestap 1 van
// docs/openstaand/raad-het-land.md ("Raad het land", de vierde game).
//
// Leest de bestaande browser-global `data/geo-countries.js` (257 contouren,
// gesleuteld op Engelse naam) in een geïsoleerde vm-context — zelfde techniek
// als build-content.mjs's `loadBrowserGlobal` — en koppelt elke contour aan
// een iso2 uit de pool (`countries.data.mjs`, 230 landen, gesleuteld op iso2).
//
// Genormaliseerd matchen op de Engelse naam plus de Engelse aliassen uit de
// pool (NFD-normalisatie strippt diacritieken: "São Tomé" == "Sao Tome").
// Vijf namen matchen daarna nog steeds niet automatisch — allemaal een
// formele staatsnaam of S.A.R.-notatie die de pool niet als alias kent; zie
// MANUAL_ALIASES hieronder. Met die vijf: 225 van 230 landen gekoppeld.
//
// Wat overblijft mist TERECHT (zie docs/openstaand/raad-het-land.md):
//  - 5 pool-landen zonder contour: Réunion, Mayotte, Martinique, Guadeloupe,
//    Frans-Guyana — Franse overzeese gebieden zonder eigen contour in de
//    brondata, allemaal `extreme` in de pool.
//  - 37 contouren zonder pool-tegenhanger: gebiedsdelen en betwiste gebieden
//    (Bir Tawil, Spratly Islands, Siachen Glacier, ...). Horen niet in een
//    quiz. Vallen niet stilzwijgend af — de volledige lijst staat in de
//    header van shapes.data.mjs hieronder, zodat de keuze zichtbaar blijft.
//
// TWEE UITVOERBESTANDEN, bewust gescheiden op gewicht (229 KB rauw / 80 KB
// gzip aan paddata — tien keer de rest van de contentpool):
//  - shapes.data.mjs   — ZWAAR: iso2 -> SVG-pad. Alleen de client laadt dit,
//    en pas als de game gekozen is (dynamische import, stap 4). Staat NIET
//    in index.mjs — dat bestand laadt de server ook.
//  - shapes-index.mjs  — LICHT: alleen de 225 iso2-codes, geen paddata. Dít
//    is wat de servers vraagselectie nodig heeft (welk land heeft een
//    contour), zonder de padstrings in het servergeheugen te trekken — een
//    los .mjs-bestand is de enige manier om dat in Node af te dwingen: een
//    module wordt bij import altijd volledig geëvalueerd, welke named export
//    je ook gebruikt.
//
// Draaien (vanuit de repo-root):
//   node shared/content/build-shapes.mjs
//
// Wijzigt data/geo-countries.js of de pool, draai dan dit script opnieuw.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

import { COUNTRY_ENTRIES } from './countries.data.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const SHAPES_OUT = path.join(HERE, 'shapes.data.mjs');
const INDEX_OUT = path.join(HERE, 'shapes-index.mjs');

/** De vijf namen die niet automatisch matchen — zie de kop hierboven. */
const MANUAL_ALIASES = Object.freeze({
  'republic of serbia': 'rs',
  'united republic of tanzania': 'tz',
  'republic of the congo': 'cg',
  'hong kong s.a.r.': 'hk',
  'macao s.a.r': 'mo',
});

/** Evalueert data/geo-countries.js (browser-global, geen module) in een geïsoleerde context. */
async function loadGeoCountries() {
  const relPath = 'data/geo-countries.js';
  const source = await readFile(path.join(REPO_ROOT, relPath), 'utf8');
  const context = vm.createContext(Object.create(null));
  return vm.runInContext(`${source};\nGEO_COUNTRIES;`, context, { filename: relPath, timeout: 5000 });
}

/** Diakritieken strippen + lowercase + trim — "São Tomé" -> "sao tome". */
function normalize(value) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function fail(message) {
  throw new Error(`build-shapes: ${message}`);
}

/** @param {string} shapeMarkup het opgeslagen `<path d="...">`-fragment @returns {string} alleen de `d`-waarde */
function extractPathData(shapeMarkup, geoName) {
  const match = /<path d="([^"]+)"/.exec(shapeMarkup);
  if (match === null) fail(`"${geoName}": shape-veld bevat geen <path d="...">`);
  return match[1];
}

const geoCountries = await loadGeoCountries();
if (!Array.isArray(geoCountries) || geoCountries.length === 0) fail('GEO_COUNTRIES is leeg of geen array');

// Naam -> iso2, opgebouwd uit de pool (Engelse naam + Engelse aliassen).
const poolNameMap = new Map();
for (const entry of COUNTRY_ENTRIES) {
  poolNameMap.set(normalize(entry.name.en), entry.iso2);
  for (const alias of entry.aliases.en) {
    poolNameMap.set(normalize(alias), entry.iso2);
  }
}

const seenIso2 = new Set();
const shapeEntries = [];
const droppedContours = [];
let manualAliasesApplied = 0;

for (const geo of geoCountries) {
  const key = normalize(geo.name);
  let iso2 = poolNameMap.get(key);
  if (iso2 === undefined && key in MANUAL_ALIASES) {
    iso2 = MANUAL_ALIASES[key];
    manualAliasesApplied += 1;
  }
  if (iso2 === undefined) {
    droppedContours.push(geo.name);
    continue;
  }
  if (seenIso2.has(iso2)) {
    fail(`iso2 "${iso2}" matcht meer dan één contour (laatste: "${geo.name}")`);
  }
  seenIso2.add(iso2);
  shapeEntries.push({ iso2, shape: extractPathData(geo.shape, geo.name) });
}

if (manualAliasesApplied !== Object.keys(MANUAL_ALIASES).length) {
  fail(
    `${Object.keys(MANUAL_ALIASES).length} handmatige aliassen gedefinieerd, ` +
      `maar er zijn er maar ${manualAliasesApplied} toegepast — een naam in geo-countries.js is veranderd.`,
  );
}

shapeEntries.sort((a, b) => a.iso2.localeCompare(b.iso2));
const shapeIso2Set = new Set(shapeEntries.map((e) => e.iso2));
const missingFromPool = COUNTRY_ENTRIES.filter((e) => !shapeIso2Set.has(e.iso2)).map((e) => `${e.name.en} (${e.iso2})`);

const sharedHeader = `// GEGENEREERD BESTAND — niet met de hand bewerken.
// Bron: data/geo-countries.js + shared/content/countries.data.mjs
// Genereer opnieuw met: node shared/content/build-shapes.mjs
// docs/openstaand/raad-het-land.md, migratiestap 1.
// Stand bij generatie: ${shapeEntries.length} van ${COUNTRY_ENTRIES.length} pool-landen gekoppeld aan een contour
//   (${manualAliasesApplied} via een handmatige alias, zie MANUAL_ALIASES in build-shapes.mjs).
// Pool-landen ZONDER contour (${missingFromPool.length}): ${missingFromPool.join('; ')}
`;

const shapesBody = `${sharedHeader}//
// Contouren zonder tegenhanger in de pool (${droppedContours.length}) — gebiedsdelen en
// betwiste gebieden, horen niet in een quiz, vallen bewust af:
// ${droppedContours.slice().sort().join('; ')}
//
// Elke path-string is de "d"-waarde van een SVG <path>, viewBox "0 0 100 100".
export const SHAPE_VIEWBOX = '0 0 100 100';
export const SHAPE_ENTRIES = ${JSON.stringify(shapeEntries, null, 1)};
`;

const indexBody = `${sharedHeader}//
// Alleen de iso2-codes — GEEN paddata. Dit is wat de server nodig heeft om te
// weten welk land een contour heeft (server/rules/question-selection.js'
// \`hasShape\`-parameter voor gameType 'country_shape_mc'); de padstrings
// zelf horen bij shapes.data.mjs, dat alleen de client dynamisch laadt.
export const SHAPE_ISO2S = Object.freeze(${JSON.stringify(shapeEntries.map((e) => e.iso2))});
`;

await writeFile(SHAPES_OUT, shapesBody, 'utf8');
await writeFile(INDEX_OUT, indexBody, 'utf8');

console.log(
  `build-shapes: ${shapeEntries.length}/${COUNTRY_ENTRIES.length} landen gekoppeld ` +
    `(${manualAliasesApplied} via handmatige alias), ${droppedContours.length} contouren afgevallen ` +
    `-> ${path.relative(REPO_ROOT, SHAPES_OUT)}, ${path.relative(REPO_ROOT, INDEX_OUT)}`,
);
