// server/composition/room/deelnemers.mjs
//
// Wie er in de room zit: binnenkomen, vertrekken, eruit gezet worden, en de
// twee dingen die een deelnemer aan zichzelf mag wijzigen (naam en kleur).
//
// De NAAMVERWERKING hoort hier. `resolveNames` is de enige plek die de
// pijplijn uit `server/data/name-processing.js` samenstelt, en hij wordt door
// drie handelingen gebruikt: joinen, hernoemen, en — via `aanmaken.mjs` — de
// meespelende host. Dat maakt hem gedeeld gereedschap van dit bestand en geen
// privéhelper van één functie.
//
// AUTORISATIE ZIT HIER NIET. `kickPlayer`, `renamePlayer` en `recolorPlayer`
// controleren geen hostrol; NOT_HOST is een protocol-/transportbeslissing op
// basis van de sessie die `resolveSession` teruggeeft.

import { isValidGameCode, isValidInviteId } from '../../architecture/room-codes.js';
import { generateName, isProfane, processChosenName } from '../../data/name-processing.js';
import { pickIdentity } from '../../../shared/rules/identity-processing.mjs';
import { renderIdentityNl, renderIdentityEn, renderIdentityEs } from '../../data/identity-render.js';
import { assertPlayerShape } from '../../data/types/player.js';
import { assertSessionShape } from '../../data/types/session.js';
import { PLAYER_COLORS } from '../../protocol/client-events-dispatch.mjs';
import { getCountryPool } from '../../../shared/content/index.mjs';
import { createId, createSessionToken } from '../context.mjs';
import { CODES, activePlayers, colorForArrival, fail, findRoomByInviteId, succeed } from './gedeeld.mjs';
import { touchRoom } from './levensduur.mjs';

/** `joinSource`: `qr | shared_link | code | unknown` (PROTOCOL.md §REST-endpoints). */
const JOIN_SOURCES = Object.freeze(['qr', 'shared_link', 'code', 'unknown']);

/**
 * docs/openstaand/spelersidentiteit.md, stap 4. Drie losse rendermodules
 * (identity-render.js) i.p.v. één dispatcher — dit is de ENE plek die ze op
 * taalcode selecteert, precies zoals identity-render.js's eigen moduledoc
 * voorschrijft.
 */
const RENDER_IDENTITY_BY_LANGUAGE = Object.freeze({
  nl: renderIdentityNl,
  en: renderIdentityEn,
  es: renderIdentityEs,
});

/**
 * Kale landnamen per iso2 (bv. "Bulgarije"), voor identity-render.js's
 * "uit"-terugval — NIET dezelfde bron als de bijvoeglijke vorm
 * (country-adjectives.js). Eén keer opgebouwd uit de gedeelde pool
 * (`shared/content/`), niet per aanroep: 230 landen, geen hete pad.
 */
const COUNTRY_NAMES_BY_ISO2 = new Map(getCountryPool().map((entry) => [entry.iso2, entry.name]));

/**
 * Rendert één `{ country, word }`-paar naar tekst in `language`, voor
 * `Player.generatedName`/`effectiveName` — de servertalige afdruk die overal
 * blijft werken waar nog niet identiteitsbewust wordt gerenderd (kickbevestiging,
 * logs, een oude client). Elke identiteitsbewuste client rendert `identity`
 * zelf opnieuw in zijn EIGEN apptaal (stap 5) — dit hier is dus bewust alleen
 * de servertalige afdruk, niet de bron van waarheid voor de weergave.
 *
 * `null` als er niets bruikbaars is (onbekende taal, land of woord ontbreekt
 * in de content) — de aanroeper valt dan terug op de oudere generateName().
 * @param {{country: string, word: string}} identity
 * @param {string} language
 * @param {Record<string, object>} countryAdjectives
 * @param {Record<string, object>} identityWordsByKey
 * @returns {string | null}
 */
function renderIdentityText(identity, language, countryAdjectives, identityWordsByKey) {
  const render = RENDER_IDENTITY_BY_LANGUAGE[language];
  const countryNames = COUNTRY_NAMES_BY_ISO2.get(identity.country);
  const wordEntry = identityWordsByKey?.[identity.word]?.[language];
  if (render === undefined || countryNames === undefined || wordEntry === undefined) {
    return null;
  }
  try {
    return render({
      countryName: countryNames[language],
      adjective: countryAdjectives?.[identity.country]?.[language],
      word: wordEntry,
    });
  } catch {
    // Vormfout in de content (bv. een leeg woord) — geen halve naam tonen,
    // gewoon terugvallen als was er geen identiteit gevonden.
    return null;
  }
}

/**
 * `existingIdentities` voor `pickIdentity`: de al toegekende paren van actieve
 * spelers. `.filter(Boolean)` laat zowel `null` (zelfgekozen naam) als
 * `undefined` (stap 6, een speler van vóór deze migratie) vallen — allebei
 * "geen paar om tegen te botsen".
 * @param {Array<{identity?: {country: string, word: string} | null}>} players
 * @returns {Array<{country: string, word: string}>}
 */
