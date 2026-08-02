# PROTOCOL.md — Contract tussen client en server

**Protocolversie:** `v1`

> **PR9-update (2 augustus 2026), op basis van `DECISIONS.md`:** deze revisie
> maakt een aantal velden verplicht (`self.eligibleFromRound`, de volledige
> `room.pausedState`-vorm) die er voorheen niet waren. Dat is **geen** zuiver
> additieve, wire-compatibele wijziging — een verplicht nieuw veld voldoet niet
> aan oudere `v1`-payloads die het niet kennen. Dit is contractueel strenger,
> niet additief. `protocolVersion` blijft niettemin op `v1`, omdat dit protocol
> nog niet publiek is uitgerold: er bestaat nog geen externe client die hierdoor
> breekt. Vóór een publieke compatibiliteitsgarantie moet een volgende
> contractwijziging met eenzelfde effect opnieuw expliciet worden afgewogen
> (nieuwe versie versus geaccepteerde strengere `v1`).

Transport:

- HTTPS voor create, join en snapshots;
- WebSocket/Socket.IO voor realtime events;
- JSON-payloads;
- tijden in epoch-milliseconden volgens servertijd.

## Basisregels

1. De server is autoritair.
2. Een socket wordt tijdens de handshake aan precies één tijdelijke sessie en room
   gekoppeld.
3. Bearer tokens worden niet in iedere eventpayload herhaald.
4. Geen correct antwoord of scorebeslissing verlaat de server vóór de ronde is afgelopen.
5. Iedere muterende clientactie heeft een unieke `actionId`.
6. Snapshots zijn leidend boven eerder ontvangen events.
7. Onbekende serverevents mogen clients negeren; onbekende clientevents leveren
   `UNSUPPORTED_EVENT`.
8. Productieteksten komen client-side uit vertalingen; de server retourneert foutcodes en
   veilige metadata, geen stacktraces.

## Authenticatie en tijdelijke sessies

Er bestaan geen accounts.

Een `sessionToken` is een cryptografisch willekeurige bearer token voor één room. De
server bewaart alleen een hash. De bijbehorende sessie bevat rollen:

```json
{
  "roles": ["host", "player"],
  "playerId": "p_8f42d1"
}
```

Een host die niet meespeelt heeft:

```json
{
  "roles": ["host"],
  "playerId": null
}
```

### REST-auth

```http
Authorization: Bearer <sessionToken>
```

### Socket-auth

```json
{
  "auth": {
    "sessionToken": "<token>",
    "protocolVersion": "v1"
  }
}
```

Na authenticatie kent de server room, sessie en eventuele speler. Events hoeven daarom
geen token of code te bevatten.

## Event-envelope

### Client → server

```json
{
  "event": "round:answer",
  "actionId": "act_01J...",
  "payload": {}
}
```

### Server → client

```json
{
  "event": "round:started",
  "eventId": "evt_01J...",
  "serverTime": 1785623412000,
  "payload": {}
}
```

### Ack

```json
{
  "actionId": "act_01J...",
  "ok": true,
  "serverTime": 1785623412050,
  "payload": {}
}
```

Bij een retry met dezelfde `actionId` retourneert de server dezelfde logische ack zonder
de mutatie opnieuw uit te voeren.

## REST-endpoints

### `POST /api/v1/games`

Maakt een room en hostsessie aan.

Request:

```json
{
  "config": {
    "preset": "quick_start",
    "language": "nl"
  },
  "hostParticipates": true,
  "displayName": null
}
```

`preset` canoniek vastgesteld op `"quick_start"` (was `"group_battle"`, achterhaald
sinds besluit 31 de Groepsbattle-naamgeving schrapte terwijl besluit 35 de
kernflow behoudt). Dit is de waarde die de compositielaag al gebruikt
(`server/composition/room-lifecycle.mjs`); `client/flow/host-setup-state.mjs`'s
`'default'` moet hierop worden aangepast (`docs/integration-plan/HANDOFF.md`,
INT-11).

Response:

```json
{
  "roomId": "room_01J...",
  "gameCode": "482917",
  "inviteId": "N4x7pQm2K8tW",
  "joinUrl": "https://play.aseso.nl/j/N4x7pQm2K8tW",
  "sessionToken": "<secret>",
  "roles": ["host", "player"],
  "playerId": "p_a1b2c3",
  "effectiveName": "Vlugge Vos",
  "state": {}
}
```

