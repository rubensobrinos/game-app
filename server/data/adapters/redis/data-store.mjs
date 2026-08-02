// De Redis-adapter van de DataStore-poort (server/data/repository.js) —
// INTB2b, uitgebreid met de atomaire fasewissel in INTB2d en de atomaire
// antwoordverwerking in INTB2c.
//
// Tweeëntwintig van de drieëntwintig poortmethoden draaien hier tegen echte
// Redis. De ene die ontbreekt is geen vergeten werk maar geblokkeerd:
//
// (De poort is tijdens INTB2b twee keer uitgebreid: DM14/§10
// `loadSessionByTokenHash` en DM16/§9 `rotateRoomLocators`. De tweede is
// gebouwd — het is een locator-lifecyclemethode en die horen bij dat item; de
// eerste kán niet, zie hieronder.)
//
//   * `loadSessionByTokenHash` -> GEBLOKKEERD op de sleutelcatalogus. DM14/§10
//     heeft deze methode aan de poort toegevoegd terwijl `redis-keys.js` (en
//     `DATA-MODEL.md` §Redis-sleutels) geen sleutel voor een tokenHash kent, en
//     de signatuur geen `roomId` draagt. Zie de uitgebreide noot bij de functie
//     zelf voor wat er precies nodig is; het is dezelfde klasse blokkade als
//     INTB-1 was.
//
// `setRoomAndMatchPhaseAtomically` stond hier ook; die is in INTB2d gebouwd
// (zie `SET_PHASE_LUA` en de functie zelf, inclusief wat er bij een onderbroken
// uitvoering wél en niet gegarandeerd is). `saveAcceptedAnswerAtomically` stond
// hier ook, geblokkeerd op een bewegend contract; DM15 (reactie op INT-14) legt
// dat contract inmiddels vast in `repository.js` (§FOUTCONTRACT) en INTB2c heeft
// hem gebouwd — zie `SAVE_ANSWER_LUA` en de functie zelf.
//
// De ene resterende methode werpt `NotImplementedError` met de verwijzing erin,
// en staat ook in `UNIMPLEMENTED_METHODS` hieronder. Dat laatste is er met
// opzet: de INTB2b-prompt waarschuwt dat placeholderfuncties
// `assertImplementsDataStore` laten slagen terwijl de adapter niet af is. Die
// shapecheck kan dat niet zien — een werpende functie is nog steeds een functie
// — dus is er een tweede, expliciete manier om het wél te zien, in plaats van te
// vertrouwen op wie het commentaar leest.
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

import { createHash } from 'node:crypto';

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
import { assertAnswerShape } from '../../types/answer.js';

/**
 * De poortmethoden die deze adapter BEWUST niet implementeert, met het item dat
 * ze afmaakt. Machineleesbaar, zodat een samensteller (INT-A) kan controleren
 * of de adapter compleet genoeg is voor wat hij van plan is — in plaats van dat
 * `assertImplementsDataStore` groen geeft op functies die alleen maar werpen.
 */
export const UNIMPLEMENTED_METHODS = Object.freeze({
  loadSessionByTokenHash: 'GEBLOKKEERD — geen sleutel in redis-keys.js (zie hieronder)',
});

