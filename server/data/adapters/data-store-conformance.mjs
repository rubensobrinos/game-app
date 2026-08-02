// Conformance-suite voor de DataStore-poort (server/data/repository.js).
//
// Eén suite, elke implementatie. De in-memory fake draait hem vandaag
// (data-store-conformance.test.mjs); een Redis-adapter richt hem straks op
// zichzelf zonder één regel te kopiëren. Dit bestand IS het gedragscontract —
// wat hier groen is, mag een adapterswap niet veranderen.
//
// GRENZEN VAN DEZE SUITE (bewust, niet vergeten):
//
//   * Drie poortmethoden ontbreken: `saveRound`, `loadAnswer` en
//     `loadActionCacheEntry`. Zie het `describe.skip`-blok onderaan en
//     HANDOFF-item INTB-1. Hun huidige gedrag is hier NIET vastgelegd; dat zou
//     een bekende fout tot norm promoveren.
//   * De twee atomaire methoden (`setRoomAndMatchPhaseAtomically`,
//     `saveAcceptedAnswerAtomically`) horen bij INTB1b. Ze worden hier alleen
//     als *arrangement* gebruikt (het scoreboard heeft geen andere schrijfweg);
//     hun eigen contract wordt hier niet geassserteerd.
//   * De overige dertien methoden zijn volledig gedekt op vier categorieën:
//     happy path, ontbrekend record, isolatie tussen rooms, en geen gedeelde
//     referenties.
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
  if (typeof describe.skip !== 'function') {
    throw new TypeError('runDataStoreConformance: `describe` moet een `.skip` hebben — het INTB-1-blok hoort overgeslagen te worden, niet gedraaid');
  }
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
    // Room: loadRoom, saveRoom, loadRoomByCode, loadRoomByInviteId
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
        assertIsNull(await store.loadRoomByCode('ZZZ999'), 'loadRoomByCode van een onbekende code');
      }));

      it('een onbekend invite-id levert null op', () => withStore(async (store) => {
        await store.saveRoom(makeRoom());
        assertIsNull(await store.loadRoomByInviteId('invite_bestaat_niet'), 'loadRoomByInviteId van een onbekend invite-id');
      }));

      it('dezelfde room is langs drie ingangen vindbaar: id, join-code en invite-id', () => withStore(async (store) => {
        const room = makeRoom();
        await store.saveRoom(room);

        assert.deepStrictEqual(await store.loadRoomByCode('AAA111'), room);
        assert.deepStrictEqual(await store.loadRoomByInviteId('invite_a'), room);
        assert.deepStrictEqual(await store.loadRoom('room_a'), room);
      }));

      it('opnieuw opslaan onder hetzelfde id vervangt het document in plaats van er een tweede naast te zetten', () => withStore(async (store) => {
        await store.saveRoom(makeRoom({ phase: 'LOBBY', locked: false }));
        await store.saveRoom(makeRoom({ phase: 'COUNTDOWN', locked: true }));

        const loaded = await store.loadRoom('room_a');
        assert.strictEqual(loaded.phase, 'COUNTDOWN');
        assert.strictEqual(loaded.locked, true);
      }));

      it('twee rooms met een eigen code en invite-id lekken niet naar elkaar', () => withStore(async (store) => {
        const roomA = makeRoom();
        const roomB = makeRoom({
          id: 'room_b',
          code: 'BBB222',
          inviteId: 'invite_b',
          hostSessionIds: ['session_host_b'],
        });
        await store.saveRoom(roomA);
        await store.saveRoom(roomB);

        assert.deepStrictEqual(await store.loadRoom('room_a'), roomA);
        assert.deepStrictEqual(await store.loadRoom('room_b'), roomB);
        assert.deepStrictEqual(await store.loadRoomByCode('AAA111'), roomA);
        assert.deepStrictEqual(await store.loadRoomByCode('BBB222'), roomB);
        assert.deepStrictEqual(await store.loadRoomByInviteId('invite_a'), roomA);
        assert.deepStrictEqual(await store.loadRoomByInviteId('invite_b'), roomB);
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

      it('ook de room die via code of invite-id is teruggelezen is losgekoppeld van de opslag', () => withStore(async (store) => {
        // Apart van de test hierboven: een adapter mag de drie leeswegen los
        // implementeren, dus mag "geen gedeelde referenties" niet alleen langs
        // loadRoom worden bewezen.
        await store.saveRoom(makeRoom());

        const viaCode = await store.loadRoomByCode('AAA111');
        viaCode.phase = 'FINISHED';
        viaCode.config.totalRounds = 999;

        const viaInvite = await store.loadRoomByInviteId('invite_a');
        assert.deepStrictEqual(viaInvite, makeRoom());
        viaInvite.hostSessionIds.push('session_indringer');

        assert.deepStrictEqual(await store.loadRoomByCode('AAA111'), makeRoom());
        assert.deepStrictEqual(await store.loadRoomByInviteId('invite_a'), makeRoom());
        assert.deepStrictEqual(await store.loadRoom('room_a'), makeRoom());
      }));
    });

    // ------------------------------------------------------------------
    // Session: loadSession, saveSession
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
    // Alleen de LEESKANT hoort hier. `saveRound` valt onder INTB-1 en wordt
    // uitsluitend als arrangement gebruikt: geen enkele assertie hieronder legt
    // zijn gedrag vast (de fake leidt roomId af met een scan over alle matches
    // en eist dat de match al is opgeslagen — precies wat INTB-1 wil
    // wegnemen). Zodra `saveRound(roomId, round)` bestaat, verandert alleen de
    // arrangement-regel, niet de verwachting.
    // ------------------------------------------------------------------
    describe('Round (leeskant)', () => {
      it('een opgeslagen ronde komt veld voor veld ongewijzigd terug op room, match en ronde-id', () => withStore(async (store) => {
        const round = makeRound();
        await store.saveMatch(makeMatch());
        await store.saveRound(round); // arrangement, geen contract — zie INTB-1

        assert.deepStrictEqual(await store.loadRound('room_a', 'match_1', 'round_1'), round);
      }));

      it('een teruggelezen ronde draagt geen countdownEndsAt', () => withStore(async (store) => {
        // DECISIONS #16, zie de gelijknamige Match-test.
        await store.saveMatch(makeMatch());
        await store.saveRound(makeRound());
        const loaded = await store.loadRound('room_a', 'match_1', 'round_1');
        assert.ok(
          !Object.prototype.hasOwnProperty.call(loaded, 'countdownEndsAt'),
          'een persistente Round hoort geen countdownEndsAt te dragen (DECISIONS #16)'
        );
      }));

      it('een ronde die nooit is opgeslagen levert null op', () => withStore(async (store) => {
        await store.saveMatch(makeMatch());
        await store.saveRound(makeRound());
        assertIsNull(await store.loadRound('room_a', 'match_1', 'round_bestaat_niet'), 'loadRound van een onbekend ronde-id');
      }));

      it('een bestaande ronde is onvindbaar onder de verkeerde match of de verkeerde room', () => withStore(async (store) => {
        await store.saveMatch(makeMatch());
        await store.saveRound(makeRound());

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
        await store.saveRound(roundA);
        await store.saveRound(roundB);

        assert.deepStrictEqual(await store.loadRound('room_a', 'match_a', 'round_1'), roundA);
        assert.deepStrictEqual(await store.loadRound('room_b', 'match_b', 'round_1'), roundB);
      }));

      it('het aanpassen van een teruggelezen ronde raakt de opslag niet, tot in het geneste antwoord en de payload', () => withStore(async (store) => {
        await store.saveMatch(makeMatch());
        await store.saveRound(makeRound());

        const loaded = await store.loadRound('room_a', 'match_1', 'round_1');
        loaded.status = 'ENDED';
        loaded.correctAnswer.optionId = 'be';
        loaded.publicQuestionPayload.optionIso2s.push('es');
        loaded.validOptionIds.push('es');

        assert.deepStrictEqual(await store.loadRound('room_a', 'match_1', 'round_1'), makeRound());
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
    // Karakterisatie: VASTGELEGD GEDRAG, GEEN BRONEIS
    //
    // Alles hieronder beschrijft wat de huidige implementatie DOET, niet wat
    // een adapter MOET doen. Elk item wacht op een besluit (HANDOFF-INTB.md).
    // Slaagt een nieuwe adapter hier níet, lees dat dan als "het besluit is
    // genomen en het gedrag is gecorrigeerd" — pas de test dan aan in plaats
    // van de adapter. Ze staan bewust apart van de contracttests hierboven,
    // zodat het verschil zichtbaar blijft.
    // ------------------------------------------------------------------
    describe('karakterisatie — vastgelegd gedrag, geen broneis', () => {
      it('na een hercodering van de room blijft de OUDE join-code naar diezelfde room wijzen', () => withStore(async (store) => {
        // Geen broneis: dit is de lookup-index die niet wordt opgeruimd. Zodra
        // INTB-2 (claimGameCode/releaseGameCode) er is, hoort de oude code
        // vrijgegeven te worden en hoort deze lookup null te geven.
        await store.saveRoom(makeRoom({ code: 'AAA111' }));
        await store.saveRoom(makeRoom({ code: 'CCC333' }));

        assert.deepStrictEqual(await store.loadRoomByCode('CCC333'), makeRoom({ code: 'CCC333' }));

        const viaOldCode = await store.loadRoomByCode('AAA111');
        assert.notStrictEqual(viaOldCode, null, 'vandaag blijft de oude code hangen');
        assert.strictEqual(viaOldCode.id, 'room_a');
        assert.strictEqual(viaOldCode.code, 'CCC333', 'de oude code levert het NIEUWE document op — de index is stale, het document niet');
      }));

      it('na een nieuw invite-id blijft het OUDE invite-id naar diezelfde room wijzen', () => withStore(async (store) => {
        // Zelfde mechanisme als hierboven, tweede index. Zie het voorgestelde
        // HANDOFF-item over het opruimen van room-indexen.
        await store.saveRoom(makeRoom({ inviteId: 'invite_a' }));
        await store.saveRoom(makeRoom({ inviteId: 'invite_a2' }));

        const viaOldInvite = await store.loadRoomByInviteId('invite_a');
        assert.notStrictEqual(viaOldInvite, null, 'vandaag blijft het oude invite-id hangen');
        assert.strictEqual(viaOldInvite.inviteId, 'invite_a2');
      }));

      it('twee rooms die hetzelfde match-id gebruiken delen één ranglijst', () => withStore(async (store) => {
        // INTB-3: de fake keyt het scoreboard op alleen matchId en negeert de
        // roomId-parameter, terwijl scoreboardKey(roomId, matchId) er wél op
        // keyt. Ofwel matchId is globaal uniek en de parameter verdwijnt,
        // ofwel de fake moet op beide keyen. Tot dat besluit legt deze test
        // alleen vast wat er nu gebeurt.
        await store.savePlayer(makePlayer({ id: 'player_1', roomId: 'room_a', sessionId: 'session_1' }));
        await store.savePlayer(makePlayer({ id: 'player_2', roomId: 'room_b', sessionId: 'session_2' }));
        await scoreOne(store, { roomId: 'room_a', matchId: 'match_gedeeld', playerId: 'player_1', score: 100, actionId: 'action_1', roundId: 'round_1' });
        await scoreOne(store, { roomId: 'room_b', matchId: 'match_gedeeld', playerId: 'player_2', score: 700, actionId: 'action_2', roundId: 'round_1' });

        const beide = [
          { playerId: 'player_2', score: 700 },
          { playerId: 'player_1', score: 100 },
        ];
        assert.deepStrictEqual(await store.getScoreboardTop('room_a', 'match_gedeeld', 10), beide);
        assert.deepStrictEqual(await store.getScoreboardTop('room_b', 'match_gedeeld', 10), beide);
      }));
    });

    // ------------------------------------------------------------------
    // UITGESLOTEN — wacht op HANDOFF-item INTB-1
    //
    // `saveRound`, `loadAnswer` en `loadActionCacheEntry` krijgen geen roomId
    // mee, terwijl server/data/redis-keys.js dat voor alle drie de sleutels
    // nodig heeft (roundKey/answersKey/actionCacheKey). Ze zijn dus niet tegen
    // Redis implementeerbaar, en hun huidige gedrag hier vastleggen zou een
    // bekende fout tot norm promoveren: de latere correctie wordt dan een
    // testbreuk in plaats van een verbetering.
    //
    // WAT ER MOET GEBEUREN voordat dit blok meedoet — de poortsignaturen
    // verbreden tot:
    //
    //     saveRound(roomId, round)
    //     loadAnswer(roomId, matchId, roundId, playerId)
    //     loadActionCacheEntry(roomId, actionId)
    //
    // en in de fake de answers en de action-cache werkelijk room-scoped maken
    // (nu globale Maps — precies waarom het gat onzichtbaar bleef). Daarna:
    // haal `.skip` weg, hang dit blok aan de vier categorieën van de rest van
    // deze suite, en schrap deze noot.
    //
    // De testbodies hieronder zijn geschreven tégen de verbrede signaturen en
    // falen dus tot INTB-1 is doorgevoerd. Dat is de bedoeling: ze zijn de
    // acceptatietest van dat item, niet dood commentaar.
    // ------------------------------------------------------------------
    describe.skip('INTB-1 — uitgesloten tot de drie signaturen roomId dragen', () => {
      it('een ronde wordt weggeschreven onder de room die de aanroeper meegeeft, niet onder een geraden room', () => withStore(async (store) => {
        const round = makeRound();
        await store.saveRound('room_a', round); // verbrede signatuur

        assert.deepStrictEqual(await store.loadRound('room_a', 'match_1', 'round_1'), round);
        assertIsNull(await store.loadRound('room_b', 'match_1', 'round_1'), 'de ronde hoort niet in een andere room te staan');
      }));

      it('twee rooms met hetzelfde match-id houden hun rondes gescheiden', () => withStore(async (store) => {
        // Vandaag onmogelijk te arrangeren: saveRound leidt roomId af met een
        // scan over alle matches en pakt de eerste treffer.
        await store.saveRound('room_a', makeRound({ id: 'round_1', matchId: 'match_gedeeld' }));
        await store.saveRound('room_b', makeRound({ id: 'round_1', matchId: 'match_gedeeld', questionKey: 'capitals_mc:be', gameType: 'capitals_mc' }));

        assert.strictEqual((await store.loadRound('room_a', 'match_gedeeld', 'round_1')).questionKey, 'flags_mc:nl');
        assert.strictEqual((await store.loadRound('room_b', 'match_gedeeld', 'round_1')).questionKey, 'capitals_mc:be');
      }));

      it('een antwoord is alleen leesbaar binnen zijn eigen room en match', () => withStore(async (store) => {
        const answer = makeAnswer();
        await store.savePlayer(makePlayer());
        await scoreOne(store, { roomId: 'room_a', matchId: 'match_1', playerId: 'player_1', score: 120, actionId: 'action_1', roundId: 'round_1' });

        assert.deepStrictEqual(await store.loadAnswer('room_a', 'match_1', 'round_1', 'player_1'), answer); // verbrede signatuur
        assertIsNull(await store.loadAnswer('room_b', 'match_1', 'round_1', 'player_1'), 'het antwoord hoort niet vanuit een andere room leesbaar te zijn');
        assertIsNull(await store.loadAnswer('room_a', 'match_1', 'round_1', 'player_onbekend'), 'een speler zonder antwoord hoort null op te leveren');
      }));

      it('een action-cache-item is alleen leesbaar binnen zijn eigen room', () => withStore(async (store) => {
        await store.savePlayer(makePlayer());
        await scoreOne(store, { roomId: 'room_a', matchId: 'match_1', playerId: 'player_1', score: 120, actionId: 'action_1', roundId: 'round_1' });

        assert.deepStrictEqual(await store.loadActionCacheEntry('room_a', 'action_1'), { actionId: 'action_1', ack: { status: 'accepted' } }); // verbrede signatuur
        assertIsNull(await store.loadActionCacheEntry('room_b', 'action_1'), 'het cache-item hoort niet vanuit een andere room leesbaar te zijn');
        assertIsNull(await store.loadActionCacheEntry('room_a', 'action_onbekend'), 'een onbekend actie-id hoort null op te leveren');
      }));
    });
  });
}