Wanneer `hostParticipates = false` zijn `playerId` en `effectiveName` `null`.

### `GET /api/v1/games/preview`

Licht pre-join-previewendpoint: valideert de invite en levert een
servergegenereerde naamsuggestie vóór `POST /games/join` (`DECISIONS.md`,
punt 7).

**Uitsluitend `inviteId`** — geen `gameCode`-variant. Dit wijkt af van een eerdere
versie van deze sectie (die ook `gameCode` en een kale `{ suggestedName }`-respons
voorstelde); dat contract is vervangen door de daadwerkelijk gebouwde en geteste
`previewInvite()` in de compositielaag, om te voorkomen dat er twee afwijkende
contracten naast elkaar bestaan (`docs/integration-plan/HANDOFF.md`, INT-8):

```http
GET /api/v1/games/preview?inviteId=<inviteId>
```

Succesrespons:

```json
{
  "roomId": "room_01J...",
  "suggestedName": "Vlugge Vos",
  "phase": "LOBBY",
  "locked": false,
  "allowLateJoin": true,
  "playerCount": 23,
  "maxPlayers": 100
}
```

Foutcodes:

- ongeldige `inviteId` (verkeerd formaat): `INVITE_INVALID`;
- syntactisch geldige maar onbekende of verlopen `inviteId`: `GAME_NOT_FOUND`
  (dezelfde code als een verlopen room-TTL, zie §Foutcodes).

Grenzen:

- de respons onthult **geen** spelersnamen of hostgegevens — `playerCount` (een
  aantal, geen namenlijst) en de overige roomstatusvelden hierboven zijn bewust
  wél opgenomen, gelijk aan de al gebouwde compositielaag;
- `GAME_NOT_FOUND` lekt geen extra roomdetails;
- `suggestedName` volgt dezelfde naamlimiet als bij join (maximaal 20 zichtbare
  tekens, zie §Inputveiligheid);
- preview maakt **geen** sessie of speler aan — de respons bevat dus nooit
  `sessionToken` of `playerId`; de uiteindelijke, unieke naam wordt pas door
  `POST /games/join` bepaald en kan afwijken bij een botsing.

### `POST /api/v1/games/join`

Joinen via code of inviteId.

Request, precies één locator:

```json
{
  "inviteId": "N4x7pQm2K8tW",
  "displayName": null,
  "joinSource": "qr"
}
```

of:

```json
{
  "gameCode": "482917",
  "displayName": "Ruben",
  "joinSource": "code"
}
```

`joinSource`: `qr | shared_link | code | unknown`.

Response:

```json
{
  "roomId": "room_01J...",
  "gameCode": "482917",
  "sessionToken": "<secret>",
  "roles": ["player"],
  "playerId": "p_8f42d1",
  "effectiveName": "Ruben",
  "state": {}
}
```

### `GET /api/v1/games/{code}/state`

Volledige actuele snapshot. Vereist geldige sessietoken.

### `POST /api/v1/games/{code}/leave`

Vrijwillig verlaten. Vereist spelerrol. Dit trekt het `sessionToken` **niet**
in — reactivatie binnen de TTL door opnieuw te joinen blijft mogelijk. Een
kick, expliciete server-/beheerintrekking of TTL-verval kunnen het token wel
intrekken (zie `session:kicked`/`session:revoked`).

### `GET /api/v1/time`

Lichtgewicht tijdsync-endpoint:

```json
{ "serverTime": 1785623412000 }
```

De client meet meerdere samples en gebruikt het midpoint van de request round-trip om
de offset te schatten.

## State-snapshot

Minimale structuur:

```json
{
  "protocolVersion": "v1",
  "serverTime": 1785623412000,
  "room": {
    "code": "482917",
    "phase": "ROUND_ACTIVE",
    "locked": false,
    "allowLateJoin": true,
    "joinUrl": "https://play.aseso.nl/j/N4x7pQm2K8tW",
    "playerCount": 23,
    "config": {},
    "matchId": "match_01J...",
    "matchSequence": 2,
    "pausedState": null
  },
  "self": {
    "roles": ["player"],
    "playerId": "p_8f42d1",
    "effectiveName": "Ruben",
    "score": 600,
    "position": 7,
    "answeredCurrentRound": false,
    "eligibleFromRound": 1
  },
  "currentRound": {},
  "scoreboard": {
    "top": [],
    "self": {}
  }
}
```

