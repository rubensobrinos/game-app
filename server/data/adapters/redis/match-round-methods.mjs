import { SAVE_ROUND_LUA } from './scripts.mjs';
import { matchKey, roundKey, scoreboardKey } from '../../redis-keys.js';
import { assertMatchShape } from '../../types/match.js';
import { assertRoundShape } from '../../types/round.js';

export function createMatchRoundMethods(context) {
  const { client, codec, ttlSeconds, ttl, roomScopeKeys, sessionTokenIndexKeys, refreshTtl } = context;
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
    const tokenKeys = await sessionTokenIndexKeys(match.roomId);
    const chain = client().multi();
    chain.set(matchKey(match.roomId, match.id), codec.encode('match', match), { EX: ttlSeconds });
    refreshTtl(chain, match.roomId, [scoreboardKey(match.roomId, match.id), ...tokenKeys]);
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
        ...(await sessionTokenIndexKeys(roomId)),
      ],
      arguments: [codec.encode('round', round), ttl],
    });
    if (written !== 1) {
      throw new RangeError(
        `saveRound: no known match ${JSON.stringify(round.matchId)} in room ${JSON.stringify(roomId)} (save the Match first)`
      );
    }
  }


  return { loadMatch, saveMatch, loadRound, saveRound, };
}

