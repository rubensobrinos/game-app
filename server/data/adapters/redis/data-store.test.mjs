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
// 2. DE SUITE IS NU VOLLEDIG GROEN tegen deze adapter. Dat was ze niet: bij
//    INTB2b stonden negentien tests rood omdat `saveAcceptedAnswerAtomically`
//    (INTB2c) nog niet gebouwd was, en de suite die methode óók als ARRANGEMENT
//    gebruikt voor het scoreboard, het Answer en de action-cache — die hebben op
//    deze poort geen andere schrijfweg (de suite zegt dat zelf, bij `scoreOne`).
//    Rood waren:
//      * describe 'saveAcceptedAnswerAtomically'                    8 tests
//      * describe 'saveAcceptedAnswerAtomically — INTB-4'           3 tests
//      * describe 'getScoreboardTop'                6 van de 7 tests
//      * describe 'INTB-1 …'                        2 van de 5 tests
//    INTB2c heeft ze alle negentien groen gemaakt; de adapter-eigen tests
//    daarvoor staan in sectie 6c hieronder. Het blok
//    `setRoomAndMatchPhaseAtomically` (8 tests) stond hier om dezelfde reden en
//    is met INTB2d groen geworden (sectie 6b).
//
//    Sectie 5 test het leesgedrag van `getScoreboardTop`, `loadAnswer` en
//    `loadActionCacheEntry` met een arrangement dat rechtstreeks in Redis
//    schrijft. Dat blok stamt uit de tijd dat de schrijfweg ontbrak en blijft
//    staan: het bewijst dat de lezers op de sleutels uit `redis-keys.js` kijken,
//    onafhankelijk van wat het Lua-script daar neerzet.
//
//    `loadSessionByTokenHash` (DM14/§10) was tijdens INTB2b een andersoortige
//    blokkade: er bestond geen Redis-sleutel voor een tokenHash, en de suite
//    kende de methode nog niet, dus hij veroorzaakte daar geen rood — alleen
//    `assertImplementsDataStore` zag hem, en die slaagde omdat de stub een
//    functie is. `sessionTokenLookupKey` bestaat inmiddels en INTB2f heeft hem
//    gebouwd; de conformance-suite legt zijn gedrag nu vast (blok `Session`) en
//    sectie 4c hieronder de sleutel, de TTL-koppeling en de rotatie-opruiming.
//
// TESTINSTANTIE: uitsluitend `redis://127.0.0.1:6380` via `test-redis.mjs`.
// Anders dan bij INTB2a SCHRIJVEN deze tests wél, dus draait alles in de
// per-proces gekozen database-index (8..15, nooit 0) en ruimt elke test na
// zichzelf op.
//
// EN ER IS EEN SLOT (INTB2e). Dit was ooit het enige Redis-schrijvende
// testbestand in deze map, want twee bestanden kunnen in twee processen landen
// die dezelfde database-index kiezen en dan flusht de een de fixtures van de
// ander weg. `aof-restart.test.mjs` is het tweede geworden, en dat doet iets
// ergers dan flushen: het SIGKILLt de instantie. `node --test` draait
// testbestanden parallel, dus beide kanten nemen nu
// `acquireRedisTestLock()` uit test-redis.mjs voordat ze een verbinding
// opzetten. Wie hier een derde Redis-schrijvend bestand bij zet: neem dat slot
// ook, anders is het weer loterij.

import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { DATA_STORE_METHOD_NAMES, assertImplementsDataStore } from '../../repository.js';
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
  sessionTokenLookupKey,
} from '../../redis-keys.js';
import { ROOM_TTL_SECONDS } from '../../ttl.js';
import { assertAnswerShape } from '../../types/answer.js';
import { runDataStoreConformance } from '../data-store-conformance.mjs';
import { createRedisConnection } from './connection.mjs';
import { encodeDocument } from './documents.mjs';
import { createRedisDataStore, UNIMPLEMENTED_METHODS } from './data-store.mjs';
import { TEST_REDIS_DATABASE, acquireRedisTestLock, probeTestRedis, testConnectionConfig } from './test-redis.mjs';

// Het slot vóór de eerste verbinding: zie de noot in de kop.
const releaseLock = await acquireRedisTestLock({ label: 'data-store.test.mjs' });
const probe = await probeTestRedis();

