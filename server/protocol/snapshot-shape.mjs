/**
 * @file PR5d — de `snapshot`-module: vorm van de state-snapshot + de
 *   invariant "geen correct antwoord van een actieve ronde".
 * @see docs/multiplayer/PROTOCOL.md — §State-snapshot.
 * @see docs/protocol-plan/prompts/PR5-server-events.md — sub-batch PR5d,
 *   functies `validateSnapshotShape` en `assertNoActiveRoundAnswerLeak`.
 * @see docs/protocol-plan/README.md — modulestabel, rij `snapshot`.
 *
 * Gebruikt door zowel `GET /api/v1/games/{code}/state` (PR3) als het
 * `room:state`-event (PR5a, `./server-events-room-lifecycle.mjs`'s
 * `validateRoomStatePayload` is bewust alleen een ondiepe plaatshouder — die
 * hergebruikt exact deze module wanneer de diepe snapshot-vorm nodig is,
 * zelfde gelaagde aanpak als PR4c/PR4d voor `round:answer`).
 *
 * Pure vorm-validatie, geen I/O, geen inhoud (Uitgangspunt 5). Elke
 * `ok: false` draagt `code: null` — zie de toelichting bovenaan
 * `./server-events-room-lifecycle.mjs`.
 */

/** @typedef {{ ok: true } | { ok: false, code: string | null }} ValidationResult */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Valideert de volledige `pausedState`-vorm uit `DATA-MODEL.md`/`PROTOCOL.md`
 * (`DECISIONS.md` punt 10): `previousPhase`, `remainingMs`, `reason`,
 * `pausedAt` — allemaal verplicht wanneer niet `null`. `reason` wordt alleen
 * op vorm getoetst (niet-lege string), niet tegen de 4 vastgelegde waarden —
 * clients houden bewust een generieke fallback voor onbekende waarden
 * (`DECISIONS.md` punt 11), dus een striktere enum-check hier zou toekomstige,
 * nog niet bedachte redenen onterecht laten falen.
 * @param {unknown} pausedState
 * @returns {ValidationResult}
 */
function validatePausedState(pausedState) {
  if (pausedState === null) return { ok: true };
  if (!isPlainObject(pausedState)) return { ok: false, code: null };

  const keys = Object.keys(pausedState);
  const expectedKeys = ['previousPhase', 'remainingMs', 'reason', 'pausedAt'];
  if (keys.length !== expectedKeys.length || !expectedKeys.every((key) => keys.includes(key))) {
    return { ok: false, code: null };
  }

  const { previousPhase, remainingMs, reason, pausedAt } = pausedState;
  if (typeof previousPhase !== 'string' || previousPhase.length === 0) return { ok: false, code: null };
  if (!Number.isFinite(remainingMs) || remainingMs < 0) return { ok: false, code: null };
  if (typeof reason !== 'string' || reason.length === 0) return { ok: false, code: null };
  if (!Number.isFinite(pausedAt)) return { ok: false, code: null };

  return { ok: true };
}

/**
 * Valideert `snapshot.room` tegen de letterlijke velden uit §State-snapshot:
 * `code`, `phase`, `locked`, `allowLateJoin`, `joinUrl`, `playerCount`,
 * `config`, `matchId`, `matchSequence`, `pausedState` — alle tien verplicht,
 * geen andere sleutels (Ontwerpkeuze #2: literaal vastgelegde vorm). `config`
 * en `matchId` worden alleen op type getoetst (object resp. string) — de
 * inhoud van `config` is spelinhoud, niet vorm. `matchSequence` is
 * `Match.sequence` uit `DATA-MODEL.md` (integer ≥ 1,
 * `docs/integration-plan/HANDOFF.md` INT-2). `pausedState` is `null` of de
 * volledige vorm, zie `validatePausedState`.
 * @param {unknown} room
 * @returns {ValidationResult}
 */
