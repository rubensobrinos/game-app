'use strict';

// Tijdsoffset tussen de klok van één client en de autoritaire serverklok, geschat
// uit round-trip-samples van `GET /api/v1/time`.
//
// Bron: docs/multiplayer/PROTOCOL.md, sectie `GET /api/v1/time` — "De client meet
// meerdere samples en gebruikt het midpoint van de request round-trip om de offset
// te schatten" — en docs/multiplayer/ARCHITECTURE.md, principe 2 "Eén timeline per
// room": de server plant absolute tijden, de client rendert een lokale timer op
// basis van `startsAt`, `endsAt` en een gemeten serveroffset. Er bestaan GEEN
// timer-ticks per seconde, dus deze schatting is het enige wat een lokale countdown
// op de servertijdlijn houdt.
//
// PUUR EN KLOKLOOS: geen dependencies, geen Date.now(), geen performance.now(),
// geen timers. ALLE tijd komt als argument binnen (epoch-ms, PROTOCOL.md
// "Basisregels"), zodat elke uitkomst deterministisch testbaar is.
//
// FOUTSTIJL, gelijk aan state-machine.js in deze map: werpt nooit op data — elke
// functie levert { ok: true, ... } of { ok: false, code }. Net als daar geldt de
// bekende beperking dat een property-getter die zélf werpt naar buiten propageert;
// de aanroeper levert platte, schema-gevalideerde payloads aan. Alle foutcodes zijn
// INTERN: ze staan niet in de foutcodelijst van PROTOCOL.md en horen niet op de
// wire, want deze berekening draait client-side op eigen metingen.
//
// TEKENAFSPRAAK — nergens in de bronnen vastgelegd, hier expliciet gekozen:
//   offsetMs = servertijd - lokale tijd
// Dus `serverNow = localNow + offsetMs` en `localTime = serverTimestamp - offsetMs`.
// Een POSITIEVE offset betekent dat de lokale klok ACHTERLOOPT op de server.
//
// AANNAMES EN OPEN PUNTEN — deze module beslist ze bewust niet zelf:
// 1. PROTOCOL.md schrijft het midpoint voor, maar niet HOE meerdere samples worden
//    gecombineerd, hoeveel er nodig zijn, of wanneer een sample onbruikbaar is. Het
//    mediaan-met-round-trip-filter hieronder is een keuze van deze module en geen
//    protocolregel; de motivatie staat bij `estimateOffset`.
// 2. `/api/v1/time` retourneert alleen `{ serverTime }` — één tijdstempel, geen
//    aparte server-ontvangst- en verzendtijd zoals echte NTP. De serververwerkingstijd
//    zit daardoor onlosmakelijk in de round-trip. OPEN VERZOEK aan de PROTOCOL.md-
//    eigenaar: pas met een tweede tijdstempel is die asymmetrie echt te corrigeren.
// 3. Er is geen norm voor "goed genoeg" en geen hersyncbeleid (na reconnect, na
//    resume) vastgelegd. Deze module geeft daarom `uncertaintyMs` en
//    `roundTripSpreadMs` terug als ADVIES; de aanroeper beslist of hij opnieuw meet.
// 4. PROTOCOL.md zegt "tijden in epoch-milliseconden": tijdstempels moeten hier dus
//    eindig en >= 0 zijn (zelfde strengheid als `isValidNow` in state-machine.js).
//    Een offset is een verschil en mag uiteraard wél negatief zijn.

/**
 * Eén meting rond één `GET /api/v1/time`-aanroep: t0 = lokale tijd vlak vóór het
 * versturen, t1 = `serverTime` uit de response, t2 = lokale tijd vlak ná ontvangst.
 * @typedef {{ t0: number, t1: number, t2: number }} TimeSample
 * @typedef {{ roundTripFactor?: number, maxRoundTripMs?: (number|null) }} EstimateOptions
 */

