# Bevestigde projectbesluiten

**Status:** bindend voor de multiplayer-MVP  
**Bevestigd door producteigenaar:** 2 augustus 2026

Dit document ontdubbelt de menselijke checkpoints uit de realisatieplannen. Bij
strijdigheid met een ouder plan, prompt, handoff- of progressbestand geldt dit
document totdat de betreffende fundamentele specificatie is bijgewerkt.

## Spelverloop en protocol

1. Host-tempo gebruikt **één hostactie per ronde**. `ROUND_RESULT` loopt op timer
   door naar `SCOREBOARD`; de host kiest daarna “Volgende”. Sinds besluit 43
   kan die ene actie ergens anders zitten — nooit een tweede erbij.
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
      Uitgewerkt en gebouwd als besluit 43 (5 aug 2026).
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

43. **"Antwoord automatisch tonen" uit → het onthullen ÍS de hostactie**
    (lead, 5 aug 2026; uitwerking van besluit 40-C). GEBOUWD.

    `GameConfiguration.autoReveal` is een verplichte boolean, standaard `true`.
    Staat hij op `false`, dan krijgt `ROUND_RESULT` geen `phaseEndsAt` en
    blijft het scherm op de uitslag staan tot de host `game:reveal` stuurt;
    daarna loopt de ronde gewoon door naar de tussenstand of de volgende vraag.

    De botsing met besluit 1 is zó beslecht: met host-tempo én handmatig
    onthullen zou de host twee knoppen per ronde krijgen. Dat mag niet, dus de
    ene hostactie **verhuist** van `SCOREBOARD` naar `ROUND_RESULT`. Bij
    `autoReveal: false` is `game:next` ongeldig — ook bij `pacing: "host"` — en
    loopt de tussenstand op zijn eigen timer. Er komt géén tweede knop
    "Volgende" bij; de hostbalk toont "Toon antwoord" op precies de plek waar
    anders "Volgende" staat.

    De state machine kent hiervoor één nieuw event, `HOST_REVEAL` vanuit
    `ROUND_RESULT`. Dat is nadrukkelijk niet de teruggedraaide
    `HOST_NEXT`-vanuit-`ROUND_RESULT`-tak (INT-10): die liep vast omdat de
    client de actie nooit aanbood. `autoReveal` zit niet in de reducer — die
    krijgt bij `false` de pacing `'auto'` te zien, en `match-lifecycle.mjs` is
    de poort die het event weigert zodra automatisch tonen aanstaat.

## Uitvoeringsakkoord test- en deploymentwerk

De producteigenaar heeft akkoord gegeven om de eerder geparkeerde test- en
deploymentonderdelen te realiseren. Dat omvat dependency- en uitvoeringscheckpoints
voor Playwright, loadtests, integratie/E2E, chaos/restarttests, devicechecks, CI en
de benodigde servercomposition.

Dit akkoord heft technische prerequisites niet op: tests worden pas geactiveerd
wanneer hun server, UI, Compose-stack of aangewezen testomgeving bestaat. Publieke
routes, productiegegevens en secrets blijven afzonderlijk afgeschermd; het akkoord
is geen toestemming om tests destructief tegen productie uit te voeren.
