# Traceability-matrix — PROTOCOL.md (DT1a)

**Status: voorstel, geen bindend contract.** Fase DT1a van [`README.md`](README.md),
uitgevoerd volgens
[`prompts/DT1a-traceability-matrix.md`](prompts/DT1a-traceability-matrix.md). Aanleiding:
[`prompts/REVIEW.md`](prompts/REVIEW.md) #5 — een zelf afgeleid schema kan ongemerkt het
feitelijke protocolcontract worden. Deze matrix koppelt daarom eerst elk gedocumenteerd
payloadveld/regel uit [`docs/multiplayer/PROTOCOL.md`](../multiplayer/PROTOCOL.md) aan
zijn brontekst en, waar de tekst dat echt toelaat, aan een open beslispunt. Er wordt hier
niets geïmplementeerd, gevalideerd of geactiveerd — de contracttestlaag zelf wordt
inmiddels door de `PROTOCOL.md`-eigenaar gebouwd (PR7, zie [`README.md`](README.md),
bijwerking 2026-08-02), niet door dit plan.

## Legenda

- **Brontekst-referentie (§)** — sectiekop uit `PROTOCOL.md`, letterlijk overgenomen.
- **Verplicht/optioneel** — `verplicht` of `optioneel` zoals de tekst dat aangeeft (`?`
  in de eventtabel, `null` in een voorbeeld); `impliciet` waar dit uitsluitend uit een
  JSON-voorbeeld valt af te leiden zonder formele markering; `n.v.t.` voor procesregels
  zonder eigen payloadveld.
