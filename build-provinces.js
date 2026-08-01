/* build-provinces.js — admin-1 silhouettes in SHARED per-country space, so a
 * country's units together form its map (draw all faint, highlight one).
 * Robust: country-level antimeridian unwrap + MAD outlier trim drops far-flung
 * overseas territories so the mainland fills the canvas.
 * Run: node --max-old-space-size=2048 build-provinces.js
 */
const fs = require('fs');
const path = require('path');
const gameDir = __dirname;
const r1 = v => Math.round(v * 10) / 10;

function exteriorRings(g) {
  if (g.type === 'Polygon')      return [g.coordinates[0]];
  if (g.type === 'MultiPolygon') return g.coordinates.map(p => p[0]);
  return [];
}
function ringArea(ring) {
  let a = 0;
  for (let i = 0, n = ring.length, j = n - 1; i < n; j = i++) a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  return Math.abs(a) / 2;
}
function unitRings(geom) {
  let rings = exteriorRings(geom).filter(r => r && r.length >= 4).map(r => r.map(p => [p[0], p[1]]));
  if (!rings.length) return [];
  const areas = rings.map(ringArea), mx = Math.max.apply(null, areas);
  return rings.filter((r, i) => areas[i] >= mx * 0.03);
}
function median(arr) {
  const a = arr.slice().sort((x, y) => x - y), m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

const geo = JSON.parse(fs.readFileSync(path.join(gameDir, 'build', 'admin1-10m.geojson'), 'utf8'));
const iso = JSON.parse(fs.readFileSync(path.join(gameDir, 'build', 'iso.json'), 'utf8'));
const COUNTRIES = eval(fs.readFileSync(path.join(gameDir, 'data', 'countries.js'), 'utf8') + '\n;COUNTRIES');
const region = {}, isoName = {};
for (const r of iso) if (r['alpha-2']) { region[r['alpha-2'].toUpperCase()] = r.region; isoName[r['alpha-2'].toUpperCase()] = r.name; }
const my = {}; for (const c of COUNTRIES) my[c.iso2] = c;

// Group admin-1 features by country.
const groups = {};
for (const f of geo.features) {
  const a2 = (f.properties.iso_a2 || '').toUpperCase();
  if (!a2 || a2 === '-99') continue;
  const reg = region[a2];
  if (reg !== 'Europe' && reg !== 'Americas') continue;
  const name = f.properties.name_en || f.properties.name;
  if (!name) continue;
  const rings = unitRings(f.geometry);
  if (!rings.length) continue;
  (groups[a2] = groups[a2] || []).push({ n: name, rings, ty: f.properties.type_en || '' });
}

const out = {};
let unitCount = 0;
for (const a2 of Object.keys(groups)) {
  let units = groups[a2];
  if (units.length < 2) continue;

  // Country-level antimeridian unwrap.
  let lonMin = Infinity, lonMax = -Infinity;
  for (const u of units) for (const r of u.rings) for (const p of r) { if (p[0] < lonMin) lonMin = p[0]; if (p[0] > lonMax) lonMax = p[0]; }
  if (lonMax - lonMin > 180) for (const u of units) for (const r of u.rings) for (const p of r) if (p[0] < 0) p[0] += 360;

  // Per-unit centroid (bbox centre).
  for (const u of units) {
    let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity;
    for (const r of u.rings) for (const p of r) { if (p[0] < a) a = p[0]; if (p[0] > b) b = p[0]; if (p[1] < c) c = p[1]; if (p[1] > d) d = p[1]; }
    u.cx = (a + b) / 2; u.cy = (c + d) / 2;
  }
  // MAD outlier trim (drops overseas territories).
  const medLon = median(units.map(u => u.cx)), medLat = median(units.map(u => u.cy));
  const madLon = median(units.map(u => Math.abs(u.cx - medLon))) || 0;
  const madLat = median(units.map(u => Math.abs(u.cy - medLat))) || 0;
  const tLon = 3 * madLon + 2, tLat = 3 * madLat + 2;
  let kept = units.filter(u => Math.abs(u.cx - medLon) <= tLon && Math.abs(u.cy - medLat) <= tLat);
  if (kept.length < 2) kept = units;

  // Shared bbox over kept units (cos-lat corrected).
  let latMin = Infinity, latMax = -Infinity;
  for (const u of kept) for (const r of u.rings) for (const p of r) { if (p[1] < latMin) latMin = p[1]; if (p[1] > latMax) latMax = p[1]; }
  const cosK = Math.max(Math.cos(((latMin + latMax) / 2) * Math.PI / 180), 0.15);
  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
  for (const u of kept) for (const r of u.rings) for (const p of r) {
    const x = p[0] * cosK;
    if (x < xMin) xMin = x; if (x > xMax) xMax = x;
    if (p[1] < yMin) yMin = p[1]; if (p[1] > yMax) yMax = p[1];
  }
  const pad = 6, w = xMax - xMin || 1, h = yMax - yMin || 1;
  const scale = (100 - 2 * pad) / Math.max(w, h);
  const offX = (100 - w * scale) / 2, offY = (100 - h * scale) / 2;

  // Dominant admin-1 type (State / Province / Department / …) + country centroid.
  const tc = {};
  for (const u of kept) if (u.ty) tc[u.ty] = (tc[u.ty] || 0) + 1;
  let ty = '', best = 0;
  for (const k in tc) if (tc[k] > best) { best = tc[k]; ty = k; }
  const lonN = medLon > 180 ? medLon - 360 : medLon;

  const rec = {
    name:    my[a2.toLowerCase()] ? my[a2.toLowerCase()].name_nl : (isoName[a2] || a2),
    name_en: my[a2.toLowerCase()] ? my[a2.toLowerCase()].name_en : (isoName[a2] || a2),
    name_es: my[a2.toLowerCase()] ? my[a2.toLowerCase()].name_es : (isoName[a2] || a2),
    region:  region[a2],
    type:    ty,
    lon:     Math.round(lonN * 10) / 10,
    lat:     Math.round(medLat * 10) / 10,
    units:   [],
  };
  for (const u of kept) {
    let d = '';
    for (const r of u.rings) {
      const pts = [];
      let lx = null, ly = null;
      for (let i = 0; i < r.length; i++) {
        const px = offX + (r[i][0] * cosK - xMin) * scale;
        const py = offY + (yMax - r[i][1]) * scale;
        if (i > 0 && i < r.length - 1 && lx !== null && Math.abs(px - lx) + Math.abs(py - ly) < 0.4) continue;
        pts.push(r1(px) + ' ' + r1(py)); lx = px; ly = py;
      }
      if (pts.length < 3) continue;
      d += 'M' + pts[0] + 'L' + pts.slice(1).join('L') + 'Z';
    }
    if (d) rec.units.push({ n: u.n, d });
  }
  if (rec.units.length >= 2) { rec.units.sort((a, b) => a.n.localeCompare(b.n)); out[a2.toLowerCase()] = rec; unitCount += rec.units.length; }
}

const body =
`/* Auto-generated by build-provinces.js — admin-1 silhouettes in shared per-country
   space (draw all faint, highlight one). viewBox "0 0 100 100".
   ${Object.keys(out).length} countries, ${unitCount} units. */
const PROVINCES = ${JSON.stringify(out)};
`;
fs.writeFileSync(path.join(gameDir, 'data', 'provinces.js'), body, 'utf8');
console.log(`Countries: ${Object.keys(out).length}, units: ${unitCount}`);
console.log(`File size: ${Math.round(fs.statSync(path.join(gameDir, 'data', 'provinces.js')).size / 1024)} KB`);
console.log(`US units: ${out.us ? out.us.units.length : 0}, FR: ${out.fr ? out.fr.units.length : 0}, DE: ${out.de ? out.de.units.length : 0}`);
