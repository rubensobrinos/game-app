/**
 * @file PR1 — idempotentiebeslissing voor muterende clientacties.
 *
 * Realiseert PROTOCOL.md §Ack ("Bij een retry met dezelfde `actionId`
 * retourneert de server dezelfde logische ack zonder de mutatie opnieuw uit
 * te voeren") en §Idempotentie van antwoorden onder `round:answer`, plus
 * Basisregel 5 ("Iedere muterende clientactie heeft een unieke `actionId`").
 *
 * Deze module kent geen Redis: `store` is een pure interface-afspraak die de
 * echte action-cache uit DATA-MODEL.md vervangt door een in-memory/fake
 * stand-in. `alreadyAnswered`-state (of er al een geaccepteerd antwoord
 * bestaat voor een (roundId, playerId)-paar) hoort bij data-model/game-rules
 * en wordt hier alleen als boolean/predicaat aangenomen, nooit berekend.
 */

/**
 * @typedef {object} ActionStore
 * @property {(actionId: string) => (unknown | undefined)} get
 * @property {(actionId: string, ack: unknown) => void} set
 */

/**
 * @typedef {object} ResolveOptions
 * @property {boolean | (() => boolean)} [alreadyAnswered] Alleen relevant
 *   wanneer `event === 'round:answer'`; geeft aan of er al een geaccepteerd
 *   antwoord bestaat voor het betreffende (roundId, playerId)-paar.
 */

/**
 * Beslist of een muterende clientactie (opnieuw) mag worden uitgevoerd.
 *
 * Voert zelf nooit `store.set` uit: de aanroeper doet dat pas ná succesvolle
 * uitvoering, zodat een falende uitvoering nooit een ack opslaat.
 *
 * @param {ActionStore} store
 * @param {string} actionId
 * @param {string} event
 * @param {ResolveOptions} [options]
 * @returns {{ ok: true, replay: true, ack: unknown }
 *   | { ok: false, replay: false, reason: 'ALREADY_ANSWERED' }
 *   | { ok: true, replay: false }}
 */
export function resolveDuplicateAction(store, actionId, event, options = {}) {
  const existingAck = store.get(actionId);
  if (existingAck !== undefined) {
    return { ok: true, replay: true, ack: existingAck };
  }

  if (event === 'round:answer') {
    const alreadyAnswered =
      typeof options.alreadyAnswered === 'function'
        ? options.alreadyAnswered()
        : Boolean(options.alreadyAnswered);
    if (alreadyAnswered) {
      return { ok: false, replay: false, reason: 'ALREADY_ANSWERED' };
    }
  }

  return { ok: true, replay: false };
}
