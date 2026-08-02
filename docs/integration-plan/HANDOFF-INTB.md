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

### Waarom ik dit niet zelf oplos

Het raakt de poort (van DM) én de documenttypes (van DM). Drie mogelijke
richtingen, en de keuze heeft gevolgen voor iedereen die de poort aanroept:

1. **Signaturen verbreden** — `saveRound(roomId, round)`,
   `loadAnswer(roomId, matchId, roundId, playerId)`,
   `loadActionCacheEntry(roomId, actionId)`. Kleinste ingreep, consistent met
   `loadRound`, maar raakt elke aanroeper.
2. **`roomId` aan de documenttypes toevoegen** — `Round.roomId`, `Answer.roomId`
   + `Answer.matchId`. `Player` en `Session` dragen `roomId` al, dus dit is
   consistent met de rest van het model; het maakt de documenten wel groter.
3. **Extra Redis-indexen** — `roundId → roomId` en `actionId → roomId`. Lost het
   op zonder de poort te raken, maar voegt schrijfwerk en TTL-onderhoud toe aan
   het antwoordpad, en dat is precies het pad dat volgens `ARCHITECTURE.md`
   principe 9 juist niets extra's mag doen.

**Mijn voorstel: richting 1 of 2, niet 3.** Richting 3 verplaatst het probleem
naar het kritieke pad en introduceert een consistentierisico (een index die
achterloopt op het document). Tussen 1 en 2 heeft 2 mijn lichte voorkeur, omdat
`Round` en `Answer` daarmee zelfstandig lokaliseerbaar worden — handig voor
herstel, analytics en debugging — maar 1 is de kleinere ingreep.

### Wat ik ondertussen doe

INTB1 gaat door. De conformance-suite legt het huidige gedrag van de fake vast,
inclusief de `RangeError` van `saveRound` bij een onbekende match. Zodra DM een
richting kiest, is de suite de plek waar het nieuwe contract wordt vastgelegd en
waar mijn Redis-adapter tegen bewezen wordt.

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

**Voorstel:** een claim-methode in de poort, bijvoorbeeld
`claimGameCode(code, roomId) → Promise<boolean>`, die in Redis met `SET NX`
wordt geïmplementeerd en in de in-memory fake met een simpele
aanwezigheidscontrole plus set. `room-codes.js` levert dan kandidaten en de
aanroeper claimt, in plaats van te vragen of iets bezet is. Dezelfde vraag speelt
voor `inviteId` (`roomInviteLookupKey`).

Ik implementeer dit zodra de poort de methode kent.

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
