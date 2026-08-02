// server/composition/content-source.mjs
//
// ═══════════════════════════════════════════════════════════════════════════
// TIJDELIJK tot CT1 — vervangen zodra `shared/content/` bestaat.
// ═══════════════════════════════════════════════════════════════════════════
//
// REDEN: pijl 6 van de keten (vraagselectie) is de enige volledig geblokkeerde
// pijl — `shared/content/` is nog in aanbouw bij de CT-agent. Zonder een
// contentbron kan de compositie geen Round bouwen en staat de hele keten stil.
//
// CONTRACT: dit bestand implementeert EXACT het raadpleeg-contract dat INT-A
// aan CT heeft voorgelegd in `docs/integration-plan/content-interface-request.md`.
// Het interface is niet hier verzonnen; als CT een afwijkende vorm kiest,
// verandert dit bestand mee — niet andersom. De omschakeling is dan één import.
//
// SCOPE: alleen `flags_mc` is gevuld (besluit 32: één gameType per match;
// besluit 35: quick-start default `flags_mc`). De andere vier Golf 1-vormen
// zitten wél in het contract maar geven `poolSize() === 0` en werpen bij
// `buildQuestion` — bewust zichtbaar leeg, niet stilzwijgend half gevuld.
//
// GEEN DOMEINLOGICA HIER. De vraagopbouw zelf (target kiezen, afleiders uit
// hetzelfde continent, optievolgorde shufflen, uitsluiting toepassen) komt
// ongewijzigd uit `server/rules/question-selection.js` (eigenaar GR, al
// getest). Dit bestand levert alleen de pool en de bedrading. Daarmee is de
// stub ook gegarandeerd vormcompatibel met wat de echte rules-laag oplevert.
//
// De pool is een kleine, vaste lijst — letterlijk overgenomen uit
// `data/countries.js` (iso2, difficulty, namen) en `data/country-facts.js`
// (continent, hoofdstad, population/area/gdp). Die twee bestanden zijn
// browser-globals (`const COUNTRIES = …`, geen exports), dus rechtstreeks
// importeren kan niet zonder fs+eval; een vaste, synchrone lijst houdt deze
// module puur. De entries volgen de `ContentEntry`-vorm uit
// `docs/game-rules-plan/CONTENT-POOL-INTERFACE.md` (leidend contract van GR),
// inclusief alle nullable velden expliciet. De inhoud doet er niet toe, de
// vorm wel.

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

/** De enige gevulde gameType in deze stub (besluit 32 + 35). */
const FILLED_GAME_TYPES = Object.freeze(['flags_mc']);

/**
 * `GameConfiguration.difficulty` gebruikt "normal" (DATA-MODEL.md's voorbeeld,
 * besluit 35: "moeilijkheid normaal"), terwijl de contentschaal
 * easy/medium/hard/extreme is. `docs/game-rules-plan/CONTENT-POOL-INTERFACE.md`
 * §Gotcha 2 wijst die vertaling expliciet toe aan wie roomconfig naar een
 * `buildMatchQuestionPlan()`-aanroep omzet — dat is deze laag.
 *
 * KEUZE binnen die opdracht: normal/normaal → medium. Verhuist mee naar CT1
 * zodra `shared/content/` de vertaling overneemt.
 */
const DIFFICULTY_ALIASES = Object.freeze({
  normal: 'medium',
  normaal: 'medium',
  makkelijk: 'easy',
  moeilijk: 'hard',
});

/**
 * Vaste stub-pool: 32 echte landen uit `data/`, in de `ContentEntry`-vorm uit
 * `docs/game-rules-plan/CONTENT-POOL-INTERFACE.md`. Voldoende gespreid over
 * continenten dat de afleiderregel van `flags_mc` (drie afleiders, bij
 * voorkeur van hetzelfde continent) op elke moeilijkheidsgraad kan slagen.
 * @type {ReadonlyArray<{
 *   iso2: string, difficulty: string, continent: string,
 *   name: Record<string,string>, capital: Record<string,string>|null,
 *   population: number|null, area: number|null, gdp: number|null,
 * }>}
 */
