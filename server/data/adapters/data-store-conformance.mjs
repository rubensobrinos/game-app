// Conformance-suite voor de DataStore-poort (server/data/repository.js).
//
// Eén suite, elke implementatie. De in-memory fake draait hem vandaag
// (data-store-conformance.test.mjs); een Redis-adapter richt hem straks op
// zichzelf zonder één regel te kopiëren. Dit bestand IS het gedragscontract —
// wat hier groen is, mag een adapterswap niet veranderen.
//
// GRENZEN VAN DEZE SUITE (bewust, niet vergeten):
//
//   * Alle EENENTWINTIG poortmethoden zijn gedekt op vier categorieën: happy
//     path, ontbrekend record, isolatie tussen rooms, en geen gedeelde
//     referenties. Het `describe.skip`-blok voor `saveRound`/`loadAnswer`/
//     `loadActionCacheEntry` is weg: DM11 heeft die drie signaturen verbreed
//     met `roomId` (HANDOFF-item INTB-1), dus de bodies die tégen de verbrede
//     signaturen waren geschreven draaien nu gewoon mee.
//   * De vijf atomaire/lifecycle-methoden (`setRoomAndMatchPhaseAtomically`,
//     `saveAcceptedAnswerAtomically`, `claimRoomLocatorsAtomically`,
//     `releaseRoomLocators`, `refreshRoomLocators`) staan in DEZELFDE suite en
//     niet in een tweede harness. De eerste twee worden daarnaast als
//     *arrangement* gebruikt door de getScoreboardTop-tests (het scoreboard
//     heeft geen andere schrijfweg).
//   * De room-locators zijn een LIFECYCLE, geen losse setter: claim → gebruik
//     → release/refresh (DM10, HANDOFF-item INTB-2). `saveRoom` raakt de
//     lookup-indexen NIET aan — sinds het besluit bij INTB-9/INTB-11 (zie
//     `docs/integration-plan/BESLUIT-INTB-locators-en-sessieindex.md`, deel A)
//     zijn `claimRoomLocatorsAtomically`, `rotateRoomLocators` en
//     `releaseRoomLocators` de enige drie schrijvers ervan. Elke test die langs
//     `loadRoomByCode` of `loadRoomByInviteHash` leest, claimt dus eerst; dat
//     spiegelt de echte flow, waarin de claim altijd aan de roomcreatie
//     voorafgaat. De test "alleen saveRoom maakt een room niet vindbaar via
//     zijn code" legt dat besluit expliciet vast.
//   * DRIE TESTS STAAN BEWUST ROOD, op HANDOFF-item INTB-4. Zie het
//     gelijknamige blok onderaan: de fake dwingt idempotentie op `actionId` en
//     "één antwoord per speler per ronde" niet af, terwijl DATA-MODEL.md die
//     controles (stappen 4 en 5) expliciet ÍN de atomaire operatie plaatst.
//     Die tests zijn tegen het correcte contract geschreven, niet tegen het
//     huidige gedrag: ze horen groen te worden door de fake te corrigeren, niet
//     door de verwachting af te zwakken.
//
// Alleen node:test en node:assert. Geen klok, geen willekeur: alle fixtures
// gebruiken vaste literals, zodat een falende test altijd reproduceerbaar is.
//
// ESM tegen CommonJS: `server/data/` is CommonJS, dit bestand is ESM
// (DECISIONS #28). De named imports hieronder werken ongewijzigd via Node's
// CJS-interop, omdat elke module een object-literal aan `module.exports`
// toekent.

import { it } from 'node:test';
import assert from 'node:assert/strict';

import { assertRoomShape } from '../types/room.js';
import { assertSessionShape } from '../types/session.js';
import { assertPlayerShape } from '../types/player.js';
import { assertMatchShape } from '../types/match.js';
import { assertRoundShape } from '../types/round.js';
import { assertAnswerShape } from '../types/answer.js';
import { assertGameConfigurationShape } from '../types/game-configuration.js';

// --------------------------------------------------------------------------
// Vaste tijdstippen. Geen Date.now(): een falende test moet morgen exact
// hetzelfde falen als vandaag.
// --------------------------------------------------------------------------

const T_CREATED = 1785600000000;
const T_ACTIVITY = 1785600060000;
const T_ROUND_STARTS = 1785600120000;
const T_ROUND_ENDS = 1785600135000;

// --------------------------------------------------------------------------
// Fixtures. Elke builder valideert zijn resultaat met de bijbehorende
// assert*Shape uit server/data/types/, zodat een ongeldige fixture hier
// stukloopt in plaats van een adapter te laten slagen op data die in productie
// nooit voorkomt.
//
// GEEN `countdownEndsAt` in Match- of Round-fixtures (DECISIONS #16: vluchtig,
// wordt bij de transitie berekend en niet persistent opgeslagen).
// --------------------------------------------------------------------------

function makeGameConfiguration(overrides = {}) {
  const config = {
    preset: 'klassiek',
    gameTypes: ['flags_mc', 'capitals_mc'],
    language: 'nl',
    difficulty: 'gemiddeld',
    totalRounds: 10,
    questionSeconds: 15,
    resultSeconds: 5,
    scoreboardSeconds: 8,
    scoreboardFrequency: 'elke_ronde',
    pacing: 'auto',
    speedBonus: true,
    deadlineGraceMs: 250,
    mode: 'individual',
    teamNames: [],
    metricMode: 'punten',
    maxPlayers: 20,
    allowLateJoin: true,
    ...overrides,
  };
  assertGameConfigurationShape(config);
  return config;
}

function makeRoom(overrides = {}) {
  const room = {
    id: 'room_a',
    code: 'AAA111',
    inviteId: 'invite_a',
    phase: 'LOBBY',
    createdAt: T_CREATED,
    lastActivityAt: T_ACTIVITY,
    hostSessionIds: ['session_host_a'],
    locked: false,
    config: makeGameConfiguration(),
    currentMatchId: null,
    ...overrides,
  };
  assertRoomShape(room);
  return room;
}

/**
 * Eén `RoomLocatorClaim` (repository.js): het paar (join-code, invite-hash) dat
 * een room atomair claimt, plus de TTL die als vangnet dient voor een creatie
 * die halverwege sneuvelt.
 *
 * `inviteHash`, niet `inviteId`: de aanroeper hasht vóór de repository
 * (`hashInviteId()` uit `server/architecture/room-codes.js`). Die functie wordt
 * hier BEWUST niet geïmporteerd — `server/data` -> `server/architecture` is de
 * verkeerde afhankelijkheidsrichting (zie de gelijke noot in types/room.js), en
 * de poort behandelt de hash toch als een ondoorzichtige string. Vaste
 * literals dus, net als bij elke andere fixture hier.
 *
 * Geen `assertRoomLocatorClaimShape` in server/data/types/: een claim is geen
 * persistent document maar een parameterobject. De invarianten die de poort
 * wél veronderstelt staan daarom hieronder, zodat een kapotte fixture hier
 * stukloopt in plaats van een adapter te laten slagen op onzin.
 */
const LOCATOR_TTL_SECONDS = 3600;
const INVITE_HASH_A = 'invitehash_a';
const INVITE_HASH_B = 'invitehash_b';

function makeLocatorClaim(overrides = {}) {
  const claim = {
    roomId: 'room_a',
    code: 'AAA111',
    inviteHash: INVITE_HASH_A,
    ttlSeconds: LOCATOR_TTL_SECONDS,
    ...overrides,
  };
  for (const field of ['roomId', 'code', 'inviteHash']) {
    assert.ok(
      typeof claim[field] === 'string' && claim[field].length > 0,
      `RoomLocatorClaim.${field} moet een niet-lege string zijn, kreeg: ${JSON.stringify(claim[field])}`
    );
  }
  assert.ok(
    Number.isInteger(claim.ttlSeconds) && claim.ttlSeconds > 0,
    `RoomLocatorClaim.ttlSeconds moet een positief geheel getal zijn, kreeg: ${JSON.stringify(claim.ttlSeconds)}`
  );
  return claim;
}

/** De `RoomLocatorPair` van een claim: dezelfde drie velden zonder de TTL. */
function toLocatorPair({ roomId, code, inviteHash }) {
  return { roomId, code, inviteHash };
}

function makeSession(overrides = {}) {
  const session = {
    id: 'session_1',
    roomId: 'room_a',
    roles: ['host'],
    playerId: null,
    tokenHash: 'hash_session_1',
    createdAt: T_CREATED,
    lastSeenAt: T_ACTIVITY,
    connectedSocketIds: ['socket_1'],
    revoked: false,
    ...overrides,
  };
  assertSessionShape(session);
  return session;
}

function makePlayer(overrides = {}) {
  const player = {
    id: 'player_1',
    roomId: 'room_a',
    sessionId: 'session_1',
    displayName: null,
    generatedName: 'Blauwe Vos',
    effectiveName: 'Blauwe Vos',
    nameSource: 'generated',
    teamId: null,
    score: 0,
    correctCount: 0,
    correctResponseTimeMsTotal: 0,
    connected: true,
    eligibleFromRound: 1,
    joinedAt: T_CREATED,
    left: false,
    kicked: false,
    ...overrides,
  };
  assertPlayerShape(player);
  return player;
}

function makeMatch(overrides = {}) {
  const match = {
    id: 'match_1',
    roomId: 'room_a',
    sequence: 1,
    phase: 'ROUND_ACTIVE',
    startedAt: T_CREATED,
    finishedAt: null,
    roundIndex: 0,
    roundIds: ['round_1'],
    usedQuestionKeys: ['flags_mc:nl'],
    previousMatchQuestionKeys: [],
    pausedState: null,
    contentVersion: '2026.08.1',
    rendererVersion: 'flag-renderer-1',
    ...overrides,
  };
  assertMatchShape(match);
  return match;
}

/**
 * Eén `MatchPausedState` (server/data/types/match.js), zoals
 * `setRoomAndMatchPhaseAtomically` hem sinds DM19 in DEZELFDE atomaire stap
 * als de fasewissel wegschrijft.
 *
 * Validatie loopt via `makeMatch` en niet via een directe
 * `assertPausedStateShape`: die functie wordt niet los geëxporteerd, en een
 * pausedState is per contract alleen geldig samen met `phase: 'PAUSED'`. Zo
 * loopt een kapotte fixture hier stuk in plaats van een adapter te laten
 * slagen op een vorm die productie nooit accepteert.
 */
function makePausedState(overrides = {}) {
  const pausedState = {
    previousPhase: 'ROUND_ACTIVE',
    remainingMs: 7000,
    reason: 'host_paused',
    pausedAt: T_ROUND_STARTS + 8000,
    ...overrides,
  };
  makeMatch({ phase: 'PAUSED', pausedState });
  return pausedState;
}

function makeRound(overrides = {}) {
  const round = {
    id: 'round_1',
    matchId: 'match_1',
    gameType: 'flags_mc',
    questionKey: 'flags_mc:nl',
    publicQuestionPayload: { promptKey: 'btnWhichFlag', optionIso2s: ['nl', 'be', 'fr', 'de'] },
    correctAnswer: { optionId: 'nl' },
    validOptionIds: ['nl', 'be', 'fr', 'de'],
    startsAt: T_ROUND_STARTS,
    endsAt: T_ROUND_ENDS,
    status: 'ACTIVE',
    ...overrides,
  };
  assertRoundShape(round);
  return round;
}

function makeAnswer(overrides = {}) {
  const answer = {
    roundId: 'round_1',
    playerId: 'player_1',
    actionId: 'action_1',
    answer: { optionId: 'nl' },
    receivedAt: T_ROUND_STARTS + 2000,
    responseTimeMs: 2000,
    correct: true,
    points: 120,
    ...overrides,
  };
  assertAnswerShape(answer);
  return answer;
}

/**
 * Eén volledige `AcceptedAnswerWrite` (zie de typedef in repository.js): de
 * drie dingen die stappen 7–10 van de atomaire antwoordverwerking in ÉÉN
 * mutatie moeten wegschrijven.
 *
 * `updatedPlayer` draagt ABSOLUTE nieuwe waarden, geen delta — de aanroeper
 * (answer-flow.js) rekent `player.score + points` zelf uit. Daarom staan
 * `points` (van dit antwoord) en `score` (het nieuwe totaal) hier als aparte
 * parameters: elke test schrijft zijn eigen sommetje expliciet op, zodat de
 * verwachte eindscore in de test staat en niet in een hulpfunctie verdwijnt.
 *
 * `ack` volgt answer-flow.js: `{ roundId }`, zonder correct/points.
 */
function makeAcceptedAnswerWrite({
  roundId = 'round_1',
  playerId = 'player_1',
  actionId = 'action_1',
  points = 120,
  responseTimeMs = 2000,
  correct = true,
  score = 120,
  correctCount = 1,
  correctResponseTimeMsTotal = 2000,
} = {}) {
  // Beide helften apart valideren: makeAnswer draait assertAnswerShape, en de
  // absolute spelerwaarden moeten samen een geldige Player kunnen vormen.
  // Zonder deze tweede controle zou een test kunnen slagen op een score die
  // server/data/types/player.js in productie weigert.
  makePlayer({ id: playerId, score, correctCount, correctResponseTimeMsTotal });

  return {
    answer: makeAnswer({
      roundId,
      playerId,
      actionId,
      points,
      correct,
      responseTimeMs,
      receivedAt: T_ROUND_STARTS + responseTimeMs,
    }),
    updatedPlayer: { id: playerId, score, correctCount, correctResponseTimeMsTotal },
    actionCacheEntry: { actionId, ack: { roundId } },
  };
}

/**
 * `loadAnswer` en `loadActionCacheEntry` zijn de enige manier om te zien of
 * twee van de vier writes van `saveAcceptedAnswerAtomically` zijn geland. Ze
 * lopen via deze twee hulpfuncties, die de volledige context aannemen, zodat
 * een volgende signatuurwijziging één plek raakt en geen enkele verwachting.
 *
 * Beide dragen sinds DM11 het `roomId` (en `loadAnswer` ook het `matchId`) —
 * dat was HANDOFF-item INTB-1 en is inmiddels opgelost.
 */
function readAnswer(store, context) {
  return store.loadAnswer(context.roomId, context.matchId, context.roundId, context.playerId);
}

function readActionCacheEntry(store, context) {
  return store.loadActionCacheEntry(context.roomId, context.actionId);
}

/**
 * Arrangement voor `getScoreboardTop`: het scoreboard heeft geen eigen
 * schrijfmethode op de poort. De enige weg erheen is
 * `saveAcceptedAnswerAtomically` — dat is INTB1b-terrein en wordt hier dus
 * puur als *setup* gebruikt, nooit geassserteerd.
 */
async function scoreOne(store, { roomId, matchId, playerId, score, actionId, roundId }) {
  await store.saveAcceptedAnswerAtomically(roomId, matchId, {
    answer: makeAnswer({ roundId, playerId, actionId }),
    updatedPlayer: { id: playerId, score, correctCount: 1, correctResponseTimeMsTotal: 2000 },
    actionCacheEntry: { actionId, ack: { status: 'accepted' } },
  });
}

// --------------------------------------------------------------------------
// Hulpstukken
// --------------------------------------------------------------------------

/**
 * Elke test krijgt een verse, lege store; geen volgorde-afhankelijkheid tussen
 * tests. `teardown` is optioneel (de fake heeft hem niet nodig, Redis wel) en
 * draait ook als de test faalt.
 */
function makeRunner(createStore, teardown) {
  return async function withStore(body) {
    const store = await createStore();
    try {
      await body(store);
    } finally {
      if (typeof teardown === 'function') {
        await teardown(store);
      }
    }
  };
}

