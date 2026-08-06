// transport/verbinding.mjs — refactor 9 (docs/openstaand/refactor/9-transport-client.md).
// `createTransport` — REST tegen `server/transport/rest.mjs`, en `connect()`:
// de websocketverbinding, herverbinden, de handshake. Verplaatst LETTERLIJK
// uit transport.mjs's "De factory"-kopje. Geen gedragsverandering.
//
// ─────────────────────────────────────────────────────────────────────────────
// GEEN SOCKET.IO-CLIENT ALS DEPENDENCY
//
// `socket.io-client` staat niet in `package.json` en niet in `node_modules` —
// alleen de serverkant (`socket.io`). Dependencies toevoegen is een
// human-beslissing (`CLAUDE.md` §Beslisbevoegdheid), dus spreekt dit bestand
// het Engine.IO-v4-/Socket.IO-v5-wireformaat rechtstreeks over de ingebouwde
// `WebSocket` (Node >= 22 én elke browser). Dat is dezelfde keuze die
// `server/transport/socket.test.mjs` al maakte, met dezelfde uitweg: zodra
// `socket.io-client` is toegevoegd kan `openSocket()` door één import worden
// vervangen. Zie het handoff-item over socket.io-client.
//
// ─────────────────────────────────────────────────────────────────────────────
// HET SESSIETOKEN GAAT NOOIT IN EEN URL
//
// REST: `Authorization: Bearer <token>`. Socket: `socket.handshake.auth`
// (`{ sessionToken, protocolVersion }`), in de Socket.IO-CONNECT-payload — niet
// in de querystring van de WebSocket-URL. Alleen `inviteId` staat in een query
// (`GET /games/preview?inviteId=`), en dat is het eindpunt zoals `PROTOCOL.md`
// het definieert; een invite is een andere capability dan een sessie.

import {
  backoffDelayMs,
  initialReconnectState,
  nextActionFor,
  transition,
} from '../../../client/flow/reconnect-state.mjs';
import { PROTOCOL_VERSION, TRANSPORT_ERROR_CODES, ProtocolError } from './protocol.mjs';
import { normalizeBaseUrl, safeJsonParse, readHandshakeErrorCode } from './helpers.mjs';
import { createSnapshotPrecedenceGate } from './precedentie.mjs';

/** Prefix van de REST-eindpunten, gelijk aan `REST_PREFIX` in `rest.mjs`. */
const REST_PREFIX = '/api/v1';

/** Pad waarop `attachSocketServer` standaard luistert (`socket.mjs`). */
const SOCKET_IO_PATH = '/socket.io/';

// Engine.IO-v4-pakkettypes (eerste teken van een frame).
const ENGINE_OPEN = '0';
const ENGINE_PING = '2';
const ENGINE_PONG = '3';
const ENGINE_MESSAGE = '4';

// Socket.IO-v5-pakkettypes (eerste teken ná ENGINE_MESSAGE).
const SIO_CONNECT = '0';
const SIO_EVENT = '2';
const SIO_ACK = '3';
const SIO_CONNECT_ERROR = '4';

/**
 * Handshake-weigeringen waarbij opnieuw proberen zinloos is: het token is
 * ongeldig, verlopen, ingetrokken, of de server spreekt onze protocolversie
 * niet. Blijven retryen zou een hot loop tegen een dode sessie opleveren en de
 * UI eeuwig 'connecting' laten tonen.
 */
const TERMINAL_HANDSHAKE_CODES = new Set([
  'TOKEN_INVALID',
  'TOKEN_EXPIRED',
  'SESSION_REVOKED',
  'PROTOCOL_VERSION_UNSUPPORTED',
]);

