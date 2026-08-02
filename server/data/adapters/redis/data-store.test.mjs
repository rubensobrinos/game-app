// Richt de DataStore-conformance-suite op de Redis-adapter, en test daarnaast
// wat die suite per definitie niet kan zien: sleutels, TTL en de leeskanten
// waarvan de schrijfweg op INTB2c wacht.
//
// TWEE DINGEN VOORAF, allebei belangrijk om het faalrapport goed te lezen.
//
// 1. DE SUITE IS ONGEWIJZIGD. `data-store-conformance.mjs` is exact dezelfde
//    testcode als tegen de in-memory fake; er is niets overgeslagen, niets
//    gefilterd en niets afgezwakt. Dat is de hele bedoeling van een
//    conformance-suite: hem aanpassen tot hij groen wordt is hetzelfde als hem
//    weggooien.
//
// 2. NEGENTIEN VAN DE CONFORMANCE-TESTS ZIJN ROOD, en dat is geen adapterfout.
//    `saveAcceptedAnswerAtomically` (INTB2c) is bewust niet gebouwd — zie de
//    kop van `data-store.mjs`. De suite gebruikt die methode bovendien als
//    ARRANGEMENT voor het scoreboard, het Answer en de action-cache: die
//    hebben op deze poort geen andere schrijfweg (de suite zegt dat zelf, bij
//    `scoreOne`). Rood dus:
//      * describe 'saveAcceptedAnswerAtomically'                    8 tests
//      * describe 'saveAcceptedAnswerAtomically — INTB-4'           3 tests
//      * describe 'getScoreboardTop'                6 van de 7 tests
//      * describe 'INTB-1 …'                        2 van de 5 tests
//    Elke faalregel wijst terug naar `NotImplementedError` met `INTB2c` in de
//    melding; komt er ooit een ANDERE fout uit deze blokken, dan is dat wél een
//    adapterfout.
//
//    HET BLOK `setRoomAndMatchPhaseAtomically` (8 tests) STOND HIER OOK, en is
//    met INTB2d groen geworden. De adapter-eigen tests daarvoor staan in
//    sectie 6b hieronder.
//
//    Het leesgedrag dat daardoor onbewezen zou blijven — `getScoreboardTop`,
//    `loadAnswer`, `loadActionCacheEntry` — staat hieronder alsnog getest, met
//    een arrangement dat rechtstreeks in Redis schrijft. Dat is geen omweg om
//    de blokkade heen: het bouwt niets van INTB2c na, het zet alleen de
//    sleutels klaar die daar al vastliggen.
//
//    `loadSessionByTokenHash` (DM14/§10) is tijdens dit werk aan de poort
//    toegevoegd en is een DERDE, andersoortige blokkade: er bestaat geen
//    Redis-sleutel voor een tokenHash. De conformance-suite kent die methode
//    nog niet, dus hij veroorzaakt daar geen rood — alleen
//    `assertImplementsDataStore` ziet hem, en die slaagt omdat de stub een
//    functie is. Zie het blok "bewust niet geïmplementeerd" onderaan.
//
// TESTINSTANTIE: uitsluitend `redis://127.0.0.1:6380` via `test-redis.mjs`.
// Anders dan bij INTB2a SCHRIJVEN deze tests wél, dus draait alles in de
// per-proces gekozen database-index (8..15, nooit 0) en ruimt elke test na
// zichzelf op. Er staat daarom precies één Redis-schrijvend testbestand in deze
// map: twee bestanden zouden in twee processen kunnen landen die dezelfde
// index kiezen, en dan flusht de een de fixtures van de ander weg.

