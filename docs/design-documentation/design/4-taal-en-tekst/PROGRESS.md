# Voortgang — 4. Taal en tekst

**Eigenaar:** UI (frontend-implementatie)
**Documenten:** `09-CONTENT-AND-MICROCOPY.md`
**Criteria uit:** `11-DESIGN-QA-CHECKLIST.md` sectie J · schaal: [`NIVEAUS.md`](../NIVEAUS.md)
**Bijgewerkt:** 3 augustus 2026 — ná uitvoering van [`prompts/T4-1`](prompts/T4-1-terminologie-en-directe-correcties.md), [`T4-2a`](prompts/T4-2a-statusteksten-direct-uitvoerbaar.md), [`T4-3`](prompts/T4-3-vraagtekst-en-geen-antwoord-staat.md), de score-bugfix uit §9, en [`T4-4`](prompts/T4-4-pure-aanvullingen-zonder-afhankelijkheden.md)/[`T4-5`](prompts/T4-5-host-specifieke-copy.md) (elk met één correctie uit [`REVIEW.md`](prompts/REVIEW.md) F1/F2 vóór uitvoering), plus een audit-ronde die vijf inmiddels-verouderde claims corrigeerde (zie de notitie onderaan de Telling). Alleen [`T4-2b`](prompts/T4-2b-reconnect-drempel-en-handmatige-retry.md) staat nog open, wacht op een PO-besluit.

Herzien: de vorige versie dekte `09` §4–§11 maar sloeg §12 (pauze/beheer) en
§13 (reconnect) helemaal over, en had één onjuiste claim (foutcodedekking).
Ingedeeld op `09`-paragraafnummer in plaats van willekeurige volgorde, zodat
een lege paragraaf hier ook zichtbaar leeg is.

## Infrastructuur

Wat de teksten mogelijk maakt.

