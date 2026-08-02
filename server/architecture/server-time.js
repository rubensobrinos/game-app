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
//    resume) vastgelegd. Deze module geeft daarom `uncertaintyMs`, de twee
//    round-trip-spreidingen en `offsetSpreadMs`/`offsetMadMs` terug als ADVIES; de
//    aanroeper beslist of hij opnieuw meet.
// 4. PROTOCOL.md zegt "tijden in epoch-milliseconden": tijdstempels moeten hier dus
//    eindig en >= 0 zijn (zelfde strengheid als `isValidNow` in state-machine.js).
//    Een offset is een verschil en mag uiteraard wél negatief zijn. Een berekende
//    UITKOMST die buiten het eindige getalbereik valt is geen bruikbare epoch-ms en
//    levert `RESULT_OUT_OF_RANGE`: `ok: true` mag nooit Infinity of NaN dragen.
// 5. MEERDERHEIDSAANNAME (expliciet, want een mediaan verzwijgt hem): de schatting is
//    alleen robuust zolang MEER DAN DE HELFT van de gebruikte samples eerlijk is.
//    Drie van vijf samples met dezelfde verkeerde klok — bijvoorbeeld een cache die
//    één oude `serverTime` blijft herhalen — winnen van filter én mediaan, en dat is
//    binnen één meetreeks niet te repareren. Deze module maakt die onenigheid daarom
//    MEETBAAR met `offsetSpreadMs` en `offsetMadMs`, die over de berekende OFFSETS
//    gaan in plaats van over de round-trips. Grote `offsetSpreadMs` bij kleine
//    `usedRoundTripSpreadMs` betekent: de samples zijn het oneens terwijl het net
//    stabiel was — dat is een reden om opnieuw te meten, niet om te vertrouwen.

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
  RESULT_OUT_OF_RANGE: 'RESULT_OUT_OF_RANGE', // uitkomst is niet eindig; zie aanname 4
});

/**
 * Standaardinstellingen van `estimateOffset`: houd samples tot tweemaal de snelste
 * round-trip, en geen absolute bovengrens — de aanroeper kent zijn netwerkbudget
 * beter dan deze module.
 */
const DEFAULT_OPTIONS = Object.freeze({ roundTripFactor: 2, maxRoundTripMs: null });

/**
 * Vaste ondergrenzen van het round-trip-filter. Bewust GEEN opties: het zijn geen
 * netwerkbudgetten van de aanroeper maar de voorwaarden waaronder de mediaan überhaupt
 * iets betekent. Zie `estimateOffset` voor de motivatie per constante.
 *
 * `minRoundTripSlackMs = 30`: absolute ondergrens onder de relatieve drempel. Onder
 * ongeveer 30 ms verschil zegt "de ene round-trip was sneller" niets over kwaliteit —
 * dat is scheduler-, GC- en wifi-jitter, geen meetbaar beter pad. Zonder deze bodem is
 * de drempel puur relatief en kan één supersnelle meting (een gecachete response met
 * `roundTripMs` 0 of 1) alle normale samples wegfilteren.
 *
 * `minCrossCheckSamples = 3`: zoveel van de snelste samples doen altijd mee, ook als de
 * drempel ze afwijst. Drie is het kleinste aantal waarbij een mediaan een meerderheid
 * kán hebben; bij één sample is er geen enkele kruiscontrole en dicteert die ene meting
 * de hele roomtijdlijn (ARCHITECTURE.md principe 2).
 */
