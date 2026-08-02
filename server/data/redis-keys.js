'use strict';

// Redis-sleutelpatronen uit docs/multiplayer/DATA-MODEL.md ("Redis-sleutels") en
// docs/data-model-plan/prompts/DDM1-keys-and-ttl.md. Pure functies: geen Redis-client,
// geen I/O. Elke builder valideert zijn segmenten (zie assertSegment) omdat de bron
// niet vastlegt of builders willekeurige strings mogen accepteren — de precondition
// is dat roomId/code/inviteHash/matchId/roundId/playerId/actionId al gevalideerde,
// canonieke identifiers zijn (gegenereerd door architectuur-/repositorycode, niet
// hier).
//
// AANNAME (niet expliciet vastgelegd in DATA-MODEL.md, zie DDM1-keys-and-ttl.md):
// in `room:{roomId}:match:{matchId}:answers:{id}` is `{id}` het ronde-ID, analoog
// aan `round:{id}` erboven en consistent met Answer.roundId in de spec-voorbeelden.

const INVALID_SEGMENT_CHARS = /[:*?[\]]/;

/**
 * Werpt TypeError als segment geen niet-lege string is, of een Redis-key-
 * scheidingsteken (':') of glob-teken ('*', '?', '[', ']') bevat.
 * @param {string} name - parameternaam, voor de foutmelding
 * @param {unknown} segment
 * @returns {string}
 */
function assertSegment(name, segment) {
  if (typeof segment !== 'string' || segment.length === 0) {
    throw new TypeError(`${name} must be a non-empty string, got: ${JSON.stringify(segment)}`);
  }
  if (INVALID_SEGMENT_CHARS.test(segment)) {
    throw new TypeError(
      `${name} must not contain ':' or glob characters ('*', '?', '[', ']'), got: ${JSON.stringify(segment)}`
    );
  }
  return segment;
}

/** @returns {string} 'rooms:active' */
function roomsActiveKey() {
  return 'rooms:active';
}

/** @returns {string} 'room:code:{code}' */
function roomCodeLookupKey(code) {
  return `room:code:${assertSegment('code', code)}`;
}

/** @returns {string} 'room:invite:{inviteHash}' */
function roomInviteLookupKey(inviteHash) {
  return `room:invite:${assertSegment('inviteHash', inviteHash)}`;
}

/**
 * @returns {string} 'session:token:{tokenHash}'
 * Reactie op INTB-10 (docs/data-model-plan/HANDOFF.md §13): globaal, niet
 * room-scoped — een bearer token komt binnen zonder roomId, dat is precies
 * waarom deze index bestaat (analoog aan roomCodeLookupKey/
 * roomInviteLookupKey, die om dezelfde reden ook niet room-scoped zijn).
 * TTL-koppeling en rotatiegedrag: zie HANDOFF.md §13, nog niet
 * geïmplementeerd, alleen deze sleutelbouwer.
 */
function sessionTokenLookupKey(tokenHash) {
  return `session:token:${assertSegment('tokenHash', tokenHash)}`;
}

/** @returns {string} 'room:{roomId}' */
function roomKey(roomId) {
  return `room:${assertSegment('roomId', roomId)}`;
}

/** @returns {string} 'room:{roomId}:sessions' */
function roomSessionsKey(roomId) {
  return `${roomKey(roomId)}:sessions`;
}

/** @returns {string} 'room:{roomId}:players' */
function roomPlayersKey(roomId) {
  return `${roomKey(roomId)}:players`;
}

/** @returns {string} 'room:{roomId}:match:{matchId}' */
function matchKey(roomId, matchId) {
  return `${roomKey(roomId)}:match:${assertSegment('matchId', matchId)}`;
}

/** @returns {string} 'room:{roomId}:match:{matchId}:round:{roundId}' */
function roundKey(roomId, matchId, roundId) {
  return `${matchKey(roomId, matchId)}:round:${assertSegment('roundId', roundId)}`;
}

/**
 * @returns {string} 'room:{roomId}:match:{matchId}:answers:{roundId}'
 * Zie de AANNAME bovenaan dit bestand: {id} in de brondocumentatie is hier roundId.
 */
function answersKey(roomId, matchId, roundId) {
  return `${matchKey(roomId, matchId)}:answers:${assertSegment('roundId', roundId)}`;
}

/** @returns {string} 'room:{roomId}:match:{matchId}:scoreboard' */
function scoreboardKey(roomId, matchId) {
  return `${matchKey(roomId, matchId)}:scoreboard`;
}

/** @returns {string} 'room:{roomId}:revoked-sessions' */
function revokedSessionsKey(roomId) {
  return `${roomKey(roomId)}:revoked-sessions`;
}

/**
 * @returns {string} 'room:{roomId}:action-cache'
 * Room-scoped, GEEN matchId — DATA-MODEL.md definieert hier geen matchId. Een
 * eerdere planversie gebruikte abusievelijk een match-scoped variant; zie
 * docs/data-model-plan/REVIEW.md, bevinding 1.
 */
function actionCacheKey(roomId) {
  return `${roomKey(roomId)}:action-cache`;
}

module.exports = {
  roomsActiveKey,
  roomCodeLookupKey,
  roomInviteLookupKey,
  sessionTokenLookupKey,
  roomKey,
  roomSessionsKey,
  roomPlayersKey,
  matchKey,
  roundKey,
  answersKey,
  scoreboardKey,
  revokedSessionsKey,
  actionCacheKey,
};
