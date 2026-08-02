# Voortgang — PROTOCOL.md realisatie

Bijgewerkt: 2026-08-02 (verificatieronde, ná PR4/PR5/PR6/PR7-oplevering). Zie
[`README.md`](README.md) voor het volledige plan en [`prompts/`](prompts/) voor de
uitvoerbare prompt per fase. Dit bestand is de checklist — bijwerken bij elke
fase-afronding, niet alleen aan het eind.

## Per sectie in PROTOCOL.md

| § | Status | Fase / toelichting |
| --- | --- | --- |
| Basisregels (1–8) | ✅ Klaar | 5 (unieke `actionId`) ✅ PR1; 8 (geen stacktraces) ✅ PR2 (`buildErrorPayload`); 3 (geen token in eventpayload) en 7 (`UNSUPPORTED_EVENT`) ✅ PR4c (`client-events-dispatch.mjs`, `resolveEventValidator`) |
| Authenticatie en tijdelijke sessies — vorm | ✅ Klaar | PR3 (`auth-shape.mjs`) — Bearer-header + socket-handshake vormcheck, hergebruikt in PR3's `rest-games-session.mjs` en PR6's `reconnect.mjs` |
| Authenticatie en tijdelijke sessies — generatie/hashing | 🟢 Besluit bevestigd / code nog niet begonnen | PR8a-voorstel bevestigd: 32 random bytes, base64url, versieerbare HMAC-SHA256 met pepper en constant-time verificatie; zie `docs/multiplayer/DECISIONS.md` #26 |
| Event-envelope | ✅ Klaar | PR1 — envelope parsen/bouwen, ack-vorm, payloadgrootte |
| REST-endpoints (5) | ✅ Klaar | PR3 — `rest-games-create-join.mjs` + `rest-games-session.mjs` |
| State-snapshot | ✅ Klaar | PR5d — `snapshot-shape.mjs`: vorm + invariant "geen correct antwoord van actieve ronde" |
| Client → server events (12 + 5 `round:answer`-varianten) | ✅ Klaar | PR4a–d — `client-events-game-lifecycle-a.mjs`, `-b.mjs`, `client-events-dispatch.mjs`, `client-events-round-answer-variants.mjs` |
| Server → client events (16) | ✅ Klaar | PR5a–e — `server-events-room-lifecycle.mjs`, `-round-lifecycle.mjs`, `-scoring.mjs`, `-session-and-error.mjs`, `-recipients.mjs`, `throttle-round-progress.mjs` |
| Voorbeeld `round:started` (question-vorm) | 🔴 Hiaat in de spec | Open vraag §10 — alleen de multiple-choice-vorm is uitgewerkt, 4 andere spelvormen niet (documentatiepunt, geen codewerk) |
| Foutcodes (23 codes, 4 categorieën) | ✅ Klaar | PR2 — enum + `buildErrorPayload` + contracttest die `PROTOCOL.md` van schijf leest |
| Reconnect | ✅ Klaar | PR6 — `reconnect.mjs`: backoff-reeks, snapshot-leidend, niet-herverzenden van geaccepteerde antwoorden |
| Inputveiligheid — naam | ✅ Klaar | PR3 (`input-safety.mjs`) |
| Inputveiligheid — payloadgrootte | ✅ Klaar | PR1 (`assertPayloadSize`) |
| Inputveiligheid — schema-validatie algemeen | ✅ Klaar | REST ✅ (PR3); events ✅ (PR4/PR5, zie boven) |
| Contracttests (tegen fake transport) | ✅ Klaar | PR7a–e — `tests/contract/protocol/`: `fake-transport.mjs`, `envelope-idempotency-scenario.mjs`, `rest-scenario.mjs`, `event-and-snapshot-scenario.mjs`, `reconnect-scenario.mjs`, 38/38 tests groen |

## Openstaande actiepunten

- [x] PR3 committen — gebeurd (verspreid over 3 commits; de PR3-modules zelf zijn door
      een gelijktijdige commit-race meegelift in een commit van de
      deployment-and-testing-plan-agent in plaats van een eigen commit te krijgen;
      inhoudelijk geverifieerd, geen dataverlies).
- [x] PR4 — client→server event-schema's — **gebouwd, getest, groen.** Nog niet
      gecommit (untracked in `server/protocol/`).
- [x] PR5 — server→client event-schema's + snapshot — **gebouwd, getest, groen.**
      Nog niet gecommit (untracked in `server/protocol/`).
- [x] PR6 — reconnect-acceptatieregels — **gebouwd, getest, groen.** Nog niet
      gecommit (untracked in `server/protocol/`).
- [x] PR7 — contracttest-suite tegen fake transport — **gebouwd, getest, groen**
      (38/38) in `tests/contract/protocol/`. Deze hele map is nog untracked
      (geen enkel bestand ooit gecommit).