const FILTER_LIMITS = Object.freeze({ minRoundTripSlackMs: 30, minCrossCheckSamples: 3 });

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
 *    sample is per definitie een onnauwkeurige sample. Boven `maxRoundTripMs` valt
 *    een sample af als de aanroeper die grens zet, en verder geldt de drempel
 *    hieronder. De snelste sample overleeft altijd.
 * 2. Mediaan. Een gemiddelde is lineair in álle waarden: één sample die er 900 s
 *    naast zit verschuift het gemiddelde met 900 s / n en kaapt de schatting. De
 *    mediaan verschuift bij één uitschieter hooguit één rangpositie — bij drie
 *    goede samples verandert hij zelfs helemaal niet.
 * De twee stappen vangen verschillende storingen: het filter haalt de traag-maar-
 * plausibele samples weg, de mediaan de snelle-maar-onzinnige. Beide zijn nodig.
 * Bij een even aantal gebruikte samples is de mediaan het gemiddelde van de twee
 * middelste waarden (standaarddefinitie).
 *
 * DE DREMPEL IS RELATIEF *EN* ABSOLUUT — en houdt altijd minstens drie samples over:
 *   drempel = max(best * roundTripFactor, best + minRoundTripSlackMs)
 * Een puur relatieve drempel schaalt mee met `best` en stort daardoor in zodra één
 * sample veel sneller is dan de rest: bij `best = 0` (een gecachete `/api/v1/time`-
 * response) is `best * factor` óók 0, en dan overleeft alleen die ene sample. De
 * schatting hangt dan volledig aan de meest verdachte meting, terwijl `usedCount 1`
 * plus een piepkleine `uncertaintyMs` juist maximaal vertrouwen uitstralen. De
 * absolute bodem vangt het jitter-bereik af; `minCrossCheckSamples` garandeert
 * daarnaast dat de snelste samples nooit alleen komen te staan, ongeacht schaal. Dat
 * kost precisie wanneer één snelle sample tussen veel trage staat — die trage samples
 * tellen dan mee — maar `uncertaintyMs` rapporteert die prijs eerlijk, en géén enkele
 * meting mag in haar eentje de roomtijdlijn bepalen. `maxRoundTripMs` blijft hard: de
 * aanvulling kiest alleen uit samples die binnen het budget van de aanroeper vielen.
 *
 * RANDGEVALLEN, expliciet: geen array → INVALID_SAMPLE_LIST; lege lijst →
 * NO_SAMPLES; alles verworpen → NO_USABLE_SAMPLES (ook als álles een teruggesprongen
 * klok was: de aanroeper moet dan hoe dan ook opnieuw meten); precies één bruikbaar
 * sample → ok met `usedCount: 1` en spreiding 0. In dat laatste geval is er geen
 * enkele kruiscontrole en moet de aanroeper op `uncertaintyMs` afgaan.
 *
 * BETROUWBAARHEID — elk veld hoort bij een andere vraag:
 * - `uncertaintyMs` = `worstUsedRoundTripMs / 2`, de bovengrens op de fout van de
 *   GEBRUIKTE set bij maximaal asymmetrische vertraging. Niet `best / 2`: de mediaan
 *   kan uit elk gebruikt sample komen, dus de grens van het traagste gebruikte
 *   sample geldt voor de uitkomst.
 * - `usedRoundTripSpreadMs` (over de gebruikte samples) versus
 *   `measuredRoundTripSpreadMs` (over álle samples die de validatie en
 *   `maxRoundTripMs` haalden): de eerste zegt hoe homogeen het bewijs is, de tweede
 *   hoe stabiel het net was. Alleen de eerste rapporteren liegt precies wanneer het
 *   net het onrustigst was, want het filter houdt juist de uitschieters buiten.
 * - `offsetSpreadMs` (max − min) en `offsetMadMs` (mediane absolute afwijking) gaan
 *   over de offsets zelf: hoe erg zijn de samples het ONEENS? De MAD negeert een
 *   enkele uitschieter en is dus de "typische" onenigheid; `offsetSpreadMs` ziet ook
 *   een gecorreleerde meerderheid, waar de MAD 0 blijft (aanname 5).
 * - `negativeRoundTripCount` telt samples met `t2 < t0`. Dat is geen gewone
 *   uitschieter maar bewijs dat de LOKALE klok tijdens het meten is verzet, dus dat
 *   ook de overgebleven samples verdacht zijn; daarom apart van `discardedCount`.
 * Deze module bepaalt bewust GEEN drempel — hersyncbeleid ligt bij de aanroeper
 * (open punt 3).
 * @param {TimeSample[]} samples
 * @param {EstimateOptions} [options]
 * @returns {{
 *   ok: true, offsetMs: number, sampleCount: number, usedCount: number,
 *   discardedCount: number, negativeRoundTripCount: number, bestRoundTripMs: number,
 *   worstUsedRoundTripMs: number, usedRoundTripSpreadMs: number,
 *   worstMeasuredRoundTripMs: number, measuredRoundTripSpreadMs: number,
 *   uncertaintyMs: number, offsetSpreadMs: number, offsetMadMs: number,
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
  let negativeRoundTripCount = 0;
  for (const sample of samples) {
    const result = computeOffsetFromSample(sample);
    if (!result.ok) {
      // Een teruggesprongen lokale klok is geen gewone meetfout: apart tellen.
      if (result.code === ERROR_CODES.NEGATIVE_ROUND_TRIP) {
        negativeRoundTripCount += 1;
      }
      continue;
    }
    // Te trage samples verdwijnen stil; ze komen terug in discardedCount, zodat de
    // aanroeper kan besluiten opnieuw te meten.
    if (result.roundTripMs <= cap) {
      measured.push(result);
    }
  }
  if (measured.length === 0) {
    return reject(ERROR_CODES.NO_USABLE_SAMPLES);
  }

  // Kopie sorteren: de array van de aanroeper blijft ongemoeid. Oplopend op
  // round-trip, zodat "de snelste n" en "alles onder de drempel" hetzelfde voorstuk
  // van de lijst zijn.
  const ranked = measured.slice().sort((a, b) => a.roundTripMs - b.roundTripMs);
  const bestRoundTripMs = ranked[0].roundTripMs;
  const worstMeasuredRoundTripMs = ranked[ranked.length - 1].roundTripMs;

  const threshold = Math.max(
    bestRoundTripMs * config.roundTripFactor,
    bestRoundTripMs + FILTER_LIMITS.minRoundTripSlackMs,
  );
  const minKeep = Math.min(FILTER_LIMITS.minCrossCheckSamples, ranked.length);
  const used = [];
  for (const item of ranked) {
    if (item.roundTripMs <= threshold || used.length < minKeep) {
      used.push(item);
    }
  }
  const worstUsedRoundTripMs = used[used.length - 1].roundTripMs;

  // Expliciete comparator: Array#sort sorteert standaard als string, en offsets zijn
  // getallen van wisselend teken en wisselende lengte ([8, 90, 999] zou 8 als mediaan
  // geven). `map` levert een nieuwe array op, dus `used` blijft op round-trip-volgorde.
  const offsets = used.map((item) => item.offsetMs).sort((a, b) => a - b);
  const offsetMs = median(offsets);
  const estimate = {
    ok: true,
    offsetMs,
    sampleCount: samples.length,
    usedCount: used.length,
    discardedCount: samples.length - used.length,
    negativeRoundTripCount,
    bestRoundTripMs,
    worstUsedRoundTripMs,
    usedRoundTripSpreadMs: worstUsedRoundTripMs - bestRoundTripMs,
    worstMeasuredRoundTripMs,
    measuredRoundTripSpreadMs: worstMeasuredRoundTripMs - bestRoundTripMs,
    uncertaintyMs: worstUsedRoundTripMs / 2,
    offsetSpreadMs: offsets[offsets.length - 1] - offsets[0],
    offsetMadMs: medianAbsoluteDeviation(offsets, offsetMs),
  };

  // Aanname 4: `ok: true` mag geen Infinity of NaN dragen. Alleen bij absurd grote
  // tijdstempels kan een verschil overlopen; dan is er geen bruikbare schatting.
  for (const key of Object.keys(estimate)) {
    if (key !== 'ok' && !Number.isFinite(estimate[key])) {
      return reject(ERROR_CODES.RESULT_OUT_OF_RANGE);
    }
  }
  return estimate;
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
  const serverTime = localNow + offsetMs;
  // Twee geldige argumenten kunnen samen tóch overlopen; Infinity is geen epoch-ms
  // waarmee een aanroeper een countdown kan tekenen (aanname 4).
  if (!Number.isFinite(serverTime)) {
    return reject(ERROR_CODES.RESULT_OUT_OF_RANGE);
  }
  return { ok: true, serverTime };
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
  const localTime = serverTimestamp - offsetMs;
  if (!Number.isFinite(localTime)) {
    return reject(ERROR_CODES.RESULT_OUT_OF_RANGE);
  }
  return { ok: true, localTime };
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
  // Na de clamp, niet ervóór: een uitkomst die naar -Infinity overloopt betekent
  // "deadline allang voorbij" en klapt terecht op 0. Alleen een resterende tijd die
  // zelf niet eindig is, is onbruikbaar (aanname 4).
  const remaining = Math.max(0, endsAtServer - (localNow + offsetMs));
  if (!Number.isFinite(remaining)) {
    return reject(ERROR_CODES.RESULT_OUT_OF_RANGE);
  }
  return { ok: true, remainingMs: remaining };
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
 * van de twee middelste waarden. Dat gemiddelde is `a / 2 + b / 2` en niet
 * `(a + b) / 2`: de tussensom kan bij twee extreme waarden overlopen naar Infinity,
 * de gehalveerde waarden nooit.
 * @param {number[]} sorted @returns {number}
 */
function median(sorted) {
  const middle = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[middle] : sorted[middle - 1] / 2 + sorted[middle] / 2;
}

/**
 * Mediane absolute afwijking rond `center`: de mediaan van |waarde - center|. Robuuste
 * maat voor de TYPISCHE onenigheid tussen de samples — één uitschieter verandert hem
 * nauwelijks. Blind voor een gecorreleerde meerderheid; daarvoor staat `offsetSpreadMs`
 * ernaast (aanname 5).
 * @param {number[]} values @param {number} center @returns {number}
 */
function medianAbsoluteDeviation(values, center) {
  return median(values.map((value) => Math.abs(value - center)).sort((a, b) => a - b));
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
  FILTER_LIMITS,
};
