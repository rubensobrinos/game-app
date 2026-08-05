// INTB2e — overleeft een actieve room een harde Redis-herstart?
//
// ARCHITECTURE.md §10 belooft: "Redis gebruikt AOF met `appendfsync everysec`,
// zodat een Redis- of hostprocesrestart niet standaard alle rooms verwijdert."
// Dit bestand bouwt geen adaptercode; het zet die belofte onder stroom. Er
// wordt een echte room gevuld, de echte testcontainer wordt echt omgelegd, en
// daarna moet alles er via de POORT (`data-store.mjs`) weer uit komen.
//
// ======================================================================
// 1. WAT DE HERSTART PRECIES IS, EN WAAROM HET GEEN NETTE HERSTART IS
// ======================================================================
//
// De herstart is `docker kill --signal=KILL` gevolgd door `docker start`, niet
// `docker compose restart`. Dat is geen ruwheid om de ruwheid; een nette
// herstart bewijst hier namelijk NIETS:
//
//   * `docker compose restart` stuurt SIGTERM. Redis doet daarop een geordende
//     afsluiting en flusht de AOF-buffer expliciet naar disk.
//   * bovendien draait deze container zonder eigen configuratiebestand, dus met
//     de INGEBOUWDE save-points (`3600 1 300 100 60 10000`). Bij SIGTERM schrijft
//     Redis daardoor óók nog een afsluitende RDB-snapshot.
//
// Met SIGTERM overleeft de room dus zelfs als AOF helemaal uit staat — dan
// bewijst de test alleen dat Redis netjes afsluit. Met SIGKILL valt beide weg:
// geen buffer-flush, geen afsluitende snapshot, alleen wat het AOF-pad zelf al
// had weggeschreven. Dat is de vraag die §10 stelt.
//
// HET VERLIESVENSTER IS HIER GEEN THEORIE — GEMETEN, op de testinstantie, met
// één sleutel per herstart (`SET probe 1`, N seconden wachten, SIGKILL, start):
//
//   N = 0 s  -> weg          N = 1 s  -> aanwezig
//   N = 2 s  -> aanwezig     N = 3 s  -> aanwezig
//
// Bij N = 0 kromp het incrementele AOF-bestand zelf van 1076 naar 1046 bytes
// over de herstart heen: precies de dertig bytes van het RESP-commando dat nog
// niet ge`fsync`t was. Dat is `appendfsync everysec` zoals hij op de doos staat,
// en het is meteen het bewijs dat de opzet met twee fasen hier nodig is en niet
// academisch: een test die schrijft en meteen herstart is niet "misschien ooit"
// flaky, hij is bij de eerste poging al rood. Waarom de dood van het PROCES hier
// ook ongefsyncte paginacache meesleept (op een kale Linux-host zou dat niet
// hoeven) is niet uitgezocht — het is het gedrag van de opstelling waarin deze
// test draait, en de test hangt nergens van de verklaring af.
//
// ======================================================================
// 2. TWEE FASEN, EN WELKE ASSERTIE IN WELKE CATEGORIE VALT
// ======================================================================
//
// `appendfsync everysec` betekent dat er hoogstens één seconde schrijfwerk kan
// ontbreken. Een test die schrijft en meteen herstart kan dus zijn hele fixture
// kwijtraken en maakt een correct geconfigureerde Redis willekeurig rood. Deze
// test kent daarom precies twee categorieën, en die staan bij ELKE assertie in
// de testnaam:
//
//   [BASELINE]  — geschreven vóór een AANTOONBARE flush naar disk. GEEN
//                 tolerantie. Ontbreekt hier iets, dan is dat een echte
//                 bevinding.
//   [TOLERANT]  — precies één, expliciet gemarkeerde laatste schrijfactie ná de
//                 flush. Die valt per definitie in het verliesvenster en wordt
//                 NIET geëist; de test rapporteert alleen wat er van over is.
//
// Wie hier later een assertie bij zet: kies bewust een categorie. De tolerantie
// van de tweede categorie over de eerste uitsmeren maakt de test waardeloos
// zonder dat hij rood wordt — dat is de duurste manier om hem te slopen.
//
// AANTOONBAAR WACHTEN OP PERSISTENTIE (de kern van de opzet): er wordt niet op
// een klok gewacht. Na de baseline gaat er een `BGREWRITEAOF` uit en wordt er
// gepold op een WAARNEEMBARE toestandsovergang in `INFO persistence`
// (`aof_rewrites` hoger, `aof_rewrite_in_progress:0`, `aof_last_bgrewrite_status:ok`).
// De AOF-rewrite schrijft de dataset zoals die bij de fork was naar een NIEUW
// basisbestand en `fsync`t dat vóór hij het manifest omzet. Daarbovenop kijkt de
// test aan de BESTANDSKANT: het manifest wijst een nieuw basisbestand aan, en dat
// bestand bevat de sleutel `room:{roomId}` letterlijk. Twee onafhankelijke
// waarnemingen, geen enkele seconde slaap.
//
// ======================================================================
// 3. WAAROM DEZE TEST NIET VANZELF GROEN STAAT (sabotagestanden)
// ======================================================================
//
// Een herstarttest die groen blijft terwijl AOF uitstaat, bewijst niets. Er is
// hier geen productiecode om te muteren, dus de opstelling zelf is wat verzwakt
// wordt. `AOF_RESTART_SABOTAGE` zet bewuste fouten aan (kommagescheiden, te
// combineren); standaard staat hij uit. Elke stand hoort de test rood te maken,
// en welke assertie er dan valt staat erbij:
//
//   skip-flush           de baseline wordt niet aantoonbaar doorgeschreven en
//                        staat dus nog in het `everysec`-venster als de kill
//                        komt. LET OP WAT ER DAN GEBEURT: bij de ene run twaalf
//                        van de veertien asserties rood (hele baseline weg), bij
//                        de volgende alleen de META-assertie. Dat wisselt met
//                        waar de fsync-tik toevallig viel. Dit IS de flakiness
//                        waar de opzet met twee fasen voor bestaat — en meteen
//                        de reden dat de [META]-assertie er is: die valt ALTIJD,
//                        ook als de dobbelsteen deze keer meezat.
//   truncate-incr-aof    het incrementele AOF-bestand wordt tussen kill en start
//                        op nul gezet: alles ná het laatste gefsyncte
//                        basisbestand is weg, deterministisch in plaats van
//                        afhankelijk van waar de fsync-tik viel. MET de flush
//                        hoort de test GROEN te blijven (de baseline zit in de
//                        basis, alleen de [TOLERANT]-write sneuvelt), zonder de
//                        flush hoort hij ROOD te worden. Zo is aantoonbaar dat
//                        de flushstap dragend is en niet decoratief.
//   drop-action-cache    de action-cache verdwijnt vóór de herstart -> punt 5.
//   drop-lookup-indexes  de code- en invite-index verdwijnen -> punt 2.
//
// AOF volledig uit is de vijfde variant en zit bewust NIET in deze schakelaar:
// dat is een andere containeropstart (`--appendonly no --save ""`) en geen
// gedrag van deze test.
//
// ======================================================================
// 4. GRENZEN AAN WAT ER OMGELEGD WORDT
// ======================================================================
//
// Er draait op deze machine ook een PRODUCTIE-stack (`aseso-game`) met een eigen
// Redis. Die wordt niet aangeraakt. De container wordt daarom niet op naam
// gezocht maar op de twee Compose-labels van het TESTproject, en daarna wordt
// nog gecontroleerd dat hij 6379 publiceert op precies 127.0.0.1:6380 — dezelfde
// poortgrens die `test-redis.mjs` voor de verbinding afdwingt. Klopt er iets
// niet, dan gaat er geen enkel `docker`-commando de deur uit.

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';

