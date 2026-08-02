# tests/load/

Loadtestlaag uit
[`DEPLOYMENT-AND-TESTING.md`](../../docs/multiplayer/DEPLOYMENT-AND-TESTING.md)
§Testlagen, gebouwd via
[`docs/deployment-and-testing-plan/`](../../docs/deployment-and-testing-plan/README.md)
fase DT5.

- **Deel 1 — evidence-tabel (klaar, 0/10 gemeten):**
  [`load-evidence-matrix.md`](../../docs/deployment-and-testing-plan/load-evidence-matrix.md)
  wijst elk L0–L3-criterium toe aan de runner die het daadwerkelijk kan bewijzen —
  niet alles is k6-terrein (visuele/state-/geheugencriteria horen elders, zie het
  document zelf).
- **Deel 2 — k6-scripts (klaar, 2026-08-02):**
  - [`l1-event-latency-and-answer-peak.js`](l1-event-latency-and-answer-peak.js)
    — rijen 4 en 5 (p95 eventlatency < 300 ms, antwoordpiek binnen 2 s). Eén
    room, `PLAYERS` deelnemers (env var, standaard 100 = L1-doel).
  - [`l2-l3-multi-room-scale.js`](l2-l3-multi-room-scale.js) — rijen 9 en 10
    (L2/L3-schaal). Genereert alleen de last; het eigenlijke oordeel over
    knelpunten hoort in observability, niet in dit script (zie het bestand
    zelf).
  - [`support/socketio-wire.js`](support/socketio-wire.js) — gedeelde
    Engine.IO-/Socket.IO-v4-framing, kale functies, geen `socket.io-client`-
    dependency (staat niet in `package.json`).
  - Vereist `k6` (`brew install k6`, gedaan onder het staande `deps`-akkoord
    voor test-/deploymentwerk).
- **Deel 3 — daadwerkelijk uitvoeren:** apart akkoord per schaal. L0-schaal
  (~20 spelers, `PLAYERS=20`) tegen de lokale stack is gegeven (2026-08-02);
  L1 (100 spelers) en hoger blijven apart geautoriseerd, L2/L3 bovendien pas
  na een omgeving-/providercheck (zie `load-evidence-matrix.md` §L2/L3).
  Status van de daadwerkelijke uitvoering: zie
  `docs/deployment-and-testing-plan/e2e-load-target-check.md`.