/** Foutklasse van de nog niet gebouwde methode(n). Stabiel om op te matchen. */
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
 * DE ATOMAIRE ANTWOORDVERWERKING (DECISIONS #23, DATA-MODEL.md §Atomische
 * antwoordverwerking stappen 4, 5 en 7–10, foutcontract in `repository.js`
 * §FOUTCONTRACT). Hier wordt score toegekend; dit is het script waar "half
 * uitgevoerd" het duurst is.
 *
 * KEYS:
 *   [1] action-cache   `room:{roomId}:action-cache`            (hash)
 *   [2] players        `room:{roomId}:players`                 (hash)
 *   [3] answers        `room:{roomId}:match:{matchId}:answers:{roundId}` (hash)
 *   [4] scoreboard     `room:{roomId}:match:{matchId}:scoreboard`        (zset)
 *   [5..] de sleutels waarvan de TTL mee moet (refreshmatrix bovenaan dit
 *         bestand). Duplicaten van [1]–[4] mogen daar gewoon in staan; een
 *         `EXPIRE` twee keer is een `EXPIRE`.
 * ARGV:
 *   [1] actionId                    [2] ack-document (envelop)
 *   [3] updatedPlayer.id            [4] VERWACHT spelerdocument (compare-and-set)
 *   [5] NIEUW spelerdocument        [6] answer.playerId
 *   [7] answer-document (envelop)   [8] nieuwe score, als scoreboardgetal
 *   [9] ttlSeconds
 * Retourneert 'ok' | 'replay' | 'no-player' | 'stale' | 'already-answered'.
 *
 * DE VOLGORDE VAN DE DRIE CONTROLES IS CONTRACT, geen implementatiedetail:
 *
 *   1. IDEMPOTENTIE (`HEXISTS` op de action-cache) staat vooraan, precies zoals
 *      DM13 het in de fake heeft gezet. Dezelfde `actionId` opnieuw is een
 *      REPLAY: het script keert onmiddellijk terug en raakt niets aan — ook geen
 *      `EXPIRE`. Zonder deze regel vooraan zou een dubbel afgeleverde
 *      socketboodschap op de volgende controle stuklopen als 'al beantwoord',
 *      en dan is een retry niet te onderscheiden van een tweede inzending.
 *   2. DE SPELER moet bestaan (`HGET` levert `false` als het veld er niet is).
 *      Onbekende speler -> de aanroeper werpt `RangeError`. Deze staat vóór de
 *      antwoordcontrole omdat de fake dat ook doet; alleen als beide misgaan
 *      verschilt de foutmelding, en dan is "die speler bestaat niet" de nuttigere.
 *   3. AL BEANTWOORD (`HEXISTS` op de answers-hash van deze ronde): een ándere
 *      `actionId` van dezelfde speler in dezelfde ronde -> de aanroeper werpt
 *      `RangeError` met `code === 'ALREADY_ANSWERED'`. Nooit stilzwijgend
 *      overschrijven.
 *
 * REPLAY EN 'AL BEANTWOORD' ZIJN TWEE VERSCHILLENDE UITKOMSTEN, en dat is het
 * hele punt van deze operatie: de eerste is een geldige, herhaalde actie die
 * dezelfde ack verdient, de tweede is een afgewezen tweede antwoord. Het script
 * geeft daarom twee verschillende strings terug, en de aanroeper vertaalt ze
 * naar twee verschillende kanalen (returnwaarde tegenover getypeerde throw) —
 * zie de wrapper. Één gedeelde uitkomst zou de protocol-adapter dwingen te raden
 * of hij een ack mag versturen.
 *
 * COMPARE-AND-SET OP HET SPELERDOCUMENT, om exact dezelfde reden als in
 * `SET_PHASE_LUA`: `cjson` pompt een domeindocument niet verliesvrij rond (een
 * leeg array komt er als `{}` uit) en de getalprecisie is niet gegarandeerd, dus
 * het JSON-werk gebeurt client-side met dezelfde codec als elke andere
 * schrijfactie. Daardoor zit er per definitie een lees vóór de schrijf, en dat
 * venster wordt hier gedicht: is het spelerdocument tussen de lees en dit script
 * veranderd (een tweede inzending, een `savePlayer` van een naamswijziging), dan
 * schrijft het script NIETS en leest de aanroeper opnieuw. Zonder deze
 * vergelijking zou de operatie andermans schrijfactie overschrijven met een
 * verouderd document — een verloren update, midden in de score.
 *
 * WAT DIT SCRIPT NIET DOET, en niet mag doen: rekenen. Er wordt hier niets
 * beslist over correctheid, tijdbonus of punten. `ARGV[5]` en `ARGV[8]` dragen
 * ABSOLUTE waarden die de aanroeper (`answer-flow.js` met `server/rules/
 * scoring.js`) al heeft uitgerekend. Een optelling in Lua zou domeinlogica uit
 * GR naar de opslaglaag verplaatsen, en dan staat de scoreregel op twee plekken.
 * Er staat om dezelfde reden ook geen `TIME` in: tijd komt overal in deze
 * codebase als argument binnen, anders is het gedrag niet deterministisch
 * testbaar. Deadline en grace (DECISIONS #13) horen bij de aanroeper.
 *
 * De vier writes staan bewust ACHTER alle drie de controles en in één script.
 * `HEXISTS` gevolgd door `HSET` over losse netwerkbeurten is precies het venster
 * waarin twee inzendingen allebei "nog geen antwoord" zien, en dan staat er een
 * antwoord met een scoreboardregel van de ander.
 */
const SAVE_ANSWER_LUA = `
if redis.call('HEXISTS', KEYS[1], ARGV[1]) == 1 then return 'replay' end
local storedPlayer = redis.call('HGET', KEYS[2], ARGV[3])
if not storedPlayer then return 'no-player' end
if storedPlayer ~= ARGV[4] then return 'stale' end
if redis.call('HEXISTS', KEYS[3], ARGV[6]) == 1 then return 'already-answered' end
redis.call('HSET', KEYS[3], ARGV[6], ARGV[7])
redis.call('HSET', KEYS[2], ARGV[3], ARGV[5])
redis.call('ZADD', KEYS[4], ARGV[8], ARGV[3])
redis.call('HSET', KEYS[1], ARGV[1], ARGV[2])
for i = 5, #KEYS do redis.call('EXPIRE', KEYS[i], ARGV[9]) end
return 'ok'
`;

/**
 * De SHA1 van `SAVE_ANSWER_LUA`, hier berekend en niet uit Redis opgehaald: het
 * is dezelfde hash die `SCRIPT LOAD` zou opleveren, en zo is er geen extra
 * netwerkbeurt en geen tweede bron van waarheid. Zie `evalSaveAnswer` voor hoe
 * hij gebruikt wordt en wat er na een Redis-herstart gebeurt.
 */
const SAVE_ANSWER_LUA_SHA = createHash('sha1').update(SAVE_ANSWER_LUA).digest('hex');

/**
 * Hoe vaak `setRoomAndMatchPhaseAtomically` het opnieuw probeert als een ander
 * schrijfpad tussen de lees en de compare-and-set door kwam. Eindig, want een
 * oneindige lus onder aanhoudende drukte is een hangende request; ruim genoeg,
 * want elke poging kost twee GETs en een EVAL en er is geen tweede schrijver
 * die `Room`/`Match` in een strakke lus bewerkt.
 */
const PHASE_SWAP_ATTEMPTS = 5;

/**
 * Idem voor `saveAcceptedAnswerAtomically`. Hier is de tweede schrijver wél
 * reëel — twintig spelers die in dezelfde seconde antwoorden — maar ze botsen
 * alleen op HETZELFDE spelerdocument, en dat is per speler hoogstens één
 * inzending per ronde plus een eventuele `savePlayer`. Vijf pogingen is dus ruim;
 * op is op, want een oneindige lus onder drukte is een hangende request en geen
 * herstel.
 */
const ANSWER_WRITE_ATTEMPTS = 5;

/**
 * Herkent het antwoord van Redis op een `EVALSHA` waarvan het script niet (meer)
 * in de scriptcache staat. Op de melding matchen en niet op een foutklasse: de
 * client levert hier een generieke `SimpleError`, en `NOSCRIPT` is de stabiele,
 * gedocumenteerde voorvoegsel uit het Redis-protocol.
 * @param {unknown} error
 */
function isNoScriptError(error) {
  return typeof (/** @type {{message?: unknown}} */ (error)?.message) === 'string'
    && /** @type {{message: string}} */ (error).message.startsWith('NOSCRIPT');
}

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
  // De schrijfkant van alle drie loopt via saveAcceptedAnswerAtomically (INTB2c,
  // onderaan dit bestand). Deze drie lezers hangen niet van dat script af: ze
  // lezen de sleutels uit redis-keys.js en de envelop uit documents.mjs, en die
  // lagen al vast voordat het script er was.
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
  // Atomaire antwoordverwerking (DECISIONS #23) — INTB2c
  // ----------------------------------------------------------------------

  /**
   * Weet Redis het script nog? Start op `false`: de eerste aanroep gebruikt
   * `EVAL` (dat laadt het script meteen) in plaats van een `EVALSHA` die
   * gegarandeerd `NOSCRIPT` oplevert. Daarna gaat het via de hash.
   */
  let scriptKnownToRedis = false;

  /**
   * Voert `SAVE_ANSWER_LUA` uit VIA ZIJN HASH, met terugval op volledig laden.
   *
   * Waarom via de hash: het script gaat bij elke inzending over de lijn, en dat
   * zijn er in een potje van twintig spelers en tien rondes tweehonderd. Een
   * `EVALSHA` stuurt veertig bytes in plaats van het hele script.
   *
   * WAT ER NA EEN REDIS-HERSTART GEBEURT — dit is de reden dat de terugval
   * bestaat en niet een `SCRIPT LOAD` bij het opstarten van de adapter: de
   * scriptcache van Redis is niet persistent en overleeft geen herstart, geen
   * `SCRIPT FLUSH` en geen failover naar een replica. Eén keer laden bij het
   * opstarten zou dus werken tot de eerste herstart en daarna elke inzending
   * laten falen. In plaats daarvan: `EVALSHA`, en zodra Redis `NOSCRIPT`
   * antwoordt (precies dan, niet bij elke fout) gaat dezelfde aanroep alsnog via
   * `EVAL`, wat het script opnieuw in de cache zet. De aanroeper merkt niets;
   * het kost één extra netwerkbeurt, één keer per herstart.
   *
   * `EVAL` is bovendien niet minder atomair dan `EVALSHA` — het is dezelfde
   * server-side uitvoering — dus de terugval verzwakt geen enkele garantie.
   * @param {{ keys: string[], arguments: string[] }} options
   */
  async function evalSaveAnswer(options) {
    if (scriptKnownToRedis) {
      try {
        return await client().evalSha(SAVE_ANSWER_LUA_SHA, options);
      } catch (error) {
        if (!isNoScriptError(error)) throw error;
        scriptKnownToRedis = false;
      }
    }
    const outcome = await client().eval(SAVE_ANSWER_LUA, options);
    scriptKnownToRedis = true;
    return outcome;
  }

  /**
   * Schrijft een geaccepteerd antwoord, de bijgewerkte speler, het scoreboard en
   * de ack in ÉÉN ondeelbare stap — of niets van dat alles.
   *
   * HET FOUTCONTRACT STAAT IN `repository.js` (§FOUTCONTRACT bij
   * `AcceptedAnswerWrite`) en wordt hier niet opnieuw uitgevonden:
   *   * `actionId` staat al in de action-cache van deze room -> `{ replay: true }`,
   *     GEEN mutatie en geen ack in de returnwaarde (de aanroeper haalt die
   *     desgewenst met `loadActionCacheEntry`);
   *   * anders, en er bestaat al een `Answer` voor deze `roundId` + `playerId`
   *     -> `RangeError` met `.code === 'ALREADY_ANSWERED'`;
   *   * anders, geslaagde nieuwe write -> `{ replay: false }`;
   *   * onbekende `updatedPlayer.id` -> `RangeError`.
   *
   * TWEE KANALEN, BEWUST: een replay komt terug als RETURNWAARDE, een afgewezen
   * duplicaat als THROW. Ze plat slaan tot één uitkomst zou de protocol-adapter
   * dwingen te raden of hij een ack mag versturen — en een replay ná de deadline
   * is juist het geval waarvoor INT-14 dit contract heeft vastgelegd.
   *
   * WAT ER GEBEURT ALS DE UITVOERING WORDT ONDERBROKEN: hetzelfde als bij
   * `setRoomAndMatchPhaseAtomically`, en het is geen rollback. Een Lua-script
   * draait server-side tot het einde door; valt de clientsocket weg terwijl het
   * loopt, dan landen alle vier de writes gewoon en verdwijnt alleen het
   * antwoord. De garantie is "alle vier of geen van vier", niet "bij een
   * netwerkfout is er niets gebeurd". De aanroeper die een verbindingsfout krijgt
   * weet niet welke van die twee het werd — en hoeft dat ook niet te weten: hij
   * probeert het opnieuw met DEZELFDE `actionId`, en dan is het antwoord een
   * replay als de eerste poging geland was, en een gewone write als dat niet zo
   * was. Dat is precies waar de idempotentiecontrole voor bestaat.
   *
   * DE VORMCONTROLES STAAN VOORAAN, vóór de atomaire operatie, net als bij
   * `saveRoom` en familie: een `Answer` of `Player` die `server/data/types/`
   * afkeurt hoort niet als half document in Redis te belanden. Gevolg, expliciet
   * genoemd omdat het een verschil met de fake is: een REPLAY met een
   * onhoudbare payload werpt hier `TypeError`/`RangeError` waar de fake
   * `{ replay: true }` zou teruggeven. Beide zijn een programmeerfout van de
   * aanroeper, en de vormcontrole vroeg laten afgaan is de nuttigere melding.
   *
   * @param {string} roomId
   * @param {string} matchId
   * @param {import('../../repository').AcceptedAnswerWrite} write
   * @returns {Promise<{ replay: boolean }>}
   */
  async function saveAcceptedAnswerAtomically(roomId, matchId, write) {
    if (typeof write !== 'object' || write === null) {
      throw new TypeError(`saveAcceptedAnswerAtomically verwacht een AcceptedAnswerWrite, kreeg: ${typeof write}`);
    }
    const { answer, updatedPlayer, actionCacheEntry } = write;
    assertAnswerShape(answer);
    if (typeof actionCacheEntry?.actionId !== 'string' || actionCacheEntry.actionId.length === 0) {
      throw new TypeError(
        `saveAcceptedAnswerAtomically: actionCacheEntry.actionId moet een niet-lege string zijn, kreeg: ${JSON.stringify(actionCacheEntry?.actionId)}`
      );
    }
    if (typeof updatedPlayer?.id !== 'string' || updatedPlayer.id.length === 0) {
      throw new TypeError(
        `saveAcceptedAnswerAtomically: updatedPlayer.id moet een niet-lege string zijn, kreeg: ${JSON.stringify(updatedPlayer?.id)}`
      );
    }

    const players = roomPlayersKey(roomId);
    const answers = answersKey(roomId, matchId, answer.roundId);
    const scoreboard = scoreboardKey(roomId, matchId);
    const actionCache = actionCacheKey(roomId);
    const encodedAnswer = codec.encode('answer', answer);
    const encodedAck = codec.encode('action-cache-entry', actionCacheEntry);

    for (let attempt = 1; attempt <= ANSWER_WRITE_ATTEMPTS; attempt += 1) {
      // De lees die het compare-and-set-venster opent (zie SAVE_ANSWER_LUA voor
      // waarom het lezen niet in het script kan). De ONBEWERKTE string gaat mee
      // terug naar Redis als verwachtingswaarde — vergelijken op de gedecodeerde
      // vorm zou een herserialisatie vergen en dan vergelijk je de codec met
      // zichzelf in plaats van de opslag met wat je gelezen hebt.
      const storedPlayer = (await client().hGet(players, updatedPlayer.id)) ?? null;
      // Bestaat de speler niet, dan gaan we tóch het script in met een lege
      // verwachting: de idempotentiecontrole staat vóór de spelercontrole, dus
      // een replay hoort óók een replay te zijn als de speler intussen weg is.
      // Een leesuitslag vooraf omzetten in een RangeError zou dat geval
      // stilzwijgend tot een fout maken.
      let newPlayer = '';
      if (storedPlayer !== null) {
        // ABSOLUTE waarden, geen delta: de aanroeper heeft `player.score +
        // points` al uitgerekend (repository.js §AcceptedAnswerWrite). Alleen
        // deze drie velden gaan mee; naam, team, verbindingsstatus en
        // eligibleFromRound van het opgeslagen document blijven staan.
        const merged = {
          .../** @type {object} */ (codec.decode('player', storedPlayer)),
          score: updatedPlayer.score,
          correctCount: updatedPlayer.correctCount,
          correctResponseTimeMsTotal: updatedPlayer.correctResponseTimeMsTotal,
        };
        assertPlayerShape(merged);
        newPlayer = codec.encode('player', merged);
      }

      const outcome = await evalSaveAnswer({
        keys: [
          actionCache,
          players,
          answers,
          scoreboard,
          // Vanaf hier: de TTL-refresh. De room-scope (elke schrijfactie is
          // activiteit) plus de match-gescopeerde sleutels die deze operatie
          // zelf aanraakt. `players` en `actionCache` zitten al in de room-scope.
          ...roomScopeKeys(roomId),
          matchKey(roomId, matchId),
          scoreboard,
          answers,
        ],
        arguments: [
          actionCacheEntry.actionId,
          encodedAck,
          updatedPlayer.id,
          storedPlayer ?? '',
          newPlayer,
          answer.playerId,
          encodedAnswer,
          String(updatedPlayer.score),
          ttl,
        ],
      });

      if (outcome === 'ok') return { replay: false };
      if (outcome === 'replay') return { replay: true };
      if (outcome === 'no-player') {
        throw new RangeError(
          `saveAcceptedAnswerAtomically: unknown playerId ${JSON.stringify(updatedPlayer.id)} for roomId ${JSON.stringify(roomId)}`
        );
      }
      if (outcome === 'already-answered') {
        throw Object.assign(
          new RangeError(
            `saveAcceptedAnswerAtomically: player ${JSON.stringify(answer.playerId)} already has an answer for round ${JSON.stringify(answer.roundId)}`
          ),
          { code: 'ALREADY_ANSWERED' }
        );
      }
      if (outcome !== 'stale') {
        throw new Error(`saveAcceptedAnswerAtomically: onverwacht scriptresultaat ${JSON.stringify(outcome)}`);
      }
      // 'stale': het spelerdocument is tussen de lees en het script veranderd.
      // Er is NIETS geschreven — opnieuw lezen en opnieuw proberen, zodat de
      // absolute waarden van deze inzending bovenop de nieuwste versie landen in
      // plaats van die versie weg te schrijven.
    }

    throw new Error(
      `saveAcceptedAnswerAtomically: speler ${JSON.stringify(updatedPlayer.id)} in room ${JSON.stringify(roomId)} werd ` +
        `${ANSWER_WRITE_ATTEMPTS} pogingen achter elkaar onder de operatie vandaan geschreven; er is niets gewijzigd.`
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
