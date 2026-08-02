# Voortgang — INT-B (opslagadapters en verpakking)

Bijgewerkt: 2026-08-02. INT-B bouwt áchter de repository-poort
(`server/data/repository.js`); INT-A bouwt ervoor. Openstaande meldingen aan
domeineigenaren staan in [`HANDOFF-INTB.md`](HANDOFF-INTB.md).

Legenda: ✅ klaar en geverifieerd — 🟡 deels — 🔵 prompt geschreven, nog niet
uitgevoerd — ⛔ geblokkeerd — ⏸️ later.

## Prompts

| Prompt | Inhoud | Status | Blokkade |
| --- | --- | --- | --- |
| [INTB1a](prompts/INTB1a-conformance-harness.md) | Conformance-harness + de 16 niet-atomaire methoden | 🔵 | geen |
| [INTB1b](prompts/INTB1b-atomicity.md) | De 2 atomaire methoden: geen half werk, nooit dubbele punten | 🔵 | geen |
| [INTB2a](prompts/INTB2a-redis-adapter-basis.md) | Verbinding, lifecycle, JSON-documenten met schemaversie | ⛔ | `redis`-dep (INT-A) |
| [INTB2b](prompts/INTB2b-poortmethoden.md) | De 16 methoden tegen Redis + TTL-refresh | ⛔ | dep + **INTB-1** |
| [INTB2c](prompts/INTB2c-lua-atomair-antwoord.md) | Lua-script voor atomair antwoord (#23) | ⛔ | INTB2a |
| [INTB2d](prompts/INTB2d-atomaire-fasewissel.md) | Atomaire fasewissel Room/Match (#30) | ⛔ | INTB2a |
| [INTB2e](prompts/INTB2e-aof-herstart.md) | AOF-herstart: rooms overleven een restart | ⛔ | INTB2b–d |
| [INTB3a](prompts/INTB3a-analytics-writer.md) | Asynchrone, gebufferde analytics-writer | ⛔ | `pg`-dep (INT-A) |
| [INTB3b](prompts/INTB3b-privacy-en-restore.md) | Privacy-kanarietest + restore-bewijs | ⛔ | INTB3a |
| [INTB4a](prompts/INTB4a-dockerfile-en-compose.md) | Dockerfile + `docker compose up` | ⛔ | INTB2/3 |
| [INTB4b](prompts/INTB4b-tunnel.md) | Tunnel-variant + poortmeting | ⛔ | INTB4a |

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
