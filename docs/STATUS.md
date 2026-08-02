# STATUS — de actuele waarheid

**Eigenaar:** regie (Claude). **Bijgewerkt bij elk meetmoment; historie hoort
in git, niet hier.** Bij twijfel wint dit bestand van elk PROGRESS-bestand.

_Laatst geverifieerd: 2 aug 2026 ± 21:30 · commit `bb07aa9` + werkboom_

## Runtimeketen (wat draait er echt)

| Laag | Stand |
| --- | --- |
| play.aseso.nl | ✅ live (singleplayer, Play Aseso-branding, merkspellen-flag, deelknop) |
| Game-server | ✅ echt entrypoint (Fastify + REST + Socket.IO), **store: in-memory** — Redis-wiring = INT-A stap 3 |
| Redis-adapter | ✅ 22/23 methoden, mutatie- en AOF-bewezen — nog niet de runtime-store |
| Multiplayer-frontend | 🟡 schermen + huisstijl klaar; **draait nog op mock-transport** (swap op regie-sein) |
| Routering één-domein + /samen + Samen spelen-kaart | 🟡 klaar, wacht op livegang-sein |

## Actuele testuitslag

`npm test`: **2433 tests · 2426 groen · 7 rood** — alle 7 = bekende
DM19-conformance-flip + obsolete lobby-gap-test (eigenaren: INT-B / INT-A).

## Open launchblockers (volgorde = prioriteit)

1. `snapshot-precedence` semantisch naar `matchSequence`-eerst — INT-A
2. DM19 repo-breed: conformance-flip + Lua-check `expectedPhase`/`pausedState` — INT-B (+ INT-A compositie-rest)
3. INT-17-assertie omdraaien (PR-fix `bb07aa9` is geland) — INT-A
4. Store-factory: `REDIS_URL` ⇒ Redis-adapter, anders in-memory — INT-A + INT-B
5. Frontend-swap mock → echte `transport.mjs` (één import) — UI, ná regie-tegencontrole
6. Browsertab-match als bewijs (regie speelt zelf) → daarna livegang-sein

## Wachtend op producteigenaar

_Niets._ Alle besluiten (#1–#38) zijn genomen.

## Rustende domeinen

GR · PD · PR (slotlichting door regie afgerond, `bb07aa9`) · DM — heropstart
begint bij het eigen PROGRESS-bestand.
