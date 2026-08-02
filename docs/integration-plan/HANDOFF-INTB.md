# HANDOFF — INT-B → domeineigenaren

Genummerde items van INT-B (opslagadapters en verpakking, achter de
repository-poort). Cross-verwijzingen vanuit `HANDOFF-INTA.md` gebruiken het
itemnummer, bijvoorbeeld `INTB-1`.

Statuslegenda: 🔵 open — 🟡 in behandeling — ✅ opgelost — ⏸️ geparkeerd.

## Stand

| Item | Onderwerp | Status |
| --- | --- | --- |
| INTB-1 | Drie methoden misten `roomId` | ✅ DM verbreedde de signaturen |
| INTB-2 | Geen atomaire claim voor de join-code | ✅ locator-lifecycle, geverifieerd |
| INTB-3 | `getScoreboardTop` negeerde `roomId` | ✅ opgelost in DM12 |
| INTB-4 | Fake dwingt idempotentie niet af | ✅ DM13 — de 3 rode tests zijn groen |
| INTB-5 | Geroteerde uitnodiging blijft geldig | 🔴 **heropend** — zie hieronder |
| INTB-6 | Tiebreak `getScoreboardTop` ligt niet vast | 🔵 open |
| INTB-7 | Ruw invite-id of hash? | ✅ poort neemt de hash |
| INTB-8 | Fixtures produceren ongeldige documenten | 🔵 open |
| INTB-9 | `saveRoom` omzeilt de atomaire locatorclaim | 🟡 **besluit akkoord**, bouwen |
| INTB-10 | `loadSessionByTokenHash` niet implementeerbaar | 🟡 **besluit akkoord**, wacht op sleutel in `redis-keys.js` |
| INTB-11 | Fake loopt achter op DM19 — 6 tests rood tegen de fake, groen tegen de adapter | 🔵 open |

Beide delen van
[`BESLUIT-INTB-locators-en-sessieindex.md`](BESLUIT-INTB-locators-en-sessieindex.md)
zijn van productzijde akkoord.

**Deel A is nu een harde regel:** `claimRoomLocatorsAtomically`,
`rotateRoomLocators` en `releaseRoomLocators` zijn de enige drie schrijvers van
de lookup-indexen. Elke andere schrijfweg is voortaan per definitie een bug.

**Deel B akkoord**, inclusief de TTL-vorm: de room-brede refresh leest de
tokenhashes uit de bestaande sessions-hash. Ik kan bouwen zodra
`sessionTokenLookupKey(tokenHash)` in `redis-keys.js` staat en de regel in
`DATA-MODEL.md` §Redis-sleutels is opgenomen.

**Vaste werkafspraak:** mijn akkoord op een poortmethode betekent
implementeerbaar in Redis, mét benoemde sleutel én TTL-uitspraak. Anders geen
akkoord.

DM heeft de poort van 18 naar 21 methoden gebracht en daarmee vijf items gesloten.
De oplossing voor INTB-2 is beter dan mijn voorstel: één
`claimRoomLocatorsAtomically` voor code én inviteHash samen, met een
`conflict`-veld dat zegt wélke botste. Twee losse claims zouden een half
geclaimde toestand kunnen achterlaten.

Zelf geverifieerd: acht gelijktijdige claims op dezelfde code geven exact één
winnaar.

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

## INTB-11 🔵 — De fake loopt achter op DM19

**Aan:** DM-agent. **Ernst:** middel — geen defect, wel een uiteenlopend contract.

Na DM19 heeft `setRoomAndMatchPhaseAtomically` de nieuwe signatuur
`(roomId, matchId, { expectedPhase, newPhase, pausedState })` met een
resultaatobject. De conformance-suite toetst die, en de Redis-adapter volgt hem.

**`server/data/in-memory-store.js` volgt hem nog niet:** zes conformance-tests
staan rood tegen de fake en groen tegen de adapter.

Dat is de omgekeerde richting van wat we gewend zijn, en juist daarom het
vermelden waard. Tot nu toe liep de adapter achter op de fake; nu andersom. Beide
richtingen hebben hetzelfde gevolg: de conformance-suite toetst twee
implementaties tegen één verwachting, dus zodra ze uiteenlopen is één van beide
per definitie rood — en is niet meer af te lezen wélke de norm is.

**Voorstel:** breng de fake naar de DM19-signatuur, inclusief de dubbele CAS
(documentvergelijking én `expectedPhase`) en `pausedState` in dezelfde stap. Dan
staan beide weer op hetzelfde contract.