import {
  actionCacheKey,
  matchKey,
  roomCodeLookupKey,
  roomInviteLookupKey,
  roomKey,
  roomPlayersKey,
  roomSessionsKey,
  roomsActiveKey,
  roundKey,
  scoreboardKey,
} from '../../redis-keys.js';
import { assertAnswerShape } from '../../types/answer.js';
import { createRedisConnection } from './connection.mjs';
import { createRedisDataStore } from './data-store.mjs';
import {
  TEST_REDIS_DATABASE,
  TEST_REDIS_PORT,
  acquireRedisTestLock,
  probeTestRedis,
  testConnectionConfig,
} from './test-redis.mjs';

const execFileAsync = promisify(execFile);

// ----------------------------------------------------------------------
// Sabotagestand — zie punt 3 in de kop.
// ----------------------------------------------------------------------

const SABOTAGE_MODES = new Set(['skip-flush', 'truncate-incr-aof', 'drop-action-cache', 'drop-lookup-indexes']);

/**
 * Kommagescheiden, want de interessantste variant is een COMBINATIE:
 * `skip-flush,truncate-incr-aof` is het `everysec`-venster in zijn volle vorm —
 * een baseline die niet aantoonbaar is doorgeschreven, en een host die alles
 * kwijtraakt wat nog niet in het gefsyncte basisbestand stond.
 */
const SABOTAGE = new Set(
  (process.env.AOF_RESTART_SABOTAGE ?? '')
    .split(',')
    .map((mode) => mode.trim())
    .filter(Boolean)
);
for (const mode of SABOTAGE) {
  if (SABOTAGE_MODES.has(mode)) continue;
  // Een typefout in de sabotagestand zou stilzwijgend "geen sabotage" worden en
  // dan lijkt een verzwakte opstelling groen. Liever hard stuk.
  throw new Error(
    `AOF_RESTART_SABOTAGE bevat ${JSON.stringify(mode)}, dat is geen bekende stand. Keuze uit: ` +
      [...SABOTAGE_MODES].map((known) => JSON.stringify(known)).join(', ')
  );
}

// ----------------------------------------------------------------------
// De testcontainer opzoeken en verifiëren. Geen containernaam in de code: het
// LABELPAAR van het testproject is de identiteit, de poort is de grens.
// ----------------------------------------------------------------------

const COMPOSE_PROJECT = 'aseso-game-test';
const COMPOSE_SERVICE = 'redis-test';
const AOF_DIR = '/data/appendonlydir';
const DATA_VOLUME = `${COMPOSE_PROJECT}_redis-test-data`;

/**
 * @param {string[]} args
 * @returns {Promise<string>} stdout, getrimd
 */
async function docker(args) {
  const { stdout } = await execFileAsync('docker', args, { encoding: 'utf8', timeout: 60_000 });
  return stdout.trim();
}

/**
 * Zoekt de testcontainer en weigert alles wat er niet exact op lijkt.
 * @returns {Promise<{ id: string } | { skip: string }>}
 */
