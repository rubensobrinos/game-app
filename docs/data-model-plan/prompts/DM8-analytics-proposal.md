# Prompt — DM8: Analytics-traceability + eventcontractvoorstel

Onderdeel van [`docs/data-model-plan/README.md`](../README.md), fase DM8.
Afhankelijk van DM2a (`GameConfiguration`-velden) en DM5 (dezelfde tabellen/
kolommen als de allowlist). Corrigeert `REVIEW.md` bevinding 9: `DATA-MODEL.md`
geeft doeltabellen, geen event- of aggregatiecontract — dat verzint deze fase niet
stilzwijgend, maar legt het voor als voorstel.

**Herzien na [`REVIEW-DM2-DM9.md`](REVIEW-DM2-DM9.md), bevindingen 11 en 12
(beide Hoog).** Bevinding 11: een eerdere versie van deze prompt liet DM8 zes
open vragen benoemen én tegelijk hun voorgestelde defaults als groene
runtimeassertie in `aggregate.js` bouwen en testen — dat maakt een voorstel
feitelijk bindend gedrag vóór product/data-review en botst met de `design`/
`database_schema`-grens. Bevinding 12: drie kolommen van `game_sessions` (`id`,
`room_id_hash`, `max_player_count`) hebben geen bevestigde bron in de
voorgestelde events — zelfs een voorgestelde default zou daar oneerlijk over
zijn, want er is niets om de default op te baseren.

**Gevolg voor deze fase: geen `server/`-code, geen aggregatiefunctie, geen
test.** DM8 levert uitsluitend de twee `docs/`-deliverables (stap 1 en stap 2
hieronder). De eerdere stap 3 (`server/data/analytics/aggregate.js` met
`buildGameSessionRow`/`buildRoundStatsRow`) is **geschrapt, niet uitgesteld** —
die code hoort pas gebouwd te worden nadat (a) de open analyticsvragen door
product/data zijn bevestigd, én (b) de drie geblokkeerde kolommen hieronder een
echte bron hebben. Beide zijn nu expliciet geen onderdeel van DM8.

