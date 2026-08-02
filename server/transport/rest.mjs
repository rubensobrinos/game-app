// server/transport/rest.mjs — de REST-laag: een Fastify-plugin die de zes
// eindpunten uit `docs/multiplayer/PROTOCOL.md` §REST-endpoints aan de
// compositielaag knoopt.
//
// LIJM, GEEN DOMEINLOGICA EN GEEN EIGEN VALIDATIE.
//   - vorm-validatie  → server/protocol/ (PR3, PR10, PR5d)
//   - domeinlogica    → server/composition/ (room-lifecycle, match-lifecycle)
//   - opslag          → de DataStore-poort op `context.store`
// Dit bestand vertaalt uitsluitend tussen HTTP en die drie.
//
// DRIE HARDE REGELS
//
// 1. Elke request wordt met een `validate*Request*`-functie van de
//    protocollaag gekeurd, elke response met de bijbehorende
//    `validate*Response`-variant. Een response die zijn eigen validator niet
//    haalt is een SERVERFOUT (500) — nooit stilzwijgend doorgeven.
// 2. Geen enkele code die niet in `ALL_ERROR_CODES` staat verlaat dit bestand.
//    De interne codes uit `server/architecture/state-machine.js`'s
//    `INTERNAL_ERROR_CODES` (vandaag `INVALID_PAUSE_STATE`, besluit 12) worden
//    op een gepubliceerde code afgebeeld — zie `toPublishedErrorCode`. Geen
//    stacktraces, geen `error.message` in een responsbody.
// 3. Tijden zijn absoluut in epoch-ms en komen uit `context.now()`. Dit bestand
//    roept `Date.now()` niet aan.
//
// Er wordt hier niet gelogd op het requestpad (geen `console.log`): Fastify's
// eigen logger is de enige logweg en die staat standaard uit in `buildServer`.

import { ALL_ERROR_CODES } from '../protocol/error-codes.mjs';
import { buildErrorPayload } from '../protocol/error-payload.mjs';
import { parseBearerAuthHeader } from '../protocol/auth-shape.mjs';
import { hashToken } from '../protocol/auth-session.mjs';
import {
  hostParticipatesInvariantHolds,
  validateCreateGameRequest,
  validateCreateGameResponse,
  validateJoinGameRequest,
  validateJoinGameResponse,
} from '../protocol/rest-games-create-join.mjs';
import {
  validateGetStateRequestShape,
  validateLeaveGameRequestShape,
  validateTimeResponse,
} from '../protocol/rest-games-session.mjs';
import { validatePreviewRequest, validatePreviewResponse } from '../protocol/preview-endpoint.mjs';
import { assertNoActiveRoundAnswerLeak, validateSnapshotShape } from '../protocol/snapshot-shape.mjs';
import { verifySessionToken } from '../composition/context.mjs';
import { createRoom, joinRoom, previewInvite } from '../composition/room-lifecycle.mjs';
import { buildSnapshot } from '../composition/match-lifecycle.mjs';
import { assertPlayerShape } from '../data/types/player.js';

/** @typedef {import('../composition/context.mjs').Context} Context */
/** @typedef {import('../protocol/error-codes.mjs').ErrorCode} ErrorCode */

/**
 * Het pad-prefix waaronder deze plugin hoort te worden geregistreerd
 * (`fastify.register(restRoutes, { context, prefix: REST_PREFIX })`).
 *
 * De routes hieronder staan bewust RELATIEF. Zo blijft `setNotFoundHandler`
 * hieronder beperkt tot `/api/v1/**` en houdt het entrypoint zijn eigen
 * 404-/SPA-afhandeling voor alle niet-API-paden — twee `setNotFoundHandler`s
 * voor hetzelfde prefix zou Fastify weigeren.
 */
export const REST_PREFIX = '/api/v1';

// ─────────────────────────────────────────────────────────────────────────────
// Foutcodes → HTTP
// ─────────────────────────────────────────────────────────────────────────────

/**
 * De code waarop élke niet-gepubliceerde code wordt afgebeeld.
 *
 * Bewust dezelfde keuze als `toWireCode()` in
 * `server/composition/match-lifecycle.mjs`, zodat er niet twee verschillende
 * afbeeldingen van interne codes in de codebase staan. `INVALID_PHASE` is de
 * dichtstbijzijnde gepubliceerde code voor de interne codes die vandaag
 * bestaan (`INVALID_PAUSE_STATE` is per definitie een fase-/pauzefout).
 * @type {ErrorCode}
 */
