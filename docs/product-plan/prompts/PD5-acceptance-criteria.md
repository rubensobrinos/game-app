# Prompt — PD5: Acceptance-criteria traceability

Onderdeel van [`docs/product-plan/README.md`](../README.md), fase PD5. Vereist PD1
en PD4 (geen technische afhankelijkheid, wel inhoudelijk: de tabel moet naar
bestaande code kunnen verwijzen). Doel: de 9 "Succescriteria MVP" uit `PRODUCT.md`
omzetten in een traceability-tabel die vastlegt wélk bewijs er al bestaat en welk
niet — **geen nieuwe tests, geen oordeel of een criterium "voldaan" is**, alleen
zichtbaar maken wat er is.

## Herkomst van de data hieronder

Een onderzoeksagent heeft alle zes zusterplannen (`game-flow-plan`, `game-rules-plan`,
`architecture-plan`, `protocol-plan`, `data-model-plan`, `deployment-and-testing-plan`)
doorzocht op bewijs per criterium. De kerncijfers uit dat onderzoek zijn vóór
verwerking onafhankelijk herverifieerd door de tests zelf te draaien:
`client/flow/*.test.mjs` → 173/173, `server/data/*.test.js` → 66/66,
`server/protocol/*.test.mjs` → 101/101, `tests/fixtures/*.test.js` → 7/7 — allemaal
exact zoals het onderzoek claimde. De losse bestandsverwijzingen per criterium
hieronder zijn niet allemaal individueel herverifieerd; behandel ze als een
snapshot, niet als een garantie die nooit meer hoeft te worden gecontroleerd.

## Brondocument

[`docs/multiplayer/PRODUCT.md`](../../multiplayer/PRODUCT.md), sectie
"Succescriteria MVP" (9 items, volledige brontekst — tel na vóór je begint):

1. `quick_start_to_room_10s`: "Van homepage naar aangemaakte room in maximaal 10 seconden via `Snel starten`."
2. `qr_scan_to_lobby_10s`: "Van QR-scan naar lobby in maximaal 10 seconden op een gemiddelde telefoon."
3. `no_account_email_or_install_prompt`: "Geen account-, e-mail- of installatieprompt vóór of tijdens een game."
4. `every_player_can_reshare`: "Iedere aangesloten speler kan de QR of join-link opnieuw delen."
5. `hundred_players_twenty_rounds_no_desync`: "Eén room met 100 spelers doorloopt 20 rondes zonder desynchronisatie of crash."
6. `refresh_recovery_5s_score_kept`: "Refresh of korte netwerkuitval herstelt binnen 5 seconden met behoud van score."
7. `rematch_without_new_code_scan_or_name`: "Een rematch start zonder nieuwe code, QR-scan of naamkeuze."
8. `only_anonymous_aggregated_stats_retained`: "Alleen de anonieme, geaggregeerde statistieken uit `DATA-MODEL.md` blijven bewaard."
9. `core_flow_without_flag_logo_spectator_payment`: "De kernflow werkt zonder groepsvlag, logo-generator, spectator-scherm of betaling."

## Statusmodel

Drie waarden, geen "voldaan/niet voldaan" — dat vereist E2E/loadtestbewijs dat nog
grotendeels ontbreekt:

- `'not_started'` — geen enkele module levert vandaag aantoonbaar bewijs.
- `'partial'` — bouwstenen bestaan en zijn getest, maar dekken het criterium niet
  volledig (bijv. de logica bestaat, de tijdsgrens zelf wordt nergens gemeten).
- `'built'` — de sterkste beschikbare dekking; nog steeds geen garantie, wel het
  meest directe bewijs van de negen.

## Te bouwen

Bestand: `shared/product/acceptance-criteria.mjs` + `.test.mjs`.

