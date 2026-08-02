// De Redis-adapter van de DataStore-poort (server/data/repository.js) —
// INTB2b, uitgebreid met de atomaire fasewissel in INTB2d.
//
// Eenentwintig van de drieëntwintig poortmethoden draaien hier tegen echte
// Redis. De twee die ontbreken zijn geen vergeten werk maar apart belegd:
//
// (De poort is tijdens dit werk twee keer uitgebreid: DM14/§10
// `loadSessionByTokenHash` en DM16/§9 `rotateRoomLocators`. De tweede is
// gebouwd — het is een locator-lifecyclemethode en die horen bij dit item; de
// eerste kán niet, zie hieronder.)
//
//   * `loadSessionByTokenHash` -> GEBLOKKEERD op de sleutelcatalogus. DM14/§10
//     heeft deze methode aan de poort toegevoegd terwijl `redis-keys.js` (en
//     `DATA-MODEL.md` §Redis-sleutels) geen sleutel voor een tokenHash kent, en
//     de signatuur geen `roomId` draagt. Zie de uitgebreide noot bij de functie
//     zelf voor wat er precies nodig is; het is dezelfde klasse blokkade als
//     INTB-1 was.
//   * `saveAcceptedAnswerAtomically` -> INTB2c. Bij aanvang van dit item
//     geblokkeerd: het gebundelde poortvoorstel van INT-A zou deze methode een
//     expliciete returnwaarde geven, en een Lua-script schrijven tegen een
//     contract dat nog beweegt levert een tweede mening over idempotentie op.
//     TIJDENS DIT WERK IS DIE BLOKKADE OPGEHEVEN: DM15 (reactie op INT-14) legt
//     in `repository.js` `{ replay: boolean }` vast, inclusief het foutcontract.
//     INTB2c kan dus gebouwd worden; het valt alleen buiten de scope die deze
//     opdracht meekreeg.
//
// `setRoomAndMatchPhaseAtomically` stond hier ook; die is in INTB2d gebouwd
// (zie `SET_PHASE_LUA` en de functie zelf, inclusief wat er bij een onderbroken
// uitvoering wél en niet gegarandeerd is).
//
// Beide werpen `NotImplementedError` met de verwijzing erin, en staan ook in
// `UNIMPLEMENTED_METHODS` hieronder. Dat laatste is er met opzet: de INTB2b-
// prompt waarschuwt dat placeholderfuncties `assertImplementsDataStore` laten
// slagen terwijl de adapter niet af is. Die shapecheck kan dat niet zien — een
// werpende functie is nog steeds een functie — dus is er een tweede, expliciete
// manier om het wél te zien, in plaats van te vertrouwen op wie het commentaar
// leest.
//
// WAT DEZE ADAPTER NIET ZELF VERZINT:
//   * sleutels komen uit `server/data/redis-keys.js` — hier wordt geen enkele
//     sleutelnaam samengesteld, ook niet in Lua (elke sleutel gaat als KEYS[i]
//     naar binnen, wat meteen clusterveilig is);
//   * de TTL komt uit `server/data/ttl.js`;
//   * de serialisatie komt uit `./documents.mjs` (versie-envelop, DECISIONS #22);
//   * de verbinding komt uit `./connection.mjs`.
//
// DE TTL-REFRESHMATRIX, en waar hij ophoudt (`ttl.js` noemt dit expliciet als
// open punt, DATA-MODEL.md §TTL zegt alleen "roomkern, indexes en relevante
// matchkeys"):
//
//   * ELKE schrijfactie ververst de TTL van de roomkern (`room:{roomId}`) én
//     van alle room-brede sleutels die uit `roomId` alleen af te leiden zijn:
//     de sessions- en players-hashes, de action-cache en de revoked-sessions.
//     Een `EXPIRE` op een niet-bestaande sleutel is een no-op, dus dit maakt
//     nooit iets aan. Dit is het antwoord op "een room die nog gespeeld wordt
//     mag niet verlopen omdat alleen het matchdocument werd aangeraakt".
//   * Een match-gescopeerde schrijfactie ververst daarbovenop de matchkey, de
//     scoreboardkey en de sleutel die hij zelf schrijft.
//   * De code-index (`room:code:{code}`) beweegt mee met `saveRoom` — daar is
//     de code bekend — en met claim/refresh van de locators.
//   * De invite-index (`room:invite:{inviteHash}`) kan ALLEEN via de
//     locator-lifecycle worden ververst. Een `Room` draagt een plat `inviteId`,
//     geen hash (DM10), dus geen enkele andere schrijfactie kán die sleutel
//     kennen. Dat is precies waarom DM10 `refreshRoomLocators` heeft
//     toegevoegd; het is de aangewezen keep-alive voor beide locators en niet
//     iets dat deze adapter erbij mag verzinnen.
//
// DECISIONS #28: ESM, `.mjs`.

import { documentCodec } from './documents.mjs';

