# Voortgang — PROTOCOL.md realisatie

Bijgewerkt: 2026-08-02. Zie [`README.md`](README.md) voor het volledige plan en
[`prompts/`](prompts/) voor de uitvoerbare prompt per fase. Dit bestand is de
checklist — bijwerken bij elke fase-afronding, niet alleen aan het eind.

## Per sectie in PROTOCOL.md

| § | Status | Fase / toelichting |
| --- | --- | --- |
| Basisregels (1–8) | 🟡 Deels | 5 (unieke `actionId`) ✅ PR1; 8 (geen stacktraces) ✅ PR2 (`buildErrorPayload`); 3 (geen token in eventpayload) en 7 (`UNSUPPORTED_EVENT`) zitten in PR4, nog niet uitgevoerd |
| Authenticatie en tijdelijke sessies — vorm | ✅ Klaar | PR3 (`auth-shape.mjs`) — Bearer-header + socket-handshake vormcheck, hergebruikt in PR3's `rest-games-session.mjs` |
| Authenticatie en tijdelijke sessies — generatie/hashing | ⛔ Geblokkeerd (`auth`, ADR-plichtig) | PR8a (schriftelijk voorstel) nog niet gestart; PR8b pas na expliciet akkoord |
| Event-envelope | ✅ Klaar | PR1 — envelope parsen/bouwen, ack-vorm, payloadgrootte |
| REST-endpoints (5) | ✅ Klaar | PR3 — `rest-games-create-join.mjs` + `rest-games-session.mjs` |
| State-snapshot | ⚪ Nog niet | PR5d — vorm + invariant "geen correct antwoord van actieve ronde"; prompt klaar en gereviewd |
| Client → server events (12 + 5 `round:answer`-varianten) | ⚪ Nog niet | PR4a–d; prompt klaar en gereviewd |
| Server → client events (16) | ⚪ Nog niet | PR5a–e; prompt klaar en gereviewd |
| Voorbeeld `round:started` (question-vorm) | 🔴 Hiaat in de spec | Open vraag §10 — alleen de multiple-choice-vorm is uitgewerkt, 4 andere spelvormen niet |
| Foutcodes (23 codes, 4 categorieën) | ✅ Klaar | PR2 — enum + `buildErrorPayload` + contracttest die `PROTOCOL.md` van schijf leest |
| Reconnect | ⚪ Nog niet | PR6; prompt klaar en gereviewd |
| Inputveiligheid — naam | ✅ Klaar | PR3 (`input-safety.mjs`) |
| Inputveiligheid — payloadgrootte | ✅ Klaar | PR1 (`assertPayloadSize`) |
| Inputveiligheid — schema-validatie algemeen | 🟡 Deels | REST ✅ (PR3); events nog niet (PR4/PR5) |
| Contracttests (tegen fake transport) | ⚪ Nog niet | PR7a–e; prompt klaar en gereviewd |

## Openstaande actiepunten

- [ ] PR4 — client→server event-schema's uitvoeren (prompt klaar en gereviewd).
- [ ] PR5 — server→client event-schema's + snapshot uitvoeren (prompt klaar en gereviewd).
- [ ] PR6 — reconnect-acceptatieregels uitvoeren (prompt klaar en gereviewd).
- [ ] PR7 — contracttest-suite tegen fake transport uitvoeren (prompt klaar en gereviewd).
- [ ] PR8a — schriftelijk sessie/tokenvoorstel opstellen; checkpoint (menselijk akkoord)
      vóór ook maar één regel PR8b-code.
- [ ] 16 open vragen in `README.md` wachten op antwoord van de eigenaren van
      `PRODUCT.md`/`DATA-MODEL.md`/`GAME-RULES.md`/`architecture-plan` (niets hiervan
      zelf stilzwijgend opgelost).
- [ ] `docs/game-flow-plan/protocol-interface-proposal.md` beoordelen — net geland,
      bevat vragen die direct bij `PROTOCOL.md` horen (team-event, spectator-auth,
      joinvolgorde-hoofdvraag).
- [ ] Commit-batching voor PR3-werk toepassen zodra gevraagd: `rest-games-create-join`
      (module + test, 574 regels) moet over 2 commits gesplitst worden voor de
      15-bestanden/5.000-regel-autonomiegrens; de rest past per module in één commit.

## Cijfers

- **PR0–PR3:** gebouwd en geverifieerd, **101/101 tests groen** in `server/protocol/`.
- **PR4–PR7:** prompts geschreven en gereviewd (1 should-fix + 1 nice-to-have
  gevonden en verwerkt), nog niet uitgevoerd.
- **PR8:** gesplitst in PR8a (voorstel, niet-bindend) / PR8b (code, pas na akkoord) —
  nog niet gestart, `auth`-ADR-plichtig.
- **16 open vragen** getrackt in `README.md`, waarvan 0 zelf opgelost (bewust —
  dat zou een `public_api`-besluit zijn).
- Niets van dit werk is gecommit; laatste commit dekt alleen PR0–PR2.
