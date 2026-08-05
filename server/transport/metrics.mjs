// server/transport/metrics.mjs — de operationele metrics van de transportlaag.
//
// STAP 9 uit docs/PLAN-CONVERGENTIE.md, ontwerp uit
// docs/integration-plan/prompts/INT4b-metrics.md. Bewust klein gehouden: dit is
// de set die de vragen van de eerstvolgende pilot beantwoordt ("vielen er
// mensen uit, en waarom", "werden er antwoorden geweigerd", "hoe kwamen mensen
// binnen"), niet een dashboard vooruit.
//
// DE REGELS UIT INT4b DIE HIER ZIJN OVERGENOMEN — en waarom ze ertoe doen:
//
//  1. **Cumulatieve counters, geen per-seconde-gauges.** Een "events per
//     seconde"-waarde hangt af van het interne interval en reset bij een
//     herstart; de betekenis van de meting hangt dan af van de meter.
//     Prometheus rekent `rate(...[1m])` zelf uit.
//  2. **Histogram met vaste buckets, geen zelf berekende percentielen.** Een
//     lijst met alle metingen bijhouden geeft onbegrensd geheugen en
//     quantielen die niet over processen aggregeren.
//  3. **Strikte labelallowlist.** `roomId`, `sessionId`, `playerId`,
//     `actionId`, `eventId` zouden elke room een eigen tijdreeks geven die
//     blijft bestaan lang nadat de room weg is. `gameCode`, `inviteId` en
//     namen zijn bovendien persoonsgegevens — en metrics worden langer bewaard
//     en breder gedeeld dan logs, dus de regel is strenger dan bij de logger.
//     Alleen gesloten verzamelingen uit PROTOCOL.md mogen label zijn.
//  4. **Geen dependency.** De Prometheus-tekstvorm is klein genoeg om zelf te
//     schrijven; een client-library toevoegen is een deps-beslissing die niet
//     genomen is.
//
// BEWUST NIET GEBOUWD (zie ook het besluitverzoek):
//  - event-loop lag: vraagt een monitor met eigen levenscyclus die bij
//    `fastify.close()` uit moet; de shutdown is net gerepareerd en dit is het
//    niet waard vóór de eerste pilot;
//  - `room_size`-histogram: pas zinvol als er meer dan één room tegelijk is;
//  - alles wat de opslag betreft (rooms in Redis, TTL's) — dat is de storelaag,
//    niet de transportlaag.

/**
 * De ENIGE labelnamen die in een metricreeks mogen voorkomen. Elke waarde komt
 * uit een gesloten verzameling van het protocol, dus de kardinaliteit is per
 * constructie begrensd.
 *
 * @type {ReadonlyMap<string, string>} labelnaam → waarom hij veilig is
 */
export const ALLOWED_LABELS = new Map([
  ['event', 'eventnaam uit het vaste alfabet van 14 clientevents (PROTOCOL.md)'],
  ['code', 'foutcode uit ALL_ERROR_CODES — gesloten verzameling'],
  ['outcome', 'vaste uitkomstwoorden van deze module (accepted/rejected/...)'],
  ['reason', 'disconnectreden van Socket.IO — kleine, vaste verzameling'],
  ['method', 'joinSource: qr | shared_link | code | unknown (PROTOCOL.md)'],
]);

/** Bucketgrenzen in seconden (INT4b). De `+Inf`-bucket komt er bij render bij. */
const DURATION_BUCKETS = Object.freeze([0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2]);

/** Waarden die nooit als labelwaarde mogen langskomen, ook niet per ongeluk. */
const MAX_LABEL_VALUE_LENGTH = 48;

/**
 * @param {unknown} value
 * @returns {string} een veilige, korte labelwaarde
 */
function safeLabelValue(value) {
  if (typeof value !== 'string' || value.length === 0) return 'unknown';
  if (value.length > MAX_LABEL_VALUE_LENGTH) return 'unknown';
  // Alleen tekens die in de gesloten verzamelingen voorkomen. Alles daarbuiten
  // is per definitie geen bekende waarde — en zou een nieuwe tijdreeks openen.
  return /^[a-zA-Z0-9_:.-]+$/.test(value) ? value : 'unknown';
}

/**
 * @param {Record<string, unknown>} labels
 * @returns {string} de gesorteerde, gefilterde sleutel van deze reeks
 */
function seriesKey(labels) {
  const paren = Object.entries(labels)
    .filter(([naam]) => ALLOWED_LABELS.has(naam))
    .map(([naam, waarde]) => [naam, safeLabelValue(waarde)])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return JSON.stringify(paren);
}