`self.eligibleFromRound` is een **integer ≥ 1**: het 1-based `roundNumber`
vanaf wanneer de speler speelgerechtigd is (relevant voor late joiners).
Servervalidatie via `PLAYER_NOT_ELIGIBLE` blijft leidend; dit veld is alleen
voor proactieve clientweergave (`DECISIONS.md`, punt 3).

`room.matchSequence` is `Match.sequence` uit `DATA-MODEL.md` (integer ≥ 1,
ordent matches binnen een room totaal). Toegevoegd om drie samenhangende
problemen op te lossen die alleen op `serverTime` ordenen niet dekt: een
snapshot van een vórige match die nieuwere state kan overschrijven bij een
gelijke `serverTime`, een niet-gedetecteerde `matchId`-terugkeer, en het
ontbreken van een matchwissel-signaal bij `game:rematch-started` (client moet
score/streak/rondetimer resetten — `GAME-FLOW.md` §12). Clients ordenen eerst op
`matchSequence`, dan pas op `serverTime` binnen die match
(`docs/integration-plan/HANDOFF.md`, INT-2).

`room.pausedState` is `null` wanneer de room niet gepauzeerd is. Gepauzeerd
heeft het de volledige vorm, gelijk aan het live `game:paused`-event (zie
§Server → client events):

```json
{
  "previousPhase": "ROUND_ACTIVE",
  "remainingMs": 12500,
  "reason": "host",
  "pausedAt": 1785623412000
}
```

(`DECISIONS.md`, punt 10.)

Een snapshot bevat nooit het correcte antwoord van een actieve ronde.

## Client → server events

| Event | Vereiste rol | Payload | Belangrijkste validatie |
| --- | --- | --- | --- |
| `game:start` | host | `{}` | fase LOBBY, minimaal één speler |
| `game:pause` | host | `{ reason?: string }` | actieve game |
| `game:resume` | host | `{}` | fase PAUSED |
| `game:next` | host | `{}` | host-tempo en wachtfase |
| `game:lock` | host | `{ locked: boolean }` | room bestaat |
| `game:kick` | host | `{ playerId }` | speler bestaat, niet zichzelf als enige host |
| `game:finish` | host | `{}` | niet reeds FINISHED |
| `game:rematch` | host | `{}` | fase FINISHED |
| `player:rename` | player | `{ displayName }` | alleen lobby, maximaal eenmaal |
| `player:leave` | player | `{}` | actieve sessie |
| `round:answer` | player | zie hieronder | ronde actief, speelgerechtigd, niet eerder geantwoord |
| `share:opened` | host/player | `{ method: "qr" \| "link" \| "native" \| "code" }` | analytics, mag falen zonder UX-effect |

`share:opened.method` is gelijkgetrokken met de vier herkomsten uit
`POST /games/join`'s `joinSource` (`DECISIONS.md`, punt 18): `qr`, `link`,
`native` en `code` (handmatige codeweergave).

### `round:answer`

Meerkeuze:

```json
{
  "roundId": "round_07",
  "answer": { "optionId": "opt_2" },
  "clientAnsweredAt": 1785623418451
}
```

Binair:

```json
{
  "roundId": "round_07",
  "answer": { "choice": "real" },
  "clientAnsweredAt": 1785623418451
}
```

Hoger/lager:

```json
{
  "roundId": "round_07",
  "answer": { "side": 0 },
  "clientAnsweredAt": 1785623418451
}
```

Buitenbeentje:

```json
{
  "roundId": "round_07",
  "answer": { "cardIndex": 3 },
  "clientAnsweredAt": 1785623418451
}
```

Typen:

```json
{
  "roundId": "round_07",
  "answer": { "text": "Argentinie" },
  "clientAnsweredAt": 1785623418451
}
```

`clientAnsweredAt` is uitsluitend diagnostiek. `receivedAt` op de server bepaalt
deadline en bonus.

### Idempotentie van antwoorden

- zelfde `actionId`: zelfde ack;
- nieuwe `actionId`, zelfde inhoud na reeds geaccepteerd antwoord:
  `ALREADY_ANSWERED`;
- nieuwe `actionId`, ander antwoord na reeds geaccepteerd antwoord:
  `ALREADY_ANSWERED`;
