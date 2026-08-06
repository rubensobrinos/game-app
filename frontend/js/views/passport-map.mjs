// views/passport-map.mjs — de paspoortkaart (besluit 53, punt 1.16).
//
// WAT DIT WEL EN NIET IS. Geen ingekleurde wereldkaart: daarvoor moet je weten
// hoe GROOT elk land is, en die geografische omvang staat niet in onze data —
// `shapes.data.mjs` draagt per land een centroïde (`center`) en een verhouding,
// maar geen extent. Een kaart die landen op goed geluk schaalt, zou een
// verzonnen wereld tonen; dat is erger dan geen kaart.
//
// Wat er wél in zit, klopt: elk land dat je gezien hebt krijgt een stip op zijn
// werkelijke lengte- en breedtegraad. Positie is waar, grootte wordt niet
// beweerd. Het leest als een reisverslag — precies wat besluit 53 vraagt — en
// het schaalt mee: bij 8 landen zie je een handjevol stippen, bij 150 zie je de
// continenten verschijnen.
//
// Equirectangular: lon -180..180 op x, lat 90..-90 op y. De simpelste projectie
// die er is, en voor stippen de eerlijkste — hij vervormt niets aan de plek.

const WERELD_VERHOUDING = 2; // 360 graden breed, 180 hoog

/**
 * @param {HTMLCanvasElement} canvas
 * @param {Array<{ center: [number, number], nieuw?: boolean }>} landen
 * @param {{ breedte?: number, kleur?: string, kleurNieuw?: string }} [opties]
 */
export function renderPassportMap(canvas, landen, opties = {}) {
  const breedte = opties.breedte ?? 320;
  const hoogte = Math.round(breedte / WERELD_VERHOUDING);
  const schaal = (globalThis.devicePixelRatio ?? 1) > 1 ? 2 : 1;
  canvas.width = breedte * schaal;
  canvas.height = hoogte * schaal;
  canvas.style.width = `${breedte}px`;
  canvas.style.height = `${hoogte}px`;

  const ctx = canvas.getContext?.('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(schaal, schaal);

  const kleur = opties.kleur ?? 'rgba(216, 255, 62, 0.55)';
  const kleurNieuw = opties.kleurNieuw ?? '#d8ff3e';

  // Nieuwe landen als laatste, zodat ze bovenop liggen en opvallen.
  const geordend = [...landen].sort((a, b) => Number(a.nieuw === true) - Number(b.nieuw === true));
  for (const land of geordend) {
    const punt = plaats(land.center, breedte, hoogte);
    if (punt === null) continue;
    const nieuw = land.nieuw === true;
    ctx.beginPath();
    ctx.arc(punt.x, punt.y, nieuw ? 3.2 : 2.2, 0, Math.PI * 2);
    ctx.fillStyle = nieuw ? kleurNieuw : kleur;
    ctx.fill();
  }
}

/**
 * Lengte-/breedtegraad naar beeldpunt. Geeft `null` bij een centroïde die niet
 * klopt — liever geen stip dan een stip op de verkeerde plek.
 * @param {unknown} center
 */
function plaats(center, breedte, hoogte) {
  if (!Array.isArray(center) || center.length < 2) return null;
  const [lon, lat] = center;
  if (typeof lon !== 'number' || typeof lat !== 'number') return null;
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  if (lon < -180 || lon > 180 || lat < -90 || lat > 90) return null;
  return {
    x: ((lon + 180) / 360) * breedte,
    y: ((90 - lat) / 180) * hoogte,
  };
}
