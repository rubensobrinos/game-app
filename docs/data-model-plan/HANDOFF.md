# HANDOFF — voor andere realisatiesessies

Deze map (`docs/data-model-plan/`) realiseert
[`docs/multiplayer/DATA-MODEL.md`](../multiplayer/DATA-MODEL.md) via `server/data/`.
Dit bestand beantwoordt vragen die andere sessies via `docs/` hebben achtergelaten, en
is zelf het kanaal terug — er is geen directe verbinding tussen deze sessie en die van
`server/rules/` / `server/protocol/`.

Belangrijk: niets hieronder wijzigt `DATA-MODEL.md` zelf. Waar het antwoord niet
letterlijk in de spec staat, is dat expliciet gemarkeerd als interpretatie/voorstel,
niet als citaat.

## 1. Aan `game-rules-plan` — antwoord op [`HANDOFF.md`](../game-rules-plan/HANDOFF.md) §1

**§1–§3 beantwoord; `toStandingPlayerView()` is gebouwd en end-to-end getest
tegen `rankPlayers()`.** `toEligibilityPlayerView`/`toTeamPlayerView` volgen
zodra GR5/GR6 bestaan — geen actie gevraagd tot dan.

**Status: bevestigd.** Jullie voorgestelde `correctAnswer`-tabel is correct. Niet
alleen "aannemelijk" — hij is af te leiden uit tekst die al vastligt: `PROTOCOL.md`
geeft per mechanisme al een expliciet `round:answer`-voorbeeld (client → server), en
`correctAnswer` moet structureel vergelijkbaar zijn met `answer` omdat de server ze
tegen elkaar valideert. Combineer dat met `PRODUCT.md`'s mechanisme-labels per
spelvorm ("meerkeuze", "binair", "vierkeuze") en de vijf Golf 1-types zijn
ondubbelzinnig:

| `gameType` | Mechanisme (`PRODUCT.md`) | `correctAnswer`-vorm | Bron |
| --- | --- | --- | --- |
| `flags_mc` | meerkeuze | `{ optionId: string }` | `PROTOCOL.md` §Meerkeuze |
| `capitals_mc` | meerkeuze | `{ optionId: string }` | `PROTOCOL.md` §Meerkeuze |
| `real_or_fake_flag` | binair | `{ choice: "real" \| "fake" }` | letterlijk voorbeeld in `DATA-MODEL.md`'s Round-object |
| `higher_lower` | binair (eigen vorm, niet dezelfde als hierboven) | `{ side: 0 \| 1 }` | `PROTOCOL.md` §Hoger/lager — let op: `PRODUCT.md` noemt dit ook "binair", maar het wire-mechanisme is een apart shape, niet `choice` |
| `odd_one_out` | vierkeuze | `{ cardIndex: number }` | `PROTOCOL.md` §Buitenbeentje |

Voor Golf 2 (typen-invoer, achter feature flag, niet launch-blocking): zelfde
redenering geeft `{ text: string }` (`PROTOCOL.md` §Typen) — niet nu nodig, hier
alleen genoemd voor later.

Dit is een gedocumenteerde interpretatie (categorie (c) in
[`docs/data-model-plan/README.md`](README.md) sectie 1), geen letterlijk citaat —
`DATA-MODEL.md` toont zelf maar één voorbeeld. Als iemand `DATA-MODEL.md` formeel
bijwerkt met deze tabel, is dat een kleine, niet-inhoudelijke aanvulling (transcriptie
van wat hierboven al is afgeleid), geen nieuwe `database_schema`-beslissing.

## 2. Aan `protocol-plan` — antwoord op open vraag #13 (`roundNumber`/`countdownEndsAt`)

**`totalRounds`** heeft al een bronveld en is geen open vraag: `GameConfiguration.
totalRounds` (onderdeel van `Room.config`, gepind per match). Niets aan te passen.

**`roundNumber` — voorstel, geen citaat.** `Match.roundIndex` is de enige kandidaat-
bron. Voorstel: `roundIndex` is 0-based (de naam suggereert een array-index in
`Match.roundIds`, niet een mensgericht rondenummer), dus `roundNumber = roundIndex +
1`. `DATA-MODEL.md` zegt dit niet met zoveel woorden — markeer dit als aanname totdat
bevestigd, net zoals wij bij `answers:{id}` deden.

**`countdownEndsAt` — dit is geen ontbrekend DATA-MODEL.md-veld, en dat is bewust.**
Het hoort niet thuis in `Match` of `Round`: het is een berekende, vluchtige waarde
(`serverTime + countdown-duur`; `GAME-RULES.md` §Rondestructuur: startcountdown vast
op 3s, niet instelbaar), niet iets dat wordt opgeslagen — vergelijkbaar met hoe
`Match.pausedState.remainingMs` ook een afgeleide, geen basiswaarde is.
`ARCHITECTURE.md` §2 ("Eén timeline per room") legt vast dat de server absolute tijden
plant; die berekening hoort bij de state-machine-/tijdlijnlaag van `architecture-plan`,
niet bij een persistent datamodelveld. **Voorstel: geen nieuw veld toevoegen aan
`Match`/`Round`**; `game:started`s `countdownEndsAt` wordt on-the-fly berekend door
wie de `LOBBY → COUNTDOWN`-transitie uitvoert. Graag bevestiging of weerlegging van
`architecture-plan` hierop, niet alleen van ons — dit ligt op het raakvlak.

## 3. Aan `protocol-plan` — antwoord op open vraag #14 (`game:rematch` en `Player`-reset)

**Status: beantwoordbaar uit bestaande tekst, geen open ontwerpvraag.** Twee dingen
die al vastliggen, gecombineerd, geven het antwoord:

- `GAME-FLOW.md` §Randgevallen, "12. Rematch": *"aanwezige spelers blijven in de
  lobby"*, *"scores en streaks gaan naar nul"*, *"geen nieuwe naam, scan of link
  nodig"*.
- `DATA-MODEL.md`'s `Player` heeft geen `matchId`-veld — hij is room-scoped, niet
  match-scoped. Er bestaat dus geen mechanisme voor "een nieuwe Player per match"; de
  spec laat daar geen ruimte voor.

Samen: `game:rematch` reset **dezelfde** `Player`-record in place, niet een nieuw
record. Concreet, per speler in de room:

- **Wel reset:** `score → 0`, `correctCount → 0`, `correctResponseTimeMsTotal → 0`,
  `eligibleFromRound → 1` (nieuwe match begint vers; niemand is "laat" voor ronde 1
  van de nieuwe match — dit laatste veld noemt `GAME-FLOW.md` niet expliciet bij
  rematch, maar volgt logisch uit "geen late-join-geschiedenis van een andere match").
- **Niet reset:** `connected`, `left`, `kicked`, `joinedAt`,
  `displayName`/`generatedName`/`effectiveName`/`nameSource` — dit zijn identiteits-
  en verbindingsstatus, roombreed, niet matchgebonden.

**Nog echt open, wij lossen dit niet zelf op:** telt een speler die `left: true` had
in de vórige match automatisch weer mee in de rematch-roster, of blijft die als
"verlaten" staan tot een nieuwe join? `GAME-FLOW.md` §11 gaat over vrijwillig verlaten
binnen één match, niet expliciet over het rematch-geval. Wie dit oppakt (wij, `game-
flow-plan`, of een mens): dit is de enige sub-vraag uit #14 die niet uit bestaande
tekst is af te leiden.

## 4. Informationeel — geen actie nodig

- `server/data/` bevat nu `redis-keys.js` + `ttl.js` (DM0/DM1, 66/66 tests groen).
  `actionCacheKey()` is room-scoped (`room:{roomId}:action-cache`) — relevant als
  iemand elders per ongeluk van match-scoping was uitgegaan.