/** De enige codes die deze module kan retourneren; geen ervan is een wire-code. */
const ERROR_CODES = Object.freeze({
  INVALID_SAMPLE: 'INVALID_SAMPLE', // geen object, of t0/t1/t2 geen geldig epoch-ms
  NEGATIVE_ROUND_TRIP: 'NEGATIVE_ROUND_TRIP', // t2 < t0: lokale klok sprong terug
  INVALID_SAMPLE_LIST: 'INVALID_SAMPLE_LIST', // `samples` is geen array
  NO_SAMPLES: 'NO_SAMPLES', // lege lijst: er is niets gemeten
  NO_USABLE_SAMPLES: 'NO_USABLE_SAMPLES', // wél gemeten, niets overleefde de filters
  INVALID_OPTIONS: 'INVALID_OPTIONS', // `options` of een veld valt buiten bereik
  INVALID_TIME: 'INVALID_TIME', // tijdstempel- of offsetargument is geen geldig getal
});

/**
 * Standaardinstellingen van `estimateOffset`: houd samples tot tweemaal de snelste
 * round-trip, en geen absolute bovengrens — de aanroeper kent zijn netwerkbudget
 * beter dan deze module.
 */
const DEFAULT_OPTIONS = Object.freeze({ roundTripFactor: 2, maxRoundTripMs: null });

/**
 * Offset en round-trip van ÉÉN sample, exact volgens PROTOCOL.md:
 *   roundTripMs = t2 - t0
 *   offsetMs    = t1 - (t0 + roundTripMs / 2)
 * Oftewel: de servertijd minus het midpoint van de round-trip. De aanname is dat
 * heen- en terugweg even lang duurden; klopt dat niet, dan is de fout in `offsetMs`
 * hooguit `roundTripMs / 2` groot. Deze functie corrigeert die asymmetrie NIET —
 * dat kan niet met één sample — maar geeft `roundTripMs` terug zodat de aanroeper
 * (en `estimateOffset`) de betrouwbaarheid kan wegen.
 * @param {TimeSample} sample
 * @returns {{ ok: true, offsetMs: number, roundTripMs: number } | { ok: false, code: string }}
 */
function computeOffsetFromSample(sample) {
  if (sample === null || typeof sample !== 'object') {
    return reject(ERROR_CODES.INVALID_SAMPLE);
  }

  // Elke property EXACT ÉÉN KEER lezen vóór de validatie en daarna alleen de local
  // gebruiken: bij een tweede `sample.t0` kan een getter een andere, ONGEVALIDEERDE
  // waarde teruggeven en die de berekening in duwen.
  const t0 = sample.t0;
  const t1 = sample.t1;
  const t2 = sample.t2;

  if (!isTimestamp(t0) || !isTimestamp(t1) || !isTimestamp(t2)) {
    return reject(ERROR_CODES.INVALID_SAMPLE);
  }

  const roundTripMs = t2 - t0;
  if (roundTripMs < 0) {
    // t2 vóór t0 kan alleen als de lokale klok tijdens de meting is verzet. De
    // meting zegt dan niets over de server en wordt niet "gerepareerd".
    return reject(ERROR_CODES.NEGATIVE_ROUND_TRIP);
  }

  return { ok: true, offsetMs: t1 - (t0 + roundTripMs / 2), roundTripMs };
}

/**
 * Robuuste offsetschatting uit meerdere samples.
 *
 * WAAROM EEN ROUND-TRIP-FILTER MET DAARNA DE MEDIAAN, EN GEEN GEMIDDELDE:
 * 1. Filteren. De fout van een sample is begrensd door `roundTripMs / 2`: een trage
 *    sample is per definitie een onnauwkeurige sample. Alles boven `snelste
 *    round-trip * roundTripFactor` valt af, en boven `maxRoundTripMs` als de
 *    aanroeper die zet. De snelste sample overleeft altijd, want `best <= best *
 *    factor` geldt voor elke `factor >= 1`.
 * 2. Mediaan. Een gemiddelde is lineair in álle waarden: één sample die er 900 s
 *    naast zit verschuift het gemiddelde met 900 s / n en kaapt de schatting. De
 *    mediaan verschuift bij één uitschieter hooguit één rangpositie — bij drie
 *    goede samples verandert hij zelfs helemaal niet.
 * De twee stappen vangen verschillende storingen: het filter haalt de traag-maar-
 * plausibele samples weg, de mediaan de snelle-maar-onzinnige. Beide zijn nodig.
 * Bij een even aantal gebruikte samples is de mediaan het gemiddelde van de twee
 * middelste waarden (standaarddefinitie).
 *
 * RANDGEVALLEN, expliciet: geen array → INVALID_SAMPLE_LIST; lege lijst →
 * NO_SAMPLES; alles verworpen → NO_USABLE_SAMPLES; precies één bruikbaar sample →
 * ok met `usedCount: 1` en `roundTripSpreadMs: 0`. In dat laatste geval is er geen
 * enkele kruiscontrole en moet de aanroeper op `uncertaintyMs` afgaan.
 *
 * BETROUWBAARHEID: `uncertaintyMs` (= `bestRoundTripMs / 2`) is de klassieke
 * bovengrens op de fout van de beste meting bij maximaal asymmetrische vertraging;
 * `roundTripSpreadMs` zegt hoe stabiel het net was; `usedCount`/`discardedCount`
 * hoeveel bewijs eronder ligt. Deze module bepaalt bewust GEEN drempel —
 * hersyncbeleid ligt bij de aanroeper (open punt 3).
 * @param {TimeSample[]} samples
 * @param {EstimateOptions} [options]
 * @returns {{
 *   ok: true, offsetMs: number, sampleCount: number, usedCount: number,
 *   discardedCount: number, bestRoundTripMs: number, worstRoundTripMs: number,
 *   roundTripSpreadMs: number, uncertaintyMs: number,
 * } | { ok: false, code: string }}
 */