- score en state veranderen nooit tweemaal.

## Server → client events

| Event | Ontvangers | Kernpayload |
| --- | --- | --- |
| `room:state` | één sessie | volledige snapshot |
| `room:player-changed` | room | count + join/leave/rename/kick-delta |
| `room:lock-changed` | room | `locked` |
| `game:started` | room | `matchId`, `totalRounds`, `countdownEndsAt` |
| `game:paused` | room | volledige `pausedState` (zie hieronder) |
| `game:resumed` | room | nieuwe countdown/tijden |
| `round:started` | room | vraag, opties, tijden, `contentVersion`, `rendererVersion` |
| `round:answer-accepted` | één speler | `roundId` |
| `round:progress` | room | `answeredCount`, `eligiblePlayerCount` |
| `round:ended` | room + persoonlijke velden | correct antwoord, antwoordverdeling, eigen punten |
| `scoreboard:updated` | room + persoonlijke velden | top 5, eigen positie |
| `game:finished` | room + persoonlijke velden | podium, eigen samenvatting |
| `game:rematch-started` | room | nieuwe `matchId`, lobby-state |
| `session:kicked` | één sessie | reden |
| `session:revoked` | één sessie | reden (zie hieronder) |
| `error` | relevante sessie | foutcode + veilige metadata |

`round:progress` wordt maximaal tweemaal per seconde gebroadcast.

### `game:paused`

Draagt dezelfde volledige `pausedState`-vorm als de snapshot (`DECISIONS.md`,
punt 10):

```json
{
  "event": "game:paused",
  "eventId": "evt_01J...",
  "serverTime": 1785623412000,
  "payload": {
    "previousPhase": "ROUND_ACTIVE",
    "remainingMs": 12500,
    "reason": "host",
    "pausedAt": 1785623412000
  }
}
```

`reason` is een van vier MVP-waarden (`DECISIONS.md`, punt 11):

- `host` — expliciete hostpauze;
- `host_disconnected` — host raakte de verbinding kwijt;
- `no_answers` — opeenvolgende rondes zonder antwoorden;
- `server_recovery` — een serverherstart die actieve rooms automatisch
  pauzeert.

Clients houden een generieke fallback voor onbekende `reason`-waarden, zodat
een latere vijfde reden geen harde clientfout veroorzaakt.

### `session:revoked`

Uitsluitend voor expliciete server-/beheerintrekking van een sessietoken
(`DECISIONS.md`, punt 17). Een kick gebruikt in plaats daarvan
`session:kicked`; vrijwillig verlaten (`POST /leave`) en TTL-verval gebruiken
géén van beide events — die zijn zichtbaar via respectievelijk `left: true` en
een nieuwe `GAME_NOT_FOUND`/`TOKEN_EXPIRED`-afwijzing bij de eerstvolgende
aanroep, niet via een gepusht event.

### `round:ended`

De rules-/servicelaag berekent de antwoordverdeling; het protocol
transporteert en valideert alleen de uitkomstvorm (`DECISIONS.md`, punt 14).
De verdeling bevat **geen** `resultDetails`-achtige velden (bijv. de rauwe
metriekwaarde van `higher_lower`, of `majorityContinent`/`minorityContinent`
van `odd_one_out`) die tijdens de ronde al naar `round:started` hadden mogen
lekken — die velden mogen pas hier, ná afloop van de ronde, meegaan.

## Voorbeeld `round:started`

Vijf voorbeelden, één per `gameType`, in de daadwerkelijke
`publicQuestionPayload`-vorm uit `server/rules/question-selection.js`
(`selectFlagsMcQuestion`, `selectCapitalsMcQuestion`,
`selectRealOrFakeFlagQuestion`, `selectHigherLowerQuestion`,
`selectOddOneOutQuestion`) — niet een verzonnen presentatievorm. `correctAnswer`
staat **nooit** in `round:started`; die gaat pas mee in `round:ended`, in de
vormen die `DECISIONS.md`, punt 15, bevestigt.

Elk voorbeeld toont ook het nieuwe, algemene top-level `rendererVersion`-veld,
naast het al bestaande `contentVersion` — beide canoniek en onveranderlijk op
`Match`, meegestuurd met elke roundpayload voor **elke** `gameType`
(`DECISIONS.md`, punt 21), niet alleen voor `real_or_fake_flag`.

