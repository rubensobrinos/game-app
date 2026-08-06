# Bevestigde projectbesluiten

**Status:** bindend voor de multiplayer-MVP  
**Bevestigd door producteigenaar:** 2 augustus 2026

Dit document ontdubbelt de menselijke checkpoints uit de realisatieplannen. Bij
strijdigheid met een ouder plan, prompt, handoff- of progressbestand geldt dit
document totdat de betreffende fundamentele specificatie is bijgewerkt.

## Spelverloop en protocol

1. Host-tempo gebruikt **één hostactie per ronde**. `ROUND_RESULT` loopt op timer
   door naar `SCOREBOARD`; de host kiest daarna “Volgende”.
2. Een verlopen room-TTL wordt extern `GAME_NOT_FOUND`.
3. De client krijgt proactief de antwoordgerechtigdheid van de eigen speler te
   zien, bij voorkeur via `eligibleFromRound`. Servervalidatie blijft leidend.
4. Vrijwillig verlaten zet `left: true` maar trekt het sessietoken niet in. Een
   kick, expliciete intrekking of TTL-verloop kan dat wel doen.
5. Een speler met `left: true` telt niet automatisch mee in een rematch; opnieuw
   joinen/reactiveren is vereist.
6. `joinUrl` gebruikt één serverconfiguratiewaarde, `PUBLIC_APP_URL`.
7. Er komt een licht pre-join-previewendpoint dat de invite valideert en een
   servergegenereerde naamsuggestie levert vóór `POST /games/join`.
8. **Teams worden nu niet gebouwd.** Er wordt geen teamkeuzecontract, teammodel of
   teamscoring aan de huidige MVP toegevoegd.
9. **Spectators worden nu niet gebouwd.** Er wordt geen spectatorrol, -token of
   -projectie aan de huidige MVP toegevoegd.
10. Snapshot en live `game:paused` gebruiken dezelfde volledige `pausedState`-vorm:
    `previousPhase`, `remainingMs`, `reason`, `pausedAt`.
11. De MVP-pauzeredenen zijn `host`, `host_disconnected`, `no_answers` en
    `server_recovery`. Clients houden een generieke fallback voor onbekende waarden.
12. `INVALID_PAUSE_STATE` blijft intern en wordt niet als nieuwe wire-foutcode
    gepubliceerd.
13. Antwoorden worden tot en met 250 ms na de deadline aan de rules-laag aangeboden.
    Binnen grace kan een antwoord correct zijn, maar krijgt het nooit tijdbonus. Na
    grace volgt `DEADLINE_PASSED`.
14. De rules/service-laag berekent antwoordverdelingen; het protocol transporteert
    en valideert alleen de uitkomst.
15. `correctAnswer` gebruikt de bevestigde vormen:

    | Spelvorm | Vorm |
    | --- | --- |
    | `flags_mc` | `{ optionId: string }` |
    | `capitals_mc` | `{ optionId: string }` |
    | `real_or_fake_flag` | `{ choice: "real" \| "fake" }` |
    | `higher_lower` | `{ side: 0 \| 1 }` |
    | `odd_one_out` | `{ cardIndex: number }` |

16. Publiek `roundNumber` is 1-based: `Match.roundIndex + 1`. `countdownEndsAt` is
    vluchtig en wordt bij de transitie berekend, niet persistent opgeslagen.
17. `session:revoked` is voor expliciete server-/beheerintrekking. Kick gebruikt
    `session:kicked`; vrijwillig verlaten en TTL-verloop gebruiken het event niet.
18. `share:opened.method` wordt gelijkgetrokken met de vier herkomsten:
    `qr | link | native | code`.
19. Een lokaal misvormde `/time`-response gebruikt een lokale
    `INVALID_SERVER_RESPONSE`; dit wordt geen nieuwe wire-foutcode.
20. Alle vijf vraagsoorten krijgen een discriminated `question`-payload op basis van
    `gameType`. `correctAnswer` staat nooit in `round:started`.

## Data en architectuur

21. `contentVersion` en `rendererVersion` zijn canoniek en onveranderlijk op
    `Match`; roundpayloads dragen ze mee voor clients.
22. Room, Match en Round worden eerst als versieerbare JSON-documenten opgeslagen.
    Indexes, sessies en idempotencygegevens mogen passende Redis-structuren gebruiken.
23. Antwoordverwerking gebruikt een Redis Lua-script voor conditionele, atomaire
    validatie en mutatie.