async function findTestRedisContainer() {
  let ids;
  try {
    ids = (
      await docker([
        'ps',
        '--filter',
        `label=com.docker.compose.project=${COMPOSE_PROJECT}`,
        '--filter',
        `label=com.docker.compose.service=${COMPOSE_SERVICE}`,
        '--format',
        '{{.ID}}',
      ])
    )
      .split('\n')
      .filter(Boolean);
  } catch (error) {
    return { skip: `docker is niet bruikbaar vanuit deze testrun (${/** @type {Error} */ (error)?.message}).` };
  }

  if (ids.length !== 1) {
    return {
      skip:
        `Verwachtte precies één draaiende container met labels ${COMPOSE_PROJECT}/${COMPOSE_SERVICE}, vond er ${ids.length}. ` +
        `Start hem met: docker compose -p ${COMPOSE_PROJECT} -f compose.test.yml up -d`,
    };
  }

  const id = ids[0];
  const ports = JSON.parse(await docker(['inspect', id, '--format', '{{json .NetworkSettings.Ports}}']));
  const bindings = ports?.['6379/tcp'] ?? [];
  const published = bindings.map((/** @type {{HostIp: string, HostPort: string}} */ b) => `${b.HostIp}:${b.HostPort}`);
  if (published.length !== 1 || published[0] !== `127.0.0.1:${TEST_REDIS_PORT}`) {
    // Verdediging in de diepte, in dezelfde geest als assertTestInstance(): een
    // container die iets anders publiceert dan 127.0.0.1:6380 is niet de
    // wegwerpinstantie en wordt niet omgelegd.
    throw new Error(
      `WEIGERING: container ${id} publiceert ${JSON.stringify(published)} in plaats van ` +
        `["127.0.0.1:${TEST_REDIS_PORT}"]. Dit wordt niet herstart.`
    );
  }
  return { id };
}

// ----------------------------------------------------------------------
// Fixtures. Dezelfde stijl als data-store.test.mjs: vaste literals, geen klok
// in de DOCUMENTEN, geen willekeur in de inhoud.
//
// MAAR DE ROOM-IDENTITEIT IS PER RUN UNIEK, en dat is geen smaak. Een vaste
// `roomId` maakt deze test namelijk stiekem onbetrouwbaar: de AOF van een
// VORIGE run bevat dan een room met exact dezelfde id, code, invite-hash,
// spelers en scores. Zodra een herstart oude AOF-inhoud terugbrengt — precies
// wat de `truncate-incr-aof`-stand nabootst — leest de test dat spul terug en
// staat groen op data die hij zelf nooit geschreven heeft. Dat is niet
// bedacht maar waargenomen: met vaste identifiers stond de combinatie
// `skip-flush,truncate-incr-aof` 13 van de 14 groen terwijl de baseline van
// DIE run allang weg was.
//
// De identifiers blijven KORT: de bestandskant-controle grept naar
// `room:{roomId}` in het RDB-basisbestand, en Redis LZF-comprimeert strings
// vanaf ongeveer twintig tekens. `room:` + zeven is er twaalf.
// ----------------------------------------------------------------------

/** Zes tekens uit pid en klok: uniek genoeg tussen runs, kort genoeg voor de grep. */
const RUN_TAG =
  (process.pid % 46656).toString(36).padStart(3, '0') + (Date.now() % 46656).toString(36).padStart(3, '0');

const ROOM_ID = `a${RUN_TAG}`;
const ROOM_CODE = RUN_TAG.toUpperCase();
const INVITE_HASH = `h${RUN_TAG}`;
const MATCH_ID = 'm1';
const ROUND_ID = 'r1';
const TOLERATED_ROUND_ID = 'r2';
const SESSION_ID = 's1';
const ACTION_ID = 'act1';

/** Eén uur, zodat punt 4 letterlijk toetsbaar is: "had nog een uur, heeft nog ongeveer een uur". */
const TTL_SECONDS = 3600;

const T = 1785600000000;

function makeConfig() {
  return {
    preset: 'klassiek', gameTypes: ['flags_mc'], language: 'nl', difficulty: 'gemiddeld',
    totalRounds: 10, questionSeconds: 15, resultSeconds: 5, scoreboardSeconds: 8,
    scoreboardFrequency: 'elke_ronde', pacing: 'auto', speedBonus: true, deadlineGraceMs: 250,
    mode: 'individual', teamNames: [], metricMode: 'punten', maxPlayers: 20, allowLateJoin: true,
  };
}

function makeRoom(overrides = {}) {
  return {
    id: ROOM_ID, code: ROOM_CODE, inviteId: `invite_${RUN_TAG}`, phase: 'ROUND_ACTIVE',
    createdAt: T, lastActivityAt: T, hostSessionIds: [SESSION_ID], locked: false,
    config: makeConfig(), currentMatchId: MATCH_ID, ...overrides,
  };
}

function makeSession(overrides = {}) {
  return {
    id: SESSION_ID, roomId: ROOM_ID, roles: ['host'], playerId: null, tokenHash: `hash_${RUN_TAG}`,
    createdAt: T, lastSeenAt: T, connectedSocketIds: [], revoked: false, ...overrides,
  };
}

function makePlayer(overrides = {}) {
  return {
    id: 'p1', roomId: ROOM_ID, sessionId: SESSION_ID, displayName: null,
    generatedName: 'Blauwe Vos', effectiveName: 'Blauwe Vos', nameSource: 'generated',
    teamId: null, score: 0, correctCount: 0, correctResponseTimeMsTotal: 0, connected: true,
    eligibleFromRound: 1, joinedAt: T, left: false, kicked: false, ...overrides,
  };
}

