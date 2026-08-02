// qr.mjs — dunne wrapper om de gevendorde QR-generator (frontend/vendor/
// qrcode-generator.mjs, MIT). Eén functie, één vorm: een data-URL voor een
// <img>-element.
//
// Waarom een data-URL en geen SVG-string: een SVG-string zou via innerHTML
// het DOM in moeten, en frontend/ heeft als precedent "nooit innerHTML".
// `img.src = qrDataUrl(joinUrl)` is inert, werkt overal, en de CSP van de
// reverse proxy staat `img-src data:` al toe.
//
// DEPLOYMENT-AND-TESTING.md: "QR lokaal in de browser genereren uit de
// joinUrl, zodat geen externe QR-dienst nodig is" — dit is die generator.

import qrcode from '../vendor/qrcode-generator.mjs';

/**
 * @param {string} text - de join-URL (of elke andere korte tekst)
 * @param {{ cellSize?: number, margin?: number, errorCorrection?: 'L'|'M'|'Q'|'H' }} [options]
 *   cellSize: pixels per module (8 ≈ schermvullend op mobiel bij 29 modules);
 *   margin: stille zone in pixels (QR-spec adviseert ≥ 4 modules);
 *   errorCorrection: 'M' is de gangbare default voor URL's op een scherm.
 * @returns {string} `data:image/gif;base64,...`
 * @throws {TypeError} bij lege of niet-string invoer
 */
export function qrDataUrl(text, { cellSize = 8, margin = 32, errorCorrection = 'M' } = {}) {
  if (typeof text !== 'string' || text.length === 0) {
    throw new TypeError('qrDataUrl verwacht een niet-lege string.');
  }
  const qr = qrcode(0, errorCorrection); // typeNumber 0 = automatisch kleinste passende versie
  qr.addData(text);
  qr.make();
  return qr.createDataURL(cellSize, margin);
}
