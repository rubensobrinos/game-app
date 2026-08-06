// views/shape-renderer.mjs — "Raad het land" (`country_shape_mc`). Tekent de
// contour van één land op canvas. De tegenhanger van `flag-renderer.mjs`:
// zelfde vorm (canvas erin, tekenwerk eruit, geen renderstate), zelfde
// houding tegenover onbekende invoer (niet werpen, hooguit minder tonen).
//
// De data staat in `shared/content/shapes.data.mjs`: per iso2 de `d`-waarde
// van een SVG-pad in een 100×100-stelsel. Elk pad is in de brondata al in dat
// vierkant genormaliseerd, dus hier wordt niets herschaald op de bounding box —
// precies zoals de solo-game de contour als `<svg viewBox="0 0 100 100">`
// toont. Eén conventie, twee weergaven.
//
// ── HET GEWICHT IS DE HELE REDEN DAT DIT EEN EIGEN MODULE IS ────────────────
//
// `shapes.data.mjs` is 234 KB rauw (85 KB gzip) — tien keer de rest van de
// contentpool. Die mag NOOIT meeliften met een potje "Raad de vlag". Daarom
// staat de import hieronder in een `await import(...)` binnen een functie en
// nergens bovenaan dit bestand: wie deze module importeert haalt de paden nog
// niet op, wie `loadCountryShape()` of `preloadCountryShapes()` aanroept wel.
//
// Dat betekent ook dat `renderCountryShape()` géén iso2 aanneemt maar een
// padstring. De tekenaar is synchroon en gewichtloos; het laden is een aparte,
// asynchrone stap die de aanroeper bewust zet. Zou de tekenaar zelf op iso2
// werken, dan zou elke aanroeper stilzwijgend 234 KB kunnen binnenhalen.

/** Vierkant, want een contour is dat ook — anders dan de 480×300 van een vlag. */
const SIZE = 480;

/**
 * Marge binnen het 100×100-stelsel, zodat een contour die tot de rand loopt
 * niet tegen de canvasrand plakt. In padeenheden, niet in pixels.
 */
const PADDING = 4;

/**
 * Standaardkleur: het lime-signaal uit `base.css` (`--color-signal-lime`).
 * Hardgecodeerd en niet uit `getComputedStyle` gelezen — deze module raakt de
 * layout niet aan, net zomin als `flag-renderer.mjs`. Een aanroeper die een
 * andere kleur wil (het paspoort uit besluit 53 kleurt landen per status) geeft
 * hem mee.
 */
const DEFAULT_FILL = '#d8ff3e';

/**
 * De geladen paden, gecachet per module-instantie. Dit is laadstate, geen
 * renderstate: `renderCountryShape()` hieronder raakt hem niet aan en blijft
 * daarmee net zo puur als `renderFlagSpec()`.
 */
let laadBelofte = null;
let padPerIso2 = null;

/**
 * Haalt de contourdata op — één keer per pagina. Elke volgende aanroep krijgt
 * dezelfde belofte terug, dus twee gelijktijdige rondes leiden nooit tot twee
 * downloads.
 *
 * De importspecifier staat bewust als letterlijke string in de aanroep: een
 * variabele zou een bundelaar (die dit project vandaag niet heeft, maar ooit
 * kan krijgen) dwingen alles mee te nemen wat op het pad lijkt.
 *
 * @returns {Promise<Map<string, string>>} iso2 → padstring
 */
function laadPaden() {
  if (laadBelofte === null) {
    laadBelofte = import('../../../shared/content/shapes.data.mjs').then((mod) => {
      padPerIso2 = new Map(mod.SHAPE_ENTRIES.map((entry) => [entry.iso2, entry.shape]));
      return padPerIso2;
    });
  }
  return laadBelofte;
}

/**
 * Warmt de contourdata op zonder al te tekenen.
 *
 * Bedoeld voor het moment waarop de gameType bekend is maar de eerste vraag
 * nog niet: de lobby of de aftelling. Zonder dit valt de download middenin de
 * ronde, en dan telt de timer al terwijl er nog niets staat.
 *
 * @returns {Promise<void>}
 */
export async function preloadCountryShapes() {
  await laadPaden();
}

