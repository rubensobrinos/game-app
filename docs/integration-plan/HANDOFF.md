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
| INT-4 | CT + DM | ✅ **ingetrokken** | Verkeerd geadresseerd: die velden komen uit GR's `buildMatchQuestionPlan()`, niet uit de pool |
| INT-5 | GR + PR | 🔵 open | `correctAnswer` is afleidbaar uit de publieke payload van `flags_mc` |
| INT-6 | DM | 🔵 open | `loadRoomByInviteId` krijgt de rauwe `inviteId` in plaats van de hash |
| INT-7 | DM | 🔵 open | Poort heeft geen conditionele/partiële write; heel-document-writes kunnen `Room.phase` overschrijven |
| INT-8 | PR | 🔵 open | PR10-previewendpoint wijkt af van de gebouwde `previewInvite` |
| INT-9 | DM | 🔵 open | `deadlineGraceMs`: `DATA-MODEL.md` zegt 150, besluit 13 zegt 250 |
| INT-10 | GR + GF + AR | ✅ **opgelost** | Deadlock weg; `HOST_NEXT` vanuit `ROUND_RESULT` verwijderd, regressietest geplaatst |
| INT-13 | DM + AR | 🔵 open | `inviteHash` mist een versieprefix, anders dan sessietokens |
| INT-14 | DM + PR + **INT-B** | ✅ **ingewilligd** | `saveAcceptedAnswerAtomically` geeft nu `{ replay: boolean }` terug |
| INT-11 | PR | 🔵 open | `preset`-waarde loopt drie kanten op; het is een wire-veld |
| INT-15 | DM + **INT-B** | 🔴 **hoog, nu beslissen** | `(roomId, tokenHash)` zou de socket-handshake onbouwbaar maken — input voor INTB-9/10 |
| INT-16 | DM + **INT-B** | 🟠 ter akkoord | Crash-atomaire fasewissel: fase + projectie + `pausedState` in één operatie, met verwachte oude fase |
| INT-17 | PR | 🔴 **hoog** | `GET /games/{code}/state` geeft 500 in de lobby — elke reconnect loopt hierdoor |
| INT-19 | PR + GF | 🔵 open | Reveal-choreografie: tijdstempels in `round:ended`, geen extra fasewaarden |
| INT-20 | DM | 🔵 open | Antwoordverdeling: `listAnswersForRound` i.p.v. een gameType-bewuste poortmethode |
| INT-12 | PD | 🔵 open | `shared/product/quick-start-preset.mjs` is stale naast een nieuwere variant |
| INT-18 | ~~INT-B + PR~~ **OPGELOST (regie, `389edab`)** | ✅ was: blokkeerde de Redis-store volledig | Opgelost via richting 2 (scoped): `assertFinalHashSegment` staat `:` toe in het láátste sleutelsegment; fixtures nu uit echte `hashToken`. Zie de resolutie onder het item. |

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

### ✅ Opgelost — variant A, door AR zelf

Het oorspronkelijke item legde drie uitwegen voor. Bij het narekenen bleek er
één die de tekst van besluit 1 onvoorwaardelijk waarmaakt, en die zat in AR's
eigen bestand. De `HOST_NEXT`-tak vanuit `ROUND_RESULT` is verwijderd
(commit `3143e7e`).

Bij host-tempo loopt elke ronde nu via
`ROUND_RESULT --timer--> SCOREBOARD --HOST_NEXT--> volgende`, dus **altijd
precies één hostactie per ronde, in élke configuratie**. GF's
`WAITING_PHASES` is daarmee correct zonder wijziging, en de deadlock is weg.
Geverifieerd tegen de échte `availableHostActions` uit `host-controls-state.mjs`,
niet alleen tegen de eigen tabel. Er staat een regressietest met INT-10 in de
naam zodat de tak niet terugkeert.

**Consequentie voor de `GAME-RULES.md`-eigenaar** — geen vraag, wel iets om te
weten: `scoreboardFrequency: 'uit'` betekent bij host-tempo voortaan "toon geen
tussenstand", niet "sla de fase over". De `SCOREBOARD`-fase blijft bestaan,
want daar doet de host zijn enige actie; wat die fase toont is presentatie. Bij
auto-tempo verandert er niets — daar mag `ROUND_RESULT` de tussenstand nog
steeds overslaan. Staat als notitie in de modulekop van `state-machine.js`.

**Les:** dit item ontstond doordat AR een gat in besluit 1 met een comment
invulde in plaats van er een besluit van te maken. Een interpretatie die het
gedrag van een ander domein raakt hoort in `DECISIONS.md`, niet in een
modulekop.

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

