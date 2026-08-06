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
import { ROOM_TTL_SECONDS } from '../data/ttl.js';
import { assertGameConfigurationShape } from '../data/types/game-configuration.js';
import { assertPlayerShape } from '../data/types/player.js';
import { assertRoomShape } from '../data/types/room.js';
import { assertSessionShape } from '../data/types/session.js';
import { ALL_ERROR_CODES } from '../protocol/error-codes.mjs';
import { PLAYER_COLORS, UPDATABLE_CONFIG_KEYS, validateGameUpdateConfigPayload } from '../protocol/client-events-dispatch.mjs';
import { PLAYABLE_GAME_TYPES, isPlayableGameType } from '../../shared/content/game-catalog.mjs';
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
  // Besluit 40 + feedbackronde (4 aug 2026): rename/recolor/update-config.
  INVALID_PHASE: 'INVALID_PHASE',
  INVALID_ANSWER_FORMAT: 'INVALID_ANSWER_FORMAT',
  INVALID_REQUEST: 'INVALID_REQUEST',
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

/** Aantal (code, inviteId)-kandidaatparen dat claimLocators probeert te claimen. */
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
  // Besluit C (DOELBEELD-v2 §3): standaard AAN — de uitslag loopt vanzelf door.
  // Uit betekent: de uitslagfase wacht op de host, en dát onthullen ís dan de
  // ene hostactie van de ronde (besluit 1).
  autoReveal: true,
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
  merged.gameTypes = Array.isArray(merged.gameTypes) ? [...merged.gameTypes] : merged.gameTypes;
  merged.teamNames = [...merged.teamNames];
  assertGameConfigurationShape(merged);

  // §A1 — EXACT ÉÉN SPEELBARE GAMETYPE, op de enige trechter waar room-configs
  // ontstaan én wijzigen (createRoom én updateConfig lopen hier langs).
  //
  // Waarom hier en niet in `assertGameConfigurationShape`: die functie keurt de
  // VORM van een GameConfiguration zoals DATA-MODEL.md hem definieert (een
  // lijst), en dat contract blijft staan voor de dag dat mixed games terugkomen.
  // Wat er vandaag een room in mag, is een productbesluit (32: één gameType per
  // match) plus een ketenfeit (game-catalog.mjs: is de hele keten er klaar
  // voor?) — en dat hoort in de compositie.
  if (merged.gameTypes.length !== 1) {
    throw new RangeError(
      `resolveGameConfiguration: gameTypes moet exact één waarde bevatten (besluit 32), kreeg: ${JSON.stringify(merged.gameTypes)}`,
    );
  }
  if (!isPlayableGameType(merged.gameTypes[0])) {
    throw new RangeError(
      `resolveGameConfiguration: gameType ${JSON.stringify(merged.gameTypes[0])} is niet speelbaar; ` +
        `speelbaar zijn: ${JSON.stringify(PLAYABLE_GAME_TYPES)} (shared/content/game-catalog.mjs)`,
    );
  }
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
 * De startkleur voor de n-de binnenkomer (0-based): round-robin over het
 * gesloten `PLAYER_COLORS`-palet, op volgorde van binnenkomst (besluit 40 +
 * feedbackronde, 4 aug 2026). De teller loopt over ALLE ooit aangemaakte
 * spelers van de room — ook gekickte/vertrokken — zodat een vertrek de
 * kleuren van latere binnenkomers niet verschuift.
 * @param {number} arrivalIndex
 * @returns {string}
 */
