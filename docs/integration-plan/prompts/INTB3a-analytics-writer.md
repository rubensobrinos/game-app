# INTB3a — Postgres-analytics: asynchrone, gebufferde schrijfweg

**Domein:** INT-B. **Blokkade:** de `pg`-dependency (INT-A voegt hem toe).

---

## Prompt

Je bouwt de weg waarlangs geaggregeerde productstatistieken in PostgreSQL komen.
De belangrijkste eis is een negatieve: **er komt nooit een databasewrite in het
antwoordpad**.

### Lees eerst

- `docs/multiplayer/ARCHITECTURE.md` principe **9 Async analytics** — bufferen in
  geheugen of via Redis, in batches aggregeren.
- `docs/multiplayer/DATA-MODEL.md`, sectie **Persistente analytics** — de drie
  tabellen `game_sessions`, `round_stats`, `daily_metrics`, en daaronder de lijst
  **Wat niet persistent wordt opgeslagen**.
- `migrations/001-analytics.sql` — ligt klaar.
- `docs/multiplayer/DECISIONS.md` **#25** (PostgreSQL, geen SQLite) en **#26**
  (analytics-identifiers gebruiken een **aparte** HMAC-pepper — niet dezelfde als
  sessietokens).
- `server/data/privacy-guard.js` — bestaand; gebruiken, niet herbouwen.

### Wat je bouwt

`server/data/adapters/postgres/analytics.mjs`: een buffer die events opneemt en
in batches wegschrijft, plus de aggregatie naar de drie tabellen.

Eisen:

- **Opnemen is synchroon en goedkoop.** Een event aanbieden mag nooit wachten op
  de database. Vol raken van de buffer mag de aanroeper niet blokkeren — kies wat
  er dan gebeurt (oudste weggooien, of tellen en doorgaan) en documenteer het.
- **Wegvallen van de database is geen storing voor het spel.** Is Postgres weg,
  dan blijft een match gewoon draaien. Bewijs dat met een test.
- **`room_id_hash` mag niet terug te rekenen zijn** naar code of inviteId, en
  gebruikt de aparte analytics-pepper (#26). Twee rooms met dezelfde code in
  verschillende tijdvakken mogen niet dezelfde hash krijgen als dat herleidbaar
  maakt wie wanneer speelde — denk hierover na en leg je keuze vast.
- **Aggregaten, geen rijen per speler.** `round_stats` telt; het bewaart geen
  individuele antwoorden.

### Klaar wanneer

Een match draait volledig door terwijl Postgres onbereikbaar is, en de analytics
komen alsnog binnen zodra de database terug is — of gaan aantoonbaar en geteld
verloren, als dat de keuze is. Beide is verdedigbaar; stilzwijgend verliezen niet.

### Opleveren

Pad, het buffergedrag bij een volle buffer en bij een wegvallende database, hoe
`room_id_hash` wordt gevormd, en het testresultaat.