// `server/data/*.js` is CommonJS; de named imports hieronder werken ongewijzigd
// via Node's CJS-interop, net als in data-store-conformance.mjs.
import {
  actionCacheKey,
  answersKey,
  matchKey,
  revokedSessionsKey,
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
import { assertRoomShape } from '../../types/room.js';
import { assertSessionShape } from '../../types/session.js';
import { assertPlayerShape } from '../../types/player.js';
import { assertMatchShape } from '../../types/match.js';
import { assertRoundShape } from '../../types/round.js';

/**
 * De poortmethoden die deze adapter BEWUST niet implementeert, met het item dat
 * ze afmaakt. Machineleesbaar, zodat een samensteller (INT-A) kan controleren
 * of de adapter compleet genoeg is voor wat hij van plan is — in plaats van dat
 * `assertImplementsDataStore` groen geeft op functies die alleen maar werpen.
 */
export const UNIMPLEMENTED_METHODS = Object.freeze({
  saveAcceptedAnswerAtomically: 'INTB2c',
  loadSessionByTokenHash: 'GEBLOKKEERD — geen sleutel in redis-keys.js (zie hieronder)',
});

/** Foutklasse van de twee nog niet gebouwde methoden. Stabiel om op te matchen. */
export class NotImplementedError extends Error {
  /**
   * @param {string} methodName
   * @param {string} item
   * @param {string} why
   */
  constructor(methodName, item, why) {
    super(`${methodName} is in deze adapter nog niet geïmplementeerd — dat is ${item}. ${why}`);
    this.name = 'NotImplementedError';
    /** @type {string} */
    this.code = 'NOT_IMPLEMENTED';
    /** @type {string} */
    this.method = methodName;
    /** @type {string} */
    this.item = item;
  }
}

// --------------------------------------------------------------------------
// Lua. De meeste scripts hieronder bestaan omdat een lees gevolgd door een
// schrijf over twee netwerkbeurten precies het venster is waarin twee rooms
// dezelfde join-code krijgen (HANDOFF-item INTB-2); het laatste script bestaat
// omdat twee documenten in twee opdrachten bijwerken het dual-write-pad is dat
// DECISIONS #30 verbiedt. Geen enkele sleutel wordt in Lua samengesteld: alles
// komt als KEYS[i] binnen.
// --------------------------------------------------------------------------

/**
 * Claimt code en invite-hash SAMEN of geen van beide (DM10-beslissing 1).
 * KEYS: [codeIndex, inviteIndex]. ARGV: [roomId, ttlSeconds].
 * Retourneert 'ok' | 'code' | 'inviteHash'.
 *
 * Volgorde van de twee conflictcontroles is vast (code eerst, DM10 stap 2) en
 * gebeurt VOORDAT er iets geschreven wordt: een implementatie die de vrije helft
 * alvast wegschrijft en pas daarna de andere controleert, lekt een code die
 * niemand meer kan claimen en meldt dat nergens.
 */
const CLAIM_LOCATORS_LUA = `
local roomId = ARGV[1]
local ttl = ARGV[2]
local codeOwner = redis.call('GET', KEYS[1])
local inviteOwner = redis.call('GET', KEYS[2])
if codeOwner == roomId and inviteOwner == roomId then
  redis.call('EXPIRE', KEYS[1], ttl)
  redis.call('EXPIRE', KEYS[2], ttl)
  return 'ok'
end
if codeOwner and codeOwner ~= roomId then return 'code' end
if inviteOwner and inviteOwner ~= roomId then return 'inviteHash' end
redis.call('SET', KEYS[1], roomId, 'EX', ttl)
redis.call('SET', KEYS[2], roomId, 'EX', ttl)
return 'ok'
`;

/**
 * Geeft beide locators vrij, of geen van beide (DM10-beslissing 7).
 * KEYS: [codeIndex, inviteIndex]. ARGV: [roomId]. Retourneert 1 of 0.
 */
const RELEASE_LOCATORS_LUA = `
local roomId = ARGV[1]
if redis.call('GET', KEYS[1]) == roomId and redis.call('GET', KEYS[2]) == roomId then
  redis.call('DEL', KEYS[1], KEYS[2])
  return 1
end
return 0
`;

/**
 * Verlengt beide locators, en meteen de room-brede sleutels: een refresh is het
 * signaal "deze room leeft nog".
 * KEYS: [codeIndex, inviteIndex, ...roomScope]. ARGV: [roomId, locatorTtl, roomTtl].
 * Retourneert 1 (bezit bevestigd) of 0 (niet de eigenaar -> RangeError).
 */
const REFRESH_LOCATORS_LUA = `
local roomId = ARGV[1]
if redis.call('GET', KEYS[1]) ~= roomId or redis.call('GET', KEYS[2]) ~= roomId then return 0 end
redis.call('EXPIRE', KEYS[1], ARGV[2])
redis.call('EXPIRE', KEYS[2], ARGV[2])
for i = 3, #KEYS do redis.call('EXPIRE', KEYS[i], ARGV[3]) end
return 1
`;

/**
 * Wisselt beide locators in één stap (DM16/§9, reactie op INTB-5): oud
 * vrijgeven én nieuw claimen, of geen van beide.
 * KEYS: [oudeCodeIndex, oudeInviteIndex, nieuweCodeIndex, nieuweInviteIndex].
 * ARGV: [roomId, ttlSeconds].
 * Retourneert 'ok' | 'code' | 'inviteHash' | 'not-owner-code' | 'not-owner-inviteHash'.
 *
 * De vergelijking `KEYS[1] ~= KEYS[3]` is de sleutelversie van `oldCode !==
 * newCode`: roteert alleen de invite, dan mag de code-sleutel niet eerst
 * gewist en daarna herschreven worden — dat zou een venster openen waarin de
 * room via geen enkele code bereikbaar is, precies wat dit script voorkomt.
 */
const ROTATE_LOCATORS_LUA = `
local roomId = ARGV[1]
local ttl = ARGV[2]
if redis.call('GET', KEYS[1]) ~= roomId then return 'not-owner-code' end
if redis.call('GET', KEYS[2]) ~= roomId then return 'not-owner-inviteHash' end
local codeOwner = redis.call('GET', KEYS[3])
if codeOwner and codeOwner ~= roomId then return 'code' end
local inviteOwner = redis.call('GET', KEYS[4])
if inviteOwner and inviteOwner ~= roomId then return 'inviteHash' end
if KEYS[1] ~= KEYS[3] then redis.call('DEL', KEYS[1]) end
if KEYS[2] ~= KEYS[4] then redis.call('DEL', KEYS[2]) end
redis.call('SET', KEYS[3], roomId, 'EX', ttl)
redis.call('SET', KEYS[4], roomId, 'EX', ttl)
return 'ok'
`;

/**
 * Schrijft een ronde alleen als de match bestaat — de integriteitscontrole die
 * DM11 bewust heeft behouden (een ronde mag geen wees worden). Als script en
 * niet als EXISTS-gevolgd-door-SET, want daartussen past het verdwijnen van de
 * match.
 * KEYS: [matchKey, roundKey, ...refresh]. ARGV: [document, ttlSeconds].
 * Retourneert 1 of 0.
 */
const SAVE_ROUND_LUA = `
if redis.call('EXISTS', KEYS[1]) == 0 then return 0 end
redis.call('SET', KEYS[2], ARGV[1], 'EX', ARGV[2])
for i = 3, #KEYS do redis.call('EXPIRE', KEYS[i], ARGV[2]) end
return 1
`;

/**
 * Verzet `Room.phase` én `Match.phase` in ÉÉN ondeelbare stap (DECISIONS #30:
 * `Match.phase` is autoritair, `Room.phase` is de afgeleide projectie).
 *
 * KEYS: [roomKey, matchKey, ...refresh]. ARGV: [verwachtRoom, verwachtMatch,
 * nieuwRoom, nieuwMatch, ttlSeconds]. Retourneert
 * 'ok' | 'no-room' | 'no-match' | 'stale'.
 *
 * COMPARE-AND-SET, en niet "lees het document in Lua en pas het daar aan":
 * `cjson` kan een domeindocument niet verliesvrij rondpompen. Een leeg array
 * (`Match.previousMatchQuestionKeys: []`, en dat staat écht in de fixtures)
 * wordt in Lua een lege tabel en komt er als `{}` weer uit — de aanroeper leest
 * dan een object terug waar een array hoorde te staan. Datzelfde geldt voor de
 * getalprecisie van `cjson`. Het JSON-werk gebeurt daarom in JavaScript, met
 * dezelfde codec als elke andere schrijfactie, en dit script krijgt kant-en-
 * klare strings. De twee `~=`-vergelijkingen sluiten het gat dat daardoor
 * ontstaat: is een van beide documenten tussen de lees en dit script veranderd,
 * dan schrijft het script niets en probeert de aanroeper het opnieuw — in
 * plaats van andermans schrijfactie te overschrijven met een verouderd
 * document.
 *
 * De bestaanscontroles staan BEWUST vóór elke schrijfactie en zitten in
 * hetzelfde script: `EXISTS` gevolgd door `SET` over twee netwerkbeurten laat
 * bij een onbekende match precies de half bijgewerkte toestand achter die #30
 * verbiedt.
 *
 * Dat die twee `if not …`-regels bovendien REDUNDANT zijn ten opzichte van de
 * compare-and-set, is bekend en geen reden ze weg te halen: een verdwenen
 * sleutel is nooit gelijk aan het verwachte document, dus zonder deze regels
 * levert hetzelfde geval 'stale' op en komt de aanroeper via een herlezing bij
 * dezelfde `RangeError` uit — alleen vijf pogingen later en met een fout die
 * "er wordt te veel gelijktijdig geschreven" zegt in plaats van "die match
 * bestaat niet". De mutatietest bij dit item bevestigt dat: het weghalen van
 * alleen deze twee regels verandert geen enkel testresultaat. Ze staan er voor
 * de juiste diagnose op de eerste poging.
 */
const SET_PHASE_LUA = `
local room = redis.call('GET', KEYS[1])
if not room then return 'no-room' end
local match = redis.call('GET', KEYS[2])
if not match then return 'no-match' end
if room ~= ARGV[1] then return 'stale' end
if match ~= ARGV[2] then return 'stale' end
redis.call('SET', KEYS[1], ARGV[3], 'EX', ARGV[5])
redis.call('SET', KEYS[2], ARGV[4], 'EX', ARGV[5])
for i = 3, #KEYS do redis.call('EXPIRE', KEYS[i], ARGV[5]) end
return 'ok'
`;

/**
 * Hoe vaak `setRoomAndMatchPhaseAtomically` het opnieuw probeert als een ander
 * schrijfpad tussen de lees en de compare-and-set door kwam. Eindig, want een
 * oneindige lus onder aanhoudende drukte is een hangende request; ruim genoeg,
 * want elke poging kost twee GETs en een EVAL en er is geen tweede schrijver
 * die `Room`/`Match` in een strakke lus bewerkt.
 */
const PHASE_SWAP_ATTEMPTS = 5;

/**
 * @param {unknown} value
 * @param {string} name
 * @returns {number}
 */
function assertPositiveInteger(value, name) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new TypeError(`${name} moet een positief geheel getal zijn, kreeg: ${JSON.stringify(value)}`);
  }
  return value;
}