### `flags_mc`

```json
{
  "event": "round:started",
  "eventId": "evt_01J...",
  "serverTime": 1785623411900,
  "payload": {
    "matchId": "match_01J...",
    "roundId": "round_03",
    "roundNumber": 3,
    "totalRounds": 10,
    "gameType": "flags_mc",
    "contentVersion": "2026.08.1",
    "rendererVersion": "flag-renderer-1",
    "question": {
      "targetIso2": "FR",
      "optionIso2s": ["FR", "DE", "IT", "ES"]
    },
    "startsAt": 1785623412000,
    "endsAt": 1785623427000
  }
}
```

`correctAnswer` (alleen in `round:ended`): `{ "optionId": "FR" }`.

### `capitals_mc`

Dezelfde `question`-vorm als `flags_mc` (`targetIso2` + `optionIso2s`) — de
hoofdstad zelf komt uit de gedeelde contentmodule, niet uit de payloadvorm:

```json
{
  "event": "round:started",
  "eventId": "evt_01J...",
  "serverTime": 1785623411900,
  "payload": {
    "matchId": "match_01J...",
    "roundId": "round_04",
    "roundNumber": 4,
    "totalRounds": 10,
    "gameType": "capitals_mc",
    "contentVersion": "2026.08.1",
    "rendererVersion": "flag-renderer-1",
    "question": {
      "targetIso2": "NL",
      "optionIso2s": ["NL", "BE", "DE", "PT"]
    },
    "startsAt": 1785623412000,
    "endsAt": 1785623427000
  }
}
```

`correctAnswer` (alleen in `round:ended`): `{ "optionId": "NL" }`.

### `real_or_fake_flag`

Twee subvarianten van `question`, afhankelijk van `kind`. `"real"` verwijst
naar een echt land:

```json
{
  "event": "round:started",
  "eventId": "evt_01J...",
  "serverTime": 1785623411900,
  "payload": {
    "matchId": "match_01J...",
    "roundId": "round_05",
    "roundNumber": 5,
    "totalRounds": 10,
    "gameType": "real_or_fake_flag",
    "contentVersion": "2026.08.1",
    "rendererVersion": "flag-renderer-1",
    "question": { "kind": "real", "iso2": "IT" },
    "startsAt": 1785623412000,
    "endsAt": 1785623427000
  }
}
```

`correctAnswer`: `{ "choice": "real" }`.

`"generated"` draagt een gegenereerde vlagspec:

```json
{
  "event": "round:started",
  "eventId": "evt_01J...",
  "serverTime": 1785623411900,
  "payload": {
    "matchId": "match_01J...",
    "roundId": "round_06",
    "roundNumber": 6,
    "totalRounds": 10,
    "gameType": "real_or_fake_flag",
    "contentVersion": "2026.08.1",
    "rendererVersion": "flag-renderer-1",
    "question": {
      "kind": "generated",
      "seed": "fx_91b2c3a0",
      "rendererVersion": "flag-renderer-1",
      "spec": {
        "pattern": "nordic",
        "palette": ["#003082", "#FFFFFF", "#CE1126"]
      }
    },
    "startsAt": 1785623412000,
    "endsAt": 1785623427000
  }
}
```

`correctAnswer`: `{ "choice": "fake" }`.

**Open ontwerpvraag, niet zelf beslist:** `question-selection.js` geeft de
`generated`-variant al een eigen, geneste `rendererVersion` binnen
`publicQuestionPayload` (zichtbaar in het voorbeeld hierboven). Is dat dezelfde
waarde als het nieuwe top-level `round:started.rendererVersion` (Match-breed,
voor elke ronde en elk `gameType` gelijk), of wordt het geneste veld
overbodig zodra het top-level veld bestaat? Voorgelegd aan wie de
composition-laag bouwt (`server/composition/`); tot een antwoord er is,
blijven beide velden zoals hierboven getoond naast elkaar bestaan.

### `higher_lower`

```json
{
  "event": "round:started",
  "eventId": "evt_01J...",
  "serverTime": 1785623411900,
  "payload": {
    "matchId": "match_01J...",
    "roundId": "round_07",
    "roundNumber": 7,
    "totalRounds": 10,
    "gameType": "higher_lower",
    "contentVersion": "2026.08.1",
    "rendererVersion": "flag-renderer-1",
    "question": {
      "metric": "population",
      "sides": [
        { "side": 0, "iso2": "DE" },
        { "side": 1, "iso2": "PT" }
      ]
    },
    "startsAt": 1785623412000,
    "endsAt": 1785623427000
  }
}
```

