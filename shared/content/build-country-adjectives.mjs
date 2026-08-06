// shared/content/build-country-adjectives.mjs — herhaalbare ESM-poort van
// server/data/country-adjectives.js (stap 3, spelersidentiteit.md — content,
// niet aangeraakt), voor de client (stap 4/5).
//
// WAAROM DIT BESTAAT: `server/data/country-adjectives.js` is CommonJS in
// server/data/ — bereikbaar voor de server (`require`/Node-ESM-interop),
// niet voor de browser (die laadt frontend/-modules rechtstreeks als ESM,
// zonder bundelaar — zie shared/content/build-shapes.mjs's zelfde afweging
// voor shapes.data.mjs). De client rendert een identiteit in zijn EIGEN
// apptaal (spelersidentiteit.md, punt 8) en heeft dus dezelfde
// landbijvoeglijke vormen nodig als de server. Twee losse lijsten met de hand
// bijhouden is gegarandeerd uit elkaar lopen; dit script maakt er één
// herhaalbare stap van, zelfde patroon als build-content.mjs/build-shapes.mjs.
//
// GEEN CONTENTWIJZIGING. Dit script verzint niets — het leest de 60 landen uit
// server/data/country-adjectives.js (CommonJS, via createRequire) en schrijft
// ze ONGEWIJZIGD weg als shared/content/country-adjectives.mjs. Wijzigt die
// bron (nieuwe landen, stap 3 die verder groeit), draai dan dit script
// opnieuw.
//
// Draaien (vanuit de repo-root):
//   node shared/content/build-country-adjectives.mjs

import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const SOURCE = path.join(REPO_ROOT, 'server', 'data', 'country-adjectives.js');
const OUT_FILE = path.join(HERE, 'country-adjectives.mjs');

const require = createRequire(import.meta.url);
const { countryAdjectives } = require(SOURCE);

const count = Object.keys(countryAdjectives).length;

const body = `// GEGENEREERD BESTAND — niet met de hand bewerken.
// Bron: server/data/country-adjectives.js (stap 3, spelersidentiteit.md —
// contentwerk, hier ongewijzigd overgenomen). Genereer opnieuw met:
//   node shared/content/build-country-adjectives.mjs
// Waarom een ESM-kopie in shared/content/ i.p.v. de server/data/js-bron
// rechtstreeks: zie de moduledoc van build-country-adjectives.mjs — de
// browser kan die CommonJS-bron niet laden, de client heeft dezelfde
// landbijvoeglijke vormen nodig als de server (spelersidentiteit.md, punt 8).
// Stand bij generatie: ${count} landen.
export const countryAdjectives = ${JSON.stringify(countryAdjectives, null, 1)};
`;

await writeFile(OUT_FILE, body, 'utf8');
console.log(`build-country-adjectives: ${count} landen -> ${path.relative(REPO_ROOT, OUT_FILE)}`);
