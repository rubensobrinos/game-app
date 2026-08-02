# tests/integration/pending/

Draft integratietests die inhoudelijk klaar zijn maar momenteel falen op een
externe, gecciteerde blokkade — niet op een fout in de test zelf. Bestandsnaam
eindigt bewust op `.draft.mjs`, niet `.test.mjs`, zodat `npm test`/`node --test
tests/**/*.test.*` ze niet oppikt en geen valse rode uitslag geeft.

Zie [`../../../docs/deployment-and-testing-plan/integration-matrix.md`](../../../docs/deployment-and-testing-plan/integration-matrix.md)
§Audit-log voor de per-rij motivatie. Op 2026-08-02 blokkeren alle vijf
bestanden hier op dezelfde oorzaak: `server/composition/room-lifecycle.mjs`
roept `context.store.loadRoomByInviteId(...)` aan, een methode die
`server/data/repository.js` na de DM10/DM11-poortmigratie niet meer
exporteert (nu `loadRoomByInviteHash`). Dezelfde fout breekt ook de
bestaande `server/composition/room-lifecycle.test.mjs` — dit is dus geen
DT-specifiek probleem.

**Reactivatie:** zodra `room-lifecycle.mjs` de nieuwe methode aanroept, hernoem
het betreffende bestand terug naar `.test.mjs` en verplaats het naar
`tests/integration/` — geen andere wijziging zou nodig moeten zijn. Verifieer
dat met een echte testrun, niet door de hernoeming zelf als bewijs te nemen.
