import { SAVE_SESSION_LUA, SESSION_WRITE_ATTEMPTS } from './scripts.mjs';
import { roomPlayersKey, roomSessionsKey, roomsActiveKey, sessionTokenLookupKey } from '../../redis-keys.js';
import { assertSessionShape } from '../../types/session.js';
import { assertPlayerShape } from '../../types/player.js';

export function createSessionPlayerMethods(context) {
  const { client, codec, ttlSeconds, ttl, roomScopeKeys, sessionTokenIndexKeys, refreshTtl } = context;
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

  /**
   * Schrijft de sessie en zijn tokenhash-index in één ondeelbare stap, en geeft
   * de VORIGE tokenhash-index van diezelfde sessie in diezelfde stap vrij.
   *
   * Het rotatiedeel is contract, geen extraatje (`repository.js` bij
   * `saveSession`, en BESLUIT-INTB-locators-en-sessieindex.md deel B): krijgt een
   * sessie een nieuw token, dan MOET de oude hash ophouden te werken. Twee losse
   * opdrachten zouden een venster openen waarin beide tokens geldig zijn, en dat
   * is precies de fout die INTB-5 en INTB-9 al twee keer hebben opgeleverd.
   *
   * De lees hieronder bestaat alleen om de VORIGE tokenhash te leren kennen —
   * `saveSession` krijgt de oude sessie niet mee. Die lees opent een venster, en
   * `SAVE_SESSION_LUA` sluit het met een compare-and-set op het onbewerkte
   * opgeslagen document.
   * @param {import('../../types/session').Session} session
   */
  async function saveSession(session) {
    assertSessionShape(session);
    const sessions = roomSessionsKey(session.roomId);
    const newIndex = sessionTokenLookupKey(session.tokenHash);
    const encodedSession = codec.encode('session', session);
    // De index draagt het PAAR en verder niets: de sessie zelf staat op precies
    // één plek (de sessions-hash van zijn room), zodat er geen tweede kopie is
    // die kan verouderen. En de SLEUTELNAAM draagt de hash, nooit het token —
    // dezelfde redenering als bij roomInviteLookupKey(inviteHash): een
    // Redis-keyname mag de capability niet tonen.
    const indexValue = codec.encode('session-token-index', {
      roomId: session.roomId,
      sessionId: session.id,
    });

    for (let attempt = 1; attempt <= SESSION_WRITE_ATTEMPTS; attempt += 1) {
      const stored = (await client().hGet(sessions, session.id)) ?? null;
      const previousTokenHash = stored === null
        ? null
        : /** @type {{tokenHash?: string}} */ (codec.decode('session', stored)).tokenHash;
      // Niets op te ruimen (nieuwe sessie, of dezelfde hash opnieuw opgeslagen)
      // -> exact dezelfde sleutel als de nieuwe index, waarmee het script de DEL
      // overslaat. Zie de sleutelvergelijking in SAVE_SESSION_LUA.
      const staleIndex = previousTokenHash === undefined
        || previousTokenHash === null
        || previousTokenHash === session.tokenHash
        ? newIndex
        : sessionTokenLookupKey(previousTokenHash);

      const outcome = await client().eval(SAVE_SESSION_LUA, {
        keys: [
          sessions,
          newIndex,
          staleIndex,
          ...roomScopeKeys(session.roomId),
          ...(await sessionTokenIndexKeys(session.roomId)),
        ],
        arguments: [session.id, stored ?? '', encodedSession, indexValue, ttl],
      });

      if (outcome === 'ok') return;
      if (outcome !== 'stale') {
        throw new Error(`saveSession: onverwacht scriptresultaat ${JSON.stringify(outcome)}`);
      }
      // 'stale': een tweede schrijver kwam tussen de lees en het script door. Er
      // is NIETS geschreven — opnieuw lezen, want de vorige tokenhash die deze
      // poging wilde opruimen is inmiddels een andere.
    }

    throw new Error(
      `saveSession: sessie ${JSON.stringify(session.id)} in room ${JSON.stringify(session.roomId)} werd ` +
        `${SESSION_WRITE_ATTEMPTS} pogingen achter elkaar onder de operatie vandaan geschreven; er is niets gewijzigd.`
    );
  }

  /**
   * Zoekt een sessie op de hash van zijn token, zonder dat de aanroeper de room
   * kent — dat is de hele reden dat deze index bestaat: een socket-handshake
   * stuurt alleen een `sessionToken` mee (PROTOCOL.md), en het opzoeken van de
   * sessie ÍS de manier waarop de server de room leert kennen.
   *
   * Twee beurten, geen SCAN: de globale index levert `{ roomId, sessionId }`,
   * daarna leest dezelfde room-scoped weg als `loadSession` het document. De
   * index bevat bewust geen sessiegegevens — één plek waar een sessie echt
   * staat, dus geen kopie die kan verouderen.
   *
   * GEEN TOUCH-ON-READ (`repository.js`, en het besluit deel B): deze lookup
   * verlengt niets. De TTL-koppeling loopt via de room-brede refresh, niet via
   * hoe vaak een token wordt opgezocht — anders verliest juist de stille speler,
   * voor wie reconnect bedoeld is, zijn sessie terwijl de room nog leeft.
   *
   * Een verlopen of nooit bestaande index levert `null` op, en een index die
   * naar een verdwenen sessie wijst ook: `null` is hier "onbekend token", geen
   * fout.
   * @param {string} tokenHash
   */
  async function loadSessionByTokenHash(tokenHash) {
    const located = /** @type {{roomId: string, sessionId: string}|null} */ (
      codec.decode('session-token-index', await client().get(sessionTokenLookupKey(tokenHash)))
    );
    if (located === null) return null;
    return loadSession(located.roomId, located.sessionId);
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
    const tokenKeys = await sessionTokenIndexKeys(player.roomId);
    const chain = client().multi();
    chain.hSet(roomPlayersKey(player.roomId), player.id, codec.encode('player', player));
    refreshTtl(chain, player.roomId, tokenKeys);
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

  /**
   * De room-ids in `rooms:active` (A7/C-3). Dit is de index die `saveRoom`
   * al bijhoudt; hij bestond alleen nog niet als poortmethode, waardoor het
   * herstelpad na een serverherstart niet wist wélke rooms het moest oppakken.
   *
   * Kan verlopen rooms bevatten: `rooms:active` heeft bewust geen TTL (zie
   * de TTL-test), terwijl de roomdocumenten die wél hebben. De aanroeper
   * hoort daarom op een `null` uit `loadRoom` voorbereid te zijn — dat is
   * geen fout maar een opgeruimde room.
   */
  async function listActiveRoomIds() {
    return client().sMembers(roomsActiveKey());
  }


  return { loadSession, saveSession, loadSessionByTokenHash, loadPlayer, savePlayer, listPlayers, listActiveRoomIds, };
}

