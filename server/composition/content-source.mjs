// server/composition/content-source.mjs
//
// De contentbron van de compositielaag: de bedrading tussen `shared/content/`
// (de pool) en `server/rules/question-selection.js` (de vraagopbouw). Sinds
// CT1 (HANDOFF-CT item CT-1) is de tijdelijke stub-pool hier weg; `getCountryPool()`
// levert de volledige, diep bevroren ContentEntry-array (230 landen) conform
// `docs/game-rules-plan/CONTENT-POOL-INTERFACE.md`.
//
// CONTRACT: dit bestand levert het raadpleeg-contract dat INT-A aan CT heeft
// voorgelegd in `docs/integration-plan/content-interface-request.md`
// (`contentVersion`, `rendererVersion`, `poolSize`, `buildQuestion`). De vorm
// van de pool is niet hier verzonnen en wordt hier ook niet aangepast: wijkt
// `shared/content/` af, dan verandert deze compositie mee — niet de pool.
//
// SCOPE: alleen `flags_mc` is gevuld (besluit 32: één gameType per match;
// besluit 35: quick-start default `flags_mc`). De andere vier Golf 1-vormen
// zitten wél in het contract maar geven `poolSize() === 0` en werpen bij
// `buildQuestion` — bewust zichtbaar leeg, niet stilzwijgend half gevuld.
// Voor `real_or_fake_flag` is dat bovendien afgedwongen door HANDOFF-CT item
// CT-3: de seed-deterministische `generateFlagSpec(seed)` bestaat nog niet, en
// hier wordt er niets voor verzonnen.
//
// GEEN DOMEINLOGICA HIER. De vraagopbouw zelf (target kiezen, afleiders uit
// hetzelfde continent, optievolgorde shufflen, uitsluiting toepassen) komt
// ongewijzigd uit `server/rules/question-selection.js` (eigenaar GR, al
// getest). `shared/content/index.test.mjs` bewijst dat de echte pool met
// `buildMatchQuestionPlan()` samenwerkt; dit bestand levert alleen de bedrading.
//
// GEEN TWEEDE MOEILIJKHEIDSMAPPING. `mapRoomDifficulty()` uit
// `shared/content/index.mjs` is de enige plek waar room-difficulty ("normal")
// naar een content-tier ("medium") vertaalt (CONTENT-POOL-INTERFACE.md
// §Gotcha 2). De eigen `normalizeDifficulty` die hier stond is met CT1
// verdwenen: twee mappings naast elkaar lopen gegarandeerd uit elkaar.

import {
  CONTENT_DIFFICULTIES,
  CONTENT_VERSION,
  getCountryPool,
  mapRoomDifficulty,
} from '../../shared/content/index.mjs';
import { generateFlagSpec } from '../../shared/content/flag-spec.mjs';
import { PLAYABLE_GAME_TYPES } from '../../shared/content/game-catalog.mjs';
import { buildMatchQuestionPlan } from '../rules/question-selection.js';
import { GOLF_1_GAME_TYPES } from '../data/types/game-types.js';

/**
 * @typedef {{ questionKey: string, publicQuestionPayload: object, correctAnswer: object, validOptionIds?: string[] }} BuiltQuestion
 * @typedef {{
 *   contentVersion: string,
 *   rendererVersion: string,
 *   poolSize: (gameType: string) => number,
 *   buildQuestion: (params: { gameType: string, exclude?: Iterable<string> }) => BuiltQuestion,
 * }} ContentSource
 */

/**
 * Doorgegeven uit `shared/content/index.mjs` zodat de samenstelwortel de
 * canonieke contentversie (besluit 21) op één plek kan lezen zonder een tweede
 * import naast deze module. Hier NIET als stille default gebruikt: zie
 * `createContentSource`.
 */
export { CONTENT_DIFFICULTIES, CONTENT_VERSION, mapRoomDifficulty };

