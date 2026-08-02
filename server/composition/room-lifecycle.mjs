// server/composition/room-lifecycle.mjs
//
// Compositie rond Room, Session en Player: roomcreatie, pre-join-preview,
// join, delen, vergrendelen, kicken en tokenresolutie.
//
// LIJM, GEEN DOMEINLOGICA. Elke inhoudelijke stap komt uit een bestaande,
// al geteste module:
//   - code/inviteId + hashing   → server/architecture/room-codes.js
//   - naamverwerking            → server/data/name-processing.js
//   - documentvormen            → server/data/types/*.js  (het vangnet)
//   - opslag                    → server/data/repository.js (de poort)
//   - foutcodes                 → server/protocol/error-codes.mjs
//   - sessietokens (besluit 26) → ./context.mjs
//
// RESULTAATCONVENTIE. Elke functie geeft `{ ok: true, value }` of
// `{ ok: false, code }` met een code uit `error-codes.mjs` — dezelfde vorm die
// server/protocol/ en server/architecture/state-machine.js al gebruiken, zodat
// de transportlaag (stap 2) `code` één-op-één kan doorgeven. Werpen doet deze
// module alleen bij programmeerfouten van de aanroeper en bij
// GameCodeExhaustedError (het gedocumenteerde foutcontract van room-codes.js).
//
// AUTORISATIE ZIT HIER NIET. `setRoomLocked` en `kickPlayer` controleren geen
// hostrol; NOT_HOST is een protocol-/transportbeslissing op basis van de
// sessie die `resolveSession` teruggeeft. Deze module voert uit wat gevraagd
// wordt en beslist niet wie het mag vragen.
//
// `Room.phase` WORDT HIER NA CREATIE NOOIT GESCHREVEN. Besluit 30 maakt
// `Match.phase` autoritair en `Room.phase` een afgeleide projectie die in
// dezelfde atomaire operatie meegaat — dat pad loopt uitsluitend via
// `setRoomAndMatchPhaseAtomically` in de match-lifecycle. Bij roomcreatie
// bestaat er nog geen match, dus `LOBBY` is daar geen dual write.

import {
  GameCodeExhaustedError,
  generateGameCode,
  generateInviteId,
  hashInviteId,
  isValidGameCode,
  isValidInviteId,
} from '../architecture/room-codes.js';
import { generateName, isProfane, processChosenName } from '../data/name-processing.js';
import { assertGameConfigurationShape } from '../data/types/game-configuration.js';
import { assertPlayerShape } from '../data/types/player.js';
import { assertRoomShape } from '../data/types/room.js';
import { assertSessionShape } from '../data/types/session.js';
import { ALL_ERROR_CODES } from '../protocol/error-codes.mjs';
import { createId, createSessionToken, verifySessionToken } from './context.mjs';

/**
 * De foutcodes die deze module kan retourneren. Geen losse stringliterals:
 * `error-codes.mjs` is de single source of truth, en dit faalt bij module-load
 * als een code daar ooit uit verdwijnt.
 */
const CODES = Object.freeze({
  GAME_NOT_FOUND: 'GAME_NOT_FOUND',
  INVITE_INVALID: 'INVITE_INVALID',
  GAME_FULL: 'GAME_FULL',
  LATE_JOIN_DISABLED: 'LATE_JOIN_DISABLED',
  ROOM_LOCKED: 'ROOM_LOCKED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  SESSION_REVOKED: 'SESSION_REVOKED',
  NOT_PLAYER: 'NOT_PLAYER',
});
for (const code of Object.values(CODES)) {
  if (!ALL_ERROR_CODES.has(code)) {
    throw new Error(`room-lifecycle: foutcode "${code}" ontbreekt in ALL_ERROR_CODES`);
  }
}

/** `joinSource`: `qr | shared_link | code | unknown` (PROTOCOL.md §REST-endpoints). */
const JOIN_SOURCES = Object.freeze(['qr', 'shared_link', 'code', 'unknown']);