if (!probe.ok) {
  // Nooit stilzwijgend groen: als de testinstantie er niet is, staat de reden
  // in de skipmelding.
  await releaseLock();
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
    await releaseLock();
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
      scoreboardFrequency: 'elke_ronde', pacing: 'auto', autoReveal: true, speedBonus: true, deadlineGraceMs: 250,
      mode: 'individual', teamNames: [], metricMode: 'punten', maxPlayers: 20, allowLateJoin: true,
      continents: ['Europe', 'Asia', 'Africa', 'North America', 'South America', 'Oceania'],
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

    it('saveRoom zet de room in rooms:active en raakt GEEN lookup-index aan (INTB-11)', async () => {
      // De conformance-suite legt het waarneembare gedrag vast (`loadRoomByCode`
      // vindt niets na een `saveRoom` zonder claim). Hier staat de sleutel zelf:
      // een implementatie die de index wél schrijft maar hem daarna toevallig
      // ook weer opruimt, zou daar doorheen komen en hier niet.
      await fresh();
      await store.saveRoom(makeRoom());

      assert.strictEqual(await client().get(roomCodeLookupKey('AAA111')), null, 'saveRoom is geen schrijver van de code-index');
      assert.strictEqual(await client().get(roomInviteLookupKey('invitehash_a')), null);
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

    it('saveRoom zet de room-TTL uit ttl.js op de roomkern; de code-index heeft zijn eigen claim-TTL', async () => {
      // De twee TTL's staan bewust los: de roomkern loopt op `ttl.js`, de
      // lookup-indexen op de `ttlSeconds` van de claim (die is een vangnet voor
      // een creatie die halverwege sneuvelt, en hoort dus korter te kunnen zijn).
      // Sinds INTB-11 is `saveRoom` sowieso geen schrijver meer van de index.
      await fresh();
      await store.saveRoom(makeRoom());
      await store.claimRoomLocatorsAtomically(LOCATOR_CLAIM);

      assert.strictEqual(await client().ttl(roomKey('room_a')), ROOM_TTL_SECONDS);
      assert.strictEqual(await client().ttl(roomCodeLookupKey('AAA111')), LOCATOR_CLAIM.ttlSeconds);
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
  // 4c. De sessietoken-index (INTB2f).
  //
  // Het GEDRAG staat in de conformance-suite (blok `Session`): vindbaar op de
  // hash, rotatie trekt de oude in, geen touch-on-read. Hier staat wat die suite
  // per definitie niet kan zien, en precies dat zijn de drie dingen die het
  // besluit (BESLUIT-INTB-locators-en-sessieindex.md, deel B) vastlegt:
  //
  //   1. DE SLEUTELNAAM DRAAGT DE HASH, NOOIT HET TOKEN. Een Redis-keyname mag
  //      de capability niet tonen — dezelfde redenering als bij
  //      `roomInviteLookupKey(inviteHash)`. Een adapter die het ruwe token in de
  //      sleutel zet levert exact dezelfde lookups op en lekt in elke
  //      `KEYS *`, elke slowlog en elke `MONITOR`-sessie een geldig token.
  //   2. DE INDEX DRAAGT HET PAAR EN VERDER NIETS. Geen sessiegegevens, zodat er
  //      één plek is waar een sessie echt staat.
  //   3. DE TTL BEWEEGT MEE MET DE ROOM. De index is een GLOBALE sleutel, dus de
  //      room-brede refresh kan hem niet op naam vinden; hij wordt opgehaald uit
  //      `room:{roomId}:sessions`. Verloopt hij eerder dan de room, dan verliest
  //      een speler zijn reconnectrecht midden in een potje.
  // ------------------------------------------------------------------
  describe('Redis-adapter — sessietoken-index (INTB2f)', () => {
    async function expireSoon(...keys) {
      for (const key of keys) {
        assert.ok(await client().expire(key, 5), `sleutel ${key} bestaat niet`);
      }
    }

    it('de index staat onder session:token:{tokenHash} en draagt alleen roomId + sessionId', async () => {
      await fresh();
      await store.saveSession(makeSession({ tokenHash: 'hash_1' }));

      const raw = await client().get(sessionTokenLookupKey('hash_1'));
      assert.strictEqual(raw, await client().get('session:token:hash_1'), 'de sleutel komt uit redis-keys.js');
      const envelope = JSON.parse(raw);
      assert.deepStrictEqual(Object.keys(envelope).sort(), ['documentType', 'payload', 'schemaVersion']);
      assert.strictEqual(envelope.documentType, 'session-token-index');
      assert.deepStrictEqual(
        envelope.payload,
        { roomId: 'room_a', sessionId: 'session_1' },
        'de index is een verwijzing, geen tweede kopie van de sessie'
      );
    });

    it('geen enkele sleutel bevat het RUWE token — alleen de hash', async () => {
      // Het scherpste van de drie punten hierboven, en het enige dat je aan de
      // returnwaarden niet kunt zien: een adapter die `session:token:{token}`
      // schrijft, slaagt voor élke gedragstest en lekt ondertussen een geldige
      // capability in de sleutelruimte.
      await fresh();
      // Twee losse literals, geen afgeleide: `hash` mag `token` als tekst niet
      // bevatten, anders zou de filter hieronder ook aanslaan op de correcte
      // implementatie en bewijst hij niets.
      const token = 'RUWTOKEN32BYTESNOOITINEENKEY';
      const hash = 'a3f9c1e8b27d4056';
      await store.saveSession(makeSession({ tokenHash: hash }));
      // De sessie draagt het token nergens; hij bestaat alleen bij de client.
      // Waar hij in Redis zou opduiken, is in de sleutelnaam van de index.
      const keys = await client().keys('*');
      assert.ok(keys.length > 0, 'er moet iets geschreven zijn, anders bewijst deze test niets');
      assert.deepStrictEqual(
        keys.filter((key) => key.includes(token) || key.includes(token.toLowerCase())),
        [],
        'een Redis-keyname mag het token zelf nooit dragen'
      );
      assert.ok(keys.includes(sessionTokenLookupKey(hash)), 'de hash-variant hoort er wél te staan');
      assert.ok(
        keys.includes(`session:token:${hash}`),
        'en hij staat precies onder het patroon uit redis-keys.js'
      );
    });

    it('de index draagt de room-TTL uit ttl.js', async () => {
      await fresh();
      await store.saveSession(makeSession({ tokenHash: 'hash_1' }));

      assert.strictEqual(await client().ttl(sessionTokenLookupKey('hash_1')), ROOM_TTL_SECONDS);
    });

    it('ELKE schrijfactie in de room ververst de token-indexen van ALLE sessies erin', async () => {
      // De koppeling waar het besluit om vraagt, en de reden dat `saveSession`
      // niet genoeg is: een room waarin alleen antwoorden binnenkomen schrijft
      // geen sessies meer, terwijl de spelers wel degelijk aanwezig zijn. Zonder
      // deze refresh verlopen hun token-indexen terwijl de room doorspeelt, en
      // dan faalt de eerstvolgende reconnect op een token dat nog geldig ís.
      const indexen = [sessionTokenLookupKey('hash_1'), sessionTokenLookupKey('hash_2')];
      for (const [wat, schrijf] of [
        ['saveRoom', () => store.saveRoom(makeRoom())],
        ['savePlayer', () => store.savePlayer(makePlayer())],
        ['saveMatch', () => store.saveMatch(makeMatch())],
        ['saveRound', async () => {
          await store.saveMatch(makeMatch());
          await expireSoon(...indexen);
          await store.saveRound('room_a', makeRound());
        }],
        ['saveSession (andere sessie)', () => store.saveSession(makeSession({ id: 'session_3', tokenHash: 'hash_3' }))],
        ['refreshRoomLocators', async () => {
          await store.claimRoomLocatorsAtomically(LOCATOR_CLAIM);
          await expireSoon(...indexen);
          await store.refreshRoomLocators(LOCATOR_CLAIM);
        }],
        ['setRoomAndMatchPhaseAtomically', async () => {
          await store.saveRoom(makeRoom({ phase: 'LOBBY' }));
          await store.saveMatch(makeMatch({ phase: 'LOBBY' }));
          await expireSoon(...indexen);
          await store.setRoomAndMatchPhaseAtomically('room_a', 'match_1', {
            expectedPhase: 'LOBBY', newPhase: 'SCOREBOARD', pausedState: null,
          });
        }],
        ['saveAcceptedAnswerAtomically', async () => {
          await store.savePlayer(makePlayer());
          await expireSoon(...indexen);
          await store.saveAcceptedAnswerAtomically('room_a', 'match_1', {
            answer: makeAnswer(),
            updatedPlayer: { id: 'player_1', score: 120, correctCount: 1, correctResponseTimeMsTotal: 2000 },
            actionCacheEntry: { actionId: 'action_1', ack: { roundId: 'round_1' } },
          });
        }],
      ]) {
        await fresh();
        await store.saveSession(makeSession({ id: 'session_1', tokenHash: 'hash_1' }));
        await store.saveSession(makeSession({ id: 'session_2', tokenHash: 'hash_2' }));
        await expireSoon(...indexen);

        await schrijf();

        for (const key of indexen) {
          assert.strictEqual(
            await client().ttl(key),
            ROOM_TTL_SECONDS,
            `${wat} hoort de TTL van ${key} te verversen`
          );
        }
      }
    });

    it('een rotatie laat geen verweesde indexsleutel achter', async () => {
      // De conformance-suite ziet dat de oude hash niets meer oplevert. Hier
      // staat de sterkere eis: de SLEUTEL is weg, niet alleen leeggemaakt of
      // naar een verlopen waarde gezet. Een achtergebleven sleutel is een
      // capability die er nog steeds is zolang iemand hem kan lezen.
      await fresh();
      await store.saveSession(makeSession({ tokenHash: 'hash_oud' }));
      await store.saveSession(makeSession({ tokenHash: 'hash_nieuw' }));

      assert.strictEqual(await client().exists(sessionTokenLookupKey('hash_oud')), 0, 'de oude index hoort verwijderd te zijn');
      assert.strictEqual(await client().exists(sessionTokenLookupKey('hash_nieuw')), 1);
      assert.deepStrictEqual(
        (await client().keys('session:token:*')).sort(),
        [sessionTokenLookupKey('hash_nieuw')],
        'precies één index per sessie'
      );
    });

    it('de rotatie-opruiming en de nieuwe index landen in ÉÉN opdracht — nooit halverwege', async () => {
      // De opruiming van de oude en het zetten van de nieuwe zitten in hetzelfde
      // script. Een implementatie die er twee netwerkbeurten van maakt, laat
      // precies het venster open waarin BEIDE tokens geldig zijn (of, andersom,
      // geen van beide). Meetbaar via het aantal schrijvende opdrachten dat de
      // adapter de deur uit doet.
      await fresh();
      await store.saveSession(makeSession({ tokenHash: 'hash_oud' }));

      /** @type {string[]} */
      const commando = [];
      const spion = createRedisDataStore({
        connection: {
          getClient: () => ({
            hGet: (key, field) => client().hGet(key, field),
            hVals: (key) => client().hVals(key),
            multi: () => { commando.push('multi'); return client().multi(); },
            eval: (script, options) => { commando.push('eval'); return client().eval(script, options); },
            del: (...keys) => { commando.push('del'); return client().del(...keys); },
            set: (...args) => { commando.push('set'); return client().set(...args); },
            hSet: (...args) => { commando.push('hSet'); return client().hSet(...args); },
          }),
        },
      });

      await spion.saveSession(makeSession({ tokenHash: 'hash_nieuw' }));

      assert.deepStrictEqual(commando, ['eval'], 'de hele wissel hoort één server-side uitvoering te zijn');
      assert.strictEqual(await client().get(sessionTokenLookupKey('hash_oud')), null);
      assert.strictEqual((await store.loadSessionByTokenHash('hash_nieuw')).id, 'session_1');
    });

    it('een lookup verlengt NIETS — geen touch-on-read', async () => {
      // Bewust vastgelegd, want "even verversen bij elke geslaagde lookup" is de
      // voor de hand liggende implementatie. Ze werkt voor een actief gebruikt
      // token en laat juist de stille speler vallen: wie langer dan de TTL niet
      // reconnect, verliest zijn sessie terwijl de room nog leeft — en reconnect
      // is precies waar deze lookup voor bestaat.
      await fresh();
      await store.saveSession(makeSession({ tokenHash: 'hash_1' }));
      await expireSoon(sessionTokenLookupKey('hash_1'), roomSessionsKey('room_a'));

      assert.notStrictEqual(await store.loadSessionByTokenHash('hash_1'), null, 'de lookup hoort gewoon te slagen');

      assert.ok(
        (await client().ttl(sessionTokenLookupKey('hash_1'))) <= 5,
        'een lookup is geen activiteit: de TTL-koppeling loopt via de room-brede refresh'
      );
      assert.ok((await client().ttl(roomSessionsKey('room_a'))) <= 5, 'en al helemaal niet via de sessions-hash');
    });

    it('een index die naar een verdwenen sessie wijst levert null op, geen halve sessie', async () => {
      // De sessions-hash kan verlopen terwijl de index er nog staat (twee
      // sleutels, twee TTL-klokken die niet op dezelfde milliseconde aflopen).
      // Dat is "onbekend token", niet "kapot".
      await fresh();
      await store.saveSession(makeSession({ tokenHash: 'hash_1' }));
      await client().del(roomSessionsKey('room_a'));

      assert.strictEqual(await store.loadSessionByTokenHash('hash_1'), null);
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
    /**
     * Room en Match op DEZELFDE fase: sinds DM19 is dat de enige toestand
     * waarin de dubbele compare-and-set een overgang toelaat. Een scheve
     * fixture zou hier `{ ok: false }` opleveren en dan test dit blok de
     * fixture in plaats van de adapter.
     */
    async function arrangePhaseFixture() {
      await fresh();
      await store.saveRoom(makeRoom({ phase: 'LOBBY' }));
      await store.saveMatch(makeMatch({ phase: 'LOBBY' }));
    }

    /** De DM19-transitie vanuit de fixture hierboven. */
    function toPhase(newPhase, { expectedPhase = 'LOBBY', pausedState = null } = {}) {
      return { expectedPhase, newPhase, pausedState };
    }

    const PAUSED_STATE = {
      previousPhase: 'ROUND_ACTIVE', remainingMs: 7000, reason: 'host_paused', pausedAt: T + 8000,
    };

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

      await store.setRoomAndMatchPhaseAtomically('room_a', 'match_1', toPhase('SCOREBOARD'));

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

      await store.setRoomAndMatchPhaseAtomically('room_a', 'match_1', toPhase('FINISHED'));

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

      await store.setRoomAndMatchPhaseAtomically('room_a', 'match_1', toPhase('PAUSED', { pausedState: PAUSED_STATE }));

      assert.deepStrictEqual((await client().keys('*')).sort(), before, 'de wissel maakt geen sleutels aan');
    });

    it('een match zonder room werpt over de ROOM en maakt geen roomdocument aan', async () => {
      // De conformance-test "een onbekend roomId werpt RangeError" kan de
      // roomcontrole niet los bewijzen: bij een onbekend roomId bestaat óók de
      // matchsleutel niet (`room:{roomId}:match:{matchId}`), dus een adapter
      // die alléén de match controleert komt daar met de juiste foutklasse en
      // de verkeerde reden doorheen. `saveMatch` stelt geen room verplicht, dus
      // deze toestand is echt arrangeerbaar — en dan moet de roomcontrole zelf
      // aan het werk.
      await fresh();
      await store.saveMatch(makeMatch({ phase: 'ROUND_ACTIVE' }));

      await assert.rejects(
        () => store.setRoomAndMatchPhaseAtomically('room_a', 'match_1', toPhase('FINISHED', { expectedPhase: 'ROUND_ACTIVE' })),
        (error) => {
          assert.ok(error instanceof RangeError, `verwachtte RangeError, kreeg ${error?.name}: ${error?.message}`);
          assert.match(error.message, /unknown roomId/, 'de fout hoort de ROOM te noemen, niet de match');
          return true;
        }
      );

      assert.strictEqual(await client().get(roomKey('room_a')), null, 'er mag geen room uit het niets ontstaan');
      assert.deepStrictEqual(await store.loadMatch('room_a', 'match_1'), makeMatch({ phase: 'ROUND_ACTIVE' }));
    });

    it('een room zonder match werpt over de MATCH en laat de room ongemoeid', async () => {
      await fresh();
      await store.saveRoom(makeRoom({ phase: 'LOBBY' }));

      await assert.rejects(
        () => store.setRoomAndMatchPhaseAtomically('room_a', 'match_1', toPhase('FINISHED')),
        (error) => {
          assert.ok(error instanceof RangeError, `verwachtte RangeError, kreeg ${error?.name}: ${error?.message}`);
          assert.match(error.message, /unknown matchId/, 'de fout hoort de MATCH te noemen');
          return true;
        }
      );

      assert.deepStrictEqual(await store.loadRoom('room_a'), makeRoom({ phase: 'LOBBY' }));
      assert.strictEqual(await client().get(matchKey('room_a', 'match_1')), null);
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
            hVals: (key) => client().hVals(key),
            eval: (script, options) => client().eval(script, options),
          }),
        },
      });

      await raced.setRoomAndMatchPhaseAtomically('room_a', 'match_1', toPhase('FINISHED'));

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
          ['tijdens', 0], ['tijdens', 0], ['tijdens', 0], ['tijdens', 1], ['tijdens', 3],
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

          // Bij `bij-eval` schuift de kill mee met de operatie in plaats van
          // met de klok: de doorgeefclient hieronder vuurt hem af zodra het
          // EERSTE schrijvende commando de deur uit is. Bewust niet alleen
          // `eval`: een implementatie die de twee documenten in losse
          // opdrachten wegschrijft, moet hier juist de kill tússen die twee
          // opdrachten krijgen — anders test dit alleen de implementatie die
          // er toevallig staat.
          let gedood = false;
          const doodNaEersteSchrijf = () => {
            if (moment !== 'bij-eval' || gedood) return;
            gedood = true;
            dood().catch(() => {});
          };
          const victimStore = createRedisDataStore({
            connection: {
              getClient: () => ({
                get: (key) => victim.getClient().get(key),
                hVals: (key) => victim.getClient().hVals(key),
                expire: (key, seconds) => victim.getClient().expire(key, seconds),
                set: (key, value, options) => {
                  const pending = victim.getClient().set(key, value, options);
                  doodNaEersteSchrijf();
                  return pending;
                },
                eval: (script, options) => {
                  const pending = victim.getClient().eval(script, options);
                  doodNaEersteSchrijf();
                  return pending;
                },
              }),
            },
          });

          const bezig = victimStore
            .setRoomAndMatchPhaseAtomically('room_a', 'match_1', toPhase('FINISHED'))
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
          const deadline = Date.now() + 10_000;
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
  // 6c. saveAcceptedAnswerAtomically (INTB2c, DECISIONS #23).
  //
  // Het contract staat volledig in de conformance-suite (blok
  // `saveAcceptedAnswerAtomically` en blok INTB-4). Hier staat wat die suite
  // per definitie niet kan zien:
  //   * dat de vier writes op de sleutels uit redis-keys.js landen, als
  //     envelop, en dat er geen vijfde sleutel bijkomt;
  //   * dat een replay écht NIETS aanraakt, ook geen TTL;
  //   * dat het script via zijn hash gaat en na een lege scriptcache (een
  //     Redis-herstart) zichzelf herlaadt;
  //   * dat de compare-and-set op het spelerdocument een gelijktijdige
  //     savePlayer niet wegschrijft;
  //   * en het geval waar de fake structureel blind voor is: ECHTE
  //     gelijktijdigheid, over losse verbindingen, met meer inzendingen dan de
  //     fake ooit heeft gezien.
  // ------------------------------------------------------------------
  describe('Redis-adapter — saveAcceptedAnswerAtomically (INTB2c)', () => {
    /** De vier sleutels die de operatie aanraakt, plus de match-TTL-sleutel. */
    const ANSWERS = answersKey('room_a', 'match_1', 'round_1');
    const CACHE = actionCacheKey('room_a');
    const PLAYERS = roomPlayersKey('room_a');
    const BOARD = scoreboardKey('room_a', 'match_1');

    function makeWrite(overrides = {}) {
      const {
        roundId = 'round_1', playerId = 'player_1', actionId = 'action_1', points = 120,
        score = 120, correctCount = 1, correctResponseTimeMsTotal = 2000, ack = { roundId },
      } = overrides;
      return {
        answer: makeAnswer({ roundId, playerId, actionId, points }),
        updatedPlayer: { id: playerId, score, correctCount, correctResponseTimeMsTotal },
        actionCacheEntry: { actionId, ack },
      };
    }

    async function arrangePlayer(overrides = {}) {
      await fresh();
      await store.savePlayer(makePlayer(overrides));
    }

    async function expireSoon(...keys) {
      for (const key of keys) {
        assert.ok(await client().expire(key, 5), `sleutel ${key} bestaat niet`);
      }
    }

    it('de vier writes landen op precies de sleutels uit redis-keys.js, in de versie-envelop', async () => {
      await arrangePlayer();

      assert.deepStrictEqual(await store.saveAcceptedAnswerAtomically('room_a', 'match_1', makeWrite()), { replay: false });

      const answerEnvelope = JSON.parse(await client().hGet(ANSWERS, 'player_1'));
      assert.deepStrictEqual(Object.keys(answerEnvelope).sort(), ['documentType', 'payload', 'schemaVersion']);
      assert.strictEqual(answerEnvelope.documentType, 'answer');
      assert.strictEqual(answerEnvelope.schemaVersion, 1);
      assert.deepStrictEqual(answerEnvelope.payload, makeAnswer());
      // De geneste vorm blijft intact: dit is de reden dat het script het
      // JSON-werk NIET zelf doet (cjson maakt van een lege tabel een `{}`).
      assert.deepStrictEqual(answerEnvelope.payload.answer, { optionId: 'nl' });
      assert.strictEqual(answerEnvelope.payload.correct, true);

      const ackEnvelope = JSON.parse(await client().hGet(CACHE, 'action_1'));
      assert.strictEqual(ackEnvelope.documentType, 'action-cache-entry');
      assert.deepStrictEqual(ackEnvelope.payload, { actionId: 'action_1', ack: { roundId: 'round_1' } });

      const playerEnvelope = JSON.parse(await client().hGet(PLAYERS, 'player_1'));
      assert.strictEqual(playerEnvelope.documentType, 'player');
      assert.strictEqual(playerEnvelope.payload.score, 120);
      assert.strictEqual(playerEnvelope.payload.effectiveName, 'Blauwe Vos', 'niet-genoemde velden blijven staan');

      // Het scoreboard is een sorted set met een KAAL getal, geen envelop.
      assert.strictEqual(await client().zScore(BOARD, 'player_1'), 120);
    });

    it('de operatie maakt geen enkele andere sleutel aan dan de vier die ze schrijft', async () => {
      // De sleutelnamen komen allemaal als KEYS[i] binnen; een script dat er zelf
      // eentje samenstelt (of een verkeerde room raakt) valt hier op.
      await arrangePlayer();
      await store.saveRoom(makeRoom());
      await store.saveMatch(makeMatch());
      const before = new Set(await client().keys('*'));

      await store.saveAcceptedAnswerAtomically('room_a', 'match_1', makeWrite());

      const after = (await client().keys('*')).filter((key) => !before.has(key)).sort();
      assert.deepStrictEqual(after, [ANSWERS, BOARD, CACHE].sort(), 'alleen de sleutels die nog niet bestonden');
    });

    it('ververst de room-scope, de matchkey, het scoreboard en de answers-hash — een antwoord is activiteit', async () => {
      await arrangePlayer();
      await store.savePlayer(makePlayer({ id: 'player_2', sessionId: 'session_2' }));
      await store.saveRoom(makeRoom());
      await store.saveMatch(makeMatch());
      await store.saveSession(makeSession());
      await store.saveAcceptedAnswerAtomically('room_a', 'match_1', makeWrite());
      const refreshed = [
        roomKey('room_a'), roomSessionsKey('room_a'), PLAYERS, CACHE,
        matchKey('room_a', 'match_1'), BOARD, ANSWERS,
      ];
      await expireSoon(...refreshed);

      // Een afgewezen inzending (zelfde speler, zelfde ronde) mag NIETS
      // verversen — er is immers ook niets geschreven.
      await store.saveAcceptedAnswerAtomically('room_a', 'match_1', makeWrite({
        actionId: 'action_2', score: 220,
      })).catch(() => {});
      for (const key of refreshed) {
        assert.ok((await client().ttl(key)) <= 5, `een afgewezen inzending mag ${key} niet verversen`);
      }

      // Een geldige inzending in DEZELFDE ronde (andere speler) ververst alles,
      // inclusief de answers-hash van die ronde.
      await store.saveAcceptedAnswerAtomically('room_a', 'match_1', makeWrite({
        playerId: 'player_2', actionId: 'action_3', points: 80, score: 80, correctResponseTimeMsTotal: 6000,
      }));

      for (const key of refreshed) {
        assert.strictEqual(await client().ttl(key), ROOM_TTL_SECONDS, `TTL van ${key} na een geldige inzending`);
      }
    });

    it('een replay raakt niets aan: geen document, geen scoreboard, geen TTL', async () => {
      // "Geen mutatie" is hier letterlijk bedoeld. Een implementatie die op een
      // replay alsnog de TTL-refresh doet, is niet ernstig fout maar wél iets
      // anders dan het contract zegt — en dan is een replay van buitenaf niet
      // meer te onderscheiden van een write.
      await arrangePlayer();
      await store.saveAcceptedAnswerAtomically('room_a', 'match_1', makeWrite());
      const snapshotVoor = {
        answer: await client().hGet(ANSWERS, 'player_1'),
        ack: await client().hGet(CACHE, 'action_1'),
        player: await client().hGet(PLAYERS, 'player_1'),
        score: await client().zScore(BOARD, 'player_1'),
      };
      await expireSoon(ANSWERS, CACHE, PLAYERS, BOARD);

      // Dezelfde actionId, hogere score, ander antwoord — zoals een dubbel
      // afgeleverde socketboodschap eruitziet.
      const uitkomst = await store.saveAcceptedAnswerAtomically('room_a', 'match_1', makeWrite({
        actionId: 'action_1', points: 200, score: 320, correctCount: 2, correctResponseTimeMsTotal: 5000,
        ack: { roundId: 'round_1', bijgewerkt: true },
      }));

      assert.deepStrictEqual(uitkomst, { replay: true }, 'een replay komt terug als returnwaarde, niet als throw');
      assert.strictEqual(await client().hGet(ANSWERS, 'player_1'), snapshotVoor.answer);
      assert.strictEqual(await client().hGet(CACHE, 'action_1'), snapshotVoor.ack, 'de bewaarde ack blijft de eerste');
      assert.strictEqual(await client().hGet(PLAYERS, 'player_1'), snapshotVoor.player);
      assert.strictEqual(await client().zScore(BOARD, 'player_1'), snapshotVoor.score);
      for (const key of [ANSWERS, CACHE, PLAYERS, BOARD]) {
        assert.ok((await client().ttl(key)) <= 5, `een replay mag de TTL van ${key} niet verversen`);
      }
    });

    it('een tweede actionId in dezelfde ronde werpt RangeError met code ALREADY_ANSWERED', async () => {
      // De protocol-adapter moet een geldige ack kunnen onderscheiden van een
      // afgewezen duplicaat. Replay = returnwaarde, duplicaat = getypeerde
      // throw; deze test pint de code vast waarop dat onderscheid rust.
      await arrangePlayer();
      await store.saveAcceptedAnswerAtomically('room_a', 'match_1', makeWrite());

      await assert.rejects(
        () => store.saveAcceptedAnswerAtomically('room_a', 'match_1', makeWrite({
          actionId: 'action_2', points: 200, score: 320, correctCount: 2, correctResponseTimeMsTotal: 5000,
        })),
        (error) => {
          assert.ok(error instanceof RangeError, `verwachtte RangeError, kreeg ${error?.name}`);
          assert.strictEqual(error.code, 'ALREADY_ANSWERED', 'dezelfde codestring als resolveAnswer');
          return true;
        }
      );

      assert.strictEqual(await client().hExists(CACHE, 'action_2'), 0, 'de ack van de afgewezen inzending');
      assert.strictEqual((await store.loadAnswer('room_a', 'match_1', 'round_1', 'player_1')).points, 120);
      assert.strictEqual((await store.loadPlayer('room_a', 'player_1')).score, 120);
      assert.strictEqual(await client().zScore(BOARD, 'player_1'), 120);
      assert.strictEqual(await client().hLen(CACHE), 1, 'precies één ack in de room');
    });

    it('een onbekende speler werpt RangeError over de SPELER en laat de vier sleutels ongemoeid', async () => {
      await arrangePlayer();
      await store.saveAcceptedAnswerAtomically('room_a', 'match_1', makeWrite());

      await assert.rejects(
        () => store.saveAcceptedAnswerAtomically('room_a', 'match_1', makeWrite({
          playerId: 'player_spook', roundId: 'round_2', actionId: 'action_2',
        })),
        (error) => {
          assert.ok(error instanceof RangeError);
          assert.match(error.message, /unknown playerId/);
          assert.strictEqual(error.code, undefined, 'dit is géén ALREADY_ANSWERED');
          return true;
        }
      );

      assert.strictEqual(await client().exists(answersKey('room_a', 'match_1', 'round_2')), 0);
      assert.strictEqual(await client().hExists(CACHE, 'action_2'), 0);
      assert.strictEqual(await client().hExists(PLAYERS, 'player_spook'), 0, 'er mag geen speler uit het niets ontstaan');
      assert.strictEqual(await client().zScore(BOARD, 'player_spook'), null);
    });

    it('een replay wint van een verdwenen speler — de idempotentiecontrole staat vooraan', async () => {
      // De volgorde uit het foutcontract, in zijn scherpste vorm: een retry van
      // een actie die al geland is, terwijl de speler intussen uit de room is
      // verwijderd. Dat blijft een replay; er valt niets meer te muteren, dus er
      // is ook niets om over te struikelen.
      await arrangePlayer();
      await store.saveAcceptedAnswerAtomically('room_a', 'match_1', makeWrite());
      await client().hDel(PLAYERS, 'player_1');

      assert.deepStrictEqual(
        await store.saveAcceptedAnswerAtomically('room_a', 'match_1', makeWrite()),
        { replay: true },
        'een replay hoort geen RangeError over de speler te worden'
      );
    });

    it('slaat de aangeleverde absolute waarden op zonder ze te herberekenen', async () => {
      // Het script rekent NIET. Krijgt het een score die niet uit `points` volgt,
      // dan slaat het die gewoon op — de aanroeper heeft gerekend (GR-terrein).
      // Een implementatie die in Lua `score + points` doet, valt hier om.
      await arrangePlayer({ score: 500, correctCount: 4, correctResponseTimeMsTotal: 9000 });

      await store.saveAcceptedAnswerAtomically('room_a', 'match_1', makeWrite({
        points: 200, score: 7, correctCount: 1, correctResponseTimeMsTotal: 1,
      }));

      const player = await store.loadPlayer('room_a', 'player_1');
      assert.strictEqual(player.score, 7, 'absolute waarde, geen optelling');
      assert.strictEqual(player.correctCount, 1);
      assert.strictEqual(player.correctResponseTimeMsTotal, 1);
      assert.strictEqual(await client().zScore(BOARD, 'player_1'), 7);
    });

    it('gaat via EVALSHA en herlaadt zichzelf nadat Redis het script niet meer kent', async () => {
      // SCRIPT FLUSH is wat een Redis-herstart met de scriptcache doet: die is
      // niet persistent. Een adapter die het script één keer bij het opstarten
      // laadt, werkt tot de eerste herstart en faalt daarna op elke inzending.
      await arrangePlayer();
      const gebruikt = [];
      const spiedStore = createRedisDataStore({
        connection: {
          getClient: () => ({
            hGet: (key, field) => client().hGet(key, field),
            hVals: (key) => client().hVals(key),
            eval: (script, options) => { gebruikt.push('eval'); return client().eval(script, options); },
            evalSha: (sha, options) => { gebruikt.push('evalSha'); return client().evalSha(sha, options); },
          }),
        },
      });

      // 1. De eerste aanroep laadt het script (EVAL), de tweede gaat via de hash.
      await spiedStore.saveAcceptedAnswerAtomically('room_a', 'match_1', makeWrite());
      await spiedStore.saveAcceptedAnswerAtomically('room_a', 'match_1', makeWrite({
        roundId: 'round_2', actionId: 'action_2', score: 220, correctCount: 2, correctResponseTimeMsTotal: 5000,
      }));
      assert.deepStrictEqual(gebruikt, ['eval', 'evalSha'], 'na de eerste keer laden gaat het via de hash');

      // 2. Redis vergeet het script (herstart / SCRIPT FLUSH / failover).
      await client().scriptFlush();
      gebruikt.length = 0;

      const uitkomst = await spiedStore.saveAcceptedAnswerAtomically('room_a', 'match_1', makeWrite({
        roundId: 'round_3', actionId: 'action_3', score: 320, correctCount: 3, correctResponseTimeMsTotal: 8000,
      }));

      assert.deepStrictEqual(uitkomst, { replay: false }, 'een lege scriptcache mag geen inzending kosten');
      assert.deepStrictEqual(gebruikt, ['evalSha', 'eval'], 'NOSCRIPT -> dezelfde aanroep gaat alsnog via EVAL');
      assert.strictEqual((await store.loadPlayer('room_a', 'player_1')).score, 320);

      // 3. En daarna weer via de hash, want EVAL heeft hem opnieuw geladen.
      gebruikt.length = 0;
      await spiedStore.saveAcceptedAnswerAtomically('room_a', 'match_1', makeWrite({
        roundId: 'round_4', actionId: 'action_4', score: 420, correctCount: 4, correctResponseTimeMsTotal: 9000,
      }));
      assert.deepStrictEqual(gebruikt, ['evalSha']);
    });

    it('een gelijktijdige savePlayer tussen de lees en het script wordt niet overschreven', async () => {
      // Het spelerdocument wordt buiten Redis samengevoegd (zie SAVE_ANSWER_LUA),
      // dus er zit per definitie een lees vóór de schrijf. Zonder compare-and-set
      // zou deze operatie de naamswijziging hieronder wegschrijven met een
      // verouderd document — een verloren update midden in de score.
      await arrangePlayer();

      let ingegrepen = false;
      const raced = createRedisDataStore({
        connection: {
          getClient: () => ({
            async hGet(key, field) {
              const value = await client().hGet(key, field);
              if (!ingegrepen && key === PLAYERS) {
                ingegrepen = true;
                await store.savePlayer(makePlayer({ displayName: 'Ruben', effectiveName: 'Ruben', nameSource: 'custom' }));
              }
              return value;
            },
            hVals: (key) => client().hVals(key),
            eval: (script, options) => client().eval(script, options),
            evalSha: (sha, options) => client().evalSha(sha, options),
          }),
        },
      });

      await raced.saveAcceptedAnswerAtomically('room_a', 'match_1', makeWrite());

      assert.strictEqual(ingegrepen, true, 'het venster is echt geraakt, anders bewijst deze test niets');
      const player = await store.loadPlayer('room_a', 'player_1');
      assert.strictEqual(player.effectiveName, 'Ruben', 'de gelijktijdige schrijfactie mag niet zijn weggevallen');
      assert.strictEqual(player.score, 120, 'en de score van deze inzending staat er wél');
    });

    it('een spelerdocument dat blijft bewegen levert een fout op waarin NIETS is geschreven', async () => {
      // De bovengrens van de herpogingen. Een oneindige lus onder aanhoudende
      // drukte is een hangende request; op is op, en dan hoort er niets te staan.
      await arrangePlayer();
      const altijdStale = createRedisDataStore({
        connection: {
          getClient: () => ({
            // Levert een geldig, maar NOOIT actueel spelerdocument: de
            // compare-and-set in het script kan dus per definitie niet slagen.
            hGet: async () => encodeDocument('player', makePlayer({ score: 999 })),
            hVals: (key) => client().hVals(key),
            eval: (script, options) => client().eval(script, options),
            evalSha: (sha, options) => client().evalSha(sha, options),
          }),
        },
      });

      await assert.rejects(
        () => altijdStale.saveAcceptedAnswerAtomically('room_a', 'match_1', makeWrite()),
        (error) => {
          assert.ok(!(error instanceof RangeError), 'dit is geen contractfout maar een opgegeven herpoging');
          assert.match(error.message, /pogingen achter elkaar/);
          return true;
        }
      );

      assert.strictEqual(await client().exists(ANSWERS), 0, 'er mag niets geschreven zijn');
      assert.strictEqual(await client().exists(CACHE), 0);
      assert.strictEqual(await client().exists(BOARD), 0);
      assert.strictEqual((await store.loadPlayer('room_a', 'player_1')).score, 0);
    });

    // ----------------------------------------------------------------
    // ECHTE GELIJKTIJDIGHEID, over losse verbindingen.
    //
    // Dit is het blok dat tegen de in-memory fake niet te schrijven is. Die is
    // single-threaded en voert elke aanroep volledig synchroon uit; twee
    // aanroepen kunnen elkaar er niet eens kruisen. Hier praten meerdere
    // Redis-CLIENTS tegelijk tegen dezelfde sleutels, elk over een eigen
    // socket, en zit er tussen elke lees en elke schrijf een netwerkbeurt.
    //
    // Elke deelnemer biedt een EIGEN absolute score aan (100 + index). Daardoor
    // is aan de eindstand af te lezen wélke inzending gewonnen heeft, en is
    // "de score is precies één keer toegekend" een echte assertie in plaats van
    // een tautologie op een gedeeld getal.
    // ----------------------------------------------------------------
    const DEELNEMERS = 24;
    const VERBINDINGEN = 6;

    /**
     * Zet `VERBINDINGEN` losse verbindingen op, elk met een eigen store, en
     * levert `DEELNEMERS` stores in ronde-robin. Losse verbindingen, want twee
     * aanroepen over dezelfde socket worden door de client achter elkaar gezet
     * en dat is precies de gelijktijdigheid die we willen uitsluiten.
     */
    async function withConcurrentStores(body) {
      const connections = await Promise.all(
        Array.from({ length: VERBINDINGEN }, async () => {
          const extra = createRedisConnection(testConnectionConfig());
          await extra.connect();
          return extra;
        })
      );
      try {
        const stores = connections.map((extra) => createRedisDataStore({ connection: extra }));
        await body(Array.from({ length: DEELNEMERS }, (_, index) => stores[index % stores.length]));
      } finally {
        await Promise.all(connections.map((extra) => extra.close()));
      }
    }

    it(`${DEELNEMERS} gelijktijdige inzendingen met DEZELFDE actionId: één schrijft, de rest is replay`, async () => {
      await arrangePlayer();

      await withConcurrentStores(async (stores) => {
        const uitkomsten = await Promise.all(stores.map((each, index) => each.saveAcceptedAnswerAtomically('room_a', 'match_1', makeWrite({
          actionId: 'action_1', points: 100 + index, score: 100 + index, correctCount: 1, correctResponseTimeMsTotal: 2000 + index,
        }))));

        const geschreven = uitkomsten.filter((uitkomst) => uitkomst.replay === false);
        assert.strictEqual(geschreven.length, 1, `precies één schrijver, kreeg ${geschreven.length} van ${DEELNEMERS}`);
        assert.strictEqual(uitkomsten.filter((uitkomst) => uitkomst.replay === true).length, DEELNEMERS - 1);
      });

      // De score is precies één keer toegekend, en overal dezelfde: het antwoord,
      // het spelerdocument en het scoreboard wijzen naar dezelfde inzending.
      const answer = await store.loadAnswer('room_a', 'match_1', 'round_1', 'player_1');
      const player = await store.loadPlayer('room_a', 'player_1');
      assert.strictEqual(await client().hLen(ANSWERS), 1, 'één antwoord in deze ronde');
      assert.strictEqual(await client().hLen(CACHE), 1, 'één ack in deze room');
      assert.strictEqual(await client().zCard(BOARD), 1, 'één scoreboardregel');
      assert.strictEqual(player.score, answer.points, 'speler en antwoord komen uit dezelfde inzending');
      assert.strictEqual(player.correctResponseTimeMsTotal, 2000 + (answer.points - 100));
      assert.strictEqual(await client().zScore(BOARD, 'player_1'), player.score, 'scoreboard en speler lopen niet uiteen');
      assert.ok(answer.points >= 100 && answer.points < 100 + DEELNEMERS, `de winnende waarde is echt aangeboden: ${answer.points}`);
    });

    it(`${DEELNEMERS} gelijktijdige inzendingen met VERSCHILLENDE actionIds in dezelfde ronde: één wint, de rest wordt afgewezen`, async () => {
      await arrangePlayer();

      await withConcurrentStores(async (stores) => {
        const uitkomsten = await Promise.all(stores.map((each, index) => each
          .saveAcceptedAnswerAtomically('room_a', 'match_1', makeWrite({
            actionId: `action_${index}`, points: 100 + index, score: 100 + index,
            correctCount: 1, correctResponseTimeMsTotal: 2000 + index,
          }))
          .then((uitkomst) => ({ ok: true, index, uitkomst }), (error) => ({ ok: false, index, error }))));

        const gewonnen = uitkomsten.filter((each) => each.ok);
        const afgewezen = uitkomsten.filter((each) => !each.ok);
        assert.strictEqual(gewonnen.length, 1, `precies één winnaar, kreeg ${gewonnen.length} van ${DEELNEMERS}`);
        assert.deepStrictEqual(gewonnen[0].uitkomst, { replay: false });
        for (const verloren of afgewezen) {
          assert.ok(verloren.error instanceof RangeError, `deelnemer ${verloren.index}: ${verloren.error?.name}`);
          assert.strictEqual(
            verloren.error.code, 'ALREADY_ANSWERED',
            `deelnemer ${verloren.index} hoort ALREADY_ANSWERED te krijgen, kreeg: ${verloren.error?.message}`
          );
        }

        // De ack van een afgewezen inzending mag nergens staan.
        const winnaar = gewonnen[0].index;
        assert.strictEqual(await client().hLen(CACHE), 1);
        assert.strictEqual(await client().hExists(CACHE, `action_${winnaar}`), 1);

        const player = await store.loadPlayer('room_a', 'player_1');
        assert.strictEqual(player.score, 100 + winnaar, 'de score is precies één keer toegekend, en wel die van de winnaar');
        assert.strictEqual(player.correctCount, 1, 'nooit twee keer opgeteld');
        assert.strictEqual(await client().zScore(BOARD, 'player_1'), 100 + winnaar);
        assert.strictEqual(await client().hLen(ANSWERS), 1);
        assert.strictEqual((await store.loadAnswer('room_a', 'match_1', 'round_1', 'player_1')).actionId, `action_${winnaar}`);
      });
    });

    it(`${DEELNEMERS} spelers die tegelijk antwoorden leveren ${DEELNEMERS} scoreboardregels op, elk met een aangeboden waarde`, async () => {
      // De interleaving-test uit de conformance-suite, maar met zes keer zoveel
      // deelnemers als de fake ooit kreeg (vier) en over losse verbindingen.
      await fresh();
      const ids = Array.from({ length: DEELNEMERS }, (_, index) => `player_${String(index + 1).padStart(2, '0')}`);
      for (const [index, id] of ids.entries()) {
        await store.savePlayer(makePlayer({ id, sessionId: `session_${id}`, score: 0 }));
      }

      await withConcurrentStores(async (stores) => {
        await Promise.all(stores.map((each, index) => each.saveAcceptedAnswerAtomically('room_a', 'match_1', makeWrite({
          playerId: ids[index], actionId: `action_${ids[index]}`, points: 100 + index, score: 100 + index,
        }))));
      });

      const board = await store.getScoreboardTop('room_a', 'match_1', DEELNEMERS * 2);
      assert.strictEqual(board.length, DEELNEMERS, 'één regel per speler, geen dubbele en geen verdwenen regel');
      assert.deepStrictEqual(board.map((entry) => entry.playerId).sort(), [...ids].sort());
      for (const entry of board) {
        const index = ids.indexOf(entry.playerId);
        assert.strictEqual(entry.score, 100 + index, `${entry.playerId} draagt zijn eigen aangeboden score`);
        assert.strictEqual((await store.loadPlayer('room_a', entry.playerId)).score, entry.score, `${entry.playerId}: speler en scoreboard lopen niet uiteen`);
        assert.strictEqual((await store.loadAnswer('room_a', 'match_1', 'round_1', entry.playerId)).points, 100 + index);
      }
      assert.strictEqual(await client().hLen(CACHE), DEELNEMERS, 'elke inzending heeft precies één ack');
    });
  });

  // ------------------------------------------------------------------
  // 7. De stand van zaken van de adapter, machineleesbaar.
  //
  // Dit blok heette "de methode die hier NIET hoort" en legde vast wát er nog
  // ontbrak. Er ontbreekt niets meer; het blok blijft staan omdat "niets
  // ontbreekt" precies zo'n uitspraak is die een samensteller moet kunnen
  // aflezen — en omdat een lege `UNIMPLEMENTED_METHODS` alleen betekenis heeft
  // als iets hem controleert.
  // ------------------------------------------------------------------
  describe('Redis-adapter — stand van zaken', () => {
    it('UNIMPLEMENTED_METHODS is leeg: elke poortmethode draait tegen echte Redis', () => {
      assert.deepStrictEqual(Object.keys(UNIMPLEMENTED_METHODS), []);
      // De drie die hier ooit stonden, elk met het item dat ze heeft afgemaakt.
      // Ze staan met naam genoemd zodat een terugval ("even een stub erin")
      // hier opvalt en niet pas als een samensteller een lege lijst gelooft.
      assert.strictEqual(UNIMPLEMENTED_METHODS.setRoomAndMatchPhaseAtomically, undefined, 'INTB2d');
      assert.strictEqual(UNIMPLEMENTED_METHODS.saveAcceptedAnswerAtomically, undefined, 'INTB2c');
      assert.strictEqual(UNIMPLEMENTED_METHODS.loadSessionByTokenHash, undefined, 'INTB2f');
    });

    it('elke naam uit DATA_STORE_METHOD_NAMES is aanroepbaar zonder NOT_IMPLEMENTED', async () => {
      // `assertImplementsDataStore` ziet alleen dát er een functie staat (zie de
      // test hieronder). Deze controle is de tegenhanger: geen enkele methode
      // mag nog een `code: 'NOT_IMPLEMENTED'`-fout opleveren. Ze worden met
      // opzet met kansloze argumenten aangeroepen — het gaat om de FOUTSOORT,
      // niet om een geslaagde aanroep.
      await fresh();
      const created = createRedisDataStore({ connection });
      for (const methodName of DATA_STORE_METHOD_NAMES) {
        try {
          await created[methodName]('room_a', 'x', 'y', 'z');
        } catch (error) {
          assert.notStrictEqual(
            /** @type {{code?: string}} */ (error)?.code,
            'NOT_IMPLEMENTED',
            `${methodName} werpt nog NOT_IMPLEMENTED`
          );
        }
      }
    });

    it('assertImplementsDataStore slaagt — en dat is precies waarom UNIMPLEMENTED_METHODS bestaat', () => {
      // De shapecheck kan het verschil tussen "geïmplementeerd" en "werpt
      // altijd" niet zien. Deze test legt dat vast zodat niemand de groene
      // shapecheck voor volledigheid aanziet.
      assert.doesNotThrow(() => assertImplementsDataStore(createRedisDataStore({ connection })));
    });

    it('saveAcceptedAnswerAtomically werpt NIET meer — INTB2c heeft hem gebouwd', async () => {
      // De tegenhanger van de test hierboven: dit blok legt de stand van zaken
      // van de adapter vast, en "deze methode is er nu wél" hoort daar net zo
      // goed in als "deze methode is er nog niet".
      await fresh();
      await store.savePlayer(makePlayer());

      assert.deepStrictEqual(
        await store.saveAcceptedAnswerAtomically('room_a', 'match_1', {
          answer: makeAnswer(),
          updatedPlayer: { id: 'player_1', score: 120, correctCount: 1, correctResponseTimeMsTotal: 2000 },
          actionCacheEntry: { actionId: 'action_1', ack: { roundId: 'round_1' } },
        }),
        { replay: false }
      );

      assert.deepStrictEqual(await store.loadAnswer('room_a', 'match_1', 'round_1', 'player_1'), makeAnswer());
      assert.deepStrictEqual(await store.loadActionCacheEntry('room_a', 'action_1'), {
        actionId: 'action_1', ack: { roundId: 'round_1' },
      });
      assert.deepStrictEqual(await store.getScoreboardTop('room_a', 'match_1', 10), [{ playerId: 'player_1', score: 120 }]);
      assert.strictEqual((await store.loadPlayer('room_a', 'player_1')).score, 120);
    });

    it('setRoomAndMatchPhaseAtomically werpt NIET meer — INTB2d heeft hem gebouwd', async () => {
      // De tegenhanger van de test hierboven, en bewust blijven staan in plaats
      // van weggehaald: dit blok is de plek waar de stand van zaken van de
      // adapter wordt vastgelegd, en "deze methode is er nu wél" hoort daar net
      // zo goed in als "deze methode is er nog niet".
      await fresh();
      await store.saveRoom(makeRoom({ phase: 'LOBBY' }));
      await store.saveMatch(makeMatch({ phase: 'LOBBY' }));

      assert.deepStrictEqual(
        await store.setRoomAndMatchPhaseAtomically('room_a', 'match_1', {
          expectedPhase: 'LOBBY', newPhase: 'SCOREBOARD', pausedState: null,
        }),
        { ok: true }
      );

      assert.strictEqual((await store.loadRoom('room_a')).phase, 'SCOREBOARD');
      assert.strictEqual((await store.loadMatch('room_a', 'match_1')).phase, 'SCOREBOARD');
    });
  });
}
