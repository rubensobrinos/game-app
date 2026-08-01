# PROTOCOL.md — Contract tussen client en server

**Protocolversie:** `v1`

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
    "preset": "group_battle",
    "language": "nl"
  },
  "hostParticipates": true,
  "displayName": null
}
```

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

Vrijwillig verlaten. Vereist spelerrol.

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
    "matchId": "match_01J..."
  },
  "self": {
    "roles": ["player"],
    "playerId": "p_8f42d1",
    "effectiveName": "Ruben",
    "score": 600,
    "position": 7,
    "answeredCurrentRound": false
  },
  "currentRound": {},
  "scoreboard": {
    "top": [],
    "self": {}
  }
}
```

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
| `share:opened` | host/player | `{ method: "qr" \| "link" \| "native" }` | analytics, mag falen zonder UX-effect |

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
| `game:paused` | room | reden, vorige fase |
| `game:resumed` | room | nieuwe countdown/tijden |
| `round:started` | room | vraag, opties, tijden |
| `round:answer-accepted` | één speler | `roundId` |
| `round:progress` | room | `answeredCount`, `eligiblePlayerCount` |
| `round:ended` | room + persoonlijke velden | correct antwoord, verdeling, eigen punten |
| `scoreboard:updated` | room + persoonlijke velden | top 5, eigen positie |
| `game:finished` | room + persoonlijke velden | podium, eigen samenvatting |
| `game:rematch-started` | room | nieuwe `matchId`, lobby-state |
| `session:kicked` | één sessie | reden |
| `session:revoked` | één sessie | reden |
| `error` | relevante sessie | foutcode + veilige metadata |

`round:progress` wordt maximaal tweemaal per seconde gebroadcast.

## Voorbeeld `round:started`

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
    "gameType": "real_or_fake_flag",
    "contentVersion": "2026.08.1",
    "question": {
      "promptKey": "btnRealOrFakePrompt",
      "image": {
        "kind": "generated_flag",
        "seed": "fx_91b2",
        "rendererVersion": "flag-renderer-1",
        "spec": {
          "pattern": "nordic",
          "palette": ["#003082", "#FFFFFF", "#CE1126"]
        }
      },
      "options": [
        { "optionId": "real", "labelKey": "btnReal" },
        { "optionId": "fake", "labelKey": "btnFake" }
      ]
    },
    "startsAt": 1785623412000,
    "endsAt": 1785623427000
  }
}
```

De juiste optie is niet afleidbaar uit ID, volgorde, URL, seed of metadata.

## Foutcodes

### Room en join

- `GAME_NOT_FOUND`
- `INVITE_INVALID`
- `GAME_FULL`
- `GAME_ALREADY_STARTED`
- `LATE_JOIN_DISABLED`
- `ROOM_LOCKED`
- `CODE_RATE_LIMITED`

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
