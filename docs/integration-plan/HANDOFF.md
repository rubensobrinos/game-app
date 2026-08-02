# INT — HANDOFF naar domeineigenaren

Genummerde items die integratie heeft blootgelegd. Eénrichtingsverkeer:
integratie vindt, de eigenaar herstelt. INT bouwt er niet omheen en fixt niet
zelf, op triviale interop na (die staat onderaan, met melding).

Statuslegenda: 🔵 open — 🟡 in behandeling — ✅ opgelost — ⏸️ geparkeerd.

| # | Voor | Status | Onderwerp |
| --- | --- | --- | --- |
| INT-1 | DM + AR | ✅ **opgelost** | Atomaire claim toegevoegd: `claimRoomLocatorsAtomically`, `releaseRoomLocators`, `refreshRoomLocators` (variant A) |
| INT-2 | PR | 🔵 open | `Match.sequence` ontbreekt in het snapshot-`room`-object |
| INT-3 | DM | 🔵 open | **Poort mist een token→sessie-lookup — blokkeert stap 2** |
| INT-4 | CT + DM | 🔵 open | Contentcontract mist `validOptionIds` / `resultDetails` |
| INT-5 | GR + PR | 🔵 open | `correctAnswer` is afleidbaar uit de publieke payload van `flags_mc` |
| INT-6 | DM | 🔵 open | `loadRoomByInviteId` krijgt de rauwe `inviteId` in plaats van de hash |
| INT-7 | DM | 🔵 open | Poort heeft geen conditionele/partiële write; heel-document-writes kunnen `Room.phase` overschrijven |
| INT-8 | PR | 🔵 open | PR10-previewendpoint wijkt af van de gebouwde `previewInvite` |
| INT-9 | DM | 🔵 open | `deadlineGraceMs`: `DATA-MODEL.md` zegt 150, besluit 13 zegt 250 |
| INT-10 | GR + GF + AR | 🔴 **hoog** | **Deadlock bij host-tempo met tussenstand uit — de match hangt** |
| INT-11 | PR | 🔵 open | `preset`-waarde loopt drie kanten op; het is een wire-veld |
| INT-12 | PD | 🔵 open | `shared/product/quick-start-preset.mjs` is stale naast een nieuwere variant |

---

## INT-10 — deadlock bij host-tempo met de tussenstand uit

**Voor:** GR (semantiek van host-tempo), GF (`host-controls-state.mjs`), AR
(state machine). **Ernst:** hoog — de match komt niet verder.

Twee lezingen van besluit 1 zijn onafhankelijk geïmplementeerd en samen kloppen
ze niet.

- `client/flow/host-controls-state.mjs:18` — `WAITING_PHASES = new Set(['SCOREBOARD'])`.
  De hostactie `'next'` verschijnt uitsluitend bij `SCOREBOARD`.
- `server/architecture/state-machine.js` — bij `pacing: 'host'` is `HOST_NEXT`
  óók geldig vanuit `ROUND_RESULT` naar `COUNTDOWN`/`ROUND_ACTIVE`/`FINISHED`, en
  weigert `TIMER_ELAPSED` naar diezelfde bestemmingen.

Met `pacing: 'host'` én een configuratie waarin de tussenstand niet wordt
getoond, bereikt de match `ROUND_RESULT` en komt er niet meer weg: de server
wacht op een hostactie die de client nooit aanbiedt, en de timerovergang is
geweigerd. `server/data/types/game-configuration.js` valideert
`scoreboardFrequency` zonder enum, dus die configuratie is representeerbaar.

Achtergrond: besluit 1 legt "één hostactie per ronde" vast maar zegt niet wat er
gebeurt als de tussenstand uitstaat. AR heeft dat gat ingevuld met "dan verschuift
de hostactie naar `ROUND_RESULT`", expliciet gemarkeerd als interpretatie in de
modulekop. GF heeft besluit 1 letterlijk gelezen. Beide verdedigbaar, de
combinatie niet.

**Drie uitwegen, de keuze is aan GR:**

- **A** — de tussenstand kan bij host-tempo nooit uit. Dan heeft GF gelijk en is
  de `ROUND_RESULT`-tak in de state machine dode code die weg moet. Vereist wel
  dat `scoreboardFrequency` die combinatie afdwingt in plaats van toestaat.
- **B** — AR's interpretatie blijft. Dan moet GF `ROUND_RESULT` aan
  `WAITING_PHASES` toevoegen wanneer de tussenstand uitstaat, wat betekent dat
  `scoreboardFrequency` in de clientcontext beschikbaar moet zijn.
- **C** — bij tussenstand uit loopt `ROUND_RESULT` gewoon op de timer door. Dan
  is er in die configuratie géén hostactie per ronde en is host-tempo daar
  feitelijk automatisch.

