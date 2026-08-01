/* build-shapes.js — generate real country silhouettes into data/shapes.js.
 *
 * Source: build/world.geo.json (johan/world.geo.json, ISO3 ids) +
 *         build/iso.json (ISO 3166 alpha-2 ↔ alpha-3).
 * Each country's outline is projected into the shared viewBox "0 0 100 100":
 *   - longitude corrected by cos(midLat) so shapes aren't east-west stretched
 *   - north-up (SVG y flipped), centred, aspect-ratio preserved
 *   - tiny islands dropped, points simplified to keep the file small
 * Output keyed by our flag iso2 so hint.js can look up COUNTRY_SHAPES[iso2].
 *
 * Run:  node build-shapes.js
 */
const fs   = require('fs');
const path = require('path');

const gameDir = __dirname;

function normalize(str) {
  return String(str).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}
const round1 = v => String(Math.round(v * 10) / 10);

// ── Load inputs ──
const geo = JSON.parse(fs.readFileSync(path.join(gameDir, 'build', 'world.geo.json'), 'utf8'));
const iso = JSON.parse(fs.readFileSync(path.join(gameDir, 'build', 'iso.json'), 'utf8'));
const COUNTRIES = eval(fs.readFileSync(path.join(gameDir, 'data', 'countries.js'), 'utf8') + '\n;COUNTRIES');

// iso3 -> iso2, and normalized name -> iso2 (for name fallback)
const iso3to2 = {};
for (const r of iso) if (r['alpha-3'] && r['alpha-2']) iso3to2[r['alpha-3'].toUpperCase()] = r['alpha-2'].toLowerCase();

const myIso2 = new Set(COUNTRIES.map(c => c.iso2));
const nameToIso2 = {};
for (const c of COUNTRIES) {
  for (const k of ['name_en', 'name_nl', 'name_es']) if (c[k]) nameToIso2[normalize(c[k])] = c.iso2;
  if (c.aliases) for (const lang of ['en', 'nl', 'es']) for (const a of (c.aliases[lang] || [])) nameToIso2[normalize(a)] = c.iso2;
}

// ── Geometry helpers ──
function exteriorRings(geom) {
  if (geom.type === 'Polygon')      return [geom.coordinates[0]];
  if (geom.type === 'MultiPolygon') return geom.coordinates.map(p => p[0]);
  return [];
}
function ringArea(ring) {           // shoelace, absolute (lon/lat units)
  let a = 0;
  for (let i = 0, n = ring.length, j = n - 1; i < n; j = i++) {
    a += (ring[j][0] * ring[i][1]) - (ring[i][0] * ring[j][1]);
  }
  return Math.abs(a) / 2;
}

function buildPath(geom) {
  let rings = exteriorRings(geom).filter(r => r && r.length >= 4).map(r => r.map(p => [p[0], p[1]]));
  if (!rings.length) return null;

  // Antimeridian unwrap: if the country spans >180° of longitude, shift west lons east.
  let lonMin = Infinity, lonMax = -Infinity;
  for (const r of rings) for (const p of r) { if (p[0] < lonMin) lonMin = p[0]; if (p[0] > lonMax) lonMax = p[0]; }
  if (lonMax - lonMin > 180) for (const r of rings) for (const p of r) if (p[0] < 0) p[0] += 360;

  // Drop tiny islands (< 1.5% of the largest landmass), keep the biggest.
  const areas = rings.map(ringArea);
  const maxArea = Math.max(...areas);
  rings = rings.filter((r, i) => areas[i] >= maxArea * 0.015);

  // cos(latitude) correction on x.
  let latMin = Infinity, latMax = -Infinity;
  for (const r of rings) for (const p of r) { if (p[1] < latMin) latMin = p[1]; if (p[1] > latMax) latMax = p[1]; }
  const cosK = Math.max(Math.cos(((latMin + latMax) / 2) * Math.PI / 180), 0.15);

  // Project to (x = lon*cosK, y = lat); compute bbox.
  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
  for (const r of rings) for (const p of r) {
    const x = p[0] * cosK;
    if (x < xMin) xMin = x; if (x > xMax) xMax = x;
    if (p[1] < yMin) yMin = p[1]; if (p[1] > yMax) yMax = p[1];
  }
  const pad = 6, w = xMax - xMin || 1, h = yMax - yMin || 1;
  const scale = (100 - 2 * pad) / Math.max(w, h);
  const offX = (100 - w * scale) / 2, offY = (100 - h * scale) / 2;

  let d = '';
  for (const r of rings) {
    const pts = [];
    let lastX = null, lastY = null;
    for (let i = 0; i < r.length; i++) {
      const px = offX + (r[i][0] * cosK - xMin) * scale;
      const py = offY + (yMax - r[i][1]) * scale;      // flip Y (north up)
      if (i > 0 && i < r.length - 1 && lastX !== null &&
          Math.abs(px - lastX) + Math.abs(py - lastY) < 0.4) continue;   // simplify
      pts.push([round1(px), round1(py)]);
      lastX = px; lastY = py;
    }
    if (pts.length < 3) continue;
    d += 'M' + pts[0][0] + ' ' + pts[0][1] + 'L' + pts.slice(1).map(p => p[0] + ' ' + p[1]).join('L') + 'Z';
  }
  return d || null;
}

// ── Match features to our iso2 and build shapes ──
const shapes = {};
for (const f of geo.features) {
  const id2 = iso3to2[String(f.id).toUpperCase()] || nameToIso2[normalize(f.properties && f.properties.name)];
  if (!id2 || !myIso2.has(id2) || shapes[id2]) continue;
  const d = buildPath(f.geometry);
  if (d) shapes[id2] = `<path d="${d}"/>`;
}

// ── Validate bounds (all coords within [0,100]) ──
let outOfBounds = 0;
for (const k in shapes) {
  const nums = shapes[k].match(/-?\d+(\.\d+)?/g).map(Number);
  if (nums.some(n => n < -0.5 || n > 100.5)) outOfBounds++;
}

const out =
`/* Auto-generated by build-shapes.js — real country silhouettes.
   Coordinate space: viewBox "0 0 100 100". ${Object.keys(shapes).length} of ${COUNTRIES.length} countries have a contour. */
const SHAPE_VIEWBOX = '0 0 100 100';
const COUNTRY_SHAPES = ${JSON.stringify(shapes)};
`;
fs.writeFileSync(path.join(gameDir, 'data', 'shapes.js'), out, 'utf8');

const unmatched = COUNTRIES.filter(c => !shapes[c.iso2]).map(c => c.iso2);
console.log(`Matched ${Object.keys(shapes).length} / ${COUNTRIES.length} countries. Out-of-bounds: ${outOfBounds}.`);
console.log(`File size: ${Math.round(fs.statSync(path.join(gameDir, 'data', 'shapes.js')).size / 1024)} KB`);
console.log(`No contour (${unmatched.length}): ${unmatched.join(', ')}`);