/**
 * KEUZE — `Player.nameSource` is in server/data/types/player.js bewust een
 * open string: alleen "generated" is ooit als letterlijke waarde getoond.
 * Voor de tegenhanger is hier "chosen" gekozen. Eén regel om te wijzigen
 * zodra DATA-MODEL.md de waarde vastlegt.
 */
const NAME_SOURCE_GENERATED = 'generated';
const NAME_SOURCE_CHOSEN = 'chosen';

/** Aantal kandidaten dat claimLocators per locator probeert. */
const DEFAULT_LOCATOR_ATTEMPTS = 10;

/**
 * Quick-start default (besluit 35): `flags_mc`, 10 rondes, moeilijkheid
 * normaal, individueel, auto-tempo, snelheidspunten aan, late join aan. De
 * overige velden komen uit het GameConfiguration-voorbeeld in DATA-MODEL.md,
 * met één bewuste afwijking: `deadlineGraceMs` is 250 (besluit 13) en niet de
 * 150 uit dat voorbeeld — DECISIONS.md wint bij strijdigheid.
 */
export const QUICK_START_CONFIG = Object.freeze({
  preset: 'quick_start',
  gameTypes: Object.freeze(['flags_mc']),
  language: 'nl',
  difficulty: 'normal',
  totalRounds: 10,
  questionSeconds: 15,
  resultSeconds: 5,
  scoreboardSeconds: 4,
  scoreboardFrequency: 'every_round',
  pacing: 'auto',
  speedBonus: true,
  deadlineGraceMs: 250,
  mode: 'individual',
  teamNames: Object.freeze([]),
  metricMode: 'mixed',
  maxPlayers: 100,
  allowLateJoin: true,
});

/** @param {string} code @returns {{ ok: false, code: string }} */
function fail(code) {
  return { ok: false, code };
}

/** @param {object} value @returns {{ ok: true, value: object }} */
function succeed(value) {
  return { ok: true, value };
}

/**
 * Vult een (gedeeltelijke) configuratie aan met de quick-start defaults en
 * laat `assertGameConfigurationShape` het resultaat keuren. Puur plumbing —
 * er wordt hier geen veld berekend of afgeleid.
 * @param {object|undefined} partial
 * @returns {import('../data/types/game-configuration.js').GameConfiguration}
 */
export function resolveGameConfiguration(partial) {
  if (partial !== undefined && (typeof partial !== 'object' || partial === null || Array.isArray(partial))) {
    throw new TypeError(`resolveGameConfiguration: config moet een object of undefined zijn, kreeg: ${JSON.stringify(partial)}`);
  }
  const merged = { ...QUICK_START_CONFIG, ...(partial ?? {}) };
  merged.gameTypes = [...merged.gameTypes];
  merged.teamNames = [...merged.teamNames];
  assertGameConfigurationShape(merged);
  return merged;
}

/**
 * Bouwt de deel-link uit één serverconfiguratiewaarde (besluit 6:
 * PUBLIC_APP_URL) plus het padpatroon `/j/{inviteId}` uit ARCHITECTURE.md §5.
 * @param {import('./context.mjs').Context} context
 * @param {string} inviteId
 * @returns {string}
 */
export function buildJoinUrl(context, inviteId) {
  return `${context.config.publicAppUrl.replace(/\/+$/, '')}/j/${inviteId}`;
}

/** Spelers die nog echt in de room zitten. */
function activePlayers(players) {
  return players.filter((player) => player.kicked !== true && player.left !== true);
}

/**
 * Bepaalt displayName/generatedName/effectiveName/nameSource voor één nieuwe
 * deelnemer. Alle stappen komen uit server/data/name-processing.js; deze
 * functie kiest alleen wélke stap wanneer draait.
 *
 * Een lege, alleen-witruimte of na normalisatie leeg geworden naam telt als
 * "geen naam opgegeven" en levert de gegenereerde naam op (matrixrij 5). Een
 * profane naam leidt tot dezelfde uitkomst — niet tot een fout — precies zoals
 * name-processing.js's eigen documentatie voorschrijft ("moet tot een nieuwe
 * generatie leiden, niet tot een throw midden in de pijplijn").
 *
 * @param {import('./context.mjs').Context} context
 * @param {{ displayName: unknown, language: string, existingEffectiveNames: string[] }} params
 */