import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { assertImplementsDataStore } from '../../repository.js';
import {
  actionCacheKey,
  answersKey,
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
import { ROOM_TTL_SECONDS } from '../../ttl.js';
import { assertAnswerShape } from '../../types/answer.js';
import { runDataStoreConformance } from '../data-store-conformance.mjs';
import { createRedisConnection } from './connection.mjs';
import { encodeDocument } from './documents.mjs';
import { createRedisDataStore, NotImplementedError, UNIMPLEMENTED_METHODS } from './data-store.mjs';
import { TEST_REDIS_DATABASE, probeTestRedis, testConnectionConfig } from './test-redis.mjs';

const probe = await probeTestRedis();

if (!probe.ok) {
  // Nooit stilzwijgend groen: als de testinstantie er niet is, staat de reden
  // in de skipmelding.
  describe('Redis-adapter (data-store.mjs)', { skip: probe.reason }, () => {});
} else {
  // Verdediging in de diepte bovenop `assertTestInstance` in testConnectionConfig():
  // hieronder wordt geFLUSHDB'd, en dat mag nooit in db 0 gebeuren.
  assert.ok(TEST_REDIS_DATABASE >= 8, `testdatabase moet 8..15 zijn, kreeg ${TEST_REDIS_DATABASE}`);

  const connection = createRedisConnection(testConnectionConfig());
  await connection.connect();
  after(async () => {
    await connection.getClient().flushDb();
    await connection.close();
  });

  const client = () => connection.getClient();
  const store = createRedisDataStore({ connection });

  async function fresh() {
    await client().flushDb();
    return store;
  }

  // ------------------------------------------------------------------
  // 1. De conformance-suite, ongewijzigd.
  // ------------------------------------------------------------------
  runDataStoreConformance({
    describe,
    name: `Redis-adapter (echte Redis, db ${TEST_REDIS_DATABASE})`,
    async createStore() {
      await client().flushDb();
      const created = createRedisDataStore({ connection });
      assertImplementsDataStore(created);
      return created;
    },
    async teardown() {
      await client().flushDb();
    },
  });

  // ------------------------------------------------------------------
  // 2. Fixtures voor de adapter-eigen tests. Bewust dezelfde stijl als de
  //    conformance-suite: vaste literals, geen klok, geen willekeur.
  // ------------------------------------------------------------------

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
      id: 'room_a', code: 'AAA111', inviteId: 'invite_a', phase: 'LOBBY',
      createdAt: T, lastActivityAt: T, hostSessionIds: ['session_host_a'], locked: false,
      config: makeConfig(), currentMatchId: null, ...overrides,
    };
  }

  function makePlayer(overrides = {}) {
    return {
      id: 'player_1', roomId: 'room_a', sessionId: 'session_1', displayName: null,
      generatedName: 'Blauwe Vos', effectiveName: 'Blauwe Vos', nameSource: 'generated',
      teamId: null, score: 0, correctCount: 0, correctResponseTimeMsTotal: 0, connected: true,
      eligibleFromRound: 1, joinedAt: T, left: false, kicked: false, ...overrides,
    };
  }

  function makeSession(overrides = {}) {
    return {
      id: 'session_1', roomId: 'room_a', roles: ['host'], playerId: null, tokenHash: 'hash_1',
      createdAt: T, lastSeenAt: T, connectedSocketIds: [], revoked: false, ...overrides,
    };
  }

  function makeMatch(overrides = {}) {
    return {
      id: 'match_1', roomId: 'room_a', sequence: 1, phase: 'ROUND_ACTIVE', startedAt: T,
      finishedAt: null, roundIndex: 0, roundIds: ['round_1'], usedQuestionKeys: ['flags_mc:nl'],
      previousMatchQuestionKeys: [], pausedState: null, contentVersion: '2026.08.1',
      rendererVersion: 'flag-renderer-1', ...overrides,
    };
  }

  function makeRound(overrides = {}) {
    return {
      id: 'round_1', matchId: 'match_1', gameType: 'flags_mc', questionKey: 'flags_mc:nl',
      publicQuestionPayload: { promptKey: 'btnWhichFlag', optionIso2s: ['nl', 'be', 'fr', 'de'] },
      correctAnswer: { optionId: 'nl' }, validOptionIds: ['nl', 'be', 'fr', 'de'],
      startsAt: T, endsAt: T + 15000, status: 'ACTIVE', ...overrides,
    };
  }

  function makeAnswer(overrides = {}) {
    const answer = {
      roundId: 'round_1', playerId: 'player_1', actionId: 'action_1', answer: { optionId: 'nl' },
      receivedAt: T + 2000, responseTimeMs: 2000, correct: true, points: 120, ...overrides,
    };
    assertAnswerShape(answer);
    return answer;
  }

  /** Legt een Answer neer op precies de sleutel die redis-keys.js voorschrijft. */
  async function arrangeAnswer(roomId, matchId, answer) {
    await client().hSet(answersKey(roomId, matchId, answer.roundId), answer.playerId, encodeDocument('answer', answer));
  }

  /** Idem voor een action-cache-item. */
  async function arrangeActionCacheEntry(roomId, entry) {
    await client().hSet(actionCacheKey(roomId), entry.actionId, encodeDocument('action-cache-entry', entry));
  }

  /** Idem voor het scoreboard (sorted set, geen envelop). */
  async function arrangeScores(roomId, matchId, scores) {
    await client().zAdd(
      scoreboardKey(roomId, matchId),
      Object.entries(scores).map(([playerId, score]) => ({ score, value: playerId }))
    );
  }

  const LOCATOR_CLAIM = { roomId: 'room_a', code: 'AAA111', inviteHash: 'invitehash_a', ttlSeconds: 3600 };

  // ------------------------------------------------------------------
  // 3. Opslagvorm: sleutels en envelop.
  //
  // De conformance-suite kan hier niets over zeggen — die ziet alleen wat er
  // uit de poort komt. Een adapter die alles onder één sleutel propt komt daar
  // doorheen en is in productie onbruikbaar.
  // ------------------------------------------------------------------
  describe('Redis-adapter — opslagvorm', () => {
    it('een room staat onder room:{roomId} als versie-envelop, niet als kaal document', async () => {
      await fresh();
      await store.saveRoom(makeRoom());

      const raw = await client().get(roomKey('room_a'));
      assert.strictEqual(raw, await client().get('room:room_a'), 'de sleutel komt uit redis-keys.js');
      const envelope = JSON.parse(raw);
      assert.deepStrictEqual(Object.keys(envelope).sort(), ['documentType', 'payload', 'schemaVersion']);
      assert.strictEqual(envelope.documentType, 'room');
      assert.strictEqual(envelope.schemaVersion, 1);
      assert.strictEqual(envelope.payload.id, 'room_a');
    });

    it('elk documenttype staat op zijn eigen sleutel uit redis-keys.js', async () => {
      await fresh();
      await store.saveRoom(makeRoom());
      await store.saveSession(makeSession());
      await store.savePlayer(makePlayer());
      await store.saveMatch(makeMatch());
      await store.saveRound('room_a', makeRound());

      assert.strictEqual(JSON.parse(await client().get(roomKey('room_a'))).documentType, 'room');
      assert.strictEqual(
        JSON.parse(await client().hGet(roomSessionsKey('room_a'), 'session_1')).documentType, 'session'
      );
      assert.strictEqual(
        JSON.parse(await client().hGet(roomPlayersKey('room_a'), 'player_1')).documentType, 'player'
      );
      assert.strictEqual(JSON.parse(await client().get(matchKey('room_a', 'match_1'))).documentType, 'match');
      assert.strictEqual(
        JSON.parse(await client().get(roundKey('room_a', 'match_1', 'round_1'))).documentType, 'round'
      );
    });

    it('de code-index bevat het roomId en de room staat in rooms:active', async () => {
      await fresh();
      await store.saveRoom(makeRoom());

      assert.strictEqual(await client().get(roomCodeLookupKey('AAA111')), 'room_a');
      assert.ok(await client().sIsMember(roomsActiveKey(), 'room_a'));
    });

    it('een geclaimde locator staat als roomId onder beide indexsleutels', async () => {
      await fresh();
      await store.claimRoomLocatorsAtomically(LOCATOR_CLAIM);

      assert.strictEqual(await client().get(roomCodeLookupKey('AAA111')), 'room_a');
      assert.strictEqual(await client().get(roomInviteLookupKey('invitehash_a')), 'room_a');
    });

    it('een ongeldig document wordt geweigerd vóór het de opslag raakt', async () => {
      // documents.mjs valideert bewust geen vorm ("die controle hoort bij de
      // poortmethode in INTB2b"). Dit is die controle: een Room zonder code
      // hoort niet als half document in Redis te belanden.
      await fresh();
      await assert.rejects(() => store.saveRoom(makeRoom({ code: '' })), TypeError);
      assert.strictEqual(await client().get(roomKey('room_a')), null, 'er mag niets zijn weggeschreven');
    });
  });

  // ------------------------------------------------------------------
  // 4. TTL. Onzichtbaar voor de conformance-suite en het duurste om fout te
  //    hebben: een room die middenin een potje verdampt.
  // ------------------------------------------------------------------
  describe('Redis-adapter — TTL', () => {
    /** Zet de TTL van een sleutel kunstmatig laag, zodat een refresh zichtbaar wordt. */
    async function expireSoon(...keys) {
      for (const key of keys) {
        // node-redis geeft hier 1/0 terug, niet true/false — vandaar ok() en
        // geen strictEqual(true).
        assert.ok(await client().expire(key, 5), `sleutel ${key} bestaat niet`);
      }
    }

    it('saveRoom zet de room-TTL uit ttl.js op de roomkern én de code-index', async () => {
      await fresh();
      await store.saveRoom(makeRoom());

      assert.strictEqual(await client().ttl(roomKey('room_a')), ROOM_TTL_SECONDS);
      assert.strictEqual(await client().ttl(roomCodeLookupKey('AAA111')), ROOM_TTL_SECONDS);
    });

    it('elke schrijfactie ververst de TTL van de roomkern, ook als ze de room niet aanraakt', async () => {
      // Dit is de bevinding uit DATA-MODEL.md §TTL in testvorm: "TTL wordt
      // ververst op roomkern, indexes en relevante matchkeys". Een adapter die
      // alleen de sleutel aanraakt die hij schrijft, laat een room die nog
      // gespeeld wordt gewoon verlopen.
      for (const [wat, schrijf] of [
        ['saveSession', () => store.saveSession(makeSession())],
        ['savePlayer', () => store.savePlayer(makePlayer())],
        ['saveMatch', () => store.saveMatch(makeMatch())],
        ['saveRound', async () => { await store.saveMatch(makeMatch()); await store.saveRound('room_a', makeRound()); }],
      ]) {
        await fresh();
        await store.saveRoom(makeRoom());
        await expireSoon(roomKey('room_a'));

        await schrijf();

        assert.strictEqual(
          await client().ttl(roomKey('room_a')),
          ROOM_TTL_SECONDS,
          `${wat} hoort de TTL van de roomkern te verversen`
        );
      }
    });

    it('elke schrijfactie ververst ook de room-brede sleutels van de andere documenttypes', async () => {
      await fresh();
      await store.saveRoom(makeRoom());
      await store.saveSession(makeSession());
      await store.savePlayer(makePlayer());
      await expireSoon(roomSessionsKey('room_a'), roomPlayersKey('room_a'));

      await store.saveMatch(makeMatch());

      assert.strictEqual(await client().ttl(roomSessionsKey('room_a')), ROOM_TTL_SECONDS);
      assert.strictEqual(await client().ttl(roomPlayersKey('room_a')), ROOM_TTL_SECONDS);
    });

    it('de sleutel die geschreven wordt draagt zelf ook de room-TTL', async () => {
      await fresh();
      await store.saveRoom(makeRoom());
      await store.saveSession(makeSession());
      await store.savePlayer(makePlayer());
      await store.saveMatch(makeMatch());
      await store.saveRound('room_a', makeRound());

      for (const key of [
        roomSessionsKey('room_a'),
        roomPlayersKey('room_a'),
        matchKey('room_a', 'match_1'),
        roundKey('room_a', 'match_1', 'round_1'),
      ]) {
        assert.strictEqual(await client().ttl(key), ROOM_TTL_SECONDS, `TTL van ${key}`);
      }
    });

    it('geen enkele schrijfactie laat een sleutel zonder TTL achter (behalve rooms:active)', async () => {
      // Een sleutel zonder TTL is een lek dat pas maanden later opvalt: de room
      // is weg, de data blijft. `rooms:active` is de bewuste uitzondering — een
      // set-lid kan geen eigen TTL dragen; het opruimen daarvan is de
      // periodieke cleanup uit ttl.js (open punt 2), niet iets dat een
      // schrijfactie kan doen.
      await fresh();
      await store.saveRoom(makeRoom());
      await store.saveSession(makeSession());
      await store.savePlayer(makePlayer());
      await store.saveMatch(makeMatch());
      await store.saveRound('room_a', makeRound());
      await store.claimRoomLocatorsAtomically(LOCATOR_CLAIM);

      const zonderTtl = [];
      for (const key of await client().keys('*')) {
        if ((await client().ttl(key)) < 0) zonderTtl.push(key);
      }
      assert.deepStrictEqual(zonderTtl, [roomsActiveKey()]);
    });

    it('claimRoomLocatorsAtomically gebruikt de TTL van de claim, niet de room-TTL', async () => {
      await fresh();
      await store.claimRoomLocatorsAtomically(LOCATOR_CLAIM);

      assert.strictEqual(await client().ttl(roomCodeLookupKey('AAA111')), 3600);
      assert.strictEqual(await client().ttl(roomInviteLookupKey('invitehash_a')), 3600);
    });

    it('refreshRoomLocators verlengt beide locators én de roomkern', async () => {
      // De conformance-suite legt alleen het contract vast ("de claim blijft
      // staan"); of er daadwerkelijk iets verlengd wordt kan zij niet zien.
      await fresh();
      await store.saveRoom(makeRoom());
      await store.claimRoomLocatorsAtomically(LOCATOR_CLAIM);
      await expireSoon(roomCodeLookupKey('AAA111'), roomInviteLookupKey('invitehash_a'), roomKey('room_a'));

      await store.refreshRoomLocators({ ...LOCATOR_CLAIM, ttlSeconds: 7200 });

      assert.strictEqual(await client().ttl(roomCodeLookupKey('AAA111')), 7200);
      assert.strictEqual(await client().ttl(roomInviteLookupKey('invitehash_a')), 7200);
      assert.strictEqual(await client().ttl(roomKey('room_a')), ROOM_TTL_SECONDS);
    });

    it('een mislukte refresh verlengt niets', async () => {
      await fresh();
      await store.claimRoomLocatorsAtomically(LOCATOR_CLAIM);
      await expireSoon(roomCodeLookupKey('AAA111'));

      await assert.rejects(
        () => store.refreshRoomLocators({ ...LOCATOR_CLAIM, roomId: 'room_indringer', ttlSeconds: 7200 }),
        RangeError
      );
      assert.ok((await client().ttl(roomCodeLookupKey('AAA111'))) <= 5, 'de TTL hoort onaangeraakt te zijn');
    });
  });

  // ------------------------------------------------------------------
  // 4b. rotateRoomLocators (DM16/§9).
  //
  // Tijdens dit werk aan de poort toegevoegd; de conformance-suite kent hem nog
  // niet, dus staat het volledige contract hier. Alles-of-niets: bij een
  // conflict blijven de OUDE locators geldig (een room die via geen enkele code
  // bereikbaar is, is erger dan een rotatie die nog niet gelukt is).
  // ------------------------------------------------------------------
  describe('Redis-adapter — rotateRoomLocators', () => {
    const ROTATION = {
      roomId: 'room_a', oldCode: 'AAA111', oldInviteHash: 'invitehash_a',
      newCode: 'CCC333', newInviteHash: 'invitehash_a2', ttlSeconds: 1800,
    };

    async function arrangeClaimed() {
      await fresh();
      await store.saveRoom(makeRoom());
      await store.claimRoomLocatorsAtomically(LOCATOR_CLAIM);
    }

    it('een geslaagde rotatie maakt de nieuwe locators geldig en de oude dood', async () => {
      await arrangeClaimed();

      assert.deepStrictEqual(await store.rotateRoomLocators(ROTATION), { ok: true });

      assert.strictEqual((await store.loadRoomByCode('CCC333')).id, 'room_a');
      assert.strictEqual(await client().get(roomInviteLookupKey('invitehash_a2')), 'room_a');
      assert.strictEqual(await store.loadRoomByCode('AAA111'), null, 'de ingetrokken join-code');
      assert.strictEqual(await store.loadRoomByInviteHash('invitehash_a'), null, 'de ingetrokken invite-hash');
      assert.strictEqual(await client().ttl(roomCodeLookupKey('CCC333')), 1800);
      assert.strictEqual(await client().ttl(roomInviteLookupKey('invitehash_a2')), 1800);
    });

    it('roteert alleen de invite, dan blijft de code onafgebroken geldig', async () => {
      // Het scherpste geval: een implementatie die eerst wist en dan zet, laat
      // de code hier heel even verdwijnen — of, erger, wist hem en zet hem
      // daarna niet terug.
      await arrangeClaimed();

      assert.deepStrictEqual(
        await store.rotateRoomLocators({ ...ROTATION, newCode: 'AAA111' }),
        { ok: true }
      );

      assert.strictEqual((await store.loadRoomByCode('AAA111')).id, 'room_a');
      assert.strictEqual(await store.loadRoomByInviteHash('invitehash_a'), null);
      assert.strictEqual(await client().get(roomInviteLookupKey('invitehash_a2')), 'room_a');
    });

    it('een bezette nieuwe code laat de oude locators ongemoeid', async () => {
      await arrangeClaimed();
      await store.claimRoomLocatorsAtomically({
        roomId: 'room_b', code: 'CCC333', inviteHash: 'invitehash_b', ttlSeconds: 3600,
      });

      assert.deepStrictEqual(await store.rotateRoomLocators(ROTATION), { ok: false, conflict: 'code' });

      assert.strictEqual((await store.loadRoomByCode('AAA111')).id, 'room_a', 'de oude code blijft geldig');
      assert.strictEqual((await store.loadRoomByInviteHash('invitehash_a')).id, 'room_a');
      assert.strictEqual(await client().get(roomCodeLookupKey('CCC333')), 'room_b', 'de zittende claim blijft van room_b');
      assert.strictEqual(await client().get(roomInviteLookupKey('invitehash_a2')), null, 'geen halve rotatie');
    });

    it('een bezette nieuwe invite-hash laat de oude locators ongemoeid', async () => {
      await arrangeClaimed();
      await store.claimRoomLocatorsAtomically({
        roomId: 'room_b', code: 'BBB222', inviteHash: 'invitehash_a2', ttlSeconds: 3600,
      });

      assert.deepStrictEqual(await store.rotateRoomLocators(ROTATION), { ok: false, conflict: 'inviteHash' });

      assert.strictEqual((await store.loadRoomByCode('AAA111')).id, 'room_a');
      assert.strictEqual((await store.loadRoomByInviteHash('invitehash_a')).id, 'room_a');
      assert.strictEqual(await client().get(roomCodeLookupKey('CCC333')), null, 'de vrije helft mag niet alvast geclaimd zijn');
    });

    it('roteren wat je niet bezit werpt RangeError en verandert niets', async () => {
      await arrangeClaimed();

      await assert.rejects(() => store.rotateRoomLocators({ ...ROTATION, roomId: 'room_indringer' }), RangeError);
      await assert.rejects(() => store.rotateRoomLocators({ ...ROTATION, oldCode: 'ZZZ999' }), RangeError);
      await assert.rejects(() => store.rotateRoomLocators({ ...ROTATION, oldInviteHash: 'invitehash_nooit' }), RangeError);

      assert.strictEqual((await store.loadRoomByCode('AAA111')).id, 'room_a');
      assert.strictEqual((await store.loadRoomByInviteHash('invitehash_a')).id, 'room_a');
      assert.strictEqual(await client().get(roomCodeLookupKey('CCC333')), null);
    });
  });

  // ------------------------------------------------------------------
  // 5. De drie leeskanten waarvan de schrijfweg op INTB2c wacht.
  //
  // Zonder dit blok zou het wegvallen van `saveAcceptedAnswerAtomically` acht
  // conformance-tests meenemen die over LEZEN gaan, en zou dat leesgedrag tot
  // INTB2c ongetest zijn. Het arrangement schrijft rechtstreeks op de sleutels
  // uit redis-keys.js — het bouwt niets van de atomaire operatie na.
  // ------------------------------------------------------------------
  describe('Redis-adapter — leeskant zonder poort-schrijfweg (INTB2c)', () => {
    it('getScoreboardTop staat aflopend op score en respecteert limit', async () => {
      await fresh();
      await arrangeScores('room_a', 'match_1', { player_1: 100, player_2: 300, player_3: 200 });

      assert.deepStrictEqual(await store.getScoreboardTop('room_a', 'match_1', 10), [
        { playerId: 'player_2', score: 300 },
        { playerId: 'player_3', score: 200 },
        { playerId: 'player_1', score: 100 },
      ]);
      assert.deepStrictEqual(await store.getScoreboardTop('room_a', 'match_1', 2), [
        { playerId: 'player_2', score: 300 },
        { playerId: 'player_3', score: 200 },
      ]);
    });

    it('getScoreboardTop levert een lege lijst bij een onbekende match en bij limit 0', async () => {
      await fresh();
      await arrangeScores('room_a', 'match_1', { player_1: 100 });

      assert.deepStrictEqual(await store.getScoreboardTop('room_a', 'match_bestaat_niet', 10), []);
      // ZRANGE 0 -1 zou hier ALLES teruggeven; de fake slice(0, 0) geeft niets.
      assert.deepStrictEqual(await store.getScoreboardTop('room_a', 'match_1', 0), []);
    });

    it('twee rooms met hetzelfde match-id houden gescheiden ranglijsten', async () => {
      await fresh();
      await arrangeScores('room_a', 'match_gedeeld', { player_1: 100 });
      await arrangeScores('room_b', 'match_gedeeld', { player_2: 700 });

      assert.deepStrictEqual(await store.getScoreboardTop('room_a', 'match_gedeeld', 10), [{ playerId: 'player_1', score: 100 }]);
      assert.deepStrictEqual(await store.getScoreboardTop('room_b', 'match_gedeeld', 10), [{ playerId: 'player_2', score: 700 }]);
    });

    it('het aanpassen van de teruggegeven ranglijst raakt de opslag niet', async () => {
      await fresh();
      await arrangeScores('room_a', 'match_1', { player_1: 100 });

      const listed = await store.getScoreboardTop('room_a', 'match_1', 10);
      listed[0].score = 9999;
      listed.push({ playerId: 'player_spook', score: 1 });

      assert.deepStrictEqual(await store.getScoreboardTop('room_a', 'match_1', 10), [{ playerId: 'player_1', score: 100 }]);
    });

    it('een antwoord is alleen leesbaar binnen zijn eigen room, match, ronde en speler', async () => {
      await fresh();
      const answer = makeAnswer();
      await arrangeAnswer('room_a', 'match_1', answer);

      assert.deepStrictEqual(await store.loadAnswer('room_a', 'match_1', 'round_1', 'player_1'), answer);
      assert.strictEqual(await store.loadAnswer('room_b', 'match_1', 'round_1', 'player_1'), null);
      assert.strictEqual(await store.loadAnswer('room_a', 'match_ander', 'round_1', 'player_1'), null);
      assert.strictEqual(await store.loadAnswer('room_a', 'match_1', 'round_2', 'player_1'), null);
      assert.strictEqual(await store.loadAnswer('room_a', 'match_1', 'round_1', 'player_onbekend'), null);
    });

    it('een action-cache-item is alleen leesbaar binnen zijn eigen room', async () => {
      await fresh();
      await arrangeActionCacheEntry('room_a', { actionId: 'action_1', ack: { roundId: 'round_1' } });

      assert.deepStrictEqual(await store.loadActionCacheEntry('room_a', 'action_1'), {
        actionId: 'action_1', ack: { roundId: 'round_1' },
      });
      assert.strictEqual(await store.loadActionCacheEntry('room_b', 'action_1'), null);
      assert.strictEqual(await store.loadActionCacheEntry('room_a', 'action_onbekend'), null);
    });

    it('twee lezingen van hetzelfde antwoord leveren losse documenten op', async () => {
      await fresh();
      await arrangeAnswer('room_a', 'match_1', makeAnswer());

      const first = await store.loadAnswer('room_a', 'match_1', 'round_1', 'player_1');
      first.points = 9999;
      first.answer.optionId = 'be';

      assert.deepStrictEqual(await store.loadAnswer('room_a', 'match_1', 'round_1', 'player_1'), makeAnswer());
    });
  });

  // ------------------------------------------------------------------
  // 6. listPlayers op schaal: één speler bewijst niets over een HGETALL.
  // ------------------------------------------------------------------
  describe('Redis-adapter — listPlayers', () => {
    it('vijfentwintig spelers komen allemaal terug, in welke volgorde dan ook', async () => {
      await fresh();
      const ids = Array.from({ length: 25 }, (_, index) => `player_${String(index + 1).padStart(2, '0')}`);
      for (const id of ids) {
        await store.savePlayer(makePlayer({ id, sessionId: `session_${id}` }));
      }

      const listed = await store.listPlayers('room_a');
      assert.strictEqual(listed.length, 25);
      assert.deepStrictEqual(listed.map((player) => player.id).sort(), [...ids].sort());
    });
  });

  // ------------------------------------------------------------------
  // 6b. setRoomAndMatchPhaseAtomically (INTB2d, DECISIONS #30).
  //
  // Het contract staat volledig in de conformance-suite. Hier staat wat die
  // suite per definitie niet kan zien: dat de wissel écht één Redis-opdracht
  // is, dat de TTL meebeweegt, dat de envelop het document niet vervormt, en
  // wat er van de opslag overblijft als de uitvoering wordt onderbroken.
  // ------------------------------------------------------------------
  describe('Redis-adapter — setRoomAndMatchPhaseAtomically', () => {
    async function arrangePhaseFixture() {
      await fresh();
      await store.saveRoom(makeRoom({ phase: 'LOBBY' }));
      await store.saveMatch(makeMatch({ phase: 'ROUND_ACTIVE' }));
    }

    it('ververst de room-scope, de matchkey en het scoreboard — een fasewissel is activiteit', async () => {
      await arrangePhaseFixture();
      await store.saveSession(makeSession());
      await store.savePlayer(makePlayer());
      await arrangeScores('room_a', 'match_1', { player_1: 120 });
      for (const key of [
        roomKey('room_a'), roomSessionsKey('room_a'), roomPlayersKey('room_a'),
        matchKey('room_a', 'match_1'), scoreboardKey('room_a', 'match_1'),
      ]) {
        assert.ok(await client().expire(key, 5), `sleutel ${key} bestaat niet`);
      }

      await store.setRoomAndMatchPhaseAtomically('room_a', 'match_1', 'SCOREBOARD');

      for (const key of [
        roomKey('room_a'), roomSessionsKey('room_a'), roomPlayersKey('room_a'),
        matchKey('room_a', 'match_1'), scoreboardKey('room_a', 'match_1'),
      ]) {
        assert.strictEqual(await client().ttl(key), ROOM_TTL_SECONDS, `TTL van ${key} na de fasewissel`);
      }
    });

    it('laat de envelop en de vorm van elk veld intact — ook een LEEG array blijft een array', async () => {
      // Dit is de reden dat het Lua-script de documenten NIET zelf decodeert.
      // `cjson` maakt van een lege tabel bij het terugschrijven een `{}`, dus
      // een implementatie die het JSON-werk in Lua doet, verandert
      // `previousMatchQuestionKeys: []` stilzwijgend in een object. De
      // conformance-suite ziet dat via deepStrictEqual; hier staat het op de
      // opslag zelf, zodat de oorzaak zichtbaar is en niet alleen het gevolg.
      await arrangePhaseFixture();

      await store.setRoomAndMatchPhaseAtomically('room_a', 'match_1', 'FINISHED');

      const roomEnvelope = JSON.parse(await client().get(roomKey('room_a')));
      const matchEnvelope = JSON.parse(await client().get(matchKey('room_a', 'match_1')));
      assert.deepStrictEqual(Object.keys(roomEnvelope).sort(), ['documentType', 'payload', 'schemaVersion']);
      assert.strictEqual(roomEnvelope.documentType, 'room');
      assert.strictEqual(matchEnvelope.documentType, 'match');
      assert.strictEqual(roomEnvelope.schemaVersion, 1);
      assert.strictEqual(matchEnvelope.schemaVersion, 1);
      assert.ok(Array.isArray(matchEnvelope.payload.previousMatchQuestionKeys), 'een leeg array blijft een array');
      assert.deepStrictEqual(matchEnvelope.payload.previousMatchQuestionKeys, []);
      assert.strictEqual(matchEnvelope.payload.finishedAt, null, 'null blijft null, geen weggevallen veld');
      assert.strictEqual(roomEnvelope.payload.currentMatchId, null);
      assert.deepStrictEqual(roomEnvelope.payload.config, makeConfig(), 'de geneste config blijft ongemoeid');
    });

    it('schrijft geen enkele andere sleutel dan de twee documenten', async () => {
      await arrangePhaseFixture();
      const before = (await client().keys('*')).sort();

      await store.setRoomAndMatchPhaseAtomically('room_a', 'match_1', 'PAUSED');

      assert.deepStrictEqual((await client().keys('*')).sort(), before, 'de wissel maakt geen sleutels aan');
    });

    it('een gelijktijdige schrijfactie tussen lees en wissel wordt niet overschreven — de operatie leest opnieuw', async () => {
      // De documenten worden buiten Redis omgezet (zie SET_PHASE_LUA), dus er
      // zit per definitie een lees vóór de schrijf. Zonder compare-and-set in
      // het script zou deze operatie de tussentijdse `saveRoom` hieronder
      // wegschrijven met een verouderd document — een verloren update die
      // nergens gemeld wordt. De injectie hieronder zet `locked: true` precies
      // in dat venster; overleeft die vlag de fasewissel, dan is er echt
      // opnieuw gelezen.
      await arrangePhaseFixture();

      let ingegrepen = false;
      const raced = createRedisDataStore({
        connection: {
          getClient: () => ({
            async get(key) {
              const value = await client().get(key);
              if (!ingegrepen && key === matchKey('room_a', 'match_1')) {
                ingegrepen = true;
                await store.saveRoom(makeRoom({ phase: 'LOBBY', locked: true }));
              }
              return value;
            },
            eval: (script, options) => client().eval(script, options),
          }),
        },
      });

      await raced.setRoomAndMatchPhaseAtomically('room_a', 'match_1', 'FINISHED');

      assert.strictEqual(ingegrepen, true, 'het venster is echt geraakt, anders bewijst deze test niets');
      const room = await store.loadRoom('room_a');
      assert.strictEqual(room.locked, true, 'de gelijktijdige schrijfactie mag niet zijn weggevallen');
      assert.strictEqual(room.phase, 'FINISHED');
      assert.strictEqual((await store.loadMatch('room_a', 'match_1')).phase, 'FINISHED');
    });

    it('een onderbroken uitvoering laat beide documenten oud óf beide nieuw achter — nooit één van elk', async () => {
      // DE GARANTIE DIE HIER GETEST WORDT, en vooral de garantie die hier NIET
      // getest wordt.
      //
      // Verwacht GEEN rollback. Een Lua-script draait server-side door; valt de
      // clientsocket weg terwijl het loopt, dan landt de wissel gewoon en
      // verdwijnt alleen het antwoord. De aanroeper krijgt een verbindingsfout
      // en kan uit die fout niet afleiden wat er is gebeurd — hij leest na een
      // reconnect de autoritatieve state opnieuw. Een netwerkonderbreking is
      // geen transactie-abort.
      //
      // Wat wél altijd waar is, en wat elke ronde hieronder assert:
      //   beide documenten oud óf beide nieuw, nooit één oud en één nieuw.
      //
      // De onderbreking is een echte: een tweede verbinding doet CLIENT KILL op
      // het id van de eerste, alleen op onze eigen verbinding en op niemand
      // anders. Twee soorten timing, want ze bewijzen niet hetzelfde:
      //   * `tijdens` — de kill gaat de deur uit terwijl de operatie nog aan
      //     het lezen is. Dat levert de vertrouwde uitkomst op: niets geland.
      //   * `bij-eval` — de kill vertrekt op het moment dat het script zelf
      //     onderweg is. Dat levert óók de uitkomst op waar deze test om
      //     begonnen is: de wissel LANDT en de aanroeper hoort het nooit.
      const victim = createRedisConnection(testConnectionConfig());
      const killer = createRedisConnection(testConnectionConfig());
      await victim.connect();
      await killer.connect();

      /** @type {Set<string>} */
      const uitkomsten = new Set();
      let onderbroken = 0;
      try {
        for (const [moment, vertragingMs] of [
          ['tijdens', 0], ['tijdens', 0], ['tijdens', 1], ['tijdens', 3], ['tijdens', 8],
          ['bij-eval', 0], ['bij-eval', 0], ['bij-eval', 0], ['bij-eval', 0], ['bij-eval', 0],
        ]) {
          // Hier BEGINNEN room en match op dezelfde fase, anders dan in de
          // andere tests: de invariant die bewezen moet worden is "de twee
          // dragen dezelfde waarde", en dat is alleen een uitspraak over de
          // operatie als het vóóraf al klopte. Een scheve begintoestand zou de
          // assertie laten falen op iets wat de fixture zelf heeft gedaan.
          await fresh();
          await store.saveRoom(makeRoom({ phase: 'LOBBY' }));
          await store.saveMatch(makeMatch({ phase: 'LOBBY' }));
          const victimId = await victim.getClient().sendCommand(['CLIENT', 'ID']);
          const dood = () => killer.getClient().sendCommand(['CLIENT', 'KILL', 'ID', String(victimId)]);

          // Bij `bij-eval` schuift de kill mee met het script in plaats van met
          // de klok: de doorgeefclient hieronder vuurt hem af zodra de EVAL de
          // deur uit is. Alleen `get` en `eval` worden gebruikt, dus meer hoeft
          // hij niet door te geven.
          const victimStore = createRedisDataStore({
            connection: {
              getClient: () => ({
                get: (key) => victim.getClient().get(key),
                eval: (script, options) => {
                  const pending = victim.getClient().eval(script, options);
                  if (moment === 'bij-eval') dood();
                  return pending;
                },
              }),
            },
          });

          const bezig = victimStore
            .setRoomAndMatchPhaseAtomically('room_a', 'match_1', 'FINISHED')
            .then(() => 'geland', () => 'onbekend');
          if (moment === 'tijdens') {
            if (vertragingMs > 0) await new Promise((resolve) => setTimeout(resolve, vertragingMs));
            await dood();
          }

          const gemeld = await bezig;
          if (gemeld === 'onbekend') onderbroken += 1;

          // De opslag via een ANDERE, levende verbinding lezen: wat de gedode
          // client dacht, doet er niet toe — het gaat om wat er staat.
          const room = await store.loadRoom('room_a');
          const match = await store.loadMatch('room_a', 'match_1');
          assert.strictEqual(
            room.phase, match.phase,
            `de projectie (Room.phase=${room.phase}) mag nooit uit de pas lopen met de autoriteit (Match.phase=${match.phase})`
          );
          assert.ok(
            room.phase === 'LOBBY' || room.phase === 'FINISHED',
            `alleen de oude of de nieuwe fase is een geldige uitkomst, kreeg ${room.phase}`
          );
          uitkomsten.add(`${moment}:${gemeld}/${room.phase}`);

          // Wachten tot de gedode verbinding zichzelf heeft hersteld, anders
          // meet de volgende ronde de herverbinding in plaats van het gedrag.
          const deadline = Date.now() + 5_000;
          while (!victim.isReady() && Date.now() < deadline) {
            await new Promise((resolve) => setTimeout(resolve, 10));
          }
          assert.ok(victim.isReady(), 'de gedode verbinding hoort zichzelf te herstellen');
        }
      } finally {
        await victim.close();
        await killer.close();
      }

      assert.ok(onderbroken > 0, `er is minstens één keer echt onderbroken (uitkomsten: ${[...uitkomsten].join(', ')})`);
      // Geen assertie op WELKE uitkomsten voorkomen: dat hangt af van waar de
      // kill landt, en een test die daarop vastpint test de planner van Redis
      // in plaats van de adapter. De invariant hierboven is de eis.
    });
  });

  // ------------------------------------------------------------------
  // 7. De twee methoden die hier NIET horen.
  // ------------------------------------------------------------------
  describe('Redis-adapter — bewust niet geïmplementeerd', () => {
    it('UNIMPLEMENTED_METHODS noemt exact de twee resterende methoden en hun blokkade', () => {
      assert.deepStrictEqual(Object.keys(UNIMPLEMENTED_METHODS).sort(), [
        'loadSessionByTokenHash',
        'saveAcceptedAnswerAtomically',
      ]);
      assert.strictEqual(UNIMPLEMENTED_METHODS.saveAcceptedAnswerAtomically, 'INTB2c');
      // INTB2d heeft `setRoomAndMatchPhaseAtomically` gebouwd; de lijst hoort
      // met de adapter mee te krimpen, anders is hij een verouderd briefje in
      // plaats van een machineleesbare stand van zaken.
      assert.strictEqual(UNIMPLEMENTED_METHODS.setRoomAndMatchPhaseAtomically, undefined);
    });

    it('loadSessionByTokenHash werpt en noemt de ontbrekende sleutel, in plaats van een globale SCAN te doen', async () => {
      // DM14/§10 zette deze methode op de poort met de aanname dat saveSession
      // de index "gewoon" kan vullen. Dat kan tegen een Map, niet tegen Redis:
      // er is geen sleutel voor een tokenHash en de signatuur draagt geen
      // roomId. Een SCAN over room:*:sessions zou hier groen opleveren en het
      // besluit onzichtbaar maken — vandaar deze test.
      await fresh();
      await store.saveSession(makeSession({ tokenHash: 'hash_1' }));

      await assert.rejects(
        () => store.loadSessionByTokenHash('hash_1'),
        (error) => {
          assert.ok(error instanceof NotImplementedError);
          assert.match(error.message, /redis-keys\.js/);
          return true;
        }
      );
      // En saveSession heeft geen index-sleutel aangemaakt die er niet hoort te zijn.
      assert.deepStrictEqual(
        (await client().keys('*')).filter((key) => key.includes('token')),
        []
      );
    });

    it('assertImplementsDataStore slaagt — en dat is precies waarom UNIMPLEMENTED_METHODS bestaat', () => {
      // De shapecheck kan het verschil tussen "geïmplementeerd" en "werpt
      // altijd" niet zien. Deze test legt dat vast zodat niemand de groene
      // shapecheck voor volledigheid aanziet.
      assert.doesNotThrow(() => assertImplementsDataStore(createRedisDataStore({ connection })));
    });

    it('saveAcceptedAnswerAtomically werpt met een verwijzing naar INTB2c en schrijft niets', async () => {
      await fresh();
      await store.savePlayer(makePlayer());

      await assert.rejects(
        () => store.saveAcceptedAnswerAtomically('room_a', 'match_1', {
          answer: makeAnswer(),
          updatedPlayer: { id: 'player_1', score: 120, correctCount: 1, correctResponseTimeMsTotal: 2000 },
          actionCacheEntry: { actionId: 'action_1', ack: { roundId: 'round_1' } },
        }),
        (error) => {
          assert.ok(error instanceof NotImplementedError);
          assert.match(error.message, /INTB2c/);
          assert.strictEqual(error.code, 'NOT_IMPLEMENTED');
          return true;
        }
      );

      assert.strictEqual(await store.loadAnswer('room_a', 'match_1', 'round_1', 'player_1'), null);
      assert.strictEqual(await store.loadActionCacheEntry('room_a', 'action_1'), null);
      assert.deepStrictEqual(await store.getScoreboardTop('room_a', 'match_1', 10), []);
      assert.strictEqual((await store.loadPlayer('room_a', 'player_1')).score, 0);
    });

    it('setRoomAndMatchPhaseAtomically werpt NIET meer — INTB2d heeft hem gebouwd', async () => {
      // De tegenhanger van de test hierboven, en bewust blijven staan in plaats
      // van weggehaald: dit blok is de plek waar de stand van zaken van de
      // adapter wordt vastgelegd, en "deze methode is er nu wél" hoort daar net
      // zo goed in als "deze methode is er nog niet".
      await fresh();
      await store.saveRoom(makeRoom({ phase: 'LOBBY' }));
      await store.saveMatch(makeMatch({ phase: 'ROUND_ACTIVE' }));

      await assert.doesNotReject(() => store.setRoomAndMatchPhaseAtomically('room_a', 'match_1', 'SCOREBOARD'));

      assert.strictEqual((await store.loadRoom('room_a')).phase, 'SCOREBOARD');
      assert.strictEqual((await store.loadMatch('room_a', 'match_1')).phase, 'SCOREBOARD');
    });
  });
}