24. De voorkeursclient is de officiële Node-package `redis`. Toevoegen gebeurt bij
    de concrete servercomposition.
25. Persistente opslag gebruikt PostgreSQL, geen tijdelijke SQLite-variant.
26. Sessietokens gebruiken 32 random bytes, base64url. Opslag gebruikt
    versieerbare HMAC-SHA256 met pepper en verificatie gebruikt constant-time
    vergelijking. `inviteHash` mag SHA-256 gebruiken bij voldoende entropie;
    analytics-identifiers gebruiken een aparte HMAC-pepper.
27. Naamfiltering gebruikt een kleine lokale, versieerbare Nederlands/Engelse
    woordenlijst zonder externe runtime-service.
28. ESM is het canonieke moduleformaat. Zonder repo-brede `type: module` gebruiken
    nieuwe modules `.mjs`; bestaande CommonJS-rules mogen tijdelijk via interop.
29. De gedeelde contentmodule komt onder `shared/content/` en wordt de gedeelde
    bron voor genormaliseerde content, `contentVersion` en deterministische
    gegenereerde content.
30. **Bevestigd (2 aug 2026, regie-sessie):** `Match.phase` is autoritair;
    `Room.phase` is een afgeleide projectie die in dezelfde atomaire operatie
    wordt bijgewerkt. Geen implementatie mag een niet-atomair dual-write-pad
    introduceren.

## Productscope

31. Groepsbattle wordt nu niet gebouwd. Eerdere vier-versus-vijf-presetbesluiten
    zijn daardoor geen huidige implementatieopdracht.
32. Mixed games worden nu niet gebouwd. Een match gebruikt voorlopig één
    `gameType`; dit is een MVP-scopekeuze, geen verwijdering van de latere feature.
33. Teams en spectators blijven latere uitbreidingen, zoals hierboven bevestigd.
34. Voor Golf 2 is geen nieuw besluit genomen. Canonieke IDs en feature-gates
    blijven uitgesteld.