`correctAnswer`: `{ "side": 0 }`. De rauwe metriekwaarden (`values` binnen
`resultDetails` in `question-selection.js`) komen **niet** in `round:started`
terecht — die gaan pas mee in `round:ended`.

### `odd_one_out`

```json
{
  "event": "round:started",
  "eventId": "evt_01J...",
  "serverTime": 1785623411900,
  "payload": {
    "matchId": "match_01J...",
    "roundId": "round_08",
    "roundNumber": 8,
    "totalRounds": 10,
    "gameType": "odd_one_out",
    "contentVersion": "2026.08.1",
    "rendererVersion": "flag-renderer-1",
    "question": {
      "cards": [
        { "cardIndex": 0, "iso2": "FR" },
        { "cardIndex": 1, "iso2": "DE" },
        { "cardIndex": 2, "iso2": "IT" },
        { "cardIndex": 3, "iso2": "NL" }
      ]
    },
    "startsAt": 1785623412000,
    "endsAt": 1785623427000
  }
}
```

`correctAnswer`: `{ "cardIndex": 3 }`. `majorityContinent`/`minorityContinent`
(binnen `resultDetails` in `question-selection.js`) komen **niet** in
`round:started` terecht — die gaan pas mee in `round:ended`.

---

Bij geen van de vijf vormen is de juiste optie afleidbaar uit ID, volgorde,
URL, seed of metadata.

Publiek `roundNumber` is 1-based (`Match.roundIndex + 1`); `countdownEndsAt`
(in `game:started`) is vluchtig en wordt bij de transitie berekend, geen
opgeslagen veld (`DECISIONS.md`, punt 16).

## Foutcodes

### Room en join

- `GAME_NOT_FOUND`
- `INVITE_INVALID`
- `GAME_FULL`
- `GAME_ALREADY_STARTED`
- `LATE_JOIN_DISABLED`
- `ROOM_LOCKED`
- `CODE_RATE_LIMITED`

`GAME_NOT_FOUND` is ook het externe resultaat van een verlopen room-TTL (4 uur);
daarvoor bestaat geen aparte foutcode (`DECISIONS.md`, punt 2).

### Autorisatie

- `TOKEN_INVALID`
- `TOKEN_EXPIRED`
- `SESSION_REVOKED`
- `NOT_HOST`
- `NOT_PLAYER`

### Game en ronde

- `INVALID_PHASE`
- `ROUND_NOT_ACTIVE`
- `PLAYER_NOT_ELIGIBLE`
- `ALREADY_ANSWERED`
- `DEADLINE_PASSED`
- `INVALID_ANSWER_FORMAT`
- `UNSUPPORTED_EVENT`

### Input

- `NAME_TOO_LONG`
- `NAME_INVALID`
- `RATE_LIMITED`
- `PROTOCOL_VERSION_UNSUPPORTED`

Clientresponse:

```json
{
  "event": "error",
  "eventId": "evt_01J...",
  "serverTime": 1785623412000,
  "payload": {
    "actionId": "act_01J...",
    "code": "ROOM_LOCKED",
    "meta": {}
  }
}
```

Debugdetails gaan alleen naar serverlogs.

## Reconnect

1. Socket valt weg.
2. Client toont niet-blokkerende reconnectstatus.
3. Backoff: 1, 2, 4, 8, 16, maximaal 30 seconden.
4. Socketauth gebruikt dezelfde sessietoken.
5. Na verbinding vraagt client altijd een snapshot.
6. Snapshot vervangt lokale fase, score en antwoordstatus.
7. Een reeds geaccepteerd antwoord wordt niet opnieuw verzonden, behalve als de client
   geen ack heeft en dezelfde `actionId` kan herhalen.

## Inputveiligheid

- displaynamen worden Unicode NFKC-genormaliseerd;
- control characters en onzichtbare misbruiktekens worden verwijderd;
- maximaal 20 zichtbare tekens;
- server bewaart en verstuurt naam als platte tekst;
- frontend gebruikt nooit `innerHTML` voor gebruikersinput;
- alle payloads worden schema-gevalideerd;
- payloadgrootte wordt begrensd.
