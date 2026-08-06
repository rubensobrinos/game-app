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

const VALID_GAME_TYPES = ['flags_mc', 'capitals_mc', 'real_or_fake_flag', 'higher_lower', 'odd_one_out', 'country_shape_mc'];
const VALID_DIFFICULTIES = ['easy', 'medium', 'hard', 'extreme'];
const VALID_METRICS = ['population', 'area', 'gdp'];
const KEY_PREFIXES = {
  flags_mc: 'flags:',
  capitals_mc: 'capitals:',
  real_or_fake_flag: 'rof:',
  higher_lower: 'higher_lower:',
  odd_one_out: 'odd_one_out:',
  country_shape_mc: 'shape:',
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
 * geldige hoofdstad, en optioneel continent). `== null` (niet `===`) dekt
 * zowel `capital: null` als een ontbrekende `capital`-key — een contentbron
 * die de key weglaat in plaats van expliciet op `null` te zetten, mag
 * capitals_mc niet stilzwijgend als geschikt beschouwen.
 *
 * `continents` (punt 7, docs/openstaand/continentfilter.md): `undefined` doet
 * geen filter (alle continenten, ook voor aanroepers die het argument nog
 * niet meegeven); een array filtert op `e.continent`. Dit is de ENE plek waar
 * die filtering gebeurt — alle zes spelvormen lopen hier doorheen, direct of
 * via `buildHigherLowerCandidatePairs`.
 */
function buildCandidatePool(pool, difficulty, requireCapital, continents) {
  return pool.filter(
    (e) =>
      e.difficulty === difficulty &&
      (!requireCapital || e.capital != null) &&
      (continents === undefined || continents.includes(e.continent))
  );
}

