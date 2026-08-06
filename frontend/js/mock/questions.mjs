// mock/questions.mjs — refactor 4 (docs/openstaand/refactor/4-transport-mock.md).
// Verplaatst LETTERLIJK uit transport-mock.mjs's "Vraagreeks"-kopje, plus
// `resolveGameType` (stond net erboven) en `buildDistribution` (stond bij
// "Rondelogica", maar hoort inhoudelijk bij een vraag). Geen gedragsverandering.
// Gedeeld door mock/room.mjs (buildRoom/updateRoomConfig), mock/match.mjs
// (endRound), mock/answers.mjs (submitAnswer) én transport-mock.mjs zelf
// (deserializeRoomState, en de publieke re-exports van buildQuestionSequence/
// correctValueOf/optionValuesOf) — vandaar een eigen, afhankelijkheidsloos
// bestand in plaats van dat de een van de ander importeert.

import { getCountryPool } from '../../../shared/content/index.mjs';
import { isPlayableGameType } from '../../../shared/content/game-catalog.mjs';
import { generateFlagSpec } from '../../../shared/content/flag-spec.mjs';
// De LICHTE index (2 KB, alleen landcodes) — nooit shapes.data.mjs (234 KB
// tekenpaden). Zelfde scheiding als op de server: die kiest een land en tekent
// niets; het tekenwerk gebeurt in shape-renderer.mjs, dat de paddata pas
// dynamisch ophaalt als deze game daadwerkelijk gespeeld wordt.
import { SHAPE_ISO2S } from '../../../shared/content/shapes-index.mjs';

// Zelfde placeholder-waarde als PROTOCOL.md's voorbeelden. Gedeeld door
// mock/match.mjs (round:started) en transport-mock.mjs (buildSnapshot's
// currentRound), vandaar hier en niet lokaal in één van beide.
export const RENDERER_VERSION = 'flag-renderer-1';
export const DEFAULT_GAME_TYPE = 'flags_mc';
const QUESTION_COUNT = 5;
// Besluit 49 (docs/openstaand/hoger-lager-en-hoofdsteden.md): zelfde drie
// metrics als de echte server (question-selection.js's VALID_METRICS).
const HIGHER_LOWER_METRICS = ['population', 'area', 'gdp'];
/** Welke landen een contour hebben — de enige extra eis van `country_shape_mc`. */
const HAS_SHAPE = new Set(SHAPE_ISO2S);

/** De gameType van deze room: uit de config, met de quick-start default. */
export function resolveGameType(config) {
  const gameTypes = config?.gameTypes;
  const gekozen = Array.isArray(gameTypes) ? gameTypes[0] : null;
  return isPlayableGameType(gekozen) ? gekozen : DEFAULT_GAME_TYPE;
}

/**
 * De vaste vraagreeks van deze mock, per gameType.
 *
 * Elke vraag is `{ payload, correct }`: `payload` gaat naar de client
 * (`round:started`, snapshot), `correct` blijft binnen de mock — besluit 20,
 * het juiste antwoord verlaat de server nooit vóór het einde van de ronde.
 * De reeks is bewust vast en kort (geen willekeur behalve de optievolgorde):
 * een handmatige doorloop moet snel en herhaalbaar zijn.
 *
 * Geëxporteerd (samen met `correctValueOf`/`optionValuesOf` hieronder) zodat
 * `higher_lower`/`capitals_mc` — schakel 5, "mockpariteit", van
 * shared/content/game-catalog.mjs's ketenuitspraak — rechtstreeks getest
 * kunnen worden. `createMockTransport()`'s publieke pad kan ze niet bereiken
 * zolang `PLAYABLE_GAME_TYPES` ze niet bevat (`resolveGameType` hierboven);
 * dat is precies het "bouwbaar, nog niet kiesbaar"-onderscheid uit besluit 49
 * (docs/openstaand/hoger-lager-en-hoofdsteden.md) en geen reden om het bewijs
 * dat de mock ze wél kan bouwen ongetest te laten.
 */
