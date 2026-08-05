'use strict';

// Vraagselectie en rematch-exclusie voor quizrondes. Zie
// docs/multiplayer/GAME-RULES.md ("Vraagselectie", "Spelvormen") en
// docs/game-rules-plan/prompts/GR4-question-selection.md voor de volledige
// spec.
//
// Geen enkele functie hier raadpleegt data/, Redis, sockets of de klok.
// Willekeur komt altijd binnen als een `random: () => number`-parameter
// (contract gelijk aan Math.random: [0, 1)) en loopt intern altijd via
// nextRandom(), die het contract afdwingt.
//
// Kernprincipe: kandidaten worden eerst volledig en zuiver berekend (puur,
// geen willekeur), pas daarna kiest `random` een index uit een al-geldige
// lijst. De enige uitzondering is odd_one_out's botsingscontrole tegen
// al-gebruikte sleutels binnen de match, begrensd tot 50 pogingen.

const VALID_GAME_TYPES = ['flags_mc', 'capitals_mc', 'real_or_fake_flag', 'higher_lower', 'odd_one_out'];
const VALID_DIFFICULTIES = ['easy', 'medium', 'hard', 'extreme'];
const VALID_METRICS = ['population', 'area', 'gdp'];
const KEY_PREFIXES = {
  flags_mc: 'flags:',
  capitals_mc: 'capitals:',
  real_or_fake_flag: 'rof:',
  higher_lower: 'higher_lower:',
  odd_one_out: 'odd_one_out:',
};
const MAX_COLLISION_ATTEMPTS = 50;

function nextRandom(random) {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError(`random() must return a finite number in [0, 1), got: ${value}`);
  }
  return value;
}

