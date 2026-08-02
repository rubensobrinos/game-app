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
- **INTB-8 (aan DM + eigenaar `tests/fixtures/`):** gedeelde testfixtures
  produceren ongeldige documenten.
- **INT-4 (cc DM, primair CT):** contentcontract mist
  `validOptionIds`/`resultDetails`. Niet blokkerend, niet primair mijn item.

Al deze items volgen vanaf nu het nieuwe proces (HANDOFF-voorstel eerst,
akkoord van INT-A én INT-B, dan pas implementatie) — ook INT-3 en INTB-5,
ondanks hun urgentie/severity-markering.

## 7. Klein, buiten scope van DM10/11/12 — genoteerd, niet opgepakt

`sessionsByKey`/`playersByKey` in `in-memory-store.js` gebruiken nog steeds
`` `${roomId} ${playerId}` ``-samengestelde string-sleutels, dezelfde klasse
kwetsbaarheid (in theorie, geen praktijkincident) die DM11/DM12 net voor
`matches`/`rounds`/`answers`/`actionCache`/`scoreboard` hebben opgelost.
Bewust niet meegenomen om de scope van deze ronde niet verder op te rekken —
kleine, geïsoleerde opvolging als iemand er nog eens langs gaat.
