'use strict';

// Antwoordverdeling per ronde. Zie docs/multiplayer/DECISIONS.md #14 en
// docs/game-rules-plan/prompts/GR8-answer-distribution.md voor de volledige
// spec.
//
// Geen enkele functie hier raadpleegt content-data, Redis, sockets of de
// klok, en geeft nooit spelersidentiteit terug — alleen geaggregeerde tellingen.

function assertKnownKey(dist, key, gameType) {
  if (!(key in dist)) {
    throw new RangeError(`Answer value ${JSON.stringify(key)} is not a known option for gameType "${gameType}"`);
  }
}

/**
 * Berekent de verdeling van geaccepteerde antwoorden over de mogelijke
 * keuzes voor één ronde. Werpt RangeError bij een onbekende gameType, of als
 * een antwoord een waarde bevat die niet in de bekende sleutelset voorkomt.
 * @param {"flags_mc"|"capitals_mc"|"country_shape_mc"|"real_or_fake_flag"|"higher_lower"|"odd_one_out"} gameType
 * @param {Array<{ answer: object }>} answers - reeds geaccepteerde antwoorden (na GR3-validatie)
 * @param {{ validOptionIds?: string[] }} roundContext - alleen nodig voor de meerkeuzevormen
 * @returns {Record<string, number>}
 */
function computeAnswerDistribution(gameType, answers, roundContext) {
  let dist;
  let extractKey;

  switch (gameType) {
    case 'flags_mc':
    case 'capitals_mc':
    // "Raad het land" (docs/openstaand/raad-het-land.md, opdracht D). Zelfde
    // antwoordvorm als de andere twee meerkeuzes — een landcode uit
    // `validOptionIds`; alleen de vraag ziet er anders uit (een contour i.p.v.
    // een vlag), en dat is een renderkeuze in de client.
    //
    // Deze regel ontbrak, en dat kostte een stille vastloper: `endRound` roept
    // deze functie aan, de `default`-tak wierp `Unknown gameType`, en die
    // throw verdween in de fasepomp. De room bleef in ROUND_ACTIVE staan
    // zonder één logregel — hetzelfde patroon als 4 augustus, alleen een fase
    // later. Gevonden door de ketentest van opdracht D, vóór de game aan ging.
    case 'country_shape_mc':
      dist = Object.fromEntries((roundContext.validOptionIds || []).map((id) => [id, 0]));
      extractKey = (a) => a.answer.optionId;
      break;
    case 'real_or_fake_flag':
      dist = { real: 0, fake: 0 };
      extractKey = (a) => a.answer.choice;
      break;
    case 'higher_lower':
      dist = { '0': 0, '1': 0 };
      extractKey = (a) => String(a.answer.side);
      break;
    case 'odd_one_out':
      dist = { '0': 0, '1': 0, '2': 0, '3': 0 };
      extractKey = (a) => String(a.answer.cardIndex);
      break;
    default:
      throw new RangeError(`Unknown gameType: ${JSON.stringify(gameType)}`);
  }

  for (const a of answers) {
    const key = extractKey(a);
    assertKnownKey(dist, key, gameType);
    dist[key] += 1;
  }
  return dist;
}

module.exports = { computeAnswerDistribution };