- **Open beslispunt** — verwijst naar een genummerd item in
  [Overzicht open beslispunten](#overzicht-open-beslispunten). Leeg laten betekent: de
  brontekst is hier ondubbelzinnig, er is geen eigen aanname stilzwijgend vastgelegd.

## 0. Basisregels en authenticatie (context voor alle vijf bronsecties)

| Veld/regel | Brontekst-referentie (§) | Verplicht/optioneel | Open beslispunt |
| --- | --- | --- | --- |
| Transport: HTTPS (create/join/snapshot), WebSocket/Socket.IO (realtime), JSON, tijden in epoch-ms servertijd | (intro) Transport | verplicht | |
| 1. Server is autoritair | Basisregels | n.v.t. | |
| 2. Eén socket ↔ precies één tijdelijke sessie + room, gekoppeld bij handshake | Basisregels | verplicht | |
| 3. Bearer token niet herhaald in elke eventpayload | Basisregels | n.v.t. | |
| 4. Geen correct antwoord/scorebeslissing vóór de ronde is afgelopen | Basisregels | verplicht | OQ-1 |
| 5. Elke muterende clientactie heeft unieke `actionId` | Basisregels | verplicht | OQ-2 |
| 6. Snapshot is leidend boven eerder ontvangen events | Basisregels | n.v.t. | |
| 7. Onbekend serverevent: negeren; onbekend clientevent: `UNSUPPORTED_EVENT` | Basisregels | n.v.t. | |
| 8. Productieteksten client-side; server geeft alleen foutcode + veilige metadata, geen stacktrace | Basisregels | n.v.t. | |
| Geen accounts; sessie is tijdelijk | Authenticatie en tijdelijke sessies | n.v.t. | |
| `sessionToken`: cryptografisch random bearer token voor precies één room; server bewaart alleen een hash | Authenticatie en tijdelijke sessies | verplicht | |
| `session.roles: string[]` (voorbeeld: `["host","player"]`) | Authenticatie en tijdelijke sessies | verplicht | OQ-11 |
| `session.playerId: string \| null` | Authenticatie en tijdelijke sessies | verplicht | |
| Host die niet meespeelt: `roles:["host"]`, `playerId:null` | Authenticatie en tijdelijke sessies | verplicht | |
| REST: `Authorization: Bearer <sessionToken>` header | REST-auth | verplicht | |
| Socket: `auth.sessionToken` | Socket-auth | verplicht | |
| Socket: `auth.protocolVersion` (voorbeeld: `"v1"`) | Socket-auth | verplicht | |
| Na auth kent server room/sessie/speler; events bevatten daarom geen token of code | Authenticatie en tijdelijke sessies | n.v.t. | |

## 1. Event-envelope

| Veld/regel | Brontekst-referentie (§) | Verplicht/optioneel | Open beslispunt |
| --- | --- | --- | --- |
| `event` (client → server) | Event-envelope > Client → server | verplicht | |
| `actionId` (client → server) | Event-envelope > Client → server | verplicht | OQ-2 |
| `payload` (client → server, object, mag `{}` zijn) | Event-envelope > Client → server | verplicht | |
| `event` (server → client) | Event-envelope > Server → client | verplicht | |
| `eventId` (server → client) | Event-envelope > Server → client | verplicht | |
| `serverTime` (server → client, epoch-ms) | Event-envelope > Server → client | verplicht | |
| `payload` (server → client, object) | Event-envelope > Server → client | verplicht | |
| `actionId` (ack) | Event-envelope > Ack | verplicht | |
| `ok` (ack, boolean) | Event-envelope > Ack | verplicht | OQ-3 |
| `serverTime` (ack) | Event-envelope > Ack | verplicht | |
| `payload` (ack) | Event-envelope > Ack | verplicht | |
| Retry met dezelfde `actionId` → dezelfde logische ack, geen herhaalde mutatie | Event-envelope (slotzin) | n.v.t. | |

## 2. REST-endpoints

| Veld/regel | Brontekst-referentie (§) | Verplicht/optioneel | Open beslispunt |
| --- | --- | --- | --- |
| Request `config.preset`, `config.language` (`POST /api/v1/games`) | `POST /api/v1/games` | impliciet (vorm van `config` zelf niet gespecificeerd, zie DATA-MODEL.md/GAME-RULES.md) | |
| Request `hostParticipates` (`POST /api/v1/games`) | `POST /api/v1/games` | impliciet | OQ-4 |
| Request `displayName` (nullable) (`POST /api/v1/games`) | `POST /api/v1/games` | optioneel (`null` toegestaan; server genereert `effectiveName` als `null`, zie voorbeeld) | |
| Response `roomId`, `gameCode`, `inviteId`, `joinUrl`, `sessionToken`, `roles`, `state` (`POST /api/v1/games`) | `POST /api/v1/games` | verplicht | |
| Response `playerId`, `effectiveName` — `null` wanneer `hostParticipates:false` (`POST /api/v1/games`) | `POST /api/v1/games` | verplicht (waarde conditioneel) | |
| Request: precies één van `inviteId` / `gameCode` (`POST /api/v1/games/join`) | `POST /api/v1/games/join` | verplicht (XOR, letterlijk "precies één locator") | |
| Request `displayName` (nullable) (`POST /api/v1/games/join`) | `POST /api/v1/games/join` | optioneel | |
| Request `joinSource: qr\|shared_link\|code\|unknown` (`POST /api/v1/games/join`) | `POST /api/v1/games/join` | impliciet | OQ-5 |
| Response `roomId`, `gameCode`, `sessionToken`, `roles`, `playerId`, `effectiveName`, `state` (`POST /api/v1/games/join`) | `POST /api/v1/games/join` | verplicht | |
| Vereist geldige sessietoken; retourneert volledige actuele snapshot | `GET /api/v1/games/{code}/state` | n.v.t. | zie §3 State-snapshot |
| Vrijwillig verlaten; vereist spelerrol | `POST /api/v1/games/{code}/leave` | n.v.t. | OQ-6 |
| `serverTime` (epoch-ms) | `GET /api/v1/time` | verplicht | |
| Client neemt meerdere samples, gebruikt round-trip-midpoint voor offset | `GET /api/v1/time` | n.v.t. | |

### 2a. Algemene REST-opmerking

De REST-bodies gebruiken, anders dan de client→server-eventtabel (die `?` gebruikt voor
optionele velden), geen expliciete required/optional-markering. "Impliciet" hierboven
betekent: alleen af te leiden uit voorbeeld-aan-/afwezigheid en nullability, niet uit een
formele regel (OQ-24).

## 3. State-snapshot (gedeeld door `GET .../state` en `room:state`)

| Veld/regel | Brontekst-referentie (§) | Verplicht/optioneel | Open beslispunt |
| --- | --- | --- | --- |
| `protocolVersion`, `serverTime` | State-snapshot | verplicht | |
| `room.code`, `room.locked`, `room.allowLateJoin`, `room.joinUrl`, `room.playerCount` | State-snapshot | verplicht | |
| `room.phase` (voorbeeldwaarde: `"ROUND_ACTIVE"`) | State-snapshot | verplicht | OQ-7 |
| `room.config` (opaak, `{}` in voorbeeld) | State-snapshot | verplicht, interne vorm niet gespecificeerd | |
| `room.matchId` | State-snapshot | verplicht | |
| `self.roles`, `self.playerId`, `self.effectiveName`, `self.score`, `self.position`, `self.answeredCurrentRound` | State-snapshot | verplicht | |
| `currentRound` (opaak, `{}` in voorbeeld) | State-snapshot | verplicht, interne vorm niet gespecificeerd | OQ-8 |
| `scoreboard.top`, `scoreboard.self` (opaak, `[]`/`{}` in voorbeeld) | State-snapshot | verplicht, interne vorm niet gespecificeerd | OQ-9 |
| "Minimale structuur" (letterlijke tekst boven het voorbeeld) | State-snapshot | n.v.t. | OQ-24 (mogelijk aanvullende velden buiten dit voorbeeld) |
| Snapshot bevat nooit het correcte antwoord van een actieve ronde | State-snapshot (slotzin) | verplicht | |

## 4. Client → server events

| Event | Rol | Payload | Belangrijkste validatie | Brontekst-referentie (§) | Open beslispunt |
| --- | --- | --- | --- | --- | --- |
| `game:start` | host | `{}` | fase LOBBY, minimaal één speler | Client → server events | OQ-10 |
| `game:pause` | host | `{ reason?: string }` | actieve game | Client → server events | OQ-7 (welke fase(n) tellen als "actief") |
| `game:resume` | host | `{}` | fase PAUSED | Client → server events | |
| `game:next` | host | `{}` | host-tempo en wachtfase | Client → server events | OQ-7 |
| `game:lock` | host | `{ locked: boolean }` | room bestaat | Client → server events | |
| `game:kick` | host | `{ playerId }` | speler bestaat, niet zichzelf als enige host | Client → server events | OQ-11 |
| `game:finish` | host | `{}` | niet reeds FINISHED | Client → server events | |
| `game:rematch` | host | `{}` | fase FINISHED | Client → server events | |
| `player:rename` | player | `{ displayName }` | alleen lobby, maximaal eenmaal | Client → server events | OQ-12 |
| `player:leave` | player | `{}` | actieve sessie | Client → server events | OQ-6 |
| `round:answer` | player | zie §4a | ronde actief, speelgerechtigd, niet eerder geantwoord | Client → server events; `round:answer` | OQ-13, OQ-14 |
| `share:opened` | host/player | `{ method: "qr" \| "link" \| "native" }` | analytics, mag falen zonder UX-effect | Client → server events | OQ-2 (telt dit als "muterend"?) |

### 4a. `round:answer` — payloadvarianten per antwoordvorm

| Variant | `answer`-veld | Brontekst-referentie (§) | Verplicht/optioneel | Open beslispunt |
| --- | --- | --- | --- | --- |
| Meerkeuze | `{ optionId: string }` | `round:answer` | verplicht (`roundId`, `answer`, `clientAnsweredAt` in elk voorbeeld) | OQ-14 |
| Binair | `{ choice: string }` | `round:answer` | verplicht | OQ-14 |
| Hoger/lager | `{ side: number }` | `round:answer` | verplicht | |
| Buitenbeentje | `{ cardIndex: number }` | `round:answer` | verplicht | |
| Typen | `{ text: string }` | `round:answer` | verplicht | |
| `clientAnsweredAt` — uitsluitend diagnostiek, `receivedAt` op de server bepaalt deadline/bonus | `round:answer` | verplicht | |

### 4b. Idempotentie van antwoorden

| Regel | Brontekst-referentie (§) | Open beslispunt |
| --- | --- | --- |
| Zelfde `actionId` → zelfde ack | Idempotentie van antwoorden | |
| Nieuwe `actionId`, zelfde inhoud na al geaccepteerd antwoord → `ALREADY_ANSWERED` | Idempotentie van antwoorden | |
| Nieuwe `actionId`, ander antwoord na al geaccepteerd antwoord → `ALREADY_ANSWERED` | Idempotentie van antwoorden | |
| Score en state veranderen nooit tweemaal | Idempotentie van antwoorden | |

## 5. Server → client events

| Event | Ontvangers | Kernpayload (letterlijk uit de bron) | Brontekst-referentie (§) | Open beslispunt |
| --- | --- | --- | --- | --- |
| `room:state` | één sessie | volledige snapshot | Server → client events | zie §3 |
| `room:player-changed` | room | count + join/leave/rename/kick-delta | Server → client events | OQ-15 |
| `room:lock-changed` | room | `locked` | Server → client events | |
| `game:started` | room | `matchId`, `totalRounds`, `countdownEndsAt` | Server → client events | |
| `game:paused` | room | reden, vorige fase | Server → client events | OQ-16 |
| `game:resumed` | room | nieuwe countdown/tijden | Server → client events | OQ-16 |
| `round:started` | room | vraag, opties, tijden | Server → client events; Voorbeeld `round:started` | zie §5a (volledig voorbeeld beschikbaar) |
| `round:answer-accepted` | één speler | `roundId` | Server → client events | |
| `round:progress` | room | `answeredCount`, `eligiblePlayerCount` | Server → client events | OQ-13 |
| `round:ended` | room + persoonlijke velden | correct antwoord, verdeling, eigen punten | Server → client events | OQ-16, OQ-17 |
| `scoreboard:updated` | room + persoonlijke velden | top 5, eigen positie | Server → client events | OQ-16, OQ-17 |
| `game:finished` | room + persoonlijke velden | podium, eigen samenvatting | Server → client events | OQ-16, OQ-17 |
| `game:rematch-started` | room | nieuwe `matchId`, lobby-state | Server → client events | OQ-16 |
| `session:kicked` | één sessie | reden | Server → client events | OQ-18 |
| `session:revoked` | één sessie | reden | Server → client events | OQ-18 |
| `error` | relevante sessie | foutcode + veilige metadata | Server → client events; Foutcodes | zie §6 (volledig voorbeeld beschikbaar) |
| `round:progress` max. 2×/seconde gebroadcast | Server → client events (slotzin) | n.v.t. | |

### 5a. Voorbeeld `round:started` — volledige payload

| Veld | Brontekst-referentie (§) | Verplicht/optioneel | Open beslispunt |
| --- | --- | --- | --- |
| `event`, `eventId`, `serverTime` | Voorbeeld `round:started` | verplicht | zie §1 (envelope) |
| `payload.matchId`, `payload.roundId`, `payload.roundNumber`, `payload.totalRounds` | Voorbeeld `round:started` | verplicht | |
| `payload.gameType` (voorbeeld: `"real_or_fake_flag"`) | Voorbeeld `round:started` | verplicht | OQ-14 |
| `payload.contentVersion` | Voorbeeld `round:started` | verplicht | |
| `payload.question.promptKey` | Voorbeeld `round:started` | verplicht | |
| `payload.question.image.kind/seed/rendererVersion`, `payload.question.image.spec.pattern/palette` | Voorbeeld `round:started` | verplicht in dit voorbeeld | OQ-19 |
| `payload.question.options[].optionId/labelKey` | Voorbeeld `round:started` | verplicht | OQ-14 |
| `payload.startsAt`, `payload.endsAt` (epoch-ms) | Voorbeeld `round:started` | verplicht | |
| "De juiste optie is niet afleidbaar uit ID, volgorde, URL, seed of metadata" | Voorbeeld `round:started` (slotzin) | n.v.t. | |

## 6. Foutcodes

| Categorie | Foutcodes | Brontekst-referentie (§) | Open beslispunt |
| --- | --- | --- | --- |
| Room en join | `GAME_NOT_FOUND`, `INVITE_INVALID`, `GAME_FULL`, `GAME_ALREADY_STARTED`, `LATE_JOIN_DISABLED`, `ROOM_LOCKED`, `CODE_RATE_LIMITED` | Foutcodes > Room en join | |
| Autorisatie | `TOKEN_INVALID`, `TOKEN_EXPIRED`, `SESSION_REVOKED`, `NOT_HOST`, `NOT_PLAYER` | Foutcodes > Autorisatie | OQ-22 (handshakefouten) |
| Game en ronde | `INVALID_PHASE`, `ROUND_NOT_ACTIVE`, `PLAYER_NOT_ELIGIBLE`, `ALREADY_ANSWERED`, `DEADLINE_PASSED`, `INVALID_ANSWER_FORMAT`, `UNSUPPORTED_EVENT` | Foutcodes > Game en ronde | |
| Input | `NAME_TOO_LONG`, `NAME_INVALID`, `RATE_LIMITED`, `PROTOCOL_VERSION_UNSUPPORTED` | Foutcodes > Input | |
| `event`, `eventId`, `serverTime` (foutenvelope) | Foutcodes (clientresponse-voorbeeld) | verplicht | zie §1 (envelope) |
| `payload.actionId` | Foutcodes (clientresponse-voorbeeld) | verplicht in dit voorbeeld | OQ-22 |
| `payload.code` | Foutcodes (clientresponse-voorbeeld) | verplicht | OQ-20 (is de lijst gesloten?) |
| `payload.meta` (opaak, `{}` in voorbeeld) | Foutcodes (clientresponse-voorbeeld) | verplicht, interne vorm per code niet gespecificeerd | OQ-21 |
| Debugdetails alleen naar serverlogs | Foutcodes (slotzin) | n.v.t. | |

## 7. Reconnect en inputveiligheid (raakt payloadvorm, geen eigen bronsectie in de opdracht)

| Regel | Brontekst-referentie (§) | Open beslispunt |
| --- | --- | --- |
| Backoff 1, 2, 4, 8, 16, max. 30 s; socketauth met dezelfde `sessionToken` | Reconnect | |
| Na reconnect vraagt client altijd een snapshot op | Reconnect | OQ-23 (via welk kanaal?) |
| Snapshot vervangt lokale fase, score en antwoordstatus | Reconnect | |
| Reeds geaccepteerd antwoord niet opnieuw gestuurd, tenzij client geen ack heeft en dezelfde `actionId` herhaalt | Reconnect | |
| Displaynamen: NFKC-genormaliseerd, control/onzichtbare tekens verwijderd, max. 20 zichtbare tekens | Inputveiligheid | OQ-25 |
| Server bewaart/verstuurt naam als platte tekst; frontend gebruikt nooit `innerHTML` | Inputveiligheid | |
| Alle payloads schema-gevalideerd; payloadgrootte begrensd | Inputveiligheid | OQ-26 (geen concreet getal gegeven) |

## Overzicht open beslispunten

1. **OQ-1** — Basisregel 4 zegt dat niets vóór "de ronde is afgelopen" de server mag
   verlaten, maar definieert dat moment niet: het verstrijken van `endsAt`, een interne
   statusovergang, of het versturen van `round:ended`?
2. **OQ-2** — Basisregel 5 eist een unieke `actionId` voor "muterende" clientacties. De
   envelopevoorbeelden tonen `actionId` bij elk client-event, ook bij het puur
   informatieve `share:opened` ("mag falen zonder UX-effect"). Geldt de actionId/ack-
   plicht voor alle client-events, of alleen voor de acties die daadwerkelijk state
   wijzigen?
3. **OQ-3** — Alleen een geslaagde ack (`ok: true`) is als voorbeeld gegeven. Bestaat er
   ook een falende ack (`ok: false`) naast het losse `error`-event, of loopt elke
   afwijzing altijd via dat aparte event terwijl acks uitsluitend bij succes verschijnen?
4. **OQ-4** — Is `hostParticipates` bij `POST /api/v1/games` verplicht, of heeft het een
   default (bijvoorbeeld `true`) wanneer het veld ontbreekt?
5. **OQ-5** — `joinSource` heeft een expliciete enum, maar niet of het veld verplicht is
   (geen `?`-notatie zoals in de eventtabel, geen voorbeeld waarin het ontbreekt).
6. **OQ-6** — `POST /api/v1/games/{code}/leave` en het socket-event `player:leave` lijken
   hetzelfde te doen ("vrijwillig verlaten" resp. "actieve sessie"-validatie). Wanneer
   gebruikt een client welke, en zijn de effecten identiek?
7. **OQ-7** — Geen uitputtende enumeratie van `room.phase`: expliciet genoemd zijn LOBBY,
   PAUSED, FINISHED en (via het snapshotvoorbeeld) ROUND_ACTIVE. `game:next` noemt
   daarnaast een ongedefinieerde "wachtfase", en de term "host-tempo" suggereert een
   mogelijke alternatieve (auto-advance) modus die nergens verder beschreven wordt.
8. **OQ-8** — Is `currentRound` in de snapshot vormgelijk aan de payload van
   `round:started` (inclusief eventuele per-speler velden), of een apart schema? De
   snapshot toont het veld alleen als opaak `{}`.
9. **OQ-9** — De interne vorm van `scoreboard.top` (array-elementvorm) en
   `scoreboard.self` is nergens gegeven, alleen `[]`/`{}` in het voorbeeld.
10. **OQ-10** — Telt een wél-participerende host als "minimaal één speler" voor
    `game:start`, of moet er minstens één aparte joiner zijn?
11. **OQ-11** — `game:kick`'s validatie "niet zichzelf als enige host" veronderstelt de
    mogelijkheid van meer dan één host per room, maar niets in het document beschrijft
    hoe een room een tweede host krijgt (alleen `POST /api/v1/games` maakt één
    hostsessie aan).
12. **OQ-12** — Geldt `player:rename`'s "maximaal eenmaal" per match/lobby-cyclus, of
    ooit voor die sessie? Reset die telling bij `game:rematch` (nieuwe `matchId`, terug
    naar lobby)?
13. **OQ-13** — Wat maakt een speler "speelgerechtigd" (`round:answer`-validatie,
    `eligiblePlayerCount` in `round:progress`)? Bijvoorbeeld: telt een speler die
    halverwege een ronde laat toetreedt mee voor die lopende ronde?
14. **OQ-14** — Geen tabel koppelt `gameType`-waarden aan een van de vijf
    `answer`-varianten. Het voorbeeld `round:started` toont `gameType:
    "real_or_fake_flag"` met een `options`-array (`optionId: "real"/"fake"`), wat qua
    vorm overeenkomt met de "Meerkeuze"-variant (`answer.optionId`) — niet met de apart
    gedocumenteerde "Binair"-variant (`answer.choice`) die de naam "real_or_fake" juist
    zou doen verwachten.
15. **OQ-15** — `room:player-changed`'s "join/leave/rename/kick-delta" heeft geen
    gegeven veldnamen of discriminator-vorm per wijzigingstype.
16. **OQ-16** — Voor `game:paused`, `game:resumed`, `round:ended`, `scoreboard:updated`,
    `game:finished` en `game:rematch-started` geeft de brontekst alleen een
    natuurlijke-taalomschrijving van de inhoud ("reden, vorige fase", "podium, eigen
    samenvatting", ...), geen veldnamen. Alleen `round:started` heeft een volledig
    JSON-voorbeeld (zie §5a).
17. **OQ-17** — Bezorgmechanisme van "room + persoonlijke velden"
    (`round:ended`, `scoreboard:updated`, `game:finished`): één broadcast met een
    generiek + per-ontvanger-specifiek deel in dezelfde payload, of een per-socket
    gepersonaliseerde variant van het event?
18. **OQ-18** — Is `session:kicked`/`session:revoked`'s "reden" een van de bestaande
    foutcodes (bijvoorbeeld `SESSION_REVOKED`), een vrij tekstveld, of een eigen enum?
19. **OQ-19** — `question.image` is alleen als `generated_flag`-voorbeeld met bijbehorend
    `spec.pattern`/`spec.palette` gegeven. Is `image` verplicht voor elk `gameType`, en
    welke andere `image.kind`-waarden met welke `spec`-vorm bestaan voor niet-vlag-vragen?
20. **OQ-20** — Basisregel 7 beschrijft alleen de afhandeling van onbekende *events*.
    Niets zegt hoe een client moet omgaan met een `error`-event met een niet-herkende
    `code`-waarde: is de foutcodelijst gegarandeerd gesloten, of moet een client
    generiek terugvallen?
21. **OQ-21** — De vorm van `payload.meta` in het foutenvelope is expliciet "veilige
    metadata" genoemd maar per foutcode niet gespecificeerd (bevat `RATE_LIMITED`
    bijvoorbeeld een `retryAfterMs`?).
22. **OQ-22** — Auth-handshakefouten (`TOKEN_INVALID`/`TOKEN_EXPIRED`/
    `PROTOCOL_VERSION_UNSUPPORTED` tijdens de socket-handshake, vóór er een event is
    uitgewisseld) hebben geen omschreven bezorgmechanisme: hetzelfde `error`-eventformaat
    (met welke `actionId`, aangezien er nog geen clientactie was?), een Socket.IO
    `connect_error`, of anders?
23. **OQ-23** — Reconnect-stap 5 zegt dat de client "altijd een snapshot" opvraagt, maar
    niet via welk kanaal: het bestaande REST-endpoint `GET /api/v1/games/{code}/state`,
    of een socket-verzoek dat verder nergens in de eventtabellen genoemd wordt?
24. **OQ-24** — "Minimale structuur" boven het snapshotvoorbeeld laat open of er velden
    buiten dit voorbeeld bestaan die een striktere schema (`additionalProperties: false`)
    zou afwijzen.
25. **OQ-25** — "Maximaal 20 zichtbare tekens" specificeert geen telmethode: Unicode
    grapheme clusters (gebruikersperceptie, relevant bij emoji na de genoemde
    NFKC-normalisatie) of code points/UTF-16-eenheden?
26. **OQ-26** — "Payloadgrootte wordt begrensd" noemt geen concreet getal of eenheid.

Cross-cutting: REST-bodies markeren verplicht/optioneel niet formeel zoals de
client→server-eventtabel dat met `?` doet (zie §2a) — dit raakt meerdere rijen hierboven
(OQ-4, OQ-5) en is geen apart genummerd punt om dubbeltelling te voorkomen.

## Keuze schemavorm

Twee opties, hier voorgesteld — geen van beide wordt hier gekozen of geactiveerd.
**DT1b is vervallen** (zie [`README.md`](README.md), bijwerking 2026-08-02): de
`PROTOCOL.md`-eigenaar bouwt de contracttestlaag zelf (PR7) en maakt deze keuze dus
zelfstandig voor die eigen implementatie, niet ik namens hen.

**Optie A — echt JSON Schema + validator-library (bijvoorbeeld Ajv).**
Voordeel: standaardformaat met native ondersteuning voor `required`/optionele
eigenschappen, `oneOf`/`anyOf` voor discriminated unions (relevant voor de vijf
`round:answer`-varianten, OQ-14, en voor eventuele `question.image.kind`-varianten,
OQ-19), `additionalProperties: false` om onverwachte velden te weigeren, en
versiebeheer via `$id`. Nadeel: introduceert een nieuwe runtime-dependency — dat is een
eigen `deps`-checkpoint (`always_ask`), niet iets wat deze fase of DT1b zelfstandig mag
activeren (zie CLAUDE.md §Beslisbevoegdheid).

**Optie B — klein, dependency-vrij handmatig validatorcontract.**
Voordeel: nul nieuwe packages; `node:assert` + `node:test`, sluit direct aan bij
uitgangspunt 6 van [`README.md`](README.md) ("geen nieuwe dependencies om te
beginnen"), direct uitvoerbaar zonder `deps`-checkpoint. Nadeel: geen standaardformaat;
`required`/optioneel, unions en "geen extra velden toegestaan"-gedrag moeten per veld
met de hand geschreven worden, en blijven daardoor makkelijker impliciet dan bij een
echt schema — precies het risico dat REVIEW.md #5 benoemt.

Beide opties zijn hier bewust naast elkaar gezet, als input voor de
`PROTOCOL.md`-eigenaar bij hun eigen PR7-fasering — geen beslissing voor dit
document.

## Verzoek om bevestiging

Dit document is een **voorstel**, geen vastgesteld contract, en blijft dat ook nu
`DT1b` is vervallen: deze matrix bouwt geen eigen contract-afdwingende testcode meer
(zie [`README.md`](README.md)), maar blijft waardevol als onafhankelijke audit naast
PR7. Concreet verzoek aan de `PROTOCOL.md`-eigenaar:

1. Bevestig of corrigeer de 26 open beslispunten in
   [Overzicht open beslispunten](#overzicht-open-beslispunten) — met prioriteit voor
   OQ-7 (`room.phase`-enumeratie inclusief "wachtfase"), OQ-14 (koppeling `gameType` ↔
   `answer`-variant, uniek aan deze matrix — zie addendum) en OQ-16 (ontbrekende
   veldnamen voor het merendeel van de server→client-kernpayloads).
2. Geef aan of deze matrix velden, events of regels uit `PROTOCOL.md` heeft gemist.
3. Zie het [addendum](#addendum-2026-08-02--kruisverwijzing-met-protocol-plans-eigen-open-vragen)
   hieronder voor hoe deze 26 punten zich verhouden tot protocol-plan's eigen 15
   "Open vragen" — één gecombineerde blik in plaats van twee losse verzoeken.

Geen enkele rij in deze matrix geldt als bindend; ze is en blijft input voor de
`PROTOCOL.md`-eigenaar, niet een contract dat ik zelf afdwing.

## Addendum (2026-08-02) — kruisverwijzing met protocol-plan's eigen "Open vragen"

De `PROTOCOL.md`-eigenaar heeft inmiddels een eigen plan
([`docs/protocol-plan/README.md`](../protocol-plan/README.md)) met een eigen,
onafhankelijk opgestelde lijst van 15 open vragen, en bouwt de contracttestlaag zelf
(zie [`README.md`](README.md), bijwerking DT1b). Deze twee lijsten zijn onafhankelijk
tot stand gekomen — geen van beide citeert de ander. Om te voorkomen dat de
`PROTOCOL.md`-eigenaar twee losse, deels overlappende verzoeken om bevestiging
krijgt, hieronder een korte reconciliatie. Dit vervangt geen van beide documenten;
het is uitsluitend een leeswijzer.

**Hetzelfde gat, andere invalshoek** (beide lijsten kunnen met één antwoord dicht):

| Hier | Daar (protocol-plan, Open vragen) | Gat |
| --- | --- | --- |
| OQ-6 | #4 | `POST /leave` vs. `player:leave`: relatie tussen de twee, en of `leave` de token intrekt / een "verlaten"-status oplevert. |
| OQ-7 | #2 | `room.phase`/`game:paused.reason`: geen uitputtende fase-enum, geen onderscheid tussen de vier situaties die `reason` delen (incl. serverherstart). |
| OQ-13 | #3 | Wat maakt een speler "speelgerechtigd" — hier vanuit `round:answer`/`round:progress`, daar vanuit het ontbreken van een proactief `eligible`-veld. |
| OQ-16 (deels) | #11 | `round:ended`'s "verdeling" heeft geen veldnamen (hier) resp. geen genoemde eigenaar-module (daar). |
| OQ-18 | #7 | `session:kicked`/`session:revoked`: hier de vorm van "reden", daar het ontbrekende triggerscenario voor `session:revoked` zelf. |
| OQ-19 | #10 | `question`-payloadvorm alleen voor (in essentie) multiple-choice/`generated_flag` uitgewerkt; de andere spelvormen ontbreken. |

**Alleen hier gevonden** (protocol-plan's lijst raakt dit niet — blijft dus alleen
via deze matrix onder de aandacht):

- **OQ-14** — scherpste bevinding van deze matrix: de `round:started`-voorbeeldpayload
  gebruikt `gameType: "real_or_fake_flag"` met een `options`-array die qua vorm bij de
  "Meerkeuze"-variant hoort (`answer.optionId`), niet bij de apart gedocumenteerde
  "Binair"-variant (`answer.choice`) die de naam juist doet verwachten. Geen tabel
  koppelt `gameType`-waarden aan een antwoordvariant.
- OQ-1, OQ-2, OQ-3, OQ-8, OQ-9, OQ-10, OQ-11, OQ-12, OQ-15, OQ-17, OQ-20, OQ-21,
  OQ-22, OQ-23, OQ-24, OQ-25, OQ-26 — envelopedetails, foutafhandelingsdetails en
  vormgrenzen die buiten protocol-plan's onderzoeksrichting vielen.

**Alleen daar gevonden** (niet in deze matrix — vaak net buiten "gedocumenteerde
tekst is ambigu" en meer "protocoloppervlak ontbreekt" of cross-plan, dus buiten het
bereik dat deze matrix beoogde):

- protocol-plan #1 (room-TTL geen eigen foutcode), #5 (`joinUrl`-constructie
  ongespecificeerd), #6 (`joinSource` kent 4 waarden, `share:opened.method` maar 3 —
  scherpe cross-check), #8 (geen team-protocoloppervlak), #9 (spectatorroute geen
  auth-mechanisme), #12 (deadline-grace vs. `DEADLINE_PASSED`-grens), #13
  (`roundNumber`/`countdownEndsAt` geen bronveld in `DATA-MODEL.md`), #14
  (`game:rematch`-scorereset, Player is room- niet match-scoped), #15
  (content-module niet importeerbaar — implementatiegat, geen tekstambiguïteit).

**Samengevat voor wie dit oppakt:** prioriteer bij bevestiging eerst OQ-7/#2,
OQ-14 (uniek hier) en protocol-plan #6 (uniek daar, scherpe cross-check) — die drie
raken de grootste oppervlakte van elke afgeleide schemavorm aan beide kanten.
