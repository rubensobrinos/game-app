# Voortgang — DEPLOYMENT-AND-TESTING.md realisatie

Bijgewerkt: 2026-08-02. Zie [`README.md`](README.md) voor het volledige plan en
[`prompts/`](prompts/) voor de uitvoerbare prompt per fase. Dit bestand is de
checklist — bijwerken bij elke fase-afronding, niet alleen aan het eind.

## Per sectie in DEPLOYMENT-AND-TESTING.md

| § | Status | Fase / toelichting |
| --- | --- | --- |
| Doelomgeving / Mac Studio 24/7 | ⚪ Buiten scope | `prod`, always_ask |
| Referentie Docker Compose | ⚪ Buiten scope | `prod`, always_ask |
| Bereikbaarheid (Tunnel/port forwarding) | ⚪ Buiten scope | `prod`, always_ask |
| Reverse-proxy en browsersecurity | ⚪ Buiten scope | `prod`, always_ask |
| Assets | ⚪ Buiten scope | `prod`, always_ask |
| Observability | ⚪ Buiten scope | `prod`, always_ask |
| Back-ups | ⚪ Buiten scope | `prod`, always_ask |
| Testinfra — mapstructuur (`tests/`) | ✅ Klaar | DT0 |
| Testinfra — CI-kloof gedocumenteerd | ✅ Klaar | DT0b |
| Testfixtures (Room/Session/Player/Match/Round/Answer) | ✅ Klaar | DT2 — 7/7 tests groen |
| Testlagen — Unit | ⚪ N.v.t. | eigendom van elke module-eigenaar zelf |
| Testlagen — Contracttests | 🔵 Vervallen bij mij | PROTOCOL.md's PR7 bouwt dit zelf; DT1a blijft als auditmatrix (26 open beslispunten + kruisverwijzing) |
| Testlagen — Integratie | 🟡 Matrix klaar, code nog niet | DT3a: 14 scenario's met prerequisite + activatiecriterium; DT3b wacht af |
| Testlagen — Browser/E2E | 🔴 Nog niet gestart | DT4a/DT4b wachten op `deps`-akkoord (Playwright) |
| Testlagen — Restart-/chaostests | 🔴 Nog niet gestart | DT6 wacht op autorisatie per stap |
| Testlagen — Loadtests | 🔴 Nog niet gestart | DT5 wacht op `deps`/`prod`-akkoord (k6) |
| Handmatige pilots | ⚪ Buiten scope | `prod`, always_ask |
| Release / Rollback | ⚪ Buiten scope | `prod`, always_ask |
| Definition of Done (MVP) | 🔴 Nog niet gestart | hangt af van bijna alle rijen hierboven |

## Openstaande actiepunten

- [ ] DT3b — scenario's uit de integratiematrix omzetten naar `test.skip`-code
      zodra hun activatiecriterium behaald is. Nu nog geen enkele: alles wacht op
      een echt draaiende server.
- [ ] DT4a/DT4b — E2E. Wacht op `deps`-akkoord voor Playwright.
- [ ] DT5 — loadtests. Wacht op `deps`-akkoord voor k6, plus apart akkoord voor
      daadwerkelijke uitvoering.
- [ ] DT6 — chaostests. Wacht op autorisatie per stap (installeren/opstarten,
      resetten, uitvoeren).
- [ ] DT7 — CI-volgordevoorstel. Wacht op goedkeuring; lost de CI-kloof uit DT0b op.
- [x] DT1b geretireerd; kruisverwijzing met protocol-plan's 15 open vragen
      toegevoegd aan `traceability-matrix.md`.

## Cijfers

- **DT0, DT0b, DT1a, DT2, DT3a:** afgerond en gecommit op `main`.
- **DT1b:** vervallen — overgenomen door PROTOCOL.md's PR7.
- **DT3b–DT7:** nog niet gestart, elk met een expliciet openstaand checkpoint.
- Testfixtures: 7/7 tests groen (`tests/fixtures/index.test.js`).
- Traceability-matrix: 26 open beslispunten + kruisverwijzing.
- Integratiematrix: 14 scenario's, elk met prerequisite + activatiecriterium.