| Onderdeel | Niveau | Stand |
|---|---|---|
| Drietalige dekking | 2 | 178 sleutels (was 101 — flink gegroeid door concurrent werk van andere thema's/agents sinds de vorige telling), gelijk aantal in NL/EN/ES, geen scheefgroei (`locales.test.mjs`, 4/4 groen). |
| Sleutelvorm | 2 | Semantisch (`lobby.start`, `error.GAME_NOT_FOUND`), geen Nederlandse zin als sleutel. Volgt `09` §14. |
| Pluralisatie | 2 | `tCount()` kiest `.one`/`.other`, vult `{n}` in. Live in gebruik (`lobby.playerCount`). Elke volgende telbare tekst hoort hem te gebruiken. |
| Foutcodedekking | 1 | **Correctie op vorige versie:** niet "alle codes hebben een vervolgstap" — 9 van de 23 zijn puur constaterend, geen vervolgstap: `GAME_FULL`, `GAME_ALREADY_STARTED`, `ROOM_LOCKED`, `NOT_HOST`, `NOT_PLAYER`, `INVALID_PHASE`, `UNSUPPORTED_EVENT`, `NAME_TOO_LONG`, `NAME_INVALID`. Bij een aantal (`NOT_HOST`) is er ook geen zinnige vervolgstap te geven — dit is dus geen lijst die naar 100% moet, maar de eerdere claim was feitelijk onjuist. |

## §3 — Terminologienaleving

`09` §3 geeft een voorkeurstabel, geen verplichte exclusiviteit — maar `09`'s
eigen voorbeeldzinnen in §4–§13 kiezen zelf steeds consequent één kant, en
daar wijken we soms van af.

| Term | Voorkeur | Onze stand |
|---|---|---|
| game session | potje / game (beide toegestaan) | We zeggen consequent "game" (`Deze game zit vol.`, hostbalk-teksten), nooit "potje" — terwijl elk foutvoorbeeld in `09` §4 juist "potje" gebruikt (`Dit potje zit vol.`). Geen fout per de tabel, wel een systematische registerkeuze die niemand bewust heeft gemaakt. |
| host | host | ✅ consistent |
| join | meedoen | ✅ consistent (`join.submit`, `home.codeSubmit`) |
| room code | gamecode / code | ✅ consistent, geen "PIN-token" |
| answer submitted | antwoord ontvangen/verstuurd | ✅ (`game.received`) |
| leaderboard | tussenstand | ✅ (`standings.title`) |
| rematch | revanche | ✅ `podium.rematch` = "Revanche" (T4-1) |
| pause | gepauzeerd | ✅ voor de statustekst; zie §12 voor het bredere gat |

## §4 — Start en join

| Waar | Niveau | Nu | Volgens `09` |
|---|---|---|---|
| Startknop landing | 2 | `Start direct een game` (T4-1) | ✅ letterlijk gelijk |
| Code-invoerlabel | 2 | `Voer de gamecode in` (T4-1) | ✅ letterlijk gelijk |
| Belofte-regel | 2 | `home.promise`, altijd zichtbaar onder de titel (T4-4) | ✅ letterlijk gelijk |
| Loadingstatussen | 1 | `Potje maken…` tijdens `state.status === 'creating'` (T4-2a) | ✅ voor Snel starten; `Gamecode controleren…`/`Je wordt toegevoegd…` bleven inhoudelijk gelijk aan de bestaande `join.mjs`-teksten, niet aangepast |
| Errors | 2 | aanwezig, dekt alle gevallen uit dit `09`-lijstje | inhoudelijk gelijkwaardig aan `09`'s vijf voorbeelden |
| Spel aanpassen-link | 2 | `home.hostSetupLink`/`hostSetup.title` = "Spel aanpassen" | ✅ letterlijk gelijk |

**Nieuw sinds de vorige versie, niet door mij gebouwd/beoordeeld:** `views/host-setup.mjs` (het "Spel aanpassen"-scherm) bestaat nu, met 27 eigen `hostSetup.*`-sleutels (moeilijkheid, taal, rondes, pacing, snelheidsbonus e.d.). `09` heeft hiervoor geen eigen paragraaf — alleen de link zelf (hierboven) staat er letterlijk in — dus de inhoud van dit scherm is niet tegen een brondocument te toetsen zoals de rest van deze tabel. Steekproef: de labels lezen als korte, directe instructies, consistent met `09` §2's stijlregels, maar dit is geen volledige audit. Zie ook `HANDOFF-UI.md` UI-17 (teams/tijd-per-ronde staan in dit scherm nog als vaste tekst, geen echte instelling — datamodelgat, geen tekstgat).

## §5 — Naam kiezen

| Waar | Niveau | Nu | Volgens `09` |
|---|---|---|---|
| Naamvraag | 2 | `Hoe noemen we je?` + `join.nameOptionalHint`: "Optioneel — laat leeg voor een voorgestelde naam." (T4-1) | ✅ letterlijk gelijk, plus behoud van de optioneel-aanwijzing die de kale tekstvervanging zelf had weggehaald |
| Sociaal bewijs | 2 | `join.waitingCount` (`tCount`), zichtbaar zodra de preview is opgehaald en `playerCount > 0` (T4-4) | ✅ letterlijk gelijk — **alleen ná een uitnodigingslink**, niet ná een ingetikte gamecode (die slaat de preview-stap over, `REVIEW.md` F2); `09` maakt dat onderscheid zelf niet |
| Naam-botsingsmelding | 0 | suffix wordt toegepast (`Naam 2`), nooit uitgelegd | `Deze naam wordt al gebruikt. We hebben er "2" achter gezet.` — blijft geblokkeerd: de server geeft geen signaal dat er een botsing was (`nameSource` onderscheidt alleen server-verzonnen/zelf-gekozen), dit vraagt een protocolveld |

## §6 — Lobby (host)

| Waar | Niveau | Nu | Volgens `09` |
|---|---|---|---|
| Deelactie-titel | 2 | `Uitnodigen` | inhoudelijk gelijk aan `Scan om mee te doen` |
| Spelersaantal | 2 | `tCount('lobby.playerCount', n)` | `7 spelers aanwezig` — dekt zich |
| Startknop | 2 | `Start Rounda` | wijkt bewust af van `Start game — N spelers` (`D-020`, expliciet besloten) |
| Lege lobby | 2 | `lobby.emptyTitle` + `lobby.emptyHint` tonen i.p.v. de telling zolang `playerCount === 0` (T4-2a) | ✅ letterlijk gelijk |
| Vergrendelstatus | 2 | `lobby.locked` zolang `locked === true`; kort `lobby.unlocked` ná het ontgrendelen (3s, T4-4) | ✅ letterlijk gelijk |

## §6 — Lobby (speler)

**Niveau 2 — uitgevoerd (T4-5).** `lobby.mjs` toonde host en speler exact
hetzelfde scherm; er is nu een additieve `isHost === false`-tak met de vier
teksten uit `09`: `lobby.playerJoined` ("Je bent binnen"),
`lobby.playerWaitingForHost` ("De host start zo"), `lobby.playerInviteHint`
("Nodig iemand uit"), `lobby.playerSelf` ("Je speelt als {naam}" — de naam
komt uit een nieuwe `selfName`-waarde in `lobby.mjs`'s `update()`-payload,
gevoed door `session-shell.mjs`'s al bestaande `selfInfo.effectiveName`;
`REVIEW.md` F1 signaleerde terecht dat dit geen bestaande modeldata was).
Browserverifieerd: een niet-host ziet alle vier teksten inclusief de eigen
naam, de host-kant (deelactie, spelersaantal, startknop) blijft ongewijzigd.
Dit was zowel een tekst- als een schermgat (thema 1, S06) — het schermgat
(een écht aparte staat, niet alleen extra tekst in dezelfde staat) blijft in
zoverre openstaan dat dit een additieve tak is, geen volledig herontworpen
staat; voor de tekst zelf is het gat gedicht.

## §7 — Countdown en vraag

| Waar | Niveau | Nu | Volgens `09` |
|---|---|---|---|
| Rondelabel | 2 | `Ronde 1/5` | inhoudelijk gelijk aan `Ronde 6 van 10` |
| Voortgang tijdens antwoorden | 1 | `3/7 beantwoord` | `Wachten op 4 spelers…` |
| Vraagtekst | 1 | `game.questionPrompt`: "Welke vlag is dit?" — **klopt alleen nog voor `flags_mc`** | ✅ letterlijk gelijk vóór de scope-uitbreiding hieronder |
| Countdown-copy | 0 | scherm bestaat niet (thema 1, S07) | n.v.t. — volgt zodra het scherm er is |

**Belangrijke, nieuwe bevinding uit deze auditronde — nog niet opgepakt, wel
gerelativeerd.** `round-model.mjs` ondersteunt sinds "14-S09-S10" niet meer
alleen `flags_mc`, maar ook `real_or_fake_flag` en `higher_lower`
(`selectChoice`/`selectSide`/`answerPayloadFor` bestaan al). `gameplay.mjs`
toont echter nog altijd hetzelfde hardgecodeerde `game.questionPrompt`
("Welke vlag is dit?") en `countryName()`-gebaseerde correct-antwoordregel,
ongeacht `model.gameType`. **Nog niet urgent:** `client/flow/host-setup-
state.mjs`'s `defaultHostConfig().gameTypes` staat nog vast op `['flags_mc']`
(`DECISIONS.md` #31/#32/#35) — de twee nieuwe spelvormen zijn dus nog
nergens door een host te kiezen, dit tekstgat is voorbereid maar niet
gebruikersbereikbaar. Wel iets om in de gaten te houden: zodra `gameTypes`
wordt opengezet, is dit meteen zichtbaar kapot. Geen prompt nu — wacht op
duidelijkheid over wanneer/of die spelvormen live gaan én wat `09` (of een
opvolger) voor hun tekst wil.

## §8 — Antwoordfeedback

| Waar | Niveau | Nu | Volgens `09` |
|---|---|---|---|
| Antwoord versturen | 1 | `Versturen…` | `Antwoord versturen…` — vrijwel gelijk |
| Antwoord bevestigd | 1 | `Antwoord ontvangen` | `Verstuurd ✓` |
| Te laat | 2 | `Te laat — deze ronde telt niet meer` | inhoudelijk gelijk aan `De tijd was net voorbij. Dit antwoord telt niet mee.` |
| Vóór-reveal-regel | 2 | geen groen/rood, geen `Goed!`/`Helaas!` vóór `round:ended` | ✅ nageleefd — dit is de anti-afkijkregel en die klopt |

## §9 — Reveal

| Waar | Niveau | Nu | Volgens `09` |
|---|---|---|---|
| Correct antwoord | 1 | zin: `Het juiste antwoord: Frankrijk` via `countryName(model.result.correctOptionId, lang)` — **zelfde scope-gat als §7's vraagtekst**: gaat uit van een ISO2-landcode, wat niet klopt voor `real_or_fake_flag`/`higher_lower`'s `correctChoice`/`correctSide` | `Japan` — kaler, als stempel bedoeld |
| Eigen resultaat | 2 | `game.resultCorrect`/`resultIncorrect`/`resultNoAnswer` als stempelwoorden (T4-3), leest nu `ownCorrect` — geverifieerd tegen de echte payloadvorm, niet meer alleen tegen de mock | ✅ letterlijk gelijk aan de bedoeling |
| Geen antwoord ingediend | 2 | eigen, derde staat: `round-model.mjs`'s `hydrateFromSnapshot` + preciezere `selfNoAnswer`-logica (idle/`DEADLINE_PASSED` → geen antwoord, `ALREADY_ANSWERED`/geaccepteerd → wél een antwoord), niet langer verward met "fout" (T4-3) | ✅ — inclusief het reducer-fixje dat de vorige versie terecht als blokkade signaleerde |
| Puntendelta | 1 | `game.roundPoints`: "Punten deze ronde: {n}" — punten van déze ronde, geen lopend totaal meer (bugfix) | vergelijkbaar met `+164 punten`, geen apart `Snelheidsbonus`-veld: de server geeft base+bonus samengevoegd, geen losse waarde beschikbaar |
| Rank movement | 2 | **bijgewerkt sinds vorige versie, niet door mij gebouwd.** `standings-model.mjs` heeft nu `rankMovementFrom()`, `session-shell.mjs` bewaart `previousStandings` (S15/prompt 08, thema 1/3) en `scoreboard.mjs` toont een ↑/↓-badge met `standings.moveUp`/`moveDown`-tekst als `aria-label` (`{n} plaats(en) gestegen/gedaald`) | inhoudelijk gelijk aan `Twee plaatsen omhoog`; gecontroleerd in de code, niet zelf browserverifieerd (niet mijn bouwwerk) |

De T4-3-fix loste een groter, niet eerder benoemd gat mee op: vóór deze
fix werd `roundModel` na een reconnect/reload nooit gehydrateerd uit de
server-snapshot, dus toonde een tussentijdse pagina-herlaad een volledig
lege gameplay-staat i.p.v. de actieve vraag. `hydrateFromSnapshot` lost
beide tegelijk op, zonder protocolwijziging (leunt op het al bestaande
`self.answeredCurrentRound`-snapshotveld).

**Bugmelding — ✅ opgelost.** `round-model.mjs`'s `applyRoundEnded` las
`payload.selfCorrect`/`payload.selfScore`, velden die de échte `round:ended`-
payload nooit had (die stuurt `ownPoints`/`ownCorrect`/`ownResponseTimeMs`,
`server/transport/socket.mjs:534-536`). Tegen de echte transportlaag (na "DE
SWAP", commit `98a114d`) was `selfCorrect` daardoor altijd `false` en
`selfScore` altijd `null` — het resultaatstempel toonde altijd "Onjuist" en de
scoreregel verdween volledig, ongeacht het echte antwoord. Alleen
`transport-mock.mjs` stuurde de velden die de client verwachtte, met
`selfScore` daar zelfs als cumulatief totaal, terwijl `ownPoints` altijd
dit-ronde-punten is geweest.

Gefixt in `round-model.mjs` (leest nu `ownCorrect`/`ownPoints`, `selfScore`
hernoemd naar `roundPoints` om de nieuwe betekenis — punten déze ronde, geen
lopend totaal — niet te verhullen), `transport-mock.mjs` (stuurt nu dezelfde
veldnamen/semantiek als de echte server) en `round-model.test.mjs` (zes
assertions herschreven). Handmatig bevestigd tegen de mock via de echte UI:
een correct antwoord toont nu `is-correct`/"Juist" en "Punten deze ronde:
100". `PROTOCOL.md`'s ontbrekende specificatie van deze drie velden is
vastgelegd als `HANDOFF-UI.md` UI-12 (voor PR) — dat is documentatiewerk, geen
blokkade meer.

## §10 — Sociale headlines

Bewust in tweeën gesplitst — de vorige versie zette dit als één rij op
niveau 0, wat suggereert dat één eigenaar het optuigt. Het zijn twee losse
opleveringen die moeten samenkomen:

| Onderdeel | Niveau | Eigenaar | Stand |
|---|---|---|---|
| Copy (templateset) | 0 | hier (taal en tekst) | Geen van de acht voorbeeldzinnen uit `09` §10 bestaat. Puur schrijfwerk zodra er een plek is om ze te tonen. |
| Selectielogica | 0 | thema 1 (schermen en flow, S14) | Welke headline, wanneer, met welke data — hoort bij de flow, niet bij de tekst. |

## §11 — Leaderboard en podium

| Waar | Niveau | Nu | Volgens `09` |
|---|---|---|---|
| Tussenstand-titel | 2 | `Tussenstand` | ~`TUSSENSTAND` — zelfde woord, ander hoofdlettergebruik (stijlkeuze, geen tekstgat) |
| Eigen positie | 2 | `Jij: #1 — 100` | vrijwel gelijk aan `Jij: #12 — 610 punten` |
| Eindstand-titel | 2 | `Eindstand` | ~`EINDSTAND` |
| Revanche | 2 | `podium.rematch` = "Revanche" (T4-1) — deze rij was hier nog niet bijgewerkt na T4-1, zie §3 waar dit al wel klopte | ✅ letterlijk gelijk |
| **Gelijke plaatsen** | 0 | **bestaat niet** — `standings-model.mjs` kent geen tie-regel, positie is altijd `index + 1`. Wel al een `standings.sharedPlace`-sleutel ("Gedeelde plaats") in alle drie de locales, maar nog nergens gebruikt — vooruitlopend op `HANDOFF-UI.md` UI-15 (tie-regel al bevestigd bij PR, maar server/client lopen nog uit de pas), niet iets dat ik zelf kan afronden | `Gedeelde eerste plaats` |
| Deel/afsluiten | 2 | **bijgewerkt sinds vorige versie, niet door mij gebouwd.** `podium.mjs` heeft nu alle drie de acties: `podium.share`/`podium.newGame`/`podium.close` | ✅ letterlijk gelijk ("Deel uitslag", "Nieuw spel", "Afsluiten") |

## §12 — Pauze en beheer

**Volledig ontbrak in de vorige versie.** Twee aparte rollen met eigen copy
in `09`; wij hebben er één, en die ene wijkt af.

| Waar | Niveau | Nu | Volgens `09` |
|---|---|---|---|
| Pauzetekst (speler) | 1 | `Gepauzeerd door de host` | ✅ vrijwel gelijk, mist alleen `We gaan zo verder.` als tweede regel |
| Pauzetekst (host) | 2 | `pause.hostStamp` ("Game gepauzeerd", hoofdletters via CSS) i.p.v. de spelerszin wanneer `isHost() === true` (T4-5) | ✅ letterlijk gelijk aan de bedoeling — browserverifieerd: host ziet het stempel, speler blijft de kalme zin zien |
| Vergrendelknop | 2 | `hostbar.lock`: "Room vergrendelen" / `hostbar.unlock`: "Room ontgrendelen" (T4-1) | ✅ letterlijk gelijk |
| Beëindigknop | 2 | `hostbar.finish`: "Game beëindigen" (T4-1) | ✅ letterlijk gelijk |
| Beëindig-bevestiging | 2 | `hostbar.finishConfirm`: "Weet je zeker dat je het potje wilt beëindigen?" (T4-1, letterlijk overgenomen incl. de "potje"-keuze uit `09` zelf) | ✅ letterlijk gelijk — de `game`/`potje`-inconsistentie zit al in `09` zelf, zie §3 |
| Spelers beheren | 2 | `Spelers beheren` | ✅ letterlijk gelijk |

## §13 — Reconnect

**Volledig ontbrak in de vorige versie.**

| Waar | Niveau | Nu | Volgens `09` |
|---|---|---|---|
| Verbroken/bezig | 1 | `Verbinding verbroken…` / `Opnieuw verbinden…` | vergelijkbaar met `Verbinding herstellen…`, ander werkwoord |
| Hersteld-bevestiging | 1 | `connection.connected`: "We zijn weer verbonden.", 3s zichtbaar ná een overgang vanuit `disconnected`/`reconnecting`, nooit bij de allereerste verbinding (T4-2a) | ✅ letterlijk gelijk qua tekst; end-to-end nog niet browserverifieerbaar — `transport-mock.mjs` simuleert geen echte disconnect, dus alleen codepad-geverifieerd |
| Langdurig mislukt | 0 | bestaat niet, balk blijft alleen "opnieuw verbinden" tonen | `Herstellen lukt nog niet.` — **T4-2b, wacht op PO-besluit over de drempel** |
| Geruststelling | 1 | `connection.answerSaved`: "Je antwoord blijft bewaard.", getoond naast de disconnected-tekst zolang `roundModel.answerStatus === 'accepted'` (T4-2a, leunt op T4-3's hydratatiefix) | ✅ letterlijk gelijk |
| Handmatige uitweg | 0 | bestaat niet — geen knop, alleen wachten op automatische backoff | `Opnieuw proberen`, `Terug naar start` — **T4-2b, wacht op PO-besluit over knopgedrag** |

## §14 — Lokalisatie

| Regel | Niveau | Stand |
|---|---|---|
| Roomcode niet gelokaliseerd | 2 | Gamecode is altijd cijfers, geen vertaalpad — voldoet triviaal. |
| Getallen volgen locale | 1 | Scores zijn `String(score)` zonder `Intl.NumberFormat`. Bij de huidige puntenschaal (tientallen/honderdtallen) onzichtbaar probleem, maar niet expliciet nageleefd. |
| UI ondersteunt langere vertalingen | 1 | Nooit expliciet getest — Spaanse/Engelse strings zijn soms langer dan NL, geen bekende overflow, maar ook geen bewuste controle. |
| Sociale headlines grammaticaal getest per taal | 0 | n.v.t. zolang §10 op 0 staat. |

## §15 — Verboden prototypecopy

| Term | Stand |
|---|---|
| `Game App` | ✅ weg — nu Rounda |
| `Submit`, `Success`, `Loading…`, `Error 500` | ✅ komen niet voor |
| `Awaiting host action`, `Session initialized`, `User joined room` | ✅ komen niet voor |
| `Show code` | ✅ **opgelost sinds de vorige versie** — `room-header.mjs` is inmiddels ingehangen door thema 1 (`session-shell.mjs` importeert en mount 'm, `HANDOFF-UI.md` UI-10 staat op ✅ opgelost). `lobby.mjs` toont zelf geen `show-qr`/`show-code`-knop meer; `lobby.shareQr` leeft alleen nog voort als `aria-label` op `room-header.mjs`'s QR-knop, niet als zichtbare tekst. |

## Telling

| Niveau | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| Aantal rijen hierboven (§4–§14) | 7 | 13 | 30 | 0 |

Herteld ná uitvoering van T4-1/T4-2a/T4-3 + de score-bugfix (50 rijen,
§4–§14 — consistenter afgebakend dan de vorige telling van 17/15/12/0, die
§14 niet meenam; één rij méér dan de vorige telling van 49 door de nieuwe
"Spel aanpassen-link"-rij). Per rij is de niveauwijziging terug te vinden in
de tabellen hierboven (elke gewijzigde rij noemt de prompt of fix erbij);
geen losse opsomming hier om drift tussen deze samenvatting en de tabellen
zelf te voorkomen.

**Documentatie-auditronde (3 aug 2026, ná T4-4/T4-5).** Deze `PROGRESS.md`
was op een aantal punten stil achterhaald geraakt door concurrent werk van
andere thema's/agents, zonder dat ik dat had bijgewerkt: sleutelaantal
(101→178), `Show code` (nu écht opgelost, `room-header.mjs` is ingehangen),
Rank movement en Deel/afsluiten (allebei al gebouwd), Revanche (§11 was na
T4-1 niet meegenomen, §3 wel), en het volledig nieuwe "Spel
aanpassen"-scherm dat nog nergens stond. Allemaal hierboven gecorrigeerd.

## Wat dit voor de eerdere conclusie betekent

De vorige versie signaleerde drie dingen die geen zuiver tekstgat waren; alle
drie zijn nu opgelost:

- **§9 (geen-antwoord-staat) is opgelost** — `round-model.mjs` maakt nu
  server-autoritatief onderscheid via `hydrateFromSnapshot` +
  preciezere `selfNoAnswer`-logica (T4-3), niet meer verward met "fout".
  Als bijvangst is ook een dieper bug gefixt: `roundModel` werd vóór deze fix
  nooit gehydrateerd uit een snapshot, dus toonde een reconnect/reload
  midden in een ronde een lege gameplay-staat. Een tweede, later gevonden bug
  (`ownCorrect`/`ownPoints` matchten de echte server niet) is ook opgelost.
- **§12 (host-pauzestempel) is opgelost** (T4-5) — de host ziet nu
  `pause.hostStamp` i.p.v. de kalme spelerszin, browserverifieerd.
- **§10 (sociale headlines) is voor de helft niet van hier** — ongewijzigd,
  wacht op thema 1 (S14).

`§13` (reconnect) blijft voor drie van de vijf rijen uitgevoerd (T4-2a); de
resterende twee (langdurig-mislukt-tekst + handmatige retry-knop, T4-2b) zijn
welbewust niet gebouwd — beide vragen een productbesluit (drempel,
knopgedrag) dat niet aan een tekstcorrectie hangt, zie
[`T4-2b`](prompts/T4-2b-reconnect-drempel-en-handmatige-retry.md).

Resterende gaten zonder open productbesluit: **§5 sociaal bewijs bij
naam-botsing** vraagt een protocolveld dat er nog niet is. **Rank movement**
(§9) en **podium: deel/afsluiten** (§11) bleken bij deze doorloop al
opgelost (door andere agents, niet door mij) — beide stonden hier nog als
geblokkeerd terwijl de code inmiddels allebei al bevat; zie de bijgewerkte
rijen hierboven. §10's selectielogica blijft bij thema 1, §11's tie-regel
("Gelijke plaatsen") bij een PO/protocolbesluit (`HANDOFF-UI.md` UI-15) —
geen van beide bij mij.