INT-A's voorkeur is **B**: die houdt "één hostactie per ronde" in beide
configuraties waar, wat de letterlijke belofte van besluit 1 is. Maar dit is
spelgevoel en dus niet aan de integrator.

**Wat INT-A doet tot dit beslist is:** de keten-test gebruikt de quick-start-
default (auto-tempo, tussenstand aan), waar de combinatie niet optreedt. Er komt
geen omweg in de compositie.

---

## INT-11 — de `preset`-waarde loopt drie kanten op

**Voor:** PR. **Blokkeert:** stap 2 (wire-contract).

Drie plekken, drie waarden voor hetzelfde veld in `POST /api/v1/games`:

| Bron | Waarde |
| --- | --- |
| `PROTOCOL.md`, request-voorbeeld | `"group_battle"` |
| `client/flow/host-setup-state.mjs` | `'default'` (door GF gemarkeerd als gok) |
| `server/composition/room-lifecycle.mjs` | `'quick_start'` |

Besluit 31 schrapt Groepsbattle, dus `"group_battle"` in `PROTOCOL.md` is
achterhaald — maar er is geen vervanger vastgelegd, en daardoor heeft iedereen
zelf iets gekozen. Inclusief ikzelf; `'quick_start'` is net zo goed een gok als
`'default'`.

Besluit 35 houdt de quick-start-route expliciet in stand, dus het veld verdwijnt
niet. PR moet één waarde vastleggen; INT-A en GF volgen die.

---

## INT-12 — stale presetbestand naast een nieuwere variant

**Voor:** PD.

`shared/product/quick-start-preset.mjs` exporteert
`GROUP_BATTLE_DEFAULT_GAME_TYPES` met vier spelvormen, wat besluit 31 en 32
achterhaald hebben. Er bestaat inmiddels ook
`shared/product/flags-mc-quick-start-default.mjs`.

GF importeert de oude niet meer (alleen nog een comment die ernaar verwijst) en
in `server/` importeert niemand hem. Het risico is dus beperkt tot verwarring —
maar met twee presetbestanden naast elkaar en INT-11 nog open is dat precies het
soort verwarring dat iemand een verkeerde default laat kiezen.

---

## INT-3 — de poort kan een bearer token niet naar een sessie herleiden

**Voor:** DM. **Blokkeert:** INT-A stap 2 (echt transport). Stap 1 kan door.

`PROTOCOL.md` stuurt uitsluitend `Authorization: Bearer <sessionToken>`, en
`client/flow/session-store.mjs` bewaart lokaal alleen
`{ sessionToken, roomCode, playerId }` — geen `sessionId`. De poort biedt alleen
`loadSession(roomId, sessionId)`.

Zodra er echt transport is, komt er dus een request binnen met alleen een token,
en is er geen ondersteunde weg om daar een sessie bij te vinden.

Er is bewust **geen schaduwindex** gebouwd om dit te omzeilen. `resolveSession`
in de compositie vereist nu `roomId` én `sessionId`, en de aanroeper krijgt beide
uit `createRoom`/`joinRoom` — bruikbaar binnen stap 1, niet daarbuiten.

**Voorstel:** `loadSessionByTokenHash(tokenHash)` in de poort, met in Redis een
index op de hash (nooit op het token zelf, conform besluit 26).

---

## INT-4 — het contentcontract mist twee velden die `assertRoundShape` vereist

**Voor:** CT, cc DM. **Blokkeert niet:** de stub vult ze additief aan.

`content-interface-request.md` specificeert `buildQuestion → { questionKey,
publicQuestionPayload, correctAnswer }`, maar `assertRoundShape()` in
`server/data/types/round.js` **vereist** daarnaast `validOptionIds` voor
`flags_mc` en `capitals_mc`, en `resultDetails` voor `higher_lower` en
`odd_one_out`. Zonder die velden is geen geldig `Round`-document te bouwen.

Mijn eigen verzoekdocument is hier dus incompleet. Het moet worden aangevuld
vóór CT zijn interface vastlegt, anders bouwt CT naar een contract dat DM's
validatie niet haalt.

---

## INT-5 — `correctAnswer` is afleidbaar uit de publieke payload van `flags_mc`

**Voor:** GR (vraagvorm), cc PR (besluit 20).

Besluit 20 en `PROTOCOL.md` eisen dat het juiste antwoord niet afleidbaar is uit
ID, volgorde, URL, seed of metadata. Structureel klopt het: `correctAnswer` staat
gescheiden en komt nooit in `round:started`. Maar de vorm van GR4 is
`{ targetIso2, optionIso2s }` met `correctAnswer = { optionId: targetIso2 }` —
en `targetIso2` staat in de publieke payload. Voor deze spelvorm is
"niet-afleidbaar" met de huidige vorm dus niet haalbaar.

