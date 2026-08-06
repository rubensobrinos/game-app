/**
 * @file PR7c — REST-scenario tegen de fake-Fastify-stub (PR7a) en PR3's
 *   schema's/validators.
 * @see docs/protocol-plan/prompts/PR7-contract-tests.md — sub-batch PR7c.
 * @see server/protocol/rest-games-create-join.mjs,
 *   server/protocol/rest-games-session.mjs, server/protocol/auth-shape.mjs,
 *   server/protocol/input-safety.mjs.
 *
 * Draait de 5 REST-endpointscenario's (create, join, state, leave, time)
 * tegen de fake-Fastify-stub en de echte PR3-validators. Elke route-handler
 * hieronder is een minimale test-fixture-server: 'm valideert de
 * request/response-vorm via de echte PR3-functies, maar doet geen echte
 * room-/sessie-opslag (dat blijft buiten scope van PR3 zelf, zie
 * `rest-games-session.mjs`'s bestandscommentaar).
 */

/**
 * @param {ReturnType<typeof import('./fake-transport.mjs').createFakeFastify>} fastify
 * @param {Record<string, Function>} restGamesModule - PR3's exports
 *   (`validateCreateGameRequest`, `validateCreateGameResponse`,
 *   `hostParticipatesInvariantHolds`, `validateJoinGameRequest`,
 *   `validateJoinGameResponse`, `validateGetStateRequestShape`,
 *   `validateLeaveGameRequestShape`, `validateTimeResponse`,
 *   `parseBearerAuthHeader`)
 * @returns {Array<{ endpoint: string, statusCode: number, ok: boolean }>}
 */
