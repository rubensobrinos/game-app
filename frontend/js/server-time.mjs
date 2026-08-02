// server-time.mjs — UI0. Pure helpers voor de servertijd-offset en een
// aftimer-berekening, zodat geen enkele view een eigen seconde-tick op
// clienttijd hoeft bij te houden (ARCHITECTURE.md, principe 2). Elke render
// van een aftimer roept `secondsRemaining()` opnieuw aan met de dan actuele
// `Date.now()` en de eerder gemeten `offsetMs` — geen lokale teller.
//
// Contract: docs/frontend-plan/prompts/UI0-scaffold.md §Servertijd-offset.

/**
 * Eén ronde-trip naar `GET /api/v1/time` (PROTOCOL.md):
 *   - requestSentAt: lokale `Date.now()` vlak vóór het verzoek;
 *   - serverTime: de `serverTime` uit de respons van dat verzoek;
 *   - responseReceivedAt: lokale `Date.now()` vlak ná ontvangst van de respons.
 *
 * De aanroeper verzamelt meerdere van deze samples (PROTOCOL.md: "de client
 * meet meerdere samples") vóórdat `estimateServerOffset()` wordt aangeroepen.
 *
 * @typedef {{ requestSentAt: number, serverTime: number, responseReceivedAt: number }} TimeSample
 */

/**
 * Schat de offset tussen lokale klok en servertijd via het midpoint van de
 * round-trip: het aannemelijke moment waarop `serverTime` gold is het midden
 * tussen `requestSentAt` en `responseReceivedAt` (symmetrische latency
 * aangenomen, standaard NTP-achtige aanpak). `offsetMs` is dan
 * `serverTime - localMidpoint`, zodat later geldt: `Date.now() + offsetMs`
 * benadert de actuele servertijd.
 *
 * Bij meerdere samples wordt die met de kleinste round-trip gebruikt: hoe
 * korter de round-trip, hoe minder ruimte voor netwerkjitter om de schatting
 * te verstoren. Ongeldige of negatieve-round-trip samples worden genegeerd;
 * een lege of volledig ongeldige lijst levert `0` (geen correctie) op in
 * plaats van een fout te werpen — servertijdmeting is best-effort, nooit
 * blokkerend voor de rest van de UI.
 *
 * @param {TimeSample[]} samples
 * @returns {number} offsetMs
 */
export function estimateServerOffset(samples) {
  const estimates = toEstimates(samples);
  if (estimates.length === 0) {
    return 0;
  }

  let best = estimates[0];
  for (const estimate of estimates) {
    if (estimate.roundTripMs < best.roundTripMs) {
      best = estimate;
    }
  }
  return best.offsetMs;
}

/**
 * Seconden tot `endsAt`, nooit negatief. `now` wordt intern bepaald als
 * `Date.now() + offsetMs` — de aanroeper hoeft alleen de gemeten offset door
 * te geven, niet zelf een tijdstip te berekenen.
 *
 * **Gecorrigeerd na review:** een eerdere versie verving `now` door `startsAt`
 * wanneer de ronde nog niet begonnen was, met als bedoeling te voorkomen dat
 * een timer "te veel" aftelt. Dat veranderde stilzwijgend de vraag die deze
 * functie beantwoordt: voor `startsAt=10s, endsAt=15s, now=0` gaf dat `5`
 * (duur-vanaf-start) terug in plaats van het daadwerkelijke antwoord op
 * "hoeveel seconden tot endsAt" (`15`). `startsAt` wordt hier daarom niet meer
 * gebruikt — de functienaam en JSDoc beloven `endsAt - now`, niets anders.
 * Een aparte "duur vanaf start"-helper krijgt, mocht die nodig blijken, een
 * eigen naam.
 *
 * @param {number} startsAt epoch-ms (ongebruikt in de berekening; bewaard in
 *   de signatuur zodat aanroepers niet hoeven te wijzigen, zie UI0-scaffold.md)
 * @param {number} endsAt epoch-ms
 * @param {number} offsetMs
 * @returns {number} secondsRemaining (nooit negatief)
 */
export function secondsRemaining(startsAt, endsAt, offsetMs) {
  if (typeof startsAt !== 'number' || typeof endsAt !== 'number' || !Number.isFinite(startsAt) || !Number.isFinite(endsAt)) {
    return 0;
  }

  const safeOffsetMs = typeof offsetMs === 'number' && Number.isFinite(offsetMs) ? offsetMs : 0;
  const now = Date.now() + safeOffsetMs;
  const remainingMs = endsAt - now;

  return remainingMs <= 0 ? 0 : Math.ceil(remainingMs / 1000);
}

function toEstimates(samples) {
  if (!Array.isArray(samples)) {
    return [];
  }

  const estimates = [];
  for (const sample of samples) {
    if (!isValidSample(sample)) {
      continue;
    }
    const roundTripMs = sample.responseReceivedAt - sample.requestSentAt;
    if (roundTripMs < 0) {
      continue;
    }
    const localMidpoint = (sample.requestSentAt + sample.responseReceivedAt) / 2;
    estimates.push({ offsetMs: sample.serverTime - localMidpoint, roundTripMs });
  }
  return estimates;
}

function isValidSample(sample) {
  return (
    sample !== null &&
    typeof sample === 'object' &&
    Number.isFinite(sample.requestSentAt) &&
    Number.isFinite(sample.serverTime) &&
    Number.isFinite(sample.responseReceivedAt)
  );
}
