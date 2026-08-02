# HANDOFF — INT-B → domeineigenaren

Genummerde items van INT-B (opslagadapters en verpakking, achter de
repository-poort). Cross-verwijzingen vanuit `HANDOFF-INTA.md` gebruiken het
itemnummer, bijvoorbeeld `INTB-1`.

Statuslegenda: 🔵 open — 🟡 in behandeling — ✅ opgelost — ⏸️ geparkeerd.

---

## INTB-1 🔵 — Drie poortmethoden zijn niet tegen Redis implementeerbaar

**Aan:** DM-agent (eigenaar van `server/data/repository.js`).
**Blokkeert:** INTB2 (Redis-adapter). Niet INTB1 — de conformance-suite kan
vooruit en pint deze signaturen juist vast.

### Wat er aan de hand is

`server/data/redis-keys.js` bouwt de sleutels die `DATA-MODEL.md` voorschrijft:

```
roundKey(roomId, matchId, roundId)
answersKey(roomId, matchId, roundId)
actionCacheKey(roomId)
```

Alle drie hebben `roomId` nodig. Drie poortmethoden krijgen dat niet mee, en de
bijbehorende documenttypes dragen het evenmin:

| Poortmethode | Krijgt | Redis-sleutel vraagt | Probleem |
| --- | --- | --- | --- |
| `saveRound(round)` | `Round` (heeft `matchId`, **geen** `roomId`) | `roomId, matchId, roundId` | geen `roomId` beschikbaar |
| `loadAnswer(roundId, playerId)` | `roundId, playerId` | `roomId, matchId, roundId` | geen `roomId`, geen `matchId` |
| `loadActionCacheEntry(actionId)` | `actionId` | `roomId` | geen `roomId` |

`loadRound(roomId, matchId, roundId)` krijgt ze wél — de lees- en schrijfkant van
hetzelfde document zijn dus asymmetrisch.

De in-memory fake verbergt dit. `saveRound` doet een lineaire scan over alle
matches om het `roomId` te achterhalen
(`server/data/in-memory-store.js:112-121`) en werpt `RangeError` als de match nog
niet is opgeslagen. `loadAnswer` en `loadActionCacheEntry` gebruiken globale Maps
zonder room-scope. In één proces met weinig rooms werkt dat; in Redis is het
equivalent een `SCAN` over de hele keyspace per aanroep, of een tweede index die
`DATA-MODEL.md` niet kent.

### Voorstel: verbreed de poortsignaturen

```js
saveRound(roomId, round)
loadAnswer(roomId, matchId, roundId, playerId)
loadActionCacheEntry(roomId, actionId)
```

`DATA_STORE_METHOD_NAMES` verandert niet; alleen de JSDoc-signaturen en de
aanroepers. Dit sluit rechtstreeks aan op `redis-keys.js` en maakt de lees- en
schrijfkant van `Round` weer symmetrisch met `loadRound`.

Daarnaast: maak in de fake de answers, de action-cache en het scoreboard
werkelijk room-scoped. Nu zijn dat globale Maps, en dat is precies waarom het
gat onzichtbaar bleef.

**Twee alternatieven die ik afraad**, met reden:

*`roomId`/`matchId` aan de documenttypes toevoegen* (`Round.roomId`,
`Answer.roomId` + `Answer.matchId`) — dit was mijn eerste voorkeur en die was
fout. Het dupliceert context die elders al bestaat en introduceert drie nieuwe
invarianten die iemand moet bewaken:

```text
Answer.matchId moet overeenkomen met Round.matchId
Round.roomId   moet overeenkomen met Match.roomId
Answer.roomId  moet overeenkomen met beide
```

Een opslagpoort mag contextparameters aannemen zonder ze in het domeindocument
te persisteren. Dat is precies waar parameters voor zijn.

*Extra Redis-indexen* (`roundId → roomId`, `actionId → roomId`) — lost het op
zonder de poort te raken, maar voegt schrijfwerk en TTL-onderhoud toe aan het
antwoordpad, en dat is het pad dat volgens `ARCHITECTURE.md` principe 9 juist
niets extra's mag doen. Bovendien kan een index achterlopen op het document.

### Wat ik ondertussen doe

INTB1a gaat door voor de **dertien** methoden die dit niet raakt. De drie
getroffen methoden worden expliciet uitgesloten van de conformance-suite, met
een verwijzing naar dit item — niet vastgelegd als contract. Anders zou de suite
een bekende fout tot norm promoveren, en dat is erger dan een gat: dan is de
correctie later een testbreuk in plaats van een verbetering.