- Moduleformaat: CommonJS (`.js`, `module.exports`), zelfde als `server/rules/`,
  anders dan `server/protocol/`'s ES modules (`.mjs`) — zelfde constatering als
  `game-rules-plan`'s `HANDOFF.md` §3 al maakt, hier bevestigd vanuit `server/data/`.
- Locatie `server/data/` is voorlopig, net als `server/rules/`/`server/protocol/`:
  wacht op een bindend serverskeleton-voorstel uit `architecture-plan`.

## 5. Aan `architecture-plan` — voorstel: neutrale gedeelde-constantsmodule voor `PHASES`/`PACING`

**Aanleiding:** een onafhankelijke review van onze DM2–DM9-prompts
(`docs/data-model-plan/prompts/REVIEW-DM2-DM9.md`, bevinding 10) wees terecht
een ontwerpfout aan: onze eerdere promptversies lieten `server/data/` de
fasewaarden (`LOBBY`/`COUNTDOWN`/.../`FINISHED`) en `pacing`-waarden
(`"auto"`/`"host"`) rechtstreeks importeren uit
`server/architecture/state-machine.js`. Dat is de verkeerde
afhankelijkheidsrichting: dat bestand is een gedragslaag (de `transition()`-
reducer, met eigen invarianten), geen neutrale constantsmodule, en
`server/data → server/architecture` vergroot het risico op een cirkel zodra
`architecture` ooit zelf een repository (`server/data`) gaat gebruiken —
bijvoorbeeld om `Room`/`Match`-state te laden vóór een transitie.

**Wat we in de tussentijd doen:** `server/data/types/room.js` en
`server/data/types/match.js` transcriberen de zeven fasewaarden nu **lokaal**
(twee onafhankelijke kopieën, met een cross-bestand-consistentietest die ze
tegen elkaar vergelijkt), en `server/data/types/game-configuration.js`
transcribeert `pacing`'s twee waarden eveneens lokaal. Dat voorkomt de
verkeerde dependencyrichting, maar is op zichzelf een duplicatierisico — twee
(straks drie, met `server/architecture` zelf) plekken die handmatig in sync
moeten blijven.

**Voorstel, geen besluit namens jullie module:** een vierde, neutrale locatie —
bijvoorbeeld `shared/contracts/match-phases.js` (naar analogie van het
bestaande `shared/product/`, dat al precedent is voor een gedeelde,
niet-server-specifieke map) — die alleen de bevroren waardenlijsten exporteert
(`PHASES`, `PACING`, geen `transition()`-logica). Zowel
`server/architecture/state-machine.js` als `server/data/` zouden daaruit
importeren; geen van beide zou dan nog de ander importeren. Dit raakt jullie
bestand net zo goed als het onze, dus wij voeren dit niet eenzijdig door — als
jullie akkoord zijn met de locatie/vorm, passen wij onze kant aan (kleine,
geïsoleerde wijziging: een import i.p.v. een lokale lijst) zodra die module
bestaat.

Geen actie vereist vóór jullie kant er klaar voor is — onze lokale kopieën
werken intussen prima, ze zijn alleen niet de eindtoestand.

## 6. Aan `integration-plan` (INT-A + INT-B) — INT-1, INTB-1, INTB-2, INTB-3 beantwoord

Alle vier zijn uitgevoerd via
[`prompts/DM10-room-locator-claim.md`](prompts/DM10-room-locator-claim.md),
[`prompts/DM11-room-scoped-round-answer.md`](prompts/DM11-room-scoped-round-answer.md)
en [`prompts/DM12-scoreboard-room-scoping.md`](prompts/DM12-scoreboard-room-scoping.md)
— alle drie herzien na een eigen reviewronde vóórdat er iets werd gebouwd; zie
die bestanden voor de volledige motivatie. Hieronder alleen wat er concreet
veranderd is in `server/data/repository.js`/`in-memory-store.js`.

**INT-1 + INTB-2 (join-code + inviteHash-claim).** Nieuw:
`claimRoomLocatorsAtomically({ roomId, code, inviteHash, ttlSeconds }) → {
ok: true } | { ok: false, conflict: 'code' | 'inviteHash' }`,
`releaseRoomLocators({ roomId, code, inviteHash })` (alles-of-niets, **niet**
`releaseRoomLocators(roomId)` zoals INT-1 voorstelde — reden staat in
DM10) en `refreshRoomLocators({ roomId, code, inviteHash, ttlSeconds })`
(legt het TTL-eigendomscontract vast, simuleert geen echte TTL-aftelling).
`room-codes.js` is ongewijzigd, zoals INT-1 al voorspelde. Dit **unblocks** de
atomaire Redis-implementatie — het bewijst zelf geen Redis-atomiciteit, dat
blijft een (b)-ADR-uitvoeringsdetail van de echte adapter.

**Bijvangst, niet apart gevraagd maar nodig om INT-1/INTB-2 consistent te
maken:** `loadRoomByInviteId(inviteId)` is hernoemd naar
`loadRoomByInviteHash(inviteHash)` — de oude methode werkte op de platte
`inviteId`, terwijl de nieuwe claim op `inviteHash` werkt; twee identifiers
voor hetzelfde concept naast elkaar zou de net-opgeloste inconsistentie via
de achterdeur terugbrengen. Hashen gebeurt vóór de repository
(`hashInviteId()` uit `server/architecture/room-codes.js`). **Gevolg voor
arrangement:** `saveRoom` vult de `inviteHash`-index niet meer (kan niet, Room
draagt geen hash) — alleen `claimRoomLocatorsAtomically` doet dat. Een test die
`loadRoomByInviteHash` wil arrangeren moet dus eerst claimen, niet alleen
`saveRoom` aanroepen.

**INTB-1 (room-scoping op Round/Answer).** Signaturen verbreed, **geen**
nieuwe velden op `Round`/`Answer` (richting 1, niet richting 2 — DM11 legt uit
waarom, kort: een gedupliceerde relatie zonder integriteitscheck tegen het
echte brondocument is een nieuwe inconsistentiebron):

```
saveRound(roomId, round)
loadAnswer(roomId, matchId, roundId, playerId)
loadActionCacheEntry(roomId, actionId)
```

`saveRound`'s matchintegriteitscontrole (RangeError bij een onbekende/
verkeerde-room-match) is behouden, nu een directe geneste lookup i.p.v. de
oude lineaire scan. `answer-flow.js` is ongewijzigd.

**INTB-3 (scoreboard-scoping).** Gekozen: op beide keyen (niet aannemen dat
`matchId` globaal uniek is). De fake gebruikt nu geneste Maps op
`(roomId, matchId)`.

**Impact op `server/data/adapters/data-store-conformance.mjs` (jullie
bestand — ik heb het niet zelf gewijzigd).** Draaide de suite vóór dit
antwoord: 45/45 groen (INTB-1-blok geskipt). Erna: 19 tests rood, allemaal
verwacht en al door jullie eigen commentaar geannoteerd:

- het `Room`-blok (7 tests) roept nog `loadRoomByInviteId` aan — dit is niet
  alleen een rename: de arrangement moet eerst claimen (zie hierboven), niet
  alleen `saveRoom` aanroepen;
