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
// ── DE VERVORMING (opdracht E, docs/openstaand/raad-het-land.md) ────────────
//
// `data/geo-countries.js` rekt elk land UIT tot het zijn eigen 100×100-vak in
// beide richtingen vult. Gemeten over alle 257 contouren: de verhouding
// breedte/hoogte ligt bij ELKE contour tussen 0,80 en 1,25, en 253 van de 257
// vullen beide assen. Chili is daar even vierkant als Frankrijk.
//
// DIT SCRIPT SCHAALDE HELEMAAL NIET — het nam de padstring letterlijk over. De
// vervorming zit dus in de brondata, en "één schaalfactor in plaats van twee"
// was hier niet te wijzigen: er was geen schaalstap. Erger nog, een verhouding
// die door onafhankelijk schalen per as verloren is gegaan, valt uit het
// resultaat niet terug te rekenen — er is één vergelijking en er zijn twee
// onbekenden.
//
// TENZIJ JE DE VERHOUDING ERGENS ANDERS VANDAAN HAALT. En die staat er:
// `data/shapes.js` bevat dezelfde landen WEL proportioneel, gegenereerd door
// `build-shapes.js` in de repo-root met één schaalfactor
// (`scale = (100 - 2*pad) / max(w, h)`), gecentreerd, en met een
// cos(breedtegraad)-correctie op de lengtegraad zodat landen niet oost-west
// uitrekken. Precies de projectie die `data/README.md` ook voor
// `geo-countries.js` voorschrijft maar die daar niet is toegepast.
//
// Dus: de VORM komt uit `geo-countries.js` (~110 punten per land), de
// VERHOUDING uit `data/shapes.js`. `ontrek()` hieronder drukt de ene as in tot
// de verhouding klopt en past het resultaat daarna opnieuw in het vak, met één
// schaalfactor en gecentreerd.
//
// Waarom niet gewoon `data/shapes.js` als geometrie gebruiken: dat is
// geprobeerd en gemeten. Die bron komt uit een laag-resolutie wereldkaart en
// heeft voor kleine landen bijna geen punten — Luxemburg 7, Nederland 14,
// Koeweit 9, tegen 197/119/155 in `geo-countries.js`. Nederland werd daarmee
// een vijfhoek. De verhouding klopte, de vorm niet meer, en dit is een spel
// waarin je het land aan zijn omtrek herkent.
//
// DE UITZONDERING. `data/shapes.js` dekt 175 landen, deze set er 225. Voor de
// resterende 51 kende `data/shapes.js` geen verhouding: `build-shapes.js`
// leest `build/world.geo.json` en dat bestand is nooit gecommit.
//
// Punt 1.14 ("de 51 uitgerekte landen"): voor 45 van die 51 bestaat wél een
// tweede bron — `microstate-aspects.data.mjs`, met volledige herkomst in zijn
// eigen kop (geoBoundaries.org, per land het GROOTSTE landdeel — niet de
// volledige soevereine spreiding, want elk van deze 51 staat hier als ÉÉN
// ring, en anders drukt bv. Mauritius' Rodrigues (560 km verderop) het
// hoofdeiland plat tot een streep). De resterende 6 (Åland, Hongkong, Jersey,
// Macau, Saint-Pierre-en-Miquelon, Sint Maarten) staan ook daar niet in en
// behouden hun uitgerekte vorm — dragen `stretched: true`, zodat het zichtbaar
// is in plaats van stilzwijgend. Ze staan met naam en al in de header van
// shapes.data.mjs. Het zijn allemaal microstaten en eilandgebieden
// (`hard`/`extreme` in de pool) — geen land dat je op zijn omtrek herkent.
//
// BENADERING, GEEN EXACTHEID. Waar de twee bronnen een ander eilandenpakket
// meenemen (Noorwegen met of zonder Spitsbergen) klopt de overgenomen
// verhouding niet tot op de komma: hij hoort bij het pakket van
// `data/shapes.js`, terwijl de vorm uit `geo-countries.js` komt. Dat is een
// veel kleinere fout dan de uitrekking die het verving. Exact wordt het pas
// als iemand `build/world.geo.json` terugzet en `build-shapes.js` de hele set
// opnieuw projecteert.
//
// TWEE UITVOERBESTANDEN, bewust gescheiden op gewicht (85 KB rauw aan paddata
// voor de proportionele set — tien keer de rest van de contentpool):
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
import { MICROSTATE_ASPECTS } from './microstate-aspects.data.mjs';

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