function colorForArrival(arrivalIndex) {
  return PLAYER_COLORS[arrivalIndex % PLAYER_COLORS.length];
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
// plek die veranderde toen de poort de atomaire claim kreeg.
//
// INT-1 is opgelost (variant A): de poort heeft nu
//
//   claimRoomLocatorsAtomically({ roomId, code, inviteHash, ttlSeconds })
//     → { ok: true } | { ok: false, conflict: 'code' | 'inviteHash' }
//   releaseRoomLocators({ roomId, code, inviteHash })
//   refreshRoomLocators({ roomId, code, inviteHash, ttlSeconds })
//
// (docs/data-model-plan/prompts/DM10-room-locator-claim.md). Daarmee is
// roomcreatie GEEN check-then-act meer: er wordt niet eerst gelezen of een
// code vrij is en daarna geschreven — de claim zelf beslist, in één operatie,
// en een bezette locator komt terug als `{ ok: false, conflict }`. Een conflict
// is een normale uitkomst (INT-1 §3), geen fout: de lus genereert dan een
// nieuwe kandidaat. `loadRoomByCode` wordt hier daarom niet meer aangeroepen.
//
// De TTL van de claim volgt `ROOM_TTL_SECONDS` uit server/data/ttl.js, zodat de
// indexen niet eerder verlopen dan de room zelf (INT-1 §4); `touchRoom`
// verlengt ze mee via `refreshRoomLocators`.
//
// De poort krijgt de HASH, nooit de platte `inviteId` (INT-1 §6,
// DATA-MODEL.md's `room:invite:{inviteHash}`). Hashen doet deze laag, met
// `hashInviteId` uit room-codes.js.
//
// `generateGameCode()` wordt BEWUST ZONDER `isTaken`-callback aangeroepen:
// die callback is optioneel en moet synchroon zijn, en room-codes.js werpt
// sinds 2 augustus expliciet op een async callback (een Promise is nooit
// `=== true`, waardoor de uniciteitscontrole stil zou verdwijnen). De store is
// async, dus die route is dicht en de retry-lus hoort hier.

/**
 * Genereert en claimt een vrije `code` en `inviteId` voor een nieuwe room.
 *
 * Per poging worden BEIDE locators opnieuw gegenereerd en samen aangeboden:
 * de claim is één atomaire operatie over het paar (INT-1: "beide of geen van
 * beide"), dus er bestaat geen halve toestand waarin alleen de code al vastligt
 * en er nog een invite bij gezocht moet worden.
 *
 * @param {import('./context.mjs').Context} context
 * @param {{ roomId: string, maxAttempts?: number }} params
 * @returns {Promise<{ code: string, inviteId: string, inviteHash: string }>}
 * @throws {import('../architecture/room-codes.js').GameCodeExhaustedError}
 *   als elke poging op een bezette CODE strandde
 * @throws {RangeError} als elke poging op een bezette INVITE-HASH strandde
 */
export async function claimLocators(context, { roomId, maxAttempts = DEFAULT_LOCATOR_ATTEMPTS } = {}) {
  let lastConflict = 'code';
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const code = generateGameCode();
    const inviteId = generateInviteId();
    // De ACTIEVE pepperversie, net als bij een nieuwe sessietoken. De invite
    // blijft ook na een rotatie vindbaar doordat `findRoomByInviteId` de
    // overige peppers meeneemt en `Room.inviteHash` bewaart met welke hash
    // deze room daadwerkelijk in de index staat.
    const inviteHash = hashInviteId(inviteId, activePepper(context));

    const claim = await context.store.claimRoomLocatorsAtomically({
      roomId,
      code,
      inviteHash,
      ttlSeconds: ROOM_TTL_SECONDS,
    });
    if (claim.ok === true) {
      return { code, inviteId, inviteHash };
    }
    lastConflict = claim.conflict;
  }

  if (lastConflict === 'inviteHash') {
    // De codekant was vrij (de poort meldt 'code' zodra díe conflicteert), dus
    // de 132-bits invite-ruimte is de blokkade. Dat is geen uitgeputte
    // coderuimte en verdient daarom niet room-codes.js' foutcontract.
    throw new RangeError(`claimLocators: geen vrije inviteId na ${maxAttempts} pogingen voor roomId ${JSON.stringify(roomId)}.`);
  }
  // Het gedocumenteerde foutcontract van room-codes.js, ongewijzigd
  // overgenomen: name 'GameCodeExhaustedError', code 'CODE_SPACE_EXHAUSTED'.
  // Geen eigen tweede uitputtingsfout.
  throw new GameCodeExhaustedError(maxAttempts);
}

/** De pepper van de ACTIEVE versie — waarmee nieuwe hashes worden gemaakt. */
function activePepper(context) {
  const { version, peppers } = context.config.tokenPeppers;
  return peppers[version];
}