/**
 * Bouwt een DataStore die tegen Redis praat.
 *
 * @param {object} options
 * @param {{ getClient: () => object }} options.connection - uit `./connection.mjs`.
 *   Er wordt per aanroep opnieuw `getClient()` gedaan en geen client
 *   vastgehouden: na een herverbinding is de oude client dood, en een adapter
 *   die hem bewaart praat tegen een socket die niemand meer leest.
 * @param {number} [options.ttlSeconds] - room-TTL. Standaard `ROOM_TTL_SECONDS`
 *   uit `ttl.js`; de parameter bestaat voor tests, niet om er in productie een
 *   eigen getal in te zetten.
 * @param {object} [options.codec] - documentcodec, standaard `documentCodec`.
 * @returns {import('../../repository').DataStore}
 */
export function createRedisDataStore({ connection, ttlSeconds = ROOM_TTL_SECONDS, codec = documentCodec } = {}) {
  if (typeof connection?.getClient !== 'function') {
    throw new TypeError('createRedisDataStore verwacht een `connection` met getClient() (zie ./connection.mjs).');
  }
  assertPositiveInteger(ttlSeconds, 'ttlSeconds');
  const ttl = String(ttlSeconds);

  function client() {
    return connection.getClient();
  }

  /**
   * De room-brede sleutels die uit `roomId` alleen zijn af te leiden. Elke
   * schrijfactie ververst ze; zie de refreshmatrix bovenaan dit bestand.
   * @param {string} roomId
   * @returns {string[]}
   */
  function roomScopeKeys(roomId) {
    return [
      roomKey(roomId),
      roomSessionsKey(roomId),
      roomPlayersKey(roomId),
      actionCacheKey(roomId),
      revokedSessionsKey(roomId),
    ];
  }

  /**
   * Zet de TTL-refresh van de room-scope (plus eventuele extra sleutels) op een
   * MULTI-keten. Alles in dezelfde transactie als de schrijfactie zelf: een
   * document dat wél landt terwijl de TTL-refresh eromheen uitblijft, is een
   * room die middenin een potje verdwijnt.
   * @param {object} chain
   * @param {string} roomId
   * @param {string[]} [extraKeys]
   */
  function refreshTtl(chain, roomId, extraKeys = []) {
    for (const key of [...roomScopeKeys(roomId), ...extraKeys]) {
      chain.expire(key, ttlSeconds);
    }
    return chain;
  }

  // ----------------------------------------------------------------------
  // Room
  // ----------------------------------------------------------------------

  /** @param {string} roomId */
  async function loadRoom(roomId) {
    return codec.decode('room', await client().get(roomKey(roomId)));
  }

  /** @param {import('../../types/room').Room} room */
  async function saveRoom(room) {
    // Vormcontrole op de SCHRIJFkant, zoals documents.mjs aankondigt: de codec
    // valideert bewust niet, "die controle hoort bij de poortmethode in
    // INTB2b". Alleen bij het schrijven, want een leescontrole zou een document
    // dat er al staat onleesbaar maken in plaats van het probleem bij de bron
    // te leggen.
    assertRoomShape(room);
    const chain = client().multi();
    chain.set(roomKey(room.id), codec.encode('room', room), { EX: ttlSeconds });
    // De code-index beweegt mee met saveRoom (INTB-5: een index die naar een
    // oude toestand blijft wijzen is een capability-lek). De invite-index kan
    // dat niet — Room draagt geen hash — en loopt via de locator-lifecycle.
    chain.set(roomCodeLookupKey(room.code), room.id, { EX: ttlSeconds });
    chain.sAdd(roomsActiveKey(), room.id);
    refreshTtl(chain, room.id);
    await chain.exec();
  }

  /** @param {string} code */
  async function loadRoomByCode(code) {
    const roomId = await client().get(roomCodeLookupKey(code));
    return roomId === null ? null : loadRoom(roomId);
  }

  /** @param {string} inviteHash */
  async function loadRoomByInviteHash(inviteHash) {
    const roomId = await client().get(roomInviteLookupKey(inviteHash));
    return roomId === null ? null : loadRoom(roomId);
  }

  // ----------------------------------------------------------------------
  // Room-locators (DM10)
  // ----------------------------------------------------------------------

  /** @param {import('../../repository').RoomLocatorClaim} claim */
  async function claimRoomLocatorsAtomically({ roomId, code, inviteHash, ttlSeconds: claimTtl }) {
    assertPositiveInteger(claimTtl, 'RoomLocatorClaim.ttlSeconds');
    const outcome = await client().eval(CLAIM_LOCATORS_LUA, {
      keys: [roomCodeLookupKey(code), roomInviteLookupKey(inviteHash)],
      arguments: [roomId, String(claimTtl)],
    });
    if (outcome === 'ok') return { ok: true };
    if (outcome === 'code' || outcome === 'inviteHash') return { ok: false, conflict: outcome };
    throw new Error(`claimRoomLocatorsAtomically: onverwacht scriptresultaat ${JSON.stringify(outcome)}`);
  }

  /** @param {import('../../repository').RoomLocatorPair} pair */
  async function releaseRoomLocators({ roomId, code, inviteHash }) {
    await client().eval(RELEASE_LOCATORS_LUA, {
      keys: [roomCodeLookupKey(code), roomInviteLookupKey(inviteHash)],
      arguments: [roomId],
    });
  }

  /** @param {import('../../repository').RoomLocatorClaim} claim */
  async function refreshRoomLocators({ roomId, code, inviteHash, ttlSeconds: claimTtl }) {
    assertPositiveInteger(claimTtl, 'RoomLocatorClaim.ttlSeconds');
    const owned = await client().eval(REFRESH_LOCATORS_LUA, {
      keys: [roomCodeLookupKey(code), roomInviteLookupKey(inviteHash), ...roomScopeKeys(roomId)],
      arguments: [roomId, String(claimTtl), ttl],
    });
    if (owned !== 1) {
      throw new RangeError(
        `refreshRoomLocators: roomId ${JSON.stringify(roomId)} bezit niet (meer) beide locators — ` +
          'een refresh op een claim die je niet bezit is een programmeerfout of een teken dat de claim al gestolen is.'
      );
    }
  }

  /** @param {import('../../repository').RoomLocatorRotation} rotation */
  async function rotateRoomLocators({ roomId, oldCode, oldInviteHash, newCode, newInviteHash, ttlSeconds: rotationTtl }) {
    assertPositiveInteger(rotationTtl, 'RoomLocatorRotation.ttlSeconds');
    const outcome = await client().eval(ROTATE_LOCATORS_LUA, {
      keys: [
        roomCodeLookupKey(oldCode),
        roomInviteLookupKey(oldInviteHash),
        roomCodeLookupKey(newCode),
        roomInviteLookupKey(newInviteHash),
      ],
      arguments: [roomId, String(rotationTtl)],
    });
    if (outcome === 'ok') return { ok: true };
    if (outcome === 'code' || outcome === 'inviteHash') return { ok: false, conflict: outcome };
    if (outcome === 'not-owner-code') {
      throw new RangeError(
        `rotateRoomLocators: roomId ${JSON.stringify(roomId)} bezit oldCode ${JSON.stringify(oldCode)} niet (meer)`
      );
    }
    if (outcome === 'not-owner-inviteHash') {
      throw new RangeError(
        `rotateRoomLocators: roomId ${JSON.stringify(roomId)} bezit oldInviteHash ${JSON.stringify(oldInviteHash)} niet (meer)`
      );
    }
    throw new Error(`rotateRoomLocators: onverwacht scriptresultaat ${JSON.stringify(outcome)}`);
  }

  // ----------------------------------------------------------------------
  // Session
  // ----------------------------------------------------------------------

  /**
   * @param {string} roomId
   * @param {string} sessionId
   */
  async function loadSession(roomId, sessionId) {
    return codec.decode('session', await client().hGet(roomSessionsKey(roomId), sessionId));
  }

  /** @param {import('../../types/session').Session} session */
  async function saveSession(session) {
    assertSessionShape(session);
    const chain = client().multi();
    chain.hSet(roomSessionsKey(session.roomId), session.id, codec.encode('session', session));
    // GEEN tokenHash-index — zie loadSessionByTokenHash hieronder. De fake vult
    // hem hier wél (DM14/§10); dat verschil is bekend en gemeld, niet vergeten.
    refreshTtl(chain, session.roomId);
    await chain.exec();
  }

  /**
   * NIET IMPLEMENTEERBAAR MET DE HUIDIGE SLEUTELCATALOGUS — dezelfde klasse
   * blokkade als INTB-1, één laag lager.
   *
   * DM14/§10 heeft deze methode aan de poort toegevoegd met de redenering "de
   * index kan gewoon door `saveSession` gevuld worden, net zoals `saveRoom` dat
   * al voor `roomIdByCode` doet". Dat klopt voor de fake, want daar is een index
   * een `Map` die je ter plekke verzint. Voor Redis klopt het niet: `saveRoom`
   * kan `roomIdByCode` vullen omdat `room:code:{code}` in `redis-keys.js` én in
   * `DATA-MODEL.md` §Redis-sleutels staat. Er is geen equivalent voor een
   * tokenHash, en de signatuur draagt geen `roomId`, dus er is ook geen bestaande
   * sleutel waar de lookup onder zou kunnen hangen.
   *
   * De twee uitwegen die er NIET zijn:
   *   * zelf een sleutelnaam samenstellen — dat is precies wat `redis-keys.js`
   *     centraliseert, en een tweede plek met sleutelkennis is hoe patronen
   *     stilletjes uit elkaar gaan lopen;
   *   * een globale `SCAN` over alle `room:*:sessions` — dat schaalt niet en het
   *     verbergt het probleem in plaats van het op te lossen (de INTB2b-prompt
   *     sluit die noodoplossing expliciet uit).
   *
   * WAT ER NODIG IS, concreet genoeg om over te nemen:
   *   1. `redis-keys.js`: een builder, bijvoorbeeld
   *      `sessionTokenLookupKey(tokenHash)` -> `session:token:{tokenHash}`, met
   *      dezelfde `assertSegment`-behandeling als de rest.
   *   2. `DATA-MODEL.md` §Redis-sleutels: dezelfde regel, met de waarde erbij.
   *      Eén sleutel is genoeg als de waarde room én sessie draagt; twee losse
   *      sleutels betekent een tweede dual-write-pad, en dat is precies wat
   *      DECISIONS #30 elders verbiedt.
   *   3. Een TTL-uitspraak: de room-TTL (de sessie leeft niet langer dan zijn
   *      room), ververst door `saveSession` net als de rest van de room-scope.
   *   4. Een uitspraak over ROTATIE, die in het voorstel ontbreekt: krijgt een
   *      sessie een nieuw token, dan blijft de oude hash naar diezelfde sessie
   *      wijzen — een tweede geldige capability naast de nieuwe. Dat is
   *      letterlijk INTB-5 nog een keer, nu voor sessietokens. De fake heeft dit
   *      gat vandaag ook (`roomAndSessionByTokenHash` wordt nooit opgeruimd);
   *      daar valt het niet op omdat niets het opmerkt.
   *
   * Zolang 1 en 2 er niet zijn, werpt deze methode. Een `SCAN`-noodoplossing
   * hier zou groen opleveren en het besluit onzichtbaar maken.
   */
  async function loadSessionByTokenHash() {
    throw new NotImplementedError(
      'loadSessionByTokenHash',
      UNIMPLEMENTED_METHODS.loadSessionByTokenHash,
      'DM14/§10 voegde deze methode toe zonder bijbehorende sleutel in redis-keys.js/DATA-MODEL.md, en de ' +
        'signatuur draagt geen roomId. Zie het commentaar bij deze functie voor wat er nodig is.'
    );
  }

  // ----------------------------------------------------------------------
  // Player
  // ----------------------------------------------------------------------

  /**
   * @param {string} roomId
   * @param {string} playerId
   */
  async function loadPlayer(roomId, playerId) {
    return codec.decode('player', await client().hGet(roomPlayersKey(roomId), playerId));
  }

  /** @param {import('../../types/player').Player} player */
  async function savePlayer(player) {
    assertPlayerShape(player);
    const chain = client().multi();
    chain.hSet(roomPlayersKey(player.roomId), player.id, codec.encode('player', player));
    refreshTtl(chain, player.roomId);
    await chain.exec();
  }

  /**
   * GEEN VOLGORDEGARANTIE, en dat is geen slordigheid: `room:{roomId}:players`
   * is een Redis-hash en `HGETALL` levert de velden in de volgorde die de
   * hash-implementatie toevallig aanhoudt. De poort belooft ook niets — de
   * conformance-suite sorteert daarom zelf op id. Hier alsnog sorteren zou een
   * garantie afgeven die de fake niet heeft en die aanroepers stilzwijgend
   * gaan gebruiken.
   * @param {string} roomId
   */
  async function listPlayers(roomId) {
    const stored = await client().hGetAll(roomPlayersKey(roomId));
    return Object.values(stored).map((raw) => codec.decode('player', raw));
  }

  // ----------------------------------------------------------------------
  // Match
  // ----------------------------------------------------------------------

  /**
   * @param {string} roomId
   * @param {string} matchId
   */
  async function loadMatch(roomId, matchId) {
    return codec.decode('match', await client().get(matchKey(roomId, matchId)));
  }

  /** @param {import('../../types/match').Match} match */
  async function saveMatch(match) {
    assertMatchShape(match);
    const chain = client().multi();
    chain.set(matchKey(match.roomId, match.id), codec.encode('match', match), { EX: ttlSeconds });
    refreshTtl(chain, match.roomId, [scoreboardKey(match.roomId, match.id)]);
    await chain.exec();
  }

  // ----------------------------------------------------------------------
  // Round
  // ----------------------------------------------------------------------

  /**
   * @param {string} roomId
   * @param {string} matchId
   * @param {string} roundId
   */
  async function loadRound(roomId, matchId, roundId) {
    return codec.decode('round', await client().get(roundKey(roomId, matchId, roundId)));
  }

  /**
   * @param {string} roomId
   * @param {import('../../types/round').Round} round
   */
  async function saveRound(roomId, round) {
    assertRoundShape(round);
    const match = matchKey(roomId, round.matchId);
    const written = await client().eval(SAVE_ROUND_LUA, {
      keys: [
        match,
        roundKey(roomId, round.matchId, round.id),
        match,
        scoreboardKey(roomId, round.matchId),
        ...roomScopeKeys(roomId),
      ],
      arguments: [codec.encode('round', round), ttl],
    });
    if (written !== 1) {
      throw new RangeError(
        `saveRound: no known match ${JSON.stringify(round.matchId)} in room ${JSON.stringify(roomId)} (save the Match first)`
      );
    }
  }

  // ----------------------------------------------------------------------
  // Answer / action-cache / scoreboard — leeskant
  //
  // De schrijfkant van alle drie loopt via saveAcceptedAnswerAtomically en is
  // dus INTB2c. Deze drie lezers zijn wél af: ze hebben geen enkele
  // afhankelijkheid van hoe dat script er straks uitziet, want de sleutels en
  // de envelop liggen al vast.
  // ----------------------------------------------------------------------

  /**
   * @param {string} roomId
   * @param {string} matchId
   * @param {string} roundId
   * @param {string} playerId
   */
  async function loadAnswer(roomId, matchId, roundId, playerId) {
    return codec.decode('answer', await client().hGet(answersKey(roomId, matchId, roundId), playerId));
  }

  /**
   * @param {string} roomId
   * @param {string} actionId
   */
  async function loadActionCacheEntry(roomId, actionId) {
    return codec.decode('action-cache-entry', await client().hGet(actionCacheKey(roomId), actionId));
  }

  /**
   * @param {string} roomId
   * @param {string} matchId
   * @param {number} limit
   */
  async function getScoreboardTop(roomId, matchId, limit) {
    // `slice(0, limit)` in de fake levert bij limit <= 0 een lege lijst; ZRANGE
    // met stop = -1 zou juist ALLES teruggeven. Zonder deze afhandeling is
    // `limit: 0` het verschil tussen "niets" en "het hele scoreboard".
    if (!Number.isFinite(limit) || limit < 1) return [];
    const rows = await client().zRangeWithScores(scoreboardKey(roomId, matchId), 0, Math.floor(limit) - 1, {
      REV: true,
    });
    return rows.map((row) => ({ playerId: row.value, score: row.score }));
  }

  // ----------------------------------------------------------------------
  // Fasewissel (DECISIONS #30) — INTB2d
  // ----------------------------------------------------------------------

  /**
   * Zet `Room.phase` en `Match.phase` samen op `newPhase`, of geen van beide.
   *
   * DECISIONS #30: `Match.phase` is autoritair, `Room.phase` is een AFGELEIDE
   * PROJECTIE die in DEZELFDE atomaire operatie meegaat. Twee documenten onder
   * twee sleutels in twee opdrachten bijwerken is het dual-write-pad dat #30
   * verbiedt: valt de verbinding ertussen weg, dan leest de rest van het
   * systeem een projectie die een andere fase noemt dan de autoriteit.
   *
   * WAT ER GEBEURT ALS DE UITVOERING WORDT ONDERBROKEN — lees dit voordat je
   * hier een rollback-verwachting aan toevoegt:
   *
   *   beide documenten zijn oud óf beide documenten zijn nieuw,
   *   nooit één oud en één nieuw.
   *
   * Dat is de garantie, en het is NIET "bij een netwerkfout blijft alles oud".
   * Een Lua-script draait server-side tot het einde door; valt de clientsocket
   * weg terwijl het loopt, dan landt de wissel gewoon en verdwijnt alleen het
   * antwoord. De aanroeper krijgt dan een verbindingsfout en weet niet welke
   * van de twee uitkomsten het werd. De enige manier om dat te weten is na een
   * reconnect de autoritatieve state opnieuw lezen (`loadMatch`). Redis kan
   * een geland script niet terugdraaien — een `assert` dat na een
   * netwerkonderbreking de oude fase eist, test iets dat geen enkele
   * Redis-implementatie kan waarmaken.
   *
   * IDEMPOTENT: dezelfde fase nog een keer zetten is geen fout. Het schrijft
   * wél opnieuw, want een fasewissel is activiteit en de TTL-refresh eromheen
   * (`ttl.js`, refreshmatrix bovenaan dit bestand) hoort dan ook te gebeuren.
   *
   * BEWUST NIET GEBOUWD: zelfherstel voor een projectie die uit de pas is
   * geraakt. Deze methode schrijft altijd beide documenten, dus ze kán een
   * scheefstand niet zien — ze overschrijft hem gewoon met `newPhase`. Wil
   * iemand `Match.phase` als bron gebruiken om een afgedwaalde `Room.phase`
   * terug te zetten, dan is dat een eigen poortmethode met een eigen naam, geen
   * verborgen bijwerking hier. Gemeld, niet ongevraagd ingebouwd.
   *
   * @param {string} roomId
   * @param {string} matchId
   * @param {string} newPhase - komt uit `server/architecture/state-machine.js`;
   *   hier niet opnieuw gevalideerd, de store slaat op wat hij krijgt.
   * @returns {Promise<void>}
   */
  async function setRoomAndMatchPhaseAtomically(roomId, matchId, newPhase) {
    const room = roomKey(roomId);
    const match = matchKey(roomId, matchId);

    for (let attempt = 1; attempt <= PHASE_SWAP_ATTEMPTS; attempt += 1) {
      // Lezen gebeurt buiten het script (zie SET_PHASE_LUA voor waarom), dus
      // deze twee GETs zijn de basis van een compare-and-set en geen
      // "kijken-en-dan-blind-schrijven". De onbewerkte strings gaan mee terug
      // naar Redis als verwachtingswaarde.
      const storedRoom = await client().get(room);
      if (storedRoom === null) {
        throw new RangeError(`setRoomAndMatchPhaseAtomically: unknown roomId ${JSON.stringify(roomId)}`);
      }
      const storedMatch = await client().get(match);
      if (storedMatch === null) {
        throw new RangeError(
          `setRoomAndMatchPhaseAtomically: unknown matchId ${JSON.stringify(matchId)} for roomId ${JSON.stringify(roomId)}`
        );
      }

      const outcome = await client().eval(SET_PHASE_LUA, {
        keys: [room, match, ...roomScopeKeys(roomId), scoreboardKey(roomId, matchId)],
        arguments: [
          storedRoom,
          storedMatch,
          codec.encode('room', { ...codec.decode('room', storedRoom), phase: newPhase }),
          codec.encode('match', { ...codec.decode('match', storedMatch), phase: newPhase }),
          ttl,
        ],
      });

      if (outcome === 'ok') return;
      // De twee bestaanscontroles zitten óók in het script: tussen de GET
      // hierboven en de EVAL past het verlopen of verwijderen van een sleutel,
      // en dan is "hij bestond net nog" geen grond om te schrijven.
      if (outcome === 'no-room') {
        throw new RangeError(`setRoomAndMatchPhaseAtomically: unknown roomId ${JSON.stringify(roomId)}`);
      }
      if (outcome === 'no-match') {
        throw new RangeError(
          `setRoomAndMatchPhaseAtomically: unknown matchId ${JSON.stringify(matchId)} for roomId ${JSON.stringify(roomId)}`
        );
      }
      if (outcome !== 'stale') {
        throw new Error(`setRoomAndMatchPhaseAtomically: onverwacht scriptresultaat ${JSON.stringify(outcome)}`);
      }
      // 'stale': iemand anders schreef Room of Match tussen de lees en het
      // script. Er is niets geschreven; opnieuw lezen en opnieuw proberen.
    }

    throw new Error(
      `setRoomAndMatchPhaseAtomically: room ${JSON.stringify(roomId)} of match ${JSON.stringify(matchId)} werd ` +
        `${PHASE_SWAP_ATTEMPTS} pogingen achter elkaar onder de operatie vandaan geschreven; er is niets gewijzigd.`
    );
  }

  // ----------------------------------------------------------------------
  // De methode die hier niet thuishoort
  // ----------------------------------------------------------------------

  async function saveAcceptedAnswerAtomically() {
    throw new NotImplementedError(
      'saveAcceptedAnswerAtomically',
      UNIMPLEMENTED_METHODS.saveAcceptedAnswerAtomically,
      'Deze adapter is gebouwd terwijl het contract nog openstond (het gebundelde poortvoorstel van INT-A). ' +
        'Dat voorstel is inmiddels geland — DM15 (reactie op INT-14) legt in repository.js { replay: boolean } ' +
        'vast — dus de blokkade is weg en INTB2c kan gebouwd worden.'
    );
  }

  return {
    loadRoom, saveRoom, loadRoomByCode, loadRoomByInviteHash,
    claimRoomLocatorsAtomically, releaseRoomLocators, refreshRoomLocators, rotateRoomLocators,
    loadSession, saveSession, loadSessionByTokenHash,
    loadPlayer, savePlayer, listPlayers,
    loadMatch, saveMatch,
    loadRound, saveRound,
    loadAnswer,
    setRoomAndMatchPhaseAtomically, saveAcceptedAnswerAtomically,
    loadActionCacheEntry, getScoreboardTop,
  };
}
