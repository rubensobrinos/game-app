// tests/integration/support/socket-io-test-client.mjs
//
// Een minimale Socket.IO-client over Node's INGEBOUWDE `WebSocket` (Node >= 22),
// die het Engine.IO-v4- en Socket.IO-v5-wireformaat spreekt.
//
// WAAROM GEEN `socket.io-client`: die package staat NIET in package.json en ook
// niet in node_modules — alleen `socket.io` (de server) staat er. "Geen nieuwe
// dependencies" is een harde grens, dus is deze client met de ingebouwde
// WebSocket opgebouwd. Zodra `socket.io-client` als devDependency landt, kan
// dit bestand door één import worden vervangen; de API hieronder is bewust een
// deelverzameling van die van `socket.io-client` (`emit`, `emitWithAck`,
// `close`) plus twee testhulpjes (`waitFor`, `eventsNamed`).
//
// HERKOMST: dit stond eerder letterlijk in `server/transport/socket.test.mjs`.
// Het is hierheen verplaatst zodat de transport-ketentest in deze map dezelfde
// client gebruikt in plaats van er een tweede te bouwen; `socket.test.mjs`
// importeert hem nu hiervandaan.

const ENGINE_OPEN = '0';
const ENGINE_PING = '2';
const ENGINE_PONG = '3';
const ENGINE_MESSAGE = '4';
const SIO_CONNECT = '0';
const SIO_EVENT = '2';
const SIO_ACK = '3';
const SIO_CONNECT_ERROR = '4';

/** Standaardwachttijd van `waitFor` — een vangnet tegen hangende tests, geen sleep. */
const DEFAULT_WAIT_MS = 4000;

/**
 * Verbindt als Socket.IO-client. Resolvet zodra de server de CONNECT
 * bevestigt; rejectet met `error.data` zodra de server de handshake weigert.
 *
 * Het sessietoken gaat mee in de CONNECT-payload (`socket.handshake.auth`) en
 * NOOIT in de URL — zie `client.handshakeUrl`, die daar in de ketentest ook op
 * wordt gecontroleerd (PROTOCOL.md Basisregel 3).
 *
 * @param {number} port
 * @param {object} auth - gaat als `socket.handshake.auth` de server in
 * @param {{ host?: string, path?: string }} [options]
 * @returns {Promise<{
 *   received: Array<{ event: string, envelope: object }>,
 *   handshakeUrl: string,
 *   emit(event: string, body: object): void,
 *   emitWithAck(event: string, body: object): Promise<object>,
 *   waitFor(event: string, predicate?: (envelope: object) => boolean, timeoutMs?: number): Promise<object>,
 *   waitForCount(event: string, count: number, timeoutMs?: number): Promise<number>,
 *   eventsNamed(event: string): Array<{ event: string, envelope: object }>,
 *   close(): void,
 * }>}
 */