```js
// acceptance-criteria.mjs
//
// "Succescriteria MVP" uit PRODUCT.md, met per criterium een snapshot van bestaand
// bewijs in de zes zusterplannen (onderzocht en kerncijfers herverifieerd op
// 2026-08-02, zie PD5-acceptance-criteria.md). `status` is GEEN oordeel dat een
// criterium gehaald is — alleen of er al aantoonbaar bewijs bestaat. `evidence` is
// een snapshot, geen levende link; bij twijfel opnieuw natrekken in de genoemde
// bestanden, niet blind vertrouwen.
export const LAST_VERIFIED = '2026-08-02';

export const ACCEPTANCE_CRITERIA = Object.freeze([
  {
    id: 'quick_start_to_room_10s',
    text: 'Van homepage naar aangemaakte room in maximaal 10 seconden via `Snel starten`.',
    status: 'partial',
    evidence: Object.freeze([
      'game-flow-plan GF2b — client/flow/host-setup-state.mjs (32 tests)',
      'protocol-plan PR3 — server/protocol/rest-games-create-join.mjs (onderdeel van 101 tests)',
      'de 10s-tijdgrens zelf wordt nergens gemeten; dat is deployment-and-testing-plan DT4a/DT4b (E2E), nog niet gestart',
    ]),
  },
  {
    id: 'qr_scan_to_lobby_10s',
    text: 'Van QR-scan naar lobby in maximaal 10 seconden op een gemiddelde telefoon.',
    status: 'partial',
    evidence: Object.freeze([
      'game-flow-plan GF1 — client/flow/route-resolver.mjs (33 tests, dekt /j/{inviteId})',
      'game-flow-plan GF2a — client/flow/join-state.mjs (29 tests)',
      'game-flow-plan GF6 — client/flow/share-actions.mjs (14 tests, lokale QR-generatie)',
      'de mobiele 10s-tijdsclaim zelf is toegewezen aan deployment-and-testing-plan DT4b, nog niet gestart',
    ]),
  },
  {
    id: 'no_account_email_or_install_prompt',
    text: 'Geen account-, e-mail- of installatieprompt vóór of tijdens een game.',
    status: 'partial',
    evidence: Object.freeze([
      'protocol-plan PR3 — server/protocol/auth-shape.mjs + rest-games-create-join.test.mjs: sessionToken, displayName optioneel, geen e-mailveld in enig schema (structureel bewijs, geen expliciete "geen accountprompt"-test)',
      'installprompt-afwezigheid nergens in de codebase geraakt (geen PWA-manifest/service-worker gevonden)',
    ]),
  },
  {
    id: 'every_player_can_reshare',
    text: 'Iedere aangesloten speler kan de QR of join-link opnieuw delen.',
    status: 'partial',
    evidence: Object.freeze([
      'game-flow-plan GF6 — client/flow/share-actions.mjs (14 tests, rolonafhankelijke shareActionsFor/shareUrlsFor, geen host-only gate in de code)',
      'deployment-and-testing-plan integration-matrix.md rij 6 ("elke speler, niet alleen host") — scenario benoemd, niet uitgevoerd',
    ]),
  },
  {
    id: 'hundred_players_twenty_rounds_no_desync',
    text: 'Eén room met 100 spelers doorloopt 20 rondes zonder desynchronisatie of crash.',
    status: 'not_started',
    evidence: Object.freeze([
      'DEPLOYMENT-AND-TESTING.md §Slagingscriteria L1 is het letterlijke brondoel ("1 room × 100 spelers, 20 rondes")',
      'deployment-and-testing-plan DT5 (loadtest, k6) heeft nog geen uitvoerbare code',
      'architecture-plan: alleen AR1 (server/architecture/state-machine.js) is gebouwd; AR2-AR4 (room-codes, snapshot-precedence, server-time) en multi-room-integratie ontbreken',
    ]),
  },
  {
    id: 'refresh_recovery_5s_score_kept',
    text: 'Refresh of korte netwerkuitval herstelt binnen 5 seconden met behoud van score.',
    status: 'partial',
    evidence: Object.freeze([
      'game-flow-plan GF4 — client/flow/reconnect-state.mjs (26 tests, backoff-reeks 1-2-4-8-16-max30s, "snapshot leidend")',
      'game-flow-plan GF-PROGRESS.md: session-store (lokaal bewaren sessietoken na refresh) staat nog op 🔴 Ontbreekt',
      'architecture-plan AR3 (snapshot-precedence) bestaat nog niet, alleen als planitem',
    ]),
  },
  {
    id: 'rematch_without_new_code_scan_or_name',
    text: 'Een rematch start zonder nieuwe code, QR-scan of naamkeuze.',
    status: 'built',
    evidence: Object.freeze([
      'game-flow-plan GF3 — client/flow/match-phase-state.mjs (rematch-transitie getest: game:rematch-started → LOBBY met nieuwe matchId)',
      'data-model-plan HANDOFF.md §3 — reset-semantiek schriftelijk bevestigd (Player blijft hetzelfde room-scoped record, alleen score/telling reset), nog niet als DM-code gebouwd',
    ]),
  },
  {
    id: 'only_anonymous_aggregated_stats_retained',
    text: 'Alleen de anonieme, geaggregeerde statistieken uit `DATA-MODEL.md` blijven bewaard.',
    status: 'not_started',
    evidence: Object.freeze([
      'data-model-plan DM0/DM1 — server/data/redis-keys.js + ttl.js (66 tests) bewijzen alleen TTL-verval van actieve roomdata, niet de scope van persistente opslag',
      'data-model-plan README §DM5 (privacy-guard) en §DM8 (analytics-traceability) zijn nog niet gebouwd',
    ]),
  },
  {
    id: 'core_flow_without_flag_logo_spectator_payment',
    text: 'De kernflow werkt zonder groepsvlag, logo-generator, spectator-scherm of betaling.',
    status: 'partial',
    evidence: Object.freeze([
      'game-flow-plan: GF0-GF6 gebouwd en getest (173 tests) zonder GF7 (teams/spectator, expliciet on hold)',
      'game-rules-plan GR-PROGRESS.md: Golf 2/logo\'s expliciet buiten scope, teams (GR6) nog niet gestart',
      'impliciet bewijs door afwezigheid (geen van de vier uitgesloten features komt voor in de wél gebouwde modules), geen expliciete "werkt-zonder-X"-test; betaling komt nergens in server/client-code voor',
    ]),
  },
]);
```

