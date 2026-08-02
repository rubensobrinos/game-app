# Prompt — DM10: Atomaire room-locator-claim (code + inviteHash)

Onderdeel van [`docs/data-model-plan/README.md`](../README.md), fase DM10.
Afhankelijk van DM6 (`repository.js`/`in-memory-store.js`). Reactie op twee
externe bevindingen die hetzelfde gat vanuit twee kanten melden:
[`docs/integration-plan/HANDOFF.md`](../../integration-plan/HANDOFF.md)
(INT-1, aan DM + AR) en
[`docs/integration-plan/HANDOFF-INTB.md`](../../integration-plan/HANDOFF-INTB.md)
(INTB-2, aan DM).

**Herzien na een eigen reviewronde, vóór uitvoering.** Die review vond dat de
eerste versie van dit bestand een claim en een lookup op **verschillende**
indexen liet werken (een geslaagde claim die `loadRoomByCode` niet kon vinden),
een niet-atomaire release toestond, en `inviteHash`/`inviteId` door elkaar
gebruikte tussen deze fase en de bestaande `loadRoomByInviteId`. Alle drie zijn
hieronder gecorrigeerd. Zie ook de aangescherpte claim onderaan: dit voorstel
**maakt** de atomaire Redis-implementatie mogelijk, het **is** er nog geen —
die claim stond eerder te stellig in dit bestand.

## Wat er ontbreekt

De poort heeft alleen `loadRoomByCode`/`loadRoomByInviteId` — leesoperaties.
Roomcreatie is dus check-then-act: tussen "is deze code vrij?" en het
wegschrijven van de room kan een tweede creatie dezelfde code pakken. INT-1's
adversariële review van `room-codes.js` mat dat venster op ~1 op 1.000.000 per
creatie, lineair groeiend met de bezetting. Bijkomend: `generateGameCode({
isTaken })` (`server/architecture/room-codes.js`) is bewust **synchroon** en
werpt sinds 2 augustus expliciet op een async callback — een Redis-lookup is
async, dus de huidige combinatie is met de in-memory fake bruikbaar maar niet
tegen een echte adapter.

## Ontwerpbeslissingen

1. **Eén gecombineerde claim voor `code` + `inviteHash` samen**, niet twee
   losse claims — anders bestaat een toestand waarin de code geclaimd is en de
   inviteHash niet, precies het soort halve toestand dat `DECISIONS.md` #30
   voor `Room.phase`/`Match.phase` al verbiedt.
2. **Claim en lookup delen exact dezelfde index — geen aparte claim-maps.**
   De eerste versie van dit bestand introduceerde `claimedRoomIdByCode`/
   `claimedRoomIdByInviteHash` náást de bestaande `roomIdByCode`/
   `roomIdByInviteId`. Dat is fout: het maakt een toestand mogelijk waarin een
   claim geslaagd is terwijl `loadRoomByCode` de room niet vindt (of
   andersom), terwijl in een echte Redis-implementatie `room:code:{code}`
   letterlijk **dezelfde sleutel** is voor de claim (`SET NX`) én de lookup
   (`GET`) — er kán daar geen desync bestaan omdat het één sleutel is. De fake
   moet dat weerspiegelen: `claimRoomLocatorsAtomically` schrijft in dezelfde
   `roomIdByCode`-Map die `loadRoomByCode` al leest, en (na de hernoeming
   hieronder) in dezelfde `roomIdByInviteHash`-Map die `loadRoomByInviteHash`
   leest. `saveRoom` blijft `roomIdByCode` ongewijzigd vullen (bestaande
   fixtures die rechtstreeks `saveRoom` aanroepen zonder eerst te claimen
   blijven werken) — een dubbele write van dezelfde waarde is onschadelijk.