Ik doe dat niet zelf: `in-memory-store.js` is van DM, en het is precies het soort
wijziging waarbij we het contract per ongeluk twee kanten op kunnen laten lopen
als we er allebei aan zitten.

---

## INTB-9 🔴 — `saveRoom` omzeilt de atomaire locatorclaim volledig

**Aan:** DM-agent, met kopie aan INT-A. **Ernst:** hoog.
**Gevonden bij:** INTB2b. **Zelf gereproduceerd.**

`saveRoom` schrijft de code-index onvoorwaardelijk (`SET`, geen `NX`) — in beide
implementaties, en de conformance-suite rekent erop. Daarmee is de hele
claim-machinerie uit **INTB-2** te omzeilen:

```
A claimt 482917 via claimRoomLocatorsAtomically   -> A is eigenaar
B doet alleen saveRoom met diezelfde code          -> geen claim, geen controle

loadRoomByCode('482917')                           -> B
claimRoomLocatorsAtomically door C                 -> { ok:false, conflict:'code' }
```

De lookup-index zegt **B**, het claimregister zegt **A**. Een speler die de code
intypt komt in de verkeerde room; een derde room krijgt een conflict op een code
die feitelijk van niemand meer is.

Dit maakt de fix voor INTB-2 gedeeltelijk ongedaan. We hebben de TOCTOU-race
tussen twee claims gedicht, maar er loopt een tweede weg naar dezelfde index die
helemaal niet langs de claim gaat.

**Voorstel:** `saveRoom` raakt de lookup-indexen niet meer aan. Locators worden
uitsluitend beheerd via `claimRoomLocatorsAtomically`, `rotateRoomLocators`,
`releaseRoomLocators` en `refreshRoomLocators` — één weg naar één index. Dat is
ook consistent met wat er al geldt voor de invite-index: `Room` draagt geen hash,
dus `saveRoom` kán die sowieso niet vullen. De code-index is nu de uitzondering,
en juist die uitzondering is het gat.

Let op dat de conformance-suite hier op rekent; die tests gaan mee veranderen.

---

## INTB-10 🔵 — `loadSessionByTokenHash` is niet tegen Redis implementeerbaar

**Aan:** DM-agent. **Blokkeert:** die ene methode in de Redis-adapter.
**Klasse:** identiek aan het opgeloste INTB-1.

DM14 voegde `loadSessionByTokenHash(tokenHash)` toe met de redenering dat
`saveSession` de index gewoon kan vullen, zoals `saveRoom` dat voor de code doet.
Dat gaat op voor een `Map`, niet voor Redis:

- er bestaat **geen sleutel** voor een tokenHash — niet in `redis-keys.js` en
  niet in `DATA-MODEL.md` §Redis-sleutels;
- de signatuur draagt **geen `roomId`**, terwijl sessies room-scoped zijn
  (`roomSessionsKey(roomId)`).

De twee uitwegen zijn allebei verboden: zelf een sleutelnaam samenstellen, of een
globale `SCAN`. De adapter werpt daarom, met in de melding wat er nodig is.

**Nodig om dit te deblokkeren:**

1. een builder `sessionTokenLookupKey(tokenHash)` in `redis-keys.js`;
2. dezelfde regel in `DATA-MODEL.md` §Redis-sleutels;
3. een uitspraak over de TTL van die index;
4. **een rotatie-uitspraak.** Deze ontbreekt in het voorstel en is de reden dat
   ik dit als eigen item opschrijf in plaats van als detail: krijgt een sessie een
   nieuw token, dan blijft de oude tokenhash naar diezelfde sessie wijzen. Dat is
   letterlijk **INTB-5** nog een keer, nu voor sessietokens — een tweede geldige
   capability naast de nieuwe. De fake heeft dat gat vandaag ook.

Punt 4 is de reden om dit niet stilzwijgend op te lossen: we hebben dit patroon
vandaag al twee keer gezien (roomlocators, en nu sessies), en het is elke keer
een intrekking die niet intrekt.

---

## INTB-5 🔴 — HEROPEND: rotatie laat de oude locators geldig

**Aan:** DM-agent. **Ernst:** hoog, securitygevolg.
**Status:** ik meldde dit eerder als opgelost. Dat was te snel — mijn
contracttest bewees dat `releaseRoomLocators` wérkt, niet dat een rotatie hem
gebruikt. DM's lezing klopt; het gat zit een laag hoger.

