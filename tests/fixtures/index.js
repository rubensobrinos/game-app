'use strict';

// Voorstel, geen ADR: velden en defaults volgen de JSON-voorbeelden in
// docs/multiplayer/DATA-MODEL.md; de eigenaar van dat document kan de vorm
// nog wijzigen — pas de defaults hieronder dan aan, gebruik `overrides` voor
// per-test afwijkingen.
//
// Pure object-factories: geen Redis, geen I/O, geen validatielibrary. Elke
// factory bouwt een vers object per aanroep (geen gedeelde array/object-
// referenties tussen tests) en merget `overrides` er ondiep overheen.

/**
 * Standaard `GameConfiguration` — dezelfde vorm als `assertGameConfigurationShape`
 * eist (server/data/types/game-configuration.js, 16 velden), waarden gelijk aan
 * wat `POST /api/v1/games` in de praktijk teruggeeft voor het `quick_start`-preset.
 * @param {object} [overrides]
 * @returns {object} GameConfiguration
 */
function makeGameConfiguration(overrides = {}) {
  return {
    preset: 'quick_start',
    gameTypes: ['flags_mc'],
    language: 'nl',
    difficulty: 'normal',
    totalRounds: 10,
    questionSeconds: 15,
    resultSeconds: 5,
    scoreboardSeconds: 4,
    scoreboardFrequency: 'every_round',
    pacing: 'auto',
    autoReveal: true,
    speedBonus: true,
    deadlineGraceMs: 250,
    mode: 'individual',
    teamNames: [],
    metricMode: 'mixed',
    maxPlayers: 100,
    allowLateJoin: true,
    continents: ['Europe', 'Asia', 'Africa', 'North America', 'South America', 'Oceania'],
    ...overrides,
  };
}

/**
 * @param {object} [overrides]
 * @returns {object} Room — DATA-MODEL.md, sectie "Room".
 */
function makeRoom(overrides = {}) {
  return {
    id: 'room_01J...',
    code: '482917',
    inviteId: 'N4x7pQm2K8tW',
    phase: 'LOBBY',
    createdAt: 1785620000000,
    lastActivityAt: 1785623412000,
    hostSessionIds: ['sess_01J...'],
    locked: false,
    config: makeGameConfiguration(),
    currentMatchId: null,
    // GEEN contentVersion/rendererVersion hier: DECISIONS.md #21 legt vast dat
    // die twee canoniek en onveranderlijk op Match horen, niet op Room (zie
    // makeMatch() hieronder en server/data/types/room.js's kopcommentaar).
    // INTB-8 signaleerde dat deze fixture ze eerder juist omgekeerd had.
    ...overrides,
  };
}

/**
 * @param {object} [overrides]
 * @returns {object} Session — DATA-MODEL.md, sectie "Session".
 */
function makeSession(overrides = {}) {
  return {
    id: 'sess_01J...',
    roomId: 'room_01J...',
    roles: ['host', 'player'],
    playerId: 'p_8f42d1',
    tokenHash: 'sha256:...',
    createdAt: 1785620000000,
    lastSeenAt: 1785623412000,
    connectedSocketIds: ['socket_...'],
    revoked: false,
    ...overrides,
  };
}

/**
 * @param {object} [overrides]
 * @returns {object} Player — DATA-MODEL.md, sectie "Player".
 */
function makePlayer(overrides = {}) {
  return {
    id: 'p_8f42d1',
    roomId: 'room_01J...',
    sessionId: 'sess_01J...',
    displayName: null,
    generatedName: 'Vlugge Vos',
    effectiveName: 'Vlugge Vos',
    nameSource: 'generated',
    teamId: null,
    score: 4200,
    correctCount: 12,
    correctResponseTimeMsTotal: 56420,
    connected: true,
    eligibleFromRound: 1,
    joinedAt: 1785620100000,
    left: false,
    kicked: false,
    ...overrides,
  };
}

/**
 * @param {object} [overrides]
 * @returns {object} Match — DATA-MODEL.md, sectie "Match".
 */
function makeMatch(overrides = {}) {
  return {
    id: 'match_01J...',
    roomId: 'room_01J...',
    sequence: 2,
    phase: 'ROUND_ACTIVE',
    startedAt: 1785623000000,
    finishedAt: null,
    roundIndex: 6,
    roundIds: ['round_01', 'round_02'],
    usedQuestionKeys: ['flags:jp'],
    previousMatchQuestionKeys: ['flags:br'],
    pausedState: null,
    // DECISIONS.md #21: canoniek en onveranderlijk op Match, niet op Room —
    // zie makeRoom() hierboven en server/data/types/match.js.
    contentVersion: '2026.08.1',
    rendererVersion: 'flag-renderer-1',
    ...overrides,
  };
}

/**
 * @param {object} [overrides]
 * @returns {object} Round — DATA-MODEL.md, sectie "Round".
 */
function makeRound(overrides = {}) {
  return {
    id: 'round_07',
    matchId: 'match_01J...',
    gameType: 'real_or_fake_flag',
    questionKey: 'rof:fx_91b2',
    publicQuestionPayload: {},
    correctAnswer: { choice: 'fake' },
    startsAt: 1785623412000,
    endsAt: 1785623427000,
    status: 'ACTIVE',
    ...overrides,
  };
}

/**
 * @param {object} [overrides]
 * @returns {object} Answer — DATA-MODEL.md, sectie "Answer".
 */
function makeAnswer(overrides = {}) {
  return {
    roundId: 'round_07',
    playerId: 'p_8f42d1',
    actionId: 'act_01J...',
    answer: { choice: 'fake' },
    receivedAt: 1785623418451,
    responseTimeMs: 6451,
    correct: true,
    points: 158,
    ...overrides,
  };
}

module.exports = {
  makeGameConfiguration,
  makeRoom,
  makeSession,
  makePlayer,
  makeMatch,
  makeRound,
  makeAnswer,
};