function validateSnapshotRoom(room) {
  if (!isPlainObject(room)) return { ok: false, code: null };

  const keys = Object.keys(room);
  const expectedKeys = [
    'code', 'phase', 'locked', 'allowLateJoin', 'joinUrl', 'playerCount', 'config', 'matchId',
    'matchSequence', 'pausedState',
  ];
  if (keys.length !== expectedKeys.length || !expectedKeys.every((key) => keys.includes(key))) {
    return { ok: false, code: null };
  }

  const {
    code, phase, locked, allowLateJoin, joinUrl, playerCount, config, matchId,
    matchSequence, pausedState,
  } = room;
  if (typeof code !== 'string' || code.length === 0) return { ok: false, code: null };
  if (typeof phase !== 'string' || phase.length === 0) return { ok: false, code: null };
  if (typeof locked !== 'boolean') return { ok: false, code: null };
  if (typeof allowLateJoin !== 'boolean') return { ok: false, code: null };
  if (typeof joinUrl !== 'string' || joinUrl.length === 0) return { ok: false, code: null };
  if (!Number.isInteger(playerCount) || playerCount < 0) return { ok: false, code: null };
  if (!isPlainObject(config)) return { ok: false, code: null };
  // INT-17 (bug-report-snapshot-500-on-lobby.md): vóór de eerste match bestaat
  // er geen match — DATA-MODEL.md §Room toont zelf `currentMatchId: null`. In
  // die pre-match-lobby zijn `matchId` en `matchSequence` daarom expliciet
  // ALLEBEI null; elke andere combinatie (één van beide null) is inconsistent
  // en wordt afgewezen. Ordeningssemantiek voor snapshot-precedence: een
  // snapshot zonder match telt als sequence 0 — elke echte match wint.
  const preMatch = matchId === null && matchSequence === null;
  if (!preMatch) {
    if (matchId === null || matchSequence === null) return { ok: false, code: null };
    if (typeof matchId !== 'string' || matchId.length === 0) return { ok: false, code: null };
    if (!Number.isInteger(matchSequence) || matchSequence < 1) return { ok: false, code: null };
  }

  const pausedStateResult = validatePausedState(pausedState);
  if (!pausedStateResult.ok) return pausedStateResult;

  return { ok: true };
}

/**
 * Valideert `snapshot.scoreboard` tegen de letterlijke vorm `{ top: [],
 * self: {} }` uit §State-snapshot: `top` een array, `self` een object, geen
 * andere sleutels.
 * @param {unknown} scoreboard
 * @returns {ValidationResult}
 */
function validateSnapshotScoreboard(scoreboard) {
  if (!isPlainObject(scoreboard)) return { ok: false, code: null };

  const keys = Object.keys(scoreboard);
  const expectedKeys = ['top', 'self'];
  if (keys.length !== expectedKeys.length || !expectedKeys.every((key) => keys.includes(key))) {
    return { ok: false, code: null };
  }
  if (!Array.isArray(scoreboard.top)) return { ok: false, code: null };
  if (!isPlainObject(scoreboard.self)) return { ok: false, code: null };

  return { ok: true };
}

/**
 * Valideert `snapshot.self` — grotendeels ongebroken (zie
 * `validateSnapshotShape`'s JSDoc voor waarom), met één uitzondering:
 * `eligibleFromRound` (`DECISIONS.md` punt 3) wordt wél expliciet getoetst
 * tegen de exacte eis uit `DATA-MODEL.md`/`GAME-RULES.md` — een integer
 * `>= 1`, niet "een willekeurig getal". Dit is de enige `self`-sleutel die
 * deze module kent; overige `self`-velden (`roles`, `playerId`, ...) blijven
 * ongetoetst spelinhoud.
 * @param {unknown} self
 * @returns {ValidationResult}
 */
function validateSnapshotSelf(self) {
  if (!isPlainObject(self)) return { ok: false, code: null };

  const { eligibleFromRound } = self;
  if (!Number.isInteger(eligibleFromRound) || eligibleFromRound < 1) {
    return { ok: false, code: null };
  }

  return { ok: true };
}

/**
 * Valideert de volledige snapshot-vorm (gebruikt door zowel `GET
 * /api/v1/games/{code}/state` als `room:state`), tegen de letterlijke
 * structuur uit §State-snapshot: `protocolVersion`, `serverTime`, `room`
 * (zie `validateSnapshotRoom`), `self` (zie `validateSnapshotSelf`),
 * `currentRound`, `scoreboard` (zie `validateSnapshotScoreboard`) — geen
 * andere toplevel-sleutels (Ontwerpkeuze #2). `currentRound` wordt alleen op
 * "is dit een object" getoetst: `PROTOCOL.md` breekt de interne velden niet
 * uit als onderdeel van de letterlijke snapshot-structuurcitatie (in
 * tegenstelling tot `room` en `scoreboard`, die dat wél doen), en de inhoud
 * van `currentRound` is bovendien spelinhoud (Uitgangspunt 5).
 * @param {unknown} snapshot
 * @returns {ValidationResult}
 */