function estimateOffset(samples, options) {
  // Ongeldige opties zijn een programmeerfout van de aanroeper en gaan daarom vóór
  // de sample-poorten: die fout wil je zien, ook bij een lege meetreeks.
  const config = readOptions(options);
  if (config === null) {
    return reject(ERROR_CODES.INVALID_OPTIONS);
  }
  if (!Array.isArray(samples)) {
    return reject(ERROR_CODES.INVALID_SAMPLE_LIST);
  }
  if (samples.length === 0) {
    return reject(ERROR_CODES.NO_SAMPLES);
  }

  const cap = config.maxRoundTripMs === null ? Infinity : config.maxRoundTripMs;
  const measured = [];
  for (const sample of samples) {
    const result = computeOffsetFromSample(sample);
    // Onbruikbare en te trage samples verdwijnen stil; ze komen terug in
    // discardedCount, zodat de aanroeper kan besluiten opnieuw te meten.
    if (result.ok && result.roundTripMs <= cap) {
      measured.push(result);
    }
  }
  if (measured.length === 0) {
    return reject(ERROR_CODES.NO_USABLE_SAMPLES);
  }

  let bestRoundTripMs = measured[0].roundTripMs;
  for (const item of measured) {
    if (item.roundTripMs < bestRoundTripMs) {
      bestRoundTripMs = item.roundTripMs;
    }
  }

  // Relatieve drempel: alles wat meer dan `roundTripFactor` keer zo traag is als de
  // snelste meting draagt meer ruis dan informatie.
  const threshold = bestRoundTripMs * config.roundTripFactor;
  const offsets = [];
  let worstRoundTripMs = bestRoundTripMs;
  for (const item of measured) {
    if (item.roundTripMs <= threshold) {
      offsets.push(item.offsetMs);
      if (item.roundTripMs > worstRoundTripMs) {
        worstRoundTripMs = item.roundTripMs;
      }
    }
  }

  // Expliciete comparator: Array#sort sorteert standaard als string.
  offsets.sort((a, b) => a - b);
  return {
    ok: true,
    offsetMs: median(offsets),
    sampleCount: samples.length,
    usedCount: offsets.length,
    discardedCount: samples.length - offsets.length,
    bestRoundTripMs,
    worstRoundTripMs,
    roundTripSpreadMs: worstRoundTripMs - bestRoundTripMs,
    uncertaintyMs: bestRoundTripMs / 2,
  };
}

/**
 * Lokale tijd → servertijd. Hiermee vertaalt een client zijn eigen klok naar de
 * tijdlijn waarop `startsAt` en `endsAt` zijn gepland.
 * @param {number} localNow - epoch-ms op de lokale klok
 * @param {number} offsetMs - uit `estimateOffset`
 * @returns {{ ok: true, serverTime: number } | { ok: false, code: string }}
 */
function serverNow(localNow, offsetMs) {
  if (!isTimestamp(localNow) || !isOffset(offsetMs)) {
    return reject(ERROR_CODES.INVALID_TIME);
  }
  return { ok: true, serverTime: localNow + offsetMs };
}

