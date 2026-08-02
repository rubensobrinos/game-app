/**
 * @file PR5e — `throttleRoundProgress`: pure beslisfunctie voor de
 *   `round:progress`-broadcastfrequentie.
 * @see docs/multiplayer/PROTOCOL.md — §Server → client events:
 *   "`round:progress` wordt maximaal tweemaal per seconde gebroadcast."
 * @see docs/protocol-plan/prompts/PR5-server-events.md — sub-batch PR5e.
 *
 * Pure teller/klok-functie: geen `Date.now()`, geen timer/scheduler, geen
 * mutatie van `store`. Het daadwerkelijk plannen en versturen van de
 * broadcast zelf hoort bij het latere serverproces, niet bij deze module
 * ('Niet in scope').
 */

/** @typedef {{ emittedAtMs: number[] }} ThrottleRecord */
/** @typedef {{ get(roundId: string): ThrottleRecord | undefined }} ThrottleStore */

/** Rollend venster waarbinnen `MAX_EMISSIONS_PER_WINDOW` geldt (ms). */
const ROLLING_WINDOW_MS = 1000;

/** Maximaal aantal toegestane emissies per rollend venster, per `roundId`. */
const MAX_EMISSIONS_PER_WINDOW = 2;

/**
 * Beslist of een volgende `round:progress`-broadcast voor deze ronde is
 * toegestaan op tijdstip `now`, gegeven eerdere emissies in `store`. Muteert
 * `store` niet — bij `allow: true` slaat de aanroeper het teruggegeven,
 * bijgewerkte record zelf op (JSDoc-contract, zie promptbestand). Houdt
 * maximaal 2 emissies per rollend venster van 1000 ms per `roundId` aan: een
 * eerdere emissie op tijdstip `t` telt mee zolang `t > now - 1000` (en
 * `t <= now`); alles daarbuiten is uit het venster gerold en telt niet meer
 * mee.
 * @param {ThrottleStore} store
 * @param {string} roundId
 * @param {number} now - epoch-ms, altijd door de aanroeper geleverd
 * @returns {{ allow: true, record: ThrottleRecord } | { allow: false }}
 */
export function throttleRoundProgress(store, roundId, now) {
  const existingRecord = store.get(roundId);
  const priorEmittedAtMs = existingRecord ? existingRecord.emittedAtMs : [];

  const windowStartExclusive = now - ROLLING_WINDOW_MS;
  const withinWindow = priorEmittedAtMs.filter(
    (emittedAt) => emittedAt > windowStartExclusive && emittedAt <= now,
  );

  if (withinWindow.length >= MAX_EMISSIONS_PER_WINDOW) {
    return { allow: false };
  }

  return {
    allow: true,
    record: { emittedAtMs: [...withinWindow, now] },
  };
}
