// shared/content/flag-spec.mjs — CT2: seed-deterministische nepvlag-specificatie
// voor `real_or_fake_flag` (Golf 1).
//
// Contract (docs/game-rules-plan/prompts/GR4-question-selection.md,
// ontwerpbeslissing 2): `generateFlagSpec(seed: string) => { pattern, palette,
// rendererVersion }`. GR4 destructureert `rendererVersion` eruit en stuurt de
// rest als `spec` in `publicQuestionPayload` (PROTOCOL.md, voorbeeld
// `round:started`). Alle clients renderen dezelfde spec — de server rekent,
// de client tekent (ARCHITECTURE.md, principe 7).
//
// Determinisme: zelfde seed ⇒ byte-voor-byte dezelfde spec, op elke machine,
// in elke Node- of browserversie. Daarom een eigen PRNG (xmur3 + mulberry32)
// en NOOIT Math.random(), en een vocabulaire dat volledig in dit bestand is
// vastgepind.
//
// Het vocabulaire (patterns + paletten) is overgenomen uit de bestaande
// singleplayer-canvasrenderer (`generateFakeFlag` in app.js), zodat de
// multiplayer-client die renderer kan hergebruiken onder de naam
// `flag-renderer-1`. LET OP: wijzig je het vocabulaire of het renderergedrag,
// verhoog dan FLAG_RENDERER_VERSION — een lopende match pint die versie.
//
// ECHTE-VLAG-WERING — de verbetering t.o.v. de singleplayer-generator: een
// willekeurige combinatie kan per ongeluk een bestáánde vlag opleveren
// (verticaal blauw-wit-rood ís Frankrijk). In singleplayer is dat een
// schoonheidsfout; in multiplayer dwingt het een fout antwoord af ("nep" dat
// echt is). Daarom wordt elke kandidaat genormaliseerd naar kleurklassen en
// getoetst aan een denylijst van bekende eenvoudige vlaggen; bij een botsing
// wordt deterministisch geperturbeerd (palette roteren, daarna patroon
// wisselen). De toets is bewust op kleurKLASSE, niet op exacte hex — visueel
// identiek is het criterium, niet byte-gelijk.

/** Verhogen bij elke wijziging aan vocabulaire of renderergedrag. */
export const FLAG_RENDERER_VERSION = 'flag-renderer-1';

/** Patterns die de bestaande canvasrenderer (app.js) al ondersteunt. */
export const FLAG_PATTERNS = Object.freeze([
  'hstripes', 'vstripes', 'hstripes-star', 'vstripes-star', 'cross', 'nordic',
  'left-block', 'diagonal', 'chevron', 'saltire', 'quartered', 'sunburst',
]);

/** Realistische landskleur-paletten (subset uit de singleplayer, ontdubbeld). */
export const FLAG_PALETTES = Object.freeze([
  ['#CE1126', '#FFFFFF', '#003087'],
  ['#CE1126', '#FFFFFF', '#00209F'],
  ['#009A44', '#FFD100', '#CE1126'],
  ['#000000', '#DD0000', '#FFCE00'],
  ['#FF8000', '#FFFFFF', '#0032A0'],
  ['#006847', '#FFFFFF', '#CE1126'],
  ['#003399', '#FFFFFF', '#CC0000'],
  ['#002395', '#FFFFFF', '#ED2939'],
  ['#003082', '#FFDE00', '#FFFFFF'],
  ['#DC143C', '#FFFFFF', '#003580'],
  ['#008751', '#FCD116', '#CE1126'],
  ['#0055A4', '#FFFFFF', '#EF4135'],
  ['#003399', '#009A44', '#CE1126'],
  ['#006847', '#000000', '#CE1126'],
  ['#EF3340', '#FFFFFF', '#009A44'],
].map((p) => Object.freeze([...p])));

// --- Kleurklasse-normalisatie -----------------------------------------------
// Acht ankerkleuren; elke hex wordt op kortste RGB-afstand ingedeeld. Grof is
// hier goed: "blauw-wit-rood" moet botsen met Frankrijk, ongeacht de precieze
// blauwtint.

const COLOR_ANCHORS = Object.freeze({
  red: [206, 17, 38],
  white: [255, 255, 255],
  blue: [0, 56, 168],
  green: [0, 154, 68],
  yellow: [255, 209, 0],
  black: [0, 0, 0],
  orange: [255, 128, 0],
  crimson: [220, 20, 60],
});

function hexToRgb(hex) {
  const v = hex.replace('#', '');
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

/**
 * Deelt een hexkleur in bij de dichtstbijzijnde ankerklasse.
 * Crimson telt als red: het onderscheid is voor de wering irrelevant.
 * @param {string} hex
 * @returns {string}
 */
export function colorClass(hex) {
  const [r, g, b] = hexToRgb(hex);
  let best = 'red';
  let bestDist = Infinity;
  for (const [name, [ar, ag, ab]] of Object.entries(COLOR_ANCHORS)) {
    const d = (r - ar) ** 2 + (g - ag) ** 2 + (b - ab) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = name;
    }
  }
  return best === 'crimson' ? 'red' : best;
}