/**
 * Geeft een geslaagde claim weer vrij nadat de rest van de creatie alsnog
 * misging. Zonder dit verbrandt elke mislukte creatie een join-code voor de
 * volle room-TTL (INT-1 §5, variant A).
 *
 * Werpt nooit: deze opruiming draait in een catch-pad en mag de oorspronkelijke
 * fout — de fout die de aanroeper moet zien — niet verdringen.
 */
async function releaseLocators(context, { roomId, code, inviteHash }) {
  try {
    await context.store.releaseRoomLocators({ roomId, code, inviteHash });
  } catch {
    // Bewust stil: de claim verloopt hoe dan ook op zijn eigen TTL, en er is in
    // deze laag geen loggernaad om dit naartoe te schrijven (handoff-notitie).
  }
}

/**
 * Zoekt de room op de platte `inviteId` op, ROTATIEBESTENDIG.
 *
 * De index staat op `hashInviteId(inviteId, pepper)` en die hash draagt — anders
 * dan een tokenhash uit auth-session.mjs, die `${versie}:${hex}` opslaat — GÉÉN
 * versieprefix. Uit de binnenkomende `inviteId` alleen valt dus niet af te
 * leiden met welke pepperversie hij ooit geïndexeerd is. Na een pepperrotatie
 * zou hashen met uitsluitend de actieve pepper daarom élke lopende invite
 * onvindbaar maken.
 *
 * Opgelost met exact dezelfde rotatiebron als `verifyToken`: de peppermap uit
 * `config.tokenPeppers`. Eerst de ACTIEVE versie (het normale geval, één
 * lookup), daarna de overige versies; de eerste treffer wint. Geen tweede
 * mechanisme naast dat van de protocollaag — alleen zoekt `verifyToken` de
 * pepper direct op omdat de opgeslagen hash zijn versie meedraagt, en moet het
 * hier bij gebrek daaraan proberenderwijs.
 *
 * OPEN PUNT (handoff): een versieprefix op `inviteHash`, zoals tokens die wél
 * hebben, lost dit structureel op — dan is het weer één lookup en hoeft een
 * oude pepper niet in de map te blijven staan om invites levend te houden.
 *
 * @param {import('./context.mjs').Context} context
 * @param {string} inviteId - al gevalideerd met `isValidInviteId`
 * @returns {Promise<object|null>}
 */
async function findRoomByInviteId(context, inviteId) {
  const { version, peppers } = context.config.tokenPeppers;
  const versions = [version, ...Object.keys(peppers).filter((candidate) => candidate !== version)];
  for (const pepperVersion of versions) {
    const room = await context.store.loadRoomByInviteHash(hashInviteId(inviteId, peppers[pepperVersion]));
    if (room !== null) {
      return room;
    }
  }
  return null;
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

  // Vanaf hier zijn de locators geclaimd. Alles wat nog kan mislukken vóórdat
  // de room bestaat, moet die claim weer vrijgeven — anders verbrandt een
  // mislukte creatie een join-code voor de volle room-TTL (INT-1 §5, A).
  let roomPersisted = false;
  try {
    const { token, tokenHash } = createSessionToken(context);
    const createdAt = context.now();

    const room = {
      id: roomId,
      code,
      inviteId,
      // ADDITIEF VELD (niet in types/room.js's typedef, wél door
      // `assertRoomShape` genegeerd — die keurt alleen de velden die hij kent).
      // Het Room-document bewaart WAARMEE deze room in de invite-index staat.
      // Zonder dat kunnen `releaseRoomLocators`/`refreshRoomLocators` de
      // indexsleutel alleen terugkrijgen door hem te hergokken uit `inviteId` +
      // de actieve pepper — en precies dat gokt fout zodra de peppers roteren.
      // Zie de handoff-notitie: DM zou het veld in Room's typedef/assertion
      // mogen opnemen.
      inviteHash,
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
        // ADDITIEF VELD (net als Room.inviteHash hierboven: assertPlayerShape
        // keurt alleen de velden die hij kent). De meespelende host is de
        // eerste binnenkomer en krijgt dus PLAYER_COLORS[0].
        color: colorForArrival(0),
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

    // saveRoom eerst: pas dán bestaat de room waar de geclaimde locators naar
    // wijzen. Vanaf dit punt is vrijgeven juist FOUT — dat zou een bestaande,
    // vindbare room onvindbaar maken.
    await context.store.saveRoom(room);
    roomPersisted = true;
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
  } catch (error) {
    if (!roomPersisted) {
      await releaseLocators(context, { roomId, code, inviteHash });
    }
    // Een fout ná `saveRoom` (sessie/speler) laat de room én zijn locators
    // staan: de room is dan echt en vindbaar, alleen zonder hostsessie. Dat
    // half-af zijn is een aparte, niet met een release op te lossen kwestie —
    // zie de handoff-notitie.
    throw error;
  }
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
  const room = await findRoomByInviteId(context, inviteId);
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
    const room = await findRoomByInviteId(context, inviteId);
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

  const allPlayers = await context.store.listPlayers(room.id);
  const players = activePlayers(allPlayers);
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
    // Round-robin op volgorde van binnenkomst; de teller loopt over ALLE ooit
    // aangemaakte spelers (zie colorForArrival).
    color: colorForArrival(allPlayers.length),
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
    color: player.color,
    joinSource,
  });
}