export const STUB_COUNTRY_POOL = Object.freeze([
  { iso2: 'fr', difficulty: 'easy', continent: 'Europe',
    name: { nl: 'Frankrijk', en: 'France', es: 'Francia' },
    capital: { nl: 'Parijs', en: 'Paris', es: 'París' },
    population: 68000000, area: 551695, gdp: 3130 },
  { iso2: 'de', difficulty: 'easy', continent: 'Europe',
    name: { nl: 'Duitsland', en: 'Germany', es: 'Alemania' },
    capital: { nl: 'Berlijn', en: 'Berlin', es: 'Berlín' },
    population: 84000000, area: 357588, gdp: 4460 },
  { iso2: 'it', difficulty: 'easy', continent: 'Europe',
    name: { nl: 'Italië', en: 'Italy', es: 'Italia' },
    capital: { nl: 'Rome', en: 'Rome', es: 'Roma' },
    population: 59000000, area: 301340, gdp: 2250 },
  { iso2: 'es', difficulty: 'easy', continent: 'Europe',
    name: { nl: 'Spanje', en: 'Spain', es: 'España' },
    capital: { nl: 'Madrid', en: 'Madrid', es: 'Madrid' },
    population: 48000000, area: 505990, gdp: 1580 },
  { iso2: 'nl', difficulty: 'easy', continent: 'Europe',
    name: { nl: 'Nederland', en: 'Netherlands', es: 'Países Bajos' },
    capital: { nl: 'Amsterdam', en: 'Amsterdam', es: 'Ámsterdam' },
    population: 18000000, area: 41850, gdp: 1120 },
  { iso2: 'gb', difficulty: 'easy', continent: 'Europe',
    name: { nl: 'Verenigd Koninkrijk', en: 'United Kingdom', es: 'Reino Unido' },
    capital: { nl: 'Londen', en: 'London', es: 'Londres' },
    population: 67000000, area: 243610, gdp: 3340 },
  { iso2: 'us', difficulty: 'easy', continent: 'North America',
    name: { nl: 'Verenigde Staten', en: 'United States', es: 'Estados Unidos' },
    capital: { nl: 'Washington', en: 'Washington', es: 'Washington' },
    population: 335000000, area: 9834000, gdp: 27360 },
  { iso2: 'br', difficulty: 'easy', continent: 'South America',
    name: { nl: 'Brazilië', en: 'Brazil', es: 'Brasil' },
    capital: { nl: 'Brasilia', en: 'Brasília', es: 'Brasilia' },
    population: 216000000, area: 8516000, gdp: 2170 },
  { iso2: 'jp', difficulty: 'easy', continent: 'Asia',
    name: { nl: 'Japan', en: 'Japan', es: 'Japón' },
    capital: { nl: 'Tokio', en: 'Tokyo', es: 'Tokio' },
    population: 124000000, area: 377975, gdp: 4210 },
  { iso2: 'cn', difficulty: 'easy', continent: 'Asia',
    name: { nl: 'China', en: 'China', es: 'China' },
    capital: { nl: 'Peking', en: 'Beijing', es: 'Pekín' },
    population: 1410000000, area: 9597000, gdp: 17790 },
  { iso2: 'au', difficulty: 'easy', continent: 'Oceania',
    name: { nl: 'Australië', en: 'Australia', es: 'Australia' },
    capital: { nl: 'Canberra', en: 'Canberra', es: 'Canberra' },
    population: 26000000, area: 7692000, gdp: 1690 },
  { iso2: 'za', difficulty: 'easy', continent: 'Africa',
    name: { nl: 'Zuid-Afrika', en: 'South Africa', es: 'Sudáfrica' },
    capital: { nl: 'Pretoria', en: 'Pretoria', es: 'Pretoria' },
    population: 60000000, area: 1221000, gdp: 380 },
  { iso2: 'pl', difficulty: 'medium', continent: 'Europe',
    name: { nl: 'Polen', en: 'Poland', es: 'Polonia' },
    capital: { nl: 'Warschau', en: 'Warsaw', es: 'Varsovia' },
    population: 38000000, area: 312696, gdp: 810 },
  { iso2: 'cz', difficulty: 'medium', continent: 'Europe',
    name: { nl: 'Tsjechië', en: 'Czech Republic', es: 'República Checa' },
    capital: { nl: 'Praag', en: 'Prague', es: 'Praga' },
    population: 10700000, area: 78867, gdp: 340 },
  { iso2: 'hu', difficulty: 'medium', continent: 'Europe',
    name: { nl: 'Hongarije', en: 'Hungary', es: 'Hungría' },
    capital: { nl: 'Boedapest', en: 'Budapest', es: 'Budapest' },
    population: 9600000, area: 93028, gdp: 210 },
  { iso2: 'ro', difficulty: 'medium', continent: 'Europe',
    name: { nl: 'Roemenië', en: 'Romania', es: 'Rumanía' },
    capital: { nl: 'Boekarest', en: 'Bucharest', es: 'Bucarest' },
    population: 19000000, area: 238398, gdp: 350 },
  { iso2: 'ua', difficulty: 'medium', continent: 'Europe',
    name: { nl: 'Oekraïne', en: 'Ukraine', es: 'Ucrania' },
    capital: { nl: 'Kiev', en: 'Kyiv', es: 'Kiev' },
    population: 38000000, area: 603500, gdp: 180 },
  { iso2: 'hr', difficulty: 'medium', continent: 'Europe',
    name: { nl: 'Kroatië', en: 'Croatia', es: 'Croacia' },
    capital: { nl: 'Zagreb', en: 'Zagreb', es: 'Zagreb' },
    population: 3800000, area: 56594, gdp: 80 },
  { iso2: 'rs', difficulty: 'medium', continent: 'Europe',
    name: { nl: 'Servië', en: 'Serbia', es: 'Serbia' },
    capital: { nl: 'Belgrado', en: 'Belgrade', es: 'Belgrado' },
    population: 6600000, area: 88361, gdp: 75 },
  { iso2: 'ie', difficulty: 'medium', continent: 'Europe',
    name: { nl: 'Ierland', en: 'Ireland', es: 'Irlanda' },
    capital: { nl: 'Dublin', en: 'Dublin', es: 'Dublín' },
    population: 5200000, area: 70273, gdp: 550 },
  { iso2: 'id', difficulty: 'medium', continent: 'Asia',
    name: { nl: 'Indonesië', en: 'Indonesia', es: 'Indonesia' },
    capital: { nl: 'Jakarta', en: 'Jakarta', es: 'Yakarta' },
    population: 278000000, area: 1905000, gdp: 1420 },
  { iso2: 'th', difficulty: 'medium', continent: 'Asia',
    name: { nl: 'Thailand', en: 'Thailand', es: 'Tailandia' },
    capital: { nl: 'Bangkok', en: 'Bangkok', es: 'Bangkok' },
    population: 72000000, area: 513120, gdp: 510 },
  { iso2: 'vn', difficulty: 'medium', continent: 'Asia',
    name: { nl: 'Vietnam', en: 'Vietnam', es: 'Vietnam' },
    capital: { nl: 'Hanoi', en: 'Hanoi', es: 'Hanói' },
    population: 99000000, area: 331212, gdp: 430 },
  { iso2: 'my', difficulty: 'medium', continent: 'Asia',
    name: { nl: 'Maleisië', en: 'Malaysia', es: 'Malasia' },
    capital: { nl: 'Kuala Lumpur', en: 'Kuala Lumpur', es: 'Kuala Lumpur' },
    population: 34000000, area: 330803, gdp: 400 },
  { iso2: 'ph', difficulty: 'medium', continent: 'Asia',
    name: { nl: 'Filipijnen', en: 'Philippines', es: 'Filipinas' },
    capital: { nl: 'Manila', en: 'Manila', es: 'Manila' },
    population: 117000000, area: 300000, gdp: 440 },
  { iso2: 'il', difficulty: 'medium', continent: 'Asia',
    name: { nl: 'Israël', en: 'Israel', es: 'Israel' },
    capital: { nl: 'Jeruzalem', en: 'Jerusalem', es: 'Jerusalén' },
    population: 9700000, area: 22072, gdp: 510 },
  { iso2: 'ng', difficulty: 'medium', continent: 'Africa',
    name: { nl: 'Nigeria', en: 'Nigeria', es: 'Nigeria' },
    capital: { nl: 'Abuja', en: 'Abuja', es: 'Abuya' },
    population: 223000000, area: 923768, gdp: 390 },
  { iso2: 'ke', difficulty: 'medium', continent: 'Africa',
    name: { nl: 'Kenia', en: 'Kenya', es: 'Kenia' },
    capital: { nl: 'Nairobi', en: 'Nairobi', es: 'Nairobi' },
    population: 55000000, area: 580367, gdp: 110 },
  { iso2: 'ma', difficulty: 'medium', continent: 'Africa',
    name: { nl: 'Marokko', en: 'Morocco', es: 'Marruecos' },
    capital: { nl: 'Rabat', en: 'Rabat', es: 'Rabat' },
    population: 37000000, area: 446550, gdp: 140 },
  { iso2: 'co', difficulty: 'medium', continent: 'South America',
    name: { nl: 'Colombia', en: 'Colombia', es: 'Colombia' },
    capital: { nl: 'Bogota', en: 'Bogotá', es: 'Bogotá' },
    population: 52000000, area: 1142000, gdp: 360 },
  { iso2: 'cl', difficulty: 'medium', continent: 'South America',
    name: { nl: 'Chili', en: 'Chile', es: 'Chile' },
    capital: { nl: 'Santiago', en: 'Santiago', es: 'Santiago' },
    population: 20000000, area: 756102, gdp: 340 },
  { iso2: 'pe', difficulty: 'medium', continent: 'South America',
    name: { nl: 'Peru', en: 'Peru', es: 'Perú' },
    capital: { nl: 'Lima', en: 'Lima', es: 'Lima' },
    population: 34000000, area: 1285000, gdp: 270 },
]);

