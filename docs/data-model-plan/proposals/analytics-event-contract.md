# Voorstel — Analytics-eventcontract en kolomtraceabiliteit

Onderdeel van [`../prompts/DM8-analytics-proposal.md`](../prompts/DM8-analytics-proposal.md).
Dit document is een **voorstel**, geen vastgesteld gedrag: het legt een
eventcontract en een kolom-voor-kolom herkomst voor de drie analytics-tabellen
uit `docs/multiplayer/DATA-MODEL.md` (sectie "Persistente analytics") voor aan
product/data-review, zoals `REVIEW.md` bevinding 9 aanbeveelt. Niets hierin is
runtimecode of bindend gedrag (`REVIEW-DM2-DM9.md`, bevindingen 11 en 12).

De drie doeltabellen (`game_sessions`, `room_id_hash`-sleutel, `round_stats`,
`daily_metrics`) en hun kolomnamen komen letterlijk uit `DATA-MODEL.md` — zie
ook [`../prompts/DM5-privacy-guard.md`](../prompts/DM5-privacy-guard.md), die
bewust dezelfde bron gebruikt, geen tweede lijst.

## Voorgesteld eventcontract

| Event (voorstel) | Payload (voorstel) | Voedt |
| --- | --- | --- |
| `room_created` | `roomIdHash, createdAt, language, difficulty, pacing, mode, gameTypes, totalRounds, maxPlayers` | `game_sessions.*` (basisconfig) |
| `match_started` | `roomIdHash, matchId, matchSequence, startedAt, rematchOfMatchId \| null` | `game_sessions.started_at, match_sequence, rematch_of` |
| `player_joined` | `roomIdHash, matchId, joinedAt, joinSource, isLateJoin` | `game_sessions.late_join_count, joins_via_qr/link/code` |
| `share_opened` | `roomIdHash, matchId \| null, method` | `game_sessions.share_qr_open_count, share_link_open_count` |
| `match_finished` | `roomIdHash, matchId, finishedAt, finishedNormally` | `game_sessions.finished_at, finished_normally` |
| `round_ended` | `roomIdHash, matchId, roundNumber, gameType, questionKey, answerCount, correctCount, answerResponseTimesMs[], noAnswerCount` | `round_stats.*` (direct, `average_answer_ms` = gemiddelde van `answerResponseTimesMs`) |

`ARCHITECTURE.md` §9 "Async analytics" ligt al vast: geen databasewrite in het
kritieke antwoordpad; events worden in-memory/via Redis gebufferd en in
batches geaggregeerd. Welke events en welke aggregatieregels — dat is wat dit
document voorstelt.

## Kolomtraceabiliteitsmatrix

Per kolom: bronveld of bron-event, en status — **duidelijk** (ondubbelzinnig
af te leiden uit het eventcontract hierboven, zonder default nodig),
**open** (af te leiden, maar met een gat dat een voorgestelde default
vereist — zie "Open vragen" hieronder), of **geblokkeerd** (geen bron
mogelijk — zie "Geblokkeerd" hieronder).

### `game_sessions` (21 kolommen)

| Kolom | Status | Bron / toelichting |
| --- | --- | --- |
| `id` | **Geblokkeerd** | zie sectie "Geblokkeerd" |
| `room_id_hash` | **Geblokkeerd** | zie sectie "Geblokkeerd" |
| `match_sequence` | Duidelijk | letterlijk van `match_started.matchSequence` |
| `created_at` | Duidelijk | letterlijk van `room_created.createdAt` |
| `started_at` | Duidelijk | letterlijk van `match_started.startedAt` |
| `finished_at` | Duidelijk | letterlijk van `match_finished.finishedAt`; randgeval (geen expliciet einde, bijv. TTL-verval) volgt de default van open vraag 5 (blijft `null`) |
| `language` | Duidelijk | letterlijk van `room_created.language` |
| `difficulty` | Duidelijk | letterlijk van `room_created.difficulty` |
| `pacing` | Duidelijk | letterlijk van `room_created.pacing` |
| `mode` | Duidelijk | letterlijk van `room_created.mode` |
| `game_types` | Duidelijk | letterlijk van `room_created.gameTypes` |
| `total_rounds` | Duidelijk | letterlijk van `room_created.totalRounds` |
| `max_player_count` | **Geblokkeerd** | zie sectie "Geblokkeerd" |
| `late_join_count` | Duidelijk | telling van `player_joined`-events met `isLateJoin: true` |
| `joins_via_qr` | Open (vraag 2) | telling van `player_joined`-events met `joinSource: "qr"`; `joinSource: "unknown"` telt in geen van de drie `joins_via_*`-kolommen mee (default) |
| `joins_via_link` | Open (vraag 2) | telling van `player_joined`-events met `joinSource: "link"`; zelfde `unknown`-default als hierboven |
| `joins_via_code` | Open (vraag 2) | telling van `player_joined`-events met `joinSource: "code"`; zelfde `unknown`-default als hierboven |
| `share_qr_open_count` | Open (vraag 1) | telling van `share_opened`-events met `method: "qr"` |
| `share_link_open_count` | Open (vraag 1) | telling van `share_opened`-events met `method: "link"`, plus (default) `method: "native"` |
| `finished_normally` | Duidelijk | letterlijk van `match_finished.finishedNormally`; randgeval volgt de default van open vraag 5 (`false` bij elk niet-expliciet eindpad) |
| `rematch_of` | Duidelijk | letterlijk van `match_started.rematchOfMatchId` |