/**
 * De gameTypes waarvoor deze bron een vraag kan bouwen.
 *
 * `real_or_fake_flag` erbij op 5 aug 2026 (PLAN-CONVERGENTIE stap 6): de
 * CT-3-blokkade was verlopen — `generateFlagSpec(seed)` bestaat sinds CT in
 * `shared/content/flag-spec.mjs` en is deterministisch per seed, wat
 * `question-selection.js` als enige eis stelt. Hij wordt hieronder ook
 * daadwerkelijk doorgegeven; zonder die injectie werpt de vraagselectie.
 *
 * `capitals_mc` en `odd_one_out` kunnen hier technisch bij, maar hebben nog
 * geen spelscherm — ze horen pas in `PLAYABLE_GAME_TYPES` (game-catalog.mjs)
 * als de hele keten er is, en tot die tijd voegt het niets toe om ze hier
 * open te zetten.
 */
const FILLED_GAME_TYPES = Object.freeze(['flags_mc', 'real_or_fake_flag']);

/**
 * SLOT OP DE DEUR (5 aug 2026, PLAN-CONVERGENTIE §A0). `game-catalog.mjs` zegt
 * welke gameTypes een host mag kiezen; dit bestand zegt welke er gebouwd
 * kunnen worden. Loopt dat uiteen, dan kiest een host een game waar
 * `buildQuestion` op werpt — en dat gebeurt in een timer-callback, dus de room
 * blijft stil in COUNTDOWN staan. Dat is precies wat er op 4 aug gebeurde.
 * Deze controle faalt bij module-load in plaats van bij de eerste ronde van
 * een echte spelavond.
 */
for (const gameType of PLAYABLE_GAME_TYPES) {
  if (!FILLED_GAME_TYPES.includes(gameType)) {
    throw new Error(
      `content-source: "${gameType}" staat in PLAYABLE_GAME_TYPES (shared/content/game-catalog.mjs) ` +
        `maar deze contentbron kan hem niet bouwen (FILLED_GAME_TYPES=${JSON.stringify(FILLED_GAME_TYPES)}). ` +
        `Vul eerst de contentbron, dan pas de catalogus.`,
    );
  }
}

/**
 * Bouwt de contentbron voor één room.
 *
 * `contentVersion` blijft verplicht en wordt NIET stilzwijgend op
 * `CONTENT_VERSION` gezet: besluit 21 maakt de waarde canoniek en
 * onveranderlijk op `Match`, dus de samenstelwortel moet hem bewust pinnen.
 *
 * `random` staat niet in het contract uit content-interface-request.md; het is
 * een injectiepunt zodat tests deterministisch kunnen zijn zonder
 * `Math.random` te monkeypatchen.
 *
 * @param {{
 *   contentVersion: string,
 *   language: string,
 *   difficulty: string,
 *   rendererVersion?: string,
 *   random?: () => number,
 * }} params
 * @returns {ContentSource}
 */
