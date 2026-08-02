/**
 * @file PR7a — handgerold, dependency-vrij fake-Fastify + fake-Socket.IO-
 *   harnas voor de contracttestlaag tegen `server/protocol/`.
 * @see docs/protocol-plan/prompts/PR7-contract-tests.md — sub-batch PR7a.
 * @see docs/multiplayer/DEPLOYMENT-AND-TESTING.md — §Testlagen, punt 2
 *   ("Contracttests").
 *
 * Geen scenario draait hier al; dit levert alleen de bouwstenen voor
 * PR7b–PR7e. Geen netwerkcode, geen timers, geen nieuwe dependency — puur
 * in-memory event-routing en een request/response-stub met exact dezelfde
 * vorm als Fastify's eigen `.inject()`, zodat een latere overstap naar de
 * echte library (na het `deps`-akkoord uit `architecture-plan`) geen
 * wijziging aan testcode vereist.
 */

/**
 * @typedef {{ method: 'GET' | 'POST', url: string, headers?: Record<string, string>, payload?: unknown }} FakeInjectRequest
 * @typedef {{ statusCode: number, json: () => unknown }} FakeInjectResponse
 */

/**
 * Matcht een Fastify-achtig routepatroon (`:naam`-segmenten) tegen een
 * daadwerkelijk pad. Querystrings worden door `inject()` vooraf gestript —
 * deze functie ziet alleen het padgedeelte.
 * @param {string} pattern - bv. `/api/v1/games/:code/state`
 * @param {string} pathname
 * @returns {Record<string, string> | null} `null` bij geen match.
 */
function matchPath(pattern, pathname) {
  const patternParts = pattern.split('/').filter((part) => part.length > 0);
  const pathParts = pathname.split('/').filter((part) => part.length > 0);
  if (patternParts.length !== pathParts.length) return null;

  const params = {};
  for (let i = 0; i < patternParts.length; i += 1) {
    const patternPart = patternParts[i];
    const pathPart = pathParts[i];
    if (patternPart.startsWith(':')) {
      params[patternPart.slice(1)] = decodeURIComponent(pathPart);
    } else if (patternPart !== pathPart) {
      return null;
    }
  }
  return params;
}

/**
 * @returns {{
 *   route: (method: 'GET' | 'POST', url: string, handler: (req: FakeInjectRequest & { params: Record<string, string> }) => { statusCode: number, payload: unknown }) => void,
 *   inject: (req: FakeInjectRequest) => FakeInjectResponse,
 * }}
 */
export function createFakeFastify() {
  /** @type {Array<{ method: string, pattern: string, handler: Function }>} */
  const routes = [];

  function route(method, url, handler) {
    routes.push({ method, pattern: url, handler });
  }

  function inject(req) {
    const [pathname] = req.url.split('?');
    for (const registered of routes) {
      if (registered.method !== req.method) continue;
      const params = matchPath(registered.pattern, pathname);
      if (params === null) continue;
      const result = registered.handler({ ...req, params });
      return { statusCode: result.statusCode, json: () => result.payload };
    }
    return { statusCode: 404, json: () => ({ code: 'NOT_FOUND' }) };
  }

  return { route, inject };
}

/**
 * @typedef {{
 *   id: string,
 *   emit: (event: string, actionId: string, payload: object, onAck?: (ack: unknown) => void) => void,
 *   on: (event: string, handler: (payload: unknown) => void) => void,
 *   disconnect: () => void,
 * }} FakeClientSocket
 */

/**
 * Fake Socket.IO-server: in-memory event-routing, geen netwerk, geen timers.
 *
 * Ontwerpkeuze (niet letterlijk uit het promptbestand, want de room-join-
 * mechaniek staat daar niet vastgelegd): elke verbinding krijgt intern twee
 * "kanten" — een clientkant (teruggegeven door `connect()`) en een serverkant
 * (doorgegeven aan de `onConnection`-handler). Beide zien er naar buiten toe
 * uit als `FakeClientSocket`. De serverkant krijgt daarnaast een `join(roomId)`
 * -methode (een noodzakelijke, niet-geëxpliciteerde aanvulling om
 * `toRoom(...).emit(...)` toetsbaar te maken — zie testrij 3): de aanroepende
 * scenariocode (PR7b–PR7e) beslist zelf, net als een echte Socket.IO-
 * connection-handler, wanneer een socket een room joint.
 *
 * `emit` op de clientkant stuurt een clientactie naar de serverkant's
 * geregistreerde `on`-handlers, met `{ actionId, payload, ack }` als het ene
 * `payload`-argument dat de `on`-typedef toestaat (`unknown`) — dit is de
 * enige manier waarop een ack-callback de serverkant kan bereiken zonder het
 * gedocumenteerde `on`-schema te verlaten. `emit` op de serverkant (binnen
 * `onConnection` of via `toRoom(...).emit`) stuurt gewoon `payload` door naar
 * de clientkant's `on`-handlers, exact zoals PROTOCOL.md's server→client-
 * envelope geen ack terugverwacht.
 *
 * `restart()` simuleert een serverherstart (PR7e): alle in-memory
 * verbindingen/rooms worden weggegooid, alsof het proces net is herstart —
 * de geregistreerde `onConnection`-handler zelf (de "applicatiecode") blijft
 * bestaan, want die zou na een echte herstart identiek herladen worden. Wat
 * wél/niet aan geaccepteerde antwoorden en roomfase overleeft, bepaalt de
 * aanroepende testscenario expliciet via de meegegeven fake-Redis-achtige
 * stand-in, niet dit harnas zelf.
 *
 * @returns {{
 *   onConnection: (handler: (socket: FakeClientSocket, authPayload: unknown) => void) => void,
 *   connect: (authPayload: object) => FakeClientSocket,
 *   toRoom: (roomId: string) => { emit: (event: string, payload: object) => void },
 *   restart: () => void,
 * }}
 */