/**
 * Servertijd → lokale tijd; de exacte inverse van `serverNow`. Hiermee zet een
 * client `startsAt`/`endsAt` om naar zijn eigen klok, bijvoorbeeld om er één
 * timeout of animatie aan op te hangen.
 * @param {number} serverTimestamp - epoch-ms op de servertijdlijn
 * @param {number} offsetMs - uit `estimateOffset`
 * @returns {{ ok: true, localTime: number } | { ok: false, code: string }}
 */
function toLocalTime(serverTimestamp, offsetMs) {
  if (!isTimestamp(serverTimestamp) || !isOffset(offsetMs)) {
    return reject(ERROR_CODES.INVALID_TIME);
  }
  return { ok: true, localTime: serverTimestamp - offsetMs };
}

/**
 * Resterende rondetijd volgens de SERVERtijdlijn, gezien vanaf de lokale klok.
 * Nooit negatief: een verstreken deadline levert exact 0 op (dankzij Math.max
 * altijd +0, nooit -0). Een aflopende ronde hoort in de UI op nul te blijven staan,
 * niet in de min te schieten.
 * @param {number} endsAtServer - `endsAt` uit een serverevent (epoch-ms, servertijd)
 * @param {number} localNow - epoch-ms op de lokale klok
 * @param {number} offsetMs - uit `estimateOffset`
 * @returns {{ ok: true, remainingMs: number } | { ok: false, code: string }}
 */
function remainingMs(endsAtServer, localNow, offsetMs) {
  if (!isTimestamp(endsAtServer) || !isTimestamp(localNow) || !isOffset(offsetMs)) {
    return reject(ERROR_CODES.INVALID_TIME);
  }
  return { ok: true, remainingMs: Math.max(0, endsAtServer - (localNow + offsetMs)) };
}

/**
 * Leest en valideert de opties. `undefined`/`null` betekent "alles standaard"; per
 * veld betekent alleen `undefined` "standaard", zodat een expliciete onzinwaarde
 * (`null`, `'2'`) niet stilzwijgend als default wordt opgevat.
 * @param {unknown} options
 * @returns {{ roundTripFactor: number, maxRoundTripMs: (number|null) } | null} null = ongeldig
 */
function readOptions(options) {
  if (options === undefined || options === null) {
    return DEFAULT_OPTIONS;
  }
  if (typeof options !== 'object' || Array.isArray(options)) {
    return null;
  }

  // Ook hier: elk veld exact één keer lezen, daarna alleen de local gebruiken.
  const rawFactor = options.roundTripFactor;
  const rawCap = options.maxRoundTripMs;
  const factor = rawFactor === undefined ? DEFAULT_OPTIONS.roundTripFactor : rawFactor;
  const cap = rawCap === undefined ? DEFAULT_OPTIONS.maxRoundTripMs : rawCap;

  // Een factor < 1 zou de snelste sample zelf kunnen wegfilteren en de reeks leeg
  // achterlaten; 1 betekent "alleen de allersnelste samples".
  if (typeof factor !== 'number' || !Number.isFinite(factor) || factor < 1) {
    return null;
  }
  if (cap !== null && (typeof cap !== 'number' || !Number.isFinite(cap) || cap < 0)) {
    return null;
  }

  return { roundTripFactor: factor, maxRoundTripMs: cap };
}

/**
 * Mediaan van een OPLOPEND GESORTEERDE, niet-lege lijst; even aantal → gemiddelde
 * van de twee middelste waarden.
 * @param {number[]} sorted @returns {number}
 */
function median(sorted) {
  const middle = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Epoch-ms moet een eindig, niet-negatief getal zijn: NaN, Infinity, negatieve
 * waarden en niet-numerieke types worden afgewezen.
 * @param {unknown} value @returns {boolean}
 */
function isTimestamp(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/**
 * Een offset is een verschil en mag dus negatief zijn (lokale klok loopt vóór),
 * maar moet wel eindig zijn.
 * @param {unknown} value @returns {boolean}
 */
function isOffset(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Bouwt een afwijzing. Werpt nooit.
 * @param {string} code @returns {{ ok: false, code: string }}
 */
function reject(code) {
  return { ok: false, code };
}

module.exports = {
  computeOffsetFromSample,
  estimateOffset,
  serverNow,
  toLocalTime,
  remainingMs,
  ERROR_CODES,
  DEFAULT_OPTIONS,
};
