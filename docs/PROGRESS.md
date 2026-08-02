# Voortgang — alle zeven planlijnen

**Snapshot:** 2026-08-02, ±12:25. Dit is een momentopname in een repo waar meerdere
agents gelijktijdig live werken (zie
[`docs/STATUS-AUDIT-2026-08-02.md`](STATUS-AUDIT-2026-08-02.md) voor de volledige,
narratieve doorlichting — dit bestand is het compacte, per-plan overzicht ernaast).
Prefixcodes per plan staan in
[`docs/IMPLEMENTATION-INDEX.md`](IMPLEMENTATION-INDEX.md).

Legenda: ✅ klaar en getest — 🟡 deels/in uitvoering — 📝 spec klaar, nog niet
gebouwd — ⬜ nog niet gestart — ⏸️ geblokkeerd (mens/cross-agent nodig).

## Per plan

| Plan | Prefix | Fases klaar | Tests groen | Belangrijkste open punt | Commit-status |
| --- | --- | --- | --- | --- | --- |
| [PRODUCT.md](multiplayer/PRODUCT.md) | PD | PD0,PD1,PD4,PD5,PD6 ✅ · PD2 🟡 (versmald) · PD3 ⏸️ | 35/35 | PD3 wacht op cross-agent-afstemming Golf-2-ID's/`golf2Enabled` | ✅ volledig |
| [GAME-FLOW.md](multiplayer/GAME-FLOW.md) | GF | GF0–GF6, GF9–GF11 ✅ · GF7 ⏸️ (wacht op GF8) | 217/217 | GF8: interfacevoorstel naar PROTOCOL.md wacht op menselijke antwoorden (7 vragen) | ✅ volledig |
| [GAME-RULES.md](multiplayer/GAME-RULES.md) | GR | GR0–GR3 ✅ · GR4 📝 | 94/94 | GR4 (vraagselectie) heeft nog geen gedeelde contentmodule om tegen te draaien | ✅ volledig |
| [ARCHITECTURE.md](multiplayer/ARCHITECTURE.md) | AR | AR0–AR4 ✅ · AR5/AR6 ⏸️ | 426/426 | AR5 (server-skeleton) wacht op `deps`-akkoord (Fastify/Socket.IO) | ✅ volledig |
| [PROTOCOL.md](multiplayer/PROTOCOL.md) | PR | PR0–PR8a ✅ · PR8b ⏸️ | 455/455 (417+38) | PR8b (definitieve auth/token) is ADR-plichtig, wacht op mens | ✅ volledig |
| [DATA-MODEL.md](multiplayer/DATA-MODEL.md) | DM | DM0–DM1 ✅ · DM2–DM9 📝, uitvoering **live gestart tijdens dit overzicht** | 66/66 gecommit (meer lokaal aanwezig, nog niet geverifieerd) | Snelst bewegende plan op dit moment — DM2a/DM4/DM5-code verscheen terwijl dit bestand werd geschreven | 🟡 deels (alleen DM0/DM1 + READMEfix) |
| [DEPLOYMENT-AND-TESTING.md](multiplayer/DEPLOYMENT-AND-TESTING.md) | DT | DT0–DT2, DT3a ✅ · DT3b/DT4a/DT5/DT6 ⏸️ | 7/7 (fixtures; overige lagen nog leeg) | CI is kapot (`ci.yml` gebruikt `npm ci`/`jest`, geen `package.json`/Jest in repo) — DT7 heeft 3 opties klaarliggen, wacht op mens | ✅ volledig (al eerder door DT-agent zelf) |

**Repo-breed:** 1.508/1.508 tests groen op het moment van dit overzicht
(`node --test 'server/**/*.test.*' 'client/**/*.test.*' 'shared/**/*.test.*'
'tests/**/*.test.*'`), oplopend — dit getal was 1.151 in de audit van een uur
eerder en groeide tijdens het schrijven van dit bestand nog van 1.477 naar 1.508.

## Buiten de zeven plannen — nog niet gecommit, bewust niet door mij aangeraakt

- **`package.json`** — bestaat inmiddels (geen `dependencies`, wel `scripts.test`/
  `scripts.start`), maar is een `deps`-categorie-beslissing volgens `CLAUDE.md`.
  Kortstondig stond er `"type": "module"` in, wat alle CommonJS-modules
  (`server/rules`, `server/data`, `server/architecture`) liet crashen — dat veld is
  door een andere agent alweer verwijderd, alles is weer groen. Blijft ongecommit
  tot jij akkoord geeft.
- **Nieuwe infrastructuur** — `docker-compose.yml`, `caddy/`, `nginx/`,
  `compose.tunnel.override.yml`, `migrations/`, `server/Dockerfile`,
  `server/index.mjs`, gewijzigde `.env.example`. Dit lijkt de "ontbrekende
  integrator-rol" uit de audit (§2.7) die nu wordt opgepakt — verschenen ruim ná de
  start van deze opdracht, nog volop in ontwikkeling. Ik heb dit niet geverifieerd
  en niet gecommit; dat is een nieuw stuk werk, geen onderdeel van "de zeven
  plannen groeperen en committen".
- **`.devkit.yaml`/`AGENTS.md`/`CLAUDE.md`** (autonomy-limiet 5→15 bestanden,
  400→5.000 regels) — inhoudelijk al eerder geverifieerd als legitiem, maar mijn
  commitpoging werd geblokkeerd door de auto-mode classifier (devkit-governed,
  hash-gepinde bestanden). Wacht op jou, mogelijk via de `devkit`-CLI.
- **`docs/STATUS-AUDIT-2026-08-02.md`**, **`docs/IMPLEMENTATION-INDEX.md`**, dit
  bestand zelf — nog ongecommit, geen van drie is "van" één specifiek plan.

## Wat er in deze ronde is gebeurd

Vijf verificatie-/documentatie-agents (architecture, protocol, data-model,
game-rules, deployment-and-testing) hebben elk hun eigen plan gecontroleerd: tests
zelf gedraaid, een `README.md` toegevoegd aan hun codemap waar die ontbrak
(`server/architecture/`, `server/rules/`, `server/data/` — `server/protocol/` en
`client/flow/` en `shared/product/` hadden er al een), en hun voortgangsbestand
bijgewerkt naar de werkelijke stand. Ik heb hun bevindingen zelf geverifieerd
(tests opnieuw gedraaid, bestanden gelezen) voordat ik iets committede, en heb
daarna alles gegroepeerd per plan gecommit — game-rules, architecture en protocol
in deze sessie; game-flow, deployment-and-testing en het grootste deel van
product-plan stonden al (deels via mij, deels via andere agents) gecommit.

Twee concrete audit-bevindingen zijn tijdens deze ronde bevestigd als **al
opgelost**: de twee rode `room-codes`-tests (architecture) waren al gefixt
(testinvoer aangepast aan het eigen 96-bits-contract van de module, niet
andersom), en de GR3/`correctAnswer`-blokkade (game-rules) is opgelost doordat
`docs/data-model-plan/HANDOFF.md` de gevraagde vorm inmiddels bevestigt.
