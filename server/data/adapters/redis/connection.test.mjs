// Tests voor de Redis-verbinding en haar levenscyclus (INTB2a).
//
// TESTINSTANTIE — LEES DIT VOOR JE HIER IETS AAN VERANDERT.
//
// Alles wat in dit bestand een socket opent, gaat langs `test-redis.mjs`, dat
// protocol, host en poort controleert en werpt zodra het niet de wegwerp-Redis
// op 127.0.0.1:6380 is. De productie-Redis (Compose-project `aseso-game`)
// publiceert niets naar de host; op 6379 luistert vanaf hier dus niets. Er
// wordt bovendien nergens geschreven: alleen PING, CLIENT ID en CLIENT KILL op
// onze eigen verbindingen. Geen SET, geen FLUSHDB, geen FLUSHALL.
//
// De suite valt uiteen in twee delen:
//
//   * "zonder Redis" — configuratie, redactie en de complete toestandsmachine,
//     met een geïnjecteerde nepclient. Draait altijd, ook op een machine zonder
//     Docker.
//   * "tegen de testinstantie" — verbinden, echt verbindingsverlies (we laten
//     Redis onze eigen socket doodmaken met CLIENT KILL) en echt afsluiten.
//     Slaat zichzelf mét reden over als de instantie niet draait; nooit
//     stilzwijgend groen.

import { EventEmitter } from 'node:events';
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  CONNECTION_ERROR_CODES,
  CONNECTION_STATES,
  RedisConnectionError,
  createRedisConnection,
} from './connection.mjs';
import {
  TEST_REDIS_DATABASE,
  TEST_REDIS_URL,
  acquireRedisTestLock,
  assertTestInstance,
  probeTestRedis,
  testConnectionConfig,
} from './test-redis.mjs';

// --------------------------------------------------------------------------
// Hulpjes
// --------------------------------------------------------------------------

/**
 * @param {() => Promise<unknown>} fn
 * @param {string} expectedCode
 * @returns {Promise<RedisConnectionError>}
 */
async function expectConnectionError(fn, expectedCode) {
  try {
    await fn();
  } catch (error) {
    assert.ok(error instanceof RedisConnectionError, `verwachtte RedisConnectionError, kreeg ${error?.name}`);
    assert.equal(error.code, expectedCode, `foutcode: ${error.code} (${error.message})`);
    return error;
  }
  throw new assert.AssertionError({
    message: `verwachtte een RedisConnectionError met code ${expectedCode}, maar er werd niets geworpen`,
  });
}

/**
 * Wacht tot `predicate` waar is. Werpt bij het verstrijken van de deadline in
 * plaats van te blijven hangen — een test die hangt is geen falende test maar
 * een geblokkeerde CI.
 * @param {() => boolean} predicate
 * @param {number} timeoutMs
 * @param {string} what
 */