// --- Denylijst van bekende eenvoudige vlaggen -------------------------------
// Signatuur: `${pattern}|${kleurklassen van boven→onder of links→rechts}`.
// Alleen patronen die met 2–3 vlakken een bestaande vlag exact kunnen
// reproduceren staan erin; complexe patronen (sunburst, quartered, saltire
// met kruis in afwijkende kleuren) zijn per constructie geen bestaande vlag,
// met Jamaica als bekende saltire-uitzondering.

const REAL_FLAG_SIGNATURES = new Set([
  // Verticale driekleuren (links→rechts)
  'vstripes|blue,white,red',    // Frankrijk
  'vstripes|green,white,red',   // Italië, Mexico (zonder embleem)
  'vstripes|green,white,orange',// Ierland
  'vstripes|orange,white,green',// Ivoorkust
  'vstripes|black,yellow,red',  // België
  'vstripes|blue,yellow,red',   // Roemenië, Tsjaad, Andorra-basis, Moldavië-basis
  'vstripes|green,yellow,red',  // Mali, Guinee-basis (gespiegeld)
  'vstripes|red,yellow,green',  // Guinee
  'vstripes|green,white,green', // Nigeria
  // Horizontale driekleuren (boven→onder)
  'hstripes|red,white,blue',    // Nederland, Luxemburg
  'hstripes|white,blue,red',    // Rusland
  'hstripes|blue,white,red',    // (omgekeerd NL; o.a. historisch/Krijgsmacht-varianten)
  'hstripes|black,red,yellow',  // Duitsland
  'hstripes|red,white,red',     // Oostenrijk, basis Letland
  'hstripes|red,green,red',     // (basis) — voorzichtigheidshalve
  'hstripes|red,white,green',   // Hongarije (rood-wit-groen)
  'hstripes|white,green,red',   // Bulgarije
  'hstripes|blue,black,white',  // Estland (blauw-zwart-wit)
  'hstripes|yellow,green,red',  // Litouwen-basis (geel-groen-rood)
  'hstripes|red,yellow,red',    // Spanje-basis
  'hstripes|blue,yellow,blue',  // (basis) — voorzichtigheidshalve
  'hstripes|white,red,white',   // basis Libanon/Peru-horizontaalvariant
  'hstripes|green,white,red',   // basis Iran/Hongarije-spiegel
  'hstripes|red,blue,red',      // basis
  'hstripes|orange,white,green',// India-basis, Niger-basis
  // Sterrenvarianten die met ster bestaan
  'vstripes-star|green,red,yellow', // Kameroen (ster op rood)
  'hstripes-star|red,white,blue',   // basis — voorzichtigheidshalve
  // Bekende saltire
  'saltire|green,yellow,black',  // Jamaica-klassen
  'saltire|green,black,yellow',
]);

/**
 * Signatuur van een kandidaat, voor de wering én voor tests.
 * @param {string} pattern
 * @param {ReadonlyArray<string>} palette
 * @returns {string}
 */
export function flagSignature(pattern, palette) {
  return `${pattern}|${palette.map(colorClass).join(',')}`;
}

export function isKnownRealFlagSignature(pattern, palette) {
  return REAL_FLAG_SIGNATURES.has(flagSignature(pattern, palette));
}

// --- Deterministische PRNG (xmur3-hash → mulberry32) ------------------------

function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- De generator ------------------------------------------------------------

const PERTURBATION_PATTERNS = Object.freeze(['nordic', 'chevron', 'sunburst', 'cross']);

/**
 * Genereert een seed-deterministische nepvlag-specificatie die gegarandeerd
 * niet in de denylijst van bekende echte vlaggen valt.
 *
 * @param {string} seed - opaque seed van de vraagselectie (GR4)
 * @returns {{ pattern: string, palette: string[], rendererVersion: string }}
 * @throws {TypeError} bij een lege of niet-string seed
 */
export function generateFlagSpec(seed) {
  if (typeof seed !== 'string' || seed.length === 0) {
    throw new TypeError('generateFlagSpec verwacht een niet-lege seed-string.');
  }
  const random = mulberry32(xmur3(seed)());

  let pattern = FLAG_PATTERNS[Math.floor(random() * FLAG_PATTERNS.length)];
  let palette = [...FLAG_PALETTES[Math.floor(random() * FLAG_PALETTES.length)]];

  // Wering, deterministisch en begrensd:
  // 1) palette roteren (max 2x — daarna is elke volgorde geprobeerd);
  // 2) daarna patroon vervangen door een complex patroon uit een vaste lijst.
  for (let rotation = 0; rotation < 2 && isKnownRealFlagSignature(pattern, palette); rotation++) {
    palette.push(palette.shift());
  }
  if (isKnownRealFlagSignature(pattern, palette)) {
    pattern = PERTURBATION_PATTERNS[Math.floor(random() * PERTURBATION_PATTERNS.length)];
  }

  return { pattern, palette, rendererVersion: FLAG_RENDERER_VERSION };
}