### ✅ Ingetrokken — verkeerd geadresseerd

Nagekeken in `server/rules/question-selection.js`: die velden komen niet uit de
pool maar uit de output van `buildMatchQuestionPlan()` — `validOptionIds` op
regel 138 (`flags_mc`) en 162 (`capitals_mc`), `resultDetails` op regel 222
(`higher_lower`) en 268 (`odd_one_out`). `assertRoundShape()` is daarmee gewoon
tevreden.

Er was dus nooit een gat in CT's contract; mijn verzoekdocument vroeg om het
verkeerde ding. CT levert de pool, GR bouwt de vraag — een betere arbeidsverdeling
dan wat ik voorstelde, want afleiderkeuze is spelregelkennis en geen
contentkennis. Correctie vastgelegd in
[`content-interface-request.md`](content-interface-request.md), met één
bevestigingsvraag aan GR over de returnvorm.

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

---

## INT-13 — `inviteHash` mist een versieprefix, anders dan sessietokens

**Voor:** DM (eigenaar van de invite-index), met AR (eigenaar `room-codes.js`).
**Blokkeert niet:** er ligt een werkende tussenoplossing. Dit gaat om de
structurele lijn.

Besluit 26 vraagt om **versieerbare** HMAC-hashing met pepper. Voor sessietokens
is dat netjes geïmplementeerd: `auth-session.mjs` slaat op als
`${versie}${scheidingsteken}${hex}`, en `verifyToken` leest de versie uit de hash
om de juiste pepper op te zoeken. Daardoor kan een pepper roteren zonder dat
bestaande sessies ongeldig worden.

`hashInviteId` uit `room-codes.js` doet dat niet: die levert kale hex. Sinds DM10
draait de invite-index (`room:invite:{inviteHash}`) daar wél op. Gevolg: een
pepperrotatie verandert de hash van elke bestaande `inviteId`, waardoor alle
lopende invites in één klap onvindbaar worden. Met een room-TTL van vier uur is
dat een reëel venster, geen theoretisch.

**Wat de compositie nu doet** (`room-lifecycle.mjs`, gedocumenteerd in de code):
bij een lookup wordt de binnenkomende `inviteId` eerst met de actieve pepper
gehasht en bij geen treffer met de overige peppers uit
`config.tokenPeppers.peppers`. Dat is bewust hetzelfde patroon als `verifyToken`
en het werkt — maar het kost tot N lookups per join en het dwingt oude peppers in
de configuratie te blijven staan zolang er invites leven.

**Voorstel:** geef `inviteHash` dezelfde vorm als de tokenhash,
`${versie}${scheidingsteken}${hex}`. Dan:

- is één lookup genoeg, want de versie staat in de sleutel die de client meebrengt;
- volgt de invite-index dezelfde versioneringslijn als tokens, in plaats van een
  losse conventie te worden;
- kan de compositie de meerdere-peppers-fallback laten vallen.

Dit raakt `room-codes.js` (de hashvorm), de indexsleutel in `redis-keys.js`, en
de opgeslagen `inviteHash` op het Room-document. Daarom bij DM en AR samen, niet
bij één van beide.

---

## INT-14 — een replay ná de deadline krijgt een fout in plaats van de gecachete ack

**Voor:** DM (poort), cc PR. **Ernst:** hoog voor het reconnectpad.
**Aanleiding:** ontstaan bij het verplaatsen van de idempotentie naar de poort,
bewust niet omzeild.

`PROTOCOL.md` §Idempotentie zegt: "zelfde `actionId`: zelfde ack". §Reconnect
stap 7 beschrijft precies wanneer dat gebeurt — een client die géén ack heeft
ontvangen herhaalt dezelfde `actionId`. Na een reconnect duurt dat seconden, dus
de herhaling komt regelmatig ná `endsAt + grace` of nadat de ronde niet meer
`ACTIVE` is.

De compositie wijst dan af met `DEADLINE_PASSED` of `ROUND_NOT_ACTIVE`, terwijl
het antwoord wél geaccepteerd is. De speler ziet zijn geaccepteerde antwoord als
geweigerd.

Gereproduceerd: eerste inzending `{ ok: true, ack: { roundId } }`; exact dezelfde
inzending na `endsAt + 5000` → `{ ok: false, code: 'DEADLINE_PASSED' }`.