/** @returns {Array<T>} een nieuwe, geshuffelde kopie van array. */
function shuffle(array, random) {
  const result = array.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom(random) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** @returns {number[]} `count` unieke indices in [0, length), begrensd. */
function pickUniqueIndices(random, length, count) {
  if (count > length) {
    throw new RangeError(`Cannot pick ${count} unique indices from a pool of ${length}`);
  }
  const indices = Array.from({ length }, (_, i) => i);
  return shuffle(indices, random).slice(0, count);
}

function generateSeed(random) {
  let hex = '';
  for (let i = 0; i < 8; i++) {
    hex += Math.floor(nextRandom(random) * 16).toString(16);
  }
  return `fx_${hex}`;
}

function pairKey(isoA, isoB) {
  return [isoA, isoB].sort().join('-');
}

/**
 * @returns {ContentEntry[]} pool gefilterd op difficulty (en optioneel
 * geldige hoofdstad). `== null` (niet `===`) dekt zowel `capital: null` als
 * een ontbrekende `capital`-key — een contentbron die de key weglaat in
 * plaats van expliciet op `null` te zetten, mag capitals_mc niet stilzwijgend
 * als geschikt beschouwen.
 */
function buildCandidatePool(pool, difficulty, requireCapital) {
  return pool.filter((e) => e.difficulty === difficulty && (!requireCapital || e.capital != null));
}

/** @returns {Array<[ContentEntry, ContentEntry]>} alle paren met ongelijke, niet-null metriekwaarden. */
function buildHigherLowerCandidatePairs(pool, difficulty, metric) {
  const difficultyPool = buildCandidatePool(pool, difficulty, false);
  const pairs = [];
  for (let i = 0; i < difficultyPool.length; i++) {
    for (let j = i + 1; j < difficultyPool.length; j++) {
      const a = difficultyPool[i];
      const b = difficultyPool[j];
      if (typeof a[metric] === 'number' && typeof b[metric] === 'number' && a[metric] !== b[metric]) {
        pairs.push([a, b]);
      }
    }
  }
  return pairs;
}

/**
 * Balanceert real/fake wanneer de aanroeper ÉÉN vraag tegelijk bouwt.
 *
 * `buildRealOrFakeAssignment` verdeelt half-om-half over een hele matchplan.
 * De compositielaag bouwt echter per ronde (totalRounds: 1) omdat ze de
 * uitsluitingslijst per ronde bijwerkt — en dan valt die verdeling terug op een
 * muntworp per vraag. Over tien rondes kan dat negen keer nep opleveren; een
 * speler merkt dat onmiddellijk ("het was de hele avond nep").
 *
 * Daarom wordt bij een plan van één vraag de balans afgeleid uit wat er al
 * gebruikt is: een gegenereerde vlag heeft een `rof:fx_`-sleutel, een echte
 * `rof:{iso2}`. Staat de teller gelijk, dan beslist het toeval.
 *
 * De uitsluitingslijst kan ook de vórige match bevatten (rematch); die was op
 * dezelfde manier gebalanceerd, dus dat verschuift hooguit de eerste ronde.
 *
 * @param {Set<string>} excludedKeys
 * @param {() => number} random
 * @returns {boolean} true = een echte vlag
 */
function nextRealOrFakeIsReal(excludedKeys, random) {
  let echt = 0;
  let nep = 0;
  for (const key of excludedKeys) {
    if (!key.startsWith('rof:')) continue;
    if (key.startsWith('rof:fx_')) nep += 1;
    else echt += 1;
  }
  if (echt > nep) return false;
  if (nep > echt) return true;
  return nextRandom(random) < 0.5;
}

/** @returns {boolean[]} lengte `count`, hooguit 1 verschil real/fake, geshuffled. */
function buildRealOrFakeAssignment(count, random) {
  const half = Math.floor(count / 2);
  const extra = count % 2;
  const realGetsExtra = extra === 1 && nextRandom(random) < 0.5;
  const realCount = half + (realGetsExtra ? 1 : 0);
  const fakeCount = count - realCount;
  const assignment = [
    ...Array.from({ length: realCount }, () => true),
    ...Array.from({ length: fakeCount }, () => false),
  ];
  return shuffle(assignment, random);
}

function selectFlagsMcQuestion(pool, difficulty, excludedKeys, random) {
  const difficultyPool = buildCandidatePool(pool, difficulty, false);
  const targetCandidates = difficultyPool.filter((e) => !excludedKeys.has(`flags:${e.iso2}`));
  if (targetCandidates.length === 0) {
    throw new RangeError(`No available flags_mc target for difficulty "${difficulty}"`);
  }
  const target = targetCandidates[pickUniqueIndices(random, targetCandidates.length, 1)[0]];

  const sameContinent = difficultyPool.filter((e) => e.iso2 !== target.iso2 && e.continent === target.continent);
  const rest = difficultyPool.filter((e) => e.iso2 !== target.iso2 && e.continent !== target.continent);

  let distractors;
  if (sameContinent.length >= 3) {
    distractors = pickUniqueIndices(random, sameContinent.length, 3).map((i) => sameContinent[i]);
  } else {
    const remainingNeeded = 3 - sameContinent.length;
    if (rest.length < remainingNeeded) {
      throw new RangeError(`Not enough distinct countries to build flags_mc distractors for difficulty "${difficulty}"`);
    }
    distractors = [...sameContinent, ...pickUniqueIndices(random, rest.length, remainingNeeded).map((i) => rest[i])];
  }

  const optionIso2s = shuffle([target, ...distractors], random).map((e) => e.iso2);
  return {
    gameType: 'flags_mc',
    questionKey: `flags:${target.iso2}`,
    publicQuestionPayload: { targetIso2: target.iso2, optionIso2s },
    correctAnswer: { optionId: target.iso2 },
    validOptionIds: optionIso2s,
  };
}

function selectCapitalsMcQuestion(pool, difficulty, excludedKeys, random) {
  const difficultyPool = buildCandidatePool(pool, difficulty, true);
  const targetCandidates = difficultyPool.filter((e) => !excludedKeys.has(`capitals:${e.iso2}`));
  if (targetCandidates.length === 0) {
    throw new RangeError(`No available capitals_mc target for difficulty "${difficulty}"`);
  }
  const target = targetCandidates[pickUniqueIndices(random, targetCandidates.length, 1)[0]];

  const rest = difficultyPool.filter((e) => e.iso2 !== target.iso2);
  if (rest.length < 3) {
    throw new RangeError(`Not enough countries with a valid capital to build capitals_mc distractors for difficulty "${difficulty}"`);
  }
  const distractors = pickUniqueIndices(random, rest.length, 3).map((i) => rest[i]);

  const optionIso2s = shuffle([target, ...distractors], random).map((e) => e.iso2);
  return {
    gameType: 'capitals_mc',
    questionKey: `capitals:${target.iso2}`,
    publicQuestionPayload: { targetIso2: target.iso2, optionIso2s },
    correctAnswer: { optionId: target.iso2 },
    validOptionIds: optionIso2s,
  };
}

function selectRealOrFakeFlagQuestion(pool, difficulty, isReal, excludedKeys, random, generateFlagSpec) {
  if (isReal) {
    const candidates = buildCandidatePool(pool, difficulty, false).filter((e) => !excludedKeys.has(`rof:${e.iso2}`));
    if (candidates.length === 0) {
      throw new RangeError(`No available real_or_fake_flag (real) target for difficulty "${difficulty}"`);
    }
    const target = candidates[pickUniqueIndices(random, candidates.length, 1)[0]];
    return {
      gameType: 'real_or_fake_flag',
      questionKey: `rof:${target.iso2}`,
      publicQuestionPayload: { kind: 'real', iso2: target.iso2 },
      correctAnswer: { choice: 'real' },
    };
  }

  for (let attempt = 0; attempt < MAX_COLLISION_ATTEMPTS; attempt++) {
    const seed = generateSeed(random);
    const questionKey = `rof:${seed}`;
    if (excludedKeys.has(questionKey)) {
      continue;
    }
    const { rendererVersion, ...spec } = generateFlagSpec(seed);
    return {
      gameType: 'real_or_fake_flag',
      questionKey,
      publicQuestionPayload: { kind: 'generated', seed, rendererVersion, spec },
      correctAnswer: { choice: 'fake' },
    };
  }
  throw new RangeError('Could not generate a unique seed for a generated real_or_fake_flag round');
}

function selectHigherLowerQuestion(pool, difficulty, metric, excludedKeys, random) {
  const pairs = buildHigherLowerCandidatePairs(pool, difficulty, metric).filter(
    ([a, b]) => !excludedKeys.has(`higher_lower:${metric}:${pairKey(a.iso2, b.iso2)}`)
  );
  if (pairs.length === 0) {
    throw new RangeError(`No available higher_lower pair for difficulty "${difficulty}", metric "${metric}"`);
  }
  const [a, b] = pairs[pickUniqueIndices(random, pairs.length, 1)[0]];
  const swap = nextRandom(random) < 0.5;
  const first = swap ? b : a;
  const second = swap ? a : b;
  const correctSide = first[metric] > second[metric] ? 0 : 1;

  return {
    gameType: 'higher_lower',
    questionKey: `higher_lower:${metric}:${pairKey(a.iso2, b.iso2)}`,
    publicQuestionPayload: {
      metric,
      sides: [
        { side: 0, iso2: first.iso2 },
        { side: 1, iso2: second.iso2 },
      ],
    },
    correctAnswer: { side: correctSide },
    resultDetails: {
      values: [
        { side: 0, value: first[metric] },
        { side: 1, value: second[metric] },
      ],
    },
  };
}

/**
 * De afwijklogica's van "Welke hoort er niet bij" (punt 11, producteigenaar
 * 5 aug 2026 — DOELBEELD-v2 §6.5).
 *
 * `continent` bestond al. `fake_among_real` en `real_among_fake` zijn erbij
 * gekomen omdat het materiaal er al lag: `generateFlagSpec(seed)` levert
 * dezelfde deterministische nepvlaggen als Echt of nep.
 *
 * NOG NIET GEBOUWD: "ander kleurpatroon" voor ÉCHTE vlaggen (de pool draagt
 * geen pattern/palette per land) en "andere vorm of symboliek" (nieuwe
 * contentannotatie per vlag). Zie §6.5 — die twee zijn een orde duurder en
 * wachten tot deze drie te weinig variatie blijken te geven.
 */
const ODD_ONE_OUT_LOGICS = Object.freeze(['continent', 'fake_among_real', 'real_among_fake']);

/**
 * Eén nepvlag tussen drie echte, of andersom. De uitlegregel kan daarna
 * letterlijk zeggen wat er anders was — precies wat punt 11 eist ("na het
 * antwoord moet kort worden uitgelegd waarom").
 *
 * De vier kaarten dragen dezelfde vorm als bij de continentlogica, plus een
 * optionele `spec`: een kaart mét spec is een gegenereerde vlag, een kaart
 * zonder is een echte. De client hoeft de logica niet te kennen.
 */
function selectOddOneOutFlagAuthenticity(pool, difficulty, oddIsFake, excludedKeys, random, generateFlagSpec) {
  const difficultyPool = buildCandidatePool(pool, difficulty, false);
  if (difficultyPool.length < (oddIsFake ? 3 : 1)) {
    throw new RangeError(`Not enough countries for an odd_one_out authenticity round at difficulty "${difficulty}"`);
  }

  for (let attempt = 0; attempt < MAX_COLLISION_ATTEMPTS; attempt++) {
    const seed = generateSeed(random);
    const questionKey = `odd_one_out:${oddIsFake ? 'fake' : 'real'}:${seed}`;
    if (excludedKeys.has(questionKey)) {
      continue;
    }

    // De echte landen: drie als het buitenbeentje nep is, anders één.
    const echteAantal = oddIsFake ? 3 : 1;
    const echte = pickUniqueIndices(random, difficultyPool.length, echteAantal).map((i) => difficultyPool[i]);
    const { rendererVersion, ...spec } = generateFlagSpec(seed);

    // Bij `real_among_fake` zijn er drie nepvlaggen nodig; ze moeten van
    // elkaar verschillen, dus elk een eigen seed.
    const nepSpecs = oddIsFake
      ? [{ seed, spec }]
      : [0, 1, 2].map((offset) => {
        const eigenSeed = `${seed}_${offset}`;
        const { rendererVersion: _weg, ...eigenSpec } = generateFlagSpec(eigenSeed);
        return { seed: eigenSeed, spec: eigenSpec };
      });

    const kaarten = shuffle(
      [
        ...echte.map((entry) => ({ iso2: entry.iso2 })),
        ...nepSpecs.map((nep) => ({ seed: nep.seed, spec: nep.spec })),
      ],
      random,
    ).map((kaart, index) => ({ cardIndex: index, ...kaart }));

    const oddIndex = kaarten.findIndex((kaart) => (oddIsFake ? kaart.spec !== undefined : kaart.spec === undefined));
    return {
      gameType: 'odd_one_out',
      questionKey,
      publicQuestionPayload: { cards: kaarten },
      correctAnswer: { cardIndex: oddIndex },
      resultDetails: { logic: oddIsFake ? 'fake_among_real' : 'real_among_fake' },
    };
  }
  throw new RangeError('Could not generate a unique seed for an odd_one_out authenticity round');
}

function selectOddOneOutQuestion(pool, difficulty, excludedKeys, random) {
  const difficultyPool = buildCandidatePool(pool, difficulty, false);
  const byContinent = new Map();
  for (const entry of difficultyPool) {
    if (!byContinent.has(entry.continent)) {
      byContinent.set(entry.continent, []);
    }
    byContinent.get(entry.continent).push(entry);
  }

  const majorityCandidates = [...byContinent.entries()].filter(
    ([, entries]) => entries.length >= 3 && difficultyPool.length - entries.length >= 1
  );
  if (majorityCandidates.length === 0) {
    throw new RangeError(`No continent has enough countries to build an odd_one_out round for difficulty "${difficulty}"`);
  }

  for (let attempt = 0; attempt < MAX_COLLISION_ATTEMPTS; attempt++) {
    const [majorityContinent, majorityPool] = majorityCandidates[pickUniqueIndices(random, majorityCandidates.length, 1)[0]];
    const minorityPool = difficultyPool.filter((e) => e.continent !== majorityContinent);
    const majorityPicks = pickUniqueIndices(random, majorityPool.length, 3).map((i) => majorityPool[i]);
    const minorityPick = minorityPool[pickUniqueIndices(random, minorityPool.length, 1)[0]];

    const cards = shuffle([...majorityPicks, minorityPick], random);
    const questionKey = `odd_one_out:${cards.map((c) => c.iso2).sort().join('-')}`;
    if (excludedKeys.has(questionKey)) {
      continue;
    }

    const cardIndex = cards.findIndex((c) => c.iso2 === minorityPick.iso2);
    return {
      gameType: 'odd_one_out',
      questionKey,
      publicQuestionPayload: {
        cards: cards.map((c, i) => ({ cardIndex: i, iso2: c.iso2 })),
      },
      correctAnswer: { cardIndex },
      resultDetails: { logic: 'continent', majorityContinent, minorityContinent: minorityPick.continent },
    };
  }
  throw new RangeError('Could not find a non-repeating odd_one_out combination within the attempt limit');
}

function assertValidPool(pool) {
  const seen = new Set();
  for (const entry of pool) {
    if (seen.has(entry.iso2)) {
      throw new RangeError(`Duplicate iso2 in pool: ${entry.iso2}`);
    }
    seen.add(entry.iso2);
  }
}

function selectRoundsForType(pool, difficulty, gameType, totalRounds, metricMode, excludedKeys, random, generateFlagSpec) {
  const used = new Set();
  const results = [];
  const isRealAssignment = gameType === 'real_or_fake_flag' ? buildRealOrFakeAssignment(totalRounds, random) : null;

  for (let i = 0; i < totalRounds; i++) {
    const combinedExcluded = new Set([...excludedKeys, ...used]);
    let question;
    switch (gameType) {
      case 'flags_mc':
        question = selectFlagsMcQuestion(pool, difficulty, combinedExcluded, random);
        break;
      case 'capitals_mc':
        question = selectCapitalsMcQuestion(pool, difficulty, combinedExcluded, random);
        break;
      case 'real_or_fake_flag': {
        // Plan van één vraag (de compositie bouwt per ronde): balans afleiden
        // uit de al gebruikte sleutels in plaats van uit een verdeling over
        // een plan dat hier maar één element lang is.
        const isReal = totalRounds === 1
          ? nextRealOrFakeIsReal(combinedExcluded, random)
          : isRealAssignment[i];
        question = selectRealOrFakeFlagQuestion(pool, difficulty, isReal, combinedExcluded, random, generateFlagSpec);
        break;
      }
      case 'higher_lower': {
        const metric =
          metricMode === 'mixed' ? VALID_METRICS[pickUniqueIndices(random, VALID_METRICS.length, 1)[0]] : metricMode;
        question = selectHigherLowerQuestion(pool, difficulty, metric, combinedExcluded, random);
        break;
      }
      case 'odd_one_out': {
        // Punt 11: afwisselende afwijklogica. Zonder `generateFlagSpec` blijft
        // alleen de continentvariant over — dan draait deze game precies zoals
        // vóór 5 aug, in plaats van te werpen.
        const logic = typeof generateFlagSpec === 'function'
          ? ODD_ONE_OUT_LOGICS[pickUniqueIndices(random, ODD_ONE_OUT_LOGICS.length, 1)[0]]
          : 'continent';
        question = logic === 'continent'
          ? selectOddOneOutQuestion(pool, difficulty, combinedExcluded, random)
          : selectOddOneOutFlagAuthenticity(
            pool, difficulty, logic === 'fake_among_real', combinedExcluded, random, generateFlagSpec,
          );
        break;
      }
      default:
        throw new RangeError(`Unknown gameType: ${gameType}`);
    }
    used.add(question.questionKey);
    results.push(question);
  }
  return results;
}

/**
 * @param {{
 *   pool: ContentEntry[], gameType: string, totalRounds: number,
 *   difficulty: string, metricMode: string,
 *   previousMatchQuestionKeys: string[], random: () => number,
 *   generateFlagSpec?: (seed: string) => object,
 * }} params
 * @returns {SelectedQuestion[]}
 */
function buildMatchQuestionPlan(params) {
  const { pool, gameType, totalRounds, difficulty, metricMode, previousMatchQuestionKeys, random, generateFlagSpec } =
    params;

  if (!VALID_GAME_TYPES.includes(gameType)) {
    throw new RangeError(`Unknown or missing gameType: ${JSON.stringify(gameType)}`);
  }
  if (!Number.isInteger(totalRounds) || totalRounds <= 0) {
    throw new RangeError(`totalRounds must be a positive integer, got: ${totalRounds}`);
  }
  if (!VALID_DIFFICULTIES.includes(difficulty)) {
    throw new RangeError(`Unknown difficulty: ${JSON.stringify(difficulty)}`);
  }
  if (metricMode !== 'mixed' && !VALID_METRICS.includes(metricMode)) {
    throw new RangeError(`Unknown metricMode: ${JSON.stringify(metricMode)}`);
  }
  if (gameType === 'real_or_fake_flag' && typeof generateFlagSpec !== 'function') {
    throw new RangeError('generateFlagSpec is required when gameType is "real_or_fake_flag"');
  }
  assertValidPool(pool);

  const prefix = KEY_PREFIXES[gameType];
  const previousExcluded = new Set((previousMatchQuestionKeys || []).filter((key) => key.startsWith(prefix)));

  try {
    return selectRoundsForType(pool, difficulty, gameType, totalRounds, metricMode, previousExcluded, random, generateFlagSpec);
  } catch (err) {
    if (!(err instanceof RangeError) || previousExcluded.size === 0) {
      throw err;
    }
    return selectRoundsForType(pool, difficulty, gameType, totalRounds, metricMode, new Set(), random, generateFlagSpec);
  }
}

module.exports = { buildMatchQuestionPlan };