async function waitFor(predicate, timeoutMs, what) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Time-out na ${timeoutMs}ms terwijl gewacht werd op: ${what}`);
}

/** Minimale nepclient met dezelfde oppervlakte als node-redis' client. */
function createFakeClient({ connectImpl, closeImpl } = {}) {
  const client = new EventEmitter();
  client.isOpen = false;
  client.isReady = false;
  client.calls = { connect: 0, close: 0, destroy: 0 };

  client.connect = async () => {
    client.calls.connect += 1;
    if (connectImpl) return connectImpl(client);
    client.isOpen = true;
    client.isReady = true;
    client.emit('ready');
    return client;
  };
  client.close = async () => {
    client.calls.close += 1;
    if (closeImpl) return closeImpl(client);
    client.isOpen = false;
    client.isReady = false;
    client.emit('end');
  };
  client.destroy = () => {
    client.calls.destroy += 1;
    client.isOpen = false;
    client.isReady = false;
  };
  return client;
}

/** Vangt de opties die naar de clientfabriek gaan, plus elke gemaakte client. */
function createFakeFactory(makeClient = () => createFakeClient()) {
  const created = [];
  const optionsSeen = [];
  const factory = (options) => {
    optionsSeen.push(options);
    const client = makeClient();
    created.push(client);
    return client;
  };
  return { factory, created, optionsSeen };
}

const FAKE_CONFIG = Object.freeze({
  url: 'redis://127.0.0.1:6380',
  maxReconnectAttempts: 3,
  reconnectBaseDelayMs: 10,
  reconnectMaxDelayMs: 40,
  closeGracePeriodMs: 50,
});

// --------------------------------------------------------------------------
// Deel 1 — zonder Redis
// --------------------------------------------------------------------------

describe('connection — configuratie komt van de aanroeper', () => {
  it('weigert een ontbrekende of onbruikbare url', () => {
    for (const url of [undefined, '', 42, null]) {
      assert.throws(() => createRedisConnection({ url }), (error) => {
        assert.ok(error instanceof RedisConnectionError);
        assert.equal(error.code, CONNECTION_ERROR_CODES.INVALID_CONFIG);
        return true;
      });
    }
    assert.throws(() => createRedisConnection({ url: 'geen url' }), /geldige URL/);
  });

  it('weigert een ander protocol dan redis: of rediss:', () => {
    assert.throws(() => createRedisConnection({ url: 'http://127.0.0.1:6380' }), /redis: of rediss:/);
    assert.equal(typeof createRedisConnection({ url: 'rediss://127.0.0.1:6380' }).describe, 'function');
  });

  it('weigert onzinnige getallen en een niet-functie als clientFactory', () => {
    const cases = [
      { database: -1 },
      { database: 1.5 },
      { connectTimeoutMs: 0 },
      { maxReconnectAttempts: -1 },
      { reconnectBaseDelayMs: 0 },
      { reconnectMaxDelayMs: 5, reconnectBaseDelayMs: 10 },
      { closeGracePeriodMs: -1 },
      { clientFactory: 'nee' },
      { onEvent: 'nee' },
    ];
    for (const overrides of cases) {
      assert.throws(
        () => createRedisConnection({ url: 'redis://127.0.0.1:6380', ...overrides }),
        (error) => error instanceof RedisConnectionError && error.code === CONNECTION_ERROR_CODES.INVALID_CONFIG,
        `verwachtte INVALID_CONFIG voor ${JSON.stringify(overrides)}`
      );
    }
  });

  it('leest process.env niet — een verbinding zonder url komt nergens vandaan', () => {
    const before = process.env.REDIS_URL;
    process.env.REDIS_URL = 'redis://127.0.0.1:6380';
    try {
      assert.throws(() => createRedisConnection({}), /url is verplicht/);
    } finally {
      if (before === undefined) delete process.env.REDIS_URL;
      else process.env.REDIS_URL = before;
    }
  });
});

describe('connection — de guard op de testinstantie', () => {
  // Deze guard is de reden dat een adaptertest nooit per ongeluk tegen de
  // productie-Redis kan draaien. Hij doet geen I/O, dus hij wordt hier puur
  // op zijn oordeel getest — inclusief de poort die verboden terrein is.
  it('weigert poort 6379 — dat is de productie-instantie', () => {
    assert.throws(() => assertTestInstance('redis://127.0.0.1:6379'), /poort 6380/);
  });

  it('weigert een andere host, een ander protocol en credentials', () => {
    assert.throws(() => assertTestInstance('redis://redis.example.com:6380'), /127\.0\.0\.1/);
    assert.throws(() => assertTestInstance('rediss://127.0.0.1:6380'), /protocol redis:/);
    assert.throws(() => assertTestInstance('redis://user:pw@127.0.0.1:6380'), /credentials/);
    assert.throws(() => assertTestInstance('redis://127.0.0.1'), /poort 6380/);
  });

  it('laat uitsluitend de wegwerpinstantie door', () => {
    assert.equal(assertTestInstance('redis://127.0.0.1:6380'), 'redis://127.0.0.1:6380');
    assert.equal(TEST_REDIS_URL, 'redis://127.0.0.1:6380');
  });
});

describe('connection — credentials lekken niet', () => {
  const url = 'redis://gebruiker:supergeheim@127.0.0.1:6380';

  it('toont in describe() alleen protocol, host en poort', () => {
    const connection = createRedisConnection({ url, clientFactory: createFakeFactory().factory });
    const described = connection.describe();
    assert.equal(described.endpoint, 'redis://***@127.0.0.1:6380');
    assert.ok(!JSON.stringify(described).includes('supergeheim'));
  });

  it('lekt niets via JSON.stringify van de verbinding zelf', () => {
    const connection = createRedisConnection({ url, clientFactory: createFakeFactory().factory });
    assert.ok(!JSON.stringify(connection).includes('supergeheim'));
  });

  it('lekt niets in de foutmelding van getClient()', () => {
    const connection = createRedisConnection({ url, clientFactory: createFakeFactory().factory });
    assert.throws(() => connection.getClient(), (error) => {
      assert.ok(!error.message.includes('supergeheim'), error.message);
      assert.equal(error.code, CONNECTION_ERROR_CODES.CONNECTION_UNAVAILABLE);
      return true;
    });
  });

  it('lekt niets via de observatiehaak', () => {
    const events = [];
    const connection = createRedisConnection({
      url,
      clientFactory: createFakeFactory().factory,
      onEvent: (event) => events.push(event),
    });
    return connection.connect().then(async () => {
      await connection.close();
      assert.ok(events.length > 0, 'er zijn events gezien');
      assert.ok(!JSON.stringify(events).includes('supergeheim'));
      assert.ok(JSON.stringify(events).includes('redis://***@127.0.0.1:6380'));
    });
  });
});

describe('connection — levenscyclus met een nepclient', () => {
  it('gaat idle → connecting → ready en geeft de client pas dan af', async () => {
    const { factory, created } = createFakeFactory();
    const connection = createRedisConnection({ ...FAKE_CONFIG, clientFactory: factory });

    assert.equal(connection.getState(), CONNECTION_STATES.IDLE);
    assert.throws(() => connection.getClient(), /toestand: idle/);

    const client = await connection.connect();
    assert.equal(connection.getState(), CONNECTION_STATES.READY);
    assert.equal(connection.isReady(), true);
    assert.equal(client, created[0]);
    assert.equal(connection.getClient(), created[0]);
    assert.equal(connection.describe().connects, 1);

    await connection.close();
  });

  it('registreert een error-listener, zodat een socketfout het proces niet neerhaalt', async () => {
    const { factory, created } = createFakeFactory();
    const connection = createRedisConnection({ ...FAKE_CONFIG, clientFactory: factory });
    await connection.connect();

    assert.ok(created[0].listenerCount('error') >= 1, 'er is een error-listener');
    // Zonder listener zou dit een unhandled exception zijn.
    created[0].emit('error', Object.assign(new Error('kapot'), { code: 'ECONNRESET' }));
    assert.equal(connection.getState(), CONNECTION_STATES.RECONNECTING);
    assert.equal(connection.describe().lastErrorCode, 'ECONNRESET');

    await connection.close();
  });

  it('verbindt maar één keer bij gelijktijdige connect()-aanroepen', async () => {
    const { factory, created } = createFakeFactory();
    const connection = createRedisConnection({ ...FAKE_CONFIG, clientFactory: factory });

    const [a, b, c] = await Promise.all([connection.connect(), connection.connect(), connection.connect()]);
    assert.equal(a, b);
    assert.equal(b, c);
    assert.equal(created.length, 1);
    assert.equal(created[0].calls.connect, 1);

    await connection.close();
  });

  it('werpt CONNECT_FAILED als de eerste verbinding mislukt en blijft daarna failed', async () => {
    const { factory } = createFakeFactory(() =>
      createFakeClient({
        connectImpl: () => {
          throw Object.assign(new Error('weigering'), { code: 'ECONNREFUSED' });
        },
      })
    );
    const connection = createRedisConnection({ ...FAKE_CONFIG, clientFactory: factory });

    await expectConnectionError(() => connection.connect(), CONNECTION_ERROR_CODES.CONNECT_FAILED);
    assert.equal(connection.getState(), CONNECTION_STATES.FAILED);
    assert.throws(() => connection.getClient(), (error) => {
      assert.equal(error.code, CONNECTION_ERROR_CODES.CONNECTION_UNAVAILABLE);
      return true;
    });

    await connection.close();
  });
});

describe('connection — verbindingsverlies is expliciet, nooit stil', () => {
  /** Haalt de reconnectStrategy op die naar node-redis zou gaan. */
  function strategyOf(optionsSeen, index = 0) {
    const strategy = optionsSeen[index]?.socket?.reconnectStrategy;
    assert.equal(typeof strategy, 'function', 'er is een reconnectStrategy meegegeven');
    return strategy;
  }

  it('gebruikt exponentiële backoff met een plafond', async () => {
    const { factory, optionsSeen } = createFakeFactory();
    const connection = createRedisConnection({ ...FAKE_CONFIG, clientFactory: factory });
    await connection.connect();

    const strategy = strategyOf(optionsSeen);
    const cause = new Error('weg');
    assert.equal(strategy(0, cause), 10);
    assert.equal(strategy(1, cause), 20);
    assert.equal(strategy(2, cause), 40, 'afgetopt op reconnectMaxDelayMs');

    await connection.close();
  });

  it('geeft na het maximum een Error terug — node-redis stopt dan met herproberen', async () => {
    const events = [];
    const { factory, optionsSeen } = createFakeFactory();
    const connection = createRedisConnection({
      ...FAKE_CONFIG,
      clientFactory: factory,
      onEvent: (event) => events.push(event),
    });
    await connection.connect();

    const strategy = strategyOf(optionsSeen);
    const cause = Object.assign(new Error('weg'), { code: 'ECONNRESET' });
    assert.equal(typeof strategy(FAKE_CONFIG.maxReconnectAttempts - 1, cause), 'number');

    const verdict = strategy(FAKE_CONFIG.maxReconnectAttempts, cause);
    assert.ok(verdict instanceof Error, 'na het maximum komt er een Error, geen wachttijd');
    assert.equal(verdict.code, CONNECTION_ERROR_CODES.RECONNECT_EXHAUSTED);

    // En dat is waarneembaar: de verbinding is failed en levert geen dode
    // client meer af.
    assert.equal(connection.getState(), CONNECTION_STATES.FAILED);
    await expectConnectionError(
      async () => connection.getClient(),
      CONNECTION_ERROR_CODES.CONNECTION_UNAVAILABLE
    );
    assert.ok(events.some((event) => event.type === 'reconnect-exhausted'));

    await connection.close();
  });

  it('meldt verbindingsverlies en herstel via de observatiehaak', async () => {
    const events = [];
    const { factory, created } = createFakeFactory();
    const connection = createRedisConnection({
      ...FAKE_CONFIG,
      clientFactory: factory,
      onEvent: (event) => events.push(event),
    });
    await connection.connect();

    created[0].emit('error', Object.assign(new Error('weg'), { code: 'ECONNRESET' }));
    assert.equal(connection.getState(), CONNECTION_STATES.RECONNECTING);
    assert.ok(events.some((event) => event.type === 'connection-lost'));

    created[0].emit('ready');
    assert.equal(connection.getState(), CONNECTION_STATES.READY);
    assert.equal(connection.describe().connects, 2);

    await connection.close();
  });

  it('bouwt na een definitieve mislukking een verse client bij de volgende connect()', async () => {
    let failNext = true;
    const { factory, created } = createFakeFactory(() =>
      createFakeClient({
        connectImpl: (client) => {
          if (failNext) throw Object.assign(new Error('weigering'), { code: 'ECONNREFUSED' });
          client.isOpen = true;
          client.isReady = true;
          client.emit('ready');
          return client;
        },
      })
    );
    const connection = createRedisConnection({ ...FAKE_CONFIG, clientFactory: factory });

    await expectConnectionError(() => connection.connect(), CONNECTION_ERROR_CODES.CONNECT_FAILED);
    assert.equal(created.length, 1);

    failNext = false;
    await connection.connect();
    assert.equal(created.length, 2, 'heropbouw gebruikt een nieuwe client, niet de kapotte');
    assert.equal(connection.getState(), CONNECTION_STATES.READY);

    await connection.close();
  });

  it('beschouwt een onverwacht einde als failed, niet als "nog even geduld"', async () => {
    const { factory, created } = createFakeFactory();
    const connection = createRedisConnection({ ...FAKE_CONFIG, clientFactory: factory });
    await connection.connect();

    created[0].isOpen = false;
    created[0].emit('end');
    assert.equal(connection.getState(), CONNECTION_STATES.FAILED);
    assert.throws(() => connection.getClient(), /toestand: failed/);

    await connection.close();
  });
});

describe('connection — close() sluit echt af', () => {
  it('sluit de onderliggende client en is daarna terminaal', async () => {
    const { factory, created } = createFakeFactory();
    const connection = createRedisConnection({ ...FAKE_CONFIG, clientFactory: factory });
    await connection.connect();

    await connection.close();

    assert.equal(created[0].calls.close, 1, 'de client is echt gesloten, niet alleen een vlaggetje omgezet');
    assert.equal(created[0].isOpen, false);
    assert.equal(connection.getState(), CONNECTION_STATES.CLOSED);
    assert.equal(connection.isReady(), false);

    await expectConnectionError(async () => connection.getClient(), CONNECTION_ERROR_CODES.CLOSED);
    await expectConnectionError(() => connection.connect(), CONNECTION_ERROR_CODES.CLOSED);
  });

  it('is idempotent en werpt niet zonder verbinding', async () => {
    const { factory, created } = createFakeFactory();
    const connection = createRedisConnection({ ...FAKE_CONFIG, clientFactory: factory });

    await connection.close(); // nooit verbonden
    assert.equal(created.length, 0);
    assert.equal(connection.getState(), CONNECTION_STATES.CLOSED);
    await connection.close(); // tweede keer
    assert.equal(connection.getState(), CONNECTION_STATES.CLOSED);
  });

  it('blijft niet hangen op een QUIT die nooit terugkomt', async () => {
    const { factory, created } = createFakeFactory(() =>
      createFakeClient({
        connectImpl: (client) => {
          client.isOpen = true;
          client.isReady = true;
          client.emit('ready');
          return client;
        },
        // Een half-dode socket: de QUIT vertrekt en er komt nooit antwoord.
        closeImpl: () => new Promise(() => {}),
      })
    );
    const connection = createRedisConnection({ ...FAKE_CONFIG, clientFactory: factory });
    await connection.connect();

    const started = Date.now();
    await connection.close();
    const elapsed = Date.now() - started;

    assert.ok(elapsed < 1_000, `close() duurde ${elapsed}ms — de afkap werkte niet`);
    assert.equal(created[0].calls.destroy, 1, 'na de afkap wordt de socket alsnog gesloopt');
    assert.equal(connection.getState(), CONNECTION_STATES.CLOSED);
  });

  it('laat een fout in close() niet ontsnappen', async () => {
    const { factory, created } = createFakeFactory(() =>
      createFakeClient({
        connectImpl: (client) => {
          client.isOpen = true;
          client.isReady = true;
          client.emit('ready');
          return client;
        },
        closeImpl: () => {
          throw new Error('QUIT mislukt');
        },
      })
    );
    const connection = createRedisConnection({ ...FAKE_CONFIG, clientFactory: factory });
    await connection.connect();

    await connection.close();
    assert.equal(connection.getState(), CONNECTION_STATES.CLOSED);
    assert.equal(created[0].calls.destroy, 1);
  });
});

describe('connection — een onbereikbare Redis faalt luid en snel', () => {
  // Echte `redis`-client, poort waar niets luistert. Geen nepclient: dit is de
  // enige manier om te bewijzen dat de echte reconnectStrategy ook echt door
  // node-redis wordt aangeroepen en de lus beëindigt.
  it('geeft het op na maxReconnectAttempts in plaats van eeuwig door te proberen', async () => {
    const connection = createRedisConnection({
      url: 'redis://127.0.0.1:6399', // niets luistert hier; NIET 6379 (productie)
      connectTimeoutMs: 300,
      maxReconnectAttempts: 2,
      reconnectBaseDelayMs: 10,
      reconnectMaxDelayMs: 20,
      closeGracePeriodMs: 100,
    });

    const started = Date.now();
    const attempt = expectConnectionError(() => connection.connect(), CONNECTION_ERROR_CODES.CONNECT_FAILED);
    const deadline = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('connect() gaf het niet op — het herproberen stopt niet')), 5_000).unref()
    );
    await Promise.race([attempt, deadline]);

    assert.ok(Date.now() - started < 5_000);
    assert.equal(connection.getState(), CONNECTION_STATES.FAILED);
    assert.throws(() => connection.getClient(), (error) => {
      assert.equal(error.code, CONNECTION_ERROR_CODES.CONNECTION_UNAVAILABLE);
      return true;
    });

    await connection.close();
  });
});

// --------------------------------------------------------------------------
// Deel 2 — tegen de echte testinstantie
// --------------------------------------------------------------------------

assertTestInstance(TEST_REDIS_URL);

// Het gedeelde testredis-slot (INTB2e). Deze tests schrijven niets, maar
// `aof-restart.test.mjs` SIGKILLt de instantie en `node --test` draait
// testbestanden parallel — een herstart midden in een reconnect-assertie hier
// zou onterecht rood geven. Het slot kost ~niets: dit bestand is in een kwart
// seconde klaar.
const releaseLock = await acquireRedisTestLock({ label: 'connection.test.mjs' });
after(async () => {
  await releaseLock();
});

const availability = await probeTestRedis();
if (!availability.ok) {
  // Zichtbaar, niet stilzwijgend: node:test meldt de skip mét reden, en deze
  // regel staat ook in de gewone uitvoer.
  console.warn(`[INTB2a] Integratietests overgeslagen — ${availability.reason}`);
}

describe(
  `connection — tegen de testinstantie (${TEST_REDIS_URL}, db ${TEST_REDIS_DATABASE})`,
  { skip: availability.ok ? false : availability.reason },
  () => {
    it('praat aantoonbaar met de testinstantie op poort 6380 en met niets anders', async () => {
      // WAAROM NIET `CLIENT INFO`/`laddr`: dat is het adres van de SERVERkant
      // van de socket, en die zit in de container. Docker mapt host 6380 naar
      // containerpoort 6379, dus Redis rapporteert daar altijd 6379 — ook op de
      // testinstantie. Het bewijst dus precies niets over de host.
      //
      // Wat het wél bewijst: onze eigen kant van de socket. `remotePort` is de
      // hostpoort waarop wij hebben aangeklopt, gemeten door het OS en niet
      // door onze eigen configuratie. Draait deze test ooit tegen een andere
      // instantie, dan staat hier een ander getal en faalt de assertie hard.
      const { createConnection } = await import('node:net');
      const target = new URL(TEST_REDIS_URL);

      const probe = createConnection({ host: target.hostname, port: Number(target.port) });
      try {
        const reply = await new Promise((resolve, reject) => {
          probe.setTimeout(2_000);
          probe.once('error', reject);
          probe.once('timeout', () => reject(new Error('time-out op de probe-socket')));
          probe.once('connect', () => probe.write('PING\r\n'));
          probe.once('data', (chunk) => resolve(chunk.toString('utf8')));
        });

        assert.equal(probe.remoteAddress?.replace('::ffff:', ''), '127.0.0.1');
        assert.equal(
          probe.remotePort,
          6380,
          `de socket ging naar poort ${probe.remotePort} in plaats van 6380 — dat is NIET de testinstantie`
        );
        assert.equal(reply, '+PONG\r\n', 'op 6380 luistert een Redis en niet iets anders');
      } finally {
        probe.destroy();
      }

      // En de adapter gebruikt exact diezelfde bestemming.
      const connection = createRedisConnection(testConnectionConfig());
      try {
        await connection.connect();
        assert.equal(connection.describe().endpoint, 'redis://127.0.0.1:6380');
        assert.equal(await connection.getClient().ping(), 'PONG');
      } finally {
        await connection.close();
      }
    });

    it('verbindt en antwoordt op PING', async () => {
      const connection = createRedisConnection(testConnectionConfig());
      try {
        await connection.connect();
        assert.equal(connection.getState(), CONNECTION_STATES.READY);
        assert.equal(connection.isReady(), true);
        assert.equal(await connection.getClient().ping(), 'PONG');
      } finally {
        await connection.close();
      }
    });

    it('herstelt zichzelf nadat Redis de socket doodmaakt', async () => {
      const events = [];
      const victim = createRedisConnection(testConnectionConfig({ onEvent: (event) => events.push(event) }));
      const killer = createRedisConnection(testConnectionConfig());
      try {
        await victim.connect();
        await killer.connect();

        const victimId = await victim.getClient().sendCommand(['CLIENT', 'ID']);
        assert.equal(typeof victimId, 'number');

        // Alleen onze eigen verbinding, op id. Niets van iemand anders.
        const killed = await killer.getClient().sendCommand(['CLIENT', 'KILL', 'ID', String(victimId)]);
        assert.equal(Number(killed), 1, 'precies één verbinding gedood: de onze');

        // NIET pollen op de toestand `reconnecting`: die is vluchtig. Met een
        // basisvertraging van 20ms kan het herstel al klaar zijn voordat de
        // eerstvolgende peiling kijkt, en dan faalt de test op zijn eigen
        // timing in plaats van op het gedrag. (Dat gebeurde: ~1 op 6 runs.) De
        // eventlog is wél blijvend — die legt het verlies vast, ook als het
        // maar twintig milliseconden duurde.
        await waitFor(
          () => events.some((event) => event.type === 'connection-lost'),
          2_000,
          'het verlies wordt opgemerkt en gemeld'
        );
        await waitFor(
          () => victim.isReady() && victim.describe().connects >= 2,
          5_000,
          'de verbinding bouwt zichzelf opnieuw op'
        );

        assert.equal(await victim.getClient().ping(), 'PONG', 'na herstel werkt de verbinding weer');
        assert.ok(victim.describe().connects >= 2, 'er is echt opnieuw verbonden');
        assert.ok(victim.describe().reconnectAttempts >= 1, 'de herverbindingsstrategie is echt gebruikt');
      } finally {
        await victim.close();
        await killer.close();
      }
    });

    it('sluit de echte socket met close() — de client is daarna onbruikbaar', async () => {
      const connection = createRedisConnection(testConnectionConfig());
      await connection.connect();
      const rawClient = connection.getClient();
      assert.equal(rawClient.isOpen, true);

      await connection.close();

      // Niet het vlaggetje van de wrapper maar de echte client: een close()
      // die alleen intern iets omzet, faalt hier.
      assert.equal(rawClient.isOpen, false, 'de node-redis client is echt gesloten');
      await assert.rejects(() => rawClient.ping(), 'commando op een gesloten client hoort te falen');
      assert.equal(connection.getState(), CONNECTION_STATES.CLOSED);
    });

    it('laat geen socket achter waardoor het testproces blijft draaien', async () => {
      // Vijf verbindingen open en dicht: als close() de sockets niet echt
      // opruimt, hangt node --test aan het eind van deze file.
      for (let i = 0; i < 5; i += 1) {
        const connection = createRedisConnection(testConnectionConfig());
        await connection.connect();
        await connection.close();
        assert.equal(connection.getState(), CONNECTION_STATES.CLOSED);
      }
    });
  }
);