**Waarom het nu pas zichtbaar is.** De oude voorcontrole in de compositie ving
dit geval af. Die is verwijderd omdat hij geen gelijktijdigheid dekte en de poort
sinds DM13 de enige waarheid hoort te zijn. De poort dekt de deadline-tak echter
niet: `resolveAnswer()` wijst af vóórdat `saveAcceptedAnswerAtomically` wordt
bereikt. Het gat zat er dus altijd al onder een vangnet.

### Het voorstel — één wijziging die twee problemen oplost

**Laat `saveAcceptedAnswerAtomically` een expliciet resultaat teruggeven**, bijvoorbeeld:

```js
saveAcceptedAnswerAtomically(roomId, matchId, write) → { replay: boolean }
```

Dat lost in één beweging twee dingen op:

1. **Het replay-signaal.** De poort geeft nu in beide takken `undefined` terug en
   laat identieke store-inhoud achter, waardoor "was dit een replay?" achteraf
   niet af te leiden is. De compositie doet daarom één lezing vóór de write,
   uitsluitend om het `replay`-veld een naam te geven. Die lezing beslist niets,
   kort niets af en kan geen write tegenhouden — hij staat als
   `LABEL, GEEN CONTROLE` in de code. Met een retourwaarde kan hij helemaal weg.
2. **De deadlinevolgorde.** Met een expliciet replay-signaal kan de compositie een
   bekende `actionId` herkennen **vóór** de deadlinecontrole en de gecachete ack
   teruggeven. Daarmee geldt "zelfde `actionId` = zelfde ack" ook ná de grace,
   conform `PROTOCOL.md`.

### Urgentie — dit moet beslist zijn vóórdat INT-B zijn Lua-script afrondt

**INT-B moet mede-akkoord geven**, want besluit 23 legt de atomaire
antwoordverwerking in één Redis Lua-script. Dat script moet **dezelfde
retourwaarde** leveren als de in-memory fake, anders draait de conformance-suite
groen tegen twee implementaties met verschillend gedrag — precies de schijnzekerheid
die de suite hoort te voorkomen.

Wordt dit ná het Lua-script beslist, dan is het een herschrijving van een atomair
script in plaats van een veldje erbij. Daarom nu.

Er is bewust geen tweede vangnet in de compositie teruggezet: het gat hoort bij de
poort, niet bij de aanroeper.

---

## INT-15 — waarschuwing bij INTB-9/10: `(roomId, tokenHash)` breekt de socket-handshake

**Voor:** DM + INT-B. **Urgentie:** dit besluit wordt nu genomen; deze input moet
erin mee. **Ernst:** hoog — een van de kandidaat-signaturen maakt de socketlaag
onbouwbaar.

`loadSessionByTokenHash(tokenHash)` staat sinds DM14 in de poort en de socketlaag
draait erop. INTB-9/10 heroverweegt de signatuur omdat er in `redis-keys.js` nog
geen sleutel voor bestaat.

**Wordt de signatuur `(roomId, tokenHash)`, dan breekt de handshake volledig.**
Bij een socketverbinding heeft de server op dat moment uitsluitend het token uit
`{ auth: { sessionToken, protocolVersion } }`. Er is geen `roomId` — die staat
juist ín de sessie die nog opgezocht moet worden. Hetzelfde geldt voor elk
REST-verzoek dat alleen een `Authorization: Bearer`-header draagt, want
`client/flow/session-store.mjs` bewaart lokaal geen `sessionId` en geen `roomId`
naast het token.

Een room-gescoopte lookup vereist dus dat de client zijn `roomId` meestuurt bij de
handshake. Dat is een `PROTOCOL.md`-wijziging én een wijziging in wat de client
lokaal bewaart, en het maakt de room-parameter tot iets wat een aanvaller kan
kiezen. Dat lijkt me de verkeerde kant op.

