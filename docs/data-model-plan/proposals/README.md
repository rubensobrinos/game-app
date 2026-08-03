# Voorstellen — DATA-MODEL.md

Niet-bindende voorstellen die uit [`DM8-analytics-proposal.md`](../prompts/DM8-analytics-proposal.md)
komen. Bewust **geen code** — zie de prompt zelf voor waarom (`REVIEW-DM2-DM9.md`
bevinding 11: een voorstel mag niet als bewezen runtimegedrag landen vóór
product/data-review) en waarom `schema.sql` hier onder `docs/` staat i.p.v. in
`server/`-code (bevinding 9: dat kan te makkelijk als goedgekeurde migratie
worden aangezien).

| Bestand | Inhoud |
| --- | --- |
| [`analytics-event-contract.md`](analytics-event-contract.md) | Kolomtraceabiliteitsmatrix voor `game_sessions`/`round_stats`/`daily_metrics` (38 kolommen), voorgesteld eventcontract (6 events), en een expliciete "Geblokkeerd"-sectie voor `id`/`room_id_hash`/`max_player_count` — deze drie hebben geen bevestigde bron in de voorgestelde events, dus geen (oneerlijke) default. |
| [`schema.sql`](schema.sql) | Letterlijke transcriptie van de drie `CREATE TABLE`-statements uit `docs/multiplayer/DATA-MODEL.md`, met een `VOORSTEL, GEEN MIGRATIE`-headercomment. |
| [`observatie-eventcontract-vs-designdocumentatie.md`](observatie-eventcontract-vs-designdocumentatie.md) | Vergelijking van DM8's eventcontract met de events genoemd in `docs/design-documentation/`; geen herzien voorstel, input voor de volgende DM8-reviewronde. |

Beide (de eerste twee) wachten op product-/data-review vóór ze bindend worden, en op de
database-engine-ADR (`docs/data-model-plan/README.md` §6, checkpoint 8) vóór
`schema.sql` ooit als migratie kan draaien.