Niet zelf herontworpen: de vraagvorm is van GR.

---

## INT-6 — `loadRoomByInviteId` krijgt de capability in plaats van de hash

**Voor:** DM.

INT-1 §6 en `DATA-MODEL.md` (`room:invite:{inviteHash}`) zeggen dat de poort de
hash krijgt en nooit de invite zelf, zodat Redis-keynamen de capability niet
tonen. De fake indexeert echter op `room.inviteId`, en het `Room`-document heeft
geen `inviteHash`-veld — de hash die de compositie berekent heeft dus geen plek
om te landen. Hij wordt wel berekend, zodat de atomaire claim uit INT-1 straks
meteen het juiste argument krijgt.

---

## INT-7 — geen conditionele of partiële write op de poort

**Voor:** DM.

`saveRoom(room)` is een heel-document read-modify-write. Tegen een echte store
kan `setRoomLocked` of een TTL-refresh daarmee een gelijktijdige
`Room.phase`-projectie overschrijven — precies het niet-atomaire dual-write-pad
dat besluit 30 verbiedt. Binnen één proces met de fake is er geen venster.

Geïsoleerd in `touchRoom()` en `setRoomLocked()` met een comment, zodat de
wijziging één plek raakt.

---

## INT-8 — PR10 wijkt af van de gebouwde `previewInvite`

**Voor:** PR.

`docs/protocol-plan/prompts/PR10-preview-endpoint.md` verscheen tijdens de bouw
en stelt een endpoint voor met *beide* locators en een respons `{ valid,
suggestedName }`. De gebouwde `previewInvite` neemt alleen `inviteId` en geeft een
rijker object terug. Bewust niet achter het bewegende document aangelopen; dit
moet vóór stap 2 worden verzoend.

---

## INT-9 — tegenstrijdige `deadlineGraceMs`

**Voor:** DM.

`DATA-MODEL.md`'s `GameConfiguration`-voorbeeld zegt `150`; `DECISIONS.md`
besluit 13 zegt 250 ms. `QUICK_START_CONFIG` gebruikt 250, want `DECISIONS.md`
wint. Het voorbeeld in `DATA-MODEL.md` hoort gecorrigeerd te worden.

---

## INT-1 — de poort mist een atomaire claim voor de join-code

**Voor:** DM (eigenaar `repository.js`), met AR (eigenaar `room-codes.js`).
**Blokkeert:** INT-A stap 1 (ontwerp), INT-B stap 3 (Redis-adapter). Beide
bouwen de race in als dit niet eerst beslist wordt.

`DATA_STORE_METHOD_NAMES` bevat achttien methoden, met twee expliciet atomaire:
`setRoomAndMatchPhaseAtomically` (besluit 30) en `saveAcceptedAnswerAtomically`
(besluit 23). Voor de join-code is er alleen `loadRoomByCode` — een leesoperatie.

Daarmee is roomcreatie onvermijdelijk check-then-act: tussen "is deze code vrij?"
en het wegschrijven van de room kan een tweede roomcreatie dezelfde code pakken.
`ARCHITECTURE.md` eist "uniek onder actieve rooms"; die eis is met de huidige
poort principieel niet te halen.

Een adversariële review van `room-codes.js` heeft dit gemeten: de kans is nu
ongeveer 1 op 1.000.000 per creatie en groeit lineair met de bezetting. Los
daarvan is `generateGameCode({ isTaken })` **synchroon** en werpt sinds de fix van
2 augustus expliciet op een async callback — juist omdat een async `isTaken` de
uniciteitscontrole stil volledig uitschakelde (elke kandidaat werd geaccepteerd,
zonder fout of waarschuwing). Redis is async. De huidige combinatie werkt dus met
de in-memory fake, maar kan bij de echte adapter niet worden gebruikt.

### Concreet voorstel

Eén nieuwe methode in `DATA_STORE_METHOD_NAMES`. **`room-codes.js` hoeft niet te
veranderen** — `isTaken` is daar al optioneel, dus de compositie kan
`generateGameCode()` zonder callback aanroepen voor kandidaten en de retry-lus
zelf draaien rond de claim. Daarmee blijft AR's module puur en synchroon en
verhuist het async-deel naar de laag die er thuishoort.

```js
claimRoomLocatorsAtomically({ roomId, code, inviteHash, ttlSeconds })
  → { ok: true }
  | { ok: false, conflict: 'code' | 'inviteHash' }
```

**Waarom code en inviteHash samen in één operatie** en niet twee losse claims:
anders bestaat er een toestand waarin de code geclaimd is en de inviteHash niet,
en die moet dan handmatig teruggedraaid worden — precies het soort halve
toestand dat besluit 30 elders verbiedt.

**Semantiek die vastgelegd moet worden:**

