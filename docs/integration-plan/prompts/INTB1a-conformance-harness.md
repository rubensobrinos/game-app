# INTB1a — conformance-harness en de zestien niet-atomaire poortmethoden

**Domein:** INT-B (opslagadapters, achter de repository-poort).
**Blokkade:** geen. Uitvoerbaar zonder dependencies.
**Levert op:** de suite waarmee "de adapter is klaar" aantoonbaar wordt.

---

## Prompt

Je werkt in `/Users/ruben/game-app`. Je bouwt een **conformance-suite**: één
testsuite die elke implementatie van de `DataStore`-poort moet doorstaan, of dat
nu de in-memory fake is of straks een Redis-adapter. Zonder deze suite kan
niemand vaststellen of een adapterswap veilig is.

### Lees eerst

- `server/data/repository.js` — de poort: `DATA_STORE_METHOD_NAMES` (18
  methoden), `assertImplementsDataStore`, en de JSDoc-typedefs `DataStore` en
  `AcceptedAnswerWrite`.
- `server/data/in-memory-store.js` — de referentie-implementatie.
- `server/data/types/` — de documentvormen (`room`, `session`, `player`,
  `match`, `round`, `answer`, `game-configuration`). Deze modules bevatten
  validatiefuncties; gebruik die om je fixtures geldig te houden in plaats van
  vormen te verzinnen.
- `docs/multiplayer/DATA-MODEL.md` — de bron voor wat elk document betekent.
- `docs/multiplayer/DECISIONS.md` — bindend. Voor jou vooral #16
  (`countdownEndsAt` is **vluchtig** en wordt niet opgeslagen), #21
  (`contentVersion`/`rendererVersion` onveranderlijk op `Match`), #22
  (Room/Match/Round als versieerbare JSON-documenten).
- `docs/integration-plan/HANDOFF-INTB.md` — item **INTB-1** beschrijft drie
  poortmethoden die `roomId` missen en daardoor niet tegen Redis
  implementeerbaar zijn.

### Drie methoden worden UITGESLOTEN, niet vastgelegd

`saveRound`, `loadAnswer` en `loadActionCacheEntry` horen **niet** in deze
suite zolang HANDOFF-item **INTB-1** open staat.

Dit is de belangrijkste instructie van deze prompt. Een conformance-suite is per
definitie het contract dat elke productieadapter moet halen. Deze drie methoden
zijn aantoonbaar niet tegen Redis te implementeren; hun huidige gedrag alsnog
vastleggen promoveert een bekende fout tot norm, en maakt de latere correctie een
testbreuk in plaats van een verbetering.

Zet ze in een expliciet gemarkeerd, overgeslagen blok (`describe.skip` of
gelijkwaardig) met een comment die naar **INTB-1** verwijst en zegt wat er moet
gebeuren voordat ze meedoen: verbrede signaturen `saveRound(roomId, round)`,
`loadAnswer(roomId, matchId, roundId, playerId)` en
`loadActionCacheEntry(roomId, actionId)`.

De overige **dertien** methoden dek je volledig.

### Wat je bouwt

**Bestand:** `server/data/adapters/data-store-conformance.mjs` — de suite als
herbruikbare functie, niet als test-bestand:

```js
export function runDataStoreConformance({ describe, name, createStore, teardown })
```

De aanroeper levert een fabriek die een verse, lege store oplevert. Zo kan
dezelfde suite straks op een Redis-adapter worden gericht zonder één regel te
kopiëren. `teardown` is optioneel (de fake heeft hem niet nodig, Redis wel).

**Bestand:** `server/data/adapters/data-store-conformance.test.mjs` — richt de
suite op `createInMemoryStore()` uit `server/data/in-memory-store.js`.

### Let op: ESM tegen CommonJS

