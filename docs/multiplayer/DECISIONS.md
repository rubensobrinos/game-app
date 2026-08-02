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
30. De precieze autoriteit/afleiding tussen `Room.phase` en `Match.phase` is nog
    niet bevestigd. Wel bevestigd: JSON eerst; geen implementatie mag een
    niet-atomair dual-write-pad introduceren.

## Productscope

31. Groepsbattle wordt nu niet gebouwd. Eerdere vier-versus-vijf-presetbesluiten
    zijn daardoor geen huidige implementatieopdracht.
32. Mixed games worden nu niet gebouwd. Een match gebruikt voorlopig één
    `gameType`; dit is een MVP-scopekeuze, geen verwijdering van de latere feature.
33. Teams en spectators blijven latere uitbreidingen, zoals hierboven bevestigd.
34. Voor Golf 2 is geen nieuw besluit genomen. Canonieke IDs en feature-gates
    blijven uitgesteld.

## Uitvoeringsakkoord test- en deploymentwerk

De producteigenaar heeft akkoord gegeven om de eerder geparkeerde test- en
deploymentonderdelen te realiseren. Dat omvat dependency- en uitvoeringscheckpoints
voor Playwright, loadtests, integratie/E2E, chaos/restarttests, devicechecks, CI en
de benodigde servercomposition.

Dit akkoord heft technische prerequisites niet op: tests worden pas geactiveerd
wanneer hun server, UI, Compose-stack of aangewezen testomgeving bestaat. Publieke
routes, productiegegevens en secrets blijven afzonderlijk afgeschermd; het akkoord
is geen toestemming om tests destructief tegen productie uit te voeren.