**Tweede punt voor hetzelfde besluit:** een index op tokenhash staat op gespannen
voet met pepper-rotatie (besluit 26). De socketlaag probeert nu alle pepperversies
uit `config.tokenPeppers.peppers`, dus O(#versies) lookups per handshake. Dat werkt,
maar het is dezelfde structurele scheefheid als INT-13 bij `inviteHash`: de
opgeslagen hash draagt geen versie, dus je moet raden welke pepper erbij hoort.
Eén oplossing dekt beide: sla de index op onder `${versie}:${hash}` zoals
`auth-session.mjs` dat voor de tokenhash zelf al doet.

**Wat INT-A vraagt:** houd de lookup key-only (`tokenHash` als enige argument).
De socketlaag heeft die aanroep achter één functie geïsoleerd, dus een andere
uitkomst kost mij weinig — maar een room-gescoopte variant kost een
protocolwijziging en is niet los op te lossen.

---

## INT-16 — crash-atomaire fasewissel: één operatie voor fase, projectie én pausedState

**Voor:** DM (eigenaar van de poort) en INT-B (Lua-script), ter akkoord.
**Van:** INT-A, met de AR-pet op — dit raakt de state machine die ik bezit.
**Niet zelf gebouwd:** dit wacht op akkoord, conform de eenrichtingsregel.
**Bundelt:** review-bevinding 2 en 5.

### Het probleem

Besluit 30 legt vast dat `Match.phase` autoritair is en `Room.phase` een projectie
die **in dezelfde atomaire operatie** wordt bijgewerkt. `setRoomAndMatchPhaseAtomically`
doet dat correct. Maar de huidige signatuur is:

```js
setRoomAndMatchPhaseAtomically(roomId, matchId, newPhase) → Promise<void>
```

Er zitten twee gaten in.

**Gat 1 — `pausedState` valt buiten de atomaire operatie.** Een pauze zet fase én
`pausedState` samen; dat is één logische overgang. De compositie doet daar nu twee
schrijfacties voor: eerst `saveMatch` met de `pausedState` maar zonder fase, dan de
atomaire fasewissel. Crasht het proces daartussen, dan staat er een match met een
`pausedState` die niet `PAUSED` is, of andersom. Dat is precies het niet-atomaire
dual-write-pad dat besluit 30 verbiedt, alleen dan voor het veld dat het besluit niet
noemt.

**Gat 2 — geen verwachte oude fase.** De operatie schrijft onvoorwaardelijk. Twee
gelijktijdige overgangen — een servertimer die naar `SCOREBOARD` wil en een host die
tegelijk `game:finish` stuurt — kunnen elkaar overschrijven, en de verliezer merkt
niets. Dit is ook de kern van het al gemelde INT-7: heel-document-writes kunnen een
gelijktijdige faseprojectie klobberen.

### Voorstel

```js
setRoomAndMatchPhaseAtomically(roomId, matchId, {
  expectedPhase,        // string — de fase die de aanroeper dacht te zien
  newPhase,             // string
  pausedState,          // object | null — in dezelfde operatie
}) → Promise<{ ok: true } | { ok: false, actualPhase: string }>
```

- **Compare-and-set.** Komt `expectedPhase` niet overeen met wat er staat, dan
  schrijft de operatie niets en geeft ze de werkelijke fase terug. De aanroeper kan
  dan opnieuw beslissen in plaats van blind te overschrijven. Dat sluit gat 2 en
  geeft INT-7 een oplossing die verder gaat dan de fase alleen.
- **`pausedState` in dezelfde operatie**, zodat een pauze niet meer half kan landen.
  `null` bij elke niet-`PAUSED`-fase — dat is invariant 1 van de state machine, en
  door hem in de poort af te dwingen kan geen enkele aanroeper hem breken.
- **Conflict is geen fout**, net als bij de locatorclaim: een resultaatobject, geen
  exception.

### Twee resume-events in plaats van één

Op mijn eigen terrein: de state machine kent nu alleen `HOST_RESUME`, waarbij de
aanroeper de bestemming meelevert. Het onderscheid tussen een handmatige hervatting
en herstel na een serverherstart zit dus nergens in de state, alleen in de
`reason`-vrije tekst van de pauze.

Voorstel: splits naar **`HOST_RESUME`** en **`RECOVERY_RESUME`**. Ze mogen dezelfde
transitie doen, maar het onderscheid hoort in het alfabet omdat:

- `ARCHITECTURE.md` §10 eist dat herstel gebeurt met een nieuwe korte countdown, niet
  door stilletjes fases over te slaan — dat is een andere bestemming dan bij een
  handmatige hervatting;
- besluit 11 kent `server_recovery` als eigen pauzereden, dus het onderscheid bestaat
  al productmatig;
- analytics en logs kunnen een herstart-hervatting dan onderscheiden van een
  hostactie, wat nu onmogelijk is.

Dit deel raakt alleen `state-machine.js` en is mijn werk zodra de poortkant akkoord is.

### Besluit #37-toets — wat DM en INT-B moeten uitspreken

1. **Redis-sleutel.** Onder welke sleutel landt `pausedState`? Zit hij in het
   Match-JSON-document (besluit 22) of apart? Als hij in het document zit, moet het
   Lua-script het hele document lezen, muteren en terugschrijven binnen dezelfde
   atomaire uitvoering — inclusief de `Room.phase`-projectie in een tweede sleutel.
2. **TTL.** Raakt deze operatie de TTL van room- en matchsleutels, of blijft dat bij
   het bestaande refreshpad in `ttl.js`? Een fasewissel is activiteit, dus mijn
   aanname is verlengen — maar dat moet uitgesproken worden en niet impliciet blijven.
3. **Lua.** Compare-and-set hoort in hetzelfde script als de schrijfactie, anders is
   het alsnog check-then-act. Dat is dezelfde les als INT-1.

### Waarom nu

INT-B bouwt het Lua-script voor `saveAcceptedAnswerAtomically`. De fasewissel krijgt
er een van dezelfde vorm. Wordt dit ná dat werk besloten, dan is het een tweede
herschrijving van atomaire code — precies wat bij INT-14 net is voorkomen door op tijd
te melden.

---

## INT-17 — `GET /games/{code}/state` geeft 500 in de lobby; elke reconnect loopt hierdoor

**Voor:** PR (eigenaar `snapshot-shape.mjs`). **Ernst:** hoog.
**Bevestigd door:** DT (onafhankelijk gevonden) en INT-A (gereproduceerd).

### Reproductie

```
POST /api/v1/games  { config: { preset: 'quick_start', language: 'nl' },
                      hostParticipates: true, displayName: 'Host' }   → 201
GET  /api/v1/games/{gameCode}/state   met de host-bearer                → 500 INTERNAL_ERROR
```

### Oorzaak

`buildSnapshot` levert vóór de eerste match `matchId: null` en `matchSequence: null`.
`validateSnapshotShape` eist `matchId` als niet-lege string en `matchSequence` als
integer ≥ 1. De REST-laag keurt de respons daarom af en geeft 500 in plaats van een
ongeldige snapshot door te geven — dat deel werkt zoals bedoeld. Het gat zit in de
shape: er is geen lobby-variant.

### Waarom dit zwaarder weegt dan een lobby-detail

**Elke reconnect loopt door dit endpoint** (`PROTOCOL.md` §Reconnect stap 5: "Na
verbinding vraagt client altijd een snapshot"). En de lobby is statistisch juist
waar reconnects gebeuren: mensen wachten tot anderen joinen, telefoons vallen in
slaap, er wordt van app gewisseld om de QR door te sturen. Het endpoint is dus
kapot op het moment dat het het vaakst wordt aangeroepen.

Succescriterium 6 uit `PRODUCT.md` — "refresh of korte netwerkuitval herstelt binnen
5 seconden" — is in de lobby niet haalbaar zolang dit staat.

### Voorstel

Laat `snapshot-shape.mjs` een lobby-snapshot toe: `matchId: null` en
`matchSequence: null` geldig wanneer `room.phase === 'LOBBY'` en er nog geen match
is. De overige velden blijven onverkort verplicht.

Alternatief dat ik afraad: de compositie een placeholder-`matchId` laten verzinnen.
Dan liegt de snapshot over het bestaan van een match, en `snapshot-precedence`
ordent straks op `matchSequence` — een verzonnen waarde zou daar echte schade doen.

### Wat INT-A doet tot dit is opgelost

De keten-test over echt verkeer pint dit gedrag **expliciet vast** met een test die
de 500 vastlegt en een verwijzing naar dit item, inclusief de opdracht de assertie
naar 200 om te draaien zodra de shape-fix landt. Er komt geen omweg in de
compositie of de transportlaag, en stap 2 wordt niet groen gemeld op dit endpoint.

---

## INT-18 — `createRoom` faalt altijd tegen de Redis-store: tokenhash bevat `:`, `redis-keys.js` verbiedt `:`

**Voor:** INT-B (eigenaar `server/data/redis-keys.js` en
`server/data/adapters/redis/data-store.mjs`), met PR (eigenaar de hashvorm in
`server/protocol/auth-session.mjs`). **Ernst:** kritiek — dit is geen
edge case, dit is de eerste schrijfactie van elke room-aanmaak. Zolang dit
staat is de Redis-store 100% non-functioneel voor elk echt gebruik, niet
alleen voor een specifiek scenario.

**Gevonden door:** DT, tijdens de herhaling van chaos-scenario 1 nadat de
store-bedrading (`REDIS_URL` → `createRedisDataStore`) landde. Eerste poging
tot `POST /api/v1/games` tegen een verse `aseso-game-chaos`-rebuild (met
Redis, `/readyz` bevestigde `{"ok":true,"store":"redis"}`) gaf al `500
INTERNAL_ERROR`, vóór er ook maar íets met chaos/restart gebeurd was.

### Reproductie

Rechtstreeks tegen de gebouwde containerimage, `createRoom` zonder de
HTTP-laag ertussen (die de fout anders in een kale 500 verpakt):

```js
import { readConfigFromEnvironment, buildServer } from './server/index.mjs';
import { createRoom } from './server/composition/room-lifecycle.mjs';

const config = readConfigFromEnvironment(process.env, () => {});
const fastify = await buildServer({ config, attachSockets: false });
await createRoom(fastify.appContext, {
  config: { preset: 'quick_start', language: 'nl' },
  hostParticipates: true,
  displayName: 'Debug',
});
```

```
TypeError: tokenHash must not contain ':' or glob characters ('*', '?', '[', ']'),
got: "v1:1ac6194212ce094e754f5686f75d114cf7016b6957d8335e708b4e160582ddf0"
    at assertSegment (/app/server/data/redis-keys.js:29:11)
    at sessionTokenLookupKey (/app/server/data/redis-keys.js:61:27)
    at Object.saveSession (file:///app/server/data/adapters/redis/data-store.mjs:709:22)
    at createRoom (file:///app/server/composition/room-lifecycle.mjs:445:25)
```

Elke `POST /api/v1/games` roept `createRoom` → `store.saveSession` aan, dus
dit reproduceert 100% van de tijd, niet incidenteel.

### Oorzaak

Twee module-lokaal correcte beslissingen die nooit tegen elkaar zijn
afgezet:

- `server/protocol/auth-session.mjs` (PR, besluit 26/PR12): slaat een
  sessietoken-hash versioned op als `${version}:${hex-hash}` — de eigen
  motivatie in de code luidt letterlijk *"`:` als scheidingsteken, omdat dat
  teken nooit in een hex-digest of in een pepperversie-naam (`v1`, `v2`, …)
  voorkomt"*. Klopt, binnen die twee losse velden.
- `server/data/redis-keys.js` (INT-B): `assertSegment` verbiedt `:` (en
  glob-tekens) in **elk** segment dat een Redis-sleutel opbouwt, omdat `:`
  daar juist het eigen sleutel-scheidingsteken is (`session:token:{tokenHash}`).
  Ook op zichzelf een redelijke, defensieve validatie.

Het gat: `sessionTokenLookupKey` gebruikt de **volledige, versioned**
`tokenHash` — inclusief het `v1:`-prefix dat PR er juist bewust aan gaf — als
één segment. PR's aanname ("`:` komt nooit voor in een hex-digest of
pepperversie") is dus lokaal waar maar wordt hier geschonden door de eigen
`${version}:${hex}`-samenstelling zelf, niet door de losse delen.

Ter vergelijking, dit is de spiegeling van **INT-13** (hierboven): daar mist
`inviteHash` juist het versieprefix dat sessietokens wél hebben, met
pepperrotatie als gevolg. Hier heeft de sessietoken-hash het prefix wél
(zoals INT-13 als het navolgenswaardige patroon aanhaalt) — en juist dát
prefix breekt de Redis-sleutelbouwer. Beide items horen bij dezelfde
onderliggende vraag (hoe versioned hashes en Redis-sleutels samengaan) en
verdienen één gezamenlijk antwoord, niet twee losse patches.

### Voorstel

Niet zelf gekozen — twee voor de hand liggende richtingen, ontwerpkeuze voor
INT-B + PR samen (raakt beide modules):

1. `sessionTokenLookupKey` (en elke andere plek die een versioned hash als
   Redis-segment gebruikt) vervangt `:` door een ander scheidingsteken vóór
   het de sleutel in gaat, bijv. `tokenHash.replace(':', '_')` — omkeerbaar
   zolang het hex-deel zelf nooit `_` bevat (net zo min als `:`).
2. `assertSegment` staat `:` toe specifiek voor segmenten die zelf al een
   gestructureerde, versioned vorm zijn (`${version}:${hex}`), met een eigen
   sub-validator die het `version:hex`-patroon controleert in plaats van kale
   afwezigheid van `:` te eisen — dan blijft de bescherming tegen willekeurige
   input intact, maar niet tegen een bekend, veilig patroon.

Optie 1 is kleiner en raakt alleen de aanroepplek(ken) in `data-store.mjs`;
optie 2 is principiëler maar raakt de gedeelde validator die door meerdere
sleutelbouwers wordt gebruikt. Ik kies geen van beide — dit raakt zowel de
hashvorm (PR) als de sleutelbouwer (INT-B).

### Wat ik niet heb gedaan

Niet gefixt — `redis-keys.js`, `data-store.mjs` en `auth-session.mjs` zijn
geen van alle mijn module. Chaos-scenario 1's herhaling (het eigenlijke doel
van vandaag: bewijzen dat roomstate een restart overleeft mét de nieuwe
Redis-koppeling) kon hierdoor niet verder dan roomaanmaak — zie de
DT6-rapportage in `docs/deployment-and-testing-plan/chaos-runbook.md` voor de
volledige uitkomst.

### RESOLUTIE (regie, 3 aug 2026, commit `389edab`)

Gekozen: **richting 2, maar smaller dan voorgesteld** — geen patroonvalidatie
van `${version}:${hex}` in de gedeelde validator, maar een aparte
`assertFinalHashSegment` die uitsluitend door `sessionTokenLookupKey` wordt
gebruikt. Redenering:

- De `:`-ban bestaat om sleutel*segmenten* niet dubbelzinnig te maken; in het
  **laatste** segment van een sleutel is een `:` niet dubbelzinnig en voor
  Redis betekenisloos. Glob-tekens blijven overal verboden (SCAN-veiligheid).
- Richting 1 (`replace(':', '_')`) verwierp ik: het introduceert een tweede,
  afwijkende representatie van dezelfde hash (sleutel ≠ opslagvorm in het
  sessiedocument), wat bij debuggen en bij INT-13's versioned-hash-vraag juist
  verwarring toevoegt. De sleutel is nu byte-voor-byte de opslagvorm.
- De hashvorm zelf (PR's `${version}:${hex}`) blijft onaangeraakt — geen
  migratie, geen dubbele leesroutine, INT-13's patroonverwijzing blijft
  kloppen.

Besluitbevoegdheid: bugfix (CLAUDE.md §Beslisbevoegdheid, zelfstandig);
productie stond er 100% op stuk, INT-B/PR zijn met pensioen c.q. bevroren, en
de producteigenaar had livegang-mandaat gegeven. DT's fixture-les is
meegenomen: `redis-keys.test.js` gebruikt nu de échte `hashToken`-uitvoer.
Getest: redis-keys 67/67, data+transport 118/118, `npm test` 2515 pass /
0 fail (Redis-gebonden tests draaien alleen met live Redis — DT's herhaling
van chaos-scenario 1 is hierna de echte proef).

---

## INT-18 — aanvulling vanuit INT-A: reproductie, oorzaak van het testgat, en bewijs dat het hierna werkt

Dit item was al gemeld door INT-B/PR. Hieronder wat INT-A er onafhankelijk
bij heeft vastgesteld tijdens het bouwen van de store-factory.

`Session.tokenHash` draagt sinds PR12 een pepper-versieprefix — `v1:<64 hex>`,
conform besluit 26, en `verifyToken` leest die versie er weer uit.
`assertSegment` in `server/data/redis-keys.js` verbiedt een `:` in een
keysegment. Gevolg: `sessionTokenLookupKey()` werpt op elke echte hash.

Gereproduceerd:

| Invoer | Uitkomst |
| --- | --- |
| `v1:` + 64 hex — het formaat dat `auth-session.mjs` produceert | **werpt** `tokenHash must not contain ':' …` |
| `hash_1` — de fixture uit de adaptertests | werkt |

Daardoor geeft de **eerste** `POST /api/v1/games` tegen Redis een 500. Niet een
randgeval: de allereerste schrijfactie van elke sessie.

**Waarom geen enkele test dit ving.** De adapterfixtures gebruiken synthetische
hashes als `hash_1`. Die bevatten geen `:`, dus ze konden de guard per definitie
niet raken. De suite was groen op data die de bug niet kón uitlokken — dezelfde
vorm als de vacuümverificaties in `AGENTS.md`, maar via onrealistische fixtures
in plaats van een overgeslagen happy path.

**Voorstel — keuze aan DM:** óf de guard versoepelen voor `tokenHash`
specifiek (de versieprefix is een vast, gecontroleerd formaat, geen
gebruikersinvoer), óf de hash in de adapter encoderen vóór hij een keysegment
wordt. De eerste is eenvoudiger; de tweede houdt de guard onverkort streng.

**Aanbeveling los daarvan:** vervang de synthetische hashes in de adapterfixtures
door hashes uit `hashToken()` zelf. Een fixture die het echte formaat niet
gebruikt, bewijst niets over het echte pad.

**Aangetoond dat het hierna werkt:** met alleen deze regel gepatcht in een
geïsoleerde kopie draait de volledige keten-test 6/6 groen tegen Redis, en
herstelt een procesherstart midden in een match room, match, spelers, scores en
het sessietoken.

---

## INT-19 — reveal-choreografie: tijdstempels in `round:ended` in plaats van extra fasen

**Voor:** PR (payloadvorm), cc GF en AR. **Naar aanleiding van:** DM's observatie
over statengranulariteit (`docs/data-model-plan/observatie-statengranulariteit-design-vs-matchphase.md`).

De designdocumentatie beschrijft zeventien UI-states; `Match.phase` kent er zeven.
DM legt terecht twee routes voor: substaten client-side houden, of er echte
fasewaarden van maken.

**AR's antwoord: route 1 — geen extra fasewaarden.** De toets die dat beslist:
gedraagt de server zich anders in die toestand? Bij `ROUND_CLOSED`, `REVEAL` en
`SOCIAL_HIGHLIGHT` weigert hij precies hetzelfde (de ronde is voorbij), accepteert
hij dezelfde hostacties en produceert hij dezelfde snapshotvorm. Geen enkel
serverbesluit valt anders uit, dus het is geen fase. Hetzelfde geldt voor
`LEADERBOARD` binnen `SCOREBOARD` en `PODIUM` na `FINISHED`.

De kosten van route 2 worden in de observatie onderschat: het is geen
enum-uitbreiding maar vier extra knopen in de reducer, elk met pacing-regels,
pauzeerbaarheid en een hervat-bestemming. `pausedState.previousPhase` krijgt vier
nieuwe waarden en `RECOVERY_RESUME` — die alleen naar `COUNTDOWN` mag — moet gaan
beslissen wat er gebeurt bij een crash tijdens `SOCIAL_HIGHLIGHT`. Plus drie
extra atomaire schrijfacties per ronde per room.

**Maar route 1 is niet "niets doen", en dat mist de observatie.** Laat de client
de choreografie zelf timen, dan zien host en spelers de reveal op verschillende
momenten en landt de sociale headline uit de maat. Dat breekt het samen-reageren
waar `PRODUCT.md` het hele kernmoment op bouwt.

**Voorstel aan PR:** geef `round:ended` absolute tijdstempels voor de substappen
mee, in dezelfde vorm als `startsAt`/`endsAt` bij een vraag. De server plant, de
client rendert — precies principe 2 uit `ARCHITECTURE.md`, dat nergens zegt dat
het tot vraagtimers beperkt is. `Match.phase` blijft op zeven; de choreografie
wordt synchroon zonder één extra fase.

De exacte velden zijn aan PR. De vraag die daaronder ligt: welke substappen
hebben een gedeeld moment nodig, en welke mag elk toestel zelf bepalen?

---

## INT-20 — antwoordverdeling: de poort mag geen gameType-kennis krijgen

**Voor:** DM. **Naar aanleiding van:** DM's eigen observatie
(`docs/data-model-plan/observatie-antwoordverdeling-poortbehoefte.md`).

De observatie klopt: drie designdocumenten noemen de antwoordverdeling als reëel
UI-element, en de poort kan alleen één antwoord van één speler ophalen. De twee
genoemde complicaties kloppen ook — met name dat aggregeren hoort te gebeuren op
het moment van reveal en niet als teller in het antwoordpad, conform
`ARCHITECTURE.md` principe 9.

**Eén correctie op de geschetste vorm.** `getAnswerDistribution(...)` zou moeten
weten dat `flags_mc` een `optionId` draagt, `higher_lower` een `side` en
`odd_one_out` een `cardIndex`. Dat is domeinkennis in een opslagabstractie: bij
elke nieuwe spelvorm moet de storage dan mee, en er ontstaat een tweede plek die
weet wat `answer-flow.js`'s `buildRoundContext()` al weet.

**Voorstel:** splits het.

```js
listAnswersForRound(roomId, matchId, roundId) → Promise<Answer[]>
```

Pure ophaling, geen interpretatie. De rules-laag telt en weet welk veld per
`gameType` de optiesleutel is.

**Twee behoeften komen hier samen**, wat meestal betekent dat het de juiste
methode is: `endRound` in de compositie leest de antwoorden nu per speler op —
tegen Redis honderd rondgangen per ronde bij een volle room. Dezelfde methode
lost dat N+1-probleem op.

Geen haast: de verdeling staat niet in de vroege fases van
`10-IMPLEMENTATION-ROADMAP.md`. Maar áls hij gebouwd wordt, graag in deze vorm.
