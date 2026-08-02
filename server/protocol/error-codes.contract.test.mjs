/**
 * @file M2 — contracttest: bewaakt dat `ERROR_CODES_BY_CATEGORY` (deze repo)
 *   en `docs/multiplayer/PROTOCOL.md` §Foutcodes (bron van waarheid) niet uit
 *   elkaar lopen. `extractErrorCodesFromProtocolDoc` is puur tekstparsing,
 *   zonder kennis van de enum, zodat de vergelijking hieronder niet
 *   circulair is. Dit bestand is zelf geen losse productiemodule — de
 *   extractor leeft hier samen met de test die hem tegen het echte document
 *   op schijf uitvoert.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ERROR_CODES_BY_CATEGORY, ALL_ERROR_CODES } from './error-codes.mjs';

/**
 * Leest de tekst van PROTOCOL.md en extraheert alle foutcodes uit de vier
 * subsecties onder "## Foutcodes" (Room en join / Autorisatie / Game en
 * ronde / Input), in documentvolgorde.
 * @param {string} markdown - de volledige tekst van
 *   `docs/multiplayer/PROTOCOL.md`.
 * @returns {Array<{ category: 'Room en join' | 'Autorisatie' |
 *   'Game en ronde' | 'Input', code: string }>}
 */
export function extractErrorCodesFromProtocolDoc(markdown) {
  const lines = markdown.split('\n');
  const startIndex = lines.findIndex((line) => line.trim() === '## Foutcodes');
  if (startIndex === -1) {
    throw new Error('extractErrorCodesFromProtocolDoc: sectie "## Foutcodes" niet gevonden');
  }

  const results = [];
  let currentCategory = null;
  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^##\s+\S/.test(line)) break; // volgende top-level sectie: Foutcodes is voorbij
    const headingMatch = line.match(/^###\s+(.+?)\s*$/);
    if (headingMatch) {
      currentCategory = headingMatch[1].trim();
      continue;
    }
    const codeMatch = line.match(/^-\s*`([A-Z0-9_]+)`\s*$/);
    if (codeMatch && currentCategory) {
      results.push({ category: currentCategory, code: codeMatch[1] });
    }
  }
  return results;
}

const CATEGORY_LABEL_TO_KEY = Object.freeze({
  'Room en join': 'ROOM_EN_JOIN',
  Autorisatie: 'AUTORISATIE',
  'Game en ronde': 'GAME_EN_RONDE',
  Input: 'INPUT',
});

const protocolMdPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../docs/multiplayer/PROTOCOL.md',
);
const protocolMd = readFileSync(protocolMdPath, 'utf8');
const extracted = extractErrorCodesFromProtocolDoc(protocolMd);

test('extractErrorCodesFromProtocolDoc: elke categorie in PROTOCOL.md komt exact overeen met ERROR_CODES_BY_CATEGORY', () => {
  const extractedByCategory = {};
  for (const { category, code } of extracted) {
    (extractedByCategory[category] ??= []).push(code);
  }

  assert.deepEqual(
    Object.keys(extractedByCategory).sort(),
    Object.keys(CATEGORY_LABEL_TO_KEY).sort(),
    'PROTOCOL.md bevat andere Foutcodes-subsecties dan verwacht',
  );

  for (const [label, key] of Object.entries(CATEGORY_LABEL_TO_KEY)) {
    assert.deepEqual(
      [...extractedByCategory[label]].sort(),
      [...ERROR_CODES_BY_CATEGORY[key]].sort(),
      `categorie "${label}" verschilt tussen PROTOCOL.md en ERROR_CODES_BY_CATEGORY`,
    );
  }
});

test('extractErrorCodesFromProtocolDoc vs ALL_ERROR_CODES: leeg set-verschil in beide richtingen', () => {
  const codesFromDoc = new Set(extracted.map((entry) => entry.code));
  assert.equal(codesFromDoc.size, 23);

  const onlyInDoc = [...codesFromDoc].filter((code) => !ALL_ERROR_CODES.has(code));
  const onlyInEnum = [...ALL_ERROR_CODES].filter((code) => !codesFromDoc.has(code));
  assert.deepEqual(onlyInDoc, [], 'PROTOCOL.md bevat codes die niet in de enum staan');
  assert.deepEqual(onlyInEnum, [], 'de enum bevat codes die niet in PROTOCOL.md staan');
});
