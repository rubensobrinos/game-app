# Prompt — DM5: Privacy-guard (allowlist per doeltabel)

Onderdeel van [`docs/data-model-plan/README.md`](../README.md), fase DM5.
Afhankelijk van DM3 (voor de veldnamen van `Session`/`Player`/etc. die de guard
moet weren — `tokenHash` zit in `Session`, DM2a). Corrigeert `REVIEW.md` bevinding
10: een denylist op bekende veldnamen mist aliassen en geneste objecten; dit wordt
een allowlist per doeltabel.

## Context — de letterlijke bron

`docs/multiplayer/DATA-MODEL.md`, sectie "Wat niet persistent wordt opgeslagen":
namen (zelfgekozen of gegenereerd), sessietokens/tokenhashes, individuele scores
en antwoordhistorie, IP-adressen, user-agentstrings, room-koppelingen tussen
dezelfde persoon, permanente speler-ID's, groepsvlag/badge.

Sectie "Persistente analytics" geeft de drie doeltabellen met exacte
kolomnamen (zie ook DM8, die dezelfde tabellen als voorstel naar `docs/`
overneemt — DM5 en DM8 gebruiken bewust dezelfde bron, niet twee losse lijsten):

```text
game_sessions: id, room_id_hash, match_sequence, created_at, started_at,
  finished_at, language, difficulty, pacing, mode, game_types, total_rounds,
  max_player_count, late_join_count, joins_via_qr, joins_via_link,
  joins_via_code, share_qr_open_count, share_link_open_count,
  finished_normally, rematch_of

round_stats: id, game_session_id, round_number, game_type, question_key,
  answer_count, correct_count, average_answer_ms, no_answer_count

daily_metrics: date, rooms_created, games_started, games_finished,
  players_joined, rematches, median_players_per_game,
  median_join_to_start_seconds
```

Nullable in de bron (mogen ontbreken of `null` zijn): `started_at`, `finished_at`,
`average_answer_ms`, `rematch_of`, `median_players_per_game`,
`median_join_to_start_seconds`. Alle overige kolommen zijn `not null`.

## Waarom allowlist, niet denylist (bevinding 10)

Controleren op bekende slechte veldnamen (`playerId`, `displayName`, `token`, ...)
mist een payload met bijvoorbeeld `participant`, `rawSession`, of een geneste
`meta.ip`-property — die heet niet letterlijk zoals de denylist verwacht en komt
er toch doorheen. Een allowlist per tabel is sterker: alleen kolomnamen die
letterlijk in de bron staan mogen door; alles anders — ongeacht naam — wordt
geweigerd. Dat is tegelijk het privacymechanisme (namen/tokens/IP's staan simpelweg
niet op de lijst) én een schema-mechanisme (typefouten/nieuwe velden vallen meteen
op).

## Stappen

1. `server/data/privacy-guard.js`:
   ```js
   const ALLOWED_COLUMNS = Object.freeze({
     game_sessions: Object.freeze([/* 21 kolomnamen, letterlijk als hierboven */]),
     round_stats: Object.freeze([/* 9 kolomnamen */]),
     daily_metrics: Object.freeze([/* 8 kolomnamen */]),
   });
   const NULLABLE_COLUMNS = Object.freeze({
     game_sessions: Object.freeze(['started_at', 'finished_at', 'rematch_of']),
     round_stats: Object.freeze(['average_answer_ms']),
     daily_metrics: Object.freeze(['median_players_per_game', 'median_join_to_start_seconds']),
   });

   /**
    * Werpt RangeError als `record` een key bevat die niet in
    * ALLOWED_COLUMNS[table] staat, of als een niet-nullable kolom ontbreekt/null
    * is. Controleert GEEN kolomtypen (dat is DM8-traceability, niet privacy) —
    * uitsluitend welke velden aanwezig mogen zijn.
    * @param {"game_sessions"|"round_stats"|"daily_metrics"} table
    * @param {Record<string, unknown>} record
    */
   function assertAllowedAnalyticsRecord(table, record) { /* ... */ }
   ```
2. Elke sleutel in `record` die niet in `ALLOWED_COLUMNS[table]` staat → direct
   `RangeError` met de aanstootgevende sleutelnaam in de melding (geen stille
   drop — een onverwacht veld is een programmeerfout die zichtbaar moet breken,
   niet onopgemerkt verdwijnen).
3. Elke sleutel in `ALLOWED_COLUMNS[table]` die niet in `NULLABLE_COLUMNS[table]`
   staat, moet aanwezig zijn en niet `null`/`undefined`.
4. Geneste objecten/arrays als waarde zijn toegestaan **mits de sleutel zelf op de
   allowlist staat** (bijv. `game_types` is een array — dat is prima, de allowlist
   controleert de buitenste sleutel, niet de waardevorm; kolomtype-precisie is
   DM8's taak).

## Tests

- elk van de drie tabellen: het letterlijke voorbeeldrecord (alle kolommen
  ingevuld) slaagt;
- elke tabel: een nullable kolom mag ontbreken of `null` zijn, slaagt;
- elke tabel: een niet-nullable kolom die ontbreekt of `null` is → `RangeError`;
- **regressietest voor bevinding 10**: een record met een extra sleutel die géén
  bekende "slechte naam" is (bijv. `participant`, `rawSession`, `meta`) wordt
  alsnog geweigerd — bewijst dat dit een allowlist is, geen denylist;
  aanvullend: een record met letterlijk `playerId`, `displayName`, `tokenHash`, of
  `ip` als sleutel wordt vanzelfsprekend ook geweigerd (die staan sowieso niet op
  de allowlist — geen aparte denylist-code nodig om dat af te dwingen);
- `round_stats`/`game_sessions`/`daily_metrics` gebruiken elk hun eigen
  tabelnaam — een sleutel die op tabel A toegestaan is maar niet op tabel B (ze
  overlappen niet toevallig) wordt op B geweigerd;
- **regressietest voor bevinding 13** (`REVIEW-DM2-DM9.md`): `ALLOWED_COLUMNS`
  bevat per tabel het exacte, getelde aantal kolommen uit de brontabel hierboven
  — `game_sessions.length === 21`, `round_stats.length === 9`,
  `daily_metrics.length === 8` — zodat een handmatige telfout (zoals de "20" die
  hier eerder abusievelijk stond voor `game_sessions`, dat er 21 heeft) meteen
  faalt in plaats van alleen in een commentaarregel te staan.

## Harde grenzen

- Geen kolomtype-validatie (uuid-formaat, timestamptz-parsing, etc.) — dat is DM8.
- Geen dependency.
- Geen wijziging aan de kolomnamen zelf t.o.v. `DATA-MODEL.md` — dit is een
  letterlijke transcriptie (a), geen nieuw ontwerp.
- 2 bestanden (module + test).

## Definition of done

- Alle drie tabellen hebben een sluitende allowlist die exact de gegeven kolommen
  bevat, niet meer.
- Een niet-triviale, niet-voor-de-hand-liggende extra sleutel (niet letterlijk
  "playerId" of "token") wordt aantoonbaar geweigerd.
- `node --test 'server/data/**/*.test.js'` slaagt.

**Status: uitgevoerd.** `server/data/privacy-guard.js` (`ALLOWED_COLUMNS`,
`NULLABLE_COLUMNS` en `assertAllowedAnalyticsRecord`) en
`server/data/privacy-guard.test.js` staan er.
`node --test server/data/privacy-guard.test.js` → 109/109 groen (6 suites, 0
fail). Geen `package.json`, lockfile of dependency toegevoegd.
