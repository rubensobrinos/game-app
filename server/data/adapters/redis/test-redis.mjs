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
//
// NOOT (INTB2e): die belofte gaat over de INTB2a-tests die dit bestand als
// eerste gebruikten. `data-store.test.mjs` en `aof-restart.test.mjs` schrijven
// wél — in hun eigen database-index, nooit in db 0 — en `aof-restart.test.mjs`
// herstart de instantie zelfs. Dat is precies waarom `acquireRedisTestLock()`
// hieronder bestaat. DIT BESTAND zelf schrijft nog steeds niets naar Redis; het
// slot is een map in de tijdelijke directory van het OS.

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

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

// ----------------------------------------------------------------------
// Wederzijdse uitsluiting tussen Redis-schrijvende testbestanden.
//
// `node --test` draait TESTBESTANDEN PARALLEL (één proces per bestand). Twee
// bestanden die dezelfde testinstantie schrijven kunnen daardoor:
//   * in dezelfde database-index landen (8 + pid % 8 botst zodra twee pids
//     dezelfde rest hebben) en elkaars fixtures wegflushen;
//   * en sinds `aof-restart.test.mjs` erger: dat bestand KILT de server
//     midden in de run van de ander.
//
// Vandaar deze slotmechaniek. Hij zit hier en niet in één van de testbestanden
// omdat beide kanten hem moeten nemen — een slot dat maar één partij neemt is
// geen slot. Het is een ADVISORY lock: hij beschermt tegen de testbestanden in
// deze repo, niet tegen iemand die handmatig redis-cli openzet.
//
// Waarom een map en geen bestand: `mkdir` is atomair op elk relevant
// bestandssysteem — hij slaagt bij precies één proces en werpt EEXIST bij de
// rest. Een Redis-sleutel als slot kan hier per definitie niet: het slot moet
// juist een SIGKILL van Redis overleven.
// ----------------------------------------------------------------------

/** Het slot zelf. Buiten de repo, want dit is looptijdstatus en geen broncode. */
const LOCK_PATH = join(tmpdir(), 'aseso-game-test-redis.lock');

/** Een slot van een proces dat niet meer bestaat, of ouder dan dit, is puin. */
const LOCK_STALE_MS = 10 * 60 * 1000;

/**
 * Kijkt of het huidige slot van een dood of veel te oud proces is en ruimt het
 * in dat geval op. Zonder dit blijft één gecrashte testrun de rest van de dag
 * blokkeren.
 * @returns {Promise<boolean>} true als er iets is opgeruimd
 */
async function clearStaleLock() {
  let owner;
  try {
    owner = JSON.parse(await readFile(join(LOCK_PATH, 'owner.json'), 'utf8'));
  } catch {
    // Geen (leesbaar) eigenaarsbestand: het slot is half aangemaakt of half
    // opgeruimd. Niet stelen — de eigenaar kan er nog een milliseconde vanaf
    // zijn — behalve als de map zelf al oud is.
    return false;
  }
  const tooOld = Date.now() - Number(owner?.acquiredAt ?? 0) > LOCK_STALE_MS;
  let alive = true;
  try {
    process.kill(Number(owner?.pid), 0);
  } catch (error) {
    alive = /** @type {{code?: string}} */ (error)?.code === 'EPERM';
  }
  if (alive && !tooOld) return false;
  await rm(LOCK_PATH, { recursive: true, force: true });
  return true;
}

/**
 * Neemt het slot en levert de vrijgave op. Elk testbestand dat naar de
 * testinstantie SCHRIJFT neemt hem, vóór de eerste verbinding.
 *
 * @param {{ timeoutMs?: number, pollMs?: number, label?: string }} [options]
 * @returns {Promise<() => Promise<void>>} vrijgave, idempotent
 */
export async function acquireRedisTestLock({ timeoutMs = 300_000, pollMs = 50, label = 'onbekend' } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      await mkdir(LOCK_PATH);
      await writeFile(join(LOCK_PATH, 'owner.json'), JSON.stringify({ pid: process.pid, label, acquiredAt: Date.now() }));

      let released = false;
      // Vangnet voor een testproces dat eruit klapt zonder zijn `after` te
      // draaien: zonder dit blijft het slot tien minuten staan.
      const onExit = () => {
        if (released) return;
        try {
          rmSync(LOCK_PATH, { recursive: true, force: true });
        } catch {
          /* opruimen bij het afsluiten mag nooit de exitcode veranderen */
        }
      };
      process.once('exit', onExit);

      return async () => {
        if (released) return;
        released = true;
        process.removeListener('exit', onExit);
        await rm(LOCK_PATH, { recursive: true, force: true });
      };
    } catch (error) {
      if (/** @type {{code?: string}} */ (error)?.code !== 'EEXIST') throw error;
      if (await clearStaleLock()) continue;
      if (Date.now() > deadline) {
        throw new Error(
          `Kreeg het testredis-slot (${LOCK_PATH}) niet binnen ${timeoutMs} ms. ` +
            'Een ander Redis-schrijvend testbestand houdt hem vast, of er staat een slot van een gecrashte run.'
        );
      }
      await delay(pollMs);
    }
  }
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