function makeMatch(overrides = {}) {
  return {
    id: MATCH_ID, roomId: ROOM_ID, sequence: 1, phase: 'ROUND_ACTIVE', startedAt: T,
    finishedAt: null, roundIndex: 0, roundIds: [ROUND_ID], usedQuestionKeys: ['flags_mc:nl'],
    previousMatchQuestionKeys: [], pausedState: null, contentVersion: '2026.08.1',
    rendererVersion: 'flag-renderer-1', ...overrides,
  };
}

function makeRound(overrides = {}) {
  return {
    id: ROUND_ID, matchId: MATCH_ID, gameType: 'flags_mc', questionKey: 'flags_mc:nl',
    publicQuestionPayload: { promptKey: 'btnWhichFlag', optionIso2s: ['nl', 'be', 'fr', 'de'] },
    correctAnswer: { optionId: 'nl' }, validOptionIds: ['nl', 'be', 'fr', 'de'],
    startsAt: T, endsAt: T + 15000, status: 'ACTIVE', ...overrides,
  };
}

function makeAnswer(overrides = {}) {
  const answer = {
    roundId: ROUND_ID, playerId: 'p1', actionId: ACTION_ID, answer: { optionId: 'nl' },
    receivedAt: T + 2000, responseTimeMs: 2000, correct: true, points: 120, ...overrides,
  };
  assertAnswerShape(answer);
  return answer;
}

/**
 * De inzending van p1. Wordt TWEE KEER gebruikt met exact dezelfde `actionId`:
 * één keer vóór de herstart (echte write) en één keer erna (moet een replay
 * zijn). Daarom is het een functie en geen gedeeld object — een aanroeper die
 * hem per ongeluk muteert zou punt 5 stilzwijgend onwaar maken.
 */
function makeAnswerWrite() {
  return {
    answer: makeAnswer(),
    updatedPlayer: { id: 'p1', score: 120, correctCount: 1, correctResponseTimeMsTotal: 2000 },
    actionCacheEntry: { actionId: ACTION_ID, ack: { roundId: ROUND_ID, points: 120 } },
  };
}

/** Alle sleutels waarvan punt 4 de TTL bewaakt. */
function ttlWatchedKeys() {
  return {
    room: roomKey(ROOM_ID),
    sessions: roomSessionsKey(ROOM_ID),
    players: roomPlayersKey(ROOM_ID),
    actionCache: actionCacheKey(ROOM_ID),
    match: matchKey(ROOM_ID, MATCH_ID),
    round: roundKey(ROOM_ID, MATCH_ID, ROUND_ID),
    scoreboard: scoreboardKey(ROOM_ID, MATCH_ID),
    codeIndex: roomCodeLookupKey(ROOM_CODE),
    inviteIndex: roomInviteLookupKey(INVITE_HASH),
  };
}

// ----------------------------------------------------------------------
// Kleine gereedschappen.
// ----------------------------------------------------------------------

