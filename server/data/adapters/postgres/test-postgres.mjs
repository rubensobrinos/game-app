// Testhulp: praat uitsluitend met de WEGWERP-PostgreSQL van `compose.test.yml`.
//
// DIT IS EEN HARDE GRENS, GEEN CONVENTIE.
//
// Er draait een productie-stack (Compose-project `aseso-game`) met een
// PostgreSQL die bewust NIETS naar de host publiceert. De testinstantie is een
// apart Compose-project (`aseso-game-test`) met een eigen volume op poort
// 5434:
//
//   docker compose -p aseso-game-test -f compose.test.yml up -d
//
// De URL staat hieronder HARDGECODEERD, en er is met opzet GEEN
// omgevingsvariabele die hem kan overschrijven. Een `TEST_DATABASE_URL` die
// iemand per ongeluk op productie richt, is precies de fout die je één keer
// maakt. `assertTestInstance()` controleert protocol, host, POORT, DATABASE-
// NAAM én GEBRUIKERSNAAM voordat er ook maar één opdracht de deur uitgaat, en
// breekt af in plaats van door te gaan.
//
// Zelfde opzet als `../redis/test-redis.mjs`, met opzet: wie die kent, kent
// deze.
//
// --------------------------------------------------------------------------
// SCHEMA PER RUN — GEEN SLOT NODIG
// --------------------------------------------------------------------------
// `node --test` draait testbestanden PARALLEL (één proces per bestand). De
// Redis-kant loste dat op met een advisory lock, omdat twee bestanden anders
// in dezelfde database-index landen. Hier kan het eleganter: elke run maakt
// een EIGEN SCHEMA met een unieke naam (`analytics_test_<pid>_<random>`), en
// de writer schrijft schema-gekwalificeerd. Twee parallelle runs raken elkaar
// dus per constructie niet, en `dropTestSchema()` ruimt alleen zijn eigen
// schema op — nooit `public`, nooit een schema dat deze run niet zelf heeft
// aangemaakt.
//
// De tabellen komen LETTERLIJK uit `migrations/001-analytics.sql`. Er wordt
// hier geen eigen schema verzonnen; de enige bewerking is dat de drie
// `CREATE TABLE`-namen schema-gekwalificeerd worden, en dat wordt geteld en
// gecontroleerd.

import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createPostgresConnection } from './connection.mjs';

/** De enige PostgreSQL waar deze tests mee praten. Niet configureerbaar. */
export const TEST_DATABASE_URL = 'postgresql://gameapp_test:test-only-not-a-secret@127.0.0.1:5434/gamestats_test';

/** Verwachte poort. Staat apart zodat de assertie hem niet uit de URL hoeft af te leiden. */
export const TEST_DATABASE_PORT = 5434;

/** Verwachte databasenaam. */
export const TEST_DATABASE_NAME = 'gamestats_test';

/** Verwachte gebruikersnaam. */
export const TEST_DATABASE_USER = 'gameapp_test';

/**
 * Een adres waar met zekerheid NIETS luistert. Voor de "Postgres is weg"-tests,
 * zodat die tegen een echte, onbereikbare socket lopen en niet tegen een mock.
 * Bewust géén poort waar ooit een database op kan staan (5432 is productie,
 * 5434 is de testinstantie).
 */
export const UNREACHABLE_DATABASE_URL = 'postgresql://nobody:nothing@127.0.0.1:5499/nowhere';

/** De drie tabellen uit `migrations/001-analytics.sql`. Niets anders mag ontstaan. */
export const ANALYTICS_TABLES = Object.freeze(['game_sessions', 'round_stats', 'daily_metrics']);

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATION_PATH = join(HERE, '..', '..', '..', '..', 'migrations', '001-analytics.sql');

/** Schemanamen die deze module zelf maakt. Alleen deze mogen ooit gedropt worden. */
const TEST_SCHEMA_PATTERN = /^analytics_test_[0-9a-z_]{4,50}$/;

/**
 * Werpt als `url` niet de testinstantie is. Elke test die een verbinding
 * opzet, gaat hier eerst langs.
 *
 * Er is bewust geen "of"-ontsnapping en geen env-override: elke controle moet
 * slagen, en falen betekent afbreken.
 *
 * @param {string} url
 * @returns {string}
 */
export function assertTestInstance(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('WEIGERING: de opgegeven database-URL is niet parsebaar.');
  }
  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    throw new Error(
      `WEIGERING: testinstantie moet protocol postgresql: gebruiken, kreeg ${parsed.protocol}`
    );
  }
  const allowedHosts = new Set(['127.0.0.1', 'localhost']);
  if (!allowedHosts.has(parsed.hostname)) {
    throw new Error(
      `WEIGERING: testinstantie moet op 127.0.0.1 draaien, kreeg host ${JSON.stringify(parsed.hostname)}`
    );
  }
  if (parsed.port !== String(TEST_DATABASE_PORT)) {
    throw new Error(
      `WEIGERING: testinstantie draait op poort ${TEST_DATABASE_PORT}, kreeg ${JSON.stringify(parsed.port)}. ` +
        'Poort 5432 is de PRODUCTIE-PostgreSQL en is verboden terrein.'
    );
  }
  const database = parsed.pathname.replace(/^\//, '');
  if (database !== TEST_DATABASE_NAME) {
    throw new Error(
      `WEIGERING: testinstantie gebruikt database ${TEST_DATABASE_NAME}, kreeg ${JSON.stringify(database)}.`
    );
  }
  if (decodeURIComponent(parsed.username) !== TEST_DATABASE_USER) {
    throw new Error(
      `WEIGERING: testinstantie gebruikt gebruiker ${TEST_DATABASE_USER}, kreeg ${JSON.stringify(parsed.username)}.`
    );
  }
  return url;
}