const FALLBACK_WIRE_CODE = 'INVALID_PHASE';

/**
 * Marker voor HTTP 500. Bewust GEEN domeincode en bewust niet toegevoegd aan
 * `ALL_ERROR_CODES`: dit zegt "de server heeft gefaald", niet "je actie mocht
 * niet". De client valt hierop terug op zijn generieke boodschap
 * (`client/flow/edge-case-messaging.mjs` → `UNKNOWN_ERROR`). Zie het
 * handoff-item: `PROTOCOL.md` legt voor REST geen 500-vorm vast.
 */
const INTERNAL_ERROR_MARKER = 'INTERNAL_ERROR';

/**
 * `PROTOCOL.md` koppelt geen HTTP-statuscodes aan zijn foutcodes — het
 * document beschrijft de code en de veilige metadata, niet het HTTP-omhulsel.
 * Deze tabel is dus een TOEPASSINGSKEUZE van de transportlaag, op één plek,
 * zodat alle zes eindpunten dezelfde afbeelding gebruiken:
 *
 *   400 vormfout in de aanvraag · 401 geen/ongeldige sessie ·
 *   403 wel geauthenticeerd maar niet toegestaan · 404 bestaat niet ·
 *   409 botst met de huidige toestand · 429 te vaak
 *
 * @type {Readonly<Record<ErrorCode, number>>}
 */
const HTTP_STATUS_BY_ERROR_CODE = Object.freeze({
  // Room en join
  GAME_NOT_FOUND: 404,
  INVITE_INVALID: 400,
  // Toegevoegd door PR na de slotlichting: een request die zijn eigen schema
  // niet haalt, zonder dat er een invite in het spel is. Vervangt het
  // misleidende INVITE_INVALID bij bijvoorbeeld een ontbrekende `preset` in
  // POST /games — de UI toonde daar een melding over een ongeldige
  // uitnodiging bij een fout die niets met uitnodigingen te maken had.
  INVALID_REQUEST: 400,
  GAME_FULL: 409,
  GAME_ALREADY_STARTED: 409,
  LATE_JOIN_DISABLED: 403,
  ROOM_LOCKED: 403,
  CODE_RATE_LIMITED: 429,
  // Autorisatie
  TOKEN_INVALID: 401,
  TOKEN_EXPIRED: 401,
  SESSION_REVOKED: 401,
  NOT_HOST: 403,
  NOT_PLAYER: 403,
  // Game en ronde
  INVALID_PHASE: 409,
  ROUND_NOT_ACTIVE: 409,
  PLAYER_NOT_ELIGIBLE: 403,
  ALREADY_ANSWERED: 409,
  DEADLINE_PASSED: 409,
  INVALID_ANSWER_FORMAT: 400,
  UNSUPPORTED_EVENT: 400,
  // Input
  NAME_TOO_LONG: 400,
  NAME_INVALID: 400,
  RATE_LIMITED: 429,
  PROTOCOL_VERSION_UNSUPPORTED: 400,
});

// Fail fast bij module-load: de tabel hierboven moet elke gepubliceerde code
// dekken. Anders zou een nieuwe code stilletjes op de default-status landen.
for (const code of ALL_ERROR_CODES) {
  if (typeof HTTP_STATUS_BY_ERROR_CODE[code] !== 'number') {
    throw new Error(`rest: geen HTTP-status afgesproken voor foutcode "${code}"`);
  }
}

/**
 * Beeldt een willekeurige code uit de compositie- of protocollaag af op een
 * code die de client kent. Dit is de enige plek waar dat gebeurt — regel 2.
 *
 * @param {unknown} code
 * @returns {ErrorCode}
 */
export function toPublishedErrorCode(code) {
  return typeof code === 'string' && ALL_ERROR_CODES.has(/** @type {ErrorCode} */ (code))
    ? /** @type {ErrorCode} */ (code)
    : FALLBACK_WIRE_CODE;
}

