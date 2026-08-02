/**
 * @file PR5 — `server-events`-module: ontvangersregel-naslag voor alle 16
 *   server→client events.
 * @see docs/multiplayer/PROTOCOL.md — §Server → client events (de
 *   "Ontvangers"-kolom van de tabel).
 * @see docs/protocol-plan/prompts/PR5-server-events.md — sub-batch PR5a,
 *   functie `resolveRecipientRule`; Ontwerpkeuze #3 ("Ontvangersregel is een
 *   losse lookup, geen broadcast-implementatie").
 *
 * Pure naslagtabel: "wie zou dit event moeten ontvangen", niet hóe een echte
 * Socket.IO-room dat daadwerkelijk verzendt (dat hoort bij het latere
 * serverproces, buiten dit plan).
 */

/** @typedef {"single_session" | "room" | "room_with_personal_fields"} RecipientRule */

/**
 * Ontvangersregel per event, overgenomen uit de "Ontvangers"-kolom van
 * §Server → client events in `PROTOCOL.md`.
 *
 * Let op `round:progress`: de letterlijke brontabel (zowel in `PROTOCOL.md`
 * zelf als in de "Brondocument"-quote bovenaan
 * `docs/protocol-plan/prompts/PR5-server-events.md`) noemt de ontvangers
 * hiervan gewoon `room` — net als `room:player-changed`, `room:lock-changed`,
 * `game:started`, `game:paused`, `game:resumed`, `round:started` en
 * `game:rematch-started`. De prozazin onder sub-batch PR5c in datzelfde
 * promptbestand ("Ontvangers: alle vier `room_with_personal_fields`") is
 * hiermee in tegenspraak voor `round:progress` specifiek — die zin klopt wel
 * voor de overige drie events van die sub-batch (`round:ended`,
 * `scoreboard:updated`, `game:finished`, die de brontabel expliciet als
 * "room + persoonlijke velden" markeert). Deze naslag volgt de letterlijke
 * brontabel (de primaire bron, Uitgangspunt 1a), niet de afwijkende
 * samenvattende zin — dit is geen open vraag die hier zelf wordt opgelost,
 * maar een kwestie van welke van twee tekstdelen in hetzelfde promptbestand
 * de brontabel het meest getrouw weergeeft.
 *
 * @type {ReadonlyMap<string, RecipientRule>}
 */
const RECIPIENT_RULES_BY_EVENT = new Map([
  ['room:state', 'single_session'],
  ['room:player-changed', 'room'],
  ['room:lock-changed', 'room'],
  ['game:started', 'room'],
  ['game:paused', 'room'],
  ['game:resumed', 'room'],
  ['round:started', 'room'],
  ['round:answer-accepted', 'single_session'],
  ['round:progress', 'room'],
  ['round:ended', 'room_with_personal_fields'],
  ['scoreboard:updated', 'room_with_personal_fields'],
  ['game:finished', 'room_with_personal_fields'],
  ['game:rematch-started', 'room'],
  ['session:kicked', 'single_session'],
  ['session:revoked', 'single_session'],
  ['error', 'single_session'],
]);

/**
 * Geeft de ontvangersregel voor een serverevent terug — een pure naslag op
 * de tabel in §Server → client events, geen daadwerkelijke broadcast/emit.
 * @param {string} eventName
 * @returns {RecipientRule | null} `null` wanneer `eventName` onbekend is.
 */
export function resolveRecipientRule(eventName) {
  return RECIPIENT_RULES_BY_EVENT.get(eventName) ?? null;
}

/**
 * Alle 16 bekende eventnamen (afgeleid van `RECIPIENT_RULES_BY_EVENT`, geen
 * tweede handmatige lijst), voor gebruik in exhaustiviteitstests.
 * @type {ReadonlyArray<string>}
 */
export const ALL_SERVER_EVENT_NAMES = Object.freeze([...RECIPIENT_RULES_BY_EVENT.keys()]);