/**
 * Standaardopties voor een verbinding met de testinstantie. Korte timeouts:
 * een test die twintig seconden staat te wachten is een test die niemand meer
 * draait.
 * @param {object} [overrides]
 */
export function testConnectionConfig(overrides = {}) {
  assertTestInstance(TEST_DATABASE_URL);
  return {
    url: TEST_DATABASE_URL,
    maxPoolSize: 2,
    connectTimeoutMs: 2_000,
    statementTimeoutMs: 5_000,
    idleTimeoutMs: 1_000,
    closeGracePeriodMs: 1_000,
    ...overrides,
    // Niet overschrijfbaar: ook een overrides-object mag de instantie niet
    // verleggen.
    ...(overrides.url ? { url: assertTestInstance(overrides.url) } : {}),
  };
}

/** Unieke schemanaam voor deze run. Parallelle runs botsen daardoor niet. */
export function uniqueSchemaName() {
  return `analytics_test_${process.pid}_${randomBytes(4).toString('hex')}`;
}

/**
 * Werpt als `schema` geen naam is die deze module zelf gegenereerd kan hebben.
 * Staat vóór elke DDL: `public` of een schema van iemand anders mag nooit het
 * doelwit zijn.
 * @param {string} schema
 * @returns {string}
 */
export function assertOwnTestSchema(schema) {
  if (typeof schema !== 'string' || !TEST_SCHEMA_PATTERN.test(schema)) {
    throw new Error(
      `WEIGERING: ${JSON.stringify(schema)} is geen schema van deze testrun. ` +
        'Alleen zelfgemaakte schema\'s met het patroon analytics_test_<pid>_<hex> mogen worden aangeraakt.'
    );
  }
  return schema;
}

/**
 * Maakt een vers schema met de drie tabellen uit `migrations/001-analytics.sql`.
 * @param {{ query: (text: string, values?: unknown[]) => Promise<any> }} connection
 * @param {string} schema
 * @returns {Promise<void>}
 */
export async function createTestSchema(connection, schema) {
  assertOwnTestSchema(schema);
  const migration = await readFile(MIGRATION_PATH, 'utf8');

  let replacements = 0;
  const scoped = migration.replace(/CREATE TABLE IF NOT EXISTS (\w+)/g, (_match, table) => {
    replacements += 1;
    return `CREATE TABLE IF NOT EXISTS ${schema}.${table}`;
  });
  if (replacements !== ANALYTICS_TABLES.length) {
    throw new Error(
      `Verwachtte ${ANALYTICS_TABLES.length} CREATE TABLE-statements in migrations/001-analytics.sql, ` +
        `vond er ${replacements}. Is het schema veranderd? Pas de test aan, niet de migratie.`
    );
  }

  await connection.query(`CREATE SCHEMA ${schema}`);
  await connection.query(scoped);
}

/**
 * Ruimt het schema van deze run op. Werpt niet: opruimen mag nooit de reden
 * zijn dat een test rood wordt. Wat er wél gebeurt is een luide melding.
 * @param {{ query: (text: string, values?: unknown[]) => Promise<any> }} connection
 * @param {string} schema
 */
export async function dropTestSchema(connection, schema) {
  try {
    assertOwnTestSchema(schema);
    await connection.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    return { dropped: true, reason: '' };
  } catch (error) {
    return { dropped: false, reason: String(/** @type {Error} */ (error)?.message ?? error) };
  }
}

/**
 * Kijkt of de testinstantie bereikbaar is. Bij afwezigheid slaat de suite
 * zichzelf gecontroleerd over, mét reden — nooit stilzwijgend groen.
 * @returns {Promise<{ ok: boolean, reason: string }>}
 */
export async function probeTestPostgres() {
  const connection = createPostgresConnection(testConnectionConfig({ connectTimeoutMs: 1_500 }));
  try {
    await connection.connect();
    const result = await connection.query('SELECT current_database() AS db, current_user AS usr');
    const { db, usr } = result.rows[0] ?? {};
    if (db !== TEST_DATABASE_NAME || usr !== TEST_DATABASE_USER) {
      return {
        ok: false,
        reason:
          `WEIGERING: verbonden database is ${JSON.stringify(db)}/${JSON.stringify(usr)} in plaats van ` +
          `${TEST_DATABASE_NAME}/${TEST_DATABASE_USER}. Er wordt niets uitgevoerd.`,
      };
    }
    return { ok: true, reason: '' };
  } catch (error) {
    return {
      ok: false,
      reason:
        `Testpostgres niet bereikbaar op 127.0.0.1:${TEST_DATABASE_PORT}/${TEST_DATABASE_NAME} ` +
        `(${/** @type {{code?: string, name?: string}} */ (error)?.code ?? /** @type {Error} */ (error)?.name ?? 'onbekend'}). ` +
        'Start hem met: docker compose -p aseso-game-test -f compose.test.yml up -d',
    };
  } finally {
    await connection.close();
  }
}