/**
 * @typedef {{
 *   createGame: (request: { config: object, hostParticipates: boolean, displayName: string | null }) => Promise<object>,
 *   previewInvite: (inviteId: string) => Promise<object>,
 *   joinGame: (request: object) => Promise<object>,
 *   fetchState: (code: string, sessionToken: string) => Promise<object>,
 *   leaveGame: (code: string, sessionToken: string) => Promise<void>,
 *   fetchServerTime: () => Promise<{ serverTime: number }>,
 *   connect: (sessionToken: string, handlers: {
 *     onEvent: (envelope: object) => void,
 *     onStatus: (status: 'connecting' | 'connected' | 'disconnected') => void,
 *     onPrecedence?: (decision: { kind: 'snapshot' | 'event', event: string | null, apply: boolean, reason?: string }) => void,
 *   }) => { send: (event: string, actionId: string, payload: object) => Promise<object>, close: () => void },
 * }} Transport
 */

// ─────────────────────────────────────────────────────────────────────────────
// De factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bouwt een `Transport` tegen een draaiende server.
 *
 * Eén instantie hoort bij één room-/sessiecontext: de precedentiepoort houdt
 * de laatst toegepaste state bij en die is per room. `app.mjs` maakt er nu één
 * module-breed aan, precies zoals bij de mock.
 *
 * @param {{
 *   baseUrl?: string,
 *   fetchImpl?: typeof fetch,
 *   webSocketImpl?: typeof WebSocket,
 *   precedenceGate?: ReturnType<typeof createSnapshotPrecedenceGate>,
 * }} [options]
 *   `baseUrl` valt terug op `location.origin` (browser). `fetchImpl`,
 *   `webSocketImpl` en `precedenceGate` zijn TESTNADEN — de UI geeft ze nooit
 *   mee en het contract uit `transport-contract-response.md` kent ze niet.
 * @returns {Transport}
 */