**Locatie, uitsluitend `docs/`, geen `server/`-code:** de volledige uitkomst van
deze fase bestaat uit twee documenten onder `docs/data-model-plan/proposals/` —
geen `.sql`-bestand in runtime-code (bevinding 9: "een `.sql`-bestand in
runtimecode kan gemakkelijk als goedgekeurde migratie worden aangezien") en geen
module die voorgestelde defaults als bewezen runtimegedrag laat landen
(bevinding 11).

## Context — de tabellen, letterlijk

Zie [`prompts/DM5-privacy-guard.md`](DM5-privacy-guard.md) voor de volledige
kolomlijst van `game_sessions`, `round_stats`, `daily_metrics` — DM5 en DM8 delen
bewust dezelfde bron, geen tweede lijst.

`ARCHITECTURE.md` §9 "Async analytics": *"Geen databasewrite in het kritieke
antwoordpad. Events worden in-memory of via Redis gebufferd en in batches
geaggregeerd."* — dit IS het enige dat al vastligt over de mechaniek; welke
events en welke aggregatieregels, niet.

## Stap 1 — `docs/data-model-plan/proposals/analytics-event-contract.md`

Kolomtraceabiliteits-matrix (per kolom in de drie tabellen: bronveld of bron-event,
duidelijk/open/geblokkeerd) + voorgesteld eventcontract:

| Event (voorstel) | Payload (voorstel) | Voedt |
| --- | --- | --- |
| `room_created` | `roomIdHash, createdAt, language, difficulty, pacing, mode, gameTypes, totalRounds, maxPlayers` | `game_sessions.*` (basisconfig) |
| `match_started` | `roomIdHash, matchId, matchSequence, startedAt, rematchOfMatchId \| null` | `game_sessions.started_at, match_sequence, rematch_of` |
| `player_joined` | `roomIdHash, matchId, joinedAt, joinSource, isLateJoin` | `game_sessions.late_join_count, joins_via_qr/link/code` |
| `share_opened` | `roomIdHash, matchId \| null, method` | `game_sessions.share_qr_open_count, share_link_open_count` |
| `match_finished` | `roomIdHash, matchId, finishedAt, finishedNormally` | `game_sessions.finished_at, finished_normally` |
| `round_ended` | `roomIdHash, matchId, roundNumber, gameType, questionKey, answerCount, correctCount, answerResponseTimesMs[], noAnswerCount` | `round_stats.*` (direct, `average_answer_ms` = gemiddelde van `answerResponseTimesMs`) |

Duidelijk uit deze events af te leiden: alle `round_stats`-kolommen, en
`game_sessions.match_sequence/created_at/started_at/finished_at/language/
difficulty/pacing/mode/game_types/total_rounds/finished_normally/rematch_of`.

### Geblokkeerd — geen voorgestelde default mogelijk (bevinding 12)

Deze drie kolommen van `game_sessions` wegen zwaarder dan de "open vragen"
hieronder: een open vraag kán met een plausibele default worden overbrugd, deze
drie niet — de voorgestelde events leveren er domweg geen bron voor. Ze staan
daarom expliciet **niet** onder "duidelijk" en krijgen hier ook geen default.

- **`id` — GEBLOKKEERD.** Geen van de voorgestelde events noemt een
  generatiebron voor de primary key van `game_sessions`: geen aangeleverd
  eventveld en ook geen "dit wordt door de database gegenereerd"-besluit. Dit is
  geen bestaande checkpoint-ADR zoals bij `room_id_hash`, maar wél een
  openstaande brondecisie die het huidige eventcontract niet beantwoordt.
- **`room_id_hash` — GEBLOKKEERD.** Vereist het hashalgoritme achter
  `roomIdHash`, en dat is nog een open `auth`/`database_schema`-ADR
  ([`README.md`](../README.md), sectie 6, checkpoint 7: "Hash-mechanisme voor
  `inviteHash`/`room_id_hash`"). Zolang die ADR open staat, kan geen enkel
  voorstel — ook geen default — beweren welke waarde hier binnenkomt.
- **`max_player_count` — GEBLOKKEERD.** Vereist een echte piekmeting tijdens de
  match. Alleen `player_joined`-events tellen is onvoldoende: spelers kunnen
  ook vertrekken en later kunnen anderen joinen, dus een cumulatieve join-telling
  is geen piek van *gelijktijdig aanwezige* spelers. Het eventcontract hierboven
  bevat geen `player_left`- of lopende-tellerevent dat dit signaal levert.

Deze drie krijgen pas een implementatie zodra ofwel (a) de betreffende ADR is
opgelost (checkpoint 7 voor `room_id_hash`; een expliciet generatiebronbesluit
voor `id`), ofwel (b) het eventcontract hierboven een bevestigd bron-event
krijgt dat het ontbrekende signaal levert (bijvoorbeeld een `player_left`- of
lopende-tellerevent voor `max_player_count`). **Beide paden zijn nadrukkelijk
geen onderdeel van deze fase** — DM8 markeert de blokkade, lost hem niet op.

### Open vragen — expliciet, met een voorgestelde default

1. **Native share telt niet mee.** `game_sessions` heeft alleen
   `share_qr_open_count`/`share_link_open_count`, geen kolom voor
   `method: "native"` (`PROTOCOL.md`'s `share:opened` kent wel `qr|link|native`).
   Voorstel: tel `native` mee bij `share_link_open_count` (een native share deelt
   per definitie de link) — een aparte kolom toevoegen is een `database_schema`-
   wijziging, hier niet uitgevoerd.
2. **`joins_via_*` mist een `unknown`-kolom** terwijl `PROTOCOL.md`'s
   `joinSource` het vierde lid `unknown` kent. Voorstel: niet meetellen in geen
   van de drie kolommen (stil genegeerd voor deze telling) — een device
   waarschijnlijk zeldzaam pad, maar wel een reëel gat, hier benoemd i.p.v.
   verzwegen.
3. **`daily_metrics`-tijdzone.** `date` is een kalenderdag — in welke tijdzone?
   Voorstel: UTC, simpelweg omdat er nergens een andere tijdzone wordt genoemd in
   de vijf brondocumenten. Raakt direct de grenswaarden rond middernacht.
4. **`median_join_to_start_seconds`** vereist een duur per join (`match_started -
   player_joined`) die nergens als los veld bestaat — voorstel: afgeleid uit de
   twee events hierboven op aggregatiemoment, niet als los event.
5. **Wanneer telt een `game_session` als "finished"?** Alleen via
   `game:finish`/normale afronding, of ook bij TTL-verval met spelers nog
   aanwezig? Voorstel: alleen expliciete afronding (`finished_normally: true` bij
   `game:finish`, `false` bij elk ander eindpad zoals TTL-verval) — `finished_at`
   blijft dan `null` bij een room die stil verloopt zonder expliciet einde.

Elke open vraag krijgt hier een default zodat DM8 niet blokkeert, maar blijft
gemarkeerd als voorstel — niet als vastgesteld gedrag, conform `REVIEW.md`
bevinding 9's aanbeveling voor "product/data-review". Anders dan de drie
geblokkeerde kolommen hierboven zijn deze vijf vragen niet bekritiseerd als
onoplosbaar — alleen (samen met de rest van dit document) als "hoort nog niet
als runtimecode gebouwd te worden" (bevinding 11, zie hieronder waarom er in
deze fase dan ook geen `aggregate.js` meer is).

## Stap 2 — `docs/data-model-plan/proposals/schema.sql`

Letterlijke transcriptie van de drie `CREATE TABLE`-statements uit
`DATA-MODEL.md`, ongewijzigd, met een prominente header-comment:
`-- VOORSTEL, GEEN MIGRATIE. Niet uitvoeren zonder database-engine-ADR
(docs/data-model-plan/README.md checkpoint 8).` Dit bestand staat bewust **onder
`docs/`**, niet in `server/`.

## Tests

Deze fase levert geen `server/`-code op, dus geen `node --test`-suite —
onderstaande zijn documentconsistentiecontroles op de twee proposal-bestanden
zelf, uit te voeren als review vóór dit voorstel als "klaar" geldt:

- elke kolom van `game_sessions`/`round_stats`/`daily_metrics` uit
  `DATA-MODEL.md`/DM5 komt precies één keer voor in de traceability-matrix van
  stap 1 — geen ontbrekende, geen dubbele, geen extra kolom (zie bevinding 13:
  een handmatige kolomtelling die niet klopt met de opgesomde tabel is precies
  het soort fout dat hier moet opvallen);
- `id`, `room_id_hash` en `max_player_count` staan uitsluitend onder
  "Geblokkeerd", nooit onder "Duidelijk" of "Open vragen ... met een
  voorgestelde default" — een latere bewerking die een van deze drie per
  ongeluk terugschuift naar "duidelijk" of een default geeft, moet bij review
  opvallen;
- elk "duidelijk" kolomveld in de matrix is traceerbaar naar een letterlijk
  eventveld uit de tabel in stap 1 (bijv. `language` komt letterlijk van
  `room_created.language`) — geen kolom die als "duidelijk" gemarkeerd staat
  zonder een aanwijsbaar bronveld;
- elke resterende open vraag (de vijf hierboven) heeft een expliciet
  gemarkeerde voorgestelde default in de tekst, niet alleen in de tabel;
- `schema.sql` is kolom-voor-kolom en tabel-voor-tabel identiek aan de drie
  `CREATE TABLE`-statements in `DATA-MODEL.md`, met de voorgeschreven
  voorstel-headercomment aanwezig.

## Harde grenzen

- Geen migratie-uitvoering, geen migratietool, geen database-engine-keuze
  (checkpoint 8).
- Geen `daily_metrics`-aggregatiecode in deze fase.
- Geen `server/`-code, geen aggregatiefunctie en geen test in deze fase
  (bevinding 11) — `buildGameSessionRow`/`buildRoundStatsRow` zijn geschrapt,
  niet uitgesteld naar een latere stap binnen dit document.
- `id`, `room_id_hash` en `max_player_count` krijgen in deze fase geen
  implementatie en geen voorgestelde default — ze zijn geblokkeerd (bevinding
  12) totdat hun ADR is opgelost of het eventcontract een bevestigd bron-event
  krijgt.
- `schema.sql` blijft onder `docs/`, niet onder `server/`.
- 2 bestanden, beide onder `docs/data-model-plan/proposals/`: 1
  proposal-markdown (`analytics-event-contract.md`) + 1 proposal-sql
  (`schema.sql`). Geen module, geen testbestand.

## Definition of done

- Elke kolom van `game_sessions`/`round_stats`/`daily_metrics` is traceerbaar
  naar óf een letterlijk brondocumentveld, óf een expliciet gemarkeerde
  voorgestelde default, óf een expliciete "geblokkeerd"-markering (`id`,
  `room_id_hash`, `max_player_count`).
- De vijf resterende open vragen staan elk met een default in het
  proposal-document, niet stilzwijgend aangenomen.
- `id`, `room_id_hash` en `max_player_count` zijn zichtbaar gemarkeerd als
  geblokkeerd, met de verwijzing naar de blokkerende ADR (checkpoint 7) of het
  ontbrekende bron-event, en zonder default.
- `docs/data-model-plan/proposals/analytics-event-contract.md` en
  `docs/data-model-plan/proposals/schema.sql` bestaan; er is geen
  `server/data/analytics/`-module en geen bijbehorend testbestand in deze fase.

**Status: uitgevoerd.** De twee deliverables staan onder
`docs/data-model-plan/proposals/`: `analytics-event-contract.md` en
`schema.sql`.
