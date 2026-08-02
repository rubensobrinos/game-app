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
| Vraagselectie | GR4 | 📝 Spec klaar, klaar om uit te voeren | Blockers verwerkt; mixgames geschrapt (één `gameType` per match, voor nu) |
| Spelvormen 1–5 (Golf 1) — antwoord *valideren* | GR3 | ✅ Klaar | `validators.js`, 39/39 tests. `correctAnswer`-vorm niet langer geblokkeerd: `docs/data-model-plan/HANDOFF.md` §1 bevestigt de voorgestelde tabel (`{ optionId }` / `{ choice }` / `{ side }` / `{ cardIndex }`) als vastgesteld, geen aanname meer. Blokkadetekst in dit bestand was verouderd t.o.v. `HANDOFF.md`/`prompts/README.md`, hier gecorrigeerd op 2026-08-02; die twee bestanden noemen de oude "geblokkeerd, bewust"-formulering nog en zijn niet door deze wijziging bijgewerkt |
| Spelvormen 1–5 (Golf 1) — vraag *selecteren/genereren* | GR4 | 📝 Spec klaar, klaar om uit te voeren | Zelfde fase als Vraagselectie hierboven |
| Spelvormen 6–7 (Golf 2, incl. logo's) | — | **Buiten scope** | Golf 2 / feature-flagged, expliciet niet nu |
| Late join | GR5 | ⬜ Nog niet gestart | |
| Speler verlaat of disconnect | GR5 | ⬜ Nog niet gestart | Zelfde fase als Late join |
| Teams — fase 1.5 | GR6 | ⬜ Nog niet gestart | Bewust laag geprioriteerd, `PRODUCT.md` merkt teams al als latere uitbreiding aan |
| Verdiepende content (vlagverhaal) | — | **Buiten scope** | Doc zelf: "verandert geen punten" — geen serverregel om te bouwen |
| Reactiezinnen en streaks | — | **Buiten scope** | Doc zelf: client-side, "geen invloed op de server-score" |
| Groepsvlag of badge | — | **Buiten scope** | Doc zelf: "buiten de spelregels van de MVP" |

## Samengevat

3 van de 8 relevante GR-fases af en geverifieerd (GR1–GR3), 1 spec-klaar-maar-
ongebouwd (GR4 — beide blockers opgelost, mixgames voor nu geschrapt op
instructie), 2 nog te starten (GR5, GR6), plus GR7 (interfacevoorstel richting
PROTOCOL/DATA-MODEL — grotendeels al ingehaald door `HANDOFF.md`). Drie
secties uit `GAME-RULES.md` vereisen sowieso geen GR-module — dat volgt
letterlijk uit het document zelf, niet uit tijdgebrek.

*Laatst bijgewerkt: 2026-08-02, correctie van de verouderde GR3-blokkadetekst
(zie regel hierboven) n.a.v. `docs/data-model-plan/HANDOFF.md` §1; geen
fase-inhoud gewijzigd. Vorige update: na GR4-herziening (review +
mixgames-vereenvoudiging). Bijwerken bij elke faseovergang, niet achteraf in
bulk.*
