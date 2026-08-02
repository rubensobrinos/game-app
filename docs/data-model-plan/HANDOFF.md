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

**Wat we in de tussentijd doen:** `server/data/types/room-core.js` en
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