- het `Round (leeskant)`-blok (6 tests) en de INTB-4-hulpfuncties (regel
  265/269) roepen `saveRound`/`loadAnswer`/`loadActionCacheEntry` nog met de
  oude signatuur aan — precies wat jullie eigen commentaar bij het
  `describe.skip`-blok al aankondigde ("verandert alleen de
  arrangement-regel");
- het `describe.skip('INTB-1 — …')`-blok zelf hoeft **niet herschreven** te
  worden — de testbodies daarin zijn al tegen exact de bovenstaande
  signaturen geschreven en zouden nu moeten slagen; alleen `.skip` weghalen
  en de wachtnoot schrappen;
- de karakterisatietest "twee rooms die hetzelfde match-id gebruiken delen
  één ranglijst" klopt niet meer — dat gedrag is met opzet veranderd
  (INTB-3);
- de drie **INTB-4**-tests waren al rood vóór dit antwoord (bevestigd: die
  falen op het ontbreken van een dubbel-check in
  `saveAcceptedAnswerAtomically`, iets wat DM10/11/12 niet aanraakt) — dat
  blijft zo. **INTB-4 is gezien, maar bewust niet in deze ronde opgepakt**:
  het is een structurele vraag over of idempotentie/"één antwoord per ronde"
  ín de atomaire operatie moet zitten (jullie punt: een check in
  `answer-flow.js` dekt concurrency niet af) en verdient een eigen
  voorstelronde, net als DM10/11/12 die hadden — geen drive-by-fix naast dit
  antwoord. Voorgesteld als kandidaat-volgende-fase (`DM13`), nog niet
  geschreven.

## 7a. Aan `integration-plan` (INT-B) — INTB-4 beantwoord

[`prompts/DM13-answer-idempotency-in-atomic-write.md`](prompts/DM13-answer-idempotency-in-atomic-write.md),
gebouwd. `saveAcceptedAnswerAtomically` controleert nu, ín de atomaire
operatie en vóór elke write:

1. Idempotentie eerst: `write.actionCacheEntry.actionId` al in de
   action-cache van deze room → **resolve zonder te muteren** (geen ack in de
   returnwaarde — gebruik `loadActionCacheEntry` als je hem nodig hebt).
2. Dan pas de bestaande playerId-check (ongewijzigd).
3. Dan "al beantwoord": een ANDERE `actionId` voor een al-beantwoorde
   `roundId`+`playerId` → **`RangeError` met `.code === 'ALREADY_ANSWERED'`**
   (zelfde codestring als `resolveAnswer`'s eigen returncode).

Signatuur/returntype ongewijzigd (`Promise<void>`). `answer-flow.js` is
functioneel ongewijzigd; zijn eigen stap 1/5-checks zijn nu expliciet
gedocumenteerd als snelpad, niet als bron van waarheid — **een aanroeper moet
een `ALREADY_ANSWERED`-worp van `saveAcceptedAnswerAtomically` afvangen en
naar dezelfde protocolrespons vertalen, ook wanneer `resolveAnswer` zelf al
`ok:true, replay:false` teruggaf** (dat is precies het race-scenario dat deze
fase dichtzet).

Geverifieerd tegen jullie eigen suite: vóór deze fase 77/80 groen (3 bewust
rode `INTB-4`-tests); erna 80/80 groen, **zonder dat een testbody in
`data-store-conformance.mjs` is aangeraakt** — dat bestand blijft van jullie.

## 7b. Poort-bevroren vanaf nu — governance-notitie

**Instructie ontvangen (regie), geldig vanaf nu:** de poort (`repository.js`'s
`DataStore`-contract) is twee keer op één dag gewijzigd (DM10–DM12, DM13)
terwijl zowel INT-A als INT-B er live tegenaan bouwen. **Vanaf nu bevroren:**
elke volgende wijziging aan de poort — nieuwe methode, gewijzigde signatuur,
gewijzigd foutcontract van een bestaande methode — gaat eerst als een
HANDOFF-voorstel naar zowel INT-A als INT-B, met hun akkoord, vóórdat er iets
geïmplementeerd wordt. Geen drive-by-uitbreidingen meer, ook niet als de
motivatie sterk is (zoals bij DM13's ontdekking tijdens de bouw van DM10–12).

**Conformance-dekking geverifieerd (op verzoek):** alle 21 methoden in
`DATA_STORE_METHOD_NAMES` — inclusief alle DM10–DM12-toevoegingen
(`claimRoomLocatorsAtomically`, `releaseRoomLocators`, `refreshRoomLocators`,
`loadRoomByInviteHash`, de room-gescoped `saveRound`/`loadAnswer`/
`loadActionCacheEntry`) — komen voor in
`server/data/adapters/data-store-conformance.mjs` en worden daar daadwerkelijk
uitgevoerd (geen `.skip` meer over). 80/80 tests groen na DM13. Geen
dekkingsgat gevonden op het moment van dit antwoord.

**Nieuw gesignaleerd, NIET opgepakt (conform de bevriezing hierboven).** Een
volledige doorloop van beide HANDOFF-bestanden (2 augustus 2026, ná DM13) laat
zien dat er meer aan DM gericht is dan alleen INTB-4/INTB-6 — hieronder de
volledige inventaris, niets van gebouwd:

- **INTB-5 🔴 (hoog — securitygevolg, geen hygiëne):** een geroteerde
  uitnodiging blijft geldig. Dit is de enige 🔴 in de hele inventaris en
  verdient waarschijnlijk voorrang zodra het voorstelproces loopt.
- **INT-3 (aan DM, blokkeert INT-A stap 2):** de poort kan een bearer token
  niet naar een sessie herleiden.
- **INT-6 (aan DM) + INTB-7 (aan DM) — vermoedelijk hetzelfde punt vanuit twee
  kanten, zoals INT-1/INTB-2 dat waren:** beide gaan over
  `loadRoomByInviteId`/hash. **Let op:** INTB-7's tekst is inmiddels stale —
  hij beschrijft nog de situatie van vóór DM10 (`loadRoomByInviteId(inviteId)`,
  ruwe waarde) en stelt voor dat de ADAPTER intern hasht. DM10 koos het
  omgekeerde (de aanroeper hasht, de poort ziet nooit de rauwe capability) en
  INT-B's eigen conformance-suite bouwt daar al tegenaan
  (`loadRoomByInviteHash`). Dit moet worden rechtgetrokken zodra het
  voorstelproces INT-6/INTB-7 oppakt, anders spreken de twee HANDOFF-bestanden
  elkaar tegen.
- **INT-7 (aan DM):** geen conditionele of partiële write op de poort.
- **INT-9 (aan DM):** tegenstrijdige `deadlineGraceMs`.
- ~~**INTB-8** (aan DM + eigenaar `tests/fixtures/`): gedeelde testfixtures
  produceren ongeldige documenten.~~ ✅ opgelost door de DT-agent (2026-08-02).
- **INT-4 (cc DM, primair CT):** contentcontract mist
  `validOptionIds`/`resultDetails`. Niet blokkerend, niet primair mijn item.

Al deze items volgen vanaf nu het nieuwe proces (HANDOFF-voorstel eerst,
akkoord van INT-A én INT-B, dan pas implementatie) — ook INT-3 en INTB-5,
ondanks hun urgentie/severity-markering.

## 8. Audit — volledige DM-inventaris na de poort-bevriezing, afgestempeld

Op instructie: elk aan DM gericht item uit `HANDOFF.md` (INT-A) en
`HANDOFF-INTB.md` (INT-B) hieronder geverifieerd tegen de daadwerkelijke
huidige code — niet tegen wat een statustabel beweert. **INTB-5 en
INT-6/INTB-7 eerst**, want daar spraken de twee HANDOFF-bestanden elkaar
aantoonbaar tegen.

### INTB-5 🔴 — geverifieerd: nog steeds ECHT OPEN, INT-B's eigen tabel is fout

INT-B's `HANDOFF-INTB.md`-tabel zegt "✅ `releaseRoomLocators`, nu
contracttest". Dat klopt niet: `releaseRoomLocators` **bestaat**, maar niets
roept hem aan wanneer een room van code/invite wisselt — `saveRoom` doet dat
zeker niet, die schrijft alleen bij, nooit weg. Zelf gereproduceerd tegen de
huidige `in-memory-store.js`:

```
saveRoom({ id: room_1, code: 111111, inviteId: INV-AAA })
saveRoom({ id: room_1, code: 222222, inviteId: INV-BBB })   // "rotatie"

loadRoomByCode('111111') -> room met code 222222   -- BUG, nog steeds zo
loadRoomByCode('222222') -> room met code 222222
```

De precieze karakterisatietest die dit al vastlegt in
`data-store-conformance.mjs` ("na een hercodering... blijft de OUDE
join-code... wijzen") staat dus nog terecht zoals hij is — die zou pas moeten
omdraaien ná een echte fix, niet ervoor. INT-B's statustabel loopt hier voor
op de werkelijkheid. **Voorstel voor de fix staat in §9 hieronder.**

### INT-6 (INT-A)/INTB-7 (INT-B) — hetzelfde punt vanuit twee kanten, status uit elkaar

- **INTB-7 (INT-B):** tabel zegt "✅ poort neemt de hash" — dat **klopt** met
  de werkelijkheid (`loadRoomByInviteHash(inviteHash)`, DM10). Maar de
  gedetailleerde tekst ónder die kop in hetzelfde bestand is stale: die stelt
  nog voor dat de poort het RUWE `inviteId` aanneemt en de adapter intern
  hasht — het omgekeerde van wat gebouwd is. Wie alleen die sectie leest
  zonder de tabel erboven, krijgt het verkeerde beeld. **INT-B: overweeg die
  detailtekst te vervangen door een korte "zie tabel, opgelost via
  `loadRoomByInviteHash`"-notitie, anders spreekt het bestand zichzelf tegen.**
- **INT-6 (INT-A):** tabel zegt nog "🔵 open — krijgt de rauwe `inviteId` in
  plaats van de hash". Dat is stale: sinds DM10 is dat niet meer zo. **INT-A:
  dit mag naar ✅ — `loadRoomByInviteHash(inviteHash)` bestaat, de poort ziet
  nooit de rauwe capability, hashen gebeurt vóór de aanroep met
  `hashInviteId()`.**

Conclusie: **inhoudelijk opgelost aan mijn kant, twee statustabellen moeten nog
worden bijgewerkt** — geen actie van mij nodig behalve deze melding.

### Rest van de inventaris, kort afgestempeld

| Item | Aan | Status hier geverifieerd |
| --- | --- | --- |
| INTB-1 | DM | ✅ opgelost (DM11) — tabel klopt |
| INTB-2 | DM+AR | ✅ opgelost (DM10) — tabel klopt |
| INTB-3 | DM | ✅ opgelost (DM12) — tabel klopt |
| INTB-4 | DM | ✅ opgelost (DM13) — **INT-B's tabel is stale** (zegt nog "🔵 open, 3 tests rood"); geverifieerd 80/80 groen, inclusief die drie |
| INTB-5 | DM | 🔴 **echt open** — zie hierboven, voorstel in §9 |
| INTB-6 | DM+GR | 🔵 **wacht extern, geadresseerd bij GR** — tiebreak-eigenaarschap is een echte GR-vraag, niet iets ik alleen kan beslissen |
| INTB-7 | DM | ✅ inhoudelijk opgelost, detailtekst stale — zie hierboven |
| INTB-8 | DM+fixtures-eigenaar | ✅ **opgelost door de DT-agent** (2026-08-02) — zie `HANDOFF-INTB.md` |
| INT-3 | DM | 🔵 open, terecht, blokkeert INT-A stap 2 — voorstel in §10 |
| INT-6 | DM | ✅ inhoudelijk opgelost, **INT-A's tabel is stale** — zie hierboven |
| INT-7 | DM | 🔵 open, terecht — geen conditionele/partiële write op de poort. Nog niet als voorstel uitgewerkt (niet in de prioriteitsvolgorde van dit antwoord); INT-A's eigen stopgap (`touchRoom()`/`setRoomLocked()` geïsoleerd) houdt het risico binnen één proces intussen klein |
| INT-9 | DM | 🔵 open, terecht — geen poortwijziging, een documentatie-eenduidigheid. Voorstel aan spec-redactie in §11 |
| INT-4 | cc DM | 🔵 open, primair CT — geen actie hier |

**Terugkoppeling na productbeoordeling van deze audit:** INT-6/INTB-7's
statustabellen corrigeren is al bij INT-A/INT-B belegd — deze audit is de
onderbouwing daarvan, geen apart verzoek nodig. **Verwacht van INT-A nog een
klein HANDOFF-item: een versieprefix-op-`inviteHash`-voorstel** (dezelfde
versioneringslijn als de tokens, besluit 26) — behandel dat als regulier
HANDOFF-item zodra het binnenkomt, geen speciale voorrang.

## 12. Aan `integration-plan` — INT-14 beantwoord: `saveAcceptedAnswerAtomically` geeft nu `{ replay: boolean }` terug

**Gebouwd (DM15).** Signatuur ongewijzigd (`(roomId, matchId, write)`),
returntype van `Promise<void>` naar `Promise<{ replay: boolean }>`:

- idempotentie-tak (bekende `actionId`) → `{ replay: true }`, geen mutatie,
  nog steeds geen ack in de returnwaarde (gebruik `loadActionCacheEntry` als
  je die nodig hebt);
- geslaagde nieuwe write → `{ replay: false }`;
- `ALREADY_ANSWERED`/onbekende `playerId` blijven excepties, ongewijzigd.

Dit is precies het contract uit jullie voorstel. **INT-B: dit is de
returnwaarde waar het Lua-script tegen moet bewijzen** — dezelfde suite die
`server/data/in-memory-store.js` dekt, dekt straks de adapter. Geen ack in de
replay-tak, zoals al bij DM13 vastgelegd — als daar bezwaar tegen is, graag nu
en niet ná het Lua-script.

## 9. GEBOUWD (was: formeel voorstel, akkoord product owner) — INTB-5: `rotateRoomLocators`

**Gebouwd (DM16).** Zie de vorige versie van deze sectie voor de volledige
motivatie (fail-safe bij conflict, eigendomscontrole, cluster-onafhankelijk).
Zelf gereproduceerd met het letterlijke INTB-5-scenario ná de fix — de oude
code/inviteHash wijzen nergens meer naartoe (`repository.test.js` #57-58).

**Afgesproken bouwvolgorde: §10 eerst (deblokkeert INT-A stap 2), toen INT-14
(raakte INT-B's Lua-werk), toen dit item — precies zo uitgevoerd, in die
volgorde, vóór er iets via de tunnel bereikbaar is.**

### Wat er moet kunnen

Een room die van join-code en/of invite wisselt (`ARCHITECTURE.md`
§inviteId: "direct intrekbaar of roteerbaar") moet de OUDE locators meteen
laten stoppen met werken, niet pas bij TTL-verval. Vandaag kan dat niet:
`saveRoom` overschrijft alleen het documentveld, de lookup-indexen
(`roomIdByCode`, `roomIdByInviteHash`) houden de oude waarde vast.

### Waarom niet gewoon `releaseRoomLocators` + `claimRoomLocatorsAtomically` na elkaar

Dat zou het bestaande gat alleen versmallen, niet dichten: als de release
lukt maar de claim van de nieuwe locators faalt (of andersom), is de room
tijdelijk óf via geen enkele code bereikbaar, óf blijft de oude code toch
geldig — bij "direct intrekbaar" is dat laatste zelfs de ergere uitkomst.
Twee losse aanroepen zijn hier niet goed genoeg; dit moet net zo atomair als
de oorspronkelijke claim uit INT-1.

### Voorstel

```js
rotateRoomLocators({ roomId, oldCode, oldInviteHash, newCode, newInviteHash, ttlSeconds })
  → { ok: true }
  | { ok: false, conflict: 'code' | 'inviteHash' }
```

1. **Atomair.** Oude locators vrijgeven én nieuwe claimen gebeurt in één stap,
   of geen van beide gebeurt.
2. **Eigendomscontrole eerst.** `oldCode`/`oldInviteHash` moeten op dit moment
   door `roomId` bezet zijn — zo niet, werpt de operatie (programmeerfout van
   de aanroeper, geen normale uitkomst; zelfde stijl als
   `refreshRoomLocators`).
3. **Conflict is een veilige no-op, geen halve overgang.** Is `newCode` of
   `newInviteHash` al door een ANDERE `roomId` bezet, dan gebeurt er niets:
   `{ ok: false, conflict }`, de OUDE locators blijven gewoon geldig. Dat is
   bewust de veilige kant kiezen — een room die tijdelijk via geen enkele code
   bereikbaar is, is erger dan een rotatie die nog niet gelukt is.
4. **`saveRoom` blijft ongewijzigd.** Volgorde: eerst `rotateRoomLocators`
   (atomaire indexwissel), dan pas `saveRoom` met het bijgewerkte
   `code`/`inviteId` op het document — zelfde patroon als de bestaande
   creatieflow (eerst claimen, dan pas opslaan).
5. **Bekende, geaccepteerde restrisico** (zelfde klasse als de oorspronkelijke
   "claim slaagt, roomcreatie faalt"-situatie uit INT-1/DM10): als
   `rotateRoomLocators` slaagt maar de daaropvolgende `saveRoom` crasht vóór
   hij landt, wijst de index al naar de nieuwe locators terwijl het
   Room-document nog de oude `code`/`inviteId` draagt. Dit is een crash-only
   venster, geen normale foutafhandeling — net als het bestaande, geaccepteerde
   gat tussen claim en `saveRoom` bij roomcreatie. Niet hier opgelost, wel
   benoemd.

**Open vraag voor INT-A/INT-B:** is er al een productfunctie ("nieuwe
uitnodigingslink genereren") die dit daadwerkelijk gaat aanroepen, of is dit
puur het dichten van het contractgat dat `ARCHITECTURE.md` eist zonder dat er
nu al een aanroeper is? Dat bepaalt of dit voorstel meteen bruikbaar is of
voorlopig alleen het contract vastlegt (zoals `refreshRoomLocators` dat nu
ook al doet voor TTL).

## 10. GEBOUWD (was: formeel voorstel, akkoord product owner) — INT-3: `loadSessionByTokenHash`

**Gebouwd (DM14), als eerste van de drie — deblokkeert INT-A stap 2.** Index
op `tokenHash` rechtstreeks door `saveSession` gevuld (geen chicken-and-egg
zoals bij `inviteHash`, `Session.tokenHash` staat al op het document sinds
DM2a). Herroepen sessies blijven vindbaar — de aanroeper onderscheidt
`TOKEN_INVALID` van `SESSION_REVOKED` zelf, zoals bij `loadSession` al het
geval was.

Aan: INT-A. Blokkeerde INT-A stap 2 (echt transport).

### Wat er moet kunnen

`PROTOCOL.md` stuurt alleen `Authorization: Bearer <sessionToken>`. Zodra er
echt transport is, komt er dus een request binnen met alleen een token, geen
`roomId`/`sessionId`. De poort heeft alleen `loadSession(roomId, sessionId)`
— geen weg van token naar sessie.

### Voorstel

```js
loadSessionByTokenHash(tokenHash) → Promise<Session | null>
```

- **Index op de hash, nooit op het rauwe token** — conform besluit 26, zelfde
  discipline als `loadRoomByInviteHash`. Deze poort ziet het rauwe
  `sessionToken` nooit; de aanroeper hasht vóór de aanroep.
- **Geen aparte claim/atomiciteit nodig, in tegenstelling tot INTB-5.**
  `Session.tokenHash` staat al ÓP het Session-document (`types/session.js`,
  DM2a) — geen chicken-and-egg-probleem zoals bij `inviteHash` (die niet op
  `Room` staat). `saveSession` kan de index dus gewoon rechtstreeks vullen,
  net zoals `saveRoom` dat al voor `roomIdByCode` doet. Geen nieuwe
  atomaire operatie, alleen een nieuwe leesindex.
- **Herroepen sessies blijven vindbaar.** De index wordt niet leeggemaakt bij
  `session.revoked = true` — de aanroeper laadt de sessie en controleert
  `.revoked` zelf, exact zoals `loadSession(roomId, sessionId)` dat vandaag al
  laat doen (zie `answer-flow.js`'s `SESSION_REVOKED`-pad). Zonder dit zou de
  aanroeper "token onbekend" en "token bekend maar herroepen" niet meer uit
  elkaar kunnen houden.
- **Botsingen:** tokens zijn 32 random bytes (besluit 26); een botsende hash
  tussen twee sessies is geen praktisch scenario, geen speciale afhandeling
  nodig.

## 11. INGEDIEND bij spec-redactie (SR) — akkoord product owner — INT-9: `deadlineGraceMs` eenduidig maken

**Akkoord, ingediend.** Buiten de bevriezing van §7b — geen poortwijziging,
alleen een documentatiecorrectie in `DATA-MODEL.md`, dus geen INT-A/INT-B-
akkoord nodig. `docs/data-model-plan/` heeft geen directe verbinding met
`docs/spec-redactie/` — dit bestand is, net als bij elk ander plan, het
kanaal ernaartoe.

Eén regel, geen poortwijziging: `DATA-MODEL.md`'s
`GameConfiguration`-voorbeeld toont `"deadlineGraceMs": 150`, terwijl
`DECISIONS.md` besluit 13 bindend 250 ms als MAXIMUM vastlegt.
`QUICK_START_CONFIG` gebruikt daarom al 250 — `DECISIONS.md` wint, dat is niet
in het geding. Het enige dat ontbreekt is dat `DATA-MODEL.md`'s voorbeeld dat
niet weerspiegelt.

**Voorstel voor SR, letterlijk over te nemen:** vervang in `DATA-MODEL.md`'s
`GameConfiguration`-voorbeeld `"deadlineGraceMs": 150` door een waarde ≤ 250
(bijv. `150` blijft geldig als voorbeeld van een lagere configwaarde, of
`250` als voorbeeld van het maximum) mét een korte toelichting dat 250 ms het
bindende maximum is (besluit 13) en dat elke waarde eronder een geldige
configuratiekeuze is — niet dat 150 zelf de norm is.

## 7. Klein, buiten scope van DM10/11/12 — OPGELOST in DM18

`sessionsByKey`/`playersByKey` in `in-memory-store.js` gebruikten nog steeds
`` `${roomId} ${playerId}` ``-samengestelde string-sleutels, dezelfde klasse
kwetsbaarheid (in theorie, geen praktijkincident) die DM11/DM12 net voor
`matches`/`rounds`/`answers`/`actionCache`/`scoreboard` hadden opgelost.
**Alsnog meegenomen (DM18)** — geen poortsignatuur-wijziging, dus buiten de
bevriezing van §7b: beide zijn nu geneste Maps, met een collision-bewijstest
per entiteit (`repository.test.js` #64-65). `playerIdsByRoom` is daarmee
komen te vervallen — `playersByKey.get(roomId)`'s sleutels zíjn nu de
spelers-ids, dus die aparte Set was overbodig geworden.

## 13. FORMEEL VOORSTEL — wacht op akkoord INT-A + INT-B (poort-bevroren, §7b) — INTB-9, INTB-5 (heropend), INTB-10

**Capability-principe, vanaf nu de toets voor deze en elke volgende
poortwijziging:** élke capability (join-code, inviteHash, sessietoken, …)
heeft precies één atomair schrijfpad en één atomair intrekpad. Een lookup die
een ingetrokken capability nog vindt is een bug, geen randgeval. Drie
bevindingen hieronder zijn stuk voor stuk een schending van dat principe —
geen van drie is al geïmplementeerd, alleen `sessionTokenLookupKey` (puur
additief, zie hieronder) staat al in `redis-keys.js`.

### INTB-9 — `saveRoom` raakt de code-index niet meer aan

**Akkoord met INT-B's analyse en voorstel, ongewijzigd overnemen.** `saveRoom`
schrijft vandaag nog onvoorwaardelijk naar `roomIdByCode` — een tweede,
ongecontroleerde weg naar dezelfde index als `claimRoomLocatorsAtomically`,
die de hele claim-garantie omzeilt. Voor de inviteHash-kant bestaat dit gat
al niet (`Room` draagt geen hash, dus `saveRoom` kán daar nooit bij), en dat
is precies waarom de code-kant nu de uitzondering — en het gat — is.

**Voorstel:** `saveRoom` verwijdert de regel die `roomIdByCode` zet.
Locatorbeheer loopt voortaan uitsluitend via
`claimRoomLocatorsAtomically`/`releaseRoomLocators`/`refreshRoomLocators`/
(mogelijk) `rotateRoomLocators` — zie hieronder voor die laatste.

**Blast radius, zelf nagerekend:** 8 plekken in `repository.test.js` roepen
`saveRoom(makeRoom(...))` aan zonder eerst te claimen — die moeten allemaal
eerst `claimRoomLocatorsAtomically` aanroepen. Geen productiecode geraakt
(die bestond nog niet), wel een noemenswaardige testherschrijving. INT-B
noemt terecht dat de conformance-suite hetzelfde meemaakt.

### INTB-5 (heropend) — `claimRoomLocatorsAtomically` laat oude locators van dezelfde room niet los

**Bevestigd, zelf nagerekend met INT-B's reproductie** (twee keer claimen voor
dezelfde `roomId` met verschillende code/inviteHash laat de eerste gewoon
staan — mijn eigen DM10-test #33 testte dit pad al, maar beoordeelde het als
gewenst "retry"-gedrag zonder te zien dat hetzelfde pad een AL-werkende room
een tweede, blijvend geldige capability geeft).

**Ik kies INT-B's richting 1, met een concrete invulling, niet richting 2:**
`claimRoomLocatorsAtomically` geeft in dezelfde atomaire stap de vorige
locators van hetzelfde `roomId` vrij vóór het de nieuwe claimt. Een room heeft
per definitie precies één code en één inviteHash — er is geen legitiem geval
waarin er twee tegelijk geldig zijn, dus "vorige altijd vrijgeven" kan nooit
iets kapotmaken dat hoort te blijven bestaan.

**Implementatie-consequentie: er komt een reverse index bij**
(`locatorsByRoomId: Map<roomId, {code, inviteHash}>`), bijgehouden door
claim/release, want de huidige Maps zijn alleen voorwaarts (`code`/`inviteHash`
→ `roomId`) en een "wat heeft deze room nu" zonder scan is met alleen die
Maps niet te beantwoorden. Zonder deze index zou "vorige vrijgeven" zelf weer
een scan worden — precies de klasse fout die INTB-1 al wegnam.

**Aanbeveling: `rotateRoomLocators` (DM16) vervalt als apart contract.**
Onder deze herziene `claimRoomLocatorsAtomically` is rotatie niet meer iets
aparts — een tweede claim voor een bestaande room DOET nu automatisch wat
`rotateRoomLocators` deed. Twee methoden die allebei naar dezelfde index
kunnen schrijven met overlappend doel is zelf weer een schending van het
capability-principe hierboven ("één schrijfpad"). `rotateRoomLocators` is
deze sessie pas gebouwd; er is voor zover bekend nog geen aanroeper in de
compositielaag, dus de kosten van intrekken zijn nu laag. **INT-A: graag
bevestigen dat er nog niets tegen `rotateRoomLocators` bouwt** vóór dit wordt
doorgevoerd.

**Wat dit voor mijn eigen tests betekent (nog niet uitgevoerd, alleen
opgemerkt):** test #33 (herclaim met nieuwe inviteHash) moet een assertie
erbij krijgen dat de oude inviteHash na de herclaim vrij is — vandaag bewijst
hij alleen dat de nieuwe claim slaagt. De hele `rotateRoomLocators`-testset
(#51-58) zou vervallen of herschreven worden tegen de herziene `claim`.

### INTB-10 — `loadSessionByTokenHash`, de rest van het contract

**Sleutelbouwer al toegevoegd (veilig, puur additief, geen bestaand gedrag
geraakt):** `sessionTokenLookupKey(tokenHash)` → `'session:token:{tokenHash}'`
staat in `redis-keys.js` — globaal, niet room-scoped, om dezelfde reden als
`roomCodeLookupKey`/`roomInviteLookupKey`: een bearer token komt binnen zonder
`roomId`, dat *is* het probleem dat deze index oplost. (INT-B heeft
onafhankelijk, en compatibel, eigen tests voor deze builder toegevoegd in
`redis-keys.test.js` — samen 67/67 groen, geen conflict.)

**Twee stukken nog niet geïmplementeerd, wacht op gezamenlijk ontwerp:**

1. **Rotatiegedrag (punt 4 uit INTB-10, hetzelfde patroon als INTB-5).**
   Voorstel: `saveSession` leest de al-opgeslagen sessie voor het
   overschrijven; wijkt `tokenHash` af van de nieuwe waarde, dan wordt de OUDE
   `tokenHash`-index-entry verwijderd vóór de nieuwe wordt gezet — in dezelfde
   synchrone stap. Dit heeft **geen** nieuwe reverse index nodig (in
   tegenstelling tot de locators): `sessionsByKey` bevat de vorige sessie al
   op dezelfde sleutel, dus de oude `tokenHash` is direct af te lezen zonder
   scan. Kleinere ingreep dan INTB-5's fix, zelfde principe.
2. **TTL-koppeling.** Sessies zijn room-scoped (`roomSessionsKey(roomId)`),
   dus de `tokenHash`-index hoort dezelfde TTL te volgen als de room
   (`ROOM_TTL_SECONDS`). Voorstel: net als `refreshRoomLocators` (DM10) blijft
   dit voorlopig **contract-only** — de fake simuleert sowieso geen
   TTL-aftelling, en de bredere refreshmatrix is al een apart, uitgesteld
   punt (`ttl.js`, `REVIEW.md` bevinding 3). Geen nieuwe methode nu, wel de
   uitspraak vastgelegd zodat een latere refreshmatrix dit meeneemt in plaats
   van vergeet.
3. **`DATA-MODEL.md` §Redis-sleutels.** Dit document wijzig ik niet zelf
   (`docs/data-model-plan/README.md`'s eigen uitgangspunt 2: "dit document
   wijzigt de specificatie niet"). Voorgestelde regel voor wie dat wel mag:
   `session:token:{tokenHash} → { roomId, sessionId }` naast de bestaande
   `room:code:{code}`/`room:invite:{inviteHash}`-regels.

**Niets van dit hoofdstuk is geïmplementeerd behalve de sleutelbouwer.** Alle
drie wachten op jullie technisch akkoord — met name INT-A's bevestiging over
`rotateRoomLocators`-aanroepers voordat die vervalt.

## 14. Reactie op INT-B's `BESLUIT-INTB-locators-en-sessieindex.md` — Deel A en Deel B akkoord, gebouwd (DM17)

**Akkoord op beide delen, ongewijzigd t.o.v. INT-B's voorstel. Gebouwd,
499/499 tests groen.** Dit vervangt/vult §13's INTB-9- en
INTB-10-rotatieparagrafen aan met wat er nu daadwerkelijk staat.

### Deel A — `saveRoom` raakt de lookup-indexen nooit meer aan

Akkoord, één-op-één doorgevoerd: `saveRoom` schrijft alleen nog het
roomdocument. `claimRoomLocatorsAtomically`, `rotateRoomLocators` en
`releaseRoomLocators` blijven de drie schrijvers — **ik trek mijn eerdere
aanbeveling in §13 om `rotateRoomLocators` in te trekken hierbij in.** INT-B's
framing (claim/rotate/release als drie losse levenscyclusgebeurtenissen — een
speler heeft alleen een schoner beeld nodig van "welke methode hoort bij
welk moment" dan van "één methode die alles kan") overtuigt me meer dan mijn
eigen "één schrijfpad, dus samenvoegen"-redenering. Zie de toets aan het
capability-principe hieronder voor waarom dit toch klopt.

`repository.test.js` #11/#12 (loadRoomByCode/loadRoomByInviteHash) claimen nu
eerst — precies de 8 plekken die ik in §13 al aankondigde, plus twee nieuwe
tests (#59-60) die het letterlijke INTB-9-scenario reproduceren tegen de
GEFIXTE fake (het claimregister wint, `saveRoom` kan niets meer stelen).

**Aan INT-A:** roomcreatie is nu hard tweefasig — eerst
`claimRoomLocatorsAtomically`, dan pas `saveRoom`. Zonder de claim eerst is de
room via geen enkele code/inviteHash vindbaar (`loadRoom(roomId)` werkt nog
wel). Dit moet expliciet in de compositielaag staan.

### Deel B — `loadSessionByTokenHash`, sleutelontwerp en rotatie

Akkoord op alle vier punten:

1. Signatuur blijft `loadSessionByTokenHash(tokenHash)`, geen `roomId` —
   INT-B's redenering (de lookup ís hoe de server de room leert kennen, een
   `roomId`-parameter zou circulair zijn) is overtuigender dan wat ik er zelf
   over had opgeschreven; ik had de vraag niet scherp genoeg gesteld.
2. `sessionTokenLookupKey(tokenHash)` staat al in `redis-keys.js` (vorige
   ronde, puur additief).
3. **TTL: contract vastgelegd zoals voorgesteld — géén touch-on-read.**
   `loadSessionByTokenHash` muteert niets (was al zo). De daadwerkelijke
   room-brede refresh die tokenHashes uit `roomSessionsKey(roomId)` leest, is
   INT-B's adapterwerk — hier alleen bevestigd dat de fake er niet tegenin
   gaat.
4. **Rotatie: gebouwd.** `saveSession` geeft nu de vorige `tokenHash`-index-
   entry vrij in dezelfde synchrone stap als de nieuwe wordt gezet, zodra
   `tokenHash` verandert t.o.v. de al-opgeslagen sessie — geen nieuwe reverse
   index nodig, `sessionsByKey` draagt de vorige sessie al. Drie nieuwe tests
   (#61-63): oude token onvindbaar na rotatie, ongewijzigde token blijft
   werken (geen onnodige vrijgave), en de eerste save van een sessie crasht
   niet (geen "vorige" om vrij te geven).

**Nog open, niet mijn bestand:** `DATA-MODEL.md` §Redis-sleutels mist nog de
`session:token:{tokenHash}`-regel — ik wijzig dat document niet zelf (zie
§11's precedent, spec-redactie-terrein).

### Toets aan het capability-principe (voorgelegd als besluit #37)

> Elke capability heeft exact één atomair schrijfpad en één atomair
> intrekpad; bij elke nieuwe capability wordt vastgelegd wie hem uitgeeft, wie
> hem intrekt en welke operatie dat atomair doet. Een lookup die een
> ingetrokken capability nog vindt is een bug.

| Capability | Uitgifte | Intrekking | Atomair? |
| --- | --- | --- | --- |
| Room-code + inviteHash | `claimRoomLocatorsAtomically` (nieuw) / `rotateRoomLocators` (vervanging) | `releaseRoomLocators` / `rotateRoomLocators` (impliciet, oude kant) | Ja, alle drie — `saveRoom` is sinds DM17 geen vierde schrijver meer |
| Sessietoken (`tokenHash`) | `saveSession` | `saveSession` (impliciet, bij een gewijzigde `tokenHash`) | Ja, sinds DM17 — vóór DM17 was dit het derde exemplaar van hetzelfde gat |
| Action-cache-entry (`actionId`) | `saveAcceptedAnswerAtomically` | *(geen — action-cache-entries zijn niet bedoeld om ingetrokken te worden, ze zijn het idempotentiebewijs van een geaccepteerd antwoord; TTL-verval is hun enige einde)* | Ja voor uitgifte; intrekking is hier geen zinvol concept |

Alle drie de room-locator-schrijfpaden waren vóór vandaag met elkaar in
conflict (claim vs. `saveRoom`); dat is nu één pad. De sessietoken-index had
geen intrekpad; die heeft er nu een. De action-cache is bewust uitgezonderd:
"nooit intrekbaar, alleen laten verlopen" is voor die ene capability het
juiste antwoord, geen gat.

**Toegepast op elke volgende poortwijziging vanaf nu**, zoals gevraagd — dit
wordt de standaardvraag bij een nieuwe capability, niet iets wat achteraf
wordt gecontroleerd.

## 15. Reactie op INT-15 en INT-13 — signatuur bevestigd, versieprefix roept een nieuw, concreet probleem op

**INT-15 (aan DM + INT-B): `loadSessionByTokenHash`-signatuur.** Bevestigd
en al zo gebouwd — `(tokenHash)`, geen `roomId`. DM17/Deel B koos dit al
vóórdat INT-15 hier was, om precies INT-A's reden (de lookup ís hoe de server
de room leert kennen; een `roomId`-parameter zou circulair zijn). Geen
wijziging nodig.

**INT-13 (aan DM + AR) en INT-15's tweede punt (versieprefix op
`inviteHash`/`tokenHash`, analoog aan de tokenhash-opslag in
`auth-session.mjs`): akkoord met het principe, maar niet zomaar te bouwen —
ik heb een concreet, niet eerder genoemd probleem gevonden.**

`redis-keys.js`'s `assertSegment` weigert een `:` in elk segment
(`INVALID_SEGMENT_CHARS = /[:*?[\]]/`) — bewust, om Redis-key-injectie via een
segment te voorkomen. `auth-session.mjs`'s eigen opslagvorm
(`STORED_HASH_SEPARATOR = ':'`, zelf nagelezen) gebruikt exact dat teken:
`${version}:${hex}`. Geef zo'n waarde ongewijzigd door aan
`roomInviteLookupKey(inviteHash)` of `sessionTokenLookupKey(tokenHash)`, dan
werpt `assertSegment` een `TypeError` — de versieprefix die INT-13/INT-15
willen, breekt letterlijk op mijn eigen injectiebescherming zodra iemand het
naïef implementeert.

**Voorstel, nog niet gebouwd:** de key-builders worden twee segmenten in
plaats van één, zelfde patroon als `matchKey(roomId, matchId)`:

```js
roomInviteLookupKey(version, hash)   // -> 'room:invite:{version}:{hash}'
sessionTokenLookupKey(version, hash) // -> 'session:token:{version}:{hash}'
```

Elk segment wordt apart met `assertSegment` gevalideerd (geen `:` binnen een
segment, wel als structureel scheidingsteken ertussen — precies zoals nu al
bij elke multi-segment builder). **De poortmethoden zelf
(`loadRoomByInviteHash`, `loadSessionByTokenHash`,
`claimRoomLocatorsAtomically`, `rotateRoomLocators`) blijven ongewijzigd** —
die blijven één opaque, al-versioned string aannemen (`inviteHash`/
`tokenHash`), precies zoals `Session.tokenHash`/de compositie die vandaag al
aanlevert. Het splitsen in `{version, hash}` gebeurt pas in de
adapter/key-builder-laag, niet in de poort of de fake — de fake blijft de
volledige string als ondoorzichtige Map-sleutel gebruiken, dat heeft geen
last van `assertSegment`.

**Wie dit raakt, dus wie akkoord moet geven vóór ik dit bouw:**
- **AR** (`room-codes.js`'s `hashInviteId`) — moet daadwerkelijk
  `${version}:${hex}` gaan opleveren, zoals INT-13 voorstelt;
- **INT-B** — de adapter splitst de binnenkomende versioned string vóór hij
  de key-builder aanroept; dit raakt hun Lua-/lookup-pad voor zowel
  `INTB-2`/`INTB-9` als het nog te bouwen `INTB-10`;
- **INT-A** — geen impact verwacht (de poortsignaturen veranderen niet), maar
  ter kennisgeving omdat `loadSessionByTokenHash` al live is in de socketlaag.

Nog niets van dit voorstel geïmplementeerd — wacht op bevestiging dat de
tweesegment-aanpak de juiste is, dan bouw ik de key-builder-wijziging.

**Status: wacht extern, geadresseerd bij AR + INT-B.** Geen actie van mij
totdat een van beide (of beide) akkoord geeft op de tweesegment-aanpak.

## 16. INT-16 — akkoord, met één verduidelijking. Nog niet gebouwd.

**Akkoord op de kern: `expectedPhase` (compare-and-set) + `pausedState` in
dezelfde operatie.** Beide gaten zijn reëel. Gat 1 is besluit 30's principe,
correct doorgetrokken naar een veld dat het besluit niet met naam noemde maar
in de geest evident meeneemt. Gat 2 is dezelfde klasse als INT-7 en de
locatorclaim — een conflict is een normale uitkomst, geen exception, precies
het patroon dat hier al overal staat.

**Eén verduidelijking, geen bezwaar:** INT-16 noemt alleen één richting van de
invariant ("`pausedState` is `null` bij elke niet-`PAUSED`-fase"). Ik stel
voor **beide richtingen af te dwingen, met een throw, niet een stille
correctie**: `newPhase === 'PAUSED'` vereist `pausedState !== null` én
omgekeerd. Een `PAUSED`-fase zonder `pausedState` is even inconsistent als een
niet-`PAUSED`-fase mét — en een throw op een schending is de lijn die deze
sessie steeds is aangehouden (DM13's `ALREADY_ANSWERED`, DM17's
eigendomscontroles): een contractschending zichtbaar laten falen, niet stil
corrigeren.

**Besluit #37-toets, drie punten:**
1. **Redis-sleutel — al beantwoord door het bestaande model.** `Match.pausedState`
   staat al in het Match-document (`types/match.js`, DM3), geen aparte
   sleutel. Het Lua-script leest/muteert/schrijft dus het hele
   Match-document plus de `Room.phase`-projectie in een tweede sleutel — precies
   de eerste optie die INT-16 al noemde, nu bevestigd, geen open vraag meer.
2. **TTL** — conceptueel akkoord dat een fasewissel activiteit is en dus
   verlenging rechtvaardigt (`DATA-MODEL.md` §TTL's eigen principe). Het
   daadwerkelijke mechanisme blijft net als bij `refreshRoomLocators`
   contract-only, geen nieuwe scope hier — dat wacht op de bredere,
   al-uitgestelde refreshmatrix (`ttl.js`, `REVIEW.md` bevinding 3).
3. **Lua** — akkoord, compare-and-set moet in hetzelfde script als de write,
   zelfde les als INT-1.

**HOST_RESUME/RECOVERY_RESUME-splitsing:** geen bezwaar — raakt
`state-machine.js`, niet de poort.

**Blast radius bij mij, alvast in kaart:** 3 aanroepen in
`repository.test.js` (#13-15) op de huidige `(roomId, matchId, newPhase)`-
signatuur, worden herschreven naar de object-vorm zodra dit gebouwd wordt.

**Nog niet gebouwd — akkoord vandaag, bouw in een volgende ronde**, zoals
gevraagd.

## 17. INT-16 — gebouwd (DM19)

**Poort + fake gebouwd**, 509/509 tests groen (8 nieuw, #66-73).
`state-machine.js`/de resume-splitsing en het Lua-script blijven bij INT-A
resp. INT-B, zoals afgesproken.

```js
setRoomAndMatchPhaseAtomically(roomId, matchId, {
  expectedPhase, newPhase, pausedState,
}) → Promise<{ ok: true } | { ok: false, actualPhase: string }>
```

- **Dubbele CAS.** Zowel `Room.phase` als `Match.phase` moeten `expectedPhase`
  dragen — niet alleen `Match.phase`, met de aanname dat `Room.phase` toch
  wel volgt. `actualPhase` in het conflictresultaat is altijd `Match.phase`
  (besluit 30: autoritair), ook als ándere kant de mismatch veroorzaakte —
  getest met een bewust geconstrueerde drift (#67), die in een correcte flow
  niet kan ontstaan maar de dubbele check moet hem zelf ook vangen.
- **`pausedState` in dezelfde stap.** Geen aparte `saveMatch`-aanroep meer
  nodig voor een pauze; getest dat een afgewezen pauzepoging (verouderde
  `expectedPhase`) geen half `pausedState` achterlaat (#73).
- **Beide richtingen van de invariant, als throw, vóór de CAS-check.**
  `newPhase === 'PAUSED'` ⟺ `pausedState !== null`, met voorrang op het
  conflictresultaat (#70: een ongeldige combinatie werpt zelfs als
  `expectedPhase` toch al niet klopt) — een intern inconsistente aanvraag is
  nooit geldig, ongeacht de store-toestand.

**Voor INT-B:** de 6 tests in jullie conformance-suite die op de oude
`(roomId, matchId, newPhase)`-vorm rekenen staan nu rood — verwacht, zelfde
patroon als bij elke eerdere signatuurwijziging deze sessie.

**Blast radius bij mij, zoals aangekondigd:** de 3 bestaande tests (#13-15)
zijn herschreven naar de object-vorm; 8 nieuwe tests toegevoegd (#66-73),
inclusief de dubbele-CAS- en invariant-scenario's.

## 18. Aan AR + GF — signaal, geen voorstel: statengranulariteit design vs. `Match.phase`

Gevonden bij het doornemen van `docs/design-documentation/`. Volledige
uitwerking:
[`observatie-statengranulariteit-design-vs-matchphase.md`](../data-model-plan/observatie-statengranulariteit-design-vs-matchphase.md).

Kort: de designdocumentatie noemt zeventien UI-states, `Match.phase` kent er
zeven. De meeste vallen duidelijk samen of zijn client-/sessiegebonden
(geen `Match.phase`-kandidaat). Drie (`ROUND_CLOSED`/`REVEAL`/
`SOCIAL_HIGHLIGHT`) vallen vandaag samen onder `ROUND_RESULT`, `LEADERBOARD`
onder `SCOREBOARD` — vraag aan AR/GF: blijft dat een client-side
timingdetail, of worden dit eigen `Match.phase`-waarden? Geen actie van mij
totdat jullie een richting kiezen — bij een nieuwe fasewaarde is dat
`architecture`/`database_schema`, dus sowieso `always_ask`.

## 19. Aan PR, cc INT-A — signaal + geschetste richting, niet gebouwd: antwoordverdeling

Gevonden bij het doornemen van `docs/design-documentation/`. Volledige
uitwerking:
[`observatie-antwoordverdeling-poortbehoefte.md`](../data-model-plan/observatie-antwoordverdeling-poortbehoefte.md).

Kort: "antwoordverdeling als staafdiagram" komt in drie designdocumenten
terug (host/podium tijdens reveal). De poort heeft geen methode om alle
antwoorden van één ronde te lezen/aggregeren — `loadAnswer` is per speler.
Geschetst, niet gebouwd: `getAnswerDistribution(roomId, matchId, roundId)`,
met twee vooraf benoemde wrinkles (geen uniforme antwoordsleutel over
gameTypes heen; aggregeren tijdens reveal, niet bijhouden tijdens het
antwoordpad — ARCHITECTURE.md principe 9). Geen actie van mij totdat er een
bevestigde aanroeper is.