function resolveNames(context, { displayName, language, existingEffectiveNames }) {
  const { nameWordLists, profanityWords } = context.config;
  const generatedName = generateName(language, nameWordLists, existingEffectiveNames);

  const raw = typeof displayName === 'string' ? displayName : '';
  let chosen = raw.length > 0 ? processChosenName(raw, language, existingEffectiveNames) : '';
  if (chosen.length > 0 && isProfane(chosen, language, profanityWords)) {
    chosen = '';
  }

  if (chosen.length === 0) {
    return {
      displayName: null,
      generatedName,
      effectiveName: generatedName,
      nameSource: NAME_SOURCE_GENERATED,
    };
  }
  return {
    displayName: raw,
    generatedName,
    effectiveName: chosen,
    nameSource: NAME_SOURCE_CHOSEN,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// De join-code-claim — zie docs/integration-plan/HANDOFF.md, item INT-1.
// ─────────────────────────────────────────────────────────────────────────────
//
// DIT IS DE ENIGE PLEK IN DE COMPOSITIE DIE DE CLAIM DOET, en dus de enige
// plek die verandert zodra de poort een atomaire claim krijgt.
//
// De poort (`DATA_STORE_METHOD_NAMES`, 18 methoden) heeft géén atomaire claim
// voor de join-code; er is alleen `loadRoomByCode`/`loadRoomByInviteId`, twee
// leesoperaties. Roomcreatie is daarmee onvermijdelijk check-then-act: tussen
// "is deze code vrij?" en het wegschrijven van de room kan een tweede creatie
// dezelfde code pakken. Tegen de in-memory fake heeft dat venster binnen één
// proces geen effect; tegen Redis wél. INT-1 stelt daarom voor:
//
//   claimRoomLocatorsAtomically({ roomId, code, inviteHash, ttlSeconds })
//     → { ok: true } | { ok: false, conflict: 'code' | 'inviteHash' }
//
// DM heeft die uitbreiding inmiddels als fase DM10 opgepakt
// (docs/data-model-plan/prompts/DM10-room-locator-claim.md), inclusief een
// `releaseRoomLocators({ roomId, code, inviteHash })`. Zodra die methoden in
// de poort staan vervangen ze hieronder de twee lookups; de retry-lus en alle
// aanroepers blijven ongewijzigd. De TTL van de claim volgt
// `ROOM_TTL_SECONDS` uit server/data/ttl.js.
//
// `generateGameCode()` wordt BEWUST ZONDER `isTaken`-callback aangeroepen:
// die callback is optioneel en moet synchroon zijn, en room-codes.js werpt
// sinds 2 augustus expliciet op een async callback (een Promise is nooit
// `=== true`, waardoor de uniciteitscontrole stil zou verdwijnen). De store is
// async, dus die route is dicht en de retry-lus hoort hier.

/**
 * Genereert en claimt een vrije `code` en `inviteId` voor een nieuwe room.
 *
 * @param {import('./context.mjs').Context} context
 * @param {{ roomId: string, maxAttempts?: number }} params
 * @returns {Promise<{ code: string, inviteId: string, inviteHash: string }>}
 * @throws {import('../architecture/room-codes.js').GameCodeExhaustedError}
 *   als geen van de pogingen een vrije code oplevert
 */
export async function claimLocators(context, { roomId, maxAttempts = DEFAULT_LOCATOR_ATTEMPTS } = {}) {
  let code = null;
  for (let attempt = 1; attempt <= maxAttempts && code === null; attempt += 1) {
    const candidate = generateGameCode();
    if ((await context.store.loadRoomByCode(candidate)) === null) {
      code = candidate;
    }
  }
  if (code === null) {
    // Het gedocumenteerde foutcontract van room-codes.js, ongewijzigd
    // overgenomen: name 'GameCodeExhaustedError', code 'CODE_SPACE_EXHAUSTED'.
    // Geen eigen tweede uitputtingsfout.
    throw new GameCodeExhaustedError(maxAttempts);
  }

  let inviteId = null;
  for (let attempt = 1; attempt <= maxAttempts && inviteId === null; attempt += 1) {
    const candidate = generateInviteId();
    if ((await context.store.loadRoomByInviteId(candidate)) === null) {
      inviteId = candidate;
    }
  }
  if (inviteId === null) {
    throw new RangeError(`claimLocators: geen vrije inviteId na ${maxAttempts} pogingen voor roomId ${JSON.stringify(roomId)}.`);
  }

  // De hash is wat de poort volgens INT-1 §6 en DATA-MODEL.md's
  // `room:invite:{inviteHash}` hoort te krijgen — nooit de capability zelf.
  // De huidige poort indexeert op de rúwe inviteId (`loadRoomByInviteId`) en
  // Room heeft geen `inviteHash`-veld, dus de hash heeft nu nog geen
  // opslagplaats. Hij wordt hier al berekend zodat de atomaire claim uit
  // INT-1 straks precies dit argument krijgt. Zie de handoff-notitie.
  const inviteHash = hashInviteId(inviteId, context.config.tokenPepper);

  return { code, inviteId, inviteHash };
}

/**
 * Maakt een room met hostsessie aan (`POST /api/v1/games`).
 *
 * Bij `hostParticipates: false` krijgt de host uitsluitend de hostrol:
 * `playerId` en `effectiveName` zijn `null` en er wordt geen Player-entiteit
 * aangemaakt (matrixrij 1). Bij `true` krijgt hij daarnaast een normale
 * spelerplek, in exact dezelfde Player-vorm als een gewone joiner (rij 2).
 *
 * @param {import('./context.mjs').Context} context
 * @param {{ config?: object, hostParticipates: boolean, displayName?: string|null }} params
 * @returns {Promise<{ ok: true, value: {
 *   roomId: string, gameCode: string, inviteId: string, inviteHash: string,
 *   joinUrl: string, sessionToken: string, sessionId: string,
 *   roles: string[], playerId: string|null, effectiveName: string|null,
 * } }>}
 */
export async function createRoom(context, { config, hostParticipates, displayName = null } = {}) {
  if (typeof hostParticipates !== 'boolean') {
    throw new TypeError(`createRoom: hostParticipates moet een boolean zijn, kreeg: ${typeof hostParticipates}`);
  }

  const gameConfiguration = resolveGameConfiguration(config);
  const roomId = createId(context, 'room');
  const sessionId = createId(context, 'sess');
  const { code, inviteId, inviteHash } = await claimLocators(context, { roomId });
  const { token, tokenHash } = createSessionToken(context);
  const createdAt = context.now();

  const room = {
    id: roomId,
    code,
    inviteId,
    phase: 'LOBBY',
    createdAt,
    lastActivityAt: createdAt,
    hostSessionIds: [sessionId],
    locked: false,
    config: gameConfiguration,
    currentMatchId: null,
  };
  assertRoomShape(room);

  let player = null;
  if (hostParticipates) {
    const names = resolveNames(context, {
      displayName,
      language: gameConfiguration.language,
      existingEffectiveNames: [],
    });
    player = {
      id: createId(context, 'p'),
      roomId,
      sessionId,
      displayName: names.displayName,
      generatedName: names.generatedName,
      effectiveName: names.effectiveName,
      nameSource: names.nameSource,
      teamId: null,
      score: 0,
      correctCount: 0,
      correctResponseTimeMsTotal: 0,
      connected: false,
      eligibleFromRound: 1,
      joinedAt: createdAt,
      left: false,
      kicked: false,
    };
    assertPlayerShape(player);
  }

  const session = {
    id: sessionId,
    roomId,
    roles: hostParticipates ? ['host', 'player'] : ['host'],
    playerId: player === null ? null : player.id,
    tokenHash,
    createdAt,
    lastSeenAt: createdAt,
    connectedSocketIds: [],
    revoked: false,
  };
  assertSessionShape(session);

  // saveRoom eerst: dat is de schrijfactie die code en inviteId in de indexen
  // zet en dus het check-then-act-venster uit INT-1 sluit.
  await context.store.saveRoom(room);
  await context.store.saveSession(session);
  if (player !== null) {
    await context.store.savePlayer(player);
  }

  return succeed({
    roomId,
    gameCode: code,
    inviteId,
    inviteHash,
    joinUrl: buildJoinUrl(context, inviteId),
    sessionToken: token,
    sessionId,
    roles: [...session.roles],
    playerId: session.playerId,
    effectiveName: player === null ? null : player.effectiveName,
  });
}

/**
 * Het lichte pre-join-previewendpoint uit besluit 7: valideert de invite en
 * levert een servergegenereerde naamsuggestie, ZONDER sessie of Player aan te
 * maken en zonder de room te muteren.
 *
 * De suggestie wordt tegen de al bezette namen in de room gegenereerd, zodat
 * de speler geen suggestie krijgt die bij het joinen alsnog een suffix
 * oploopt.
 *
 * KEUZE — welke velden de preview teruggeeft ligt nergens vast (besluit 7
 * noemt alleen "valideert de invite" en "naamsuggestie"). Meegegeven is het
 * minimum dat de client nodig heeft om vóór het joinen te kunnen tonen dat de
 * room vol of vergrendeld is. Bewust NIET meegegeven: de join-code (een
 * tweede joincapability, die de preview niet hoeft te lekken) en spelernamen.
 *
 * @param {import('./context.mjs').Context} context
 * @param {{ inviteId: string }} params
 */
export async function previewInvite(context, { inviteId } = {}) {
  if (!isValidInviteId(inviteId)) {
    return fail(CODES.INVITE_INVALID);
  }
  const room = await context.store.loadRoomByInviteId(inviteId);
  if (room === null) {
    return fail(CODES.GAME_NOT_FOUND);
  }

  const players = activePlayers(await context.store.listPlayers(room.id));
  const suggestedName = generateName(
    room.config.language,
    context.config.nameWordLists,
    players.map((player) => player.effectiveName),
  );

  return succeed({
    roomId: room.id,
    suggestedName,
    phase: room.phase,
    locked: room.locked,
    allowLateJoin: room.config.allowLateJoin,
    playerCount: players.length,
    maxPlayers: room.config.maxPlayers,
  });
}

/**
 * Zoekt de room op via precies één locator.
 * @returns {Promise<{ ok: true, value: object } | { ok: false, code: string }>}
 */
async function locateRoom(context, { inviteId, gameCode }) {
  const providesInviteId = inviteId !== undefined && inviteId !== null;
  const providesGameCode = gameCode !== undefined && gameCode !== null;
  if (providesInviteId === providesGameCode) {
    // Beide of geen van beide — "precies één locator" (PROTOCOL.md) geschonden.
    return fail(CODES.INVITE_INVALID);
  }

  if (providesInviteId) {
    if (!isValidInviteId(inviteId)) {
      return fail(CODES.INVITE_INVALID);
    }
    const room = await context.store.loadRoomByInviteId(inviteId);
    return room === null ? fail(CODES.GAME_NOT_FOUND) : succeed(room);
  }

  // KEUZE — foutcodescheiding bij de join-code (matrixrij 4): een syntactisch
  // onjuiste code (niet exact zes cijfers) is een vormfout → INVITE_INVALID,
  // dezelfde toepassingskeuze die rest-games-create-join.mjs al maakt. Een
  // welgevormde maar onbekende code is een niet-bestaande room →
  // GAME_NOT_FOUND. PROTOCOL.md schrijft dit onderscheid niet expliciet voor.
  if (!isValidGameCode(gameCode)) {
    return fail(CODES.INVITE_INVALID);
  }
  const room = await context.store.loadRoomByCode(gameCode);
  return room === null ? fail(CODES.GAME_NOT_FOUND) : succeed(room);
}

/**
 * Joinen via code of inviteId (`POST /api/v1/games/join`). Precies één
 * locator; een lege of ontbrekende naam levert een gegenereerde naam op
 * (matrixrij 5).
 *
 * `eligibleFromRound` is optioneel en wordt door de MATCH-laag geleverd bij
 * een late join: alleen die laag kent `Match.roundIndex` en dus het nummer van
 * de eerstvolgende ronde. Default 1 (lobby-join). Deze module verzint dat
 * getal niet zelf.
 *
 * @param {import('./context.mjs').Context} context
 * @param {{
 *   inviteId?: string, gameCode?: string,
 *   displayName?: string|null,
 *   joinSource: 'qr'|'shared_link'|'code'|'unknown',
 *   eligibleFromRound?: number,
 * }} params
 */
export async function joinRoom(context, {
  inviteId,
  gameCode,
  displayName = null,
  joinSource,
  eligibleFromRound = 1,
} = {}) {
  if (!JOIN_SOURCES.includes(joinSource)) {
    return fail(CODES.INVITE_INVALID);
  }

  const located = await locateRoom(context, { inviteId, gameCode });
  if (!located.ok) {
    return located;
  }
  const room = located.value;

  if (room.locked === true) {
    return fail(CODES.ROOM_LOCKED);
  }

  // Late join: de room is niet meer in LOBBY. `allowLateJoin` beslist.
  // Matrixrij 9 (punten/eligibility van late joiners) hoort bij de
  // match-lifecycle; hier alleen de toegangsvraag.
  if (room.phase !== 'LOBBY' && room.config.allowLateJoin !== true) {
    return fail(CODES.LATE_JOIN_DISABLED);
  }

  const players = activePlayers(await context.store.listPlayers(room.id));
  if (players.length >= room.config.maxPlayers) {
    return fail(CODES.GAME_FULL);
  }

  const names = resolveNames(context, {
    displayName,
    language: room.config.language,
    existingEffectiveNames: players.map((player) => player.effectiveName),
  });

  const sessionId = createId(context, 'sess');
  const playerId = createId(context, 'p');
  const { token, tokenHash } = createSessionToken(context);
  const joinedAt = context.now();

  const player = {
    id: playerId,
    roomId: room.id,
    sessionId,
    displayName: names.displayName,
    generatedName: names.generatedName,
    effectiveName: names.effectiveName,
    nameSource: names.nameSource,
    teamId: null,
    score: 0,
    correctCount: 0,
    correctResponseTimeMsTotal: 0,
    connected: false,
    eligibleFromRound,
    joinedAt,
    left: false,
    kicked: false,
  };
  assertPlayerShape(player);

  const session = {
    id: sessionId,
    roomId: room.id,
    roles: ['player'],
    playerId,
    tokenHash,
    createdAt: joinedAt,
    lastSeenAt: joinedAt,
    connectedSocketIds: [],
    revoked: false,
  };
  assertSessionShape(session);

  await context.store.savePlayer(player);
  await context.store.saveSession(session);
  await touchRoom(context, room, joinedAt);

  return succeed({
    roomId: room.id,
    gameCode: room.code,
    sessionToken: token,
    sessionId,
    roles: ['player'],
    playerId,
    effectiveName: player.effectiveName,
    joinSource,
  });
}

/**
 * Schrijft `lastActivityAt` bij. Aparte functie omdat het een read-modify-
 * write over het HELE Room-document is: de poort kent geen partiële update.
 * Zie de handoff-notitie — tegen een echte, gelijktijdige store kan dit een
 * concurrent `phase`-update overschrijven.
 */
async function touchRoom(context, room, at) {
  await context.store.saveRoom({ ...room, lastActivityAt: at });
}

/**
 * Levert de invite opnieuw op zodat IEDERE deelnemer — niet alleen de host —
 * de QR/deel-link kan tonen (matrixrij 6, ARCHITECTURE.md §5: "Alle
 * deelnemers mogen dezelfde invite tonen"). Er is hier daarom bewust geen
 * rolcontrole.
 *
 * @param {import('./context.mjs').Context} context
 * @param {{ roomId: string }} params
 */
export async function getShareInfo(context, { roomId } = {}) {
  const room = await context.store.loadRoom(roomId);
  if (room === null) {
    return fail(CODES.GAME_NOT_FOUND);
  }
  return succeed({
    roomId: room.id,
    gameCode: room.code,
    inviteId: room.inviteId,
    joinUrl: buildJoinUrl(context, room.inviteId),
  });
}

/**
 * Vergrendelt of ontgrendelt de room (matrixrij 8). Nieuwe joins worden
 * daarna geweigerd met `ROOM_LOCKED`, resp. weer toegelaten.
 *
 * @param {import('./context.mjs').Context} context
 * @param {{ roomId: string, locked: boolean }} params
 */
export async function setRoomLocked(context, { roomId, locked } = {}) {
  if (typeof locked !== 'boolean') {
    throw new TypeError(`setRoomLocked: locked moet een boolean zijn, kreeg: ${typeof locked}`);
  }
  const room = await context.store.loadRoom(roomId);
  if (room === null) {
    return fail(CODES.GAME_NOT_FOUND);
  }
  const at = context.now();
  const updated = { ...room, locked, lastActivityAt: at };
  assertRoomShape(updated);
  await context.store.saveRoom(updated);
  return succeed({ roomId: room.id, locked });
}

/**
 * Kickt een speler (matrixrij 10): de Player wordt als `kicked` gemarkeerd en
 * zijn sessie wordt ingetrokken, zodat hernieuwd gebruik van hetzelfde token
 * via `resolveSession` op `SESSION_REVOKED` uitkomt.
 *
 * Besluit 4 onderscheidt dit expliciet van vrijwillig verlaten: dát zet
 * `left: true` zonder het token in te trekken, een kick trekt het wél in.
 * KEUZE — hier wordt alleen `kicked` gezet en `left` ongemoeid gelaten; de
 * twee vlaggen zijn losse feiten en deze module telt een gekickte speler
 * overal al als niet-actief.
 *
 * @param {import('./context.mjs').Context} context
 * @param {{ roomId: string, playerId: string }} params
 */
export async function kickPlayer(context, { roomId, playerId } = {}) {
  const room = await context.store.loadRoom(roomId);
  if (room === null) {
    return fail(CODES.GAME_NOT_FOUND);
  }
  const player = await context.store.loadPlayer(roomId, playerId);
  if (player === null) {
    // KEUZE — PROTOCOL.md kent geen "onbekende speler"-code. NOT_PLAYER is de
    // dichtstbijzijnde bestaande code uit de autorisatiecategorie.
    return fail(CODES.NOT_PLAYER);
  }

  const at = context.now();
  const kicked = { ...player, kicked: true };
  assertPlayerShape(kicked);
  await context.store.savePlayer(kicked);

  const session = await context.store.loadSession(roomId, player.sessionId);
  if (session !== null) {
    const revoked = { ...session, revoked: true, lastSeenAt: at };
    assertSessionShape(revoked);
    await context.store.saveSession(revoked);
  }
  await touchRoom(context, room, at);

  return succeed({ roomId, playerId, sessionId: player.sessionId, revoked: session !== null });
}

/**
 * Resolvet een aangeboden sessietoken naar de bijbehorende Session.
 *
 * `sessionId` en `roomId` moeten worden meegegeven omdat de poort alleen
 * `loadSession(roomId, sessionId)` heeft en geen lookup op tokenhash — zie de
 * handoff-notitie; de echte transportlaag krijgt van de client uitsluitend
 * `Authorization: Bearer <sessionToken>` en heeft die lookup wél nodig. Er
 * wordt hier bewust geen schaduwindex naast de poort gebouwd.
 *
 * Volgorde is bewust: eerst de tokenvergelijking (constant-time), dan pas de
 * revocatiecheck. Andersom zou een verkeerd token verklappen dát een sessie
 * is ingetrokken.
 *
 * @param {import('./context.mjs').Context} context
 * @param {{ roomId: string, sessionId: string, sessionToken: string }} params
 */
export async function resolveSession(context, { roomId, sessionId, sessionToken } = {}) {
  const session = await context.store.loadSession(roomId, sessionId);
  if (session === null) {
    return fail(CODES.TOKEN_INVALID);
  }
  if (!verifySessionToken(context, sessionToken, session.tokenHash)) {
    return fail(CODES.TOKEN_INVALID);
  }
  if (session.revoked === true) {
    return fail(CODES.SESSION_REVOKED);
  }
  return succeed(session);
}
