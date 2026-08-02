// shared/content/build-content.mjs — CT1: gedocumenteerde, herhaalbare
// extractiestap (CT1-mandaat, opdracht 5: app.js en data/ blijven onaangeraakt).
//
// Leest de bestaande browser-databestanden `data/countries.js` en
// `data/country-facts.js` (browser-globals, geen modules) in een geïsoleerde
// vm-context, valideert ze, en genereert `countries.data.mjs`: één platte
// ContentEntry-array conform docs/game-rules-plan/CONTENT-POOL-INTERFACE.md
// (het leidende contract van GR4).
//
// Draaien (vanuit de repo-root):
//   node shared/content/build-content.mjs
//
// De gegenereerde file wordt gecommit. Wijzigt data/ (nieuwe contentversie),
// draai dan dit script opnieuw én verhoog CONTENT_VERSION in index.mjs.
//
// Harde keuzes, uit het contract:
//  - `capital` is ALTIJD expliciet aanwezig: een object of letterlijk null
//    (gotcha 1: nooit een ontbrekende key).
//  - `difficulty` alleen easy|medium|hard|extreme (gotcha 2: "normal" is een
//    ROOMbegrip en bestaat niet in content; zie mapRoomDifficulty in index.mjs).
//  - build FAALT hard op: dubbele iso2, ontbrekend facts-record, ontbrekend
//    continent, onbekende difficulty, ontbrekende naam in een van de 3 talen.
//  - Extra velden (aliases, capitalAliases) mogen van het contract: GR4 leest
//    ze niet; ze zijn er voor golf 2 (typen-invoer) en rendering.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const OUT_FILE = path.join(HERE, 'countries.data.mjs');

const VALID_DIFFICULTIES = new Set(['easy', 'medium', 'hard', 'extreme']);

/** Evalueert één browser-databestand en geeft de gevraagde global terug. */
async function loadBrowserGlobal(relPath, globalName) {
  const source = await readFile(path.join(REPO_ROOT, relPath), 'utf8');
  const context = vm.createContext(Object.create(null));
  // Top-level `const` hangt niet aan het context-object; de completion value
  // van een extra expressie-statement wel.
  return vm.runInContext(`${source};\n${globalName};`, context, {
    filename: relPath,
    timeout: 5000,
  });
}

function fail(message) {
  throw new Error(`build-content: ${message}`);
}

function requireNonEmptyString(value, what) {
  if (typeof value !== 'string' || value.trim() === '') fail(`${what} ontbreekt of is leeg`);
  return value;
}

function toStringArray(value, what) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.some((s) => typeof s !== 'string')) {
    fail(`${what} is geen string-array`);
  }
  return [...value];
}

function toNumberOrNull(value, what) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${what} is geen eindig getal`);
  return value;
}

const countries = await loadBrowserGlobal('data/countries.js', 'COUNTRIES');
const facts = await loadBrowserGlobal('data/country-facts.js', 'COUNTRY_FACTS');

if (!Array.isArray(countries) || countries.length === 0) fail('COUNTRIES is leeg of geen array');
if (facts === null || typeof facts !== 'object') fail('COUNTRY_FACTS is geen object');

const seen = new Set();
const entries = countries.map((c) => {
  const iso2 = requireNonEmptyString(c.iso2, 'iso2').toLowerCase();
  if (iso2 !== c.iso2) fail(`iso2 "${c.iso2}" is niet lowercase (assetconventie flags/{iso2}.png)`);
  if (seen.has(iso2)) fail(`dubbele iso2 "${iso2}"`);
  seen.add(iso2);

  if (!VALID_DIFFICULTIES.has(c.difficulty)) {
    fail(`"${iso2}": onbekende difficulty "${c.difficulty}"`);
  }

  const f = facts[iso2];
  if (!f) fail(`"${iso2}": geen record in COUNTRY_FACTS`);

  const continent = requireNonEmptyString(f.continent, `"${iso2}".continent`);

  const hasCapital = f.capital_nl != null || f.capital_en != null || f.capital_es != null;
  const capital = hasCapital
    ? {
        nl: requireNonEmptyString(f.capital_nl, `"${iso2}".capital_nl`),
        en: requireNonEmptyString(f.capital_en, `"${iso2}".capital_en`),
        es: requireNonEmptyString(f.capital_es, `"${iso2}".capital_es`),
      }
    : null; // expliciet null — gotcha 1 uit CONTENT-POOL-INTERFACE.md

  return {
    iso2,
    difficulty: c.difficulty,
    continent,
    name: {
      nl: requireNonEmptyString(c.name_nl, `"${iso2}".name_nl`),
      en: requireNonEmptyString(c.name_en, `"${iso2}".name_en`),
      es: requireNonEmptyString(c.name_es, `"${iso2}".name_es`),
    },
    capital,
    population: toNumberOrNull(f.population, `"${iso2}".population`),
    area: toNumberOrNull(f.area, `"${iso2}".area`),
    gdp: toNumberOrNull(f.gdp, `"${iso2}".gdp`),
    // Extra t.o.v. het GR4-contract (wordt daar niet gelezen); voor golf 2
    // typen-invoer en rendering:
    aliases: {
      nl: toStringArray(c.aliases?.nl, `"${iso2}".aliases.nl`),
      en: toStringArray(c.aliases?.en, `"${iso2}".aliases.en`),
      es: toStringArray(c.aliases?.es, `"${iso2}".aliases.es`),
    },
    capitalAliases: capital
      ? {
          nl: toStringArray(f.capitalAliases?.nl, `"${iso2}".capitalAliases.nl`),
          en: toStringArray(f.capitalAliases?.en, `"${iso2}".capitalAliases.en`),
          es: toStringArray(f.capitalAliases?.es, `"${iso2}".capitalAliases.es`),
        }
      : null,
  };
});

// Overzicht voor de generatiestempel én een sanity-log voor de bouwer.
const byDifficulty = {};
const byContinent = {};
for (const e of entries) {
  byDifficulty[e.difficulty] = (byDifficulty[e.difficulty] ?? 0) + 1;
  byContinent[e.continent] = (byContinent[e.continent] ?? 0) + 1;
}

const header = `// GEGENEREERD BESTAND — niet met de hand bewerken.
// Bron: data/countries.js + data/country-facts.js
// Genereer opnieuw met: node shared/content/build-content.mjs
// Contract: docs/game-rules-plan/CONTENT-POOL-INTERFACE.md (ContentEntry)
// Stand bij generatie: ${entries.length} landen; per difficulty ${JSON.stringify(byDifficulty)}; per continent ${JSON.stringify(byContinent)}
`;

await writeFile(
  OUT_FILE,
  `${header}export const COUNTRY_ENTRIES = ${JSON.stringify(entries, null, 1)};\n`,
  'utf8',
);

console.log(
  `build-content: ${entries.length} landen → ${path.relative(REPO_ROOT, OUT_FILE)}`,
  byDifficulty,
  byContinent,
);