/**
 * De contour van één land, of `null` als dit land er geen heeft.
 *
 * `null` is een normale uitkomst, geen fout: vijf pool-landen missen bewust een
 * contour (Réunion, Mayotte, Martinique, Guadeloupe, Frans-Guyana — allemaal
 * Franse overzeese gebieden zonder eigen contour in de brondata). De
 * vraagselectie op de server filtert daar al op via `shapes-index.mjs`, maar
 * een client die tóch een onbekende iso2 krijgt hoort niets te tonen in plaats
 * van te crashen.
 *
 * @param {string} iso2 - kleine letters, zoals overal in de pool
 * @returns {Promise<string|null>}
 */
export async function loadCountryShape(iso2) {
  const paden = await laadPaden();
  if (typeof iso2 !== 'string') {
    return null;
  }
  return paden.get(iso2.toLowerCase()) ?? null;
}

/**
 * Tekent `shape` (de `d`-waarde van een SVG-pad, 100×100-stelsel) op `canvas`.
 *
 * Synchroon, zonder state, en zonder iets te weten van landen of iso2-codes —
 * exact de rol die `renderFlagSpec()` voor vlaggen heeft.
 *
 * Onbekende padcommando's laten het tekenen stoppen bij wat er tot dan toe
 * stond, in plaats van te werpen: de brondata kent vandaag alleen `M`, `L` en
 * `Z`, en als daar ooit een `C` bij komt hoort deze renderer een kalere contour
 * te tonen, niet het spelscherm om te trekken. Zelfde afweging als het
 * `default`-geval in `flag-renderer.mjs`.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {string} shape
 * @param {{ fill?: string, stroke?: string|null, lineWidth?: number, size?: number }} [options]
 *   `stroke` staat standaard op de vulkleur met een dunne lijn: dat verdikt
 *   schiereilanden en eilandketens net genoeg om ze op een telefoon te blijven
 *   zien. Wie een omlijning in een andere kleur wil, geeft er een mee; `null`
 *   zet de lijn uit.
 */
export function renderCountryShape(canvas, shape, options = {}) {
  const {
    fill = DEFAULT_FILL,
    stroke = fill,
    lineWidth = 1,
    size = SIZE,
  } = options;

  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  if (typeof shape !== 'string' || shape.length === 0) {
    return;
  }

  // 100 padeenheden (minus de marge aan beide kanten) op de volle canvasbreedte.
  const schaal = size / (100 + PADDING * 2);
  const naarPixel = (waarde) => (waarde + PADDING) * schaal;

  ctx.beginPath();
  let getekend = false;
  for (const subpad of subpaden(shape)) {
    if (subpad.length === 0) {
      continue;
    }
    subpad.forEach(([x, y], i) => {
      ctx[i === 0 ? 'moveTo' : 'lineTo'](naarPixel(x), naarPixel(y));
    });
    ctx.closePath();
    getekend = true;
  }
  if (!getekend) {
    return;
  }

  // `evenodd` en niet de standaard `nonzero`: een land met een enclave (Italië
  // met San Marino, Zuid-Afrika met Lesotho) heeft een binnenpad dat een gat
  // hoort te zijn. Met `nonzero` hangt dat af van de winding-richting van de
  // brondata, en die is niet gegarandeerd.
  ctx.fillStyle = fill;
  ctx.fill('evenodd');

  if (stroke !== null && lineWidth > 0) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth * schaal;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}

/**
 * Splitst een padstring in subpaden van punten. Kent `M`, `L` en `Z` — de drie
 * commando's die in `shapes.data.mjs` voorkomen. Alles daarbuiten breekt de
 * lus af; zie de toelichting bij `renderCountryShape`.
 *
 * @param {string} shape
 * @returns {Array<Array<[number, number]>>}
 */
function subpaden(shape) {
  const resultaat = [];
  let huidig = [];
  // Commandoletter plus de getallen die erachter staan, in één veeg.
  const stukken = shape.match(/[A-Za-z][^A-Za-z]*/g) ?? [];

  for (const stuk of stukken) {
    const commando = stuk[0].toUpperCase();
    if (commando === 'Z') {
      if (huidig.length > 0) {
        resultaat.push(huidig);
        huidig = [];
      }
      continue;
    }
    if (commando !== 'M' && commando !== 'L') {
      break; // onbekend commando: houden wat we hebben, niet werpen
    }
    if (commando === 'M' && huidig.length > 0) {
      resultaat.push(huidig);
      huidig = [];
    }
    const getallen = (stuk.slice(1).match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    for (let i = 0; i + 1 < getallen.length; i += 2) {
      huidig.push([getallen[i], getallen[i + 1]]);
    }
  }
  if (huidig.length > 0) {
    resultaat.push(huidig);
  }
  return resultaat;
}
