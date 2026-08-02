# Voortgang — GAME-FLOW.md realisatie

Bijgewerkt: 2026-08-02. Zie [`README.md`](README.md) voor het volledige plan en
[`prompts/`](prompts/) voor de uitvoerbare prompt per fase. Dit bestand is de
checklist — bijwerken bij elke fase-afronding, niet alleen aan het eind.

## Per sectie in GAME-FLOW.md

| § | Status | Fase / toelichting |
| --- | --- | --- |
| Routes | ✅ Klaar | GF1 — 33 tests |
| Hostflow (Snel starten / instellen) | ✅ Klaar | GF2b |
| Joinflow + Naamgedrag | ✅ Klaar* | GF2a — *1 open vraag (bron naamsuggestie vóór join) zit in GF8 |
| QR- en deelgedrag | ✅ Klaar | GF6 |
| Randgeval 1 — host disconnect | ✅ Klaar | GF4 + GF5 |
| Randgeval 2 — speler reconnect | ✅ Klaar | reconnect-logica (GF4) + lokaal bewaren van het sessietoken (GF9) |
| Randgeval 3 — late join | ✅ Klaar | GF5 |
| Randgevallen 4, 5 — naam | ⚪ N.v.t. | bewust geen melding nodig, server lost dit stil op |
| Randgeval 6 — niemand antwoordt | ✅ Klaar | pauzemelding (GF5) + hostkeuze Doorgaan/Beëindigen via `host-controls-state` (GF10) |
| Randgeval 7 — te laat antwoord | ✅ Klaar | GF5 |
| Randgeval 8 — room vol | ✅ Klaar | GF5 |
| Randgeval 9 — ongeldige invite | ✅ Klaar | GF5 |
| Randgeval 10 — kick | ✅ Klaar | GF5 |
| Randgeval 11 — vrijwillig verlaten | ✅ Klaar | GF11 |
| Randgeval 12 — rematch | ✅ Klaar | GF3 |
| Randgeval 13 — TTL verlopen | ✅ Klaar | GF5, zelfde pad als randgeval 9 |
| Randgeval 14 — serverherstart | ✅ Klaar | via GF3 + GF4 |
| Spelscherm (wat een speler ziet) | 🟡 Deels | data aanwezig; UI-samenstelling bewust buiten dit plan |
| Hostbediening (pauze/volgende/vergrendel/kick/beëindig/rematch) | ✅ Klaar | GF10 |
| `session-store` | ✅ Klaar | GF9 |
| Teams | ⏸️ On hold | GF7 geschreven, **niet uitvoeren** vóór GF8 is beantwoord — zie `prompts/REVIEW-GF7-GF8.md` |
| Spectatorroute | 🟡 Deels | reducers herbruikbaar (GF7 §Deel 2), maar auth/subscription/veilige projectie ontbreken — nu ook via GF8 |
| Groepsvlag/badge | ⚪ Bewust buiten scope | PRODUCT.md: expliciete latere uitbreiding |
| Interfacevoorstel naar PROTOCOL.md | ✅ Klaar, wacht op antwoord | GF8 uitgevoerd → [`protocol-interface-proposal.md`](protocol-interface-proposal.md), 10 secties, geen enkele vraag zelf beantwoord |

## Openstaande actiepunten

- [x] GF9 `session-store` bouwen — 10/10 tests groen, geverifieerd.
- [x] GF10 `host-controls-state` bouwen — 18/18 tests groen, geverifieerd.
- [x] GF11 `leave-state` bouwen — 16/16 tests groen, geverifieerd.
- [x] GF8 bijstellen per `prompts/REVIEW-GF7-GF8.md` (joinvolgorde-hoofdvraag,
      team-identifier, serverbevestiging/idempotentie, spectator-auth, gesplitste
      snapshot-/`game:paused`-vraag, GF7-onafhankelijkheid).
- [x] GF8 uitvoeren — `docs/game-flow-plan/protocol-interface-proposal.md` staat er,
      alle 10 secties, vraag 1 (joinvolgorde) vóór vraag 2/3, niets zelf beantwoord.
- [ ] Antwoorden van de PROTOCOL.md-/DATA-MODEL.md-eigenaar afwachten.
- [ ] GF7 herschrijven op basis van die antwoorden (inclusief robuustheidstests voor
      ongeldige invoer, die de eerste versie miste), dan pas uitvoeren.

## Cijfers

- **GF0–GF6 + GF9–GF11:** gebouwd en geverifieerd, **217/217 tests groen** in
  `client/flow/` (10 modules).
- **GF7:** prompt geschreven, uitvoering bevroren tot GF8 beantwoord is.
- **GF8:** uitgevoerd — `protocol-interface-proposal.md` klaar voor de
  `PROTOCOL.md`-eigenaar, wacht nu op hun antwoord.
- De 3 nieuw gevonden gaten (session-store, hostbediening, verlaat-room) zijn
  inmiddels gedicht — alleen GF7 (teams/spectator) staat nog open, geblokkeerd op
  extern antwoord.
