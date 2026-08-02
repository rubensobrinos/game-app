// Richt de DataStore-conformance-suite op de in-memory fake.
//
// Dit bestand is bewust vrijwel leeg: alle verwachtingen staan in
// data-store-conformance.mjs, zodat een Redis-adapter straks precies zo'n
// bestand van vier regels krijgt en geen enkele assertie gekopieerd hoeft te
// worden.
//
// ESM tegen CommonJS: `in-memory-store.js` is CommonJS (`module.exports =
// { createInMemoryStore }`), dit bestand is ESM. De named import hieronder
// werkt ongewijzigd via Node's CJS-interop — geen createRequire, geen
// default-import-omweg nodig.

import { describe } from 'node:test';
import { createInMemoryStore } from '../in-memory-store.js';
import { assertImplementsDataStore } from '../repository.js';
import { runDataStoreConformance } from './data-store-conformance.mjs';

runDataStoreConformance({
  describe,
  name: 'in-memory fake',
  createStore() {
    const store = createInMemoryStore();
    // Sanity: de suite test gedrag, niet aanwezigheid. Ontbreekt er een
    // methode, dan hoort dat hier te knallen en niet als TypeError midden in
    // een assertie.
    assertImplementsDataStore(store);
    return store;
  },
  // teardown: niet nodig — elke createStore() levert verse Maps op. Een
  // Redis-adapter geeft hier wel een teardown mee (FLUSHDB / quit).
});
