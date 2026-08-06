// server/composition/room/gedeeld.mjs
//
// Het gereedschap dat méér dan één handeling nodig heeft. Niets hierin is een
// publieke export van de compositie: `room-lifecycle.mjs` exporteert dit
// bestand niet door. Wat hier staat, stond vóór de opsplitsing als privéhelper
// boven in `room-lifecycle.mjs` en is letterlijk verhuisd.
//
// De grens: hier hoort alleen wat door twee of meer handelingen wordt gebruikt.
// Een helper met één aanroeper hoort bij díé handeling — anders wordt dit
// bestand de nieuwe verzamelbak die de opsplitsing juist wilde voorkomen.

import { hashInviteId } from '../../architecture/room-codes.js';
import { ALL_ERROR_CODES } from '../../protocol/error-codes.mjs';
import { PLAYER_COLORS } from '../../protocol/client-events-dispatch.mjs';

/**
 * De foutcodes die deze module kan retourneren. Geen losse stringliterals:
 * `error-codes.mjs` is de single source of truth, en dit faalt bij module-load
 * als een code daar ooit uit verdwijnt.
 */
export const CODES = Object.freeze({
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

/** @param {string} code @returns {{ ok: false, code: string }} */
export function fail(code) {
  return { ok: false, code };
}

/** @param {object} value @returns {{ ok: true, value: object }} */
export function succeed(value) {
  return { ok: true, value };
}

/** Spelers die nog echt in de room zitten. */
export function activePlayers(players) {
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
export function colorForArrival(arrivalIndex) {
  return PLAYER_COLORS[arrivalIndex % PLAYER_COLORS.length];
}

/** De pepper van de ACTIEVE versie — waarmee nieuwe hashes worden gemaakt. */
export function activePepper(context) {
  const { version, peppers } = context.config.tokenPeppers;
  return peppers[version];
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
 * @param {import('../context.mjs').Context} context
 * @param {string} inviteId - al gevalideerd met `isValidInviteId`
 * @returns {Promise<object|null>}
 */
export async function findRoomByInviteId(context, inviteId) {
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