35. **Kernflow quick-start blijft bestaan** (bevestigd 2 aug 2026, regie-sessie).
    Het schrappen van de Groepsbattle-preset (#31) schrapt níét de snelle
    startroute. De kernbelofte, in de woorden van de producteigenaar: één host,
    QR-code delen, spelersnaam invullen of laten genereren, en dan spelen —
    10 vragen over vlaggen en een scoreboard wie er heeft gewonnen. Default bij
    `Snel starten`: `flags_mc`, 10 rondes, moeilijkheid normaal, individueel,
    auto-tempo, snelheidspunten aan, late join aan. Succescriteria 1–2 uit
    PRODUCT.md (10 seconden naar room/lobby) blijven onverkort gelden.

## Capabilities

36. *(gereserveerd — join-code-claim, gerealiseerd via DM10's
    `claimRoomLocatorsAtomically`; zie `docs/integration-plan/HANDOFF.md` INT-1.)*
37. **Capability-principe** (bevestigd 2 aug 2026, regie-sessie, op voorstel
    van INT-B na drie gelijkvormige gaten — roomlocator-rotatie,
    sessietoken-intrekking, claim-omzeiling via `saveRoom`): elke capability
    (join-code, inviteId/hash, sessietoken, actionId-cache-entry) heeft exact
    **één atomair schrijfpad en één atomair intrekpad**. Bij het toevoegen van
    een nieuwe capability wordt expliciet vastgelegd: wie geeft hem uit, wie
    trekt hem in, en welke operatie doet dat atomair. Een lookup die een
    ingetrokken capability nog vindt is per definitie een bug. Elke
    poortwijziging wordt hieraan getoetst; een integrator-akkoord op een
    poortmethode betekent bovendien: implementeerbaar in Redis, inclusief
    benoemde sleutel én een uitspraak over TTL.

38. **INT-5 (afleidbaar antwoord bij `flags_mc`) is een geaccepteerd risico voor
    de pilotfase** (bevestigd 2 aug 2026, regie-sessie): een speler die zijn
    browser-devtools inspecteert kan bij Vlaggen-meerkeuze het juiste antwoord
    afleiden (`targetIso2` = `correctAnswer.optionId`). Voor Pilot A/B met
    bekenden is dit aanvaardbaar; **vóór route B (onderwijs) of serieuze
    publieke inzet wordt de vraagvorm herontworpen** (eigenaar: GR + PR,
    eenmalige klus; de keten-test pint het lek exact vast en gaat rood zodra
    er méér lekt dan dit ene bekende pad).

39. **De productnaam is Rounda** (besloten 3 aug 2026, producteigenaar, na
    naamtraject met o.a. Playeso/Playora/Playiso als kandidaten):
    - Merknaam: **Rounda** — één woord, geen streepje, accent of leesteken.
    - Hoofddomein: **rounda.io**. `play.aseso.nl` blijft bestaan als redirect
      (bestaande QR's en links breken nooit).
    - Socials: profielnaam Rounda; handle-voorkeur `@playrounda` (exacte
      `@rounda` is bezet; "Play Rounda" is tevens de vaste call-to-action).
    - Rationale: eenduidige uitspraak, betekenisanker ("nog een Rounda" =
      het rematch-ritueel van het product), natuurlijk in spreektaal, en een
      visuele ontwerpwereld (rondes, cirkels, countdown, arena).
    - `playeso.com`-achtige premiumdomeinen en de exacte-handle-jacht zijn
      bewust losgelaten: het merk hoeft niet overal dezelfde tekenreeks te
      zijn (vgl. Claude / @claudeai).
    - **Aandachtspunt vóór merkregistratie** (zelfde lat als besluit 38-stijl
      risico's): gerichte merkcheck op ROUNDS (Landfall, multiplayergame) en
      op de spaarapp/het securitybedrijf die "Rounda" voeren. Beheersbaar
      aandachtspunt, geen blokkade; geen registratie-uitgaven vóór die check.
    - Uitvoering (rebrand-checklist, pas op sein van de producteigenaar ná
      domeinkoppeling): `PUBLIC_APP_URL`, `public-mode.js`
      (PUBLIC_HOSTNAMES + applyBrandName), titels/og-tags beide index.html's,
      Cloudflare-tunnel/DNS voor rounda.io, redirect play.aseso.nl.

40. **Doelbeeld v2 is canoniek** (producteigenaar, 3 aug 2026): de
    5-schermen-designiteratie ("screenshot leidend") plus het bijbehorende
    productconcept van vier wereldgames. Volledige vastlegging:
    `docs/frontend-plan/DOELBEELD-v2-schermen-en-games.md`. Kernbesluiten:
    - **A** — smalle permanente codebalk + QR-op-één-tik vervangt het grote
      code/QR-paneel in de hostlobby (herziening van BRIEFING §3.3).
    - **B** — "IK BEN KLAAR" (gastlobby) is client-side naam-bevestiging,
      daarna wachten tot start; géén ready-check in het protocol.
    - **C** — host-getriggerde reveal wordt gebouwd: toggle "Antwoord
      automatisch tonen" uit → host onthult (serverwerk, match-lifecycle).
    - **D** — Mix/Typen en games 2–4 zichtbaar maar disabled ("binnenkort")
      tot de betreffende feature bestaat; geen dode maar klikbaar ogende
      knoppen.
    - Verruimt besluit 32 (single-game-type): Rounda is een verzameling van
      vier wereldgames — Raad de vlag, Echt of nep, Welke hoort er niet
      bij?, Raad het land — die per game gebouwd worden; `flags_mc` blijft
      de enige bestaande.

41. **Spelersidentiteit: land + speels woord, in de bijvoeglijke vorm**
    (producteigenaar, 5 aug 2026 — punt 12, mét punt 8). VASTGELEGD, NOG NIET
    GEBOUWD.

    Iedere speler krijgt bij binnenkomst automatisch een identiteit die bestaat
    uit een **land** (met de vlag erbij) en een **speels woord** — een dier of
    iets anders geks. De weergave is de **bijvoeglijke vorm**: *Bulgaarse Koe*,
    *Peruaanse Pinguïn*, *Japanse Jaguar* — dus **niet** "Koe uit Bulgarije".

    - Gekozen boven de "uit"-vorm, die goedkoper was maar minder leuk klinkt.
      De klank is hier het punt van de feature.
    - **Consequentie, bewust aanvaard:** de landbijvoeglijke naamwoorden zijn
      nieuwe content — 230 landen × 3 talen, en in het Spaans met
      geslachtsverbuiging (*vaca búlgara*, maar *pingüino peruano*). Dat is
      weken werk, geen dagen.
    - De identiteit gaat als **structuur** over de lijn (welk land, welk woord),
      niet als platte tekst, zodat elke client hem in de **eigen app-taal**
      rendert. Daarmee lost dit ook het laatste gat van punt 8 op: vandaag maakt
      de server de naam in de taal van de ROOM, dus een Spanjaard ziet nu een
      Nederlandse naam.
    - `effectiveName` blijft bestaan voor spelers die zélf een naam typen; de
      gegenereerde identiteit vervangt alleen de automatische naam.

    **Open bij de bouw** (geen besluit gevraagd, wel te beslissen door wie het
    bouwt): wat er gebeurt met een land waarvoor een taal nog geen bijvoeglijke
    vorm heeft. Voorstel regie: per ontbrekend geval terugvallen op de
    "uit"-vorm, zodat een onvolledige woordenlijst nooit een lege naam oplevert
    en de lijst per taal kan groeien.

    Volledige uitwerking en de afweging: `DOELBEELD-v2-schermen-en-games.md`
    §6.6.

42. **Het spelerskleurenpalet gaat van acht naar zestien** (producteigenaar,
    5 aug 2026 — punt 20). GEBOUWD.

    De vraag was 36 kleuren. Inschatting daarvan: één tot anderhalve dag,
    waarvan het meeste in de designronde ging zitten — 36 tinten die op donker
    én licht leesbaar zijn én onderling te onderscheiden, plus een raster van
    36 in de UI en een herziening van de kleur/vorm-herkenning. Zestien geeft
    hetzelfde gevoel ("mijn eigen kleur, niet die van de buurman") voor
    ongeveer een derde van dat werk, en past in twee rijen van acht.

    - **De bestaande acht blijven staan, op dezelfde plek in de lijst.** Er
      kunnen rooms in Redis leven met een speler die `purple` heeft, en de
      server wijst bij join round-robin toe op volgorde van deze lijst.
      Aanvullen mag, herschikken niet.
    - **De acht nieuwe zijn dieper van toon**: `blue #1f7ae0`, `teal #0f9285`,
      `indigo #6a4fe6`, `violet #b34ad6`, `rose #c8377e`, `moss #4f9422`,
      `rust #b8542a`, `slate #63718c`. De heldere acht zijn ontworpen om op
      bijna-zwart te lichten (5,7–16:1) maar halen op het lichte thema
      1,05–2,96:1; de nieuwe halen **≥3,3:1 op béíde** oppervlakken
      (`#14141a` en `#f4f4fa`). Dat lichtheidsverschil maakt ze meteen ook
      onderscheidbaar van hun heldere buur.
    - **Onderlinge verwarbaarheid is niet toegenomen**: de kleinste afstand in
      het palet van zestien is nog steeds het bestáánde paar magenta/red
      (OKLab 0,097); elk nieuw paar zit op ≥0,115.
    - De hash-identiteit (`player-chip.mjs`: `PALET` × `VORMEN`) blijft
      ongemoeid en telt nog steeds acht tinten × acht vormen. Die is de
      terugval voor spelers zónder serverkleur en staat los van deze enum; de
      vorm blijft uit de `playerId` komen, dus zestien serverkleuren maken het
      onderscheid alleen groter. Geen herziening nodig.
    - De enum blijft gesloten: een zeventiende waarde is een vormfout en komt
      als `INVALID_ANSWER_FORMAT` op de wire, zonder eigen foutcode.
    - Vier plekken houden dezelfde lijst: `client-events-dispatch.mjs` (bron),
      `server-events-room-lifecycle.mjs`, `room-lifecycle.mjs` en
      `transport-mock.mjs`; `player-chip.mjs` levert de hexwaarden. Tests
      bewaken de pariteit én de contrastondergrens.

## Uitvoeringsakkoord test- en deploymentwerk

De producteigenaar heeft akkoord gegeven om de eerder geparkeerde test- en
deploymentonderdelen te realiseren. Dat omvat dependency- en uitvoeringscheckpoints
voor Playwright, loadtests, integratie/E2E, chaos/restarttests, devicechecks, CI en
de benodigde servercomposition.

Dit akkoord heft technische prerequisites niet op: tests worden pas geactiveerd
wanneer hun server, UI, Compose-stack of aangewezen testomgeving bestaat. Publieke
routes, productiegegevens en secrets blijven afzonderlijk afgeschermd; het akkoord
is geen toestemming om tests destructief tegen productie uit te voeren.

43. **Het voorkeurenmenu is op elke breedte een dropdown** (producteigenaar,
    5 aug 2026). GEBOUWD.

    T5-7 maakte vanaf 768 px een vast side panel van het voorkeurenpaneel: het
    stond permanent open ín de header en de ⋯-knop verdween. Op een breed
    scherm was TAAL / THEMA / REACTIEZINNEN daardoor het eerste wat je op de
    homepagina zag — drie blokken hoog, bóven het logo.

    - Oordeel producteigenaar: "een slechte binnenkomer". Het zijn instellingen
      die je één keer per apparaat zet, geen inhoud.
    - **Waarom het zo lang onzichtbaar bleef:** het ruimtebudget van de
      mobiele UX-ronde is een telefoonbudget en alle metingen stonden op
      390 px. Daar gold de regel nooit. Les: een breekpunt dat we niet meten,
      bestaat voor ons niet.
    - Technisch stond er `display: flex !important` op `.app-menu`, wat het
      `hidden`-attribuut versloeg dat `app-menu.mjs` correct bleef zetten. De
      JS was dus nooit het probleem.
    - Vervangt de tabletvariant uit T5-7; besluit UI-20 (het paneel zelf
      blijft bestaan) is ongewijzigd.

44. **Reactiezinnen: minimaal vijftig, nooit twee tegelijk** (producteigenaar,
    5 aug 2026). VASTGELEGD, NOG NIET GEBOUWD.

    Er zijn er nu **zes** (`headline.*` in de locales) en het scherm toont er
    één per ronde. Bij vijf rondes zie je in één avond de halve voorraad.

    - **Doel: 50 tot 100 zinnen per taal.** Dat is redactiewerk, geen
      programmeerwerk — de selectielogica in `social-headline.mjs` blijft zoals
      hij is.
    - **Nooit twee tegelijk.** De eerdere vraag "streak én 'jij was de enige'
      naast elkaar tonen" vervalt: de producteigenaar noemt dat vaag en raar.
      Eén zin, de sterkste.
    - Drie talen, dus reken op 150–300 zinnen in totaal. Ze mogen per taal
      groeien; de code hoeft er niet op te wachten.

45. **De gamekeuze wordt de Rounda-donut op zijn kant** (producteigenaar,
    5 aug 2026). VASTGELEGD, NOG NIET GEBOUWD.

    Vervangt het eerdere voorstel "strip van vier kaartjes naast elkaar" — dat
    was een idee van de regie, niet van de producteigenaar, en het vervalt.

    Je kijkt tegen de zíjkant van de donut aan; dat is het Rounda-logo. Op de
    rand staan de games. Draai je naar links of rechts, dan komt de volgende
    game in beeld. Omdat je op een computer niet veegt, staan er links en
    rechts pijltjes waarop je kunt klikken.

    - De pijltjes bestaan al in de huidige carrousel; de draaiing en het
      donutbeeld zijn nieuw.
    - Dit is een visueel concept, geen laadstructuur: welke games speelbaar
      zijn blijft `shared/content/game-catalog.mjs`.

46. **Intypen levert meer punten op dan kiezen** (producteigenaar, 6 aug 2026).
    VASTGELEGD, NOG NIET GEBOUWD.

    Basisscore bij de intyp-modus wordt 150 in plaats van 100; de
    snelheidsbonus blijft ongewijzigd. Reden: op een telefoon kost intikken
    seconden, en zonder correctie straft de snelheidsbonus je duimen in plaats
    van je kennis. In **Mix** staan beide vormen in één partij, dus de scores
    moeten vergelijkbaar blijven.

    Overwogen en niet gekozen: één schaal met een maximum van 100 die naar 10
    zakt als je laat bent (producteigenaar). Te mager aan de onderkant.

47. **Spelersidentiteit begint met zestig landen** (producteigenaar,
    6 aug 2026).

    Niet alle 230. De landbijvoeglijke naamwoorden (*Griekse*, *Bulgaarse*,
    *Peruaanse*) zijn per land onregelmatig en per taal anders; ze zijn niet af
    te leiden uit de landnaam. Zestig landen is één dag schrijven per taal, 230
    is weken. De lijst kan later groeien zolang de terugval op de "uit"-vorm
    werkt (besluit 41).

    Het speelse woord zelf (*Gans*) en een eventueel kleurwoord (*Grijze*) zijn
    gewone woordenlijsten van dertig stuks — die gelden voor álle landen en
    kosten vrijwel niets.

48. **Verlopen room en onbekende code worden apart gemeld** (producteigenaar,
    6 aug 2026). GEBOUWD.

    Nu heten een verlopen room, een verkeerd getypte code en een verbroken
    verbinding alle drie "Deze game bestaat niet (meer)". De producteigenaar
    vraagt om de professionele keuze: het onderscheid echt maken.

    Vereist dat de server onthoudt dát een roomcode bestaan heeft nadat de room
    is opgeruimd. Zonder zo'n spoor is het verschil niet vast te stellen.

    **Gebouwd als een grafsteen:** bij het claimen van een code schrijft de
    server `room:used:{code}`, een sleutel die zeven dagen leeft en niets
    bevat dan het feit dát de code gebruikt is — geen namen, geen scores, geen
    roomId. De poort kreeg er twee methoden bij (`markCodeSeen`,
    `hasCodeBeenSeen`), wat de lijst zelf expliciet toestaat. Nieuwe foutcode
    `GAME_EXPIRED`, ook 404: het verschil zit in de melding, niet in de status.

    Hiermee is de open vraag uit `docs/protocol-plan/README.md` §1 beslist.
    De meldingen luiden nu: *"Deze code klopt niet. Kijk je hem na?"* tegenover
    *"Deze game is afgelopen."*

49. **Hoger/lager en Hoofdsteden gaan alsnog aan** (producteigenaar,
    6 aug 2026). NOG NIET GEBOUWD.

    Verruimt besluit C-2 (het portfolio is de vier games uit doelbeeld v2):
    deze twee waren al gebouwd in de regellaag maar stonden nergens aan. Ze
    worden speelbaar gemaakt.

    | Game | Wat er nog moet gebeuren |
    | --- | --- |
    | Hoger/lager | alleen de contentbron; spelscherm en uitslag bestaan al — paar uur |
    | Hoofdsteden | contentbron én een spelscherm — halve dag |

    **Omgekeerde hoofdstedenvraag** (producteigenaar): naast "wat is de
    hoofdstad van Peru?" ook "Lima hoort bij welk land?". Die tweede is
    sterker: je moet de kaart in je hoofd hebben in plaats van een naam te
    herkennen. De pool heeft de hoofdsteden al in drie talen
    (`countries.data.mjs`), dus dit is dezelfde data andersom gelezen.

    Zoals altijd: pas in `PLAYABLE_GAME_TYPES` als álle vijf de schakels
    bestaan — vraagselectie, contentbron, spelscherm, uitslag én mock.

50. **Het uitslagscherm houdt twee momenten** (producteigenaar, 6 aug 2026).
    GEBOUWD EN DEELS TERUGGEDRAAID — zie de aanvulling onderaan.

    | Moment | Nu | Wordt |
    | --- | --- | --- |
    | 1 — de uitslag (`ROUND_RESULT`) | alles bovenaan geplakt, onderste helft leeg | inhoud verticaal gecentreerd, vult het scherm |
    | 2 — de stand (`SCOREBOARD`) | schuift eronder, uitslagkaart blijft groot | uitslagkaart krimpt tot één regel bovenaan, de stand krijgt de ruimte |

    De twee momenten blijven omdat het echte spelfases zijn: `scoreboardFrequency`
    laat de host de tussenstand uitzetten of om de zoveel rondes tonen. Alles
    tegelijk tonen maakt die instelling betekenisloos en haalt het onderscheid
    weg tussen "dit was het antwoord" en "en dit is de stand".

    Wat vervalt is de lege onderhelft. Die wordt bovendien duurder naarmate
    besluit 44 (50–100 reactiezinnen) en besluit 41 (spelersidentiteit) landen:
    op moment 2 wil je juist ruimte voor wíé het goed had.

    Uitvoering: CSS plus de bestaande beat-logica in `scoreboard.mjs`. Lead.

51. **"Antwoord automatisch tonen" uit → het onthullen ÍS de hostactie, door
    de ronde LATER af te sluiten, niet door een fase over te slaan** (lead,
    6 aug 2026; herziening van besluit 40-C). GEBOUWD.

    Een eerste poging (`git revert` van merge `b55a44e`, 5 aug 2026) had de
    kern omgekeerd: die introduceerde `HOST_REVEAL` als state-machine-event
    vanuit `ROUND_RESULT` en maakte `phaseEndsAt` daar voorwaardelijk. Gemeten
    met een browser stond het antwoord dan al bij het verstrijken van de tijd
    (`endRound()` had het al onthuld), en de hostknop deed "doorgaan vanaf de
    uitslag" in plaats van "toon het antwoord". De testsuite was groen —
    alleen een browser liet het verschil zien. Zie
    `docs/openstaand/antwoord-automatisch-tonen.md` voor de volledige
    nabeschouwing.

    De juiste vorm: `GameConfiguration.autoReveal` (verplichte boolean,
    standaard `true`) bepaalt alleen WANNEER `endRound()` wordt aangeroepen,
    niet WELKE fase-overgangen er bestaan. Staat hij op `false`, dan plant de
    server bij het openen van de ronde geen automatische `round:ended` meer
    in — de ronde blijft `ROUND_ACTIVE` voorbij de deadline (spelers zien hun
    timer gewoon aftellen; `round:answer` sluit al op de bestaande
    deadline+grace-toets, besluit 13). Het nieuwe hostevent `game:reveal` roept
    dezelfde `endRound()` rechtstreeks aan — geweigerd als de deadline nog
    niet voorbij is, of als `autoReveal` al aan staat. `state-machine.js` en
    `match-lifecycle.mjs` blijven **ongewijzigd**: er is geen nieuw event, geen
    overgeslagen fase. `ROUND_RESULT`/`SCOREBOARD` lopen na het onthullen —
    wanneer dat ook gebeurt — gewoon getimed door zoals altijd (besluit 1
    blijft dus intact zonder aparte uitzondering: het onthullen ís de ene
    hostactie van de ronde, er komt geen tweede knop "Volgende" bij).

52. **Continentfilter: standaard alle landen, een host mag continenten
    uit-/aanzetten, geen ondergrens op het aantal** (punt 7 productspec,
    docs/openstaand/continentfilter.md). DEELS GEBOUWD.

    `GameConfiguration.continents` (verplichte, niet-lege lijst uit de zes
    continenten van de contentpool) filtert de kandidatenpool in
    `buildCandidatePool` (`server/rules/question-selection.js`) — dezelfde
    trechter die elke spelvorm al gebruikt, dus één filterplek voor alle zes
    spelvormen. Standaard (`QUICK_START_CONFIG`) alle zes; geen configuratie
    nodig voor het bestaande gedrag.

    Kiest een host één continent, dan valt "Welke hoort er niet bij" terug op
    `fake_among_real`/`real_among_fake` in plaats van zijn continentvariant —
    zonder foutmelding, want die variant heeft per definitie minstens twee
    continenten nodig. Een continent dat op een gekozen moeilijkheidsgraad te
    weinig landen overhoudt voor vier antwoordopties (`flags_mc` e.a.) krijgt
    bewust geen eigen vangnet: dat loopt via `startRound()`'s bestaande
    `buildQuestion`-try/catch (`match-lifecycle.mjs`) naar `CONTENT_UNAVAILABLE`
    — zichtbaar falen, geen stille hang.

    NOG NIET GEBOUWD: het live bijstellen door de host. `continents` is
    create-only (net als `questionSeconds`); zowel `POST /api/v1/games` als
    `game:update-config` valideren hun payload in `server/protocol/` (resp.
    `rest-games-create-join.mjs` en `client-events-dispatch.mjs`'s
    `UPDATABLE_CONFIG_KEYS`), en dat bestandspad was deze sessie bewust
    buiten scope (een andere agent werkte daar tegelijk aan iets anders). De
    lobby-UI ("Meer instellingen" → continenttoggles) bestaat, roept dezelfde
    `pushConfig`-route aan als de andere instellingen en werkt in solo via de
    mock — maar bereikt een echte server pas als `continents` ook in
    `UPDATABLE_CONFIG_KEYS` (of de create-payload) staat.

53. **Het paspoort: elk land dat je zag, per apparaat** (producteigenaar,
    6 aug 2026). NOG NIET GEBOUWD.

    Aan het einde van een partij zie je welke landen je al gehad hebt, en dat
    onthoudt je telefoon voor de volgende keer.

    | Vraag | Besluit |
    | --- | --- |
    | Alleen goed geraden, of elk land dat je zag? | **Elk land dat je zag** — het is een reisverslag, geen cijferlijst |
    | Tellen de afleiders mee? | **Nee.** Alleen het land waar de vraag over ging |
    | Wat als de kaart vol is? | Een verrassing. Wat die is, is nog niet bepaald |

    **Op het apparaat, niet op de server.** Het oorspronkelijke voorstel was
    "in de sessie", maar een room leeft vier uur en verdwijnt dan — het
    paspoort zou precies verdwijnen op het moment dat het interessant wordt.
    Het staat daarom in `localStorage`, naast de bestaande sessiesleutels.

    **En dat blijft zo.** De producteigenaar wijst er expliciet op dat de stap
    van geen-accounts naar wel-accounts omslachtig is, en dat we niet eens
    weten of gebruikers accounts wíllen. Een paspoort dat per apparaat leeft
    is daarom niet de goedkope versie van iets beters — het is het antwoord.
    Zodra het iets wordt dat je kunt verliezen of moet beschermen, botst het
    met de reden dat deze app in tien seconden te starten is.

    De contouren van 225 landen liggen sinds 6 aug in `shapes.data.mjs`
    (gemigreerd voor "Raad het land"), dus een ingekleurde wereldkaart komt er
    bijna gratis bij zodra die renderer bestaat.

    **Aanvulling, 6 aug 2026 — het schermvullende deel is teruggedraaid.**

    Zoals gebouwd centreerde moment 1 de inhoud verticaal en kromp de kaart in
    moment 2 tot één regel. Op een echte telefoon zag de producteigenaar
    daardoor "vraag, antwoord, compleet nieuw random scherm met score" — precies
    wat besluit 40 (één scherm) niet wil.

    Gemeten: de kaart stond in moment 1 op 144px en sprong in moment 2 naar
    60px, én kromp van 129px naar 43px hoog. Twee veranderingen tegelijk laten
    het onvermijdelijk als een tweede scherm lezen.

    De lege onderhelft die dit besluit wilde wegnemen, blijkt bovendien geen
    loze ruimte: dat is precies waar de tussenstand een paar tellen later
    landt. Vullen door te centreren betekende dus altijd een sprong.

    **Wat blijft:** twee momenten, want `scoreboardFrequency` laat de host de
    tussenstand uitzetten of om de zoveel rondes tonen.
    **Wat vervalt:** het centreren en het krimpen. De kaart staat stil op 60px
    en het scherm vult zichzelf aan.

54. **Je mag je antwoord wijzigen tot de tijd om is; de laatste tik telt**
    (producteigenaar, 6 aug 2026). GEBOUWD.

    Herziet `GAME-RULES.md`: *"één antwoord per speler per ronde; wijzigen is
    niet toegestaan"*. Dat was er altijd al en de server dwong het af met
    `ALREADY_ANSWERED`, maar het is nooit als besluit vastgelegd — en het is
    niet wat een speler verwacht.

    **De laatste tik telt, ook voor de snelheidsbonus.** Dat is de kern van de
    keuze. Overwogen en niet gekozen:

    | | Wat | Waarom niet |
    | --- | --- | --- |
    | B | Eerste tik telt voor de tijd | Dan wordt snel gokken en daarna corrigeren de beste strategie |
    | C | Wisselen mag, geen snelheidsbonus | Verandert het hele spel |

    Uit te leggen in één zin: *je tijd loopt tot je klaar bent.* Wie meteen
    zeker is, wint nog steeds.

    Raakt: de server (een tweede antwoord wordt een overschrijving in plaats
    van `ALREADY_ANSWERED`, tot de deadline), het spelscherm, de mock, en de
    regel in `GAME-RULES.md`.

55. **Tijd per vraag wordt instelbaar** (producteigenaar, 6 aug 2026).
    GEBOUWD.

    Staat vast op 15 seconden en de host kan er niets aan veranderen. Gemeten
    op de live-app: precies 15,08 seconden van vraag tot uitslag, met een
    kloppende aftelling — de timer loopt dus niet te snel, hij staat te kort.

    De host kan al aantal vragen, niveau, taal, continenten, snelheidsbonus,
    later meedoen, automatisch volgende en automatisch tonen instellen. Tijd
    per vraag hoort in datzelfde rijtje, in "Meer instellingen".

    **Voorstel regie:** dezelfde vorm als het niveau — drie knoppen. Rustig
    (25 s), normaal (15 s), snel (10 s). Dan hoeft niemand een getal te typen
    en is de standaard nog steeds wat hij nu is.

    Wat er níét mee opgelost wordt: dat 15 seconden voor "Raad het land" iets
    anders betekent dan voor "Raad de vlag". Per gameType verschillende tijden
    is denkbaar, maar dat is een tweede besluit — eerst laten instellen.