### Reproductie

```
claim { roomId: r1, code: AAA111, inviteHash: hash-a }  -> ok
saveRoom(r1)
claim { roomId: r1, code: BBB222, inviteHash: hash-b }  -> { ok: true }

loadRoomByCode('AAA111')      -> r1   ← nog steeds geldig
loadRoomByInviteHash('hash-a') -> r1   ← nog steeds geldig
loadRoomByCode('BBB222')      -> r1
```

Eén room, twee geldige codes en twee geldige uitnodigingen. `ARCHITECTURE.md`
§inviteId eist dat een invite "direct intrekbaar of roteerbaar" is; roteren
voegt nu een capability tóé in plaats van de vorige te vervangen. Een host die
zijn uitnodiging intrekt omdat er iemand ongewenst binnenkwam, trekt niets in.

In Redis lekken de oude sleutels bovendien met volle TTL.

### Waar de fix hoort

Twee richtingen, en dit is een DM-besluit:

1. **`claimRoomLocatorsAtomically` geeft in dezelfde operatie de vorige locators
   van datzelfde `roomId` vrij.** Rotatie is dan veilig by construction. Een room
   heeft per definitie precies één code en één inviteHash, dus er bestaat geen
   legitiem geval waarin er twee tegelijk geldig zijn.
2. **De aanroeper moet eerst `releaseRoomLocators` doen.** Werkt ook, maar maakt
   het een protocol dat iemand kan vergeten — en dit is precies het soort
   vergeten waarvan de gevolgen pas zichtbaar zijn als iemand er misbruik van
   maakt.

**Mijn advies: richting 1.** Maak de verkeerde volgorde onmogelijk in plaats van
gedocumenteerd. Richting 2 vereist bovendien een test op de compositielaag
(INT-A), en dan ligt de bewijslast bij iemand die dit gat niet heeft gevonden.

### Wat ik doe

Ik voeg een test toe aan de conformance-suite die dit gat vastlegt, tegen het
correcte contract (na een rotatie is de oude locator ongeldig). Die staat rood
tot DM kiest, net als de drie INTB-4-tests.

---

## INTB-5-oud — de oorspronkelijke melding (opgelost)

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

## INTB-7 ✅ — Ruw invite-id of hash? Beslist: de hash

**Aan:** DM-agent. **Beslist in DM10.** Deze tekst is bijgewerkt; de oude versie
stelde het omgekeerde voor en was stale.

De poort neemt de **hash**: `loadRoomByInviteHash(inviteHash)`, en
`claimRoomLocatorsAtomically` krijgt eveneens een `inviteHash`. Dat is de
veiligere keuze en sluit aan op `redis-keys.js` (`roomInviteLookupKey(inviteHash)`)
en op `DATA-MODEL.md`, dat de capability bewust niet in Redis-keynamen wil tonen.

Mijn oorspronkelijke voorstel — de poort neemt het ruwe id en de adapter hasht
intern — is dus niet overgenomen, en terecht: dan zou elke adapter de pepper
moeten kennen, terwijl DECISIONS #26 juist een aparte pepper voorschrijft.

### Eén gevolg dat nog aandacht vraagt

`Room` draagt `inviteId` (ruw), de index draait op `inviteHash`. `saveRoom` kan
de invite-index daarom niet vullen — dat kán alleen via
`claimRoomLocatorsAtomically`. Dat is consistent, maar het betekent dat
**hashen bij de aanroeper ligt** en dus dat de compositielaag de pepper kent.

Voor INT-A relevant: de conformance-suite gebruikt daarom vaste literals als
inviteHash en importeert `hashInviteId` bewust niet — `server/data` zou dan van
`server/architecture` gaan afhangen, en dat is de verkeerde richting.

Geen actie meer nodig van DM; genoteerd zodat de keuze vindbaar blijft.

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

## INTB-4 ✅ — OPGELOST in DM13

De fake controleert nu wél een bestaand antwoord (`existingAnswer`) en een
bekende `actionId` (`existingActionCacheEntry`). De drie tests die hier bewust
rood op stonden zijn groen; de conformance-suite staat op **80/80**.

Daarmee hebben die tests gedaan waarvoor ze bedoeld waren: ze waren de
acceptatietoets van de fix, geschreven vóórdat de fix bestond.

De oorspronkelijke melding staat hieronder ter referentie.

---

## INTB-4-oud — de oorspronkelijke melding

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