export function validateSnapshotShape(snapshot) {
  if (!isPlainObject(snapshot)) return { ok: false, code: null };

  const keys = Object.keys(snapshot);
  const expectedKeys = ['protocolVersion', 'serverTime', 'room', 'self', 'currentRound', 'scoreboard'];
  if (keys.length !== expectedKeys.length || !expectedKeys.every((key) => keys.includes(key))) {
    return { ok: false, code: null };
  }

  const { protocolVersion, serverTime, room, self, currentRound, scoreboard } = snapshot;

  if (typeof protocolVersion !== 'string' || protocolVersion.length === 0) {
    return { ok: false, code: null };
  }
  if (typeof serverTime !== 'number' || !Number.isFinite(serverTime)) {
    return { ok: false, code: null };
  }

  const roomResult = validateSnapshotRoom(room);
  if (!roomResult.ok) return roomResult;

  const selfResult = validateSnapshotSelf(self);
  if (!selfResult.ok) return selfResult;

  if (!isPlainObject(currentRound)) return { ok: false, code: null };

  const scoreboardResult = validateSnapshotScoreboard(scoreboard);
  if (!scoreboardResult.ok) return scoreboardResult;

  return { ok: true };
}

/**
 * De veilige sleutels van `currentRound` tijdens een actieve ronde —
 * letterlijk de toplevel-velden van het `round:started`-payloadvoorbeeld
 * (§Voorbeeld `round:started`): `matchId`, `roundId`, `roundNumber`,
 * `totalRounds`, `gameType`, `contentVersion`, `rendererVersion`, `question`,
 * `startsAt`, `endsAt`. `rendererVersion` is het algemene, canonieke
 * roundveld dat `PR9`/`PR11` toevoegen naast `contentVersion` (`DECISIONS.md`
 * punt 21) — géén correctheidsveld, dus veilig tijdens `ROUND_ACTIVE`.
 * Bewust een allowlist, geen denylist van verboden namen (bv.
 * `correctOptionId`, `correctAnswer`) — zodat een onbekend/nieuw
 * correctheidsveld niet per ongeluk toch doorglipt.
 * @type {ReadonlySet<string>}
 */
const SAFE_ACTIVE_ROUND_KEYS = new Set([
  'matchId', 'roundId', 'roundNumber', 'totalRounds', 'gameType', 'contentVersion',
  'rendererVersion', 'question', 'startsAt', 'endsAt',
]);

/**
 * Invariant-toets: "een snapshot bevat nooit het correcte antwoord van een
 * actieve ronde" (§State-snapshot, letterlijk). Wanneer
 * `snapshot.room.phase === "ROUND_ACTIVE"`, moeten de sleutels van
 * `snapshot.currentRound` een subset zijn van `SAFE_ACTIVE_ROUND_KEYS`. Bij
 * elke andere fase (of wanneer `room.phase` niet `ROUND_ACTIVE` is) is de
 * invariant niet van toepassing en retourneert deze functie `ok: true`
 * zonder `currentRound` verder te inspecteren.
 * @param {unknown} snapshot
 * @returns {ValidationResult}
 */
export function assertNoActiveRoundAnswerLeak(snapshot) {
  if (!isPlainObject(snapshot)) return { ok: false, code: null };

  const room = snapshot.room;
  if (!isPlainObject(room)) return { ok: false, code: null };
  if (room.phase !== 'ROUND_ACTIVE') return { ok: true };

  const currentRound = snapshot.currentRound;
  if (!isPlainObject(currentRound)) return { ok: false, code: null };

  const hasUnsafeKey = Object.keys(currentRound).some((key) => !SAFE_ACTIVE_ROUND_KEYS.has(key));
  if (hasUnsafeKey) return { ok: false, code: null };

  return { ok: true };
}