/** @param {string} text @returns {Record<string, string>} */
function parseInfo(text) {
  /** @type {Record<string, string>} */
  const fields = {};
  for (const line of String(text).split('\n')) {
    if (line.startsWith('#')) continue;
    const separator = line.indexOf(':');
    if (separator > 0) fields[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return fields;
}

/**
 * Pollt tot `check` waar is. Dit is GEEN klokwachten: er wordt op een
 * waarneembare toestand gewacht, en de tijd is alleen een bovengrens waarna de
 * test opgeeft met een bruikbare melding.
 * @param {string} what
 * @param {() => Promise<boolean>} check
 * @param {{ timeoutMs?: number, pollMs?: number }} [options]
 */
async function pollUntil(what, check, { timeoutMs = 60_000, pollMs = 25 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await check()) return;
    if (Date.now() > deadline) throw new Error(`Wachtte tevergeefs op: ${what} (${timeoutMs} ms).`);
    await delay(pollMs);
  }
}

// ======================================================================
// Opstartcontroles: alles wat ontbreekt levert een SKIP MET REDEN op, nooit
// stilzwijgend groen.
// ======================================================================

const releaseLock = await acquireRedisTestLock({ label: 'aof-restart.test.mjs' });
const probe = await probeTestRedis();
const container = probe.ok ? await findTestRedisContainer() : { skip: probe.reason };
const skipReason = 'skip' in container ? container.skip : '';

if (skipReason) {
  await releaseLock();
  describe('Redis-adapter — AOF-herstart (INTB2e)', { skip: skipReason }, () => {});
} else {
  assert.ok(TEST_REDIS_DATABASE >= 8, `testdatabase moet 8..15 zijn, kreeg ${TEST_REDIS_DATABASE}`);
  const containerId = /** @type {{ id: string }} */ (container).id;

  /** Alles wat het scenario waarneemt; de assertie-`it`s lezen hier alleen uit. */
  const observed = {
    /** @type {any} */ baselineBefore: null,
    /** @type {any} */ baselineAfter: null,
    /** @type {Record<string, number>} */ ttlBefore: {},
    /** @type {Record<string, number>} */ ttlAfter: {},
    /** @type {any} */ durability: null,
    /** @type {any} */ replayResult: null,
    /** @type {any} */ playerAfterReplay: null,
    /** @type {any} */ scoreboardAfterReplay: null,
    /** @type {any} */ toleratedRoundAfter: null,
    runIdBefore: '',
    runIdAfter: '',
    downtimeMs: 0,
  };

  /** @type {any} */
  let liveConnection = null;

  after(async () => {
    if (liveConnection) {
      // Opruimen zoals data-store.test.mjs dat doet. Extra reden hier: de
      // fixtures blijven anders in de AOF staan en kunnen bij een volgende
      // herstart weer bovendrijven.
      try {
        await liveConnection.getClient().flushDb();
      } catch {
        /* de instantie kan na een mislukte herstart weg zijn; dat mag de opruiming niet laten klappen */
      }
      await liveConnection.close();
    }
    await releaseLock();
  });

  // ------------------------------------------------------------------
  // Het scenario. Eén keer, in een `before`: de herstart kost seconden en de
  // assertie-`it`s hieronder kijken allemaal naar dezelfde herstelde toestand.
  // ------------------------------------------------------------------
  describe('Redis-adapter — AOF-herstart (INTB2e)', () => {
    before(async () => {
      if (SABOTAGE.size > 0) {
        // Zichtbaar in de testuitvoer, want een verzwakte opstelling die er als
        // een gewone run uitziet is een valstrik voor de volgende lezer.
        console.error(`\n!! AOF_RESTART_SABOTAGE=${[...SABOTAGE].join(',')} — deze run HOORT rood te worden.\n`);
      }

      const connection = createRedisConnection(testConnectionConfig());
      await connection.connect();
      const client = () => connection.getClient();
      const store = createRedisDataStore({ connection, ttlSeconds: TTL_SECONDS });

      await client().flushDb();

      // --------------------------------------------------------------
      // FASE 1 — de baseline. Alles hieronder valt onder [BASELINE].
      // --------------------------------------------------------------
      await store.claimRoomLocatorsAtomically({
        roomId: ROOM_ID, code: ROOM_CODE, inviteHash: INVITE_HASH, ttlSeconds: TTL_SECONDS,
      });
      await store.saveRoom(makeRoom());
      await store.saveSession(makeSession());
      await store.savePlayer(makePlayer({ id: 'p1' }));
      await store.savePlayer(makePlayer({ id: 'p2', generatedName: 'Rode Das', effectiveName: 'Rode Das' }));
      await store.saveMatch(makeMatch());
      await store.saveRound(ROOM_ID, makeRound());

      // De inzending die punt 5 draagt: dit is de write waarvan de HERHALING na
      // de herstart een replay moet zijn. Hij zet in één atomaire klap het
      // Answer, de spelerscore, het scoreboard én de action-cache.
      const first = await store.saveAcceptedAnswerAtomically(ROOM_ID, MATCH_ID, makeAnswerWrite());
      assert.deepStrictEqual(first, { replay: false }, 'de eerste inzending hoort een echte write te zijn');

      observed.baselineBefore = await readEverything(store, client());

      // --------------------------------------------------------------
      // AANTOONBAAR WACHTEN OP PERSISTENTIE — zie punt 2 in de kop.
      // --------------------------------------------------------------
      if (SABOTAGE.has('skip-flush')) {
        observed.durability = { skipped: true };
      } else {
        observed.durability = await forceAofToDisk(client(), containerId);
      }

      // --------------------------------------------------------------
      // FASE 2 — de ENE expliciet gemarkeerde laatste write. Alles hieronder
      // valt onder [TOLERANT]: hij is geschreven ná de flush en mag dus in het
      // `everysec`-venster verdwijnen. Er staat met opzet niets van de baseline
      // in — een tweede ronde is bij te lezen of niet, maar hij verandert geen
      // enkel document dat hierboven al is nagemeten.
      // --------------------------------------------------------------
      await store.saveRound(ROOM_ID, makeRound({ id: TOLERATED_ROUND_ID, startsAt: T + 20000, endsAt: T + 35000 }));

      observed.ttlBefore = await readTtls(client());
      observed.runIdBefore = parseInfo(await client().sendCommand(['INFO', 'server'])).run_id;

      // Sabotage die vóór de kill moet landen.
      if (SABOTAGE.has('drop-action-cache')) await client().del(actionCacheKey(ROOM_ID));
      if (SABOTAGE.has('drop-lookup-indexes')) {
        await client().del(roomCodeLookupKey(ROOM_CODE));
        await client().del(roomInviteLookupKey(INVITE_HASH));
      }

      // --------------------------------------------------------------
      // FASE 3 — de herstart.
      // --------------------------------------------------------------
      await connection.close();
      const downSince = Date.now();
      await docker(['kill', '--signal=KILL', containerId]);

      if (SABOTAGE.has('truncate-incr-aof')) {
        // De container ligt stil, dus dit kan niet via `docker exec`. Een
        // wegwerpcontainer op hetzelfde volume zet het incrementele AOF-bestand
        // op nul: alles wat nog niet in het gefsyncte basisbestand stond is weg,
        // deterministisch in plaats van afhankelijk van de fsync-tik.
        await docker([
          'run', '--rm', '-v', `${DATA_VOLUME}:/data`, 'alpine:3',
          'sh', '-c', `truncate -s 0 ${AOF_DIR}/*.incr.aof`,
        ]);
      }

      await docker(['start', containerId]);

      // Wachten op een waarneembare toestand, in twee stappen: eerst antwoordt
      // de server weer, daarna is hij klaar met het inlezen van de AOF. Dat
      // tweede is nodig omdat Redis tijdens `loading` al wel PING beantwoordt
      // maar op een GET met -LOADING antwoordt.
      await pollUntil('de testinstantie antwoordt weer op PING', async () => (await probeTestRedis()).ok);

      liveConnection = createRedisConnection(testConnectionConfig());
      await liveConnection.connect();
      const back = () => liveConnection.getClient();
      await pollUntil(
        'Redis is klaar met het inlezen van de AOF (loading:0)',
        async () => parseInfo(await back().sendCommand(['INFO', 'persistence'])).loading === '0'
      );
      observed.downtimeMs = Date.now() - downSince;
      observed.runIdAfter = parseInfo(await back().sendCommand(['INFO', 'server'])).run_id;

      // --------------------------------------------------------------
      // FASE 4 — teruglezen, via een VERSE verbinding en een VERSE store. Een
      // herstellende game-server heeft ook niets anders.
      // --------------------------------------------------------------
      const recovered = createRedisDataStore({ connection: liveConnection, ttlSeconds: TTL_SECONDS });
      observed.baselineAfter = await readEverything(recovered, back());
      observed.ttlAfter = await readTtls(back());
      observed.toleratedRoundAfter = await recovered.loadRound(ROOM_ID, MATCH_ID, TOLERATED_ROUND_ID);

      // Punt 5: exact dezelfde inzending, exact dezelfde actionId. Dit loopt
      // meteen ook door de NOSCRIPT-terugval van `evalSaveAnswer`: de
      // scriptcache van Redis is na een herstart leeg, dus de EVALSHA faalt en
      // de adapter moet zelf het volledige script sturen.
      try {
        observed.replayResult = await recovered.saveAcceptedAnswerAtomically(ROOM_ID, MATCH_ID, makeAnswerWrite());
      } catch (error) {
        // Niet hier laten klappen: de assertie hoort in het `it` van punt 5 te
        // vallen, met de fout als bewijsstuk, niet in een hook die alle andere
        // punten meesleurt.
        observed.replayResult = { threw: error };
      }
      observed.playerAfterReplay = await recovered.loadPlayer(ROOM_ID, 'p1');
      observed.scoreboardAfterReplay = await recovered.getScoreboardTop(ROOM_ID, MATCH_ID, 10);
    });

    // ================================================================
    // Meta: was de herstart wel echt? Zonder dit is elke assertie hieronder
    // gratis groen als het kill/start-paar stilletjes niets doet.
    // ================================================================
    it('[META] de instantie is echt opnieuw opgestart (nieuw run_id)', () => {
      assert.ok(observed.runIdBefore, 'run_id vóór de herstart ontbreekt');
      assert.notStrictEqual(
        observed.runIdAfter,
        observed.runIdBefore,
        'run_id is gelijk gebleven: er is geen nieuw Redis-proces geweest, dus deze test bewijst niets'
      );
    });

    it('[META] de baseline stond aantoonbaar op disk vóór de herstart', () => {
      assert.ok(observed.durability, 'geen persistentiebewijs vastgelegd');
      assert.strictEqual(
        observed.durability.skipped,
        undefined,
        'de flush is overgeslagen (AOF_RESTART_SABOTAGE=skip-flush): de baseline is niet aantoonbaar doorgeschreven'
      );
      assert.strictEqual(observed.durability.status, 'ok', 'aof_last_bgrewrite_status was niet ok');
      assert.ok(
        observed.durability.rewritesAfter > observed.durability.rewritesBefore,
        'aof_rewrites is niet opgehoogd: er is geen rewrite afgerond'
      );
      assert.notStrictEqual(
        observed.durability.baseFileAfter,
        observed.durability.baseFileBefore,
        'het manifest wijst nog naar hetzelfde basisbestand'
      );
      assert.ok(
        observed.durability.baseFileHits > 0,
        `het gefsyncte AOF-basisbestand (${observed.durability.baseFileAfter}) bevat ${roomKey(ROOM_ID)} niet`
      );
    });

    // ================================================================
    // Punt 1 — de room bestaat nog. [BASELINE], geen tolerantie.
    // ================================================================
    it('[BASELINE] punt 1 — het roomdocument komt ongewijzigd terug', () => {
      assert.notStrictEqual(observed.baselineAfter.room, null, 'de room is weg na de herstart');
      assert.deepStrictEqual(observed.baselineAfter.room, observed.baselineBefore.room);
    });

    it('[BASELINE] punt 1 — matchdocument, ronde en sessie komen ongewijzigd terug', () => {
      assert.deepStrictEqual(observed.baselineAfter.match, observed.baselineBefore.match);
      assert.deepStrictEqual(observed.baselineAfter.round, observed.baselineBefore.round);
      assert.deepStrictEqual(observed.baselineAfter.session, observed.baselineBefore.session);
    });

    it('[BASELINE] punt 1 — spelers en scoreboard komen ongewijzigd terug', () => {
      assert.deepStrictEqual(observed.baselineAfter.players, observed.baselineBefore.players);
      assert.deepStrictEqual(observed.baselineAfter.scoreboard, observed.baselineBefore.scoreboard);
      assert.deepStrictEqual(observed.baselineAfter.scoreboard, [{ playerId: 'p1', score: 120 }]);
      assert.deepStrictEqual(observed.baselineAfter.answer, observed.baselineBefore.answer);
    });

    // ================================================================
    // Punt 2 — de lookup-indexen. [BASELINE].
    // ================================================================
    it('[BASELINE] punt 2 — loadRoomByCode vindt de room nog', () => {
      assert.notStrictEqual(observed.baselineAfter.byCode, null, 'de code-index is de herstart niet doorgekomen');
      assert.deepStrictEqual(observed.baselineAfter.byCode, observed.baselineBefore.room);
    });

    it('[BASELINE] punt 2 — loadRoomByInviteHash vindt de room nog', () => {
      assert.notStrictEqual(observed.baselineAfter.byInvite, null, 'de invite-index is de herstart niet doorgekomen');
      assert.deepStrictEqual(observed.baselineAfter.byInvite, observed.baselineBefore.room);
    });

    // ================================================================
    // Punt 3 — de room-index. [BASELINE].
    // ================================================================
    it('[BASELINE] punt 3 — rooms:active bevat de room nog', () => {
      assert.deepStrictEqual(observed.baselineAfter.activeRooms, [ROOM_ID]);
      assert.deepStrictEqual(observed.baselineAfter.activeRooms, observed.baselineBefore.activeRooms);
    });

    // ================================================================
    // Punt 4 — TTL's. [BASELINE].
    //
    // Redis schrijft vervaltijden als ABSOLUUT tijdstip weg (PEXPIREAT), dus de
    // klok loopt tijdens de downtime door. Vandaar de bandbreedte: nooit hoger
    // dan vóór de herstart (dat zou een reset zijn), en niet verder gezakt dan
    // de downtime plus wat speling.
    // ================================================================
    it('[BASELINE] punt 4 — geen enkele bewaakte sleutel is zijn TTL kwijt', () => {
      for (const [name, key] of Object.entries(ttlWatchedKeys())) {
        const ttl = observed.ttlAfter[name];
        assert.notStrictEqual(ttl, -2, `${name} (${key}) bestaat niet meer na de herstart`);
        assert.notStrictEqual(ttl, -1, `${name} (${key}) heeft geen TTL meer — hij verloopt nu nooit`);
      }
    });

    it('[BASELINE] punt 4 — een room die nog een uur had, heeft er nog ongeveer een uur', () => {
      const slack = Math.ceil(observed.downtimeMs / 1000) + 30;
      for (const [name, key] of Object.entries(ttlWatchedKeys())) {
        const before = observed.ttlBefore[name];
        const ttl = observed.ttlAfter[name];
        assert.ok(
          ttl <= before,
          `${name} (${key}): TTL is OMHOOG gegaan (${before} -> ${ttl}) — dat is een reset, geen behoud`
        );
        assert.ok(
          ttl >= before - slack,
          `${name} (${key}): TTL is verder gezakt dan de downtime verklaart (${before} -> ${ttl}, speling ${slack} s)`
        );
        assert.ok(ttl > TTL_SECONDS - 300, `${name} (${key}): TTL ${ttl} lijkt niet meer op het uur dat er stond`);
      }
    });

    // ================================================================
    // Punt 5 — geen dubbele punten. [BASELINE], en het zwaarste punt: het hele
    // idempotentiemechanisme van INTB2c is waardeloos als de action-cache een
    // herstart niet overleeft.
    //
    // Wat er zonder een overlevende action-cache gebeurt, is trouwens niet
    // "dubbele punten": SAVE_ANSWER_LUA controleert ná de idempotentiecheck ook
    // nog of er al een Answer voor deze speler in deze ronde staat, en werpt dan
    // ALREADY_ANSWERED. Die tweede verdedigingslinie houdt de score heel, maar
    // de aanroeper krijgt een FOUT waar hij een herhaalbare ack hoort te
    // krijgen — en dat is precies wat de client als "mijn antwoord is niet
    // aangekomen" te zien krijgt. Beide worden hieronder geëist.
    // ================================================================
    it('[BASELINE] punt 5 — dezelfde actionId levert na de herstart een replay op', () => {
      if (observed.replayResult?.threw) {
        throw new Error(
          'de herhaalde inzending werd geen replay maar een fout: ' +
            `${observed.replayResult.threw?.code ?? ''} ${observed.replayResult.threw?.message}`
        );
      }
      assert.deepStrictEqual(observed.replayResult, { replay: true });
    });

    it('[BASELINE] punt 5 — de score is na de herhaalde inzending ongewijzigd', () => {
      assert.strictEqual(observed.playerAfterReplay?.score, 120, 'de score van p1 is veranderd door een herhaling');
      assert.strictEqual(observed.playerAfterReplay?.correctCount, 1);
      assert.deepStrictEqual(observed.scoreboardAfterReplay, [{ playerId: 'p1', score: 120 }]);
    });

    it('[BASELINE] punt 5 — de action-cache zelf (de ack-payload) heeft de herstart overleefd', () => {
      assert.deepStrictEqual(observed.baselineAfter.actionEntry, {
        actionId: ACTION_ID,
        ack: { roundId: ROUND_ID, points: 120 },
      });
    });

    // ================================================================
    // De enige [TOLERANT]-assertie. Hier — en NERGENS anders — mag verlies.
    // ================================================================
    it('[TOLERANT] de laatste write ná de flush wordt niet geëist, alleen gerapporteerd', () => {
      const survived = observed.toleratedRoundAfter !== null;
      // Bewust GEEN assert op `survived`. Deze write is na de aantoonbare flush
      // gedaan en valt daarmee in het `everysec`-venster; hem eisen zou de test
      // afhankelijk maken van timing. Wat wel geëist wordt: als hij er is, is
      // hij HEEL — een half of verminkt document is geen tolereerbaar verlies
      // maar corruptie.
      if (survived) {
        assert.deepStrictEqual(
          observed.toleratedRoundAfter,
          makeRound({ id: TOLERATED_ROUND_ID, startsAt: T + 20000, endsAt: T + 35000 })
        );
      }
      console.error(
        `    [TOLERANT] laatste write (${roundKey(ROOM_ID, MATCH_ID, TOLERATED_ROUND_ID)}) na ${observed.downtimeMs} ms ` +
          `downtime: ${survived ? 'overleefd' : 'verloren'} — beide uitkomsten zijn goed.`
      );
    });
  });

  // ------------------------------------------------------------------
  // Hulpfuncties die de verbinding nodig hebben.
  // ------------------------------------------------------------------

  /**
   * Leest de hele room terug VIA DE POORT. Bewust niet via losse Redis-
   * commando's: als een herstellende server het er niet uit krijgt, is het weg,
   * ongeacht wat er nog in een of andere sleutel staat.
   * @param {any} store
   * @param {any} client
   */
  async function readEverything(store, client) {
    const players = await store.listPlayers(ROOM_ID);
    return {
      room: await store.loadRoom(ROOM_ID),
      byCode: await store.loadRoomByCode(ROOM_CODE),
      byInvite: await store.loadRoomByInviteHash(INVITE_HASH),
      match: await store.loadMatch(ROOM_ID, MATCH_ID),
      round: await store.loadRound(ROOM_ID, MATCH_ID, ROUND_ID),
      session: await store.loadSession(ROOM_ID, SESSION_ID),
      // `listPlayers` belooft geen volgorde (HGETALL), dus zelf sorteren — net
      // als de conformance-suite doet.
      players: players.sort((/** @type {any} */ a, /** @type {any} */ b) => a.id.localeCompare(b.id)),
      scoreboard: await store.getScoreboardTop(ROOM_ID, MATCH_ID, 10),
      answer: await store.loadAnswer(ROOM_ID, MATCH_ID, ROUND_ID, 'p1'),
      actionEntry: await store.loadActionCacheEntry(ROOM_ID, ACTION_ID),
      // De room-index is het enige dat de poort niet leest (er is geen
      // `listActiveRooms`), dus dit stukje gaat rechtstreeks.
      activeRooms: (await client.sMembers(roomsActiveKey())).sort(),
    };
  }

  /** @param {any} client @returns {Promise<Record<string, number>>} */
  async function readTtls(client) {
    /** @type {Record<string, number>} */
    const ttls = {};
    for (const [name, key] of Object.entries(ttlWatchedKeys())) ttls[name] = await client.ttl(key);
    return ttls;
  }

  /**
   * DE AANTOONBARE FLUSH. Zie punt 2 in de kop voor waarom dit geen `sleep` is.
   *
   * `BGREWRITEAOF` forkt, schrijft de dataset zoals die bij de fork was naar een
   * nieuw basisbestand, `fsync`t dat en zet daarna pas het manifest om. Als de
   * teller `aof_rewrites` is opgehoogd en er geen rewrite meer loopt, staat de
   * baseline dus op disk — niet "waarschijnlijk", maar gefsynct.
   *
   * Daarbovenop de bestandskant: het manifest wijst een ANDER basisbestand aan
   * dan ervoor, en dat bestand bevat de sleutel `room:{roomId}` letterlijk.
   *
   * @param {any} client
   * @param {string} containerId
   */
  async function forceAofToDisk(client, containerId) {
    const before = parseInfo(await client.sendCommand(['INFO', 'persistence']));
    const baseFileBefore = await currentAofBaseFile(containerId);

    await client.sendCommand(['BGREWRITEAOF']);

    /** @type {Record<string, string>} */
    let info = {};
    await pollUntil('BGREWRITEAOF is afgerond', async () => {
      info = parseInfo(await client.sendCommand(['INFO', 'persistence']));
      return info.aof_rewrite_in_progress === '0' && Number(info.aof_rewrites) > Number(before.aof_rewrites);
    });

    const baseFileAfter = await currentAofBaseFile(containerId);
    const hits = await docker([
      'exec', containerId, 'sh', '-c',
      // `grep -c` geeft exitcode 1 bij nul treffers; die mag hier geen fout zijn,
      // want "niet gevonden" is een BEVINDING en geen kapot commando.
      `grep -ac '${roomKey(ROOM_ID)}' ${AOF_DIR}/${baseFileAfter} || true`,
    ]);

    return {
      rewritesBefore: Number(before.aof_rewrites),
      rewritesAfter: Number(info.aof_rewrites),
      status: info.aof_last_bgrewrite_status,
      baseFileBefore,
      baseFileAfter,
      baseFileHits: Number(hits.trim()),
    };
  }

  /**
   * Het basisbestand waar het AOF-manifest nu naar wijst.
   * @param {string} containerId
   */
  async function currentAofBaseFile(containerId) {
    const manifest = await docker(['exec', containerId, 'cat', `${AOF_DIR}/appendonly.aof.manifest`]);
    const match = /^file\s+(\S+)\s+seq\s+\d+\s+type\s+b$/m.exec(manifest);
    if (!match) throw new Error(`Geen basisbestand in het AOF-manifest gevonden:\n${manifest}`);
    return match[1];
  }
}
