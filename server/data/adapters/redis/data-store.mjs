// De Redis-adapter van de DataStore-poort (server/data/repository.js) —
// INTB2b, uitgebreid met de atomaire fasewissel in INTB2d, de atomaire
// antwoordverwerking in INTB2c en de sessietoken-index in INTB2f.
//
// ALLE DRIEËNTWINTIG poortmethoden draaien hier tegen echte Redis;
// `UNIMPLEMENTED_METHODS` hieronder is daarom leeg. Dat was het niet:
//
//   * `setRoomAndMatchPhaseAtomically` stond hier geblokkeerd en is in INTB2d
//     gebouwd (zie `SET_PHASE_LUA` en de functie zelf, inclusief wat er bij een
//     onderbroken uitvoering wél en niet gegarandeerd is); DM19 heeft hem
//     daarna verbreed met een dubbele compare-and-set en `pausedState`.
//   * `saveAcceptedAnswerAtomically` stond hier geblokkeerd op een bewegend
//     contract; DM15 (reactie op INT-14) legt dat contract vast in
//     `repository.js` (§FOUTCONTRACT) en INTB2c heeft hem gebouwd — zie
//     `SAVE_ANSWER_LUA`.
//   * `loadSessionByTokenHash` (DM14/§10) stond geblokkeerd op de
//     SLEUTELCATALOGUS: er was geen sleutel voor een tokenHash en de signatuur
//     draagt geen `roomId`. `sessionTokenLookupKey(tokenHash)` bestaat inmiddels
//     in `redis-keys.js` en
//     `docs/integration-plan/BESLUIT-INTB-locators-en-sessieindex.md` (deel B)
//     legt waarde, TTL-koppeling en rotatiegedrag vast. Gebouwd in INTB2f; zie
//     `SAVE_SESSION_LUA` en de twee functies zelf.
//
// `UNIMPLEMENTED_METHODS` blijft bestaan, leeg: de INTB2b-prompt waarschuwt dat
// placeholderfuncties `assertImplementsDataStore` laten slagen terwijl de
// adapter niet af is. Die shapecheck kan dat niet zien — een werpende functie is
// nog steeds een functie — dus is er een tweede, machineleesbare manier om het
// wél te zien. Een lege lijst is een uitspraak, geen restant.
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
//   * De twee LOOKUP-INDEXEN van een room (`room:code:{code}` en
//     `room:invite:{inviteHash}`) worden uitsluitend door de locator-lifecycle
//     geschreven én ververst: `claimRoomLocatorsAtomically`,
//     `rotateRoomLocators` en `releaseRoomLocators` (+ `refreshRoomLocators`
//     als keep-alive). `saveRoom` raakt ze NIET aan — zie het besluit in
//     `docs/integration-plan/BESLUIT-INTB-locators-en-sessieindex.md`, deel A,
//     en de noot bij `saveRoom` zelf.
//   * De SESSIETOKEN-INDEXEN (`session:token:{tokenHash}`) zijn globale
//     sleutels: ze zijn niet uit `roomId` af te leiden, dus de room-brede
//     refresh kán ze niet op naam vinden. Ze worden daarom per refresh
//     OPGEHAALD uit `room:{roomId}:sessions` (elke `Session` draagt zijn eigen
//     `tokenHash`) en meegenomen in dezelfde EXPIRE-ronde. Dat kost één extra
//     lezing per schrijfactie en geen enkele extra schrijfweg naar de index —
//     het alternatief, "touch-on-read" bij elke geslaagde lookup, laat een
//     stille speler zijn reconnectrecht verliezen terwijl zijn room nog leeft
//     (besluit deel B).
//
// DECISIONS #28: ESM, `.mjs`.

import { documentCodec } from './documents.mjs';
import {
  actionCacheKey, revokedSessionsKey, roomKey, roomPlayersKey, roomSessionsKey, sessionTokenLookupKey,
} from '../../redis-keys.js';
import { ROOM_TTL_SECONDS } from '../../ttl.js';
import { assertPositiveInteger } from './scripts.mjs';
import { createRoomMethods } from './room-methods.mjs';
import { createSessionPlayerMethods } from './session-player-methods.mjs';
import { createMatchRoundMethods } from './match-round-methods.mjs';
import { createAnswerMethods } from './answer-methods.mjs';

/** Machineleesbare volledigheidsmelding voor de server-startgate. */
export const UNIMPLEMENTED_METHODS = Object.freeze({});

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
   * De token-indexsleutels van ALLE sessies in deze room.
   *
   * `session:token:{tokenHash}` is een GLOBALE sleutel — hij is niet uit
   * `roomId` af te leiden, dus `roomScopeKeys` kán hem niet opleveren en de
   * room-brede TTL-refresh zou hem stilzwijgend overslaan. Dan verloopt de index
   * terwijl de sessie nog leeft, en verliest een speler zijn reconnectrecht
   * midden in een potje.
   *
   * De uitweg uit het besluit (deel B, §TTL): de hashes staan al ergens, namelijk
   * op de `Session` zelf in `room:{roomId}:sessions`. Eén extra lezing per
   * schrijfactie, geen tweede plek waar de koppeling sessie -> tokenhash wordt
   * bijgehouden — en dus ook geen tweede plek die uit de pas kan lopen.
   *
   * Een lege of ontbrekende hash levert een lege lijst op; `HVALS` op een
   * niet-bestaande sleutel is geen fout.
   * @param {string} roomId
   * @returns {Promise<string[]>}
   */
  async function sessionTokenIndexKeys(roomId) {
    const stored = await client().hVals(roomSessionsKey(roomId));
    const keys = [];
    for (const raw of stored) {
      const session = /** @type {{tokenHash?: string}|null} */ (codec.decode('session', raw));
      if (typeof session?.tokenHash === 'string' && session.tokenHash.length > 0) {
        keys.push(sessionTokenLookupKey(session.tokenHash));
      }
    }
    return keys;
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


  const methodContext = { client, codec, ttlSeconds, ttl, roomScopeKeys, sessionTokenIndexKeys, refreshTtl };
  return {
    ...createRoomMethods(methodContext),
    ...createSessionPlayerMethods(methodContext),
    ...createMatchRoundMethods(methodContext),
    ...createAnswerMethods(methodContext),
  };
}
