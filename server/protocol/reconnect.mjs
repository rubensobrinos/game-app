/**
 * @file Reconnect-acceptatieregels — realiseert PROTOCOL.md §Reconnect.
 * @see docs/multiplayer/PROTOCOL.md — sectie "Reconnect", Basisregel 6.
 * @see docs/protocol-plan/prompts/PR6-reconnect.md — brondocument voor deze module.
 *
 * Pure functies/generator only: geen setTimeout, geen echte socket-events,
 * geen Date.now()/Math.random() binnen de module. Eén generatorinstantie
 * representeert precies één aaneengesloten disconnect-episode; na een
 * geslaagde reconnect maakt de aanroeper een nieuwe instantie aan (de
 * volgende disconnect begint dus weer bij 1 seconde, niet waar de vorige
 * episode bleef steken).
 *
 * Dupliceert bewust niet `architecture-plan`'s AR3
 * (`shared/protocol/snapshot-precedence.mjs`, gedeeld met de client)
 * of AR4 (`server-time`) — PROTOCOL.md §Reconnect stap 5-6 (snapshot
 * opvragen, snapshot laat lokale fase/score/antwoordstatus overschrijven)
 * horen bij de aanroepende laag die die AR3/AR4-functies aanroept, niet bij
 * dit bestand. Dupliceert ook niet PR3's `auth-shape`-vormvalidatie:
 * `buildReconnectSocketAuth` hieronder roept uitsluitend een geïnjecteerde
 * validator aan (bedoeld voor `server/protocol/auth-shape.mjs`'s
 * `parseSocketAuthPayload`) in plaats van zelf `protocolVersion`/
 * tokenvorm te controleren.
 */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Genereert de backoff-vertraging (in hele seconden) voor opeenvolgende
 * reconnectpogingen binnen één disconnect-episode: 1, 2, 4, 8, 16, en
 * daarna oneindig 30 — exact PROTOCOL.md §Reconnect stap 3 ("Backoff: 1, 2,
 * 4, 8, 16, maximaal 30 seconden.").
 *
 * @returns {Generator<number, never, void>} nooit `done: true`
 */
export function* backoffDelaySeconds() {
  const rampUp = [1, 2, 4, 8, 16];
  for (const seconds of rampUp) {
    yield seconds;
  }
  while (true) {
    yield 30;
  }
}

/**
 * @typedef {{ actionId: string, ackReceived: boolean }} PendingAnswerAction
 */

/**
 * Beslist of een `round:answer`-actie na reconnect opnieuw verzonden mag
 * worden — PROTOCOL.md §Reconnect stap 7: "Een reeds geaccepteerd antwoord
 * wordt niet opnieuw verzonden, behalve als de client geen ack heeft en
 * dezelfde `actionId` kan herhalen." Er is bewust geen los
 * `candidateActionId`-argument: de enige toegestane `actionId` bij een
 * resend is die van `pendingAnswer` zelf, nooit een nieuw gegenereerde —
 * dat maakt "dezelfde actionId herhalen" een structurele garantie in plaats
 * van een aparte check.
 *
 * @param {PendingAnswerAction | null} pendingAnswer - de laatst verzonden
 *   `round:answer`-actie voor de huidige ronde, of `null` als er nog niets
 *   verstuurd is voor deze ronde
 * @returns {{ ok: true, resend: false }
 *   | { ok: true, resend: true, actionId: string }
 *   | { ok: false, reason: string }}
 */
export function resolveReconnectResend(pendingAnswer) {
  if (pendingAnswer === null) {
    return { ok: true, resend: false };
  }
  if (!isPlainObject(pendingAnswer)) {
    return { ok: false, reason: 'invalid-pending-answer-shape' };
  }
  const { actionId, ackReceived } = pendingAnswer;
  if (typeof actionId !== 'string' || actionId.length === 0) {
    return { ok: false, reason: 'missing-action-id' };
  }
  if (typeof ackReceived !== 'boolean') {
    return { ok: false, reason: 'invalid-ack-received' };
  }
  if (ackReceived) {
    // Reeds geaccepteerd (ge-ackt) — PROTOCOL.md §Reconnect stap 7: niet
    // opnieuw verzenden.
    return { ok: true, resend: false };
  }
  // Geen ack ontvangen: dezelfde actionId mag herhaald worden, nooit een
  // nieuw gegenereerde.
  return { ok: true, resend: true, actionId };
}

/**
 * @typedef {{ sessionToken: string, protocolVersion: string }} SocketAuthPayload
 */

/**
 * Bouwt en valideert de socket-handshake-payload bij reconnect. Dit is
 * bewust een dunne wrapper: de vormvalidatie zelf leeft in PR3's
 * `auth-shape`-module (`server/protocol/auth-shape.mjs`, zodra die bestaat —
 * zie `../README.md` fase PR3) en wordt hier via dependency injection
 * aangeroepen, nooit lokaal opnieuw geïmplementeerd. PROTOCOL.md
 * §Reconnect stap 4 ("Socketauth gebruikt dezelfde sessietoken.") vraagt
 * expliciet om hetzelfde schema als de eerste handshake — dus geen
 * reconnect-specifieke variant van de validatieregels, alleen van de
 * aanroep hier.
 *
 * `protocolVersion: 'v1'` hieronder is een letterlijke aanname uit
 * PROTOCOL.md §Socket-auth (het enige bestaande protocolversienummer) om de
 * payload te kunnen bouwen — geen eigen geldigheidsoordeel. Deze functie
 * voert zelf geen `protocolVersion === 'v1'`-check of
 * bearer-tokenvorm-validatie uit als vervanging voor de geïnjecteerde
 * validator: het resultaat van `validateSocketAuthPayload` wordt ongewijzigd
 * doorgegeven, ook bij afwijzing.
 *
 * Als `server/protocol/auth-shape.mjs` nog niet bestaat op het moment dat
 * je dit uitvoert: bouw eerst PR3 (zie `../README.md`) en importeer de
 * daadwerkelijke functienaam die dat oplevert. Schrijf in dit bestand geen
 * eigen `protocolVersion === 'v1'`-check of bearer-tokenvorm-validatie als
 * vervanging — dat zou de duplicatie zijn die `../README.md` fase PR6
 * expliciet uitsluit.
 *
 * @param {string} sessionToken
 * @param {(payload: unknown) => { ok: true, payload: SocketAuthPayload }
 *   | { ok: false, reason: string }} validateSocketAuthPayload - PR3's
 *   auth-shape-validator, geïnjecteerd zodat dit bestand 'm aanroept in
 *   plaats van herbouwt
 * @returns {{ ok: true, payload: SocketAuthPayload } | { ok: false, reason: string }}
 */
export function buildReconnectSocketAuth(sessionToken, validateSocketAuthPayload) {
  const payload = { sessionToken, protocolVersion: 'v1' };
  return validateSocketAuthPayload(payload);
}