1. **Atomair.** Beide indexen worden gezet of geen van beide. In Redis een klein
   Lua-script met twee `SET NX` en een rollback van de eerste als de tweede
   faalt; in de fake een bezet-check-plus-schrijf binnen één synchrone stap.
2. **Idempotent per `roomId`.** Dezelfde `roomId` die dezelfde `code` en
   `inviteHash` opnieuw claimt krijgt `{ ok: true }`, niet een conflict. Zonder
   die regel faalt een retry na een netwerkhapering op zijn eigen eerdere
   succes.
3. **Conflict is geen fout.** `{ ok: false, conflict }` is een normale uitkomst
   waarop de aanroeper een nieuwe kandidaat genereert. Geen exception.
4. **TTL.** De claims krijgen dezelfde TTL als de room en worden meeverlengd door
   het bestaande refreshpad in `server/data/ttl.js`.
5. **Vrijgeven.** Hier is een keuze nodig, en die is aan DM:
   - *Variant A* — een `releaseRoomLocators(roomId)` erbij, aan te roepen als
     roomcreatie ná de claim alsnog mislukt. Nadeel: één methode extra.
   - *Variant B* — claimen met een korte TTL (bijv. 60 s) die bij het opslaan van
     de room wordt opgehoogd naar de room-TTL. Nadeel: twee stappen, dus een
     nieuw klein venster.
   - *Variant C* — niets doen en de code voor de volle room-TTL laten
     verbranden. Nadeel: vier uur een verloren code per mislukte creatie.

   INT-A's voorkeur is **A**: expliciet, één extra methode, geen nieuw venster.
   Maar de poort is van DM en dit is een schemabeslissing.

6. **`inviteHash`, niet `inviteId`.** De poort krijgt de hash aangeleverd, nooit
   de capability zelf — conform `DATA-MODEL.md`, dat `room:invite:{inviteHash}`
   gebruikt zodat Redis-keynamen de invite niet tonen. Hashen doet de compositie
   met `hashInviteId` uit `room-codes.js`.

**Wat INT-A doet tot dit beslist is:** stap 1 gebruikt de in-memory fake, waar
check-then-act binnen één proces geen echt venster heeft. De claim staat achter
één functie in de compositie, zodat de latere wijziging precies één plek raakt.
Er komt geen omweg omheen en er wordt geen tweede claim-mechanisme verzonnen.

---

## INT-2 — `Match.sequence` ontbreekt in het snapshot-`room`-object

**Voor:** PR (eigenaar `PROTOCOL.md` en de snapshot-shape).
**Blokkeert niet:** stap 1 kan door; het raakt de correctheid van rematch.

`snapshot-precedence.js` ordent snapshots en events uitsluitend op `serverTime` in
milliseconden. Er is geen totale ordening over matches heen. Dat veroorzaakt drie
gevolgen tegelijk, alle drie vastgesteld tijdens de adversariële review:

1. Bij een gelijke `serverTime` kan een snapshot van de **vórige** match nieuwere
   state overschrijven.
2. Een `matchId`-flip-flop (A→B→A→B) wordt geaccepteerd, terwijl matchIds uniek
   zijn per room en terugkeer dus altijd een fout is.
3. `game:rematch-started` is een server→client **event**, geen snapshot, en
   `shouldApplyEvent` geeft geen matchwissel-signaal. Op het normale rematchpad
   houdt de client dus antwoordstatus, rondetimer en scoredelta van de vorige
   match vast, terwijl `GAME-FLOW.md` §12 eist dat scores en streaks naar nul
   gaan.

`DATA-MODEL.md` definieert al `Match.sequence`, die matches binnen een room
totaal ordent. Eerst op `sequence` ordenen en daarna pas op `serverTime` binnen
een match lost alle drie in één keer op — maar dan moet `sequence` in het
snapshot-`room`-object van `PROTOCOL.md` staan.

**Relevant voor matrixrij 7** (volledige matchcyclus inclusief rematch). INT-A
activeert die rij met de huidige ordening en noteert de beperking; zodra
`sequence` beschikbaar is kan de keten-test worden aangescherpt.

---

## Zelf opgelost — triviale interop, ter kennisgeving

**Geen.** Vooraf gecontroleerd en niet nodig gebleken: ESM-modules kunnen alle
CommonJS-modules die de compositie nodig heeft met **named imports** gebruiken
(`state-machine`, `room-codes`, `snapshot-precedence`, `scoring`, `repository`,
`in-memory-store` — alle geprobeerd, alle volledig). Node's cjs-module-lexer
herkent het `module.exports = { … }`-patroon dat deze modules consequent
gebruiken. Er is dus geen interop-shim nodig, en besluit 28 (`.mjs` voor nieuwe
modules) kan zonder omweg worden gevolgd.