3. **`inviteHash`, niet `inviteId` — ook bij de bestaande lookup.** De eerste
   versie liet de nieuwe claim op `inviteHash` werken naast de
   **al-bestaande** `loadRoomByInviteId(inviteId)`, die op het platte
   `inviteId`-veld werkt. Dat zijn twee verschillende identifiers voor
   hetzelfde concept, en precies de inconsistentie die punt 2 net repareert
   zou weer terugbrengen via de achterdeur. **Deze fase hernoemt daarom
   `loadRoomByInviteId(inviteId)` naar `loadRoomByInviteHash(inviteHash)`** —
   een brekende wijziging aan een DM6-methode, met opzet, niet alleen een
   additieve toevoeging. Hashen gebeurt vóór de repository (de aanroeper roept
   `hashInviteId(inviteId, pepper)` uit `room-codes.js` aan, zoals INT-1 al
   voorschreef voor de claim) — de repository ziet nooit een platte
   `inviteId` en heeft dus ook nooit de pepper nodig.
   - **Gevolg:** `Room` zelf slaat geen `inviteHash` op (alleen `inviteId`,
     ongewijzigd), dus `saveRoom` kán `roomIdByInviteHash` niet vullen — die
     index wordt uitsluitend door `claimRoomLocatorsAtomically` gezet. Een
     test die `loadRoomByInviteHash` wil bewijzen moet dus eerst claimen, niet
     alleen `saveRoom` aanroepen. Dat is een bewuste, verwachte consequentie
     (het spiegelt de echte flow: claim gaat altijd aan roomcreatie vooraf),
     geen gat.
   - **Blast radius van de hernoeming**, geverifieerd met `rg`: alleen
     `server/data/repository.js`, `server/data/in-memory-store.js`,
     `server/data/repository.test.js` en de documentatie in
     [`DM6-repository-port.md`](DM6-repository-port.md) /
     [`DM-PROGRESS.md`](../DM-PROGRESS.md) verwijzen naar
     `loadRoomByInviteId`. Geen enkel ander plan roept hem aan.
4. **Conflict is een normale returnwaarde, geen exception.**
5. **Idempotent per `roomId`.** Dezelfde `roomId` die dezelfde `code` +
   `inviteHash` opnieuw claimt krijgt `{ ok: true }`.
6. **`room-codes.js` verandert niet.** Bevestigd door INT-1 — `isTaken` is
   daar al optioneel; de aanroeper kan `generateGameCode()` zonder callback
   gebruiken voor kandidaten en de retry-lus zelf om de claim heen bouwen.