---

## INTB-2 🔵 — De poort mist een atomaire claim voor de join-code

**Aan:** DM-agent (poort) en AR-agent (`server/architecture/room-codes.js`).
**Status:** dit is de gedeelde blokkade die in beide INT-mandaten wordt genoemd;
INT-A meldt hem parallel. Hier staat de opslagkant.

De poort heeft alleen `loadRoomByCode(code)` — een leesoperatie. Uniciteit van de
join-code afdwingen met een read gevolgd door een write is check-then-act: tussen
beide kan een tweede roomcreatie dezelfde code pakken. Een adversariële review
van `room-codes.js` mat het venster op circa 1 op 10⁶ per creatie, groeiend met
de bezetting.

Bijkomend: `generateGameCode({ isTaken })` is synchroon en werpt sinds kort
expliciet op een async callback — juist omdat een async `isTaken` de
uniciteitscontrole eerder stil volledig uitschakelde. Een Redis-lookup ís async.
De huidige combinatie is dus niet alleen racegevoelig maar simpelweg niet
aanroepbaar vanuit een Redis-adapter.

**Voorstel:** geen losse claim maar een lifecycle, want een claim die nooit
vrijkomt lekt de coderuimte vol bij elke mislukte roomcreatie:

```js
claimGameCode(code, roomId, ttlSeconds) -> Promise<boolean>
releaseGameCode(code, roomId)           -> Promise<void>
claimInviteId(inviteHash, roomId, ttlSeconds) -> Promise<boolean>
releaseInviteId(inviteHash, roomId)           -> Promise<void>
```

In Redis is dat `SET NX` met TTL; in de fake een aanwezigheidscontrole plus set.
`room-codes.js` levert kandidaten, de aanroeper claimt — in plaats van te vragen
of iets bezet is en daarna te hopen.

`release` neemt `roomId` mee zodat een room nooit de claim van een ander kan
vrijgeven. De TTL is de vangnet voor een creatie die halverwege sneuvelt.

De conformance-suite moet **gelijktijdige claims** testen: bij N tegelijk
aangeboden claims op dezelfde code is er exact één winnaar. Dat is het enige dat
bewijst dat de race echt dicht is.

Ik implementeer dit zodra de poort de methoden kent.

---

## INTB-5 🔴 — Een geroteerde uitnodiging blijft geldig

**Aan:** DM-agent. **Ernst:** hoog — dit is een securitygevolg, geen hygiëne.
**Gevonden door:** de conformance-suite (INTB1a), zelf gereproduceerd.

`saveRoom` (`server/data/in-memory-store.js:44-49`) schrijft
`roomIdByCode` en `roomIdByInviteId` bij, maar verwijdert de vórige sleutel
nooit. Gereproduceerd:

```
room krijgt code 111111 / invite INV-AAA
room krijgt daarna code 222222 / invite INV-BBB

loadRoomByCode('111111')      -> room met code 222222
loadRoomByInviteId('INV-AAA') -> room met invite INV-BBB
```

De oude uitnodiging werkt dus nog steeds, en levert zelfs het nieuwe document
op. `ARCHITECTURE.md` §inviteId eist expliciet dat een invite "direct intrekbaar
of roteerbaar" is. Dat is nu aantoonbaar niet zo: roteren voegt een tweede
geldige capability toe in plaats van de eerste te vervangen.

In Redis is het bovendien een lekkende `room:code:{code}`-sleutel met volle TTL —
de coderuimte loopt vol. `DATA-MODEL.md` §TTL kent alleen opruiming bij verval en
zegt niets over een lévende room die van code wisselt.

**Voorstel:** laat `saveRoom` de vorige code- en invite-index expliciet
vrijgeven, of koppel het aan de lifecycle uit **INTB-2**
(`releaseGameCode`/`releaseInviteId`). Vastgelegd als karakterisatietest in
`data-store-conformance.mjs` — die test moet omgekeerd worden zodra dit gefixt is.

---

## INTB-6 🔵 — De tiebreak van `getScoreboardTop` ligt nergens vast

**Aan:** DM-agent en GR-agent.

`DATA-MODEL.md` schrijft een sorted set voor; Redis breekt gelijke scores
lexicografisch op member. De fake gebruikt `Array.prototype.sort` en komt op
invoegvolgorde uit. Twee implementaties, twee antwoorden bij gelijkspel — en het
scoreboard is precies de plek waar gelijke scores normaal zijn.

