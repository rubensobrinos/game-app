// Testhulp: praat uitsluitend met de WEGWERP-Redis van `compose.test.yml`.
//
// DIT IS EEN HARDE GRENS, GEEN CONVENTIE.
//
// Er draait een productie-stack (Compose-project `aseso-game`) met een Redis
// die bewust NIETS naar de host publiceert. De testinstantie is een apart
// Compose-project (`aseso-game-test`) met een eigen volume op poort 6380:
//
//   docker compose -p aseso-game-test -f compose.test.yml up -d
//
// De URL staat hieronder HARDGECODEERD, en er is met opzet geen
// omgevingsvariabele die hem kan overschrijven. Een `TEST_REDIS_URL` die
// iemand per ongeluk op de productie-URL zet, is precies de fout die je één
// keer maakt. `assertTestInstance()` controleert bovendien protocol, host én
// poort voordat er ook maar één commando de deur uitgaat.
//
// Deze tests SCHRIJVEN NIETS. Ze gebruiken alleen `PING`, `CLIENT ID` en
// `CLIENT KILL ID` op hun eigen verbindingen. Geen `SET`, geen `FLUSHDB`, geen
// `FLUSHALL` — nergens in dit bestand of in de tests die het gebruiken. Er valt
// dus ook niets op te ruimen, en niets van iemand anders kapot te maken. De
// database-index hieronder is verdediging in de diepte: mocht er ooit tóch
// geschreven worden, dan gebeurt dat in een hoge, per proces gekozen index en
// niet in db 0.

import { createRedisConnection } from './connection.mjs';

/** De enige Redis waar deze tests mee praten. Niet configureerbaar. */
export const TEST_REDIS_URL = 'redis://127.0.0.1:6380';

/** Verwachte poort. Staat apart zodat de assertie hem niet uit de URL hoeft af te leiden. */
export const TEST_REDIS_PORT = 6380;

/**
 * Database-index per testproces: 8..15, uit de PID. Parallelle runs botsen
 * daardoor niet, en db 0 (waar iemand handmatig zou kunnen rommelen) blijft
 * ongemoeid.
 */
export const TEST_REDIS_DATABASE = 8 + (process.pid % 8);

/**
 * Werpt als `url` niet de testinstantie is. Elke test die een verbinding
 * opzet, gaat hier eerst langs.
 * @param {string} url
 * @returns {string}
 */
export function assertTestInstance(url) {
  const parsed = new URL(url);
  const allowedHosts = new Set(['127.0.0.1', 'localhost']);
  if (parsed.protocol !== 'redis:') {
    throw new Error(`WEIGERING: testinstantie moet protocol redis: gebruiken, kreeg ${parsed.protocol}`);
  }
  if (!allowedHosts.has(parsed.hostname)) {
    throw new Error(
      `WEIGERING: testinstantie moet op 127.0.0.1 draaien, kreeg host ${JSON.stringify(parsed.hostname)}`
    );
  }
  if (parsed.port !== String(TEST_REDIS_PORT)) {
    throw new Error(
      `WEIGERING: testinstantie draait op poort ${TEST_REDIS_PORT}, kreeg ${JSON.stringify(parsed.port)}. ` +
        `Poort 6379 is de PRODUCTIE-Redis en is verboden terrein.`
    );
  }
  if (parsed.username || parsed.password) {
    throw new Error('WEIGERING: de testinstantie heeft geen credentials; een URL met credentials is verdacht.');
  }
  return url;
}

/**
 * Standaardopties voor een verbinding met de testinstantie. Korte timeouts en
 * weinig herpogingen: een test die twintig seconden staat te herverbinden is
 * een test die niemand meer draait.
 * @param {object} [overrides]
 */
export function testConnectionConfig(overrides = {}) {
  assertTestInstance(TEST_REDIS_URL);
  return {
    url: TEST_REDIS_URL,
    database: TEST_REDIS_DATABASE,
    connectTimeoutMs: 1_000,
    maxReconnectAttempts: 5,
    reconnectBaseDelayMs: 20,
    reconnectMaxDelayMs: 200,
    closeGracePeriodMs: 500,
    ...overrides,
  };
}

/**
 * Kijkt of de testinstantie bereikbaar is. Bij afwezigheid slaat de suite
 * zichzelf gecontroleerd over, mét reden — nooit stilzwijgend groen.
 * @returns {Promise<{ ok: boolean, reason: string }>}
 */
export async function probeTestRedis() {
  const connection = createRedisConnection(testConnectionConfig({ maxReconnectAttempts: 0 }));
  try {
    await connection.connect();
    const pong = await connection.getClient().ping();
    if (pong !== 'PONG') {
      return { ok: false, reason: `Testredis op ${TEST_REDIS_URL} antwoordde ${JSON.stringify(pong)} op PING.` };
    }
    return { ok: true, reason: '' };
  } catch (error) {
    return {
      ok: false,
      reason:
        `Testredis niet bereikbaar op ${TEST_REDIS_URL} (${error?.code ?? error?.name ?? 'onbekend'}). ` +
        `Start hem met: docker compose -p aseso-game-test -f compose.test.yml up -d`,
    };
  } finally {
    await connection.close();
  }
}
