// shared/content/index.mjs — CT1: de gedeelde contentmodule (ARCHITECTURE.md,
// principe 6; DECISIONS.md #29). Pure ESM, draait in Node én browser: geen DOM,
// geen filesystem, geen globals, geen dependencies.
//
// Consumenten:
//  - server: `buildMatchQuestionPlan()` (server/rules/question-selection.js)
//    krijgt `getCountryPool()` als `pool` — zie het leidende contract in
//    docs/game-rules-plan/CONTENT-POOL-INTERFACE.md;
//  - client: naamweergave via iso2 (assets blijven flags/{iso2}.png).
//
// De data zelf staat in countries.data.mjs (gegenereerd; zie
// build-content.mjs voor de herhaalbare extractiestap uit data/).

import { COUNTRY_ENTRIES } from './countries.data.mjs';

export {
  generateFlagSpec,
  FLAG_RENDERER_VERSION,
  FLAG_PATTERNS,
  FLAG_PALETTES,
} from './flag-spec.mjs';

/**
 * Gepind per match (DECISIONS.md #21). Verhoog bij ELKE inhoudelijke wijziging
 * van de gegenereerde data, zodat een deploy nooit stilzwijgend andere vragen
 * geeft binnen een lopende room.
 */
export const CONTENT_VERSION = '2026.08.1';

/** Content-moeilijkheidsniveaus. LET OP: "normal" is een ROOM-begrip, geen
 * content-tier (gotcha 2 in CONTENT-POOL-INTERFACE.md). */
export const CONTENT_DIFFICULTIES = Object.freeze(['easy', 'medium', 'hard', 'extreme']);

/**
 * Vertaalt een room-difficulty (DATA-MODEL.md GameConfiguration, DECISIONS.md
 * #35: "normal") naar een content-tier. Dit is de ENIGE plek waar die mapping
 * bestaat; wie roomconfig naar buildMatchQuestionPlan() vertaalt gebruikt deze.
 *
 * @param {string} roomDifficulty
 * @returns {"easy" | "medium" | "hard" | "extreme"}
 * @throws {RangeError} bij een onbekende waarde — stil doormappen zou een
 *   onbereikbare pool opleveren (entries matchen nooit), precies de stille
 *   fout waar het contract voor waarschuwt.
 */
export function mapRoomDifficulty(roomDifficulty) {
  if (roomDifficulty === 'normal') return 'medium';
  if (CONTENT_DIFFICULTIES.includes(roomDifficulty)) return roomDifficulty;
  throw new RangeError(`Onbekende room-difficulty: ${String(roomDifficulty)}`);
}

function deepFreeze(value) {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}

const FROZEN_POOL = deepFreeze(COUNTRY_ENTRIES);

/**
 * De volledige, onveranderlijke landenpool: één platte array van ContentEntry's
 * (alle drie de talen per entry), exact zoals GR4's contract hem verwacht.
 * Diep bevroren: muteren werpt in strict mode, en kan dus nooit stil een
 * lopende match beïnvloeden.
 *
 * @returns {ReadonlyArray<import('./countries.data.mjs').COUNTRY_ENTRIES[number]>}
 */
export function getCountryPool() {
  return FROZEN_POOL;
}