## Verplichte testgevallen — `acceptance-criteria.test.mjs`

| # | Scenario | Verwacht |
| --- | --- | --- |
| 1 | `ACCEPTANCE_CRITERIA.length` | `9` |
| 2 | `ACCEPTANCE_CRITERIA.map(i => i.id)` komt exact overeen met de 9 canonieke ID's hierboven, in die volgorde | pass |
| 3 | de `text` van elk item is exact gelijk aan de brontekst hierboven | pass |
| 4 | elke `status` is een van `'not_started' \| 'partial' \| 'built'` | pass |
| 5 | de statusverdeling is exact: 1× `'built'` (`rematch_without_new_code_scan_or_name`), 2× `'not_started'` (`hundred_players_twenty_rounds_no_desync`, `only_anonymous_aggregated_stats_retained`), 6× `'partial'` (de rest) | pass — vangt een per-ongeluk-gewijzigde status |
| 6 | elk `evidence`-array is niet-leeg en bevat uitsluitend niet-lege strings | pass |
| 7 | `ACCEPTANCE_CRITERIA` en elk `evidence`-array zijn bevroren: een mutatiepoging verandert de inhoud niet | pass, zelfde patroon als PD1/PD2/PD4 |
| 8 | `LAST_VERIFIED === '2026-08-02'` | pass |

## Niet in scope

- Nieuwe E2E-, load- of integratietests bouwen om een criterium daadwerkelijk te
  bewijzen — dat is `deployment-and-testing-plan`/`architecture-plan`/andere
  eigenaren, niet PD.
- Een oordeel vellen of een criterium "gehaald" is — dit bestand registreert bewijs,
  het beoordeelt niet.
- De tabel automatisch actueel houden (bijv. door bestanden in te lezen en te tellen)
  — dat zou de scope van "docs/refactor" naar "tooling bouwen" verschuiven; dit is
  bewust een handmatig te verversen snapshot.

## Definition of done

- Alle 8 testgevallen slagen: `node --test shared/product/acceptance-criteria.test.mjs`.
- `node --test shared/product/hard-rules.test.mjs shared/product/mvp-scope-guard.test.mjs shared/product/quick-start-preset.test.mjs shared/product/later-extensions-registry.test.mjs shared/product/acceptance-criteria.test.mjs`
  blijft volledig groen (36/36: 27 bestaand + 9 nieuw... **let op**: 9 criteria, maar
  8 testgevallen — tel dus 27 + 8 = 35 in totaal, niet 36; controleer dit zelf
  opnieuw vóór je het meldt, reken niet blind op dit getal).
- Precies 2 bestanden aangeraakt (nieuw), ruim binnen de bestandengrens.