/** @returns {Array<[ContentEntry, ContentEntry]>} alle paren met ongelijke, niet-null metriekwaarden. */
function buildHigherLowerCandidatePairs(pool, difficulty, metric, continents) {
  const difficultyPool = buildCandidatePool(pool, difficulty, false, continents);
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

function selectFlagsMcQuestion(pool, difficulty, excludedKeys, random, continents) {
  const difficultyPool = buildCandidatePool(pool, difficulty, false, continents);
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

function selectCapitalsMcQuestion(pool, difficulty, excludedKeys, random, continents) {
  const difficultyPool = buildCandidatePool(pool, difficulty, true, continents);
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

/**
 * "Raad het land" (docs/openstaand/raad-het-land.md, stap 3). Structureel
 * identiek aan flags_mc: target + drie afleiders met dezelfde continent-
 * voorkeur, vier optie-iso2's. Het enige verschil is de RENDERING (een
 * contour i.p.v. een vlag, client-only — shared/content/shapes.data.mjs) en
 * dus de vraag welk land geschikt is als TARGET: niet elk pool-land heeft een
 * contour (225 van 230, zie shapes-index.mjs). Afleiders hoeven zelf geen
 * contour te hebben — alleen de doelcontour wordt getekend, de opties zijn
 * namen.
 *
 * `hasShape(iso2)` is bewust een geïnjecteerde functie, geen import van
 * shapes-index.mjs hier: dit bestand raadpleegt principieel geen data/shared
 * content zelf (zie de moduledoc bovenaan) — zelfde patroon als
 * `generateFlagSpec` voor real_or_fake_flag/odd_one_out.
 */
function selectCountryShapeQuestion(pool, difficulty, excludedKeys, random, hasShape, continents) {
  const difficultyPool = buildCandidatePool(pool, difficulty, false, continents);
  const shapedPool = difficultyPool.filter((e) => hasShape(e.iso2));
  const targetCandidates = shapedPool.filter((e) => !excludedKeys.has(`shape:${e.iso2}`));
  if (targetCandidates.length === 0) {
    throw new RangeError(`No available country_shape_mc target (with a shape) for difficulty "${difficulty}"`);
  }
  const target = targetCandidates[pickUniqueIndices(random, targetCandidates.length, 1)[0]];

  // Afleiders zijn gewone opties (namen), geen eigen contour nodig — de volle
  // difficultyPool is dus het juiste afleider-universum, niet shapedPool.
  const sameContinent = difficultyPool.filter((e) => e.iso2 !== target.iso2 && e.continent === target.continent);
  const rest = difficultyPool.filter((e) => e.iso2 !== target.iso2 && e.continent !== target.continent);

  let distractors;
  if (sameContinent.length >= 3) {
    distractors = pickUniqueIndices(random, sameContinent.length, 3).map((i) => sameContinent[i]);
  } else {
    const remainingNeeded = 3 - sameContinent.length;
    if (rest.length < remainingNeeded) {
      throw new RangeError(`Not enough distinct countries to build country_shape_mc distractors for difficulty "${difficulty}"`);
    }
    distractors = [...sameContinent, ...pickUniqueIndices(random, rest.length, remainingNeeded).map((i) => rest[i])];
  }

  const optionIso2s = shuffle([target, ...distractors], random).map((e) => e.iso2);
  return {
    gameType: 'country_shape_mc',
    questionKey: `shape:${target.iso2}`,
    publicQuestionPayload: { targetIso2: target.iso2, optionIso2s },
    correctAnswer: { optionId: target.iso2 },
    validOptionIds: optionIso2s,
  };
}

function selectRealOrFakeFlagQuestion(pool, difficulty, isReal, excludedKeys, random, generateFlagSpec, continents) {
  if (isReal) {
    const candidates = buildCandidatePool(pool, difficulty, false, continents).filter((e) => !excludedKeys.has(`rof:${e.iso2}`));
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

function selectHigherLowerQuestion(pool, difficulty, metric, excludedKeys, random, continents) {
  const pairs = buildHigherLowerCandidatePairs(pool, difficulty, metric, continents).filter(
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
function selectOddOneOutFlagAuthenticity(pool, difficulty, oddIsFake, excludedKeys, random, generateFlagSpec, continents) {
  const difficultyPool = buildCandidatePool(pool, difficulty, false, continents);
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

/**
 * @returns {Array<[string, ContentEntry[]]>} de continenten in `difficultyPool`
 * die groot genoeg zijn om de "meerderheid" van een odd_one_out-continentronde
 * te leveren (>=3 landen) én minstens één land elders overlaten voor het
 * buitenbeentje.
 */
function continentMajorityGroups(difficultyPool) {
  const byContinent = new Map();
  for (const entry of difficultyPool) {
    if (!byContinent.has(entry.continent)) {
      byContinent.set(entry.continent, []);
    }
    byContinent.get(entry.continent).push(entry);
  }
  return [...byContinent.entries()].filter(
    ([, entries]) => entries.length >= 3 && difficultyPool.length - entries.length >= 1
  );
}

/**
 * Besluit 52 (punt 7, docs/openstaand/continentfilter.md): "Welke hoort er
 * niet bij" heeft in zijn continentvariant minstens twee continenten nodig.
 * Kiest een host er maar één (of laat een moeilijkheidsgraad te weinig landen
 * over in de overige continenten), dan is die variant hier niet haalbaar —
 * `selectRoundsForType` laat 'm dan buiten de logica-keuze, zonder foutmelding.
 * @returns {boolean}
 */
function oddOneOutContinentVariantFeasible(pool, difficulty, continents) {
  const difficultyPool = buildCandidatePool(pool, difficulty, false, continents);
  return continentMajorityGroups(difficultyPool).length > 0;
}

function selectOddOneOutQuestion(pool, difficulty, excludedKeys, random, continents) {
  const difficultyPool = buildCandidatePool(pool, difficulty, false, continents);
  const majorityCandidates = continentMajorityGroups(difficultyPool);
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

function selectRoundsForType(pool, difficulty, gameType, totalRounds, metricMode, excludedKeys, random, generateFlagSpec, hasShape, continents) {
  const used = new Set();
  const results = [];
  const isRealAssignment = gameType === 'real_or_fake_flag' ? buildRealOrFakeAssignment(totalRounds, random) : null;

  for (let i = 0; i < totalRounds; i++) {
    const combinedExcluded = new Set([...excludedKeys, ...used]);
    let question;
    switch (gameType) {
      case 'flags_mc':
        question = selectFlagsMcQuestion(pool, difficulty, combinedExcluded, random, continents);
        break;
      case 'capitals_mc':
        question = selectCapitalsMcQuestion(pool, difficulty, combinedExcluded, random, continents);
        break;
      case 'real_or_fake_flag': {
        // Plan van één vraag (de compositie bouwt per ronde): balans afleiden
        // uit de al gebruikte sleutels in plaats van uit een verdeling over
        // een plan dat hier maar één element lang is.
        const isReal = totalRounds === 1
          ? nextRealOrFakeIsReal(combinedExcluded, random)
          : isRealAssignment[i];
        question = selectRealOrFakeFlagQuestion(pool, difficulty, isReal, combinedExcluded, random, generateFlagSpec, continents);
        break;
      }
      case 'higher_lower': {
        const metric =
          metricMode === 'mixed' ? VALID_METRICS[pickUniqueIndices(random, VALID_METRICS.length, 1)[0]] : metricMode;
        question = selectHigherLowerQuestion(pool, difficulty, metric, combinedExcluded, random, continents);
        break;
      }
      case 'odd_one_out': {
        // Punt 11: afwisselende afwijklogica. Zonder `generateFlagSpec` blijft
        // alleen de continentvariant over — dan draait deze game precies zoals
        // vóór 5 aug, in plaats van te werpen. Besluit 52: de continentvariant
        // zelf valt weg zodra hij niet haalbaar is (host koos te weinig
        // continenten) — geen foutmelding, gewoon een kleinere keuze.
        const continentFeasible = oddOneOutContinentVariantFeasible(pool, difficulty, continents);
        const eligibleLogics = typeof generateFlagSpec === 'function'
          ? (continentFeasible ? ODD_ONE_OUT_LOGICS : ODD_ONE_OUT_LOGICS.filter((l) => l !== 'continent'))
          : (continentFeasible ? ['continent'] : []);
        if (eligibleLogics.length === 0) {
          throw new RangeError(
            `No odd_one_out logic available for difficulty "${difficulty}" with the selected continents`
          );
        }
        const logic = eligibleLogics[pickUniqueIndices(random, eligibleLogics.length, 1)[0]];
        question = logic === 'continent'
          ? selectOddOneOutQuestion(pool, difficulty, combinedExcluded, random, continents)
          : selectOddOneOutFlagAuthenticity(
            pool, difficulty, logic === 'fake_among_real', combinedExcluded, random, generateFlagSpec, continents,
          );
        break;
      }
      case 'country_shape_mc':
        question = selectCountryShapeQuestion(pool, difficulty, combinedExcluded, random, hasShape, continents);
        break;
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
 *   hasShape?: (iso2: string) => boolean,
 *   continents?: string[],
 * }} params
 * @returns {SelectedQuestion[]}
 */
function buildMatchQuestionPlan(params) {
  const { pool, gameType, totalRounds, difficulty, metricMode, previousMatchQuestionKeys, random, generateFlagSpec, hasShape, continents } =
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
  // shared/content/shapes-index.mjs' SHAPE_ISO2S zegt welke landen een contour
  // hebben (225 van 230, docs/openstaand/raad-het-land.md) — dit bestand
  // importeert dat zelf niet (moduledoc: geen data/shared content hier), dus
  // de aanroeper injecteert 'm, zelfde patroon als generateFlagSpec.
  if (gameType === 'country_shape_mc' && typeof hasShape !== 'function') {
    throw new RangeError('hasShape is required when gameType is "country_shape_mc"');
  }
  // `continents` (punt 7, continentfilter.md): welke waarden geldig zijn — de
  // zes continenten van de contentpool — ligt vast in
  // `server/data/types/game-configuration.js` en is daar al afgedwongen vóór
  // een GameConfiguration kan bestaan; hier alleen de vorm bewaken (net als
  // difficulty/metricMode hierboven, niet de inhoud van een gesloten enum
  // waarvan de bron elders zit).
  if (continents !== undefined && !Array.isArray(continents)) {
    throw new TypeError(`continents must be an array of strings or undefined, got: ${JSON.stringify(continents)}`);
  }
  assertValidPool(pool);

  const prefix = KEY_PREFIXES[gameType];
  const previousExcluded = new Set((previousMatchQuestionKeys || []).filter((key) => key.startsWith(prefix)));

  try {
    return selectRoundsForType(pool, difficulty, gameType, totalRounds, metricMode, previousExcluded, random, generateFlagSpec, hasShape, continents);
  } catch (err) {
    if (!(err instanceof RangeError) || previousExcluded.size === 0) {
      throw err;
    }
    return selectRoundsForType(pool, difficulty, gameType, totalRounds, metricMode, new Set(), random, generateFlagSpec, hasShape, continents);
  }
}

module.exports = { buildMatchQuestionPlan };
