// server/composition/match/snapshot.mjs
//
// De state-snapshot (`room:state` / `GET /games/{code}/state`): alles wat een
// client nodig heeft om na verbinden of reconnecten precies te weten waar de
// avond staat.
//
// Eén handeling, eigen bestand, om dezelfde reden als `sessie.mjs` bij de
// rooms: dit is de plek waar matrixrij 14 wordt waargemaakt — het correcte
// antwoord van een ACTIEVE ronde mag hier op geen enkel niveau in zitten. Die
// belofte moet zichtbaar op zichzelf staan en niet tussen elf andere
// handelingen wegvallen.
//
// De rangschikking komt uit `stand.mjs` (`buildRankedTop`), niet uit een eigen
// nummering: `top[].rank` en `self.position` spraken elkaar anders binnen één
// snapshot tegen.

import { toActiveRoundSnapshot } from '../../data/types/round.js';
import { rankPlayers } from '../../../shared/rules/ranking.mjs';
import { buildJoinUrl } from '../room-lifecycle.mjs';
import {
  activePlayers,
  CODES,
  fail,
  loadCurrentRound,
  rankablePlayers,
  ROUND_STATUS_ACTIVE,
  succeed,
} from './gedeeld.mjs';
import { buildRankedTop, SCOREBOARD_TOP_LIMIT } from './stand.mjs';

/** PROTOCOL.md §State-snapshot, letterlijk. */
export const PROTOCOL_VERSION = 'v1';

/**
 * Bovengrens op `snapshot.participants`. Gelijk aan de MVP-grens uit
 * PRODUCT.md (100 spelers per room). Zie PROTOCOL.md §"Waarom begrensd en niet
 * gepagineerd": bij honderd deelnemers is de lijst ~8 kB, verwaarloosbaar naast
 * de vraagpayloads, en de snapshot gaat over de lijn bij verbinden en
 * reconnecten — niet per ronde. De grens staat er voor het geval `maxPlayers`
 * ooit omhoog gaat, niet omdat honderd te veel is.
 */
const PARTICIPANTS_LIMIT = 100;

/**
 * De deelnemerslijst voor de snapshot: wie er in de room zitten, met hun naam
 * en rollen. Zonder deze lijst kent een client alleen de namen van spelers die
 * ná zijn eigen verbinding binnenkwamen (`room:player-changed`), en toont de
 * lobby een naamloze rij voor iedereen die er al zat.
 *
 * ROLLEN KOMEN VAN DE SESSIE, NIET VAN DE SPELER. `Player` kent geen rollen;
 * `Session.roles` wel. We laden daarom uitsluitend de hostsessies uit
 * `room.hostSessionIds` — meestal één — en niet de sessie van elke speler. Dat
 * scheelt bij honderd deelnemers negenennegentig lees-operaties, en het
 * antwoord is hetzelfde: wie geen hostsessie heeft, is `["player"]`.
 *
 * Een host die NIET meespeelt heeft geen `Player` en staat dus niet in de
 * lijst. Dat is de definitie, geen omissie: de lijst gaat over deelnemers.
 *
 * @param {object} context
 * @param {import('../../data/types/room.js').Room} room
 * @param {Array<object>} present - al gefilterd met `activePlayers`, zodat
 *   `participants.length === room.playerCount` blijft gelden
 * @returns {Promise<{ participants: Array<object>, participantsTruncated: boolean }>}
 */