`server/rules/standings.js` kent al een tiebreak (`correctCount`,
`correctResponseTimeMsTotal`), maar de sorted set draagt die velden niet.

**Voorstel:** kies of `getScoreboardTop` een niet-gegarandeerde volgorde bij
gelijkspel mag opleveren die de aanroeper zelf herordent, of dat de
score-encoding de tiebreak meedraagt. De conformance-suite gebruikt daarom
bewust alleen verschillende scores.

---

## INTB-7 🔵 — `loadRoomByInviteId`: ruw invite-id of hash?

**Aan:** DM-agent.

`DATA-MODEL.md` wil dat de invite-lookupindex een hash gebruikt "zodat
Redis-keynamen de capability niet rechtstreeks tonen", en `redis-keys.js` heet
dan ook `roomInviteLookupKey(inviteHash)`. De poortmethode heet
`loadRoomByInviteId(inviteId)` en de fake indexeert `room.inviteId` letterlijk.

Met DECISIONS #26 (aparte pepper) is dat geen detail: moet de aanroeper hashen,
dan moet hij de pepper kennen.

**Voorstel:** leg in de JSDoc vast dat de poort altijd het **ruwe** `inviteId`
aanneemt en dat de adapter intern hasht. De conformance-suite gaat daarvan uit.

---

## INTB-8 🔵 — Gedeelde testfixtures produceren ongeldige documenten

**Aan:** DM-agent en de eigenaar van `tests/fixtures/`.

Zelf gereproduceerd:

```
makeRoom()  -> assertRoomShape:  preset must be a string, got: undefined
makeMatch() -> assertMatchShape: contentVersion must be a non-empty string, got: undefined
```

`makeRoom()` levert `config: {}` en draagt `contentVersion`/`rendererVersion` op
Room, terwijl `makeMatch()` ze juist mist — precies omgekeerd aan DECISIONS #21
en aan `types/room.js`, dat die velden bewust weglaat.

Zolang dit zo staat kan een test slagen op data die `server/data/types/` in
productie zou weigeren. **Voorstel:** laat de factories hun resultaat door de
bijbehorende `assert*Shape` halen. INTB1a gebruikt daarom eigen, gevalideerde
builders.

---

## INTB-4 🔵 — De fake dwingt idempotentie en "één antwoord per ronde" niet af

**Aan:** DM-agent. **Blokkeert:** INTB1b.

`saveAcceptedAnswerAtomically` in `server/data/in-memory-store.js:148-172`
controleert niet of er al een antwoord voor deze speler in deze ronde bestaat, en
niet of de `actionId` al in de action-cache staat. Hij overschrijft beide.

Daardoor kan INTB1b zijn belangrijkste eisen — dezelfde `actionId` tweemaal,
twee verschillende `actionId`'s voor dezelfde speler in dezelfde ronde, nooit
dubbele punten — niet groen krijgen zonder de fake te wijzigen.

**Voorstel: corrigeer de fake.** Idempotentie en "één antwoord per speler per
ronde" horen bíj de atomaire opslagoperatie, niet ervóór. Een controle in
`answer-flow.js` dekt concurrency niet af: tussen de check en de schrijfactie
past een tweede aanroep. Dat is dezelfde klasse fout als INTB-2, en de reden
waarom `DATA-MODEL.md` deze stappen expliciet ín de atomaire operatie plaatst
(stappen 4 en 5 van de tien).

Zolang dit open staat levert INTB1b **bewust falende karakterisatietests** op,
duidelijk gemarkeerd, zodat het gat zichtbaar is in plaats van weggeschreven.

---

## INTB-3 🔵 — `getScoreboardTop` negeert `roomId` in de fake

**Aan:** DM-agent. **Ernst:** laag, maar een gedragsverschil tussen fake en
adapter dat de conformance-suite anders zou missen.

De fake bewaart het scoreboard in `scoreboardByMatchId`, gekeyed op **alleen**
`matchId` (`server/data/in-memory-store.js:36`), terwijl de methode wel een
`roomId` krijgt en `scoreboardKey(roomId, matchId)` er wél op keyt. Zolang
`matchId` globaal uniek is, is het verschil onobserveerbaar — maar dan is de
`roomId`-parameter overbodig, en zo niet, dan is de fake fout.

**Voorstel:** kies expliciet. Ofwel `matchId` is globaal uniek en de parameter
verdwijnt, ofwel de fake gaat op beide keyen. Ik leg in de conformance-suite vast
welke van de twee het wordt, zodat de Redis-adapter er niet vanaf kan wijken.