/**
 * Schrijft `lastActivityAt` (en desgewenst andere velden) bij. Aparte functie
 * omdat het een read-modify-write over het HELE Room-document is: de poort
 * kent geen partiële update. Zie de handoff-notitie — tegen een echte,
 * gelijktijdige store kan dit een concurrent `phase`-update overschrijven.
 *
 * Dit is óók het TTL-refreshpad, en dus de plek waar `refreshRoomLocators`
 * hoort (INT-1 §4): zonder die aanroep verlopen `room:code:{code}` en
 * `room:invite:{inviteHash}` op hun oorspronkelijke claim-TTL, terwijl de room
 * zelf door de activiteit blijft leven — een levende room die niemand meer via
 * code of invite kan vinden.
 *
 * De refresh gaat alleen op als het Room-document zijn `inviteHash` draagt.
 * Rooms van vóór dat veld (of uit een fixture die de room buiten `createRoom`
 * om opbouwt) hebben hem niet; hem hier hergokken uit `inviteId` + de actieve
 * pepper zou na een rotatie de verkeerde sleutel verlengen en de echte laten
 * verlopen. Niets verlengen is dan het veilige alternatief.
 *
 * Een refresh die de poort weigert (RangeError: de locators zijn niet meer van
 * deze room) wordt NIET weggeslikt. Dat betekent dat de code of de invite
 * inmiddels naar een andere room wijst, en dan is doorgaan met joinen erger dan
 * falen.
 *
 * GEËXPORTEERD sinds fase 3 (agent 1, F1/F2): `match-lifecycle.mjs` had geen
 * enkel TTL-verlengpad tijdens het spelen — alleen lobby-acties in DIT bestand
 * riepen hem aan. Een room die druk speelt maar geen lobby-actie meer ziet
 * (join/leave/kick/lock/hernoemen/instellingen), verloor zo zijn code- en
 * invite-locator na vier uur, ook middenin een potje. `extraFields` laat een
 * aanroeper die toch al het hele document herschrijft (bv. `currentMatchId`
 * bij `startMatch`/`rematch`) dat in dezelfde write meenemen i.p.v. tweemaal
 * te schrijven.
 *
 * @param {import('./context.mjs').Context} context
 * @param {import('../data/types/room.js').Room} room
 * @param {number} at
 * @param {Record<string, unknown>} [extraFields]
 */