export function buildQuestionSequence(gameType = DEFAULT_GAME_TYPE) {
  const pool = getCountryPool();
  // `country_shape_mc` is de enige gameType met een eis aan het TARGET: er moet
  // een contour van bestaan (225 van de 230, zie shapes-index.mjs). Precies
  // dezelfde beperking die de server via `hasShape` legt in
  // `selectCountryShapeQuestion`. Afleiders vallen er buiten — die zijn namen,
  // van hen wordt niets getekend. Voor elke andere gameType is dit de volle
  // pool en verandert er niets.
  const targetPool = gameType === 'country_shape_mc' ? pool.filter((entry) => HAS_SHAPE.has(entry.iso2)) : pool;
  const count = Math.min(QUESTION_COUNT, targetPool.length);
  const questions = [];

  for (let i = 0; i < count; i += 1) {
    const target = targetPool[i];

    if (gameType === 'country_shape_mc') {
      // Structureel identiek aan flags_mc — `targetIso2` + vier `optionIso2s`,
      // `correct.optionId` — want dat is ook wat de server teruggeeft. Het
      // enige verschil zit in de RENDERING (een contour i.p.v. een vlag) en
      // in de targetkeuze hierboven.
      //
      // Afleiders bij voorkeur van hetzelfde continent, net als de server:
      // vier willekeurige wereldlanden maken de vraag te makkelijk. Vast op
      // poolvolgorde in plaats van willekeurig — een doorloop moet
      // herhaalbaar zijn, zelfde afweging als odd_one_out en higher_lower.
      const zelfdeContinent = pool.filter((entry) => entry.iso2 !== target.iso2 && entry.continent === target.continent);
      const overig = pool.filter((entry) => entry.iso2 !== target.iso2 && entry.continent !== target.continent);
      const afleiders = [...zelfdeContinent, ...overig].slice(0, 3);
      const optionIso2s = shuffle([target, ...afleiders].map((entry) => entry.iso2.toUpperCase()));
      questions.push({
        payload: { targetIso2: target.iso2.toUpperCase(), optionIso2s },
        correct: { optionId: target.iso2.toUpperCase() },
      });
      continue;
    }

    if (gameType === 'odd_one_out') {
      // Drie uit hetzelfde continent + één buitenbeentje, zoals de server
      // (`question-selection.js`). Vast, niet willekeurig: een doorloop moet
      // herhaalbaar zijn.
      const zelfdeContinent = pool.filter((entry) => entry.continent === target.continent && entry.iso2 !== target.iso2);
      const buitenbeentje = pool.find((entry) => entry.continent !== target.continent);
      if (zelfdeContinent.length >= 2 && buitenbeentje !== undefined) {
        const kaarten = [target, zelfdeContinent[0], zelfdeContinent[1], buitenbeentje];
        const oddIndex = 3;
        questions.push({
          payload: { cards: kaarten.map((entry, index) => ({ cardIndex: index, iso2: entry.iso2.toUpperCase() })) },
          correct: { cardIndex: oddIndex },
          resultDetails: {
            logic: 'continent',
            majorityContinent: target.continent,
            minorityContinent: buitenbeentje.continent,
          },
        });
        continue;
      }
    }

    if (gameType === 'higher_lower') {
      // Besluit 49: vast, niet willekeurig — zelfde reden als odd_one_out
      // hierboven (herhaalbare doorloop). Metric wisselt per ronde-index i.p.v.
      // willekeurig `mixed` te kiezen, zodat een doorloop alle drie de metrics
      // raakt in plaats van toevallig steeds dezelfde.
      const metric = HIGHER_LOWER_METRICS[i % HIGHER_LOWER_METRICS.length];
      const second = pool[(i + 1) % pool.length];
      const correctSide = target[metric] >= second[metric] ? 0 : 1;
      questions.push({
        payload: {
          metric,
          sides: [
            { side: 0, iso2: target.iso2.toUpperCase() },
            { side: 1, iso2: second.iso2.toUpperCase() },
          ],
        },
        correct: { side: correctSide },
      });
      continue;
    }

    if (gameType === 'real_or_fake_flag') {
      // Om en om echt/nep, zodat een doorloop beide takken van het spelscherm
      // raakt (echte vlagafbeelding vs. gegenereerde spec op canvas).
      if (i % 2 === 0) {
        questions.push({
          payload: { kind: 'real', iso2: target.iso2.toUpperCase() },
          correct: { choice: 'real' },
        });
      } else {
        const seed = `fx_mock${String(i).padStart(2, '0')}`;
        const { rendererVersion, ...spec } = generateFlagSpec(seed);
        questions.push({
          payload: { kind: 'generated', seed, rendererVersion, spec },
          correct: { choice: 'fake' },
        });
      }
      continue;
    }

    // flags_mc EN capitals_mc (besluit 49): dezelfde payloadvorm
    // (`targetIso2`+`optionIso2s`, `correct.optionId`) — de echte server bouwt
    // `capitals_mc` ook zo (question-selection.js's `selectCapitalsMcQuestion`).
    // De richting ("hoofdstad van X?" vs. "Y hoort bij welk land?") is een
    // renderkeuze op deze payload, geen aparte contentvorm — zie
    // `capitalsQuestionDirection` in frontend/js/views/country-names.mjs.
    const distractors = [];
    for (let offset = 1; distractors.length < 3 && offset < pool.length; offset += 1) {
      const candidate = pool[(i + offset) % pool.length];
      if (candidate.iso2 !== target.iso2) {
        distractors.push(candidate);
      }
    }
    const optionIso2s = shuffle([target, ...distractors].map((entry) => entry.iso2.toUpperCase()));
    questions.push({
      payload: { targetIso2: target.iso2.toUpperCase(), optionIso2s },
      correct: { optionId: target.iso2.toUpperCase() },
    });
  }

  return questions;
}

