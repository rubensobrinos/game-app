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

/**
 * @param {{ store?: object, now?: () => number, config?: object }} [params]
 * @returns {import('../../../server/composition/context.mjs').Context}
 */
export function makeContext({ store = createInMemoryStore(), now = () => FIXED_NOW, config = {} } = {}) {
  return createContext({
    store,
    now,
    config: { tokenPepper: PEPPER, publicAppUrl: APP_URL, ...config },
  });
}