/**
 * @param {string} difficulty
 * @returns {string} de moeilijkheidsgraad zoals question-selection.js hem kent
 */
export function normalizeDifficulty(difficulty) {
  const key = String(difficulty).toLowerCase();
  return DIFFICULTY_ALIASES[key] ?? key;
}

/**
 * Bouwt de tijdelijke contentbron.
 *
 * `random` staat NIET in het contract uit content-interface-request.md; het is
 * een stub-lokale toevoeging zodat tests deterministisch kunnen zijn zonder
 * `Math.random` te monkeypatchen. Verdwijnt met de stub.
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
  const poolDifficulty = normalizeDifficulty(difficulty);
  const pool = STUB_COUNTRY_POOL.filter((entry) => entry.difficulty === poolDifficulty);

  /**
   * Aantal beschikbare vragen voor deze gameType op de ingestelde
   * moeilijkheidsgraad. Voor `flags_mc` is dat één vraag per land (de
   * questionKey is `flags:{iso2}`). Niet-gevulde gameTypes geven 0 — de
   * aanroeper kan daaraan zien dat de stub die vorm niet levert.
   * @param {string} gameType
   * @returns {number}
   */
  function poolSize(gameType) {
    if (!GOLF_1_GAME_TYPES.includes(gameType)) {
      throw new RangeError(`poolSize: onbekende gameType ${JSON.stringify(gameType)}`);
    }
    return FILLED_GAME_TYPES.includes(gameType) ? pool.length : 0;
  }

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
        `buildQuestion: de tijdelijke stub-pool vult alleen ${JSON.stringify(FILLED_GAME_TYPES)} ` +
          `(besluit 32/35), gevraagd: ${JSON.stringify(gameType)}. Zie CT1 / shared/content/.`,
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
