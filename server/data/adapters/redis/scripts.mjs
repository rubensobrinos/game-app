import { createHash } from 'node:crypto';

export const CLAIM_LOCATORS_LUA = `
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
export const RELEASE_LOCATORS_LUA = `
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
export const REFRESH_LOCATORS_LUA = `
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
export const ROTATE_LOCATORS_LUA = `
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
 * Schrijft een sessie én zijn tokenhash-index in ÉÉN ondeelbare stap, en ruimt
 * de VORIGE tokenhash-index van diezelfde sessie in dezelfde stap op
 * (BESLUIT-INTB-locators-en-sessieindex.md, deel B, §Rotatie).
 *
 * KEYS:
 *   [1] sessions-hash  `room:{roomId}:sessions`
 *   [2] NIEUWE index   `session:token:{nieuweTokenHash}`
 *   [3] OUDE index     `session:token:{vorigeTokenHash}` — of, als er niets op
 *       te ruimen valt, EXACT dezelfde sleutel als KEYS[2]
 *   [4..] de sleutels waarvan de TTL mee moet (room-scope + de token-indexen van
 *       de andere sessies in deze room)
 * ARGV: [1] sessionId, [2] VERWACHT opgeslagen sessiedocument ('' = er stond
 *       niets), [3] nieuw sessiedocument, [4] indexwaarde `{roomId, sessionId}`,
 *       [5] ttlSeconds.
 * Retourneert 'ok' | 'stale'.
 *
 * WAAROM DE OPRUIMING HIER ZIT EN NIET IN EEN TWEEDE AANROEP: krijgt een sessie
 * een nieuw token, dan blijft de oude hash zonder deze `DEL` naar diezelfde
 * sessie wijzen — een tweede geldige capability naast de nieuwe. Dat is
 * letterlijk INTB-5 nog een keer (geroteerde locators die geldig bleven) en
 * INTB-9 nog een keer (een index die de claim van de vorige eigenaar niet
 * introk). Een `DEL` in een aparte netwerkbeurt laat precies het venster open
 * waarin het oude token nog werkt terwijl het nieuwe al is uitgegeven — en bij
 * een intrekking is dat de ergere helft om te verliezen.
 *
 * `KEYS[3] ~= KEYS[2]` is dezelfde sleutelvergelijking als in
 * `ROTATE_LOCATORS_LUA`: slaat de aanroeper dezelfde sessie opnieuw op met
 * DEZELFDE tokenhash, dan mag de index niet eerst gewist en daarna herschreven
 * worden — dat zou een venster openen waarin een geldig token nergens naartoe
 * wijst.
 *
 * COMPARE-AND-SET op het opgeslagen sessiedocument, om dezelfde reden als in
 * `SET_PHASE_LUA`: de vorige tokenhash is alleen te kennen door het document
 * eerst te LEZEN, en het decoderen daarvan gebeurt in JavaScript met dezelfde
 * codec als elke andere schrijfactie (`cjson` pompt een domeindocument niet
 * verliesvrij rond). Tussen die lees en dit script past een tweede
 * `saveSession`; zonder deze vergelijking zou de operatie diens index laten
 * staan en zijn document overschrijven — een tokenhash die naar niets meer
 * verwijst of, erger, een oude die blijft leven.
 */
export const SAVE_SESSION_LUA = `
local stored = redis.call('HGET', KEYS[1], ARGV[1])
if not stored then stored = '' end
if stored ~= ARGV[2] then return 'stale' end
if KEYS[3] ~= KEYS[2] then redis.call('DEL', KEYS[3]) end
redis.call('HSET', KEYS[1], ARGV[1], ARGV[3])
redis.call('SET', KEYS[2], ARGV[4], 'EX', ARGV[5])
for i = 4, #KEYS do redis.call('EXPIRE', KEYS[i], ARGV[5]) end
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
export const SAVE_ROUND_LUA = `
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
export const SET_PHASE_LUA = `
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
 *   [9] ttlSeconds                  [10] '1' bij een CORRECTIE, anders '0'
 *
 * [10] hoort bij besluit 54 (6 aug 2026): wijzigen mag tot de tijd om is. Bij
 * '1' vervalt de "al beantwoord"-controle en overschrijft de write het vorige
 * antwoord. De compare-and-set op het spelerdocument ([4] vs. de opgeslagen
 * waarde) blijft staan en serialiseert twee gelijktijdige inzendingen van
 * dezelfde speler: de tweede krijgt 'stale' en rekent opnieuw met verse
 * cijfers. Zonder die vlag verandert er niets aan het oude gedrag.
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
export const SAVE_ANSWER_LUA = `
if redis.call('HEXISTS', KEYS[1], ARGV[1]) == 1 then return 'replay' end
local storedPlayer = redis.call('HGET', KEYS[2], ARGV[3])
if not storedPlayer then return 'no-player' end
if storedPlayer ~= ARGV[4] then return 'stale' end
if ARGV[10] ~= '1' and redis.call('HEXISTS', KEYS[3], ARGV[6]) == 1 then return 'already-answered' end
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
export const SAVE_ANSWER_LUA_SHA = createHash('sha1').update(SAVE_ANSWER_LUA).digest('hex');

/**
 * Hoe vaak `setRoomAndMatchPhaseAtomically` het opnieuw probeert als een ander
 * schrijfpad tussen de lees en de compare-and-set door kwam. Eindig, want een
 * oneindige lus onder aanhoudende drukte is een hangende request; ruim genoeg,
 * want elke poging kost twee GETs en een EVAL en er is geen tweede schrijver
 * die `Room`/`Match` in een strakke lus bewerkt.
 */
export const PHASE_SWAP_ATTEMPTS = 5;

/**
 * Idem voor `saveAcceptedAnswerAtomically`. Hier is de tweede schrijver wél
 * reëel — twintig spelers die in dezelfde seconde antwoorden — maar ze botsen
 * alleen op HETZELFDE spelerdocument, en dat is per speler hoogstens één
 * inzending per ronde plus een eventuele `savePlayer`. Vijf pogingen is dus ruim;
 * op is op, want een oneindige lus onder drukte is een hangende request en geen
 * herstel.
 */
export const ANSWER_WRITE_ATTEMPTS = 5;

/**
 * Idem voor `saveSession`. De tweede schrijver is hier zeldzaam — één sessie
 * hoort bij één client — maar niet onmogelijk: een reconnect en een
 * tokenrotatie kunnen elkaar kruisen. Vijf pogingen, om dezelfde reden als
 * hierboven eindig.
 */
export const SESSION_WRITE_ATTEMPTS = 5;

/**
 * Herkent het antwoord van Redis op een `EVALSHA` waarvan het script niet (meer)
 * in de scriptcache staat. Op de melding matchen en niet op een foutklasse: de
 * client levert hier een generieke `SimpleError`, en `NOSCRIPT` is de stabiele,
 * gedocumenteerde voorvoegsel uit het Redis-protocol.
 * @param {unknown} error
 */

export function isNoScriptError(error) {
  return typeof (/** @type {{message?: unknown}} */ (error)?.message) === 'string'
    && /** @type {{message: string}} */ (error).message.startsWith('NOSCRIPT');
}

/**
 * @param {unknown} value
 * @param {string} name
 * @returns {number}
 */
export function assertPositiveInteger(value, name) {
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