7. **Vrijgeven — nu écht atomair.** De eerste versie liet
   `releaseRoomLocators` de code en de inviteHash **onafhankelijk** van elkaar
   beoordelen, zodat één kon worden verwijderd terwijl de ander bleef staan.
   Herzien: **`releaseRoomLocators({ roomId, code, inviteHash })` verwijdert
   beide, of geen van beide** — alleen als `roomId` op dít moment beide
   locators bezit. Bezit `roomId` er nog maar één van (bijv. na een écht
   Redis-TTL-verschil tussen de twee sleutels — een scenario dat deze fake
   toch al niet simuleert), dan doet de aanroep niets; dat is een bewuste,
   gedocumenteerde afruil (de blijvende locator loopt in het echte systeem
   gewoon op zijn eigen TTL af) in ruil voor nooit een verrassende, stille
   halve opruiming.
   - Signatuur blijft `{ roomId, code, inviteHash }`, niet alleen `roomId`
     (afwijking van INT-1's letterlijke voorstel, met reden): de aanroeper die
     een mislukte creatie afhandelt heeft `code`/`inviteHash` al uit dezelfde
     uitvoering, dus dit kost geen extra lookup en voorkomt dat een
     Redis-adapter een `roomId → {code, inviteHash}`-omgekeerde index moet
     bijhouden (zelf weer een schrijfactie + TTL-onderhoud — precies het
     patroon dat INTB-1 elders afwijst, ARCHITECTURE.md principe 9).
8. **TTL-refresh — contract nu vastgelegd, mechanisme nog niet.** Zonder een
   refreshpad kan een actieve room bereikbaar blijven via `room:{roomId}`
   terwijl de code/inviteHash-claim inmiddels verlopen is (en dus door een
   ander wordt geclaimd) — een reëel gat, apart van de brede TTL-refreshmatrix
   die `ttl.js`/`REVIEW.md` bevinding 3 al bewust buiten scope houdt. Deze
   fase voegt daarom **`refreshRoomLocators({ roomId, code, inviteHash,
   ttlSeconds })`** toe: werpt `RangeError` als `roomId` niet **beide**
   locators bezit (een refresh op een claim die je niet meer bezit is een
   programmeerfout of een teken dat de claim al gestolen is — dat moet luid
   falen, niet stil slagen), en slaagt anders zonder de fake's Maps te
   wijzigen (de fake simuleert geen TTL-aftelling, dus er is niets om te
   verlengen — dit legt alleen het **contract** vast waarmee de latere
   refreshmatrix straks kan aanhaken; het aanroepen ervan op een interval is
   nadrukkelijk niet hier gebouwd).
9. **Redis Cluster — documentatie, geen ontwerpwijziging.** Een Lua-script dat
   in één transactie zowel `room:code:{code}` als `room:invite:{inviteHash}`
   aanraakt, veronderstelt dat beide sleutels in dezelfde hashslot vallen. Bij
   één Redis-instance (het huidige uitgangspunt, checkpoint 2) is dat geen
   probleem; bij Redis Cluster zouden beide sleutels `{roomId}`-hashtags nodig
   hebben om co-locatie te garanderen. Dit staat als commentaar bij de
   nieuwe methoden in `repository.js` — geen implementatiewijziging, gewoon
   niet-vergeten-informatie voor checkpoint 2.

## Stappen

### 1. `server/data/repository.js`

- Hernoem `loadRoomByInviteId(inviteId)` → `loadRoomByInviteHash(inviteHash)`
  in de `DataStore`-JSDoc-typedef en in `DATA_STORE_METHOD_NAMES`.
- Voeg toe (additief):

```js
/**
 * @typedef {{ roomId: string, code: string, inviteHash: string, ttlSeconds: number }} RoomLocatorClaim
 * @typedef {{ roomId: string, code: string, inviteHash: string }} RoomLocatorPair
 */

// @property {(claim: RoomLocatorClaim) => Promise<{ ok: true } | { ok: false, conflict: 'code' | 'inviteHash' }>} claimRoomLocatorsAtomically
// @property {(locators: RoomLocatorPair) => Promise<void>} releaseRoomLocators
// @property {(claim: RoomLocatorClaim) => Promise<void>} refreshRoomLocators
```

- Commentaarregel bij deze drie methoden: cluster-hashslot-opmerking (punt 9
  hierboven), en een expliciete "unblocks INT-A/INT-B, is zelf geen bewijs van
  Redis-atomiciteit" disclaimer — zelfde stijl als DM6's "wat de fake wel/niet
  bewijst".

### 2. `server/data/in-memory-store.js`

- Hernoem `roomIdByInviteId` → `roomIdByInviteHash`. `loadRoomByInviteHash`
  leest hem; `saveRoom` vult hem **niet meer** (kan niet, zie punt 3
  hierboven) — `saveRoom` blijft wel `roomIdByCode` vullen, ongewijzigd.
- `claimRoomLocatorsAtomically`:
  1. Idempotente herclaim: als `roomIdByCode.get(code) === roomId` **en**
     `roomIdByInviteHash.get(inviteHash) === roomId`: `{ ok: true }`, geen
     writes.
  2. Anders: eerst BEIDE kandidaat-conflicten bepalen (bezet door een ANDERE
     roomId) zonder enige write. Conflict → `{ ok: false, conflict: 'code' }`
     of `{ ok: false, conflict: 'inviteHash' }` (code eerst als beide
     conflicteren) — geen van beide Maps wordt aangeraakt.
  3. Geen conflict: beide Maps in dezelfde synchrone stap zetten (`roomIdByCode`
     én `roomIdByInviteHash`), dan `{ ok: true }`.
- `releaseRoomLocators({ roomId, code, inviteHash })`: verwijdert **beide,
  of geen van beide** — alleen als `roomIdByCode.get(code) === roomId` **en**
  `roomIdByInviteHash.get(inviteHash) === roomId` op het moment van aanroepen.
- `refreshRoomLocators({ roomId, code, inviteHash, ttlSeconds })`: werpt
  `RangeError` tenzij `roomId` beide locators op dit moment bezit; slaagt
  anders zonder Map-mutatie (zie punt 8).

### 3. Tests (`repository.test.js`)

- **Bestaande test #12 herschreven** voor `loadRoomByInviteHash`: claim eerst
  (levert de `inviteHash`-index), dan `loadRoomByInviteHash(inviteHash)` vindt
  dezelfde room als `loadRoom` — niet langer via kale `saveRoom`.
- vrije `code` + `inviteHash` → `{ ok: true }`; **`loadRoomByCode`/
  `loadRoomByInviteHash` zien de claim onmiddellijk** (bewijs dat claim en
  lookup dezelfde index delen — dit is de kerntest voor punt 2 hierboven),
  óók vóórdat de room zelf is opgeslagen;
- bezette `code` (andere roomId), vrije `inviteHash` → `{ ok: false, conflict:
  'code' }`, en de inviteHash blijft daarna nog vrij voor een derde roomId
  (geen partial claim);
- vrije `code`, bezette `inviteHash` (andere roomId) → `{ ok: false, conflict:
  'inviteHash' }`, code blijft vrij (omgekeerd bewijs);
- dezelfde `roomId` claimt exact dezelfde `code` + `inviteHash` opnieuw → `{
  ok: true }` (idempotentie);
- `releaseRoomLocators` door de eigenaar-`roomId` maakt beide vrij;
- `releaseRoomLocators` waarbij `roomId` maar één van de twee bezit (test
  construeert dit door een andere roomId eerst de code te laten "overnemen"
  na een handmatige tussenstap) doet **niets** — geen van beide wordt
  verwijderd (bewijs voor de nu-atomaire release);
- `releaseRoomLocators` op een nooit-geclaimde combinatie werpt niet (no-op);
- `refreshRoomLocators` op een actief eigen bezit slaagt zonder fout;
- `refreshRoomLocators` op een niet (meer) bezeten locator werpt `RangeError`.

## Harde grenzen

- Geen wijziging aan `server/architecture/room-codes.js` (AR-bestand).
- Geen echte TTL-expiry/countdown in de fake — `refreshRoomLocators` legt het
  contract vast, niet het mechanisme; expliciet zo genoemd in commentaar.
- Geen hashfunctie toegevoegd aan `server/data/` — `inviteHash` komt
  kant-en-klaar binnen, ook bij de hernoemde lookup.
- Taal in commentaar/documentatie: "maakt mogelijk"/"unblocks", nooit "lost
  Redis-atomiciteit op" — dat blijft een (b)-ADR-uitvoeringsdetail van de
  echte adapter (checkpoint 2, 6).
- 2 bestanden gewijzigd (`repository.js`, `in-memory-store.js`) + 1
  testbestand; de hernoeming van `loadRoomByInviteId` telt niet als extra
  bestand (zelfde twee bestanden).

## Definition of done

- `claimRoomLocatorsAtomically`, `releaseRoomLocators`, `refreshRoomLocators`
  staan in de `DataStore`-poort en in `DATA_STORE_METHOD_NAMES`;
  `loadRoomByInviteId` is hernoemd naar `loadRoomByInviteHash(inviteHash)`.
- Claim en lookup delen dezelfde index — geverifieerd met een test die claimt
  vóór `saveRoom` en direct daarna succesvol leest.
- `releaseRoomLocators` is alles-of-niets, met een test voor het
  gedeeltelijke-bezit-geval.
- `refreshRoomLocators`-contract vastgelegd, met eigendomscontrole.
- `node --test 'server/data/**/*.test.js'` slaagt.
- [`DM6-repository-port.md`](DM6-repository-port.md) krijgt een kort
  "Nabericht (na DM10)" dat de hernoeming documenteert — zelfde stijl als het
  bestaande Nabericht over de `RoomCore`→`Room`-hernoeming onderaan dat
  bestand.
- [`HANDOFF.md`](../HANDOFF.md) krijgt een regel: INT-1/INTB-2 beantwoord,
  inclusief de `releaseRoomLocators`-signatuurafwijking en de reden daarvoor.