export async function touchRoom(context, room, at, extraFields = {}) {
  const updated = { ...room, ...extraFields, lastActivityAt: at };
  assertRoomShape(updated);
  await context.store.saveRoom(updated);
  if (typeof room.inviteHash === 'string' && room.inviteHash.length > 0) {
    await context.store.refreshRoomLocators({
      roomId: room.id,
      code: room.code,
      inviteHash: room.inviteHash,
      ttlSeconds: ROOM_TTL_SECONDS,
    });
  }
  return updated;
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
  // Via touchRoom, niet rechtstreeks saveRoom: vergrendelen is activiteit en
  // moet dus dezelfde TTL-verlenging krijgen als joinen en kicken, inclusief de
  // locator-refresh. `lastActivityAt` staat er al op; touchRoom zet dezelfde
  // waarde nog eens, wat niets verandert.
  await touchRoom(context, updated, at);
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
 * Laat een speler vrijwillig vertrekken (fase 2, agent 1). Leent de structuur
 * van `kickPlayer` hierboven, maar is er bewust de vrijwillige tegenhanger
 * van: besluit 4 zet hier alleen `left: true` en trekt het sessietoken NIET
 * in (in tegenstelling tot een kick) — reactivatie binnen de TTL door
 * opnieuw te joinen blijft dus mogelijk (PROTOCOL.md §leave).
 *
 * Alleen bij een ECHTE overgang (`player.left` was nog niet `true`) wordt de
 * room-TTL verlengd en `changed: true` teruggegeven, zodat de aanroepende
 * transportlaag een tweede `leave` van dezelfde speler niet nogmaals als
 * `room:player-changed` uitzendt.
 *
 * @param {import('./context.mjs').Context} context
 * @param {{ roomId: string, playerId: string }} params
 */
export async function leaveRoom(context, { roomId, playerId } = {}) {
  const room = await context.store.loadRoom(roomId);
  if (room === null) {
    return fail(CODES.GAME_NOT_FOUND);
  }
  const player = await context.store.loadPlayer(roomId, playerId);
  if (player === null) {
    return fail(CODES.NOT_PLAYER);
  }

  if (player.left === true) {
    return succeed({ roomId, playerId, changed: false });
  }

  const at = context.now();
  const left = { ...player, left: true };
  assertPlayerShape(left);
  await context.store.savePlayer(left);
  await touchRoom(context, room, at);

  return succeed({ roomId, playerId, changed: true });
}

/**
 * Hernoemt een speler (besluit 40B + feedbackronde 4 aug 2026 — dicht het
 * gedocumenteerde `player:rename`-gat in socket.mjs). Zelfde regels als de
 * mock (transport-mock.mjs `renamePlayer`): alleen in LOBBY, en hooguit één
 * keer — wie al een zelfgekozen naam draagt (`nameSource: 'chosen'`, door een
 * eerdere rename of een opgegeven joinnaam) krijgt geen tweede beurt. De
 * naam loopt door exact dezelfde normalisatie/uniekmaking/profaniteitscheck
 * als bij join (`resolveNames`), tegen de namen van de ándere actieve
 * spelers. AUTORISATIE ZIT HIER NIET (zie kop): de socketlaag garandeert al
 * dat de aanroeper de speler zélf is — óf, bij `bypassRenameLimit`, de host.
 *
 * `bypassRenameLimit` (docs/openstaand/host-wijzigt-naam-en-kleur.md): de
 * host kan via `game:rename-player` een ándere speler hernoemen, ook als
 * die al een zelfgekozen naam draagt. Zonder deze knop kan een host "Speler
 * 7" of een onleesbare naam niet herstellen. De once-per-speler-limiet blijft
 * onverkort gelden voor `player:rename` (de speler zelf) — alleen de
 * hostroute mag hem negeren, en ook dán blijft alles verder ongewijzigd: nog
 * steeds alleen in LOBBY, nog steeds dezelfde normalisatie/uniekmaking.
 *
 * @param {import('./context.mjs').Context} context
 * @param {{ roomId: string, playerId: string, displayName: unknown, bypassRenameLimit?: boolean }} params
 */
export async function renamePlayer(context, { roomId, playerId, displayName, bypassRenameLimit = false } = {}) {
  const room = await context.store.loadRoom(roomId);
  if (room === null) {
    return fail(CODES.GAME_NOT_FOUND);
  }
  if (room.phase !== 'LOBBY') {
    return fail(CODES.INVALID_PHASE);
  }
  const player = await context.store.loadPlayer(roomId, playerId);
  if (player === null || player.left === true || player.kicked === true) {
    return fail(CODES.NOT_PLAYER);
  }
  if (player.nameSource === NAME_SOURCE_CHOSEN && !bypassRenameLimit) {
    return fail(CODES.INVALID_PHASE); // mock-pariteit: "rename allowed at most once"
  }

  const others = activePlayers(await context.store.listPlayers(room.id))
    .filter((entry) => entry.id !== playerId);
  const names = resolveNames(context, {
    displayName,
    language: room.config.language,
    existingEffectiveNames: others.map((entry) => entry.effectiveName),
  });
  if (names.nameSource !== NAME_SOURCE_CHOSEN) {
    // Na normalisatie bleef er niets bruikbaars over (leeg/profaan) — dat is
    // een inhoudsfout van deze ene aanroep, geen no-op die stil "lukt".
    return fail(CODES.INVALID_ANSWER_FORMAT);
  }

  const at = context.now();
  const renamed = {
    ...player,
    displayName: names.displayName,
    effectiveName: names.effectiveName,
    nameSource: names.nameSource,
  };
  assertPlayerShape(renamed);
  await context.store.savePlayer(renamed);
  await touchRoom(context, room, at);

  return succeed({ roomId, playerId, effectiveName: renamed.effectiveName });
}

/**
 * Wijzigt de spelerkleur (feedbackronde punt 13). Alleen in LOBBY (mid-game
 * van kleur wisselen zou chips op andermans scorebord live verspringen).
 * De kleurwaarde zelf is al gevalideerd tegen het gesloten `PLAYER_COLORS`-
 * palet in de protocollaag; dubbele kleuren zijn toegestaan (zestien kleuren
 * sinds besluit 42, tot 100 spelers — uniciteit afdwingen kan niet).
 *
 * Geen aparte hostvariant nodig (docs/openstaand/host-wijzigt-naam-en-kleur.md):
 * anders dan hernoemen kende `recolorPlayer` al geen eenmaal-limiet, dus
 * `game:recolor-player` (host, andere speler) roept deze functie ongewijzigd
 * aan met de doelspeler-id — precies zoals `player:recolor` 'm al aanriep met
 * de eigen speler-id. AUTORISATIE ZIT HIER NIET, net als bij `renamePlayer`.
 *
 * @param {import('./context.mjs').Context} context
 * @param {{ roomId: string, playerId: string, color: string }} params
 */
export async function recolorPlayer(context, { roomId, playerId, color } = {}) {
  const room = await context.store.loadRoom(roomId);
  if (room === null) {
    return fail(CODES.GAME_NOT_FOUND);
  }
  if (room.phase !== 'LOBBY') {
    return fail(CODES.INVALID_PHASE);
  }
  const player = await context.store.loadPlayer(roomId, playerId);
  if (player === null || player.left === true || player.kicked === true) {
    return fail(CODES.NOT_PLAYER);
  }
  if (!PLAYER_COLORS.includes(color)) {
    return fail(CODES.INVALID_ANSWER_FORMAT); // defensief — de protocollaag hoort dit al te vangen
  }

  const at = context.now();
  const recolored = { ...player, color };
  assertPlayerShape(recolored);
  await context.store.savePlayer(recolored);
  await touchRoom(context, room, at);

  return succeed({ roomId, playerId, color });
}

/**
 * Past een subset van de gameconfiguratie aan ná creatie (besluit 40,
 * scherm 2: instellingen ín de hostlobby). Alleen in LOBBY — zodra het spel
 * loopt is de configuratie bevroren. De patch is door de protocollaag al
 * gereduceerd tot `UPDATABLE_CONFIG_KEYS` met geldige waarden; hier wordt
 * het samengevoegde geheel nogmaals door de create-validatie gehaald
 * (`resolveGameConfiguration`) zodat er nooit een room ontstaat met een
 * config die bij createRoom geweigerd zou zijn.
 *
 * @param {import('./context.mjs').Context} context
 * @param {{ roomId: string, patch: Record<string, unknown> }} params
 */
export async function updateConfig(context, { roomId, patch } = {}) {
  const room = await context.store.loadRoom(roomId);
  if (room === null) {
    return fail(CODES.GAME_NOT_FOUND);
  }
  if (room.phase !== 'LOBBY') {
    return fail(CODES.INVALID_PHASE);
  }

  const safePatch = {};
  for (const key of UPDATABLE_CONFIG_KEYS) {
    if (patch !== null && typeof patch === 'object' && key in patch) {
      safePatch[key] = patch[key];
    }
  }
  if (Object.keys(safePatch).length === 0) {
    return fail(CODES.INVALID_REQUEST);
  }

  let config;
  try {
    config = resolveGameConfiguration({ ...room.config, ...safePatch });
  } catch {
    return fail(CODES.INVALID_REQUEST);
  }

  await touchRoom(context, { ...room, config }, context.now());
  return succeed({ roomId, config });
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