/**
 * Zet de opgeslagen weergavevolgorde terug op een net herbouwde vraag
 * (`deserializeRoomState`, docs/openstaand/solo-antwoordvolgorde.md punt 1).
 * Alleen toegepast als `optionOrder` letterlijk dezelfde optieset is — een
 * andere permutatie, geen andere inhoud. Dezelfde ronde-index bouwt altijd
 * dezelfde optieset op (`buildQuestionSequence` is deterministisch op de
 * shuffle na), dus dat mag hier nooit falen; de check is puur verdediging
 * tegen een corrupte of verouderde `sessionStorage`-waarde — dan liever de
 * vers geschudde volgorde dan een vraag met een fantoomoptie.
 */
export function withSavedOptionOrder(question, optionOrder) {
  if (question === undefined || !Array.isArray(optionOrder) || !Array.isArray(question.payload?.optionIso2s)) {
    return question;
  }
  const current = question.payload.optionIso2s;
  const sameSet = optionOrder.length === current.length && current.every((iso2) => optionOrder.includes(iso2));
  if (!sameSet) {
    return question;
  }
  return { ...question, payload: { ...question.payload, optionIso2s: optionOrder } };
}

function shuffle(array) {
  const result = array.slice();
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** De waarde die dit antwoord juist maakt, ongeacht gameType. */
export function correctValueOf(question) {
  if (question.correct.cardIndex !== undefined) return String(question.correct.cardIndex);
  if (question.correct.side !== undefined) return String(question.correct.side);
  return question.correct.optionId ?? question.correct.choice;
}

/** De mogelijke antwoordwaarden van deze vraag, in weergavevolgorde. */
export function optionValuesOf(question) {
  if (Array.isArray(question.payload.cards)) {
    return question.payload.cards.map((kaart) => String(kaart.cardIndex));
  }
  if (Array.isArray(question.payload.sides)) {
    return question.payload.sides.map((kant) => String(kant.side));
  }
  return question.payload.optionIso2s ?? ['real', 'fake'];
}

export function buildDistribution(optionValues, answers) {
  const counts = new Map(optionValues.map((waarde) => [waarde, 0]));
  for (const gegeven of answers.values()) {
    counts.set(gegeven, (counts.get(gegeven) ?? 0) + 1);
  }
  return optionValues.map((optionId) => ({ optionId, count: counts.get(optionId) ?? 0 }));
}