export function createTransport(options = {}) {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const doFetch = options.fetchImpl ?? globalThis.fetch;
  const WebSocketImpl = options.webSocketImpl ?? globalThis.WebSocket;
  const gate = options.precedenceGate ?? createSnapshotPrecedenceGate();

  if (typeof doFetch !== 'function') {
    throw new TypeError('transport.mjs: geen fetch beschikbaar (Node >= 22 of een browser vereist).');
  }

  return {
    createGame,
    previewInvite,
    joinGame,
    fetchState,
    leaveGame,
    fetchServerTime,
    connect,
  };

  // ── REST ───────────────────────────────────────────────────────────────────

  /**
   * `POST /api/v1/games`. Het hele request gaat mee, niet alleen `config`
   * (correctie 1): `hostParticipates` en `displayName` zijn geen configvelden.
   * @param {object} request
   */
  async function createGame(request) {
    const body = await requestJson('POST', '/games', { body: request });
    registerSnapshot(body?.state);
    return body;
  }

  /**
   * `GET /api/v1/games/preview?inviteId=`. Uitsluitend `inviteId`, geen
   * `gameCode`-variant (`PROTOCOL.md`). De responsvorm ligt nog niet vast
   * (INT-8), dus wordt hij ongewijzigd doorgegeven.
   * @param {string} inviteId
   */
  async function previewInvite(inviteId) {
    const query = `?inviteId=${encodeURIComponent(String(inviteId ?? ''))}`;
    return requestJson('GET', `/games/preview${query}`);
  }

  /**
   * `POST /api/v1/games/join`. Precies één locator (`inviteId` óf `gameCode`);
   * de server valideert dat, dit bestand niet.
   * @param {object} request
   */
  async function joinGame(request) {
    const body = await requestJson('POST', '/games/join', { body: request });
    registerSnapshot(body?.state);
    return body;
  }

  /**
   * `GET /api/v1/games/{code}/state`.
   *
   * De snapshot gaat door dezelfde precedentiepoort als de socketstroom, zodat
   * de ordening van daarna kloppende events klopt. Bij een afgewezen (verouderde)
   * snapshot wordt de lokale positie NIET teruggezet; de respons zelf wordt wel
   * teruggegeven — het contract heeft voor dit eindpunt geen afwijzingskanaal en
   * een `throw` zou een niet-bestaande `PROTOCOL.md`-foutcode op de UI loslaten.
   * Zie het handoff-item over fetchState.
   *
   * @param {string} code
   * @param {string} sessionToken
   */
  async function fetchState(code, sessionToken) {
    const snapshot = await requestJson('GET', `/games/${encodeURIComponent(String(code ?? ''))}/state`, {
      token: sessionToken,
    });
    registerSnapshot(snapshot);
    return snapshot;
  }

  /**
   * `POST /api/v1/games/{code}/leave`. De server antwoordt `{ left: true }`;
   * het contract belooft `Promise<void>`, dus die body wordt weggegooid.
   * @param {string} code
   * @param {string} sessionToken
   */
  async function leaveGame(code, sessionToken) {
    await requestJson('POST', `/games/${encodeURIComponent(String(code ?? ''))}/leave`, {
      token: sessionToken,
      body: {},
    });
  }

  /** `GET /api/v1/time` → `{ serverTime }`. Voedt `frontend/js/server-time.mjs`. */
  async function fetchServerTime() {
    return requestJson('GET', '/time');
  }

  /**
   * Eén HTTP-aanroep. Een niet-2xx respons wordt een `ProtocolError` met de
   * `code` uit de body (`rest.mjs` stuurt altijd `{ code, meta }`); een
   * mislukte verbinding wordt `NETWORK_ERROR`.
   *
   * @param {'GET' | 'POST'} method
   * @param {string} path - relatief aan `/api/v1`
   * @param {{ body?: unknown, token?: string }} [init]
   * @returns {Promise<any>}
   */
  async function requestJson(method, path, init = {}) {
    const headers = { accept: 'application/json' };
    if (init.body !== undefined) {
      headers['content-type'] = 'application/json';
    }
    if (typeof init.token === 'string' && init.token.length > 0) {
      // Basisregel 3 + §REST-auth: nooit in de URL, altijd in de header.
      headers.authorization = `Bearer ${init.token}`;
    }

    let response;
    try {
      response = await doFetch(`${baseUrl}${REST_PREFIX}${path}`, {
        method,
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });
    } catch (error) {
      throw new ProtocolError(
        TRANSPORT_ERROR_CODES.NETWORK,
        `${method} ${path} kon de server niet bereiken`,
        { cause: error instanceof Error ? error.name : 'unknown' }
      );
    }

    const payload = await readJsonBody(response);
    if (!response.ok) {
      const code = typeof payload?.code === 'string' ? payload.code : TRANSPORT_ERROR_CODES.NETWORK;
      const meta = payload !== null && typeof payload.meta === 'object' && payload.meta !== null ? payload.meta : {};
      throw new ProtocolError(code, `${method} ${path} → ${response.status} ${code}`, meta);
    }
    return payload;
  }

  /** Registreert een via REST opgehaalde snapshot bij de precedentiepoort. */
  function registerSnapshot(snapshot) {
    if (snapshot !== null && typeof snapshot === 'object') {
      gate.registerSnapshot(snapshot);
    }
  }

  // ── Socket ─────────────────────────────────────────────────────────────────

  /**
   * Opent een socketverbinding en houdt hem open. Synchroon, conform contract:
   * er is geen foutpad op `connect()` zelf — een mislukte verbinding is een
   * `onStatus('disconnected')` gevolgd door een nieuwe poging.
   *
   * @param {string} sessionToken
   * @param {{ onEvent?: Function, onStatus?: Function, onPrecedence?: Function }} handlers
   * @returns {{ send: (event: string, actionId: string, payload: object) => Promise<object>, close: () => void }}
   */
  function connect(sessionToken, handlers) {
    const safeHandlers = handlers !== null && typeof handlers === 'object' ? handlers : {};
    const onEvent = typeof safeHandlers.onEvent === 'function' ? safeHandlers.onEvent : () => {};
    const onStatus = typeof safeHandlers.onStatus === 'function' ? safeHandlers.onStatus : () => {};
    const onPrecedence = typeof safeHandlers.onPrecedence === 'function' ? safeHandlers.onPrecedence : () => {};

    if (typeof WebSocketImpl !== 'function') {
      throw new TypeError('transport.mjs: geen WebSocket beschikbaar (Node >= 22 of een browser vereist).');
    }

    /**
     * De reconnect-toestandsmachine uit `client/flow/reconnect-state.mjs` wordt
     * hier ECHT gedraaid — de transportlaag verzint geen tweede backoff. Uit
     * dat model gebruikt dit bestand alleen de reconnect-helft;
     * `pendingSnapshotRequest` blijft bewust onaangeroerd, want ná een
     * herverbinding beslist de UI wanneer ze `fetchState()` doet (correctie 2:
     * snapshot boven events, dus de UI kiest het moment).
     */
    let reconnectState = initialReconnectState();

    /** @type {WebSocket | null} */
    let socket = null;
    /** @type {ReturnType<typeof setTimeout> | null} */
    let retryTimer = null;
    let stopped = false;
    let connected = false;

    /** Openstaande `send()`-aanroepen, op Socket.IO-ack-id. */
    const pendingAcks = new Map();
    let nextAckId = 0;

    /**
     * `actionId`s waarvan de ack al met `ok: false` is afgehandeld. De server
     * stuurt naast die ack óók een los `error`-event (`socket.mjs`
     * `respondFailure`); zonder deze administratie zou de UI dezelfde
     * mislukking twee keer zien — precies het dubbele foutpad dat correctie 3
     * wilde wegnemen. Begrensd op de laatste `SETTLED_FAILURE_LIMIT`.
     */
    const settledFailures = [];
    const SETTLED_FAILURE_LIMIT = 64;

    openSocket({ first: true });

    return { send, close };

    /** Opent één WebSocket en bedraadt de Engine.IO-/Socket.IO-afhandeling. */
    function openSocket({ first }) {
      if (stopped) {
        return;
      }
      onStatus('connecting');

      const url = new URL(`${SOCKET_IO_PATH}?EIO=4&transport=websocket`, baseUrl);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';

      let ws;
      try {
        ws = new WebSocketImpl(url.toString());
      } catch {
        handleDrop({ terminal: false });
        return;
      }
      socket = ws;

      let handshakeSettled = false;

      ws.addEventListener('message', (message) => {
        const frame = typeof message.data === 'string' ? message.data : String(message.data);
        const engineType = frame[0];

        if (engineType === ENGINE_OPEN) {
          // Socket-auth (`PROTOCOL.md` §Socket-auth): het token gaat in de
          // CONNECT-payload, niet in de URL.
          ws.send(`${ENGINE_MESSAGE}${SIO_CONNECT}${JSON.stringify({ sessionToken, protocolVersion: PROTOCOL_VERSION })}`);
          return;
        }
        if (engineType === ENGINE_PING) {
          ws.send(ENGINE_PONG);
          return;
        }
        if (engineType !== ENGINE_MESSAGE) {
          return;
        }

        const body = frame.slice(1);
        const packetType = body[0];
        const rest = body.slice(1);

        if (packetType === SIO_CONNECT) {
          handshakeSettled = true;
          connected = true;
          reconnectState = first
            ? initialReconnectState()
            : transition(reconnectState, { type: 'RECONNECT_SUCCEEDED' });
          onStatus('connected');
          return;
        }

        if (packetType === SIO_CONNECT_ERROR) {
          handshakeSettled = true;
          const parsed = safeJsonParse(rest);
          const code = readHandshakeErrorCode(parsed);
          // De weigering gaat als protocol-`error`-envelope naar de UI: dat is
          // exact de vorm die `PROTOCOL.md` §Foutcodes voor server→client
          // fouten definieert, dus de UI heeft er al een pad voor.
          deliver({
            event: 'error',
            eventId: null,
            serverTime: Date.now(),
            payload: { actionId: null, code, meta: {} },
          });
          // Eerst losknopen, dan pas sluiten: anders behandelt de
          // 'close'-listener hieronder dezelfde weigering nog een keer en
          // wordt er twee keer een reconnect gepland.
          socket = null;
          connected = false;
          failPendingAcks();
          try {
            ws.close();
          } catch {
            // Al dicht.
          }
          handleDrop({ terminal: TERMINAL_HANDSHAKE_CODES.has(code) });
          return;
        }

        if (packetType === SIO_EVENT) {
          const decoded = decodePacketArgs(rest);
          if (decoded === null) {
            return;
          }
          const [eventName, envelope] = decoded.args;
          if (typeof eventName !== 'string') {
            return;
          }
          // De server zet de eventnaam zowel in het Socket.IO-frame als in de
          // envelope; de envelope is de vorm die `applyServerEvent()` verwacht.
          const normalized = envelope !== null && typeof envelope === 'object'
            ? envelope
            : { event: eventName, eventId: null, serverTime: Date.now(), payload: {} };
          deliver(normalized);
          return;
        }

        if (packetType === SIO_ACK) {
          const decoded = decodePacketArgs(rest);
          if (decoded === null || decoded.ackId === null) {
            return;
          }
          const settle = pendingAcks.get(decoded.ackId);
          if (settle === undefined) {
            return;
          }
          pendingAcks.delete(decoded.ackId);
          settle(decoded.args[0]);
        }
      });

      ws.addEventListener('error', () => {
        // 'error' wordt altijd door 'close' gevolgd; die doet de afhandeling.
      });

      ws.addEventListener('close', () => {
        if (socket !== ws) {
          return;
        }
        socket = null;
        connected = false;
        failPendingAcks();
        if (handshakeSettled && !stopped) {
          // Verbinding was open en viel weg.
          handleDrop({ terminal: false });
          return;
        }
        if (!handshakeSettled && !stopped) {
          // Nooit tot CONNECT gekomen (server weg, netwerk weg).
          handleDrop({ terminal: false });
        }
      });
    }

    /**
     * Verbinding weg of geweigerd: status melden en — tenzij terminaal — een
     * nieuwe poging plannen met de backoff uit `reconnect-state.mjs`
     * (1, 2, 4, 8, 16, max 30 s; `PROTOCOL.md` §Reconnect stap 3).
     */
    function handleDrop({ terminal }) {
      if (stopped) {
        return;
      }
      reconnectState = reconnectState.status === 'reconnecting'
        ? transition(reconnectState, { type: 'RECONNECT_FAILED' })
        : transition(reconnectState, { type: 'DISCONNECTED' });
      onStatus('disconnected');

      if (terminal) {
        // Opnieuw proberen heeft geen zin; de UI moet een nieuwe sessie halen.
        stopped = true;
        return;
      }

      const action = nextActionFor(reconnectState);
      const delayMs = action !== null && action.type === 'schedule-reconnect'
        ? action.delayMs
        : backoffDelayMs(reconnectState.attempt + 1);

      clearRetryTimer();
      retryTimer = setTimeout(() => {
        retryTimer = null;
        if (stopped) {
          return;
        }
        reconnectState = transition(reconnectState, { type: 'RECONNECT_ATTEMPT_STARTED' });
        openSocket({ first: false });
      }, delayMs);
      // Node: laat het proces niet openhouden op een reconnecttimer.
      retryTimer?.unref?.();
    }

    function clearRetryTimer() {
      if (retryTimer !== null) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
    }

    /** Elke openstaande `send()` faalt zodra de socket wegvalt. */
    function failPendingAcks() {
      for (const settle of pendingAcks.values()) {
        settle(null);
      }
      pendingAcks.clear();
    }

    /**
     * DE POORT. Alles wat binnenkomt gaat hier langs vóórdat de UI het aan
     * `applyServerEvent()` mag geven. Een afgewezen boodschap bereikt `onEvent`
     * niet — dat is de hele afdwinging van `PROTOCOL.md` basisregel 6.
     */
    function deliver(envelope) {
      const eventName = typeof envelope?.event === 'string' ? envelope.event : null;

      if (eventName === 'error' && suppressDuplicateError(envelope)) {
        return;
      }

      const decision = eventName === 'room:state'
        ? gate.registerSnapshot(envelope.payload)
        : gate.registerEvent(envelope);

      onPrecedence({
        kind: eventName === 'room:state' ? 'snapshot' : 'event',
        event: eventName,
        apply: decision.apply === true,
        reason: decision.reason,
      });

      if (decision.apply === true) {
        onEvent(envelope);
      }
    }

    /**
     * Onderdrukt het losse `error`-event dat bij een al via de ack afgehandelde
     * mislukking hoort. Server-geïnitieerde fouten (geen bekende `actionId`)
     * gaan altijd door.
     */
    function suppressDuplicateError(envelope) {
      const actionId = envelope?.payload?.actionId;
      if (typeof actionId !== 'string' || actionId.length === 0) {
        return false;
      }
      const index = settledFailures.indexOf(actionId);
      if (index === -1) {
        return false;
      }
      settledFailures.splice(index, 1);
      return true;
    }

    function rememberSettledFailure(actionId) {
      if (typeof actionId !== 'string' || actionId.length === 0) {
        return;
      }
      settledFailures.push(actionId);
      while (settledFailures.length > SETTLED_FAILURE_LIMIT) {
        settledFailures.shift();
      }
    }

    /**
     * Verstuurt één clientevent en wacht op de ack.
     *
     * Verwerpt bij `ok: false` met dezelfde `Error`+`.code`-vorm als de
     * REST-functies (correctie 3) — één foutmechanisme voor de hele interface.
     * Verwerpt met `NOT_CONNECTED` wanneer er geen open socket is; de UI hoort
     * dan te retryen met DEZELFDE `actionId` (`PROTOCOL.md` §Reconnect stap 7,
     * correctie 4), anders levert de retry `ALREADY_ANSWERED` op.
     *
     * @param {string} event
     * @param {string} actionId
     * @param {object} payload
     * @returns {Promise<object>} de ack-envelope `{ actionId, ok, serverTime, payload }`
     */
    function send(event, actionId, payload) {
      if (socket === null || !connected) {
        return Promise.reject(new ProtocolError(
          TRANSPORT_ERROR_CODES.NOT_CONNECTED,
          `send("${String(event)}") zonder open verbinding`
        ));
      }

      const ackId = nextAckId;
      nextAckId += 1;
      const frame = `${ENGINE_MESSAGE}${SIO_EVENT}${ackId}${JSON.stringify([event, {
        actionId,
        payload: payload ?? {},
      }])}`;

      return new Promise((resolve, reject) => {
        pendingAcks.set(ackId, (ack) => {
          if (ack === null || typeof ack !== 'object') {
            reject(new ProtocolError(
              TRANSPORT_ERROR_CODES.NOT_CONNECTED,
              `verbinding viel weg vóór de ack van "${String(event)}"`
            ));
            return;
          }
          if (ack.ok === true) {
            resolve(ack);
            return;
          }
          const code = typeof ack.payload?.code === 'string' ? ack.payload.code : TRANSPORT_ERROR_CODES.NETWORK;
          const meta = ack.payload?.meta ?? {};
          rememberSettledFailure(typeof ack.actionId === 'string' ? ack.actionId : actionId);
          reject(new ProtocolError(code, `${String(event)} geweigerd: ${code}`, meta));
        });

        try {
          socket.send(frame);
        } catch (error) {
          pendingAcks.delete(ackId);
          reject(new ProtocolError(
            TRANSPORT_ERROR_CODES.NOT_CONNECTED,
            `send("${String(event)}") kon niet worden verstuurd`,
            { cause: error instanceof Error ? error.name : 'unknown' }
          ));
        }
      });
    }

    /** Sluit de verbinding op verzoek van de UI: geen backoff meer. */
    function close() {
      stopped = true;
      clearRetryTimer();
      const ws = socket;
      socket = null;
      connected = false;
      failPendingAcks();
      if (ws !== null) {
        try {
          ws.close();
        } catch {
          // Al dicht.
        }
      }
      onStatus('disconnected');
    }
  }
}

async function readJsonBody(response) {
  try {
    const text = await response.text();
    return text.length === 0 ? null : JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Splitst een Socket.IO EVENT-/ACK-body in het optionele ack-id en de
 * JSON-argumenten.
 * @param {string} rest
 * @returns {{ ackId: number | null, args: unknown[] } | null}
 */
function decodePacketArgs(rest) {
  const match = /^\d+/.exec(rest);
  const ackId = match === null ? null : Number(match[0]);
  const json = match === null ? rest : rest.slice(match[0].length);
  const args = safeJsonParse(json);
  return Array.isArray(args) ? { ackId, args } : null;
}