/**
 * @param {ErrorCode} code - moet al door `toPublishedErrorCode` zijn gegaan.
 * @returns {number}
 */
export function httpStatusForErrorCode(code) {
  return HTTP_STATUS_BY_ERROR_CODE[code] ?? 500;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sessie-lookup — de enige plek die de poortsignatuur kent
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Zoekt de sessie bij een aangeboden bearer token op via de DataStore-poort.
 *
 * **DIT IS DE ENIGE PLEK IN DE TRANSPORTLAAG DIE `loadSessionByTokenHash`
 * AANROEPT.** Bewust geïsoleerd: `docs/integration-plan/HANDOFF-INTB.md`
 * INTB-10 staat open — er bestaat nog geen Redis-sleutel voor een tokenhash,
 * de signatuur draagt geen `roomId`, en de rotatie-uitspraak ontbreekt. Als die
 * signatuur verandert, verandert alleen deze functie mee.
 *
 * Er wordt hier NIETS over Redis-sleutels aangenomen: de functie kent alleen
 * `store.loadSessionByTokenHash(tokenHash) → Session | null` uit
 * `server/data/repository.js`.
 *
 * PEPPERROTATIE — de opgeslagen `tokenHash` draagt zijn eigen pepperversie als
 * prefix (`${version}:${hex}`, `auth-session.mjs`). Een sessie die met een
 * ÓUDE pepper is gehasht heeft dus een andere hash dan de actieve pepper nu
 * oplevert. Daarom wordt elke nog geldige pepperversie geprobeerd — precies
 * hetzelfde patroon dat `findRoomByInviteId()` in `room-lifecycle.mjs` voor de
 * invite-index gebruikt. Zonder dit zou een pepperrotatie iedereen uitloggen.
 *
 * De gevonden sessie wordt daarna nóg een keer constant-time geverifieerd tegen
 * zijn eigen `tokenHash` (`verifySessionToken`, besluit 26). Dat is geen
 * dubbelop: INTB-10 punt 4 beschrijft precies het geval waarin de tokenindex
 * naar een sessie blijft wijzen waarvan het token inmiddels is vervangen. Een
 * index-hit is dus geen bewijs; de opgeslagen hash is dat wel.
 *
 * @param {Context} context
 * @param {string} token - het kale bearer token uit de `Authorization`-header.
 * @returns {Promise<import('../data/types/session.js').Session | null>}
 */
async function loadSessionByBearerToken(context, token) {
  const { version, peppers } = context.config.tokenPeppers;
  const versions = [version, ...Object.keys(peppers).filter((candidate) => candidate !== version)];
  for (const pepperVersion of versions) {
    const tokenHash = hashToken(token, { version: pepperVersion, pepper: peppers[pepperVersion] });
    const session = await context.store.loadSessionByTokenHash(tokenHash);
    if (session !== null && session !== undefined && verifySessionToken(context, token, session.tokenHash)) {
      return session;
    }
  }
  return null;
}

/**
 * Authenticeert een request: header-vorm → sessie-lookup → revocatiecheck.
 *
 * Volgorde bewust gelijk aan `room-lifecycle.mjs#resolveSession`: pas ná een
 * geslaagde tokenmatch wordt gemeld dat een sessie is ingetrokken, zodat een
 * verkeerd token dat niet verklapt.
 *
 * @param {Context} context
 * @param {string | undefined | null} authorizationHeader
 * @returns {Promise<{ ok: true, value: { session: object, token: string } }
 *   | { ok: false, code: ErrorCode }>}
 */
export async function authenticateRequest(context, authorizationHeader) {
  const parsed = parseBearerAuthHeader(authorizationHeader);
  if (!parsed.ok) {
    return { ok: false, code: parsed.code };
  }
  const session = await loadSessionByBearerToken(context, parsed.token);
  if (session === null) {
    return { ok: false, code: 'TOKEN_INVALID' };
  }
  if (session.revoked === true) {
    return { ok: false, code: 'SESSION_REVOKED' };
  }
  return { ok: true, value: { session, token: parsed.token } };
}

// ─────────────────────────────────────────────────────────────────────────────
// Antwoordhulpjes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stuurt een foutrespons. `buildErrorPayload` is het tweede vangnet: die
 * wérpt op een niet-gepubliceerde code, dus een code die om wat voor reden dan
 * ook langs `toPublishedErrorCode` glipt wordt een 500 in plaats van een lek.
 * @param {import('fastify').FastifyReply} reply
 * @param {unknown} code
 */
function sendError(reply, code) {
  const wireCode = toPublishedErrorCode(code);
  return reply.code(httpStatusForErrorCode(wireCode)).send(buildErrorPayload(wireCode));
}

/**
 * Serverfout: 500 zonder enig detail over wat er misging. `meta` blijft leeg —
 * debugdetails gaan alleen naar serverlogs (`PROTOCOL.md` §Foutcodes).
 * @param {import('fastify').FastifyReply} reply
 */
function sendInternalError(reply) {
  return reply.code(500).send({ code: INTERNAL_ERROR_MARKER, meta: {} });
}

/**
 * Keurt een uitgaande body met de bijbehorende protocol-validator en stuurt
 * hem pas dán. Faalt de validatie, dan is dat per definitie een serverfout:
 * de compositielaag heeft iets opgeleverd dat het contract niet haalt.
 * @param {import('fastify').FastifyReply} reply
 * @param {number} status
 * @param {object} body
 * @param {(body: unknown) => { ok: boolean }} validate
 */
function sendValidatedResponse(reply, status, body, validate) {
  if (!validate(body).ok) {
    return sendInternalError(reply);
  }
  return reply.code(status).send(body);
}

/**
 * Zoekt de room bij een `{code}`-pathparameter op en controleert dat de
 * geauthenticeerde sessie ook echt bij díé room hoort.
 *
 * Een sessie van een andere room krijgt `GAME_NOT_FOUND` en niet
 * `NOT_PLAYER`/`TOKEN_INVALID`: het bestaan van een room waar je niets te
 * zoeken hebt is zelf al informatie.
 *
 * @param {Context} context
 * @param {string} code
 * @param {{ roomId: string }} session
 * @returns {Promise<{ ok: true, value: object } | { ok: false, code: ErrorCode }>}
 */
async function resolveRoomForSession(context, code, session) {
  const room = await context.store.loadRoomByCode(code);
  if (room === null || room.id !== session.roomId) {
    return { ok: false, code: 'GAME_NOT_FOUND' };
  }
  return { ok: true, value: room };
}

/**
 * Bouwt de snapshot die als `state` in de create/join-response meegaat.
 * Levert `null` op wanneer de compositie hem niet kan bouwen — de aanroeper
 * maakt daar een 500 van, want een net aangemaakte/gejoinde room hoort altijd
 * een snapshot te hebben.
 * @param {Context} context
 * @param {string} roomId
 * @param {string} sessionId
 * @returns {Promise<object | null>}
 */
async function snapshotFor(context, roomId, sessionId) {
  const snapshot = await buildSnapshot(context, { roomId, sessionId });
  return snapshot.ok ? snapshot.value : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// De plugin
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fastify-plugin met de zes REST-eindpunten.
 *
 * `getSockets` is de brug naar de socketlaag. Hij is een GETTER en geen waarde:
 * `server/index.mjs` haakt de socketlaag pas op `fastify.server` aan ná
 * `ready()`, dus ná de registratie van deze plugin. Een meegegeven waarde zou
 * hier voor altijd `null` zijn. Ontbreekt hij (of levert hij `null` op, zoals in
 * elke test die zonder sockets draait), dan blijven de eindpunten precies doen
 * wat ze deden — alleen zonder broadcast.
 *
 * @param {import('fastify').FastifyInstance} fastify
 * @param {{ context: Context, getSockets?: () => (object | null) }} options
 */
export default async function restRoutes(fastify, options) {
  const { context, getSockets = () => null } = options;
  if (context === undefined || context === null) {
    throw new TypeError('restRoutes: `options.context` is verplicht (zie server/composition/context.mjs).');
  }

  /**
   * Stuurt `room:player-changed` room-breed via de socketlaag.
   *
   * WAAROM DIT HIER STAAT: `POST /games/join` en `POST /{code}/leave` lopen niet
   * over de socket, terwijl de rest van de room wél over de socket meekijkt.
   * `socket.mjs` exporteert `broadcastPlayerChanged` speciaal voor deze twee
   * paden; zonder deze aanroep ziet een lobby nooit een nieuwe speler
   * binnenkomen. De PAYLOAD wordt hier niet samengesteld: `playerCount` en de
   * eventvorm komen uit de socketlaag, zodat er geen tweede telregel ontstaat.
   *
   * Een mislukte broadcast mag de HTTP-respons NOOIT omzetten in een fout: de
   * join/leave is dan al doorgevoerd en een 500 zou de client laten denken dat
   * hij niet in de room zit. Hij wordt gelogd via Fastify's eigen logger (de
   * enige logweg hier) en verder genegeerd.
   *
   * `delta.type` kent vier waarden (`server-events-room-lifecycle.mjs`). Twee
   * daarvan lopen hierlangs (`join`, `leave`); `kick` stuurt `socket.mjs` zelf
   * al bij `game:kick`. `rename` heeft nog nergens een pad: `player:rename`
   * bestaat als clientevent, maar `server/composition/room-lifecycle.mjs` heeft
   * geen hernoemfunctie, dus `socket.mjs` weigert het event met
   * `UNSUPPORTED_EVENT`. Zodra die compositiefunctie er is, hoort de broadcast
   * dáár te gebeuren (rename loopt over de socket, niet over REST) — niet hier.
   *
   * @param {import('fastify').FastifyRequest} request
   * @param {string} roomId
   * @param {{ type: 'join' | 'leave' | 'rename' | 'kick', playerId: string }} delta
   * @returns {Promise<boolean>} of er daadwerkelijk is uitgezonden
   */
  async function broadcastPlayerChanged(request, roomId, delta) {
    if (typeof delta.playerId !== 'string' || delta.playerId.length === 0) {
      return false;
    }
    const sockets = getSockets();
    if (sockets === null || sockets === undefined || typeof sockets.broadcastPlayerChanged !== 'function') {
      return false;
    }
    try {
      await sockets.broadcastPlayerChanged(roomId, delta);
      return true;
    } catch {
      // Geen `error.message` en geen stacktrace in de log — regel 2.
      request.log?.warn?.({ layer: 'rest', roomId, delta: delta.type }, 'room:player-changed niet verstuurd');
      return false;
    }
  }

  // Fastify's eigen JSON-parser maakt van een lege body een 400 in ZIJN
  // foutvorm (`{ statusCode, error, message }`), en die vorm kent de client
  // niet. `POST /{code}/leave` heeft bovendien helemaal geen body nodig
  // (`PROTOCOL.md` documenteert er geen). Daarom een eigen parser: leeg → `{}`,
  // onparseerbaar → `INVITE_INVALID` in ónze foutvorm.
  fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (request, body, done) => {
    if (typeof body !== 'string' || body.trim().length === 0) {
      done(null, {});
      return;
    }
    try {
      done(null, JSON.parse(body));
    } catch {
      done(withProtocolCode(new Error('malformed json'), 'INVITE_INVALID'), undefined);
    }
  });

  // Alles wat binnen deze plugin werpt komt hier uit. Een fout met een
  // `protocolCode` is een bekende, veilige afwijzing; al het andere is een
  // serverfout en levert 500 zonder detail — nooit een stacktrace.
  fastify.setErrorHandler((error, request, reply) => {
    if (typeof error?.protocolCode === 'string') {
      return sendError(reply, error.protocolCode);
    }
    return sendInternalError(reply);
  });

  // Een onbekend pad binnen /api/v1 is geen room: `GAME_NOT_FOUND` in de
  // gedeelde foutvorm in plaats van Fastify's eigen 404-vorm.
  fastify.setNotFoundHandler((request, reply) => sendError(reply, 'GAME_NOT_FOUND'));

  // ── POST /api/v1/games ─────────────────────────────────────────────────────
  fastify.post('/games', async (request, reply) => {
    const validated = validateCreateGameRequest(request.body);
    if (!validated.ok) {
      return sendError(reply, validated.code);
    }

    const created = await createRoom(context, {
      config: validated.value.config,
      hostParticipates: validated.value.hostParticipates,
      displayName: validated.value.displayName,
    });
    if (!created.ok) {
      return sendError(reply, created.code);
    }

    const state = await snapshotFor(context, created.value.roomId, created.value.sessionId);
    if (state === null) {
      return sendInternalError(reply);
    }

    // Expliciet opgebouwd, niet doorgegeven: `createRoom` levert ook
    // `inviteHash` en `sessionId`, en die horen geen van beide op de wire.
    const body = {
      roomId: created.value.roomId,
      gameCode: created.value.gameCode,
      inviteId: created.value.inviteId,
      joinUrl: created.value.joinUrl,
      sessionToken: created.value.sessionToken,
      roles: created.value.roles,
      playerId: created.value.playerId,
      effectiveName: created.value.effectiveName,
      state,
    };

    // Twee keuringen: de vorm én de cross-field-invariant uit PROTOCOL.md
    // ("bij hostParticipates=false zijn playerId en effectiveName null").
    if (!validateCreateGameResponse(body).ok
      || !hostParticipatesInvariantHolds(validated.value, body)) {
      return sendInternalError(reply);
    }
    return reply.code(201).send(body);
  });

  // ── POST /api/v1/games/join ────────────────────────────────────────────────
  fastify.post('/games/join', async (request, reply) => {
    const validated = validateJoinGameRequest(request.body);
    if (!validated.ok) {
      return sendError(reply, validated.code);
    }

    const joined = await joinRoom(context, validated.value);
    if (!joined.ok) {
      return sendError(reply, joined.code);
    }

    // De rest van de room hoort de nieuwe speler te zien verschijnen.
    //
    // VOLGORDE IS HIER BETEKENISVOL: eerst uitzenden, dán pas de snapshot voor
    // de respons bouwen. De snapshot krijgt daarmee een `serverTime` die nooit
    // LAGER is dan die van het event. Andersom zou de client zijn eigen
    // join-snapshot als achterhaald kunnen afwijzen: het socketevent is er
    // altijd eerder dan de HTTP-respons, dus met een oudere snapshot slaat de
    // precedentieregel (`shared/protocol/snapshot-precedence.mjs`, basisregel 6)
    // terecht `STALE_SNAPSHOT` — op de verkeerde boodschap.
    await broadcastPlayerChanged(request, joined.value.roomId, {
      type: 'join',
      playerId: joined.value.playerId,
    });

    const state = await snapshotFor(context, joined.value.roomId, joined.value.sessionId);
    if (state === null) {
      return sendInternalError(reply);
    }

    // Zonder `sessionId`/`joinSource`: die zijn intern resp. een echo van de
    // aanvraag, en `PROTOCOL.md`'s responsvorm noemt ze niet.
    const body = {
      roomId: joined.value.roomId,
      gameCode: joined.value.gameCode,
      sessionToken: joined.value.sessionToken,
      roles: joined.value.roles,
      playerId: joined.value.playerId,
      effectiveName: joined.value.effectiveName,
      state,
    };
    return sendValidatedResponse(reply, 200, body, validateJoinGameResponse);
  });

  // ── GET /api/v1/games/preview ──────────────────────────────────────────────
  fastify.get('/games/preview', async (request, reply) => {
    const validated = validatePreviewRequest(request.query);
    if (!validated.ok) {
      return sendError(reply, validated.code);
    }

    const preview = await previewInvite(context, { inviteId: validated.value.inviteId });
    if (!preview.ok) {
      return sendError(reply, preview.code);
    }
    return sendValidatedResponse(reply, 200, preview.value, validatePreviewResponse);
  });

  // ── GET /api/v1/games/:code/state ──────────────────────────────────────────
  fastify.get('/games/:code/state', async (request, reply) => {
    const validated = validateGetStateRequestShape({
      code: request.params?.code,
      authorizationHeader: request.headers.authorization,
    });
    if (!validated.ok) {
      return sendError(reply, validated.code);
    }

    const authenticated = await authenticateRequest(context, request.headers.authorization);
    if (!authenticated.ok) {
      return sendError(reply, authenticated.code);
    }
    const { session } = authenticated.value;

    const located = await resolveRoomForSession(context, validated.value.code, session);
    if (!located.ok) {
      return sendError(reply, located.code);
    }

    const snapshot = await buildSnapshot(context, { roomId: located.value.id, sessionId: session.id });
    if (!snapshot.ok) {
      return sendError(reply, snapshot.code);
    }

    // Twee keuringen, allebei blokkerend. `assertNoActiveRoundAnswerLeak` is de
    // invariant "een snapshot bevat nooit het correcte antwoord van een actieve
    // ronde"; `validateSnapshotShape` is de vormcheck. Zie het handoff-item:
    // die tweede faalt vandaag op een LOBBY-snapshot, omdat de validator een
    // niet-lege `matchId` en een `matchSequence >= 1` eist die vóór de eerste
    // match niet bestaan. Bewust niet omheen gebouwd.
    if (!assertNoActiveRoundAnswerLeak(snapshot.value).ok
      || !validateSnapshotShape(snapshot.value).ok) {
      return sendInternalError(reply);
    }
    return reply.code(200).send(snapshot.value);
  });

  // ── POST /api/v1/games/:code/leave ─────────────────────────────────────────
  //
  // GAT — er bestaat geen `leaveRoom()` in server/composition/. Besluit 4
  // ("vrijwillig verlaten zet `left: true` maar trekt het sessietoken niet in")
  // is nergens als compositiefunctie gerealiseerd; `kickPlayer()` doet
  // uitdrukkelijk iets anders (zet `kicked` én trekt de sessie in). Hieronder
  // staat daarom de minimale bedrading die besluit 4 nakomt, met `roomId` uit
  // de sessie en `assertPlayerShape` als vangnet. Zie het handoff-item: dit
  // hoort in room-lifecycle.mjs te verhuizen, inclusief de TTL-verlenging
  // (`touchRoom`) die hier nog ontbreekt. Het `room:player-changed`-event wordt
  // hieronder wél verstuurd — dat is transportwerk en hoort hier.
  fastify.post('/games/:code/leave', async (request, reply) => {
    const validated = validateLeaveGameRequestShape({
      code: request.params?.code,
      authorizationHeader: request.headers.authorization,
    });
    if (!validated.ok) {
      return sendError(reply, validated.code);
    }

    const authenticated = await authenticateRequest(context, request.headers.authorization);
    if (!authenticated.ok) {
      return sendError(reply, authenticated.code);
    }
    const { session } = authenticated.value;

    const located = await resolveRoomForSession(context, validated.value.code, session);
    if (!located.ok) {
      return sendError(reply, located.code);
    }

    // "Vereist spelerrol" (PROTOCOL.md §leave): een host die niet meespeelt
    // heeft `roles: ['host']` en `playerId: null` en kan dus niets verlaten.
    if (!Array.isArray(session.roles) || !session.roles.includes('player') || session.playerId === null) {
      return sendError(reply, 'NOT_PLAYER');
    }

    const player = await context.store.loadPlayer(located.value.id, session.playerId);
    if (player === null) {
      return sendError(reply, 'NOT_PLAYER');
    }

    if (player.left !== true) {
      const left = { ...player, left: true };
      assertPlayerShape(left);
      await context.store.savePlayer(left);
      // Alleen bij een ECHTE overgang: een tweede `leave` van dezelfde speler
      // verandert niets en hoort de room dus ook niets te melden.
      await broadcastPlayerChanged(request, located.value.id, {
        type: 'leave',
        playerId: session.playerId,
      });
    }

    // `PROTOCOL.md` documenteert geen responsbody voor dit eindpunt en er is
    // dus ook geen `validate*Response` om tegenaan te houden. `{ left: true }`
    // is het minimum waar `client/flow/leave-state.mjs`'s LEFT-transitie op kan
    // aanslaan; zie het handoff-item.
    return reply.code(200).send({ left: true });
  });

  // ── GET /api/v1/time ───────────────────────────────────────────────────────
  fastify.get('/time', async (request, reply) => {
    // Epoch-ms uit de geïnjecteerde klok, niet uit `Date.now()`.
    const body = { serverTime: context.now() };
    return sendValidatedResponse(reply, 200, body, validateTimeResponse);
  });
}

/**
 * Hangt een gepubliceerde foutcode aan een `Error`, zodat de error handler hem
 * als bekende afwijzing kan herkennen in plaats van als serverfout.
 * @param {Error} error
 * @param {ErrorCode} code
 * @returns {Error}
 */
function withProtocolCode(error, code) {
  return Object.assign(error, { protocolCode: code });
}