export function createContentSource({
  contentVersion,
  language,
  difficulty,
  rendererVersion = 'stub-renderer-0',
  random = Math.random,
} = {}) {
  if (typeof contentVersion !== 'string' || contentVersion.length === 0) {
    throw new TypeError(`createContentSource: contentVersion moet een niet-lege string zijn, kreeg: ${JSON.stringify(contentVersion)}`);
  }
  if (typeof language !== 'string' || language.length === 0) {
    throw new TypeError(`createContentSource: language moet een niet-lege string zijn, kreeg: ${JSON.stringify(language)}`);
  }
  // Werpt bij een onbekende waarde (RangeError uit shared/content) — stil
  // doormappen zou een pool opleveren waar nooit een entry in valt.
  const poolDifficulty = mapRoomDifficulty(difficulty);
  const pool = getCountryPool().filter((entry) => entry.difficulty === poolDifficulty);

  /**
   * Aantal beschikbare vragen voor deze gameType op de ingestelde
   * moeilijkheidsgraad. Voor `flags_mc` is dat één vraag per land (de
   * questionKey is `flags:{iso2}`). Niet-gevulde gameTypes geven 0 — de
   * aanroeper kan daaraan zien dat deze bron die vorm niet levert.
   * @param {string} gameType
   * @returns {number}
   */
  function poolSize(gameType) {
    if (!GOLF_1_GAME_TYPES.includes(gameType)) {
      throw new RangeError(`poolSize: onbekende gameType ${JSON.stringify(gameType)}`);
    }
    return FILLED_GAME_TYPES.includes(gameType) ? pool.length : 0;
  }
  // Noot bij `real_or_fake_flag`: het getal hierboven telt de échte vlaggen op
  // deze moeilijkheidsgraad. De gegenereerde (nep)vlaggen zijn per seed
  // onbeperkt, dus dit is een ondergrens — precies wat een aanroeper wil
  // weten ("kan deze bron deze vorm leveren, en hoeveel unieke echte vragen
  // zitten erin"), geen exacte telling van het vraagunivers.

  /**
   * Bouwt één vraag en respecteert `exclude` (de questionKeys die deze match —
   * en bij een rematch de vorige match — al heeft gebruikt), zodat er geen
   * dubbele vraag binnen een match komt.
   *
   * `correctAnswer` komt GESCHEIDEN terug en wordt nooit in
   * `publicQuestionPayload` gemengd (besluit 20). De aanroeper zet hem
   * rechtstreeks in het Round-document; hij mag nooit in `round:started` of in
   * een snapshot van een actieve ronde belanden — `toActiveRoundSnapshot()`
   * in server/data/types/round.js is daarvoor het vangnet.
   *
   * @param {{ gameType: string, exclude?: Iterable<string> }} params
   * @returns {BuiltQuestion}
   */
  function buildQuestion({ gameType, exclude = [] } = {}) {
    if (!FILLED_GAME_TYPES.includes(gameType)) {
      throw new RangeError(
        `buildQuestion: deze contentbron vult alleen ${JSON.stringify(FILLED_GAME_TYPES)} ` +
          `(besluit 32/35; real_or_fake_flag wacht op generateFlagSpec, HANDOFF-CT item CT-3), ` +
          `gevraagd: ${JSON.stringify(gameType)}.`,
      );
    }

    const excluded = [...exclude];
    // question-selection.js's `previousMatchQuestionKeys` is precies het
    // uitsluitingsmechanisme dat GR al heeft getest, inclusief het loslaten
    // van de uitsluiting wanneer de pool te klein wordt. Één vraag per keer:
    // totalRounds = 1.
    const [question] = buildMatchQuestionPlan({
      pool,
      gameType,
      totalRounds: 1,
      difficulty: poolDifficulty,
      metricMode: 'mixed',
      previousMatchQuestionKeys: excluded,
      random,
      // Verplicht voor `real_or_fake_flag` (question-selection.js werpt
      // zonder): de seed-deterministische generator uit shared/content. Altijd
      // meegeven, ook voor andere types — de vraagselectie negeert 'm daar.
      generateFlagSpec,
    });

    // ADDITIEF T.O.V. content-interface-request.md — `validOptionIds` staat
    // niet in het voorgestelde contract, maar `assertRoundShape()` in
    // server/data/types/round.js EIST het voor flags_mc/capitals_mc. Zonder
    // dit veld kan de compositie geen geldig Round-document bouwen. Zie de
    // handoff-notitie: het contractvoorstel aan CT moet worden aangevuld met
    // `validOptionIds` (flags_mc, capitals_mc) en `resultDetails`
    // (higher_lower, odd_one_out). Hier niet omheen gebouwd — gewoon
    // doorgegeven wat GR's module al oplevert.
    const built = {
      questionKey: question.questionKey,
      publicQuestionPayload: question.publicQuestionPayload,
      correctAnswer: question.correctAnswer,
    };
    if (question.validOptionIds !== undefined) {
      built.validOptionIds = question.validOptionIds;
    }
    if (question.resultDetails !== undefined) {
      built.resultDetails = question.resultDetails;
    }
    return built;
  }

  return Object.freeze({
    // Canoniek en onveranderlijk per match (besluit 21). De compositie leest
    // ze hier en schrijft ze in het Match-document; roundpayloads dragen ze
    // mee voor clients.
    contentVersion,
    rendererVersion,
    poolSize,
    buildQuestion,
  });
}