export function createFakeSocketServer() {
  let connectionHandler = null;
  let nextSocketId = 1;
  /** @type {Map<string, { clientListeners: Map<string, Set<Function>>, serverListeners: Map<string, Set<Function>>, rooms: Set<string>, disconnected: boolean }>} */
  let connections = new Map();
  /** @type {Map<string, Set<string>>} */
  let rooms = new Map();

  function onConnection(handler) {
    connectionHandler = handler;
  }

  function addListener(registry, event, handler) {
    if (!registry.has(event)) registry.set(event, new Set());
    registry.get(event).add(handler);
  }

  function connect(authPayload) {
    const id = `sock_${nextSocketId}`;
    nextSocketId += 1;
    const record = {
      clientListeners: new Map(),
      serverListeners: new Map(),
      rooms: new Set(),
      disconnected: false,
    };
    connections.set(id, record);

    const clientSocket = {
      id,
      emit(event, actionId, payload, onAck) {
        if (record.disconnected) return;
        const handlers = record.serverListeners.get(event);
        if (!handlers) return;
        for (const handler of handlers) {
          handler({ actionId, payload, ack: onAck ?? (() => {}) });
        }
      },
      on(event, handler) {
        addListener(record.clientListeners, event, handler);
      },
      disconnect() {
        if (record.disconnected) return;
        record.disconnected = true;
        for (const roomId of record.rooms) {
          rooms.get(roomId)?.delete(id);
        }
        record.rooms.clear();
      },
    };

    const serverSocket = {
      id,
      emit(event, payload) {
        if (record.disconnected) return;
        const handlers = record.clientListeners.get(event);
        if (!handlers) return;
        for (const handler of handlers) handler(payload);
      },
      on(event, handler) {
        addListener(record.serverListeners, event, handler);
      },
      disconnect: clientSocket.disconnect,
      /**
       * Niet in de PR7a-JSDoc-typedef, maar noodzakelijk: voegt deze
       * verbinding toe aan een room, zodat `toRoom(roomId).emit(...)` (test
       * rij 3) haar kan bereiken.
       * @param {string} roomId
       */
      join(roomId) {
        if (record.disconnected) return;
        record.rooms.add(roomId);
        if (!rooms.has(roomId)) rooms.set(roomId, new Set());
        rooms.get(roomId).add(id);
      },
    };

    if (connectionHandler) connectionHandler(serverSocket, authPayload);
    return clientSocket;
  }

  function toRoom(roomId) {
    return {
      emit(event, payload) {
        const memberIds = rooms.get(roomId);
        if (!memberIds) return;
        for (const socketId of memberIds) {
          const record = connections.get(socketId);
          if (!record || record.disconnected) continue;
          const handlers = record.clientListeners.get(event);
          if (!handlers) continue;
          for (const handler of handlers) handler(payload);
        }
      },
    };
  }

  function restart() {
    connections = new Map();
    rooms = new Map();
    // connectionHandler blijft bewust bestaan — zie JSDoc hierboven.
  }

  return { onConnection, connect, toRoom, restart };
}

/**
 * In-memory `ActionStore` die exact het interfacecontract van
 * `server/protocol/idempotency.mjs` implementeert (`get`/`set`), voor
 * hergebruik in PR7b–PR7e — geen nieuwe idempotentielogica, alleen een fake
 * bewaarplaats.
 * @returns {{ get: (actionId: string) => (unknown | undefined), set: (actionId: string, ack: unknown) => void }}
 */
export function createInMemoryActionStore() {
  const store = new Map();
  return {
    get(actionId) {
      return store.get(actionId);
    },
    set(actionId, ack) {
      store.set(actionId, ack);
    },
  };
}
