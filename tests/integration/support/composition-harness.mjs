// tests/integration/support/composition-harness.mjs
//
// Gedeelde opbouw voor de integratietests in tests/integration/ die tegen de
// échte compositielaag draaien: server/composition/context.mjs +
// server/composition/room-lifecycle.mjs, met server/data/in-memory-store.js
// als DataStore-poortimplementatie.
//
// Waarom in-memory en geen echte Redis-verbinding: de matrix vereist voor
// activatie "geen endpoint die op een poort luistert" — zie
// docs/deployment-and-testing-plan/server-composition-request.md, dat
// expliciet voorstelt dat "een in-memory Map/store... in plaats van echte
// Redis" volstaat voor deze laag, precies zoals `createInMemoryActionStore()`
// dat al deed voor tests/contract/protocol/fake-transport.mjs. Dit is dus
// geen ad-hoc testfixture maar het door de compositielaag zelf aangewezen
// DataStore-contract (server/data/repository.js), met een van de twee
// bestaande implementaties (de andere is een toekomstige Redis-adapter).
//
// GEEN mock van domeinlogica: elke aanroeper hieronder importeert de
// ongewijzigde productiemodules uit server/composition/ en server/data/.
// Alleen de opslag is in-memory.

import { createInMemoryStore } from '../../../server/data/in-memory-store.js';
import { createContext } from '../../../server/composition/context.mjs';

export const FIXED_NOW = 1_754_136_000_000;
export const PEPPER = 'integratietest-pepper-met-ruim-voldoende-bytes';
export const APP_URL = 'https://play.aseso.nl';

// Voor scenario's die server/composition/match-lifecycle.mjs raken (matrixrijen
// 7, 9, 12, 14): die module eist `context.config.contentVersion` (besluit 21,
// zie match-lifecycle.mjs's `contentSourceFor`). Twee vaste, willekeurige
// versiestrings — de inhoud doet er niet toe, alleen dat ze aanwezig zijn.
export const CONTENT_VERSION = 'integratietest-content-1';
export const RENDERER_VERSION = 'integratietest-renderer-1';

/**
 * Besluit 26: versieerbare peppers — één ACTIEVE versie plus alle versies die
 * nog geverifieerd moeten kunnen worden. Dit is de vorm die
 * `createContext` eist (`config.tokenPeppers`); de platte `tokenPepper` die
 * hier eerder stond bestaat niet meer en zou nu bij het opbouwen van de context
 * al een TypeError geven. Dezelfde vorm als in
 * `server/composition/room-lifecycle.test.mjs`.
 */
export const TOKEN_PEPPERS = Object.freeze({ version: 'v1', peppers: Object.freeze({ v1: PEPPER }) });

/**
 * @param {{ store?: object, now?: () => number, config?: object }} [params]
 * @returns {import('../../../server/composition/context.mjs').Context}
 */
export function makeContext({ store = createInMemoryStore(), now = () => FIXED_NOW, config = {} } = {}) {
  return createContext({
    store,
    now,
    config: { tokenPeppers: TOKEN_PEPPERS, publicAppUrl: APP_URL, ...config },
  });
}

/**
 * Handmatig verzette klok voor scenario's die fasetimers moeten laten
 * verstrijken (countdown, ronde-deadline, resultaat-/scoreboardduur). Geen
 * enkele test in deze map mag van de échte klok afhangen — `now()` leest
 * uitsluitend deze waarde.
 * @param {number} [start]
 */
export function makeClock(start = FIXED_NOW) {
  const clock = { value: start };
  clock.now = () => clock.value;
  clock.set = (value) => {
    clock.value = value;
    return clock.value;
  };
  clock.advance = (ms) => {
    clock.value += ms;
    return clock.value;
  };
  return clock;
}
