# Voortgang — GAME-RULES.md realisatie

Dekking van [`docs/multiplayer/GAME-RULES.md`](../multiplayer/GAME-RULES.md),
per sectie uit dát document — niet per GR-fase. Zie
[`README.md`](README.md) voor de fasering/uitvoeringsvolgorde zelf en
[`HANDOFF.md`](HANDOFF.md) voor de punten die buiten deze scope vallen.

Legenda: ✅ klaar en geverifieerd — 📝 spec klaar, nog niet gebouwd —
⬜ nog niet gestart — **n.v.t./buiten scope** met reden uit het brondocument
zelf.

| GAME-RULES.md sectie | GR-fase | Status | Toelichting |
| --- | --- | --- | --- |
| Rondestructuur (fasetijden, auto-/host-tempo) | — | **n.v.t. voor GR** | Puur configwaarden + faseovergangen — dat is de state machine (`ARCHITECTURE.md`, `server/architecture/`), geen apart GR-module nodig |
| Puntentelling → Individueel (formule, deadline-grace) | GR1 | ✅ Klaar | `scoring.js`, 32/32 tests, zelf geverifieerd |
| Puntentelling → Gelijke eindscore (tiebreak) | GR2 | ✅ Klaar | `standings.js`, 23/23 tests, competitierangschikking bevestigd |
| Vraagselectie | GR4 | ✅ Klaar | `question-selection.js`, 26/26 tests, zelf geverifieerd na twee mislukte agentpogingen (output-tokenlimiet) |
| Spelvormen 1–5 (Golf 1) — antwoord *valideren* | GR3 | ✅ Klaar | `validators.js`, 39/39 tests. `correctAnswer`-vorm bevestigd — zie `HANDOFF.md` §1, inmiddels ook door `docs/data-model-plan/HANDOFF.md` §1 en de producteigenaar (`docs/multiplayer/DECISIONS.md` #15) |
| Spelvormen 1–5 (Golf 1) — vraag *selecteren/genereren* | GR4 | ✅ Klaar | Zelfde fase als Vraagselectie hierboven |
| Spelvormen 6–7 (Golf 2, incl. logo's) | — | **Buiten scope** | Golf 2 / feature-flagged, expliciet niet nu |
| Late join | GR5 | ✅ Klaar | `eligibility.js`, 25/25 tests |
| Speler verlaat of disconnect | GR5 | ✅ Klaar | Zelfde fase als Late join |
| Antwoordverdeling per ronde | GR8 | ✅ Klaar | `answer-distribution.js`, 12/12 tests, uit `DECISIONS.md` #14 |
| Teams — fase 1.5 | GR6 | ⏭️ Uit huidige scope | Producteigenaar bevestigde: nu geen teams bouwen |
| Verdiepende content (vlagverhaal) | — | **Buiten scope** | Doc zelf: "verandert geen punten" — geen serverregel om te bouwen |
| Reactiezinnen en streaks | — | **Buiten scope** | Doc zelf: client-side, "geen invloed op de server-score" |
| Groepsvlag of badge | — | **Buiten scope** | Doc zelf: "buiten de spelregels van de MVP" |

## Samengevat

**6 van de 6 nog-te-bouwen GR-fases af en geverifieerd (GR1–GR5, GR8).** GR6 is
uit scope (bevestigd door producteigenaar), GR7 is ingehaald door
`HANDOFF.md`/`DECISIONS.md`. Drie secties uit `GAME-RULES.md` vereisen sowieso
geen GR-module. `server/rules/` staat op **157/157 tests groen**
(`node --test 'server/rules/**/*.test.js'`), geen dependencies.

Openstaand buiten deze scope: het "gedeelde contentmodule"-werk
(`shared/content/`, `HANDOFF.md` §3) en de seed-deterministische
Echt-of-Nep-renderer — beide bij een andere/geen eigenaar, niet blokkerend
voor wat hier is gebouwd.

*Laatst bijgewerkt: 2026-08-02, GR5 en GR8 geïmplementeerd en geverifieerd.*
