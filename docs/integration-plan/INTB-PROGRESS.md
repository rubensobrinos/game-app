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
| [INTB2a](prompts/INTB2a-redis-adapter-basis.md) | Verbinding, lifecycle, JSON-documenten met schemaversie | ✅ | 54 tests, 7/7 mutanten |
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

De poort telt sinds DM10 **21** methoden. Een methode is pas ✅ als de
conformance-suite er echt overheen loopt tegen een **Redis**-adapter; groen tegen
de in-memory fake telt als 🟡. De Redis-kolom kan pas bewegen bij INTB2b — na
INTB2a staat alleen het fundament.

| Methode | Conformance | Redis-adapter |
| --- | --- | --- |
| `loadRoom` / `saveRoom` | 🟡 | 🔵 |
| `loadRoomByCode` | 🟡 | 🔵 |
| `loadRoomByInviteHash` | 🟡 | 🔵 |
| `claimRoomLocatorsAtomically` | 🟡 | 🔵 |
| `releaseRoomLocators` | 🟡 | 🔵 |
| `refreshRoomLocators` | 🟡 | 🔵 |
| `loadSession` / `saveSession` | 🟡 | 🔵 |
| `loadPlayer` / `savePlayer` / `listPlayers` | 🟡 | 🔵 |
| `loadMatch` / `saveMatch` | 🟡 | 🔵 |
| `loadRound` / `saveRound` | 🟡 | 🔵 |
| `loadAnswer` | 🟡 | 🔵 |
| `loadActionCacheEntry` | 🟡 | 🔵 |
| `setRoomAndMatchPhaseAtomically` | 🟡 | 🔵 |
| `saveAcceptedAnswerAtomically` | 🟡 | 🔵 |
| `getScoreboardTop` | 🟡 | 🔵 |

Conformance-suite: **80/80 groen**. De drie tests die op **INTB-4** rood stonden
zijn met DM13 groen geworden — ze waren de acceptatietoets van die fix.

## Fundament (INTB2a)

| Onderdeel | Status |
| --- | --- |
| Verbinding, levenscyclus, herverbindingsbeleid | ✅ 30 tests |
| Versieerbare documentenvelop | ✅ 24 tests |
| Guard op de testinstantie | ✅ weigert 6379 en elke externe host |
| Mutatietest | ✅ 7 van 7 gevangen |

## Rapportageroutine

Dit document liep vandaag twee keer achter op de werkelijkheid, in beide
richtingen: **INTB-5** stond op opgelost terwijl het gat nog bestond, en
**INTB-4** stond op open terwijl DM13 het al had gefixt. Daarom, vóór elke
statusmelding:

1. **Draai de suite opnieuw.** Niet het getal uit een eerder verslag overnemen.
2. **Lees de laatste HANDOFF-stand** — ook de items die van anderen zijn, want
   die bewegen zonder dat ik het merk.
3. **Leg de getallen naast elkaar.** Een repo-breed "0 rood" naast een eigen
   "3 rood" in hetzelfde bericht kan niet allebei waar zijn. Dat was de fout bij
   INTB-4: het repo-getal klopte en was al het bewijs dat mijn eigen regel
   verouderd was.
4. **Een groene test bewijst wat hij toetst, niet wat je hoopt.** Bij INTB-5
   bewees hij dat `releaseRoomLocators` werkt, niet dat een rotatie hem gebruikt.

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

## Bevindingen uit INTB2a

**Een echte concurrency-bug in `connect()`**, gevonden door de eigen test en
gefixt. `disposeClient` was `async`, waardoor `connect()` zijn beurt teruggaf
vóórdat `connectPromise` was toegekend. Twee gelijktijdige aanroepen bouwden elk
een eigen client en één werd een weeskind: een open socket zonder eigenaar die
niemand meer sluit. Zichtbaar in productie pas wanneer een herverbinding
samenvalt met een normale aanroep — dus zelden, en dan lastig te plaatsen.

De invariant ("geen `await` tussen de check en de toewijzing") staat nu als
comment in de code, en mutant M7 zet de oude volgorde terug om te bewijzen dat de
test hem pakt.

**`CLIENT INFO`/`laddr` bleek geen bruikbaar bewijs** dat we op de testinstantie
zitten: Docker mapt host 6380 naar containerpoort 6379, dus Redis rapporteert
altijd 6379. Vervangen door een socket-probe waarvan het OS de `remotePort` meet.
Een goed voorbeeld van een verificatie die plausibel klinkt en niets bewijst.

## Bevindingen tot nu toe

Beide zijn opgelost door DM, maar ze staan hier omdat ze boven water kwamen
vóór de eerste regel adaptercode — dat was het hele punt van INTB1.

**Drie methoden waren niet tegen Redis implementeerbaar** (`INTB-1`, opgelost).
`redis-keys.js` heeft `roomId` nodig voor de round-, answer- en
action-cache-sleutels, maar `saveRound`, `loadAnswer` en `loadActionCacheEntry`
kregen dat niet mee. De in-memory fake verborg dit met een lineaire scan over
alle matches en globale Maps zonder room-scope; in Redis is het equivalent een
`SCAN` over de hele keyspace per aanroep.

**De poort miste een atomaire claim voor de join-code** (`INTB-2`, opgelost).
Uniciteit afdwingen met read-dan-write is check-then-act. Zelf nagemeten na de
fix: acht gelijktijdige claims op dezelfde code geven exact één winnaar.

**En één die ik te vroeg afsloot** (`INTB-5`, heropend). Ik meldde hem als gedekt
omdat mijn contracttest groen stond, maar die bewees dat `releaseRoomLocators`
wérkt — niet dat een rotatie hem gebruikt. Een tweede claim voor dezelfde room
slaagt zonder de vorige locators vrij te geven, dus een geroteerde uitnodiging
blijft geldig. Het gat zat een laag hoger dan waar ik keek.

## Twee dingen die de prompts expliciet vastleggen

De bron laat ze open, en allebei zijn ze makkelijk fout te doen:

- **Schemaversie op de JSON-documenten.** DECISIONS #22 zegt "versieerbaar" maar
  niet hoe. Zonder expliciete versie merken we een incompatibele deploy pas
  tijdens een live room.
- **`countdownEndsAt` mag niet naar de opslag** (#16, vluchtig). Zodra de
  compositielaag hem berekent is het verleidelijk hem mee te schrijven.