- [x] PR8a — schriftelijk sessie/tokenvoorstel — **geschreven**
      (`PR8a-auth-session-voorstel.md`), nog niet gecommit. Checkpoint (menselijk
      akkoord) blijft vóór ook maar één regel PR8b-code; PR8b zelf is nog niet
      begonnen.
- [ ] **Commit-achterstand wegwerken** — vrijwel alles hierboven (PR4–PR8a) staat
      alleen op schijf. Zie `docs/STATUS-AUDIT-2026-08-02.md` §2.2 voor de
      repo-brede analyse; dit bestand documenteert alleen de protocol-plan-kant
      ervan, lost het zelf niet op (buiten scope van deze verificatieronde: geen
      git-commando's uitgevoerd die de repo wijzigen).
- [x] `docs/game-flow-plan/protocol-interface-proposal.md` beoordeeld — 7 vragen relevant
      voor `PROTOCOL.md` (item 9 is voor `DATA-MODEL.md`, item 8 was al zelf opgelost).
      Verwerkt in `README.md`'s Open vragen §2 (pausedState nu 2 losse deelvragen +
      reason-enum), §8 (teams, 3 concrete joinvolgorde-opties), §9 (spectator, 3
      deelvragen) en nieuwe §17 (naamsuggestie/preview-endpoint vóór join).
- [x] `docs/data-model-plan/HANDOFF.md` en `docs/game-rules-plan/HANDOFF.md` gelezen en
      verwerkt: Open vraag §13 en §14 grotendeels beantwoord (zie `README.md`), 1
      restvraag bij §14 blijft open. Eigen [`HANDOFF.md`](HANDOFF.md) geschreven —
      bevestiging gevraagd aan `architecture-plan` over `countdownEndsAt`-berekening,
      status teruggekoppeld aan `game-flow-plan` (alle 7 vragen nog open, wachten op
      een mens).
- [x] `docs/product-plan/data-model-and-protocol-interface-proposal.md` gelezen —
      optionele suggestie (`shared/product/hard-rules.mjs` citeren in een
      contracttest) genoteerd in eigen `HANDOFF.md` als mogelijke latere PR7-revisie,
      niet met terugwerkende kracht toegepast.
- [x] `countdownEndsAt` bevestigd als vluchtige, bij de transitie berekende waarde;
      niet persistent opslaan. Zie `docs/multiplayer/DECISIONS.md` #16.
- [x] De open vragen zijn door de producteigenaar beantwoord en ontdubbeld in
      `docs/multiplayer/DECISIONS.md`. Teams en spectators zijn uit de huidige scope;
      de overige besluiten moeten nog in protocolcode en brondocument worden verwerkt.
- [x] PR0/PR1 retroactief van een eigen promptbestand voorzien
      (`prompts/PR0-scaffold.md`, `prompts/PR1-envelope-idempotency.md`), voor
      consistentie met de zusterplannen.

## Cijfers

- **PR0–PR3:** gebouwd, geverifieerd én **gecommit** — 101/101 tests groen in
  `server/protocol/`, verspreid over commits `405c0e5` en `78aad9a`. **Let op:**
  de vier PR3-bestanden zelf (`auth-shape.mjs`, `input-safety.mjs`,
  `rest-games-create-join.mjs`, `rest-games-session.mjs` + hun tests) zitten qua
  diff in commit `4183d08`, wiens boodschap uitsluitend over
  deployment-and-testing-plan-prompts (DT3b–DT7) gaat — bevestigd via
  `git show 4183d08 --stat`. Dit is de door PR-PROGRESS eerder gemelde
  "commit-race" met de DT-agent; inhoudelijk geverifieerd (tests draaien, geen
  dataverlies), maar geen eigen PR3-commit.
- **PR4, PR5, PR6, PR7:** gebouwd en **volledig groen, nog niet gecommit** — dit
  levert de overige 316 tests in `server/protocol/*.test.mjs` (417 totaal − 101
  committed) plus 38 tests in het geheel nieuwe, untracked `tests/contract/protocol/`.
- **PR8a:** schriftelijk voorstel geschreven, nog niet gecommit; wacht op
  menselijk akkoord vóór PR8b-code (die nog niet bestaat).
- **Totaal geverifieerd op 2026-08-02:** `node --test server/protocol/*.test.mjs`
  → **417/417 groen**; `node --test tests/contract/protocol/*.test.mjs` →
  **38/38 groen**. 455 protocol-tests in totaal, 0 falend. Zie
  `docs/STATUS-AUDIT-2026-08-02.md` §2.2 voor de repo-brede commit-achterstand
  waar dit onderdeel van is.
- **17 open vragen** getrackt in `README.md`, waarvan 0 zelf opgelost (bewust — dat
  zou een `public_api`-besluit zijn).