async function buildParticipants(context, room, present) {
  const hostPlayerIds = new Set();
  for (const sessionId of room.hostSessionIds) {
    const session = await context.store.loadSession(room.id, sessionId);
    // Een hostsessie kan zijn ingetrokken of verlopen terwijl de room leeft;
    // dan is er niets om een rol aan te hangen en telt de speler als gewone
    // deelnemer. Dat is beter dan de hele snapshot laten falen op een
    // hostsessie die er niet meer is.
    if (session !== null && session.playerId !== null) {
      hostPlayerIds.add(session.playerId);
    }
  }

  // Stabiele volgorde (PROTOCOL.md): oplopend op join-tijdstip, bij gelijk
  // tijdstip op playerId. Zonder die garantie zou afkappen willekeurig zijn en
  // kon de lobby bij elke snapshot van volgorde wisselen.
  const ordered = [...present].sort((a, b) => (
    a.joinedAt === b.joinedAt ? a.id.localeCompare(b.id) : a.joinedAt - b.joinedAt
  ));

  const participants = ordered.slice(0, PARTICIPANTS_LIMIT).map((player) => ({
    playerId: player.id,
    effectiveName: player.effectiveName,
    // docs/openstaand/spelersidentiteit.md, stap 4/5: het land+woord-paar
    // achter een gegenereerde naam, zodat elke client 'm in zijn eigen
    // apptaal kan renderen i.p.v. te vertrouwen op `effectiveName` (die staat
    // altijd in de taal van de ROOM). `?? null`: stap 6, een speler van vóór
    // deze migratie heeft de sleutel niet — geen `undefined` over de wire.
    identity: player.identity ?? null,
    roles: hostPlayerIds.has(player.id) ? ['host', 'player'] : ['player'],
  }));

  return { participants, participantsTruncated: ordered.length > PARTICIPANTS_LIMIT };
}

/**
 * Bouwt de state-snapshot (`room:state` / `GET /games/{code}/state`).
 *
 * MATRIXRIJ 14: het correcte antwoord van een ACTIEVE ronde zit hier op geen
 * enkel niveau in. Dat is niet met een handmatige veldselectie gedaan maar met
 * `toActiveRoundSnapshot()` uit server/data/types/round.js — de expliciete
 * allowlist van de eigenaar, die bovendien werpt zodra de ronde niet ACTIVE
 * is. De projectie hieronder hernoemt alleen naar de PROTOCOL.md-woordenschat.
 *
 * `snapshot.room` volgt de tien velden die `server/protocol/snapshot-shape.mjs`
 * eist, inclusief `matchSequence` (HANDOFF INT-2) en de volledige
 * `pausedState`-vorm (besluit 10). `snapshot.self` draagt `eligibleFromRound`
 * (besluit 3), dat diezelfde validator als integer >= 1 keurt.
 *
 * CONTRACTBOTSING, hier niet omheen gebouwd (zie het handoff-item):
 * `toActiveRoundSnapshot()` levert `id`/`publicQuestionPayload`/`status`,
 * terwijl `snapshot-shape.mjs`'s allowlist `roundId`/`question` heet en
 * `status` niet toestaat. De hernoeming hieronder overbrugt dat verschil.
 *
 * @param {import('../context.mjs').Context} context
 * @param {{ roomId: string, sessionId?: string|null }} params
 */