/** Evalueert een browser-global datafile (geen module) in een geïsoleerde context. */
async function loadBrowserGlobal(relPath, globalName) {
  const source = await readFile(path.join(REPO_ROOT, relPath), 'utf8');
  const context = vm.createContext(Object.create(null));
  return vm.runInContext(`${source};\n${globalName};`, context, { filename: relPath, timeout: 5000 });
}

/** De koppeltabel: naam, aliassen en de centroïde. `shape` is hier de uitgerekte terugval. */
const loadGeoCountries = () => loadBrowserGlobal('data/geo-countries.js', 'GEO_COUNTRIES');

/** De proportionele referentie, al gesleuteld op iso2 (zie de kop, "DE VERVORMING"). */
const loadProportionalShapes = () => loadBrowserGlobal('data/shapes.js', 'COUNTRY_SHAPES');

/** Marge binnen het vak, gelijk aan die van `build-shapes.js` in de repo-root. */
const PAD = 6;

/** Eén decimaal, net als de brondata — scheelt bijna de helft in bestandsgrootte. */
const round1 = (v) => Math.round(v * 10) / 10;

/** De omhullende van een padstring. */
function bbox(shape) {
  const getallen = (shape.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const xs = [];
  const ys = [];
  for (let i = 0; i + 1 < getallen.length; i += 2) {
    xs.push(getallen[i]);
    ys.push(getallen[i + 1]);
  }
  if (xs.length === 0) fail('pad zonder coördinaten');
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  return { x0, y0, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0 };
}

/**
 * Zet een pad om naar de juiste verhouding en plaatst het in het 100×100-vak.
 *
 * `doelVerhouding` is breedte/hoogte zoals die hoort te zijn; `null` betekent
 * "onbekend" en dan blijft de vorm zoals hij is (de uitgerekte uitzondering,
 * zie de kop). In beide gevallen wordt daarna met ÉÉN schaalfactor ingepast en
 * gecentreerd — het vak blijft vierkant, de inhoud vult nog maar één richting.
 *
 * @param {string} shape de `d`-waarde uit geo-countries.js
 * @param {number|null} doelVerhouding
 * @returns {string}
 */
function ontrek(shape, doelVerhouding) {
  const b = bbox(shape);
  const factor = doelVerhouding === null ? 1 : doelVerhouding / (b.w / b.h);
  const w = b.w * factor;
  const h = b.h;
  const schaal = (100 - 2 * PAD) / Math.max(w, h);
  const offX = (100 - w * schaal) / 2;
  const offY = (100 - h * schaal) / 2;

  // Alleen M/L/Z komen in deze brondata voor; een ander commando is een
  // wijziging in het bronformaat en hoort hard te falen, niet stil te
  // verdwijnen — dit script draait met de hand, niet in een spelronde.
  let uit = '';
  for (const stuk of shape.match(/[A-Za-z][^A-Za-z]*/g) ?? []) {
    const commando = stuk[0].toUpperCase();
    if (commando === 'Z') {
      uit += 'Z';
      continue;
    }
    if (commando !== 'M' && commando !== 'L') {
      fail(`onbekend padcommando "${stuk[0]}" — data/geo-countries.js gebruikt een ander formaat dan M/L/Z`);
    }
    const getallen = (stuk.slice(1).match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    for (let i = 0; i + 1 < getallen.length; i += 2) {
      const x = offX + (getallen[i] - b.x0) * factor * schaal;
      const y = offY + (getallen[i + 1] - b.y0) * schaal;
      uit += `${i === 0 ? commando : 'L'}${round1(x)} ${round1(y)}`;
    }
  }
  return uit;
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

/**
 * De omhullende van een pad binnen het 100×100-vak, plus de verhouding.
 *
 * WAT DIT NIET IS: de geografische (lat/lon) omhullende. Die vraagt het
 * bouwplan voor de wereldkaart van besluit 53, en die is uit deze repo niet af
 * te leiden — zie de kop. `data/shapes.js` bewaart alleen het geprojecteerde
 * resultaat, en uit `w/h` in vakeenheden volgt wel de VERHOUDING van de
 * geografische omhullende, maar niet zijn GROOTTE in graden. Wie de echte
 * extent wil, heeft `build/world.geo.json` nodig; dan levert `build-shapes.js`
 * hem in vier regels mee (`xMin`/`xMax`/`yMin`/`yMax` staan daar al berekend).
 *
 * Wat hier wél in gaat is het paar dat een kaart nodig heeft om een land te
 * plaatsen: de `center` uit de brondata (echte lat/lon) en het `box`-vak
 * hieronder (waar het land binnen zijn eigen vierkant staat).
 *
 * @param {string} shape
 * @returns {{ box: number[], aspect: number }}
 */
function measure(shape) {
  const b = bbox(shape);
  return {
    box: [round1(b.x0), round1(b.y0), round1(b.w), round1(b.h)],
    aspect: Math.round((b.w / (b.h || 1)) * 1000) / 1000,
  };
}

const geoCountries = await loadGeoCountries();
if (!Array.isArray(geoCountries) || geoCountries.length === 0) fail('GEO_COUNTRIES is leeg of geen array');

const proportionalShapes = await loadProportionalShapes();
if (proportionalShapes === null || typeof proportionalShapes !== 'object') fail('COUNTRY_SHAPES is leeg of geen object');

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
/** Landen zonder proportionele bron — zie "DE VERVORMING" in de kop. */
const stretchedNames = [];
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

  // De VORM komt uit geo-countries.js (het detail), de VERHOUDING uit
  // data/shapes.js — of, als die het land niet kent, uit
  // microstate-aspects.data.mjs (punt 1.14, zie de kop). Pas als geen van
  // beide iets weet blijft het land uitgerekt.
  const referentie = proportionalShapes[iso2];
  const microstateAspect = MICROSTATE_ASPECTS[iso2];
  const doelVerhouding =
    referentie !== undefined
      ? (() => { const b = bbox(extractPathData(referentie, geo.name)); return b.w / b.h; })()
      : typeof microstateAspect === 'number'
        ? microstateAspect
        : null;
  const stretched = doelVerhouding === null;
  const shape = ontrek(extractPathData(geo.shape, geo.name), doelVerhouding);
  if (stretched) stretchedNames.push(`${geo.name} (${iso2})`);

  const { box, aspect } = measure(shape);
  shapeEntries.push({
    iso2,
    shape,
    // Waar het land binnen zijn eigen 100×100-vak staat: [x, y, breedte, hoogte].
    box,
    // Breedte gedeeld door hoogte. Bij een proportionele contour is dit de
    // verhouding van de échte geografische omhullende; bij een uitgerekte
    // staat er ~1 en zegt hij niets. Vandaar `stretched` ernaast.
    aspect,
    // Echte lat/lon uit de brondata — het anker voor een wereldkaart
    // (besluit 53). Geen extent, alleen de plek; zie `measure()`.
    center: [geo.lon, geo.lat],
    ...(stretched ? { stretched: true } : {}),
  });
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
// PROPORTIONEEL, met twee bronnen (opdracht E + punt 1.14). De vorm komt uit
// data/geo-countries.js, de verhouding uit data/shapes.js of — als dat land
// daar niet in staat — uit microstate-aspects.data.mjs (geoBoundaries.org,
// zie die kop). Het geheel is met ÉÉN schaalfactor gecentreerd in het vak.
// Chili is daardoor een smalle streep en Rusland een brede band — het
// 100x100-vak blijft vierkant, alleen de inhoud vult nog maar één richting.
//
// UITGEREKT GEBLEVEN (${stretchedNames.length}) — voor deze landen kent geen van beide bronnen
// een verhouding (build/world.geo.json is nooit gecommit, en ze staan ook
// niet in microstate-aspects.data.mjs). Ze dragen \`stretched: true\`; hun
// \`aspect\` staat rond de 1 en zegt niets:
// ${stretchedNames.slice().sort().join('; ')}
//
// Per land:
//   iso2      landcode, zelfde conventie als de pool
//   shape     de "d"-waarde van een SVG <path>, viewBox "0 0 100 100"
//   box       [x, y, breedte, hoogte] — waar het land binnen dat vak staat
//   aspect    breedte / hoogte
//   center    [lon, lat] uit de brondata — de plek voor een wereldkaart
//             (besluit 53). GEEN extent: zie build-shapes.mjs, measure().
//   stretched alleen aanwezig als true (zie de lijst hierboven)
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
console.log(
  `build-shapes: ${shapeEntries.length - stretchedNames.length} op verhouding gezet ` +
    `(vorm uit geo-countries.js, verhouding uit data/shapes.js of microstate-aspects.data.mjs), ` +
    `${stretchedNames.length} nog uitgerekt — daarvoor kent geen van beide een verhouding.`,
);