### `round_stats` (9 kolommen)

| Kolom | Status | Bron / toelichting |
| --- | --- | --- |
| `id` | Duidelijk | binnen "alle `round_stats`-kolommen" (zie hieronder); technische primary key, buiten de expliciete geblokkeerd-markering die uitsluitend voor de drie genoemde `game_sessions`-kolommen geldt |
| `game_session_id` | Duidelijk | binnen "alle `round_stats`-kolommen"; koppeling naar de bijbehorende `game_sessions`-rij op aggregatiemoment |
| `round_number` | Duidelijk | letterlijk van `round_ended.roundNumber` |
| `game_type` | Duidelijk | letterlijk van `round_ended.gameType` |
| `question_key` | Duidelijk | letterlijk van `round_ended.questionKey` |
| `answer_count` | Duidelijk | letterlijk van `round_ended.answerCount` |
| `correct_count` | Duidelijk | letterlijk van `round_ended.correctCount` |
| `average_answer_ms` | Duidelijk | gemiddelde van `round_ended.answerResponseTimesMs` (nullable: geen waarde bij een lege array) |
| `no_answer_count` | Duidelijk | letterlijk van `round_ended.noAnswerCount` |

Alle negen kolommen zijn expliciet "duidelijk uit deze events af te leiden"
(stap 1 van de DM8-prompt noemt ze als groep, zonder uitzondering).

### `daily_metrics` (8 kolommen)

| Kolom | Status | Bron / toelichting |
| --- | --- | --- |
| `date` | Open (vraag 3) | kalenderdag-bucket over alle events; tijdzone niet vastgelegd in de brondocumenten — default: UTC |
| `rooms_created` | Duidelijk | telling van `room_created`-events per dag |
| `games_started` | Duidelijk | telling van `match_started`-events per dag |
| `games_finished` | Open (vraag 5) | telling van `match_finished`-events per dag; welke sessies daarbij als "finished" meetellen volgt dezelfde default als open vraag 5 (alleen expliciete afronding via `match_finished`/`game:finish`) |
| `players_joined` | Duidelijk | telling van `player_joined`-events per dag |
| `rematches` | Duidelijk | telling van `match_started`-events met `rematchOfMatchId != null`, per dag |
| `median_players_per_game` | Duidelijk | mediaan, per dag, van het aantal `player_joined`-events per match (cumulatieve deelname — geen piekmeting van gelijktijdig aanwezige spelers, dus geen afhankelijkheid van het geblokkeerde `max_player_count`) |
| `median_join_to_start_seconds` | Open (vraag 4) | afgeleid uit `match_started.startedAt - player_joined.joinedAt` per join, mediaan per dag; geen los event (default) |

## Geblokkeerd — geen voorgestelde default mogelijk (bevinding 12)

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
  ([`../README.md`](../README.md), sectie 6, checkpoint 7: "Hash-mechanisme voor
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
geen onderdeel van deze fase** — dit voorstel markeert de blokkade, lost hem
niet op.

## Open vragen — expliciet, met een voorgestelde default

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

Elke open vraag krijgt hier een default zodat dit voorstel niet blokkeert, maar
blijft gemarkeerd als voorstel — niet als vastgesteld gedrag, conform
`REVIEW.md` bevinding 9's aanbeveling voor "product/data-review". Anders dan de
drie geblokkeerde kolommen hierboven zijn deze vijf vragen niet bekritiseerd
als onoplosbaar — alleen (samen met de rest van dit document) als "hoort nog
niet als runtimecode gebouwd te worden" (bevinding 11): dit voorstel levert dan
ook bewust geen `aggregate.js` of andere `server/`-code.