export async function buildSnapshot(context, { roomId, sessionId = null } = {}) {
  const room = await context.store.loadRoom(roomId);
  if (room === null) {
    return fail(CODES.GAME_NOT_FOUND);
  }
  const match = room.currentMatchId === null
    ? null
    : await context.store.loadMatch(roomId, room.currentMatchId);

  const now = context.now();
  const players = await context.store.listPlayers(roomId);
  const present = activePlayers(players);
  const session = sessionId === null ? null : await context.store.loadSession(roomId, sessionId);
  const selfPlayer = session === null || session.playerId === null
    ? null
    : players.find((player) => player.id === session.playerId) ?? null;

  const round = await loadCurrentRound(context, room, match);
  const isActiveRound = round !== null && round.status === ROUND_STATUS_ACTIVE;

  let currentRound = {};
  if (isActiveRound) {
    // Het vangnet van de eigenaar strips eerst; daarna alleen hernoemen.
    const safe = toActiveRoundSnapshot(round, match);
    currentRound = {
      matchId: safe.matchId,
      roundId: safe.id,
      roundNumber: match.roundIndex + 1,
      totalRounds: room.config.totalRounds,
      gameType: safe.gameType,
      contentVersion: safe.contentVersion,
      rendererVersion: safe.rendererVersion,
      question: safe.publicQuestionPayload,
      startsAt: safe.startsAt,
      endsAt: safe.endsAt,
    };
  }

  const ranked = rankPlayers(rankablePlayers(players).map((player) => ({
    id: player.id,
    score: player.score,
    correctCount: player.correctCount,
    correctResponseTimeMsTotal: player.correctResponseTimeMsTotal,
  })));
  const positionById = new Map(ranked.map((entry) => [entry.id, entry.position]));

  let self = {
    roles: session === null ? [] : [...session.roles],
    playerId: selfPlayer === null ? null : selfPlayer.id,
    effectiveName: selfPlayer === null ? null : selfPlayer.effectiveName,
    // docs/openstaand/spelersidentiteit.md, stap 4/5 — zie buildParticipants
    // hierboven voor dezelfde redenering (`?? null` dekt stap 6).
    identity: selfPlayer === null ? null : (selfPlayer.identity ?? null),
    // Feedbackronde 4 aug (kleurkeuze): de eigen kleur reist mee in de
    // snapshot — de join-broadcast mist de joiner zelf (die hangt dan nog
    // niet aan de socket), dus dit is zijn enige betrouwbare bron.
    color: selfPlayer === null ? null : (selfPlayer.color ?? null),
    score: selfPlayer === null ? 0 : selfPlayer.score,
    position: selfPlayer === null ? null : positionById.get(selfPlayer.id) ?? null,
    answeredCurrentRound: false,
    // Besluit 3: de client krijgt de eigen antwoordgerechtigdheid proactief te
    // zien. `snapshot-shape.mjs` eist een integer >= 1, dus een sessie zónder
    // speler (hostrol zonder deelname) krijgt de neutrale 1 in plaats van null.
    eligibleFromRound: selfPlayer === null ? 1 : selfPlayer.eligibleFromRound,
  };
  if (selfPlayer !== null && round !== null && match !== null) {
    const own = await context.store.loadAnswer(roomId, match.id, round.id, selfPlayer.id);
    self = { ...self, answeredCurrentRound: own !== null };
  }

  // §A3: dezelfde ene rangschikker als `getScoreboard()` en het podium — de
  // snapshot sprak zichzelf anders tegen (`top[].rank` uit index + 1,
  // `self.position` uit `rankPlayers`).
  const top = match === null ? [] : buildRankedTop(players, SCOREBOARD_TOP_LIMIT);

  const { participants, participantsTruncated } = await buildParticipants(context, room, present);

  return succeed({
    protocolVersion: PROTOCOL_VERSION,
    serverTime: now,
    room: {
      code: room.code,
      phase: room.phase,
      locked: room.locked,
      allowLateJoin: room.config.allowLateJoin,
      joinUrl: buildJoinUrl(context, room.inviteId),
      playerCount: present.length,
      config: { ...room.config },
      matchId: room.currentMatchId,
      // HANDOFF INT-2: Match.sequence ordent matches binnen een room totaal en
      // laat de client een rematch van een oude snapshot onderscheiden.
      matchSequence: match === null ? null : match.sequence,
      // Besluit 10: snapshot en live `game:paused` gebruiken dezelfde
      // volledige vorm (`previousPhase`, `remainingMs`, `reason`, `pausedAt`).
      pausedState: match === null ? null : match.pausedState,
    },
    self,
    currentRound,
    participants,
    participantsTruncated,
    scoreboard: {
      top,
      self: selfPlayer === null
        ? {}
        : {
          playerId: selfPlayer.id,
          score: selfPlayer.score,
          position: positionById.get(selfPlayer.id) ?? null,
        },
    },
  });
}
