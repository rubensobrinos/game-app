# Voortgang — INT-B (opslagadapters en verpakking)

Bijgewerkt: 2026-08-02. INT-B bouwt áchter de repository-poort
(`server/data/repository.js`); INT-A bouwt ervoor. Openstaande meldingen aan
domeineigenaren staan in [`HANDOFF-INTB.md`](HANDOFF-INTB.md).

Legenda: ✅ klaar en geverifieerd — 🟡 deels — 🔵 prompt geschreven, nog niet
uitgevoerd — ⛔ geblokkeerd — ⏸️ later.

## Prompts

| Prompt | Inhoud | Status | Blokkade |
| --- | --- | --- | --- |
| [INTB1a](prompts/INTB1a-conformance-harness.md) | Conformance-harness + de niet-atomaire methoden | ✅ | — |
| [INTB1b](prompts/INTB1b-atomicity.md) | De 2 atomaire methoden + migratie naar 21 methoden | ✅ | 3 tests bewust rood op **INTB-4** |
| [INTB2a](prompts/INTB2a-redis-adapter-basis.md) | Verbinding, lifecycle, JSON-documenten met schemaversie | 🟡 | in uitvoering |
| [INTB2b](prompts/INTB2b-poortmethoden.md) | De methoden tegen Redis + TTL-refresh | 🔵 | INTB2a — **INTB-1 is opgelost** |
| [INTB2c](prompts/INTB2c-lua-atomair-antwoord.md) | Lua-script voor atomair antwoord (#23) | ⛔ | INTB2a |
| [INTB2d](prompts/INTB2d-atomaire-fasewissel.md) | Atomaire fasewissel Room/Match (#30) | ⛔ | INTB2a |
| [INTB2e](prompts/INTB2e-aof-herstart.md) | AOF-herstart: rooms overleven een restart | ⛔ | INTB2b–d |
| [INTB3a](prompts/INTB3a-analytics-writer.md) | Asynchrone, gebufferde analytics-writer | 🔵 | geen |
| [INTB3b](prompts/INTB3b-privacy-en-restore.md) | Privacy-kanarietest + restore-bewijs | ⛔ | INTB3a |
| [INTB4a](prompts/INTB4a-dockerfile-en-compose.md) | Dockerfile + `docker compose up` | ⛔ | INTB2/3 |
| [INTB4b](prompts/INTB4b-tunnel.md) | Tunnel-variant + poortmeting | ⛔ | INTB4a + bevestiging omgeving |

**Correctie:** `fastify`, `socket.io`, `pg` en `redis` staan al in `package.json`
met lockfile sinds commit `376bd4e`. Een eerdere versie van deze tabel meldde ten
onrechte dat INTB2a en INTB3a op een dependency-commit wachtten. Ze zijn vrij.

## Status per poortmethode

Een methode is pas ✅ als de conformance-suite er echt overheen loopt tegen een
**Redis**-adapter. Groen tegen de in-memory fake telt als 🟡.

| Methode | Conformance | Redis-adapter |
| --- | --- | --- |
| `loadRoom` / `saveRoom` | 🔵 | ⛔ |
| `loadRoomByCode` / `loadRoomByInviteId` | 🔵 | ⛔ |
| `loadSession` / `saveSession` | 🔵 | ⛔ |
| `loadPlayer` / `savePlayer` / `listPlayers` | 🔵 | ⛔ |
| `loadMatch` / `saveMatch` | 🔵 | ⛔ |
| `loadRound` | 🔵 | ⛔ |
| `saveRound` | 🔵 | ⛔ **INTB-1** |
| `loadAnswer` | 🔵 | ⛔ **INTB-1** |
| `loadActionCacheEntry` | 🔵 | ⛔ **INTB-1** |
| `setRoomAndMatchPhaseAtomically` | 🔵 | ⛔ |
| `saveAcceptedAnswerAtomically` | 🔵 | ⛔ |
| `getScoreboardTop` | 🔵 | ⛔ **INTB-3** |

## Testinfrastructuur

Adaptertests draaien tegen een **aparte** Compose-stack, niet tegen de
draaiende productie-stack:

```
docker compose -p aseso-game-test -f compose.test.yml up -d
Redis    redis://127.0.0.1:6380
Postgres postgresql://…@127.0.0.1:5434/gamestats_test
```

De productie-Redis publiceert bewust niets naar de host en dat blijft zo —
gemeten: poort 6379 is vanaf de host dicht, 6380 open. Beide testservices
luisteren alleen op de loopback, en `down -v` gooit het volume weg omdat dit
wegwerpdata is.

## Bevindingen tot nu toe

Twee dingen die al vóór de eerste regel adaptercode boven water kwamen:

**Drie methoden zijn niet tegen Redis implementeerbaar** (`INTB-1`).
`redis-keys.js` heeft `roomId` nodig voor de round-, answer- en
action-cache-sleutels, maar `saveRound`, `loadAnswer` en
`loadActionCacheEntry` krijgen dat niet mee, en `Round` en `Answer` dragen het
niet. De in-memory fake verbergt dit met een lineaire scan over alle matches en
globale Maps zonder room-scope. In Redis is het equivalent een `SCAN` over de
hele keyspace per aanroep.

**De poort mist een atomaire claim voor de join-code** (`INTB-2`). Er is alleen
`loadRoomByCode`, een leesoperatie; uniciteit afdwingen met read-dan-write is
check-then-act. Bijkomend is `generateGameCode({ isTaken })` synchroon en werpt
sinds kort op een async callback — en een Redis-lookup ís async.

## Twee dingen die de prompts expliciet vastleggen

De bron laat ze open, en allebei zijn ze makkelijk fout te doen:

- **Schemaversie op de JSON-documenten.** DECISIONS #22 zegt "versieerbaar" maar
  niet hoe. Zonder expliciete versie merken we een incompatibele deploy pas
  tijdens een live room.
- **`countdownEndsAt` mag niet naar de opslag** (#16, vluchtig). Zodra de
  compositielaag hem berekent is het verleidelijk hem mee te schrijven.
