// server/composition/room/aanmaken.mjs
//
// Een room in de wereld zetten en vindbaar houden: de locator-claim, de
// creatie zelf, de deel-link, het opnieuw opvragen daarvan, en de lichte
// pre-join-preview.
//
// Deze vijf horen bij elkaar omdat ze allemaal om hetzelfde paar draaien —
// `code` en `inviteId`. `claimLocators` maakt ze, `createRoom` legt ze vast,
// `buildJoinUrl`/`getShareInfo` geven ze terug, en `previewInvite` is de enige
// route die er iets mee doet zonder iets te muteren.
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
  isValidInviteId,
} from '../../architecture/room-codes.js';
import { generateName } from '../../data/name-processing.js';
import { ROOM_TTL_SECONDS } from '../../data/ttl.js';
import { assertPlayerShape } from '../../data/types/player.js';
import { assertRoomShape } from '../../data/types/room.js';
import { assertSessionShape } from '../../data/types/session.js';
import { createId, createSessionToken } from '../context.mjs';
import { resolveGameConfiguration } from './configuratie.mjs';
// De naamverwerking woont bij `deelnemers`; een meespelende host krijgt exact
// dezelfde behandeling als een gewone joiner en mag daar dus geen tweede,
// eigen pijplijn voor krijgen.
import { resolveNames } from './deelnemers.mjs';
import { CODES, activePepper, activePlayers, colorForArrival, fail, findRoomByInviteId, succeed } from './gedeeld.mjs';

/** Aantal (code, inviteId)-kandidaatparen dat claimLocators probeert te claimen. */
const DEFAULT_LOCATOR_ATTEMPTS = 10;

/**
 * Bouwt de deel-link uit één serverconfiguratiewaarde (besluit 6:
 * PUBLIC_APP_URL) plus het padpatroon `/j/{inviteId}` uit ARCHITECTURE.md §5.
 * @param {import('../context.mjs').Context} context
 * @param {string} inviteId
 * @returns {string}
 */
export function buildJoinUrl(context, inviteId) {
  return `${context.config.publicAppUrl.replace(/\/+$/, '')}/j/${inviteId}`;
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
 * @param {import('../context.mjs').Context} context
 * @param {{ roomId: string, maxAttempts?: number }} params
 * @returns {Promise<{ code: string, inviteId: string, inviteHash: string }>}
 * @throws {import('../../architecture/room-codes.js').GameCodeExhaustedError}
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
 * Maakt een room met hostsessie aan (`POST /api/v1/games`).
 *
 * Bij `hostParticipates: false` krijgt de host uitsluitend de hostrol:
 * `playerId` en `effectiveName` zijn `null` en er wordt geen Player-entiteit
 * aangemaakt (matrixrij 1). Bij `true` krijgt hij daarnaast een normale
 * spelerplek, in exact dezelfde Player-vorm als een gewone joiner (rij 2).
 *
 * @param {import('../context.mjs').Context} context
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
 * oploopt. Bewust `generateName` en niet `resolveNames`: er is hier geen
 * opgegeven naam om te normaliseren, alleen een suggestie om te tonen.
 *
 * KEUZE — welke velden de preview teruggeeft ligt nergens vast (besluit 7
 * noemt alleen "valideert de invite" en "naamsuggestie"). Meegegeven is het
 * minimum dat de client nodig heeft om vóór het joinen te kunnen tonen dat de
 * room vol of vergrendeld is. Bewust NIET meegegeven: de join-code (een
 * tweede joincapability, die de preview niet hoeft te lekken) en spelernamen.
 *
 * @param {import('../context.mjs').Context} context
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
 * Levert de invite opnieuw op zodat IEDERE deelnemer — niet alleen de host —
 * de QR/deel-link kan tonen (matrixrij 6, ARCHITECTURE.md §5: "Alle
 * deelnemers mogen dezelfde invite tonen"). Er is hier daarom bewust geen
 * rolcontrole.
 *
 * @param {import('../context.mjs').Context} context
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