export function createTestClient(port, auth, { host = '127.0.0.1', path = '/socket.io' } = {}) {
  const handshakeUrl = `ws://${host}:${port}${path}/?EIO=4&transport=websocket`;
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(handshakeUrl);
    /** @type {Array<{ event: string, envelope: object }>} */
    const received = [];
    /** @type {Set<(entry: { event: string, envelope: object }) => void>} */
    const watchers = new Set();
    /** @type {Map<number, (value: object) => void>} */
    const pendingAcks = new Map();
    let nextAckId = 0;
    let settled = false;

    const client = {
      received,
      handshakeUrl,
      /** Verstuurt een clientevent zonder ack te vragen. */
      emit(event, body) {
        socket.send(`${ENGINE_MESSAGE}${SIO_EVENT}${JSON.stringify([event, body])}`);
      },
      /** Verstuurt een clientevent en wacht op de ack-envelope. */
      emitWithAck(event, body) {
        const id = nextAckId++;
        return new Promise((resolveAck) => {
          pendingAcks.set(id, resolveAck);
          socket.send(`${ENGINE_MESSAGE}${SIO_EVENT}${id}${JSON.stringify([event, body])}`);
        });
      },
      /** Wacht tot een serverevent met deze naam binnenkomt (of is binnengekomen). */
      waitFor(event, predicate = () => true, timeoutMs = DEFAULT_WAIT_MS) {
        const existing = received.find((entry) => entry.event === event && predicate(entry.envelope));
        if (existing !== undefined) {
          return Promise.resolve(existing.envelope);
        }
        return new Promise((resolveEvent, rejectEvent) => {
          const timer = setTimeout(() => {
            watchers.delete(watcher);
            rejectEvent(new Error(`timeout wachtend op "${event}"`));
          }, timeoutMs);
          const watcher = (entry) => {
            if (entry.event !== event || !predicate(entry.envelope)) return;
            clearTimeout(timer);
            watchers.delete(watcher);
            resolveEvent(entry.envelope);
          };
          watchers.add(watcher);
        });
      },
      /**
       * Wacht tot er MINSTENS `count` events met deze naam binnen zijn (of al
       * binnen waren). Dit is de enige oorzakelijke barrière die een client
       * heeft voor een broadcast: de ack van een VOLGEND event is er géén,
       * want de server stuurt zijn ack vóór de `after`-hook die de broadcast
       * doet, en die hook kan nog op de store staan te wachten. Zie de
       * kopnotitie van `matrix-row-13-...test.mjs`.
       */
      waitForCount(event, count, timeoutMs = DEFAULT_WAIT_MS) {
        const tally = () => received.filter((entry) => entry.event === event).length;
        if (tally() >= count) {
          return Promise.resolve(tally());
        }
        return new Promise((resolveCount, rejectCount) => {
          const timer = setTimeout(() => {
            watchers.delete(watcher);
            rejectCount(new Error(`timeout wachtend op ${count}x "${event}" (nu ${tally()})`));
          }, timeoutMs);
          const watcher = () => {
            if (tally() < count) return;
            clearTimeout(timer);
            watchers.delete(watcher);
            resolveCount(tally());
          };
          watchers.add(watcher);
        });
      },
      eventsNamed(event) {
        return received.filter((entry) => entry.event === event);
      },
      close() {
        try {
          socket.close();
        } catch {
          // Al dicht; niets te doen.
        }
      },
    };

    socket.addEventListener('message', (message) => {
      const data = typeof message.data === 'string' ? message.data : String(message.data);
      const engineType = data[0];

      if (engineType === ENGINE_OPEN) {
        socket.send(`${ENGINE_MESSAGE}${SIO_CONNECT}${JSON.stringify(auth)}`);
        return;
      }
      if (engineType === ENGINE_PING) {
        socket.send(ENGINE_PONG);
        return;
      }
      if (engineType !== ENGINE_MESSAGE) {
        return;
      }

      const body = data.slice(1);
      const socketIoType = body[0];
      const rest = body.slice(1);

      if (socketIoType === SIO_CONNECT) {
        settled = true;
        resolve(client);
        return;
      }
      if (socketIoType === SIO_CONNECT_ERROR) {
        settled = true;
        const parsed = rest.length > 0 ? JSON.parse(rest) : {};
        socket.close();
        reject(Object.assign(new Error('connect_error'), { data: parsed.data ?? parsed }));
        return;
      }
      if (socketIoType === SIO_EVENT) {
        // Een server→client event kan een ack-id-prefix dragen; die vragen we
        // niet aan, maar we slaan hem voor de zekerheid over.
        const withoutAckId = rest.replace(/^\d+/, '');
        const [event, envelope] = JSON.parse(withoutAckId);
        const entry = { event, envelope };
        received.push(entry);
        for (const watcher of [...watchers]) {
          watcher(entry);
        }
        return;
      }
      if (socketIoType === SIO_ACK) {
        const match = /^\d+/.exec(rest);
        const id = Number(match[0]);
        const args = JSON.parse(rest.slice(match[0].length));
        pendingAcks.get(id)?.(args[0]);
        pendingAcks.delete(id);
      }
    });

    socket.addEventListener('error', () => {
      if (!settled) {
        settled = true;
        reject(new Error('websocket-fout tijdens verbinden'));
      }
    });
    socket.addEventListener('close', () => {
      if (!settled) {
        settled = true;
        reject(new Error('verbinding gesloten vóór CONNECT'));
      }
    });
  });
}
