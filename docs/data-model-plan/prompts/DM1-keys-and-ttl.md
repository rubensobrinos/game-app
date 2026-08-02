# Prompt — DM1: Redis-sleutels & TTL-constante

Onderdeel van [`docs/data-model-plan/README.md`](../README.md), fase DM1. Afhankelijk
van DM0 (`server/data/` bestaat en is bevestigd). Doel: uitsluitend de letterlijk
vastgelegde sleutelpatronen en de TTL-waarde als pure functies/constanten leveren —
niets dat een niet-vastgelegde beslissing (refreshbeleid, hashalgoritme) al invult.

**Gebaseerd op [`REVIEW.md`](../REVIEW.md)**, bevindingen 1, 3 en 13. Bevinding 1 is
een blocker: de vorige versie van dit plan gebruikte een verkeerde action-cache-sleutel.

## Context — de letterlijke bron

`docs/multiplayer/DATA-MODEL.md`, sectie "Redis-sleutels":

```text
rooms:active                              → set roomId
room:code:{code}                          → roomId
room:invite:{inviteHash}                  → roomId

room:{roomId}                             → hash/JSON Room
room:{roomId}:sessions                    → hash sessionId → Session
room:{roomId}:players                     → hash playerId → Player
room:{roomId}:match:{matchId}             → hash/JSON Match
room:{roomId}:match:{matchId}:round:{id}  → hash/JSON Round
room:{roomId}:match:{matchId}:answers:{id}→ hash playerId → Answer
room:{roomId}:match:{matchId}:scoreboard  → sorted set score → playerId
room:{roomId}:revoked-sessions            → set sessionId
room:{roomId}:action-cache                → hash actionId → ack/result
```

En sectie "TTL": `standaard room-TTL: 14.400 seconden na laatste activiteit`.

**Correctie t.o.v. de vorige planversie:** `action-cache` is **room-scoped**
(`room:{roomId}:action-cache`), niet match-scoped. Er staat geen `{matchId}` in de
bron. Als match-scoping later inhoudelijk beter blijkt, is dat een
`database_schema`-wijziging met ADR die eerst `DATA-MODEL.md` zelf moet bijwerken —
niet iets wat dit plan stilzwijgend mag invoeren.

**Interpretatie die je expliciet moet documenteren, niet stilzwijgend aannemen:** in
`room:{roomId}:match:{matchId}:answers:{id}` is `{id}` niet met zoveel woorden
gedefinieerd. Aanname: `{id}` is het ronde-ID (analoog aan `round:{id}` erboven, en
consistent met `Answer.roundId` in de Round/Answer-voorbeelden) — dus één
answers-hash per ronde. Documenteer deze aanname in een codecommentaar bij de
key-builder en in de test, zodat een latere correctie één plek raakt.

## Stappen

1. `server/data/redis-keys.js` — één pure functie per sleutelpatroon:
   `roomsActiveKey()`, `roomCodeLookupKey(code)`, `roomInviteLookupKey(inviteHash)`,
   `roomKey(roomId)`, `roomSessionsKey(roomId)`, `roomPlayersKey(roomId)`,
   `matchKey(roomId, matchId)`, `roundKey(roomId, matchId, roundId)`,
   `answersKey(roomId, matchId, roundId)` (met de aanname hierboven in commentaar),
   `scoreboardKey(roomId, matchId)`, `revokedSessionsKey(roomId)`,
   `actionCacheKey(roomId)` (**geen** `matchId`-parameter — zie correctie hierboven).
2. **Invoervalidatie (bevinding 13).** Elke builder weigert lege strings en
   segmenten die Redis-key-scheidingstekens (`:`) of glob-tekens (`*`, `?`, `[`, `]`)
   bevatten, met een `TypeError`. De builders nemen dus aan dat `roomId`, `code`,
   `inviteHash`, `matchId`, `roundId`, `playerId` en `actionId` al gevalideerde,
   canonieke identifiers zijn (gegenereerd door DM6/`ARCHITECTURE.md`-code, niet hier)
   — documenteer die precondition in een top-of-file commentaar.
3. `server/data/ttl.js`:
   - `ROOM_TTL_SECONDS = 14400` — de enige waarde die letterlijk vastligt.
   - **Geen** "welke sleutels verversen"-functie in deze fase. De vorige planversie
     beloofde die als (a); de review wees terecht aan dat `DATA-MODEL.md` alleen
     "roomkern, indexes en relevante matchkeys" zegt zonder dat te specificeren
     (bevinding 3). Een refreshmatrix is (c) en hoort bij een apart voorstel wanneer
     de repository-laag (DM6) echt bestaat om hem tegenaan te toetsen.
   - Laat in een commentaarblok drie dingen expliciet open staan (niet oplossen, wel
     benoemen): (1) de refreshmatrix zelf, (2) de periodieke cleanup van
     achtergebleven indexes na verlopen TTL — welk proces, welke frequentie, en (3)
     of bestaande matchkeys bij een rematch dezelfde TTL behouden of resetten.
4. Tests (`redis-keys.test.js`, `ttl.test.js`):
   - elke builder produceert exact het patroon uit de brontabel hierboven, met
     representatieve ID's;
   - `actionCacheKey('room_1')` → `room:room_1:action-cache` (geen `matchId` in de
     signatuur — regressietest tegen de gecorrigeerde bevinding 1);
   - elke builder werpt op een leeg segment en op een segment met `:`/`*`/`?`/`[`/`]`;
   - `ROOM_TTL_SECONDS === 14400`.
5. Vul in `docs/data-model-plan/README.md` sectie 3 de statusregel voor DM1 aan.

## Harde grenzen

- Geen `EXPIRE`/`TTL`-aanroep, geen Redis-client — dit zijn pure functies/constanten.
- Geen refreshmatrix, geen cleanup-implementatie, geen idempotency-TTL-waarde voor de
  action-cache — alle drie expliciet uitgesteld (stap 3).
- Geen dependency, geen `package.json`-wijziging.
- Max 15 bestanden / 5.000 regels; dit past in één actie (2 modulebestanden + 2
  testbestanden).

## Definition of done

- `redis-keys.js` bevat exact de sleutelpatronen uit de brontabel, niet meer en niet
  minder, met de `answers:{id}`-aanname gedocumenteerd.
- `actionCacheKey()` is room-scoped, geen `matchId`-parameter.
- Elke builder valideert invoer en heeft een test voor het falende pad.
- `ttl.js` bevat alleen `ROOM_TTL_SECONDS`; de drie open vragen uit stap 3 staan als
  commentaar, niet als (verkeerd) opgeloste code.
- `node --test 'server/data/**/*.test.js'` slaagt.

**Status: uitgevoerd.** `server/data/redis-keys.js` (12 builders + `assertSegment`-
validatie), `server/data/ttl.js` (`ROOM_TTL_SECONDS` + de drie expliciet opengelaten
punten in commentaar), en bijbehorende testbestanden staan er.
`node --test 'server/data/**/*.test.js'` → 66/66 groen (5 suites, 0 fail). Geen
`package.json`, lockfile of dependency toegevoegd.
