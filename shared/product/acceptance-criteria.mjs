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