export function runRestEndpointScenario(fastify, restGamesModule) {
  const {
    validateCreateGameRequest,
    validateCreateGameResponse,
    validateJoinGameRequest,
    validateGetStateRequestShape,
    validateLeaveGameRequestShape,
    validateTimeResponse,
  } = restGamesModule;

  fastify.route('POST', '/api/v1/games', (req) => {
    const requestResult = validateCreateGameRequest(req.payload);
    if (!requestResult.ok) {
      return { statusCode: 400, payload: { code: requestResult.code, meta: {} } };
    }
    const responseBody = {
      roomId: 'room_01J000000000000000000001',
      gameCode: '482917',
      inviteId: 'N4x7pQm2K8tW',
      joinUrl: 'https://play.aseso.nl/j/N4x7pQm2K8tW',
      sessionToken: 'sess_secret_host_token',
      roles: requestResult.value.hostParticipates ? ['host', 'player'] : ['host'],
      playerId: requestResult.value.hostParticipates ? 'p_a1b2c3' : null,
      effectiveName: requestResult.value.hostParticipates ? 'Vlugge Vos' : null,
      // docs/openstaand/spelersidentiteit.md, stap 4.
      identity: requestResult.value.hostParticipates ? { country: 'bg', word: 'cow' } : null,
      state: {},
    };
    const responseResult = validateCreateGameResponse(responseBody);
    if (!responseResult.ok) {
      return { statusCode: 500, payload: { code: responseResult.code, meta: {} } };
    }
    return { statusCode: 201, payload: responseBody };
  });

  fastify.route('POST', '/api/v1/games/join', (req) => {
    const requestResult = validateJoinGameRequest(req.payload);
    if (!requestResult.ok) {
      return { statusCode: 400, payload: { code: requestResult.code, meta: {} } };
    }
    return {
      statusCode: 200,
      payload: {
        roomId: 'room_01J000000000000000000001',
        gameCode: '482917',
        sessionToken: 'sess_secret_player_token',
        roles: ['player'],
        playerId: 'p_8f42d1',
        effectiveName: requestResult.value.displayName ?? 'Speler',
        // Zelfgekozen naam -> null; anders (geen displayName) een gegenereerd
        // paar (spelersidentiteit.md).
        identity: requestResult.value.displayName ? null : { country: 'bg', word: 'cow' },
        state: {},
      },
    };
  });

  fastify.route('GET', '/api/v1/games/:code/state', (req) => {
    const shapeResult = validateGetStateRequestShape({
      code: req.params.code,
      authorizationHeader: req.headers?.authorization,
    });
    if (!shapeResult.ok) {
      return { statusCode: 401, payload: { code: shapeResult.code, meta: {} } };
    }
    return {
      statusCode: 200,
      payload: {
        protocolVersion: 'v1',
        serverTime: 1785623412000,
        room: {
          code: shapeResult.value.code,
          phase: 'ROUND_ACTIVE',
          locked: false,
          allowLateJoin: true,
          joinUrl: 'https://play.aseso.nl/j/N4x7pQm2K8tW',
          playerCount: 1,
          config: {},
          matchId: 'match_01J',
        },
        self: {},
        currentRound: {},
        scoreboard: { top: [], self: {} },
      },
    };
  });

  fastify.route('POST', '/api/v1/games/:code/leave', (req) => {
    const shapeResult = validateLeaveGameRequestShape({
      code: req.params.code,
      authorizationHeader: req.headers?.authorization,
    });
    if (!shapeResult.ok) {
      return { statusCode: 401, payload: { code: shapeResult.code, meta: {} } };
    }
    if (req.headers?.['x-fixture-role'] !== 'player') {
      return { statusCode: 403, payload: { code: 'NOT_PLAYER', meta: {} } };
    }
    return { statusCode: 204, payload: {} };
  });

  fastify.route('GET', '/api/v1/time', () => ({
    statusCode: 200,
    payload: { serverTime: 1785623412000 },
  }));

  const results = [];

  // create — geldig voorbeeldpayload uit PROTOCOL.md.
  const createResponse = fastify.inject({
    method: 'POST',
    url: '/api/v1/games',
    payload: { config: { preset: 'group_battle', language: 'nl' }, hostParticipates: true, displayName: null },
  });
  results.push({ endpoint: 'POST /api/v1/games', statusCode: createResponse.statusCode, ok: createResponse.statusCode < 300 });

  // join — met zowel inviteId als gameCode tegelijk: validatiefout.
  const joinBothLocatorsResponse = fastify.inject({
    method: 'POST',
    url: '/api/v1/games/join',
    payload: { inviteId: 'N4x7pQm2K8tW', gameCode: '482917', displayName: null, joinSource: 'qr' },
  });
  results.push({
    endpoint: 'POST /api/v1/games/join (dubbele locator)',
    statusCode: joinBothLocatorsResponse.statusCode,
    ok: joinBothLocatorsResponse.statusCode < 300,
  });

  // state — zonder Authorization-header.
  const stateNoAuthResponse = fastify.inject({ method: 'GET', url: '/api/v1/games/482917/state' });
  results.push({
    endpoint: 'GET /api/v1/games/{code}/state (geen auth)',
    statusCode: stateNoAuthResponse.statusCode,
    ok: stateNoAuthResponse.statusCode < 300,
  });

  // time.
  const timeResponse = fastify.inject({ method: 'GET', url: '/api/v1/time' });
  const timeValidation = validateTimeResponse(timeResponse.json());
  results.push({
    endpoint: 'GET /api/v1/time',
    statusCode: timeResponse.statusCode,
    ok: timeResponse.statusCode < 300 && timeValidation.ok,
  });

  // leave — hostsessie zonder spelerrol.
  const leaveAsHostResponse = fastify.inject({
    method: 'POST',
    url: '/api/v1/games/482917/leave',
    headers: { authorization: 'Bearer sess_secret_host_token', 'x-fixture-role': 'host' },
  });
  results.push({
    endpoint: 'POST /api/v1/games/{code}/leave (host, geen speler)',
    statusCode: leaveAsHostResponse.statusCode,
    ok: leaveAsHostResponse.statusCode < 300,
  });

  return results;
}