/** `null`, niet `undefined` — en zeker geen throw. */
function assertIsNull(actual, what) {
  assert.strictEqual(actual, null, `${what} hoort exact null te zijn, kreeg: ${JSON.stringify(actual)}`);
}

/** Sorteert op `id` zodat een assertie geen volgorde afdwingt die de poort niet belooft. */
function byId(documents) {
  return [...documents].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

// --------------------------------------------------------------------------
// De suite
// --------------------------------------------------------------------------

/**
 * @param {{
 *   describe: Function,
 *   name: string,
 *   createStore: () => object | Promise<object>,
 *   teardown?: (store: object) => void | Promise<void>,
 * }} options
 */
export function runDataStoreConformance({ describe, name, createStore, teardown }) {
  if (typeof describe !== 'function') {
    throw new TypeError('runDataStoreConformance: `describe` moet een functie zijn');
  }
  // Tot DM11 stond hier ook de eis dat `describe` een `.skip` heeft, voor het
  // overgeslagen INTB-1-blok. Die eis is weg omdat dat blok nu meedraait: de
  // suite slaat niets meer over. Wie hier ooit weer een `.skip` neerzet, laat
  // een gat in het contract vallen en hoort dat expliciet te verantwoorden.
  if (typeof name !== 'string' || name.length === 0) {
    throw new TypeError('runDataStoreConformance: `name` moet een niet-lege string zijn');
  }
  if (typeof createStore !== 'function') {
    throw new TypeError('runDataStoreConformance: `createStore` moet een fabriek zijn die een verse, lege store oplevert');
  }
  if (teardown !== undefined && typeof teardown !== 'function') {
    throw new TypeError('runDataStoreConformance: `teardown` is optioneel maar moet een functie zijn als hij wordt meegegeven');
  }

  const withStore = makeRunner(createStore, teardown);

  describe(`DataStore-conformance — ${name}`, () => {
    // ------------------------------------------------------------------
    // Room: loadRoom, saveRoom, loadRoomByCode, loadRoomByInviteHash
    //
    // `loadRoomByInviteHash` verving `loadRoomByInviteId` (DM10, HANDOFF-item
    // INTB-7): de poort neemt de HASH, nooit de platte capability, en heeft dus
    // ook nooit de pepper nodig.
    //
    // GEVOLG VOOR DE ARRANGEMENTEN HIERONDER: `saveRoom` schrijft geen enkele
    // lookup-index meer — niet de invite-index (die kon hij nooit: een `Room`
    // draagt `inviteId`, geen `inviteHash`) en sinds het INTB-9-besluit ook niet
    // de code-index. Elke test die langs een van beide ingangen leest, claimt
    // dus eerst met `claimRoomLocatorsAtomically`. Het contract van de claim
    // zelf staat verderop in zijn eigen blok; hier is hij puur arrangement.
    // ------------------------------------------------------------------
    describe('Room', () => {
      it('een opgeslagen room komt veld voor veld ongewijzigd terug', () => withStore(async (store) => {
        const room = makeRoom();
        await store.saveRoom(room);
        assert.deepStrictEqual(await store.loadRoom('room_a'), room);
      }));

      it('een room die nooit is opgeslagen levert null op in plaats van undefined of een fout', () => withStore(async (store) => {
        assertIsNull(await store.loadRoom('room_bestaat_niet'), 'loadRoom van een onbekend id');
      }));

      it('een onbekende join-code levert null op', () => withStore(async (store) => {
        await store.saveRoom(makeRoom());
        await store.claimRoomLocatorsAtomically(makeLocatorClaim());
        assertIsNull(await store.loadRoomByCode('ZZZ999'), 'loadRoomByCode van een onbekende code');
      }));

      it('alleen saveRoom, zonder claim, maakt een room NIET vindbaar via zijn code (INTB-11)', () => withStore(async (store) => {
        // HET BESLUIT, EXPLICIET VASTGELEGD — HANDOFF-item INTB-11, uitgewerkt
        // in BESLUIT-INTB-locators-en-sessieindex.md deel A (akkoord).
        //
        // `claimRoomLocatorsAtomically`, `rotateRoomLocators` en
        // `releaseRoomLocators` zijn de ENIGE drie schrijvers van de
        // lookup-indexen. Elke andere schrijfweg is per definitie een bug: een
        // `saveRoom` die de code-index vult gaat langs de claimcontrole heen, en
        // dan wijst de index naar B terwijl het claimregister A als eigenaar
        // kent — de speler die de code intypt komt in de verkeerde room en een
        // derde room struikelt over een code die van niemand meer is.
        //
        // Deze test is BEWUST niet zwakker geformuleerd dan het besluit: hij
        // eist `null`, niet "mag null zijn". Een implementatie die hier rood
        // staat, hoort te veranderen — de verwachting niet.
        const room = makeRoom();
        await store.saveRoom(room);

        assertIsNull(await store.loadRoomByCode('AAA111'), 'de join-code van een room die nooit geclaimd is');
        assertIsNull(await store.loadRoomByInviteHash(INVITE_HASH_A), 'de invite-hash van een room die nooit geclaimd is');
        // Het roomdocument zelf staat er wél: onvindbaar via de locators is iets
        // anders dan niet opgeslagen. Roomcreatie is tweefasig, geen no-op.
        assert.deepStrictEqual(await store.loadRoom('room_a'), room);

        // En na de claim is hij alsnog vindbaar — zodat deze test niet per
        // ongeluk slaagt op een store die de lookup helemaal niet doet.
        assert.deepStrictEqual(await store.claimRoomLocatorsAtomically(makeLocatorClaim()), { ok: true });
        assert.deepStrictEqual(await store.loadRoomByCode('AAA111'), room);
        assert.deepStrictEqual(await store.loadRoomByInviteHash(INVITE_HASH_A), room);
      }));

      it('een onbekende invite-hash levert null op', () => withStore(async (store) => {
        await store.saveRoom(makeRoom());
        await store.claimRoomLocatorsAtomically(makeLocatorClaim());
        assertIsNull(await store.loadRoomByInviteHash('invitehash_bestaat_niet'), 'loadRoomByInviteHash van een onbekende invite-hash');
      }));

      it('dezelfde room is langs drie ingangen vindbaar: id, join-code en invite-hash', () => withStore(async (store) => {
        const room = makeRoom();
        await store.saveRoom(room);
        await store.claimRoomLocatorsAtomically(makeLocatorClaim());

        assert.deepStrictEqual(await store.loadRoomByCode('AAA111'), room);
        assert.deepStrictEqual(await store.loadRoomByInviteHash(INVITE_HASH_A), room);
        assert.deepStrictEqual(await store.loadRoom('room_a'), room);
      }));

      it('opnieuw opslaan onder hetzelfde id vervangt het document in plaats van er een tweede naast te zetten', () => withStore(async (store) => {
        await store.saveRoom(makeRoom({ phase: 'LOBBY', locked: false }));
        await store.saveRoom(makeRoom({ phase: 'COUNTDOWN', locked: true }));

        const loaded = await store.loadRoom('room_a');
        assert.strictEqual(loaded.phase, 'COUNTDOWN');
        assert.strictEqual(loaded.locked, true);
      }));

      it('twee rooms met een eigen code en invite-hash lekken niet naar elkaar', () => withStore(async (store) => {
        const roomA = makeRoom();
        const roomB = makeRoom({
          id: 'room_b',
          code: 'BBB222',
          inviteId: 'invite_b',
          hostSessionIds: ['session_host_b'],
        });
        await store.saveRoom(roomA);
        await store.saveRoom(roomB);
        await store.claimRoomLocatorsAtomically(makeLocatorClaim());
        await store.claimRoomLocatorsAtomically(makeLocatorClaim({ roomId: 'room_b', code: 'BBB222', inviteHash: INVITE_HASH_B }));

        assert.deepStrictEqual(await store.loadRoom('room_a'), roomA);
        assert.deepStrictEqual(await store.loadRoom('room_b'), roomB);
        assert.deepStrictEqual(await store.loadRoomByCode('AAA111'), roomA);
        assert.deepStrictEqual(await store.loadRoomByCode('BBB222'), roomB);
        assert.deepStrictEqual(await store.loadRoomByInviteHash(INVITE_HASH_A), roomA);
        assert.deepStrictEqual(await store.loadRoomByInviteHash(INVITE_HASH_B), roomB);
      }));

      it('het aanpassen van het weggeschreven object raakt de opslag niet, tot in de geneste config', () => withStore(async (store) => {
        const room = makeRoom();
        await store.saveRoom(room);

        room.phase = 'FINISHED';
        room.hostSessionIds.push('session_indringer');
        room.config.totalRounds = 999;
        room.config.teamNames.push('Rood');

        const loaded = await store.loadRoom('room_a');
        assert.strictEqual(loaded.phase, 'LOBBY');
        assert.deepStrictEqual(loaded.hostSessionIds, ['session_host_a']);
        assert.strictEqual(loaded.config.totalRounds, 10);
        assert.deepStrictEqual(loaded.config.teamNames, []);
      }));

      it('het aanpassen van een teruggelezen room raakt de opslag niet, en een tweede lees levert een los document op', () => withStore(async (store) => {
        await store.saveRoom(makeRoom());

        const first = await store.loadRoom('room_a');
        first.phase = 'FINISHED';
        first.config.totalRounds = 999;
        first.hostSessionIds.push('session_indringer');

        const second = await store.loadRoom('room_a');
        assert.notStrictEqual(second, first);
        assert.deepStrictEqual(second, makeRoom());
      }));

      it('ook de room die via code of invite-hash is teruggelezen is losgekoppeld van de opslag', () => withStore(async (store) => {
        // Apart van de test hierboven: een adapter mag de drie leeswegen los
        // implementeren, dus mag "geen gedeelde referenties" niet alleen langs
        // loadRoom worden bewezen.
        await store.saveRoom(makeRoom());
        await store.claimRoomLocatorsAtomically(makeLocatorClaim());

        const viaCode = await store.loadRoomByCode('AAA111');
        viaCode.phase = 'FINISHED';
        viaCode.config.totalRounds = 999;

        const viaInvite = await store.loadRoomByInviteHash(INVITE_HASH_A);
        assert.deepStrictEqual(viaInvite, makeRoom());
        viaInvite.hostSessionIds.push('session_indringer');

        assert.deepStrictEqual(await store.loadRoomByCode('AAA111'), makeRoom());
        assert.deepStrictEqual(await store.loadRoomByInviteHash(INVITE_HASH_A), makeRoom());
        assert.deepStrictEqual(await store.loadRoom('room_a'), makeRoom());
      }));
    });

    // ------------------------------------------------------------------
    // Room-locators: claimRoomLocatorsAtomically, releaseRoomLocators,
    // refreshRoomLocators
    //
    // HANDOFF-item INTB-2: uniciteit van de join-code afdwingen met een read
    // gevolgd door een write is check-then-act — tussen `loadRoomByCode` en
    // `saveRoom` past een tweede roomcreatie met dezelfde code. De claim sluit
    // dat venster: `room-codes.js` levert kandidaten, de aanroeper claimt, en
    // een bezette locator komt terug als NORMALE returnwaarde (`{ ok: false,
    // conflict }`), niet als exception (DM10-beslissing 4).
    //
    // Code en inviteHash worden SAMEN geclaimd, nooit los (DM10-beslissing 1):
    // een toestand waarin de code geclaimd is en de inviteHash niet, is precies
    // de halve toestand die DECISIONS.md #30 voor Room.phase/Match.phase al
    // verbiedt. Claim en lookup delen bovendien exact dezelfde index
    // (DM10-beslissing 2): in Redis is `room:code:{code}` letterlijk dezelfde
    // sleutel voor de claim (SET NX) en de lookup (GET), dus mag een geslaagde
    // claim nooit onvindbaar zijn via `loadRoomByCode`. Elke test hieronder
    // leest daarom niet alleen de returnwaarde terug, maar ook de index.
    // ------------------------------------------------------------------
    describe('room-locators (INTB-2)', () => {
      it('een vrije claim slaagt en maakt de room langs beide indexen vindbaar', () => withStore(async (store) => {
        const room = makeRoom();
        await store.saveRoom(room);

        assert.deepStrictEqual(await store.claimRoomLocatorsAtomically(makeLocatorClaim()), { ok: true });

        // Claim en lookup delen dezelfde index (DM10-beslissing 2): een
        // geslaagde claim die daarna onvindbaar blijkt, is een desync die in
        // Redis niet eens kán bestaan en hier dus ook niet mag.
        assert.deepStrictEqual(await store.loadRoomByCode('AAA111'), room);
        assert.deepStrictEqual(await store.loadRoomByInviteHash(INVITE_HASH_A), room);
      }));

      it('dezelfde room die zijn eigen claim herhaalt krijgt ok, geen conflict', () => withStore(async (store) => {
        // DM10-beslissing 5: idempotent per roomId. Een retry van de creatie
        // mag niet op zijn eigen, al geslaagde claim stuklopen.
        await store.saveRoom(makeRoom());
        await store.claimRoomLocatorsAtomically(makeLocatorClaim());

        assert.deepStrictEqual(await store.claimRoomLocatorsAtomically(makeLocatorClaim()), { ok: true });
        assert.strictEqual((await store.loadRoomByCode('AAA111')).id, 'room_a');
        assert.strictEqual((await store.loadRoomByInviteHash(INVITE_HASH_A)).id, 'room_a');
      }));

      it('een claim op een al bezette code levert conflict "code" op en laat de zittende claim staan', () => withStore(async (store) => {
        await store.saveRoom(makeRoom());
        await store.claimRoomLocatorsAtomically(makeLocatorClaim());

        assert.deepStrictEqual(
          await store.claimRoomLocatorsAtomically(makeLocatorClaim({ roomId: 'room_b', code: 'AAA111', inviteHash: INVITE_HASH_B })),
          { ok: false, conflict: 'code' }
        );

        // De verliezer mag niets hebben achtergelaten, en de winnaar niets
        // hebben verloren.
        assert.strictEqual((await store.loadRoomByCode('AAA111')).id, 'room_a');
        assertIsNull(await store.loadRoomByInviteHash(INVITE_HASH_B), 'de invite-hash van de verliezende claim');
      }));

      it('conflicteren code én invite-hash allebei, dan wint de code in de returnwaarde', () => withStore(async (store) => {
        // DM10 stap 2: "code eerst als beide conflicteren". Een vaste volgorde,
        // zodat twee adapters niet elk een andere helft van de waarheid melden
        // en de aanroeper zijn retry-lus op één signaal kan bouwen.
        await store.saveRoom(makeRoom());
        await store.claimRoomLocatorsAtomically(makeLocatorClaim());

        assert.deepStrictEqual(
          await store.claimRoomLocatorsAtomically(makeLocatorClaim({ roomId: 'room_b' })),
          { ok: false, conflict: 'code' }
        );
      }));

      it('een claim op een al bezette invite-hash levert conflict "inviteHash" op', () => withStore(async (store) => {
        await store.saveRoom(makeRoom());
        await store.claimRoomLocatorsAtomically(makeLocatorClaim());

        assert.deepStrictEqual(
          await store.claimRoomLocatorsAtomically(makeLocatorClaim({ roomId: 'room_b', code: 'BBB222', inviteHash: INVITE_HASH_A })),
          { ok: false, conflict: 'inviteHash' }
        );

        assert.strictEqual((await store.loadRoomByInviteHash(INVITE_HASH_A)).id, 'room_a');
      }));

      it('een gedeeltelijk conflict laat geen half geclaimde toestand achter', () => withStore(async (store) => {
        // Het scherpste faalpad van de drie: de code is VRIJ en de invite-hash
        // bezet. Een implementatie die de code alvast wegschrijft en pas daarna
        // de invite-hash controleert, geeft keurig `conflict: 'inviteHash'`
        // terug en heeft ondertussen een code gelekt die niemand meer kan
        // claimen — onzichtbaar in de returnwaarde, dodelijk voor de
        // coderuimte. Vandaar de derde room hieronder: alleen een geslaagde
        // herclaim van diezelfde code bewijst dat de vrije helft ook echt vrij
        // is gebleven.
        await store.saveRoom(makeRoom());
        await store.claimRoomLocatorsAtomically(makeLocatorClaim());

        assert.deepStrictEqual(
          await store.claimRoomLocatorsAtomically(makeLocatorClaim({ roomId: 'room_b', code: 'BBB222', inviteHash: INVITE_HASH_A })),
          { ok: false, conflict: 'inviteHash' }
        );

        const roomC = makeRoom({ id: 'room_c', code: 'BBB222', inviteId: 'invite_c', hostSessionIds: ['session_host_c'] });
        assert.deepStrictEqual(
          await store.claimRoomLocatorsAtomically(makeLocatorClaim({ roomId: 'room_c', code: 'BBB222', inviteHash: 'invitehash_c' })),
          { ok: true },
          'de vrije helft van een gedeeltelijk conflict mag niet stilzwijgend geclaimd zijn achtergebleven'
        );
        await store.saveRoom(roomC);
        assert.deepStrictEqual(await store.loadRoomByCode('BBB222'), roomC);
      }));

      it('gelijktijdige claims op dezelfde code leveren precies één winnaar op', () => withStore(async (store) => {
        // HET acceptatiecriterium van INTB-2: "bij N tegelijk aangeboden claims
        // op dezelfde code is er exact één winnaar. Dat is het enige dat
        // bewijst dat de race echt dicht is."
        //
        // Tegen de fake bewijst deze test WEINIG: die is single-threaded en
        // voert elke claim volledig synchroon uit, dus de aanroepen kunnen
        // elkaar er niet eens kruisen. Tegen een Redis-adapter bewijst hij
        // ALLES: daar zit een netwerkbeurt tussen de controle en de schrijf, en
        // precies daar ontstaan twee rooms met dezelfde join-code. Hij staat
        // hier omdat de suite tegen BEIDE gericht moet kunnen worden — wie hem
        // straks op de adapter richt, hoeft hem niet alsnog te bedenken.
        //
        // Elke deelnemer krijgt een EIGEN invite-hash: alleen de code is
        // omstreden, zodat een verliezer niet per ongeluk op de invite-hash
        // struikelt en het resultaat over de code niets zou zeggen.
        const deelnemers = ['room_1', 'room_2', 'room_3', 'room_4', 'room_5', 'room_6', 'room_7', 'room_8'];

        const uitkomsten = await Promise.all(deelnemers.map((roomId, index) => store.claimRoomLocatorsAtomically(
          makeLocatorClaim({ roomId, code: 'AAA111', inviteHash: `invitehash_${index + 1}` })
        )));

        const winnaars = uitkomsten.filter((uitkomst) => uitkomst.ok === true);
        assert.strictEqual(
          winnaars.length,
          1,
          `precies één van de ${deelnemers.length} gelijktijdige claims mag slagen, kreeg: ${JSON.stringify(uitkomsten)}`
        );
        for (const uitkomst of uitkomsten.filter((u) => u.ok === false)) {
          assert.deepStrictEqual(uitkomst, { ok: false, conflict: 'code' }, 'elke verliezer struikelt op de code, niet op zijn eigen invite-hash');
        }

        // En de INDEX moet diezelfde winnaar dragen: één winnaar in de
        // returnwaarden terwijl er twee in de index hebben geschreven, is
        // hetzelfde dubbelboekingsgevaar, alleen stiller. Meten gebeurt via de
        // idempotente herclaim — alleen de zittende eigenaar krijgt `ok`. Via
        // `saveRoom` zou het sowieso niet kunnen: die raakt de index niet aan
        // (INTB-11).
        const winnaarIndex = uitkomsten.findIndex((uitkomst) => uitkomst.ok === true);
        const verliezerIndex = winnaarIndex === 0 ? 1 : 0;
        assert.deepStrictEqual(
          await store.claimRoomLocatorsAtomically(makeLocatorClaim({ roomId: deelnemers[winnaarIndex], code: 'AAA111', inviteHash: `invitehash_${winnaarIndex + 1}` })),
          { ok: true },
          'de winnaar hoort zijn eigen claim te bezitten — een herclaim door de eigenaar is idempotent'
        );
        assert.deepStrictEqual(
          await store.claimRoomLocatorsAtomically(makeLocatorClaim({ roomId: deelnemers[verliezerIndex], code: 'AAA111', inviteHash: `invitehash_${verliezerIndex + 1}` })),
          { ok: false, conflict: 'code' },
          'een verliezer mag ook achteraf niet blijken de code te bezitten'
        );
      }));

      it('na releaseRoomLocators is de code weer claimbaar en vindt loadRoomByCode niets meer', () => withStore(async (store) => {
        const roomA = makeRoom();
        await store.saveRoom(roomA);
        await store.claimRoomLocatorsAtomically(makeLocatorClaim());

        await store.releaseRoomLocators(toLocatorPair(makeLocatorClaim()));

        assertIsNull(await store.loadRoomByCode('AAA111'), 'de vrijgegeven join-code');
        assertIsNull(await store.loadRoomByInviteHash(INVITE_HASH_A), 'de vrijgegeven invite-hash');
        // Het roomdocument zelf blijft bestaan: een release ruimt de locators
        // op, geen room.
        assert.deepStrictEqual(await store.loadRoom('room_a'), roomA);

        const roomB = makeRoom({ id: 'room_b', code: 'AAA111', inviteId: 'invite_b', hostSessionIds: ['session_host_b'] });
        assert.deepStrictEqual(
          await store.claimRoomLocatorsAtomically(makeLocatorClaim({ roomId: 'room_b', code: 'AAA111', inviteHash: INVITE_HASH_B })),
          { ok: true },
          'een vrijgegeven code hoort weer beschikbaar te zijn — anders lekt de coderuimte bij elke mislukte creatie vol'
        );
        await store.saveRoom(roomB);
        assert.deepStrictEqual(await store.loadRoomByCode('AAA111'), roomB);
      }));

      it('INTB-5: een geroteerde uitnodiging is na vrijgave niet meer geldig', () => withStore(async (store) => {
        // WAS EEN KARAKTERISATIETEST, NU CONTRACT — en omgekeerd, niet
        // afgezwakt. Vastgelegd stond: na een hercodering bleven de OUDE
        // join-code en het OUDE invite-id naar diezelfde room wijzen, en
        // leverden zelfs het nieuwe document op. Voor de invite is dat een
        // securitygevolg, geen hygiëne: ARCHITECTURE.md §inviteId eist dat een
        // invite "direct intrekbaar of roteerbaar" is, terwijl roteren toen een
        // TWEEDE geldige capability toevoegde in plaats van de eerste te
        // vervangen.
        //
        // INTB-5 bood twee routes: `saveRoom` de vorige indexen laten opruimen,
        // óf het koppelen aan de lifecycle uit INTB-2. DM10 koos de tweede. Het
        // gevolg is dat ROTEREN EEN RELEASE IS: `saveRoom` alleen ruimt niets
        // op (en kan dat voor de invite-hash niet eens — Room draagt geen
        // hash). Deze test legt die route vast: claim → release → herclaim, en
        // daarna vindt de oude locator niets meer.
        await store.saveRoom(makeRoom({ code: 'AAA111' }));
        await store.claimRoomLocatorsAtomically(makeLocatorClaim({ code: 'AAA111', inviteHash: INVITE_HASH_A }));

        // Roteren: eerst de oude locators intrekken, dan het nieuwe paar claimen.
        await store.releaseRoomLocators(toLocatorPair(makeLocatorClaim({ code: 'AAA111', inviteHash: INVITE_HASH_A })));
        assert.deepStrictEqual(
          await store.claimRoomLocatorsAtomically(makeLocatorClaim({ code: 'CCC333', inviteHash: 'invitehash_a2' })),
          { ok: true }
        );
        await store.saveRoom(makeRoom({ code: 'CCC333', inviteId: 'invite_a2' }));

        // De nieuwe uitnodiging werkt.
        assert.strictEqual((await store.loadRoomByCode('CCC333')).id, 'room_a');
        assert.strictEqual((await store.loadRoomByInviteHash('invitehash_a2')).inviteId, 'invite_a2');

        // De oude is dood — geen tweede geldige capability naast de nieuwe.
        assertIsNull(await store.loadRoomByCode('AAA111'), 'de ingetrokken join-code');
        assertIsNull(await store.loadRoomByInviteHash(INVITE_HASH_A), 'de ingetrokken invite-hash — een geroteerde uitnodiging hoort niet geldig te blijven (INTB-5)');
      }));

      it('een release door een ander roomId dan de claimer geeft de claim niet vrij', () => withStore(async (store) => {
        // De release neemt het roomId mee zodat een room nooit de claim van een
        // ander kan intrekken (INTB-2). Zonder die controle is elke join-code
        // van elke lopende room door iedere andere room op te blazen.
        const roomA = makeRoom();
        await store.saveRoom(roomA);
        await store.claimRoomLocatorsAtomically(makeLocatorClaim());

        await store.releaseRoomLocators({ roomId: 'room_indringer', code: 'AAA111', inviteHash: INVITE_HASH_A });

        assert.deepStrictEqual(await store.loadRoomByCode('AAA111'), roomA, 'de vreemde release mag de code-index niet hebben geleegd');
        assert.deepStrictEqual(await store.loadRoomByInviteHash(INVITE_HASH_A), roomA, 'de vreemde release mag de invite-index niet hebben geleegd');
        assert.deepStrictEqual(
          await store.claimRoomLocatorsAtomically(makeLocatorClaim({ roomId: 'room_indringer', inviteHash: INVITE_HASH_B })),
          { ok: false, conflict: 'code' },
          'de claim staat nog: een vreemde release mag geen achterdeur naar andermans code zijn'
        );
      }));

      it('een release die maar één van beide locators bezit ruimt niets op', () => withStore(async (store) => {
        // Alles-of-niets (DM10-beslissing 7): bij gedeeltelijk bezit doet de
        // release niets, in plaats van stilzwijgend de helft op te ruimen. In
        // het echte systeem loopt de blijvende locator gewoon op zijn eigen TTL
        // af; een halve opruiming zou een room bereikbaar laten via de ene
        // ingang en niet via de andere.
        const roomA = makeRoom();
        await store.saveRoom(roomA);
        await store.claimRoomLocatorsAtomically(makeLocatorClaim());

        await store.releaseRoomLocators({ roomId: 'room_a', code: 'AAA111', inviteHash: 'invitehash_nooit_geclaimd' });

        assert.deepStrictEqual(await store.loadRoomByCode('AAA111'), roomA);
        assert.deepStrictEqual(await store.loadRoomByInviteHash(INVITE_HASH_A), roomA);
      }));

      it('refreshRoomLocators verlengt de claim zonder hem vrij te geven', () => withStore(async (store) => {
        // DM10-beslissing 8: zonder refreshpad kan een actieve room bereikbaar
        // blijven via room:{roomId} terwijl zijn code-claim al is verlopen en
        // door een ander is overgenomen. De fake telt geen TTL af, dus hier is
        // alleen het CONTRACT te bewijzen: na een refresh is er niets
        // veranderd — de room blijft langs beide ingangen vindbaar en de code
        // blijft bezet.
        const roomA = makeRoom();
        await store.saveRoom(roomA);
        await store.claimRoomLocatorsAtomically(makeLocatorClaim());

        await store.refreshRoomLocators(makeLocatorClaim({ ttlSeconds: 7200 }));

        assert.deepStrictEqual(await store.loadRoomByCode('AAA111'), roomA);
        assert.deepStrictEqual(await store.loadRoomByInviteHash(INVITE_HASH_A), roomA);
        assert.deepStrictEqual(
          await store.claimRoomLocatorsAtomically(makeLocatorClaim({ roomId: 'room_b', inviteHash: INVITE_HASH_B })),
          { ok: false, conflict: 'code' },
          'een refresh hoort de claim te verlengen, niet te ontgrendelen'
        );
      }));

      it('refreshRoomLocators op een claim die je niet bezit werpt RangeError', () => withStore(async (store) => {
        // Luid falen, niet stil slagen (DM10-beslissing 8): een refresh op een
        // claim die je niet meer hebt, betekent dat de claim al gestolen of
        // verlopen is — precies het moment waarop de aanroeper moet ingrijpen.
        await store.saveRoom(makeRoom());
        await store.claimRoomLocatorsAtomically(makeLocatorClaim());

        await assert.rejects(
          () => store.refreshRoomLocators(makeLocatorClaim({ roomId: 'room_indringer' })),
          RangeError,
          'een refresh op andermans claim hoort RangeError te geven'
        );
        await assert.rejects(
          () => store.refreshRoomLocators(makeLocatorClaim({ code: 'ZZZ999' })),
          RangeError,
          'een refresh op een nooit geclaimde code hoort RangeError te geven'
        );

        // En geen van beide mislukte refreshes mag de zittende claim hebben geraakt.
        assert.strictEqual((await store.loadRoomByCode('AAA111')).id, 'room_a');
        assert.strictEqual((await store.loadRoomByInviteHash(INVITE_HASH_A)).id, 'room_a');
      }));
    });

    // ------------------------------------------------------------------
    // Session: loadSession, saveSession, loadSessionByTokenHash
    //
    // `loadSessionByTokenHash` (DM14/§10) bestaat omdat een socket-handshake
    // alleen een `sessionToken` meestuurt: op dat moment kent de server de room
    // nog niet, en het opzoeken van de sessie ÍS de manier waarop hij hem leert
    // kennen. Vandaar de HASH als ingang en geen `roomId`-parameter.
    //
    // Twee eisen die de fake en de adapter allebei moeten waarmaken, en die de
    // suite hier vastlegt (BESLUIT-INTB-locators-en-sessieindex.md, deel B):
    //   * ROTATIE TREKT IN. Een sessie die een nieuwe `tokenHash` krijgt, laat
    //     de oude ophouden te werken — anders staan er twee geldige
    //     capabilities naast elkaar. Dat is dezelfde klasse fout als INTB-5
    //     (geroteerde uitnodiging bleef geldig) en INTB-9 (index trok de vorige
    //     claim niet in), nu voor sessietokens.
    //   * DE LOOKUP LEVERT DE SESSIE ZELF, niet een kopie die kan verouderen:
    //     wie via het token binnenkomt, hoort exact hetzelfde document te zien
    //     als wie via `loadSession` binnenkomt.
    // ------------------------------------------------------------------
    describe('Session', () => {
      it('een opgeslagen sessie komt veld voor veld ongewijzigd terug', () => withStore(async (store) => {
        const session = makeSession();
        await store.saveSession(session);
        assert.deepStrictEqual(await store.loadSession('room_a', 'session_1'), session);
      }));

      it('een sessie die nooit is opgeslagen levert null op', () => withStore(async (store) => {
        await store.saveSession(makeSession());
        assertIsNull(await store.loadSession('room_a', 'session_bestaat_niet'), 'loadSession van een onbekend sessie-id');
      }));

      it('een bestaande sessie is onvindbaar vanuit een andere room', () => withStore(async (store) => {
        await store.saveSession(makeSession());
        assertIsNull(await store.loadSession('room_b', 'session_1'), 'loadSession met het verkeerde roomId');
      }));

      it('twee rooms mogen hetzelfde sessie-id dragen zonder elkaars document te overschrijven', () => withStore(async (store) => {
        const inA = makeSession({ roomId: 'room_a', tokenHash: 'hash_a', roles: ['host'] });
        const inB = makeSession({ roomId: 'room_b', tokenHash: 'hash_b', roles: ['player'], playerId: 'player_b' });
        await store.saveSession(inA);
        await store.saveSession(inB);

        assert.deepStrictEqual(await store.loadSession('room_a', 'session_1'), inA);
        assert.deepStrictEqual(await store.loadSession('room_b', 'session_1'), inB);
      }));

      it('het aanpassen van het weggeschreven of het teruggelezen sessiedocument raakt de opslag niet', () => withStore(async (store) => {
        const session = makeSession();
        await store.saveSession(session);

        session.revoked = true;
        session.connectedSocketIds.push('socket_indringer');

        const loaded = await store.loadSession('room_a', 'session_1');
        assert.strictEqual(loaded.revoked, false);
        assert.deepStrictEqual(loaded.connectedSocketIds, ['socket_1']);

        loaded.revoked = true;
        loaded.connectedSocketIds.push('socket_indringer');
        assert.deepStrictEqual(await store.loadSession('room_a', 'session_1'), makeSession());
      }));

      it('een sessie is op zijn tokenhash vindbaar zonder dat de aanroeper de room kent', () => withStore(async (store) => {
        const session = makeSession();
        await store.saveSession(session);

        assert.deepStrictEqual(await store.loadSessionByTokenHash('hash_session_1'), session);
      }));

      it('een onbekende tokenhash levert null op, geen fout', () => withStore(async (store) => {
        await store.saveSession(makeSession());
        assertIsNull(await store.loadSessionByTokenHash('hash_bestaat_niet'), 'loadSessionByTokenHash van een onbekende hash');
      }));

      it('de lookup vindt de sessie in de JUISTE room, ook als twee rooms hetzelfde sessie-id dragen', () => withStore(async (store) => {
        const inA = makeSession({ roomId: 'room_a', tokenHash: 'hash_a', roles: ['host'] });
        const inB = makeSession({ roomId: 'room_b', tokenHash: 'hash_b', roles: ['player'], playerId: 'player_b' });
        await store.saveSession(inA);
        await store.saveSession(inB);

        assert.deepStrictEqual(await store.loadSessionByTokenHash('hash_a'), inA);
        assert.deepStrictEqual(await store.loadSessionByTokenHash('hash_b'), inB);
      }));

      it('de lookup levert de HUIDIGE sessie op, niet een kopie van het moment van opslaan', () => withStore(async (store) => {
        // De index hoort een verwijzing te zijn, geen tweede plek waar de sessie
        // staat. Slaat een implementatie het document ín de index op, dan leest
        // wie via het token binnenkomt een verouderde `revoked`-vlag — precies
        // het veld waarop een intrekking rust.
        await store.saveSession(makeSession({ revoked: false }));
        await store.saveSession(makeSession({ revoked: true }));

        const viaToken = await store.loadSessionByTokenHash('hash_session_1');
        assert.strictEqual(viaToken.revoked, true);
        assert.deepStrictEqual(viaToken, await store.loadSession('room_a', 'session_1'));
      }));

      it('een INGETROKKEN sessie blijft op zijn tokenhash vindbaar — "onbekend" en "herroepen" zijn niet hetzelfde', () => withStore(async (store) => {
        // De index wordt bij `revoked: true` NIET geleegd (DM14/§10): de
        // aanroeper moet een herroepen token kunnen onderscheiden van een token
        // dat nooit heeft bestaan, anders is elke intrekking van buitenaf niet
        // te onderscheiden van een typefout.
        await store.saveSession(makeSession({ revoked: true }));

        const found = await store.loadSessionByTokenHash('hash_session_1');
        assert.notStrictEqual(found, null, 'een herroepen sessie hoort vindbaar te blijven');
        assert.strictEqual(found.revoked, true);
      }));

      it('een nieuwe tokenhash trekt de OUDE in — geen tweede geldige capability naast de nieuwe', () => withStore(async (store) => {
        // Dit is INTB-5 nog een keer, nu voor sessietokens
        // (BESLUIT-INTB-locators-en-sessieindex.md deel B, §Rotatie). Het
        // vervangen van een tokenhash MOET de vorige index in dezelfde stap
        // vrijgeven; blijft de oude werken, dan heeft een uitgegeven-en-
        // ingetrokken token nog steeds toegang tot de room.
        await store.saveSession(makeSession({ tokenHash: 'hash_oud' }));
        assert.notStrictEqual(await store.loadSessionByTokenHash('hash_oud'), null, 'de fixture moet echt geland zijn');

        await store.saveSession(makeSession({ tokenHash: 'hash_nieuw' }));

        assertIsNull(await store.loadSessionByTokenHash('hash_oud'), 'de vervangen tokenhash — een ingetrokken token hoort niet geldig te blijven');
        assert.deepStrictEqual(
          await store.loadSessionByTokenHash('hash_nieuw'),
          makeSession({ tokenHash: 'hash_nieuw' })
        );
        // En de sessie zelf is niet verdwenen met zijn oude index mee.
        assert.deepStrictEqual(await store.loadSession('room_a', 'session_1'), makeSession({ tokenHash: 'hash_nieuw' }));
      }));

      it('een rotatie raakt de tokenhash van een ANDERE sessie niet', () => withStore(async (store) => {
        // De opruiming mag precies één index treffen: die van de sessie die
        // roteert. Een implementatie die "alle indexen van deze room" opruimt en
        // opnieuw opbouwt, gooit hier de zittende medespeler eruit.
        await store.saveSession(makeSession({ id: 'session_1', tokenHash: 'hash_1' }));
        await store.saveSession(makeSession({ id: 'session_2', tokenHash: 'hash_2', roles: ['player'], playerId: 'player_2' }));

        await store.saveSession(makeSession({ id: 'session_1', tokenHash: 'hash_1b' }));

        assertIsNull(await store.loadSessionByTokenHash('hash_1'), 'de geroteerde tokenhash');
        assert.strictEqual((await store.loadSessionByTokenHash('hash_1b')).id, 'session_1');
        assert.strictEqual((await store.loadSessionByTokenHash('hash_2')).id, 'session_2', 'de andere sessie hoort ongemoeid te blijven');
      }));

      it('dezelfde sessie opnieuw opslaan met DEZELFDE tokenhash laat de lookup werken', () => withStore(async (store) => {
        // Het spiegelbeeld van de rotatietest: een implementatie die bij elke
        // save eerst de vorige index wist en daarna de nieuwe zet, opent een
        // venster waarin een ongewijzigd, geldig token nergens naartoe wijst.
        await store.saveSession(makeSession({ lastSeenAt: T_ACTIVITY }));
        await store.saveSession(makeSession({ lastSeenAt: T_ROUND_STARTS }));

        assert.deepStrictEqual(
          await store.loadSessionByTokenHash('hash_session_1'),
          makeSession({ lastSeenAt: T_ROUND_STARTS })
        );
      }));

      it('het aanpassen van de via de tokenhash teruggelezen sessie raakt de opslag niet', () => withStore(async (store) => {
        await store.saveSession(makeSession());

        const loaded = await store.loadSessionByTokenHash('hash_session_1');
        loaded.revoked = true;
        loaded.connectedSocketIds.push('socket_indringer');

        assert.deepStrictEqual(await store.loadSessionByTokenHash('hash_session_1'), makeSession());
      }));
    });

    // ------------------------------------------------------------------
    // Player: loadPlayer, savePlayer, listPlayers
    // ------------------------------------------------------------------
    describe('Player', () => {
      it('een opgeslagen speler komt veld voor veld ongewijzigd terug', () => withStore(async (store) => {
        const player = makePlayer();
        await store.savePlayer(player);
        assert.deepStrictEqual(await store.loadPlayer('room_a', 'player_1'), player);
      }));

      it('een speler die nooit is opgeslagen levert null op', () => withStore(async (store) => {
        await store.savePlayer(makePlayer());
        assertIsNull(await store.loadPlayer('room_a', 'player_bestaat_niet'), 'loadPlayer van een onbekend speler-id');
      }));

      it('een room zonder spelers levert een lege lijst op, geen null en geen fout', () => withStore(async (store) => {
        const listed = await store.listPlayers('room_zonder_spelers');
        assert.ok(Array.isArray(listed), 'listPlayers hoort altijd een array op te leveren');
        assert.deepStrictEqual(listed, []);
      }));

      it('alle spelers van een room komen in de lijst terug', () => withStore(async (store) => {
        // Volgorde is NIET gegarandeerd door de poort: een adapter die op een
        // Redis-hash leunt (HGETALL) heeft geen volgordegarantie, en de fake
        // levert weliswaar invoegvolgorde maar belooft dat nergens. Daarom
        // sorteert deze assertie zelf op id.
        const p1 = makePlayer({ id: 'player_1', sessionId: 'session_1' });
        const p2 = makePlayer({ id: 'player_2', sessionId: 'session_2', generatedName: 'Rode Das', effectiveName: 'Rode Das' });
        const p3 = makePlayer({ id: 'player_3', sessionId: 'session_3', generatedName: 'Groene Uil', effectiveName: 'Groene Uil' });
        await store.savePlayer(p2);
        await store.savePlayer(p3);
        await store.savePlayer(p1);

        assert.deepStrictEqual(byId(await store.listPlayers('room_a')), [p1, p2, p3]);
      }));

      it('een speler tweemaal opslaan levert één bijgewerkt record op, geen dubbele vermelding', () => withStore(async (store) => {
        await store.savePlayer(makePlayer({ score: 0 }));
        await store.savePlayer(makePlayer({ score: 240, correctCount: 2 }));

        const listed = await store.listPlayers('room_a');
        assert.strictEqual(listed.length, 1);
        assert.strictEqual(listed[0].score, 240);
        assert.strictEqual((await store.loadPlayer('room_a', 'player_1')).score, 240);
      }));

      it('spelers van twee rooms komen alleen in hun eigen lijst voor, ook bij een gelijk speler-id', () => withStore(async (store) => {
        const inA = makePlayer({ roomId: 'room_a', generatedName: 'Blauwe Vos', effectiveName: 'Blauwe Vos' });
        const inB = makePlayer({ roomId: 'room_b', generatedName: 'Gele Kat', effectiveName: 'Gele Kat' });
        await store.savePlayer(inA);
        await store.savePlayer(inB);

        assert.deepStrictEqual(await store.listPlayers('room_a'), [inA]);
        assert.deepStrictEqual(await store.listPlayers('room_b'), [inB]);
        assert.deepStrictEqual(await store.loadPlayer('room_a', 'player_1'), inA);
        assert.deepStrictEqual(await store.loadPlayer('room_b', 'player_1'), inB);
      }));

      it('het aanpassen van het weggeschreven of het teruggelezen spelerdocument raakt de opslag niet', () => withStore(async (store) => {
        const player = makePlayer();
        await store.savePlayer(player);

        player.score = 9999;
        assert.strictEqual((await store.loadPlayer('room_a', 'player_1')).score, 0);

        const loaded = await store.loadPlayer('room_a', 'player_1');
        loaded.score = 9999;
        assert.strictEqual((await store.loadPlayer('room_a', 'player_1')).score, 0);
      }));

      it('het aanpassen van een element uit de spelerslijst raakt de opslag niet', () => withStore(async (store) => {
        await store.savePlayer(makePlayer());

        const listed = await store.listPlayers('room_a');
        listed[0].score = 9999;
        listed.push(makePlayer({ id: 'player_spook', sessionId: 'session_spook' }));

        assert.deepStrictEqual(await store.listPlayers('room_a'), [makePlayer()]);
      }));
    });

    // ------------------------------------------------------------------
    // Match: loadMatch, saveMatch
    // ------------------------------------------------------------------
    describe('Match', () => {
      it('een opgeslagen match komt veld voor veld ongewijzigd terug, inclusief contentVersion en rendererVersion', () => withStore(async (store) => {
        const match = makeMatch();
        await store.saveMatch(match);

        const loaded = await store.loadMatch('room_a', 'match_1');
        assert.deepStrictEqual(loaded, match);
        // DECISIONS #21: canoniek en onveranderlijk op Match — de opslag mag ze
        // niet stilzwijgend laten vallen.
        assert.strictEqual(loaded.contentVersion, '2026.08.1');
        assert.strictEqual(loaded.rendererVersion, 'flag-renderer-1');
      }));

      it('een teruggelezen match draagt geen countdownEndsAt', () => withStore(async (store) => {
        // DECISIONS #16: countdownEndsAt is vluchtig en wordt bij de transitie
        // berekend, niet opgeslagen. Vandaag kent geen enkel documenttype in
        // server/data/types/ dit veld; deze test houdt dat zo.
        await store.saveMatch(makeMatch());
        const loaded = await store.loadMatch('room_a', 'match_1');
        assert.ok(
          !Object.prototype.hasOwnProperty.call(loaded, 'countdownEndsAt'),
          'een persistente Match hoort geen countdownEndsAt te dragen (DECISIONS #16)'
        );
      }));

      it('een match die nooit is opgeslagen levert null op', () => withStore(async (store) => {
        await store.saveMatch(makeMatch());
        assertIsNull(await store.loadMatch('room_a', 'match_bestaat_niet'), 'loadMatch van een onbekend match-id');
      }));

      it('een bestaande match is onvindbaar vanuit een andere room', () => withStore(async (store) => {
        await store.saveMatch(makeMatch());
        assertIsNull(await store.loadMatch('room_b', 'match_1'), 'loadMatch met het verkeerde roomId');
      }));

      it('twee rooms mogen hetzelfde match-id dragen zonder elkaars document te overschrijven', () => withStore(async (store) => {
        const inA = makeMatch({ roomId: 'room_a', sequence: 1, roundIndex: 0 });
        const inB = makeMatch({ roomId: 'room_b', sequence: 3, roundIndex: 4, contentVersion: '2026.09.2' });
        await store.saveMatch(inA);
        await store.saveMatch(inB);

        assert.deepStrictEqual(await store.loadMatch('room_a', 'match_1'), inA);
        assert.deepStrictEqual(await store.loadMatch('room_b', 'match_1'), inB);
      }));

      it('opnieuw opslaan onder hetzelfde id vervangt het match-document', () => withStore(async (store) => {
        await store.saveMatch(makeMatch({ roundIndex: 0, phase: 'ROUND_ACTIVE' }));
        await store.saveMatch(makeMatch({ roundIndex: 1, phase: 'SCOREBOARD' }));

        const loaded = await store.loadMatch('room_a', 'match_1');
        assert.strictEqual(loaded.roundIndex, 1);
        assert.strictEqual(loaded.phase, 'SCOREBOARD');
      }));

      it('het aanpassen van het weggeschreven of het teruggelezen matchdocument raakt de opslag niet, tot in de geneste arrays', () => withStore(async (store) => {
        const match = makeMatch();
        await store.saveMatch(match);

        match.roundIds.push('round_indringer');
        match.usedQuestionKeys.push('capitals_mc:be');
        match.phase = 'FINISHED';

        const loaded = await store.loadMatch('room_a', 'match_1');
        assert.deepStrictEqual(loaded.roundIds, ['round_1']);
        assert.deepStrictEqual(loaded.usedQuestionKeys, ['flags_mc:nl']);
        assert.strictEqual(loaded.phase, 'ROUND_ACTIVE');

        loaded.roundIds.push('round_indringer');
        loaded.phase = 'FINISHED';
        assert.deepStrictEqual(await store.loadMatch('room_a', 'match_1'), makeMatch());
      }));
    });

    // ------------------------------------------------------------------
    // Round: loadRound
    //
    // Alleen de LEESKANT hoort hier. `saveRound` wordt uitsluitend als
    // arrangement gebruikt: geen enkele assertie hieronder legt zijn gedrag
    // vast. De arrangement-regels dragen sinds DM11 het `roomId` mee
    // (`saveRound(roomId, round)`) — dat was INTB-1; zoals voorspeld veranderde
    // alleen de arrangement-regel en geen enkele verwachting. Het contract van
    // `saveRound` zelf staat in het INTB-1-blok onderaan.
    // ------------------------------------------------------------------
    describe('Round (leeskant)', () => {
      it('een opgeslagen ronde komt veld voor veld ongewijzigd terug op room, match en ronde-id', () => withStore(async (store) => {
        const round = makeRound();
        await store.saveMatch(makeMatch());
        await store.saveRound('room_a', round); // arrangement, geen contract

        assert.deepStrictEqual(await store.loadRound('room_a', 'match_1', 'round_1'), round);
      }));

      it('een teruggelezen ronde draagt geen countdownEndsAt', () => withStore(async (store) => {
        // DECISIONS #16, zie de gelijknamige Match-test.
        await store.saveMatch(makeMatch());
        await store.saveRound('room_a', makeRound());
        const loaded = await store.loadRound('room_a', 'match_1', 'round_1');
        assert.ok(
          !Object.prototype.hasOwnProperty.call(loaded, 'countdownEndsAt'),
          'een persistente Round hoort geen countdownEndsAt te dragen (DECISIONS #16)'
        );
      }));

      it('een ronde die nooit is opgeslagen levert null op', () => withStore(async (store) => {
        await store.saveMatch(makeMatch());
        await store.saveRound('room_a', makeRound());
        assertIsNull(await store.loadRound('room_a', 'match_1', 'round_bestaat_niet'), 'loadRound van een onbekend ronde-id');
      }));

      it('een bestaande ronde is onvindbaar onder de verkeerde match of de verkeerde room', () => withStore(async (store) => {
        await store.saveMatch(makeMatch());
        await store.saveRound('room_a', makeRound());

        assertIsNull(await store.loadRound('room_a', 'match_ander', 'round_1'), 'loadRound met het verkeerde matchId');
        assertIsNull(await store.loadRound('room_b', 'match_1', 'round_1'), 'loadRound met het verkeerde roomId');
      }));

      it('twee rooms met een gelijk ronde-id in hun eigen match houden gescheiden documenten', () => withStore(async (store) => {
        // Bewust twee VERSCHILLENDE match-ids: het geval "zelfde matchId in twee
        // rooms" is niet betrouwbaar te arrangeren zolang saveRound zijn roomId
        // moet raden (INTB-1). Dat geval staat in het overgeslagen blok.
        const matchA = makeMatch({ id: 'match_a', roomId: 'room_a' });
        const matchB = makeMatch({ id: 'match_b', roomId: 'room_b' });
        const roundA = makeRound({ id: 'round_1', matchId: 'match_a', questionKey: 'flags_mc:nl' });
        const roundB = makeRound({ id: 'round_1', matchId: 'match_b', questionKey: 'capitals_mc:be', gameType: 'capitals_mc' });

        await store.saveMatch(matchA);
        await store.saveMatch(matchB);
        await store.saveRound('room_a', roundA);
        await store.saveRound('room_b', roundB);

        assert.deepStrictEqual(await store.loadRound('room_a', 'match_a', 'round_1'), roundA);
        assert.deepStrictEqual(await store.loadRound('room_b', 'match_b', 'round_1'), roundB);
      }));

      it('het aanpassen van een teruggelezen ronde raakt de opslag niet, tot in het geneste antwoord en de payload', () => withStore(async (store) => {
        await store.saveMatch(makeMatch());
        await store.saveRound('room_a', makeRound());

        const loaded = await store.loadRound('room_a', 'match_1', 'round_1');
        loaded.status = 'ENDED';
        loaded.correctAnswer.optionId = 'be';
        loaded.publicQuestionPayload.optionIso2s.push('es');
        loaded.validOptionIds.push('es');

        assert.deepStrictEqual(await store.loadRound('room_a', 'match_1', 'round_1'), makeRound());
      }));
    });

    // ------------------------------------------------------------------
    // setRoomAndMatchPhaseAtomically (DM19)
    //
    // DECISIONS #30: `Match.phase` is autoritair, `Room.phase` is een afgeleide
    // projectie die in DEZELFDE atomaire operatie wordt bijgewerkt. Geen
    // implementatie mag hier een niet-atomair dual-write-pad introduceren.
    // Daarom test dit blok niet alleen "beide staan achteraf goed", maar ook
    // dat elk faalpad BEIDE documenten ongemoeid laat: een adapter die eerst
    // de room schrijft en dan pas de match valideert, valt daar door de mand.
    //
    // DE SIGNATUUR IS SINDS DM19 (reactie op INT-16):
    //   (roomId, matchId, { expectedPhase, newPhase, pausedState })
    //     -> { ok: true } | { ok: false, actualPhase }
    // met drie eisen die hieronder elk hun eigen test hebben:
    //
    //   * DUBBELE COMPARE-AND-SET. `Room.phase` én `Match.phase` moeten op het
    //     moment van aanroepen `expectedPhase` dragen. Een mismatch aan één van
    //     beide kanten is een NORMALE uitkomst — een resultaatobject, geen
    //     exception, net als bij de locatorclaim — en `actualPhase` is altijd
    //     `Match.phase`, ook als de room de mismatch veroorzaakte.
    //   * `pausedState` in DEZELFDE stap. Vóór DM19 was dat een losse
    //     `saveMatch` van de aanroeper, dus precies het dual-write-pad dat #30
    //     elders verbiedt.
    //   * DE `pausedState`/`PAUSED`-INVARIANT IN BEIDE RICHTINGEN, als throw.
    //     Twee tests, niet één: een implementatie die alleen "PAUSED vereist
    //     een pausedState" afdwingt, laat een `pausedState` achter op een match
    //     die allang weer speelt — en dan hervat een tweede pauzeknop op een
    //     bevroren restant uit een vorige pauze. Dat is een contractschending
    //     van de AANROEPER (nooit geldig, ongeacht de store-toestand), dus een
    //     `RangeError` en geen `{ ok: false }`.
    // ------------------------------------------------------------------
    describe('setRoomAndMatchPhaseAtomically', () => {
      /**
       * Room en Match op DEZELFDE beginfase: dat is de enige toestand waarin een
       * geslaagde overgang mogelijk is (de dubbele compare-and-set eist het), en
       * meteen de toestand waarin de invariant "de twee lopen niet uit de pas"
       * al vóór de operatie klopte — anders zou een falende assertie de fixture
       * aanwijzen in plaats van de operatie.
       */
      async function arrangeInPhase(store, phase, overrides = {}) {
        await store.saveRoom(makeRoom({ phase }));
        await store.saveMatch(makeMatch({ phase, ...overrides }));
      }

      it('Room.phase en Match.phase dragen na afloop dezelfde nieuwe waarde (DECISIONS #30)', () => withStore(async (store) => {
        // De doelfase verschilt van de beginfase; zou de assertie ook slagen
        // wanneer er niets gebeurt, dan bewees ze niets.
        await arrangeInPhase(store, 'LOBBY');

        assert.deepStrictEqual(
          await store.setRoomAndMatchPhaseAtomically('room_a', 'match_1', {
            expectedPhase: 'LOBBY', newPhase: 'SCOREBOARD', pausedState: null,
          }),
          { ok: true }
        );

        const room = await store.loadRoom('room_a');
        const match = await store.loadMatch('room_a', 'match_1');
        assert.strictEqual(room.phase, 'SCOREBOARD');
        assert.strictEqual(match.phase, 'SCOREBOARD');
        assert.strictEqual(room.phase, match.phase, 'de projectie mag nooit uit de pas lopen met de autoritaire fase');
      }));

      it('de operatie verplaatst alleen phase en laat elk ander veld van beide documenten staan', () => withStore(async (store) => {
        await arrangeInPhase(store, 'LOBBY');

        await store.setRoomAndMatchPhaseAtomically('room_a', 'match_1', {
          expectedPhase: 'LOBBY', newPhase: 'FINISHED', pausedState: null,
        });

        assert.deepStrictEqual(await store.loadRoom('room_a'), makeRoom({ phase: 'FINISHED' }));
        assert.deepStrictEqual(await store.loadMatch('room_a', 'match_1'), makeMatch({ phase: 'FINISHED' }));
      }));

      it('pausedState landt in DEZELFDE stap als de fasewissel, niet in een tweede saveMatch', () => withStore(async (store) => {
        await arrangeInPhase(store, 'ROUND_ACTIVE');

        assert.deepStrictEqual(
          await store.setRoomAndMatchPhaseAtomically('room_a', 'match_1', {
            expectedPhase: 'ROUND_ACTIVE', newPhase: 'PAUSED', pausedState: makePausedState(),
          }),
          { ok: true }
        );

        assert.deepStrictEqual(
          await store.loadMatch('room_a', 'match_1'),
          makeMatch({ phase: 'PAUSED', pausedState: makePausedState() })
        );
        assert.strictEqual((await store.loadRoom('room_a')).phase, 'PAUSED');
      }));

      it('het verlaten van PAUSED wist pausedState in diezelfde stap', () => withStore(async (store) => {
        // De andere helft van de invariant, en de reden dat hij bestaat: bleef
        // `pausedState` na het hervatten staan, dan draagt een spelende match
        // een bevroren `remainingMs` uit een vorige pauze.
        await arrangeInPhase(store, 'ROUND_ACTIVE');
        await store.setRoomAndMatchPhaseAtomically('room_a', 'match_1', {
          expectedPhase: 'ROUND_ACTIVE', newPhase: 'PAUSED', pausedState: makePausedState(),
        });

        assert.deepStrictEqual(
          await store.setRoomAndMatchPhaseAtomically('room_a', 'match_1', {
            expectedPhase: 'PAUSED', newPhase: 'ROUND_ACTIVE', pausedState: null,
          }),
          { ok: true }
        );

        assert.deepStrictEqual(await store.loadMatch('room_a', 'match_1'), makeMatch({ phase: 'ROUND_ACTIVE' }));
      }));

      it('newPhase "PAUSED" zonder pausedState werpt RangeError en schrijft niets', () => withStore(async (store) => {
        await arrangeInPhase(store, 'ROUND_ACTIVE');

        await assert.rejects(
          () => store.setRoomAndMatchPhaseAtomically('room_a', 'match_1', {
            expectedPhase: 'ROUND_ACTIVE', newPhase: 'PAUSED', pausedState: null,
          }),
          RangeError,
          'een pauze zonder pauzestand is intern inconsistent, geen normale racefout'
        );

        assert.deepStrictEqual(await store.loadRoom('room_a'), makeRoom({ phase: 'ROUND_ACTIVE' }));
        assert.deepStrictEqual(await store.loadMatch('room_a', 'match_1'), makeMatch({ phase: 'ROUND_ACTIVE' }));
      }));

      it('een pausedState buiten de fase PAUSED werpt RangeError en schrijft niets', () => withStore(async (store) => {
        await arrangeInPhase(store, 'ROUND_ACTIVE');

        await assert.rejects(
          () => store.setRoomAndMatchPhaseAtomically('room_a', 'match_1', {
            expectedPhase: 'ROUND_ACTIVE', newPhase: 'SCOREBOARD', pausedState: makePausedState(),
          }),
          RangeError,
          'een pauzestand op een niet-gepauzeerde fase is net zo goed een contractschending'
        );

        assert.deepStrictEqual(await store.loadRoom('room_a'), makeRoom({ phase: 'ROUND_ACTIVE' }));
        assert.deepStrictEqual(await store.loadMatch('room_a', 'match_1'), makeMatch({ phase: 'ROUND_ACTIVE' }));
      }));

      it('een verkeerde expectedPhase schrijft niets en levert de WERKELIJKE fase op', () => withStore(async (store) => {
        await arrangeInPhase(store, 'ROUND_ACTIVE');

        assert.deepStrictEqual(
          await store.setRoomAndMatchPhaseAtomically('room_a', 'match_1', {
            expectedPhase: 'LOBBY', newPhase: 'COUNTDOWN', pausedState: null,
          }),
          { ok: false, actualPhase: 'ROUND_ACTIVE' },
          'een verlopen verwachting is een normale uitkomst, geen exception'
        );

        assert.deepStrictEqual(await store.loadRoom('room_a'), makeRoom({ phase: 'ROUND_ACTIVE' }));
        assert.deepStrictEqual(await store.loadMatch('room_a', 'match_1'), makeMatch({ phase: 'ROUND_ACTIVE' }));
      }));

      it('de compare-and-set kijkt naar BEIDE documenten, en meldt altijd Match.phase als actualPhase', () => withStore(async (store) => {
        // Een scheve toestand: de projectie loopt achter op de autoriteit. Zo'n
        // toestand hoort niet te bestaan, en juist daarom mag deze operatie er
        // niet stilzwijgend overheen schrijven — dat is wat "dubbele"
        // compare-and-set betekent. Beide kanten worden hier geraakt: de
        // verwachting die bij de MATCH past en de verwachting die bij de ROOM
        // past falen allebei, en allebei met Match.phase in de returnwaarde
        // (besluit 30: dat veld is autoritair).
        await store.saveRoom(makeRoom({ phase: 'LOBBY' }));
        await store.saveMatch(makeMatch({ phase: 'ROUND_ACTIVE' }));

        assert.deepStrictEqual(
          await store.setRoomAndMatchPhaseAtomically('room_a', 'match_1', {
            expectedPhase: 'ROUND_ACTIVE', newPhase: 'SCOREBOARD', pausedState: null,
          }),
          { ok: false, actualPhase: 'ROUND_ACTIVE' },
          'de match klopte, de room niet — dat is een mismatch'
        );
        assert.deepStrictEqual(
          await store.setRoomAndMatchPhaseAtomically('room_a', 'match_1', {
            expectedPhase: 'LOBBY', newPhase: 'SCOREBOARD', pausedState: null,
          }),
          { ok: false, actualPhase: 'ROUND_ACTIVE' },
          'de room klopte, de match niet — en gerapporteerd wordt de autoritaire fase'
        );

        assert.deepStrictEqual(await store.loadRoom('room_a'), makeRoom({ phase: 'LOBBY' }));
        assert.deepStrictEqual(await store.loadMatch('room_a', 'match_1'), makeMatch({ phase: 'ROUND_ACTIVE' }));
      }));

      it('een hele fasereeks blijft in lockstep — geen enkele overgang laat één van beide achter', () => withStore(async (store) => {
        await arrangeInPhase(store, 'LOBBY');

        let current = 'LOBBY';
        for (const phase of ['COUNTDOWN', 'ROUND_ACTIVE', 'ROUND_RESULT', 'SCOREBOARD', 'PAUSED', 'ROUND_ACTIVE', 'FINISHED']) {
          assert.deepStrictEqual(
            await store.setRoomAndMatchPhaseAtomically('room_a', 'match_1', {
              expectedPhase: current,
              newPhase: phase,
              pausedState: phase === 'PAUSED' ? makePausedState({ previousPhase: current }) : null,
            }),
            { ok: true },
            `overgang ${current} -> ${phase}`
          );
          const room = await store.loadRoom('room_a');
          const match = await store.loadMatch('room_a', 'match_1');
          assert.strictEqual(room.phase, phase, `Room.phase na overgang naar ${phase}`);
          assert.strictEqual(match.phase, phase, `Match.phase na overgang naar ${phase}`);
          assert.strictEqual(
            match.pausedState === null, phase !== 'PAUSED',
            `pausedState hoort ${phase === 'PAUSED' ? 'gevuld' : 'null'} te zijn in ${phase}`
          );
          current = phase;
        }
      }));

      it('een onbekend roomId werpt RangeError en laat room én match onaangeraakt', () => withStore(async (store) => {
        await arrangeInPhase(store, 'LOBBY');

        await assert.rejects(
          () => store.setRoomAndMatchPhaseAtomically('room_bestaat_niet', 'match_1', {
            expectedPhase: 'LOBBY', newPhase: 'FINISHED', pausedState: null,
          }),
          RangeError,
          'een onbekend roomId hoort RangeError te geven, niet stil te slagen'
        );

        // Beide documenten teruglezen, niet alleen het meest voor de hand
        // liggende: een half uitgevoerde schrijving verraadt zich in het
        // document waar je niet keek.
        assert.deepStrictEqual(await store.loadRoom('room_a'), makeRoom({ phase: 'LOBBY' }));
        assert.deepStrictEqual(await store.loadMatch('room_a', 'match_1'), makeMatch({ phase: 'LOBBY' }));
        assertIsNull(await store.loadRoom('room_bestaat_niet'), 'de mislukte aanroep mag geen room hebben aangemaakt');
      }));

      it('een onbekend matchId werpt RangeError en laat room én match onaangeraakt', () => withStore(async (store) => {
        await arrangeInPhase(store, 'LOBBY');

        await assert.rejects(
          () => store.setRoomAndMatchPhaseAtomically('room_a', 'match_bestaat_niet', {
            expectedPhase: 'LOBBY', newPhase: 'FINISHED', pausedState: null,
          }),
          RangeError,
          'een onbekend matchId hoort RangeError te geven, niet stil te slagen'
        );

        // Dit is het scherpste faalpad van de twee: het roomId is hier geldig,
        // dus een implementatie die de room alvast bijwerkt en pas daarna de
        // match opzoekt, heeft precies hier een dual-write achtergelaten.
        assert.deepStrictEqual(await store.loadRoom('room_a'), makeRoom({ phase: 'LOBBY' }));
        assert.deepStrictEqual(await store.loadMatch('room_a', 'match_1'), makeMatch({ phase: 'LOBBY' }));
        assertIsNull(await store.loadMatch('room_a', 'match_bestaat_niet'), 'de mislukte aanroep mag geen match hebben aangemaakt');
      }));

      it('een tweede room met een eigen match beweegt niet mee', () => withStore(async (store) => {
        const roomB = makeRoom({ id: 'room_b', code: 'BBB222', inviteId: 'invite_b', hostSessionIds: ['session_host_b'], phase: 'LOBBY' });
        const matchB = makeMatch({ id: 'match_b', roomId: 'room_b', phase: 'LOBBY' });
        await arrangeInPhase(store, 'LOBBY');
        await store.saveRoom(roomB);
        await store.saveMatch(matchB);

        await store.setRoomAndMatchPhaseAtomically('room_a', 'match_1', {
          expectedPhase: 'LOBBY', newPhase: 'FINISHED', pausedState: null,
        });

        assert.strictEqual((await store.loadRoom('room_a')).phase, 'FINISHED');
        assert.strictEqual((await store.loadMatch('room_a', 'match_1')).phase, 'FINISHED');
        assert.deepStrictEqual(await store.loadRoom('room_b'), roomB);
        assert.deepStrictEqual(await store.loadMatch('room_b', 'match_b'), matchB);
      }));

      it('een tweede match in DEZELFDE room beweegt niet mee', () => withStore(async (store) => {
        // Aparte test van de kruisbesmetting hierboven: een adapter die de
        // fase over "alle matches van deze room" zet, komt door de vorige test
        // heen en struikelt hier.
        const matchTwee = makeMatch({ id: 'match_2', roomId: 'room_a', sequence: 2, phase: 'LOBBY' });
        await arrangeInPhase(store, 'LOBBY');
        await store.saveMatch(matchTwee);

        await store.setRoomAndMatchPhaseAtomically('room_a', 'match_1', {
          expectedPhase: 'LOBBY', newPhase: 'FINISHED', pausedState: null,
        });

        assert.strictEqual((await store.loadMatch('room_a', 'match_1')).phase, 'FINISHED');
        assert.deepStrictEqual(await store.loadMatch('room_a', 'match_2'), matchTwee);
      }));

      it('dezelfde fase nog een keer zetten is idempotent en geen fout', () => withStore(async (store) => {
        // Idempotent BINNEN het contract: een herhaling noemt als verwachting de
        // fase waar de operatie hem net heeft neergezet, niet de fase van vóór
        // de eerste aanroep — dat laatste is per definitie verlopen.
        await arrangeInPhase(store, 'LOBBY');

        await store.setRoomAndMatchPhaseAtomically('room_a', 'match_1', {
          expectedPhase: 'LOBBY', newPhase: 'SCOREBOARD', pausedState: null,
        });
        assert.deepStrictEqual(
          await store.setRoomAndMatchPhaseAtomically('room_a', 'match_1', {
            expectedPhase: 'SCOREBOARD', newPhase: 'SCOREBOARD', pausedState: null,
          }),
          { ok: true },
          'een herhaalde faseovergang naar dezelfde waarde hoort geen fout te zijn'
        );

        assert.deepStrictEqual(await store.loadRoom('room_a'), makeRoom({ phase: 'SCOREBOARD' }));
        assert.deepStrictEqual(await store.loadMatch('room_a', 'match_1'), makeMatch({ phase: 'SCOREBOARD' }));
      }));
    });

    // ------------------------------------------------------------------
    // saveAcceptedAnswerAtomically — contract
    //
    // Hier wordt score toegekend, dus hier is "half uitgevoerd" het duurst.
    // De operatie schrijft VIER dingen (repository.js §AcceptedAnswerWrite,
    // DATA-MODEL.md stappen 7–10): het Answer, de bijgewerkte Player, het
    // sorted scoreboard en de ack-cache-entry. Elke assertie na een faalpad
    // controleert daarom alle vier, niet alleen degene die je verwacht.
    //
    // De poort krijgt ABSOLUTE nieuwe spelerwaarden mee, geen delta: de
    // aanroeper telt zelf op. De store hoeft dus niet te sommeren — maar mag
    // ook niet stilzwijgend een tweede schrijving accepteren die de eerste
    // ongedaan maakt. Dat laatste staat in het INTB-4-blok hieronder.
    // ------------------------------------------------------------------
    describe('saveAcceptedAnswerAtomically', () => {
      it('alle vier de writes landen: antwoord, speler, scoreboard en ack-cache', () => withStore(async (store) => {
        await store.savePlayer(makePlayer({ score: 0, correctCount: 0, correctResponseTimeMsTotal: 0 }));
        const write = makeAcceptedAnswerWrite({ points: 120, score: 120, correctCount: 1, correctResponseTimeMsTotal: 2000 });

        await store.saveAcceptedAnswerAtomically('room_a', 'match_1', write);

        // 1. het Answer
        assert.deepStrictEqual(
          await readAnswer(store, { roomId: 'room_a', matchId: 'match_1', roundId: 'round_1', playerId: 'player_1' }),
          write.answer
        );
        // 2. de bijgewerkte Player — alle drie de velden, niet alleen score
        const player = await store.loadPlayer('room_a', 'player_1');
        assert.strictEqual(player.score, 120);
        assert.strictEqual(player.correctCount, 1);
        assert.strictEqual(player.correctResponseTimeMsTotal, 2000);
        // 3. het scoreboard
        assert.deepStrictEqual(await store.getScoreboardTop('room_a', 'match_1', 10), [{ playerId: 'player_1', score: 120 }]);
        // 4. de ack-cache-entry (REVIEW-DM2-DM9.md bevinding 5: hoort in
        //    dezelfde mutatie, niet als losse latere uitbreiding)
        assert.deepStrictEqual(
          await readActionCacheEntry(store, { roomId: 'room_a', actionId: 'action_1' }),
          { actionId: 'action_1', ack: { roundId: 'round_1' } }
        );
      }));

      it('de bijgewerkte speler behoudt elk veld dat de write niet noemt', () => withStore(async (store) => {
        // De write draagt alleen id/score/correctCount/correctResponseTimeMsTotal.
        // Naam, team, verbindingsstatus en eligibleFromRound mogen daar niet
        // door verdwijnen of terugvallen op een default.
        await store.savePlayer(makePlayer({ displayName: 'Ruben', effectiveName: 'Ruben', nameSource: 'custom', eligibleFromRound: 3, connected: false }));

        await store.saveAcceptedAnswerAtomically('room_a', 'match_1', makeAcceptedAnswerWrite({ points: 120, score: 120, correctCount: 1, correctResponseTimeMsTotal: 2000 }));

        assert.deepStrictEqual(
          await store.loadPlayer('room_a', 'player_1'),
          makePlayer({
            displayName: 'Ruben', effectiveName: 'Ruben', nameSource: 'custom', eligibleFromRound: 3, connected: false,
            score: 120, correctCount: 1, correctResponseTimeMsTotal: 2000,
          })
        );
      }));

      it('een onbekende playerId laat geen van de vier writes landen', () => withStore(async (store) => {
        // Arrangement met een geslaagde write ervóór: zo zien we niet alleen
        // dat het faalpad niets nieuws schrijft, maar ook dat het niets
        // bestaands wegvaagt.
        await store.savePlayer(makePlayer());
        const geslaagd = makeAcceptedAnswerWrite({ points: 120, score: 120, correctCount: 1, correctResponseTimeMsTotal: 2000 });
        await store.saveAcceptedAnswerAtomically('room_a', 'match_1', geslaagd);

        await assert.rejects(
          () => store.saveAcceptedAnswerAtomically('room_a', 'match_1', makeAcceptedAnswerWrite({
            playerId: 'player_onbekend', roundId: 'round_2', actionId: 'action_2', points: 200, score: 200, correctCount: 1, correctResponseTimeMsTotal: 1000,
          })),
          RangeError,
          'een onbekende playerId hoort RangeError te geven, niet stil te slagen'
        );

        // Alle vier controleren, ook degene waar je geen probleem verwacht.
        assertIsNull(
          await readAnswer(store, { roomId: 'room_a', matchId: 'match_1', roundId: 'round_2', playerId: 'player_onbekend' }),
          'het antwoord van de mislukte aanroep'
        );
        assertIsNull(await store.loadPlayer('room_a', 'player_onbekend'), 'de speler van de mislukte aanroep');
        assertIsNull(await readActionCacheEntry(store, { roomId: 'room_a', actionId: 'action_2' }), 'de ack-cache-entry van de mislukte aanroep');
        assert.deepStrictEqual(
          await store.getScoreboardTop('room_a', 'match_1', 10),
          [{ playerId: 'player_1', score: 120 }],
          'het scoreboard mag geen regel voor de onbekende speler hebben gekregen'
        );

        // En de geslaagde write van hiervóór staat er nog, ongewijzigd.
        assert.deepStrictEqual(
          await readAnswer(store, { roomId: 'room_a', matchId: 'match_1', roundId: 'round_1', playerId: 'player_1' }),
          geslaagd.answer
        );
        assert.strictEqual((await store.loadPlayer('room_a', 'player_1')).score, 120);
        assert.deepStrictEqual(await readActionCacheEntry(store, { roomId: 'room_a', actionId: 'action_1' }), geslaagd.actionCacheEntry);
      }));

      it('dezelfde speler in twee verschillende rondes scoort twee keer: 120 + 100 = 220', () => withStore(async (store) => {
        await store.savePlayer(makePlayer());

        await store.saveAcceptedAnswerAtomically('room_a', 'match_1', makeAcceptedAnswerWrite({
          roundId: 'round_1', actionId: 'action_1', points: 120, responseTimeMs: 2000,
          score: 120, correctCount: 1, correctResponseTimeMsTotal: 2000,
        }));
        await store.saveAcceptedAnswerAtomically('room_a', 'match_1', makeAcceptedAnswerWrite({
          roundId: 'round_2', actionId: 'action_2', points: 100, responseTimeMs: 3000,
          score: 220, correctCount: 2, correctResponseTimeMsTotal: 5000,
        }));

        const player = await store.loadPlayer('room_a', 'player_1');
        assert.strictEqual(player.score, 220, 'eindscore na twee rondes');
        assert.strictEqual(player.correctCount, 2);
        assert.strictEqual(player.correctResponseTimeMsTotal, 5000);
        assert.deepStrictEqual(await store.getScoreboardTop('room_a', 'match_1', 10), [{ playerId: 'player_1', score: 220 }]);

        // Beide antwoorden bestaan naast elkaar; ronde 2 overschrijft ronde 1 niet.
        assert.strictEqual((await readAnswer(store, { roomId: 'room_a', matchId: 'match_1', roundId: 'round_1', playerId: 'player_1' })).points, 120);
        assert.strictEqual((await readAnswer(store, { roomId: 'room_a', matchId: 'match_1', roundId: 'round_2', playerId: 'player_1' })).points, 100);
        // En beide acks, want elke ronde had zijn eigen actionId.
        assert.deepStrictEqual(await readActionCacheEntry(store, { roomId: 'room_a', actionId: 'action_1' }), { actionId: 'action_1', ack: { roundId: 'round_1' } });
        assert.deepStrictEqual(await readActionCacheEntry(store, { roomId: 'room_a', actionId: 'action_2' }), { actionId: 'action_2', ack: { roundId: 'round_2' } });
      }));

      it('twee verschillende spelers in dezelfde ronde scoren allebei: 120 en 80', () => withStore(async (store) => {
        await store.savePlayer(makePlayer({ id: 'player_1', sessionId: 'session_1' }));
        await store.savePlayer(makePlayer({ id: 'player_2', sessionId: 'session_2', generatedName: 'Rode Das', effectiveName: 'Rode Das' }));

        await store.saveAcceptedAnswerAtomically('room_a', 'match_1', makeAcceptedAnswerWrite({
          playerId: 'player_1', actionId: 'action_1', points: 120, responseTimeMs: 2000,
          score: 120, correctCount: 1, correctResponseTimeMsTotal: 2000,
        }));
        await store.saveAcceptedAnswerAtomically('room_a', 'match_1', makeAcceptedAnswerWrite({
          playerId: 'player_2', actionId: 'action_2', points: 80, responseTimeMs: 6000,
          score: 80, correctCount: 1, correctResponseTimeMsTotal: 6000,
        }));

        assert.strictEqual((await store.loadPlayer('room_a', 'player_1')).score, 120);
        assert.strictEqual((await store.loadPlayer('room_a', 'player_2')).score, 80);
        // Verschillende scores, bewust: de tiebreak bij gelijkspel ligt nergens
        // vast (HANDOFF INTB-6), dus asserteert deze suite er niet op.
        assert.deepStrictEqual(await store.getScoreboardTop('room_a', 'match_1', 10), [
          { playerId: 'player_1', score: 120 },
          { playerId: 'player_2', score: 80 },
        ]);
        assert.strictEqual((await readAnswer(store, { roomId: 'room_a', matchId: 'match_1', roundId: 'round_1', playerId: 'player_1' })).points, 120);
        assert.strictEqual((await readAnswer(store, { roomId: 'room_a', matchId: 'match_1', roundId: 'round_1', playerId: 'player_2' })).points, 80);
      }));

      it('een latere ronde herschikt het scoreboard aflopend en voegt geen tweede regel voor dezelfde speler toe', () => withStore(async (store) => {
        await store.savePlayer(makePlayer({ id: 'player_1', sessionId: 'session_1' }));
        await store.savePlayer(makePlayer({ id: 'player_2', sessionId: 'session_2', generatedName: 'Rode Das', effectiveName: 'Rode Das' }));
        await store.savePlayer(makePlayer({ id: 'player_3', sessionId: 'session_3', generatedName: 'Groene Uil', effectiveName: 'Groene Uil' }));

        await store.saveAcceptedAnswerAtomically('room_a', 'match_1', makeAcceptedAnswerWrite({ playerId: 'player_1', actionId: 'a1', points: 100, score: 100 }));
        await store.saveAcceptedAnswerAtomically('room_a', 'match_1', makeAcceptedAnswerWrite({ playerId: 'player_2', actionId: 'a2', points: 200, score: 200 }));
        await store.saveAcceptedAnswerAtomically('room_a', 'match_1', makeAcceptedAnswerWrite({ playerId: 'player_3', actionId: 'a3', points: 150, score: 150 }));

        assert.deepStrictEqual(await store.getScoreboardTop('room_a', 'match_1', 10), [
          { playerId: 'player_2', score: 200 },
          { playerId: 'player_3', score: 150 },
          { playerId: 'player_1', score: 100 },
        ]);
        assert.deepStrictEqual(await store.getScoreboardTop('room_a', 'match_1', 2), [
          { playerId: 'player_2', score: 200 },
          { playerId: 'player_3', score: 150 },
        ]);

        // Ronde 2: player_1 haalt in. De regel van player_1 hoort te worden
        // BIJGEWERKT, niet aangevuld — een scoreboard met vier regels voor drie
        // spelers is stiller kapot dan een verkeerde volgorde.
        await store.saveAcceptedAnswerAtomically('room_a', 'match_1', makeAcceptedAnswerWrite({
          playerId: 'player_1', roundId: 'round_2', actionId: 'a4', points: 200, responseTimeMs: 3000,
          score: 300, correctCount: 2, correctResponseTimeMsTotal: 5000,
        }));

        assert.deepStrictEqual(await store.getScoreboardTop('room_a', 'match_1', 10), [
          { playerId: 'player_1', score: 300 },
          { playerId: 'player_2', score: 200 },
          { playerId: 'player_3', score: 150 },
        ]);
      }));

      // ----------------------------------------------------------------
      // Interleaving.
      //
      // De fake is single-threaded en voert elke aanroep volledig synchroon
      // uit, dus tegen de fake bewijzen deze twee tests weinig — de aanroepen
      // kunnen elkaar er niet eens kruisen. Tegen een Redis-adapter bewijzen
      // ze alles: daar zit een netwerkbeurt tussen elke lees en elke schrijf,
      // en precies daar ontstaat een half doorgevoerde score. Ze staan hier
      // omdat de suite tegen BEIDE gericht moet kunnen worden; wie hem straks
      // op de adapter richt, hoeft ze niet alsnog te bedenken.
      // ----------------------------------------------------------------
      it('vier gelijktijdige inzendingen leveren precies vier scoreboardregels op, elk met een aangeboden waarde', () => withStore(async (store) => {
        const aangeboden = { player_1: 200, player_2: 150, player_3: 100, player_4: 50 };
        for (const [index, playerId] of Object.keys(aangeboden).entries()) {
          await store.savePlayer(makePlayer({ id: playerId, sessionId: `session_${index + 1}` }));
        }

        // Geen await tussen de aanroepen: alle vier gaan tegelijk de deur uit.
        await Promise.all(Object.entries(aangeboden).map(([playerId, score]) => store.saveAcceptedAnswerAtomically('room_a', 'match_1', makeAcceptedAnswerWrite({
          playerId, actionId: `action_${playerId}`, points: score > 200 ? 200 : score, score,
        }))));

        const board = await store.getScoreboardTop('room_a', 'match_1', 10);
        assert.strictEqual(board.length, 4, 'precies één regel per speler, geen dubbele en geen verdwenen regel');
        assert.deepStrictEqual(
          board.map((entry) => entry.playerId).sort(),
          ['player_1', 'player_2', 'player_3', 'player_4']
        );
        for (const entry of board) {
          assert.strictEqual(entry.score, aangeboden[entry.playerId], `${entry.playerId} draagt een score die daadwerkelijk voor hem is aangeboden`);
          assert.strictEqual(
            (await store.loadPlayer('room_a', entry.playerId)).score,
            entry.score,
            `${entry.playerId}: scoreboard en spelerdocument mogen niet uiteenlopen`
          );
        }
      }));

      it('twee gelijktijdige inzendingen voor dezelfde speler leveren geen mengvorm op', () => withStore(async (store) => {
        await store.savePlayer(makePlayer());

        // Twee legitieme writes (verschillende ronde, verschillende actionId)
        // die elkaar kunnen kruisen. Welke van de twee als laatste landt ligt
        // niet vast — dat mag ook niet, want de poort belooft geen volgorde.
        // Wat wél moet gelden: de eindstand is één van de twee, niet de score
        // van de één met de correctCount van de ander.
        await Promise.all([
          store.saveAcceptedAnswerAtomically('room_a', 'match_1', makeAcceptedAnswerWrite({
            roundId: 'round_1', actionId: 'action_1', points: 120, responseTimeMs: 2000,
            score: 120, correctCount: 1, correctResponseTimeMsTotal: 2000,
          })),
          store.saveAcceptedAnswerAtomically('room_a', 'match_1', makeAcceptedAnswerWrite({
            roundId: 'round_2', actionId: 'action_2', points: 100, responseTimeMs: 3000,
            score: 220, correctCount: 2, correctResponseTimeMsTotal: 5000,
          })),
        ]);

        const player = await store.loadPlayer('room_a', 'player_1');
        const consistenteEindstanden = [
          { score: 120, correctCount: 1, correctResponseTimeMsTotal: 2000 },
          { score: 220, correctCount: 2, correctResponseTimeMsTotal: 5000 },
        ];
        assert.ok(
          consistenteEindstanden.some((stand) =>
            stand.score === player.score &&
            stand.correctCount === player.correctCount &&
            stand.correctResponseTimeMsTotal === player.correctResponseTimeMsTotal),
          `de speler draagt een mengvorm van twee writes: ${JSON.stringify({ score: player.score, correctCount: player.correctCount, correctResponseTimeMsTotal: player.correctResponseTimeMsTotal })}`
        );

        const board = await store.getScoreboardTop('room_a', 'match_1', 10);
        assert.strictEqual(board.length, 1, 'één speler, één scoreboardregel');
        assert.strictEqual(board[0].score, player.score, 'scoreboard en spelerdocument mogen niet uiteenlopen');
      }));
    });

    // ------------------------------------------------------------------
    // saveAcceptedAnswerAtomically — INTB-4: idempotentie en één antwoord
    // per ronde
    //
    // DEZE DRIE TESTS STAAN BEWUST ROOD, en dat is geen verzuim.
    //
    // De fake (server/data/in-memory-store.js:148-172) controleert niet of er
    // al een antwoord voor deze speler in deze ronde bestaat, en niet of de
    // actionId al in de action-cache staat — hij overschrijft beide. Zie
    // HANDOFF-item INTB-4.
    //
    // Ze zijn geschreven tegen het CORRECTE contract, niet tegen wat de fake
    // vandaag doet. Dat onderscheid is de hele reden dat ze hier staan: een
    // karakterisatietest die vastlegt "de store overschrijft gewoon" zou het
    // gat wegschrijven, en de latere correctie tot testbreuk maken.
    //
    // Het contract:
    //   * dezelfde actionId opnieuw -> de bewaarde ack, zonder te muteren
    //     (DATA-MODEL.md stap 4, PROTOCOL.md §Idempotentie: "zelfde actionId:
    //     zelfde ack");
    //   * een ANDERE actionId voor dezelfde speler in dezelfde ronde -> wordt
    //     afgewezen (DATA-MODEL.md stap 5).
    //
    // Beide controles staan in DATA-MODEL.md expliciet ÍN de atomaire
    // operatie, niet ervóór. Dat is geen stijlkwestie: answer-flow.js doet ze
    // ook (stappen 1 en 5 daar), maar op context die de aanroeper vooraf heeft
    // ingelezen. Tussen dat inlezen en de schrijfactie past een tweede
    // aanroep — dezelfde klasse fout als INTB-2. De poort is de enige plek waar
    // check en write samen kunnen vallen.
    //
    // GROEN MAKEN DOE JE IN DE FAKE, NIET HIER.
    // ------------------------------------------------------------------
    describe('saveAcceptedAnswerAtomically — INTB-4: idempotentie en één antwoord per ronde', () => {
      it('INTB-4 (verwacht rood tot DM de fake corrigeert): dezelfde actionId een tweede keer muteert niets', () => withStore(async (store) => {
        await store.savePlayer(makePlayer());
        const eerste = makeAcceptedAnswerWrite({
          roundId: 'round_1', actionId: 'action_1', points: 120, responseTimeMs: 2000,
          score: 120, correctCount: 1, correctResponseTimeMsTotal: 2000,
        });
        await store.saveAcceptedAnswerAtomically('room_a', 'match_1', eerste);

        // Dezelfde actionId, maar met een hogere score en een ander antwoord —
        // zoals een dubbel afgeleverde socketboodschap eruitziet nadat de
        // aanroeper op verouderde spelerstand heeft gerekend. Zou de store dit
        // doorlaten, dan is dat aantoonbaar dubbel scoren.
        const herhaling = makeAcceptedAnswerWrite({
          roundId: 'round_1', actionId: 'action_1', points: 200, responseTimeMs: 3000,
          score: 320, correctCount: 2, correctResponseTimeMsTotal: 5000,
        });
        await assert.doesNotReject(
          () => store.saveAcceptedAnswerAtomically('room_a', 'match_1', herhaling),
          'een herhaalde actionId is een replay, geen fout: hij hoort de bewaarde ack op te leveren'
        );

        const player = await store.loadPlayer('room_a', 'player_1');
        assert.strictEqual(player.score, 120, 'eindscore blijft 120 — de retry mag er geen 320 van maken');
        assert.strictEqual(player.correctCount, 1);
        assert.strictEqual(player.correctResponseTimeMsTotal, 2000);
        assert.deepStrictEqual(
          await readAnswer(store, { roomId: 'room_a', matchId: 'match_1', roundId: 'round_1', playerId: 'player_1' }),
          eerste.answer,
          'het bewaarde antwoord blijft dat van de eerste, geslaagde inzending'
        );
        assert.deepStrictEqual(await store.getScoreboardTop('room_a', 'match_1', 10), [{ playerId: 'player_1', score: 120 }]);
        assert.deepStrictEqual(
          await readActionCacheEntry(store, { roomId: 'room_a', actionId: 'action_1' }),
          eerste.actionCacheEntry,
          'de bewaarde ack blijft ongewijzigd — dat is precies wat "zelfde actionId: zelfde ack" betekent'
        );
      }));

      it('INTB-4 (verwacht rood tot DM de fake corrigeert): een tweede actionId voor dezelfde speler in dezelfde ronde wordt afgewezen', () => withStore(async (store) => {
        await store.savePlayer(makePlayer());
        const eerste = makeAcceptedAnswerWrite({
          roundId: 'round_1', actionId: 'action_1', points: 120, responseTimeMs: 2000,
          score: 120, correctCount: 1, correctResponseTimeMsTotal: 2000,
        });
        await store.saveAcceptedAnswerAtomically('room_a', 'match_1', eerste);

        const tweede = makeAcceptedAnswerWrite({
          roundId: 'round_1', actionId: 'action_2', points: 200, responseTimeMs: 3000,
          score: 320, correctCount: 2, correctResponseTimeMsTotal: 5000,
        });
        await assert.rejects(
          () => store.saveAcceptedAnswerAtomically('room_a', 'match_1', tweede),
          'een speler heeft per ronde precies één antwoord (DATA-MODEL.md stap 5) — een tweede actionId hoort afgewezen te worden, niet de eerste te overschrijven'
        );

        // Geen van de vier writes van de afgewezen inzending mag geland zijn.
        const player = await store.loadPlayer('room_a', 'player_1');
        assert.strictEqual(player.score, 120, 'eindscore blijft 120');
        assert.strictEqual(player.correctCount, 1);
        assert.strictEqual(player.correctResponseTimeMsTotal, 2000);
        assert.deepStrictEqual(
          await readAnswer(store, { roomId: 'room_a', matchId: 'match_1', roundId: 'round_1', playerId: 'player_1' }),
          eerste.answer
        );
        assert.deepStrictEqual(await store.getScoreboardTop('room_a', 'match_1', 10), [{ playerId: 'player_1', score: 120 }]);
        assertIsNull(await readActionCacheEntry(store, { roomId: 'room_a', actionId: 'action_2' }), 'de ack van de afgewezen inzending');
      }));

      it('INTB-4 (verwacht rood tot DM de fake corrigeert): nooit dubbele punten — na een retry, een afgewezen tweede inzending en een geldige volgende ronde is de eindscore precies 220', () => withStore(async (store) => {
        // Het volledige verhaal in één test, want zo komt het in productie
        // langs: een retry, een dubbele inzending, en daarna een legitieme
        // ronde die wél moet tellen. De drie leaks apart zijn te repareren met
        // een lokale check; alleen samen laten ze zien wat de eindscore moet
        // zijn.
        //
        // LET OP bij het lezen van het faalrapport: tegen de huidige fake
        // struikelt deze test op het ANTWOORD van ronde 1, niet op de score.
        // Dat is geen toeval en het is de moeite waard om te onthouden. Omdat
        // de poort absolute spelerwaarden krijgt, wist elke volgende geldige
        // write het spoor van een doorgelaten duplicaat uit de score: de
        // laatste schrijver bepaalt de eindstand, en die stond hier toevallig
        // op 220. De score alleen is dus GEEN betrouwbare detector van dubbel
        // verwerken op opslagniveau — het Answer en de ack-cache zijn dat wel,
        // want die worden per ronde respectievelijk per actionId gesleuteld en
        // overleven de volgende write.
        await store.savePlayer(makePlayer());

        // Ronde 1, geaccepteerd: 0 + 120 = 120.
        const rondeEen = makeAcceptedAnswerWrite({
          roundId: 'round_1', actionId: 'action_1', points: 120, responseTimeMs: 2000,
          score: 120, correctCount: 1, correctResponseTimeMsTotal: 2000,
        });
        await store.saveAcceptedAnswerAtomically('room_a', 'match_1', rondeEen);

        // Retry van diezelfde actie: replay, geen mutatie.
        await store.saveAcceptedAnswerAtomically('room_a', 'match_1', makeAcceptedAnswerWrite({
          roundId: 'round_1', actionId: 'action_1', points: 200, responseTimeMs: 3000,
          score: 320, correctCount: 2, correctResponseTimeMsTotal: 5000,
        })).catch(() => {
          // Of dit resolvet (replay) of rejectet, is hierboven al vastgelegd;
          // deze test gaat alleen over de eindstand.
        });

        // Tweede, andere actie in DEZELFDE ronde: afgewezen.
        await store.saveAcceptedAnswerAtomically('room_a', 'match_1', makeAcceptedAnswerWrite({
          roundId: 'round_1', actionId: 'action_2', points: 200, responseTimeMs: 4000,
          score: 320, correctCount: 2, correctResponseTimeMsTotal: 6000,
        })).catch(() => {});

        // Ronde 2, geaccepteerd: 120 + 100 = 220. Deze MOET tellen — een fix
        // die alles na de eerste inzending blokkeert, is net zo fout.
        const rondeTwee = makeAcceptedAnswerWrite({
          roundId: 'round_2', actionId: 'action_3', points: 100, responseTimeMs: 3000,
          score: 220, correctCount: 2, correctResponseTimeMsTotal: 5000,
        });
        await store.saveAcceptedAnswerAtomically('room_a', 'match_1', rondeTwee);

        const player = await store.loadPlayer('room_a', 'player_1');
        assert.strictEqual(player.score, 220, 'eindscore is 120 (ronde 1) + 100 (ronde 2) — niet 320, niet 420');
        assert.strictEqual(player.correctCount, 2);
        assert.strictEqual(player.correctResponseTimeMsTotal, 5000);
        assert.deepStrictEqual(await store.getScoreboardTop('room_a', 'match_1', 10), [{ playerId: 'player_1', score: 220 }]);
        assert.deepStrictEqual(
          await readAnswer(store, { roomId: 'room_a', matchId: 'match_1', roundId: 'round_1', playerId: 'player_1' }),
          rondeEen.answer,
          'ronde 1 draagt nog steeds het eerste antwoord'
        );
        assert.deepStrictEqual(
          await readAnswer(store, { roomId: 'room_a', matchId: 'match_1', roundId: 'round_2', playerId: 'player_1' }),
          rondeTwee.answer
        );
        assert.deepStrictEqual(await readActionCacheEntry(store, { roomId: 'room_a', actionId: 'action_1' }), rondeEen.actionCacheEntry);
        assertIsNull(await readActionCacheEntry(store, { roomId: 'room_a', actionId: 'action_2' }), 'de ack van de afgewezen tweede inzending');
        assert.deepStrictEqual(await readActionCacheEntry(store, { roomId: 'room_a', actionId: 'action_3' }), rondeTwee.actionCacheEntry);
      }));
    });

    // ------------------------------------------------------------------
    // getScoreboardTop
    //
    // Arrangement loopt via saveAcceptedAnswerAtomically (INTB1b): dat is de
    // enige schrijfweg naar het scoreboard op deze poort. Alleen het
    // leesgedrag hieronder is contract.
    //
    // GELIJKE SCORES ONTBREKEN BEWUST in elke fixture hieronder. De volgorde
    // bij een gelijkspel ligt nergens vast: DATA-MODEL.md schrijft een sorted
    // set voor (Redis breekt gelijke scores lexicografisch op member), terwijl
    // de fake Array.prototype.sort gebruikt en dus op invoegvolgorde uitkomt.
    // Twee implementaties, twee antwoorden. Een assertie hierover zou een
    // keuze vastleggen die nog niemand heeft gemaakt — zie het voorgestelde
    // HANDOFF-item over de tiebreak.
    // ------------------------------------------------------------------
    describe('getScoreboardTop', () => {
      it('een match zonder enig verwerkt antwoord levert een lege lijst op, geen null en geen fout', () => withStore(async (store) => {
        const listed = await store.getScoreboardTop('room_a', 'match_bestaat_niet', 10);
        assert.ok(Array.isArray(listed), 'getScoreboardTop hoort altijd een array op te leveren');
        assert.deepStrictEqual(listed, []);
      }));

      it('de lijst staat aflopend op score', () => withStore(async (store) => {
        await store.savePlayer(makePlayer({ id: 'player_1', sessionId: 'session_1' }));
        await store.savePlayer(makePlayer({ id: 'player_2', sessionId: 'session_2' }));
        await store.savePlayer(makePlayer({ id: 'player_3', sessionId: 'session_3' }));
        await scoreOne(store, { roomId: 'room_a', matchId: 'match_1', playerId: 'player_1', score: 100, actionId: 'action_1', roundId: 'round_1' });
        await scoreOne(store, { roomId: 'room_a', matchId: 'match_1', playerId: 'player_2', score: 300, actionId: 'action_2', roundId: 'round_1' });
        await scoreOne(store, { roomId: 'room_a', matchId: 'match_1', playerId: 'player_3', score: 200, actionId: 'action_3', roundId: 'round_1' });

        assert.deepStrictEqual(await store.getScoreboardTop('room_a', 'match_1', 10), [
          { playerId: 'player_2', score: 300 },
          { playerId: 'player_3', score: 200 },
          { playerId: 'player_1', score: 100 },
        ]);
      }));

      it('limit kapt de lijst af op de hoogste scores en een ruimere limit levert iedereen op', () => withStore(async (store) => {
        await store.savePlayer(makePlayer({ id: 'player_1', sessionId: 'session_1' }));
        await store.savePlayer(makePlayer({ id: 'player_2', sessionId: 'session_2' }));
        await store.savePlayer(makePlayer({ id: 'player_3', sessionId: 'session_3' }));
        await scoreOne(store, { roomId: 'room_a', matchId: 'match_1', playerId: 'player_1', score: 100, actionId: 'action_1', roundId: 'round_1' });
        await scoreOne(store, { roomId: 'room_a', matchId: 'match_1', playerId: 'player_2', score: 300, actionId: 'action_2', roundId: 'round_1' });
        await scoreOne(store, { roomId: 'room_a', matchId: 'match_1', playerId: 'player_3', score: 200, actionId: 'action_3', roundId: 'round_1' });

        assert.deepStrictEqual(await store.getScoreboardTop('room_a', 'match_1', 2), [
          { playerId: 'player_2', score: 300 },
          { playerId: 'player_3', score: 200 },
        ]);
        assert.strictEqual((await store.getScoreboardTop('room_a', 'match_1', 99)).length, 3);
      }));

      it('twee matches in dezelfde room houden een eigen ranglijst', () => withStore(async (store) => {
        await store.savePlayer(makePlayer({ id: 'player_1', sessionId: 'session_1' }));
        await scoreOne(store, { roomId: 'room_a', matchId: 'match_1', playerId: 'player_1', score: 100, actionId: 'action_1', roundId: 'round_1' });
        await scoreOne(store, { roomId: 'room_a', matchId: 'match_2', playerId: 'player_1', score: 500, actionId: 'action_2', roundId: 'round_9' });

        assert.deepStrictEqual(await store.getScoreboardTop('room_a', 'match_1', 10), [{ playerId: 'player_1', score: 100 }]);
        assert.deepStrictEqual(await store.getScoreboardTop('room_a', 'match_2', 10), [{ playerId: 'player_1', score: 500 }]);
      }));

      it('twee rooms met elk een eigen match houden gescheiden ranglijsten', () => withStore(async (store) => {
        await store.savePlayer(makePlayer({ id: 'player_1', roomId: 'room_a', sessionId: 'session_1' }));
        await store.savePlayer(makePlayer({ id: 'player_2', roomId: 'room_b', sessionId: 'session_2' }));
        await scoreOne(store, { roomId: 'room_a', matchId: 'match_a', playerId: 'player_1', score: 100, actionId: 'action_1', roundId: 'round_1' });
        await scoreOne(store, { roomId: 'room_b', matchId: 'match_b', playerId: 'player_2', score: 700, actionId: 'action_2', roundId: 'round_1' });

        assert.deepStrictEqual(await store.getScoreboardTop('room_a', 'match_a', 10), [{ playerId: 'player_1', score: 100 }]);
        assert.deepStrictEqual(await store.getScoreboardTop('room_b', 'match_b', 10), [{ playerId: 'player_2', score: 700 }]);
      }));

      it('twee rooms die HETZELFDE match-id gebruiken houden alsnog gescheiden ranglijsten', () => withStore(async (store) => {
        // Was tot DM12 een karakterisatietest onder "vastgelegd gedrag, geen
        // broneis": de fake keyde het scoreboard op alleen `matchId` en
        // negeerde de `roomId`-parameter, terwijl `scoreboardKey(roomId,
        // matchId)` er wél op keyt (HANDOFF-item INTB-3). Dat besluit is
        // genomen — het scoreboard is nu room-gescoped — dus is de test
        // omgekeerd en verhuisd naar het contract. De test hierboven dekt dit
        // niet af: die gebruikt twee VERSCHILLENDE match-ids en slaagt dus ook
        // op een implementatie die roomId negeert.
        await store.savePlayer(makePlayer({ id: 'player_1', roomId: 'room_a', sessionId: 'session_1' }));
        await store.savePlayer(makePlayer({ id: 'player_2', roomId: 'room_b', sessionId: 'session_2' }));
        await scoreOne(store, { roomId: 'room_a', matchId: 'match_gedeeld', playerId: 'player_1', score: 100, actionId: 'action_1', roundId: 'round_1' });
        await scoreOne(store, { roomId: 'room_b', matchId: 'match_gedeeld', playerId: 'player_2', score: 700, actionId: 'action_2', roundId: 'round_1' });

        assert.deepStrictEqual(await store.getScoreboardTop('room_a', 'match_gedeeld', 10), [{ playerId: 'player_1', score: 100 }]);
        assert.deepStrictEqual(await store.getScoreboardTop('room_b', 'match_gedeeld', 10), [{ playerId: 'player_2', score: 700 }]);
      }));

      it('het aanpassen van de teruggegeven ranglijst raakt de opslag niet', () => withStore(async (store) => {
        await store.savePlayer(makePlayer({ id: 'player_1', sessionId: 'session_1' }));
        await scoreOne(store, { roomId: 'room_a', matchId: 'match_1', playerId: 'player_1', score: 100, actionId: 'action_1', roundId: 'round_1' });

        const listed = await store.getScoreboardTop('room_a', 'match_1', 10);
        listed[0].score = 9999;
        listed.push({ playerId: 'player_spook', score: 1 });

        assert.deepStrictEqual(await store.getScoreboardTop('room_a', 'match_1', 10), [{ playerId: 'player_1', score: 100 }]);
      }));
    });

    // ------------------------------------------------------------------
    // Karakterisatie: VASTGELEGD GEDRAG, GEEN BRONEIS — VANDAAG LEEG
    //
    // Een karakterisatietest beschrijft wat de huidige implementatie DOET, niet
    // wat een adapter MOET doen: een item dat op een besluit wacht
    // (HANDOFF-INTB.md), bewust apart van de contracttests zodat het verschil
    // zichtbaar blijft.
    //
    // Deze sectie had er twee, allebei INTB-5: de oude join-code en het oude
    // invite-id bleven na een hercodering naar dezelfde room wijzen — een
    // geroteerde uitnodiging bleef dus geldig. Dat besluit is genomen (DM10:
    // roteren gaat via `releaseRoomLocators`), dus zijn ze OMGEKEERD en
    // verhuisd naar het contract: zie "INTB-5: een geroteerde uitnodiging is na
    // vrijgave niet meer geldig" in het room-locator-blok hierboven. De kop
    // blijft staan zodat een volgende bevinding weet waar hij hoort te landen.
    // ------------------------------------------------------------------

    // ------------------------------------------------------------------
    // INTB-1 — room-scoped saveRound, loadAnswer en loadActionCacheEntry
    //
    // Dit blok stond tot DM11 op `describe.skip`: `saveRound`, `loadAnswer` en
    // `loadActionCacheEntry` kregen geen roomId mee, terwijl
    // server/data/redis-keys.js dat voor alle drie de sleutels nodig heeft
    // (roundKey/answersKey/actionCacheKey). Ze waren dus niet tegen Redis
    // implementeerbaar, en hun gedrag toen vastleggen zou een bekende fout tot
    // norm hebben gepromoveerd.
    //
    // DM11 heeft de drie signaturen verbreed tot `saveRound(roomId, round)`,
    // `loadAnswer(roomId, matchId, roundId, playerId)` en
    // `loadActionCacheEntry(roomId, actionId)`, en in de fake de rondes,
    // antwoorden en action-cache werkelijk room-scoped gemaakt. De bodies
    // hieronder waren al tégen die verbrede signaturen geschreven — ze waren
    // de acceptatietest van dat item, geen dood commentaar — en draaien nu
    // ongewijzigd mee, op één arrangement na: `saveRound` heeft zijn
    // integriteitscontrole behouden (een ronde mag niet wees worden), dus moet
    // de bijbehorende Match eerst bestaan.
    // ------------------------------------------------------------------
    describe('INTB-1 — room-scoped saveRound, loadAnswer en loadActionCacheEntry', () => {
      it('een ronde wordt weggeschreven onder de room die de aanroeper meegeeft, niet onder een geraden room', () => withStore(async (store) => {
        const round = makeRound();
        await store.saveMatch(makeMatch()); // saveRound weigert een weesronde
        await store.saveRound('room_a', round);

        assert.deepStrictEqual(await store.loadRound('room_a', 'match_1', 'round_1'), round);
        assertIsNull(await store.loadRound('room_b', 'match_1', 'round_1'), 'de ronde hoort niet in een andere room te staan');
      }));

      it('twee rooms met hetzelfde match-id houden hun rondes gescheiden', () => withStore(async (store) => {
        // Vóór DM11 onmogelijk te arrangeren: saveRound leidde het roomId af
        // met een scan over alle matches en pakte de eerste treffer.
        await store.saveMatch(makeMatch({ id: 'match_gedeeld', roomId: 'room_a' }));
        await store.saveMatch(makeMatch({ id: 'match_gedeeld', roomId: 'room_b' }));
        await store.saveRound('room_a', makeRound({ id: 'round_1', matchId: 'match_gedeeld' }));
        await store.saveRound('room_b', makeRound({ id: 'round_1', matchId: 'match_gedeeld', questionKey: 'capitals_mc:be', gameType: 'capitals_mc' }));

        assert.strictEqual((await store.loadRound('room_a', 'match_gedeeld', 'round_1')).questionKey, 'flags_mc:nl');
        assert.strictEqual((await store.loadRound('room_b', 'match_gedeeld', 'round_1')).questionKey, 'capitals_mc:be');
      }));

      it('een ronde zonder bestaande match werpt RangeError in plaats van een wees weg te schrijven', () => withStore(async (store) => {
        // De integriteitscontrole die DM11 bewust HEEFT BEHOUDEN toen de scan
        // een directe lookup werd. Zonder deze test zou een adapter die de
        // controle laat vallen ongemerkt door de suite komen — en dan bestaat
        // er een ronde die via geen enkele match meer te vinden is.
        await assert.rejects(
          () => store.saveRound('room_a', makeRound()),
          RangeError,
          'een ronde in een onbekende match hoort RangeError te geven, niet stil te slagen'
        );
        assertIsNull(await store.loadRound('room_a', 'match_1', 'round_1'), 'de geweigerde ronde');
      }));

      it('een antwoord is alleen leesbaar binnen zijn eigen room en match', () => withStore(async (store) => {
        const answer = makeAnswer();
        await store.savePlayer(makePlayer());
        await scoreOne(store, { roomId: 'room_a', matchId: 'match_1', playerId: 'player_1', score: 120, actionId: 'action_1', roundId: 'round_1' });

        assert.deepStrictEqual(await store.loadAnswer('room_a', 'match_1', 'round_1', 'player_1'), answer);
        assertIsNull(await store.loadAnswer('room_b', 'match_1', 'round_1', 'player_1'), 'het antwoord hoort niet vanuit een andere room leesbaar te zijn');
        assertIsNull(await store.loadAnswer('room_a', 'match_ander', 'round_1', 'player_1'), 'het antwoord hoort niet vanuit een andere match leesbaar te zijn');
        assertIsNull(await store.loadAnswer('room_a', 'match_1', 'round_1', 'player_onbekend'), 'een speler zonder antwoord hoort null op te leveren');
      }));

      it('een action-cache-item is alleen leesbaar binnen zijn eigen room', () => withStore(async (store) => {
        await store.savePlayer(makePlayer());
        await scoreOne(store, { roomId: 'room_a', matchId: 'match_1', playerId: 'player_1', score: 120, actionId: 'action_1', roundId: 'round_1' });

        assert.deepStrictEqual(await store.loadActionCacheEntry('room_a', 'action_1'), { actionId: 'action_1', ack: { status: 'accepted' } });
        assertIsNull(await store.loadActionCacheEntry('room_b', 'action_1'), 'het cache-item hoort niet vanuit een andere room leesbaar te zijn');
        assertIsNull(await store.loadActionCacheEntry('room_a', 'action_onbekend'), 'een onbekend actie-id hoort null op te leveren');
      }));
    });
  });
}