`server/data/` is CommonJS; jouw nieuwe modules zijn `.mjs` (DECISIONS #28).
`import { createInMemoryStore } from '../in-memory-store.js'` werkt via Node's
CJS-interop omdat die module een object-literal exporteert, maar **verifieer dat
als eerste**, vóór je de suite schrijft. Loop je hier tegenaan, dan is dat
triviale interop die je zelf mag oplossen — melden in `HANDOFF-INTB.md`.

### Te dekken per methode

Voor **elk** van de dertien niet-atomaire methoden die niet door INTB-1 worden
geraakt (de twee atomaire zitten in INTB1b; de drie uitgesloten staan hierboven):

1. **Happy path** — wegschrijven en weer teruglezen levert een gelijkwaardig
   document op.
2. **Ontbrekend record** — `loadX` van iets dat niet bestaat geeft `null`
   (respectievelijk `[]` voor `listPlayers`, `getScoreboardTop`). Nooit
   `undefined`, nooit een throw.
3. **Isolatie tussen rooms** — twee rooms met eigen spelers, matches en rondes
   lekken niet naar elkaar. Dit is de belangrijkste categorie: een adapter met
   een verkeerde sleutel faalt hier en nergens anders.
4. **Geen gedeelde referenties** — een document dat je opslaat en daarna muteert,
   verandert niet wat er in de store zit; en een teruggelezen document muteren
   raakt de store evenmin. De fake gebruikt `structuredClone`; een adapter die
   over JSON gaat doet dat vanzelf, maar de suite moet het afdwingen.

Specifiek per methode ook:

- `loadRoomByCode` / `loadRoomByInviteId` — beide lookups vinden dezelfde room
  die met `saveRoom` is opgeslagen; een tweede `saveRoom` met gewijzigde code
  mag de oude lookup niet laten hangen (of, als dat wél het gedrag is, leg dat
  expliciet vast als bekende beperking — controleer wat de fake doet en
  documenteer het).
- `listPlayers` — volgorde. Leg vast of die gegarandeerd is of niet; als niet,
  sorteer in de assertie en zet er een comment bij. Een adapter die op een Redis
  hash leunt heeft géén volgordegarantie.
- `getScoreboardTop` — respecteert `limit`, sorteert aflopend op score, en geeft
  `[]` voor een onbekende match. Zie HANDOFF **INTB-3**: de fake keyt op alleen
  `matchId` en negeert `roomId`. Schrijf een test die dit blootlegt (twee rooms,
  zelfde `matchId`) en markeer hem als **vastgelegd gedrag, geen broneis**, zodat
  duidelijk is dat hij op een besluit wacht.

### Harde eisen

- Alleen `node:test` en `node:assert`. Geen dependencies.
- Geen `Date.now()`, `Math.random()` of echte klok in fixtures — vaste literals,
  zodat een falende test altijd reproduceerbaar is.
- Elke test moet tegen een **verse** store draaien; geen volgorde-afhankelijkheid
  tussen tests.
- Fixtures bouw je met de validatiefuncties uit `server/data/types/`, zodat een
  ongeldige fixture meteen opvalt in plaats van een adapter te laten slagen op
  data die in productie nooit voorkomt.
- Sla **nooit** `countdownEndsAt` op in een Match- of Round-fixture (DECISIONS
  #16). Als je hem tegenkomt in een type, meld dat in de HANDOFF.
- Elke test heeft een Nederlandstalige beschrijving die zegt wát er wordt
  vastgelegd, niet welke methode wordt aangeroepen.

### Wat je NIET doet

- De poort (`repository.js`) of de fake (`in-memory-store.js`) wijzigen. Vind je
  een fout, dan is dat een HANDOFF-item aan DM.
- De twee atomaire methoden dekken — die zijn van INTB1b.
- Een Redis-adapter beginnen.
- Buiten `server/data/adapters/` schrijven.

### Opleveren

Kort verslag: het pad van beide bestanden, het aantal tests, per methode of alle
vier de categorieën gedekt zijn, welke gedragingen je als "vastgelegd gedrag" in
plaats van "broneis" hebt gemarkeerd en waarom, en of de ESM/CJS-import zonder
aanpassing werkte. Meld elke afwijking tussen wat `DATA-MODEL.md` beschrijft en
wat de fake doet als genummerd voorstel voor `HANDOFF-INTB.md` — voeg het item
niet zelf toe, lever de tekst aan.