export function identitiesOf(players) {
  return players.map((player) => player.identity).filter(Boolean);
}

/**
 * KEUZE — `Player.nameSource` is in server/data/types/player.js bewust een
 * open string: alleen "generated" is ooit als letterlijke waarde getoond.
 * Voor de tegenhanger is hier "chosen" gekozen. Eén regel om te wijzigen
 * zodra DATA-MODEL.md de waarde vastlegt.
 */
export const NAME_SOURCE_GENERATED = 'generated';
export const NAME_SOURCE_CHOSEN = 'chosen';

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
 * IDENTITEIT (docs/openstaand/spelersidentiteit.md, stap 4): een GEGENEREERDE
 * naam krijgt er, als de content het toelaat, een `{ country, word }`-paar
 * bij — `identity`. Een ZELFGEKOZEN naam nooit: "de identiteit vervangt
 * alleen de gegenereerde naam" (spelersidentiteit.md, punt 2). De
 * uniciteitscontrole op het paar gebeurt in `pickIdentity`, VÓÓR er iets
 * gerenderd wordt (`existingIdentities`, structureel vergeleken) — dat is de
 * valkuil die dit bestand niet mag herhalen: `existingEffectiveNames`
 * hieronder blijft uitsluitend voor de OUDE, tekstgebaseerde generator
 * (`generateName`, de terugval als er geen identiteit beschikbaar is).
 *
 * @param {import('../context.mjs').Context} context
 * @param {{
 *   displayName: unknown, language: string,
 *   existingEffectiveNames: string[],
 *   existingIdentities?: Array<{country: string, word: string}>,
 * }} params
 */
export function resolveNames(context, { displayName, language, existingEffectiveNames, existingIdentities = [] }) {
  const { nameWordLists, profanityWords, countryAdjectives, identityWords } = context.config;

  const raw = typeof displayName === 'string' ? displayName : '';
  let chosen = raw.length > 0 ? processChosenName(raw, language, existingEffectiveNames) : '';
  if (chosen.length > 0 && isProfane(chosen, language, profanityWords)) {
    chosen = '';
  }

  if (chosen.length > 0) {
    return {
      displayName: raw,
      generatedName: generateName(language, nameWordLists, existingEffectiveNames),
      effectiveName: chosen,
      nameSource: NAME_SOURCE_CHOSEN,
      identity: null,
    };
  }

  const identity = pickIdentity(
    Object.keys(countryAdjectives ?? {}),
    Object.keys(identityWords ?? {}),
    existingIdentities,
  );
  // De servertalige afdruk: identiteit gerenderd in `language` als die er is
  // (bewust GEEN eigen makeUniqueInRoom-cijfer erachter — het paar is al
  // structureel uniek, zie pickIdentity, en elk woord in identityWords heeft
  // een eigen tekst per taal, dus twee verschillende paren renderen ook nooit
  // toevallig naar dezelfde tekst). Zonder bruikbare identiteit blijft de
  // oudere generator de terugval.
  const identityText = identity === null ? null : renderIdentityText(identity, language, countryAdjectives, identityWords);
  const generatedName = identityText ?? generateName(language, nameWordLists, existingEffectiveNames);

  return {
    displayName: null,
    generatedName,
    effectiveName: generatedName,
    nameSource: NAME_SOURCE_GENERATED,
    identity: identityText === null ? null : identity,
  };
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
  if (room !== null) {
    return succeed(room);
  }
  // Besluit 48: afwezig is niet één ding. Een room die verloopt laat geen
  // spoor achter, dus zonder de grafsteen lijkt "die avond is voorbij"
  // precies op "je hebt je vertypt" — en dat las een host ook als hij
  // alleen zijn verbinding kwijt was.
  const eerderGebruikt = await context.store.hasCodeBeenSeen(gameCode);
  return fail(eerderGebruikt ? CODES.GAME_EXPIRED : CODES.GAME_NOT_FOUND);
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
 * @param {import('../context.mjs').Context} context
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
    existingIdentities: identitiesOf(players),
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
    identity: names.identity,
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
    identity: player.identity,
    color: player.color,
    joinSource,
  });
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
 * @param {import('../context.mjs').Context} context
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
 * @param {import('../context.mjs').Context} context
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
 * @param {import('../context.mjs').Context} context
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
    existingIdentities: identitiesOf(others),
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
    // Een geslaagde rename komt hier altijd met nameSource CHOSEN uit
    // resolveNames (zie de throw hierboven), dus names.identity is altijd
    // null — een zelfgekozen naam wist een eerder toegekende identiteit
    // (spelersidentiteit.md, punt 2: "vervangt alleen de gegenereerde naam").
    identity: names.identity,
  };
  assertPlayerShape(renamed);
  await context.store.savePlayer(renamed);
  await touchRoom(context, room, at);

  return succeed({ roomId, playerId, effectiveName: renamed.effectiveName, identity: renamed.identity });
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
 * @param {import('../context.mjs').Context} context
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