/** @param {string} key @returns {string} de Prometheus-labelnotatie */
function renderLabels(key) {
  const paren = JSON.parse(key);
  if (paren.length === 0) return '';
  return `{${paren.map(([naam, waarde]) => `${naam}="${waarde}"`).join(',')}}`;
}

/**
 * Bouwt een register. Eén per serverproces; `buildServer` maakt hem en geeft
 * hem door aan de lagen die iets te melden hebben.
 */
export function createMetrics() {
  /** @type {Map<string, Map<string, number>>} metricnaam → reekssleutel → waarde */
  const counters = new Map();
  /** @type {Map<string, Map<string, { counts: number[], sum: number, count: number }>>} */
  const histograms = new Map();
  /** @type {Map<string, () => number>} naam → aflezing op scrape-moment */
  const gauges = new Map();

  /**
   * @param {string} name
   * @param {Record<string, unknown>} [labels]
   * @param {number} [amount]
   */
  function increment(name, labels = {}, amount = 1) {
    if (!counters.has(name)) counters.set(name, new Map());
    const reeksen = counters.get(name);
    const key = seriesKey(labels);
    reeksen.set(key, (reeksen.get(key) ?? 0) + amount);
  }

  /**
   * Neemt een duur op in seconden.
   * @param {string} name
   * @param {Record<string, unknown>} labels
   * @param {number} seconds
   */
  function observe(name, labels, seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return;
    if (!histograms.has(name)) histograms.set(name, new Map());
    const reeksen = histograms.get(name);
    const key = seriesKey(labels);
    if (!reeksen.has(key)) {
      reeksen.set(key, { counts: DURATION_BUCKETS.map(() => 0), sum: 0, count: 0 });
    }
    const reeks = reeksen.get(key);
    for (let i = 0; i < DURATION_BUCKETS.length; i += 1) {
      if (seconds <= DURATION_BUCKETS[i]) reeks.counts[i] += 1;
    }
    reeks.sum += seconds;
    reeks.count += 1;
  }

  /**
   * Een gauge wordt PAS bij het scrapen afgelezen, niet handmatig op- en
   * afgeteld (INT4b): één gemiste callback bij disconnect of kick zou een
   * gauge anders permanent verkeerd laten staan.
   * @param {string} name
   * @param {() => number} read
   */
  function setGauge(name, read) {
    gauges.set(name, read);
  }

  /** @returns {string} de volledige Prometheus-tekstuitvoer */
  function render() {
    const regels = [];

    for (const [naam, read] of [...gauges.entries()].sort()) {
      let waarde = 0;
      try {
        waarde = read();
      } catch {
        waarde = 0; // een kapotte aflezing mag de hele scrape niet slopen
      }
      regels.push(`# TYPE ${naam} gauge`, `${naam} ${Number.isFinite(waarde) ? waarde : 0}`);
    }

    for (const [naam, reeksen] of [...counters.entries()].sort()) {
      regels.push(`# TYPE ${naam} counter`);
      for (const [key, waarde] of [...reeksen.entries()].sort()) {
        regels.push(`${naam}${renderLabels(key)} ${waarde}`);
      }
    }

    for (const [naam, reeksen] of [...histograms.entries()].sort()) {
      regels.push(`# TYPE ${naam} histogram`);
      for (const [key, reeks] of [...reeksen.entries()].sort()) {
        const paren = JSON.parse(key);
        const metBucket = (grens) => {
          const alle = [...paren, ['le', grens]];
          return `{${alle.map(([n, w]) => `${n}="${w}"`).join(',')}}`;
        };
        DURATION_BUCKETS.forEach((grens, i) => {
          regels.push(`${naam}_bucket${metBucket(grens)} ${reeks.counts[i]}`);
        });
        regels.push(`${naam}_bucket${metBucket('+Inf')} ${reeks.count}`);
        regels.push(`${naam}_sum${renderLabels(key)} ${reeks.sum}`);
        regels.push(`${naam}_count${renderLabels(key)} ${reeks.count}`);
      }
    }

    return `${regels.join('\n')}\n`;
  }

  return Object.freeze({ increment, observe, setGauge, render });
}

/**
 * Een register dat niets doet. Zo hoeft geen enkele aanroeper te weten of
 * metrics aan staan — geen `if (metrics)` op het hete antwoordpad.
 */
export const NOOP_METRICS = Object.freeze({
  increment() {},
  observe() {},
  setGauge() {},
  render() { return ''; },
});
