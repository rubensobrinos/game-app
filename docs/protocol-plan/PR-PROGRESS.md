# Voortgang — PROTOCOL.md realisatie

Bijgewerkt: 2026-08-02 (ná uitvoering van PR9–PR12). Zie
[`README.md`](README.md) voor het volledige plan en [`prompts/`](prompts/) voor de
uitvoerbare prompt per fase. Dit bestand is de checklist — bijwerken bij elke
fase-afronding, niet alleen aan het eind.

## Per sectie in PROTOCOL.md

| § | Status | Fase / toelichting |
| --- | --- | --- |
| Basisregels (1–8) | ✅ Klaar | 5 (unieke `actionId`) ✅ PR1; 8 (geen stacktraces) ✅ PR2 (`buildErrorPayload`); 3 (geen token in eventpayload) en 7 (`UNSUPPORTED_EVENT`) ✅ PR4c (`client-events-dispatch.mjs`, `resolveEventValidator`) |
| Authenticatie en tijdelijke sessies — vorm | ✅ Klaar | PR3 (`auth-shape.mjs`) — Bearer-header + socket-handshake vormcheck, hergebruikt in PR3's `rest-games-session.mjs` en PR6's `reconnect.mjs` |
| Authenticatie en tijdelijke sessies — generatie/hashing | ✅ Klaar | PR8b + PR12: 32 random bytes, base64url, versieerbare HMAC-SHA256 met pepper en constant-time `verifyToken()`; zie `docs/multiplayer/DECISIONS.md` #26 |
| Event-envelope | ✅ Klaar | PR1 — envelope parsen/bouwen, ack-vorm, payloadgrootte |
| REST-endpoints (5 + nieuw: preview) | ✅ Klaar | PR9 verduidelijkt `POST /leave`; PR10 voegt de invite-only previewvalidator en integratie met de sessievalidatie toe. |
| State-snapshot | ✅ Klaar | PR11 valideert `self.eligibleFromRound`, `room.matchSequence` en de volledige nullable `room.pausedState`; de actieve-ronde-lekinvariant blijft gelden. |
| Client → server events (12 + 5 `round:answer`-varianten) | ✅ Klaar | PR11 valideert alle antwoordvormen en de vier waarden van `share:opened.method`: `qr \| link \| native \| code`. |
| Server → client events (16) | ✅ Klaar | PR11 verwerkt volledige pauzestatus, discriminated question-payloads voor vijf spelvormen en het algemene `rendererVersion`-veld. |
| Voorbeeld `round:started` (question-vorm) | ✅ Hiaat gedicht (documentatie) | **PR9** vervangt het volledige voorbeeld door de daadwerkelijke `publicQuestionPayload`-vorm uit `server/rules/question-selection.js`, voor alle vijf spelvormen (was: alleen een — bovendien onjuiste — `real_or_fake_flag`-vorm). Open vraag §10 is hiermee als documentatiepunt beantwoord; `PR5b`'s `validateRoundStartedPayload` valideert dit nog niet strikt voor alle vijf vormen — dat is `PR11` §2. |
| Foutcodes (23 codes, 4 categorieën) | ✅ Klaar (enum ongewijzigd) | PR2 — enum + `buildErrorPayload` + contracttest die `PROTOCOL.md` van schijf leest. **PR9** voegt een voetnoot toe bij `GAME_NOT_FOUND` (verlopen room-TTL, `DECISIONS.md` #2) en voegt bewust **geen** `INVALID_PAUSE_STATE` (#12) of `INVALID_SERVER_RESPONSE` (#19) toe — geen enum-wijziging, dus geen impact op PR2-code. |
| Reconnect | ✅ Klaar | PR6 — `reconnect.mjs`: backoff-reeks, snapshot-leidend, niet-herverzenden van geaccepteerde antwoorden |
| Inputveiligheid — naam | ✅ Klaar | PR3 (`input-safety.mjs`) |
| Inputveiligheid — payloadgrootte | ✅ Klaar | PR1 (`assertPayloadSize`) |
| Inputveiligheid — schema-validatie algemeen | ✅ Klaar | REST ✅ (PR3); events ✅ (PR4/PR5, zie boven) |
| Contracttests (tegen fake transport) | 🟡 Bestaande suite groen, uitbreiding gepland | PR7a–e: 38/38 groen. PR13 moet de PR9–PR12-uitbreidingen nog toevoegen aan de afzonderlijke contractsuite. |
| **PROTOCOL.md — DECISIONS.md-bijwerking zelf** | ✅ Klaar | **PR9** (nieuw, dit verslag): eerste fase die `PROTOCOL.md` zélf mag wijzigen. `protocolVersion` blijft `v1`; expliciet benoemd als contractueel strenger (verplichte nieuwe velden), niet als zuiver additief — zie de nieuwe toelichting bovenaan `PROTOCOL.md`. Vervolgfasen: `PR10` (preview-endpoint-validator), `PR11` (bestaande validators bijwerken naar deze spec). |

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
- [x] **PR9 — `PROTOCOL.md` bijwerken naar `DECISIONS.md`** — **uitgevoerd.**
      Eerste fase die `PROTOCOL.md` zélf wijzigt: §Foutcodes (`GAME_NOT_FOUND`-
      voetnoot), §REST-endpoints (nieuwe `GET /games/preview`-subsectie +
      `POST /leave`-verduidelijking), §State-snapshot (`eligibleFromRound`,
      `pausedState`), §Client → server events (`share:opened.method` 4 waarden),
      §Server → client events (`game:paused`, `session:revoked`, `round:ended`,
      `round:started` + `rendererVersion`) en §Voorbeeld `round:started`
      (volledig vervangen door de echte `question-selection.js`-vormen voor alle
      vijf spelvormen). `protocolVersion` blijft `v1`, expliciet benoemd als
      contractueel strenger, niet zuiver additief. `README.md`'s Open vragen
      §1–§17 zijn allemaal voorzien van een `DECISIONS.md`-verwijzing + citaat
      (§8/§9 gemarkeerd als bewuste scope-keuze, niet als opgelost). Nog niet
      gecommit (geen git-commando's uitgevoerd tijdens deze fase, zoals gevraagd).
      Vervolgfasen PR10 en PR11 zijn inmiddels eveneens uitgevoerd.
- [x] **PR10 — preview-endpointvalidator** — uitgevoerd en getest.
- [x] **PR11 — validators naar de bevestigde besluiten** — uitgevoerd en getest.
- [x] **PR12 — pepper-versionering en constant-time tokenverificatie** — uitgevoerd en getest.
- [ ] **PR13 — aparte protocolcontracttests uitbreiden** — prompt gereviewd en klaar,
      nog niet uitgevoerd.

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
- **PR4–PR12:** gebouwd en groen. De huidige protocolmodules worden in de
  bijbehorende commit vastgelegd; alleen PR13 resteert als geplande uitbreiding.
- **Totaal geverifieerd op 2026-08-02:** `node --test server/protocol/*.test.mjs`
  → **499/499 groen**; `node --test tests/contract/protocol/*.test.mjs` →
  **38/38 groen**. 537 protocoltests in totaal, 0 falend.
- **17 open vragen** getrackt in `README.md`. Na PR9 zijn alle 17 voorzien van
  een verwijzing naar `DECISIONS.md` (punt + citaat): 14 inhoudelijk beantwoord
  en (deels) in `PROTOCOL.md` verwerkt, 2 (teams #8, spectators #9) expliciet
  als "niet nu bouwen" gemarkeerd (bewuste scope-keuze, geen opgeloste vraag),
  1 (contentmodule-extractie, #15) alleen qua locatie beantwoord maar inhoudelijk
  nog niet gebouwd. Nog steeds 0 vragen zelf oplossend beslíst door deze agent —
  elke inhoudelijke keuze is herleidbaar tot een genummerd `DECISIONS.md`-punt
  van de producteigenaar, niet zelf verzonnen (dat zou een `public_api`-besluit
  zijn).
- **PR9–PR12:** specificatie, validators, previewendpoint en tokenverificatie
  bijgewerkt op 2026-08-02. PR13 blijft gepland.
