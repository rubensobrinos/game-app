// server/composition/room/configuratie.mjs
//
// De gameconfiguratie van een room: de quick-start default, de ene trechter
// waar elke config doorheen moet (`resolveGameConfiguration`), en de
// wijziging ervan ná creatie (`updateConfig`).
//
// Beide trechters staan bewust in één bestand: `updateConfig` haalt het
// samengevoegde geheel opnieuw door `resolveGameConfiguration`, zodat er nooit
// een room ontstaat met een config die bij `createRoom` geweigerd zou zijn.
// Uit elkaar halen zou die koppeling onzichtbaar maken.

import { assertGameConfigurationShape, CONTINENT_VALUES } from '../../data/types/game-configuration.js';
import { UPDATABLE_CONFIG_KEYS } from '../../protocol/client-events-dispatch.mjs';
import { PLAYABLE_GAME_TYPES, isPlayableGameType } from '../../../shared/content/game-catalog.mjs';
import { CODES, fail, succeed } from './gedeeld.mjs';
import { touchRoom } from './levensduur.mjs';

/**
 * Quick-start default (besluit 35): `flags_mc`, 10 rondes, moeilijkheid
 * normaal, individueel, auto-tempo, snelheidspunten aan, late join aan. De
 * overige velden komen uit het GameConfiguration-voorbeeld in DATA-MODEL.md,
 * met één bewuste afwijking: `deadlineGraceMs` is 250 (besluit 13) en niet de
 * 150 uit dat voorbeeld — DECISIONS.md wint bij strijdigheid.
 */
export const QUICK_START_CONFIG = Object.freeze({
  preset: 'quick_start',
  gameTypes: Object.freeze(['flags_mc']),
  language: 'nl',
  difficulty: 'normal',
  totalRounds: 10,
  questionSeconds: 15,
  resultSeconds: 5,
  scoreboardSeconds: 4,
  scoreboardFrequency: 'every_round',
  pacing: 'auto',
  // Besluit C (DOELBEELD-v2 §3): standaard AAN — de uitslag loopt vanzelf door.
  // Uit betekent: de uitslagfase wacht op de host, en dát onthullen ís dan de
  // ene hostactie van de ronde (besluit 1).
  autoReveal: true,
  speedBonus: true,
  deadlineGraceMs: 250,
  mode: 'individual',
  teamNames: Object.freeze([]),
  metricMode: 'mixed',
  maxPlayers: 100,
  allowLateJoin: true,
  // Punt 7 (docs/openstaand/continentfilter.md): "standaard alle landen
  // wereldwijd, geen configuratie" — dus alle zes continenten, tenzij de host
  // onder "Meer instellingen" inperkt.
  continents: CONTINENT_VALUES,
});

/**
 * Vult een (gedeeltelijke) configuratie aan met de quick-start defaults en
 * laat `assertGameConfigurationShape` het resultaat keuren. Puur plumbing —
 * er wordt hier geen veld berekend of afgeleid.
 * @param {object|undefined} partial
 * @returns {import('../../data/types/game-configuration.js').GameConfiguration}
 */
export function resolveGameConfiguration(partial) {
  if (partial !== undefined && (typeof partial !== 'object' || partial === null || Array.isArray(partial))) {
    throw new TypeError(`resolveGameConfiguration: config moet een object of undefined zijn, kreeg: ${JSON.stringify(partial)}`);
  }
  const merged = { ...QUICK_START_CONFIG, ...(partial ?? {}) };
  merged.gameTypes = Array.isArray(merged.gameTypes) ? [...merged.gameTypes] : merged.gameTypes;
  merged.teamNames = [...merged.teamNames];
  merged.continents = Array.isArray(merged.continents) ? [...merged.continents] : merged.continents;
  assertGameConfigurationShape(merged);

  // §A1 — EXACT ÉÉN SPEELBARE GAMETYPE, op de enige trechter waar room-configs
  // ontstaan én wijzigen (createRoom én updateConfig lopen hier langs).
  //
  // Waarom hier en niet in `assertGameConfigurationShape`: die functie keurt de
  // VORM van een GameConfiguration zoals DATA-MODEL.md hem definieert (een
  // lijst), en dat contract blijft staan voor de dag dat mixed games terugkomen.
  // Wat er vandaag een room in mag, is een productbesluit (32: één gameType per
  // match) plus een ketenfeit (game-catalog.mjs: is de hele keten er klaar
  // voor?) — en dat hoort in de compositie.
  if (merged.gameTypes.length !== 1) {
    throw new RangeError(
      `resolveGameConfiguration: gameTypes moet exact één waarde bevatten (besluit 32), kreeg: ${JSON.stringify(merged.gameTypes)}`,
    );
  }
  if (!isPlayableGameType(merged.gameTypes[0])) {
    throw new RangeError(
      `resolveGameConfiguration: gameType ${JSON.stringify(merged.gameTypes[0])} is niet speelbaar; ` +
        `speelbaar zijn: ${JSON.stringify(PLAYABLE_GAME_TYPES)} (shared/content/game-catalog.mjs)`,
    );
  }
  return merged;
}

/**
 * Past een subset van de gameconfiguratie aan ná creatie (besluit 40,
 * scherm 2: instellingen ín de hostlobby). Alleen in LOBBY — zodra het spel
 * loopt is de configuratie bevroren. De patch is door de protocollaag al
 * gereduceerd tot `UPDATABLE_CONFIG_KEYS` met geldige waarden; hier wordt
 * het samengevoegde geheel nogmaals door de create-validatie gehaald
 * (`resolveGameConfiguration`) zodat er nooit een room ontstaat met een
 * config die bij createRoom geweigerd zou zijn.
 *
 * @param {import('../context.mjs').Context} context
 * @param {{ roomId: string, patch: Record<string, unknown> }} params
 */
export async function updateConfig(context, { roomId, patch } = {}) {
  const room = await context.store.loadRoom(roomId);
  if (room === null) {
    return fail(CODES.GAME_NOT_FOUND);
  }
  if (room.phase !== 'LOBBY') {
    return fail(CODES.INVALID_PHASE);
  }

  const safePatch = {};
  for (const key of UPDATABLE_CONFIG_KEYS) {
    if (patch !== null && typeof patch === 'object' && key in patch) {
      safePatch[key] = patch[key];
    }
  }
  if (Object.keys(safePatch).length === 0) {
    return fail(CODES.INVALID_REQUEST);
  }

  let config;
  try {
    config = resolveGameConfiguration({ ...room.config, ...safePatch });
  } catch {
    return fail(CODES.INVALID_REQUEST);
  }

  await touchRoom(context, { ...room, config }, context.now());
  return succeed({ roomId, config });
}
