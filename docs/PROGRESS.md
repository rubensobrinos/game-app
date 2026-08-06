# Voortgang — alle planlijnen

**Snapshot:** 2026-08-02, ±13:15 (bijgewerkt na `docs/multiplayer/DECISIONS.md`).
Dit is een momentopname in een repo waar meerdere agents gelijktijdig live werken
(zie [`docs/STATUS-AUDIT-2026-08-02.md`](archief/STATUS-AUDIT-2026-08-02.md) voor de
narratieve doorlichting van ±12:00 die tot de besluitronde leidde). Prefixcodes
staan in [`docs/IMPLEMENTATION-INDEX.md`](archief/IMPLEMENTATION-INDEX.md).

Legenda: ✅ klaar en getest — 🟡 deels/in uitvoering — 📝 spec klaar, nog niet
gebouwd — ⬜ nog niet gestart — 🔒 bevestigd uitgesteld (productbesluit, geen
openstaande vraag meer) — ⏸️ geblokkeerd (mens/cross-agent nodig).

## De besluitronde (2026-08-02)

De producteigenaar heeft 35 bindende besluiten vastgelegd in
[`docs/multiplayer/DECISIONS.md`](multiplayer/DECISIONS.md), inclusief een
`deps`-akkoord (Fastify/Socket.IO/Redis/pg, `376bd4e`) en een uitvoeringsakkoord
voor test-/deploymentwerk. Kern voor de scope: Groepsbattle-preset, mixed games,
teams en spectators worden **nu niet gebouwd**; voor Golf 2 is geen nieuw besluit
genomen; de quick-start-kernflow blijft bestaan met een nieuw `flags_mc`-only
default. Elk plan heeft een eigen `*-RESUME-AFTER-DECISIONS.md`-prompt gekregen
en uitgevoerd of in uitvoering.

Twee nieuwe domeinen zijn opgestart om audit-bevindingen §2.4 en §2.6 te dichten:
**content-plan** (`CT`, gedeelde contentmodule `shared/content/`, launch-kritiek
en tot nu toe zonder eigenaar) en **spec-redactie** (`SR`, brengt `PRODUCT.md`,
`GAME-FLOW.md`, `GAME-RULES.md`, `DATA-MODEL.md` in lijn met `DECISIONS.md`).
Daarnaast is er nu een **integration-plan** (`INT-A`/`INT-B`) dat de losse
modules daadwerkelijk componeert — de "ontbrekende integrator" uit audit §2.7 —
met eigen `HANDOFF`-documenten die concrete vragen stellen aan DM/AR (zie
`docs/integration-plan/HANDOFF.md` en `HANDOFF-INTB.md`).

## Per plan

| Plan | Prefix | Fases klaar | Tests groen | Belangrijkste open punt | Commit-status |
| --- | --- | --- | --- | --- | --- |
| [PRODUCT.md](multiplayer/PRODUCT.md) | PD | PD0,1,4,5,6 ✅ · PD2 🔒 (versmald, uitgesteld) · PD3 🔒 | 35/35 | Geen — PD3/Groepsbattle zijn bevestigd uitgestelde scope (DECISIONS.md #31, #34), geen openstaande vraag meer | ✅ volledig |
| [GAME-FLOW.md](multiplayer/GAME-FLOW.md) | GF | GF0–GF6, GF9–GF11 ✅ · GF7 ⏸️ | 217/217 | GF8: interfacevoorstel naar PROTOCOL.md, deels ingehaald door DECISIONS.md | ✅ volledig |
| [GAME-RULES.md](multiplayer/GAME-RULES.md) | GR | GR0–GR5, GR8 ✅ | 157/157 | Vraagselectie (GR4) draait nog tegen placeholder-content — wacht op CT1 | ✅ volledig |
| [ARCHITECTURE.md](multiplayer/ARCHITECTURE.md) | AR | AR0–AR4 ✅ · AR5/6 🟡 in uitvoering | 467/467 | Server-skeleton wordt nu gebouwd (`deps`-akkoord binnen); INTB-2 vraagt een atomaire code-claim-methode | 🟡 grotendeels (nieuwste AR5/6-stukken nog niet door mij geverifieerd) |
| [PROTOCOL.md](multiplayer/PROTOCOL.md) | PR | PR0–PR8b ✅ | 464/464 (426+38) | PR8b (token generatie/hashing) is nu gebouwd — spec-redactie moet PROTOCOL.md nog met DECISIONS.md in lijn brengen | ✅ volledig |
| [DATA-MODEL.md](multiplayer/DATA-MODEL.md) | DM | DM0–DM9 ✅ | 456/456 | INTB-1/INTB-3: repository-poort mist `roomId` op 3 methoden, scoreboard-fake keyt inconsistent — keuze bij DM-agent | ✅ volledig |
| [DEPLOYMENT-AND-TESTING.md](multiplayer/DEPLOYMENT-AND-TESTING.md) | DT | DT0–DT2, DT3a ✅ · DT3b–DT6 🟡 (DT-R-prompts geschreven na uitvoeringsakkoord) | 7/7 (fixtures; integratie/E2E/load wacht op server) | CI nog steeds kapot; DT7 heeft 3 opties, nu ingehaald door het bredere `deps`-akkoord | ✅ volledig |
| [content-plan](archief/plandocumentatie/content-plan/) | CT | ⬜ CT1 geschreven, niet gebouwd | — | Launch-kritiek: GR4 en de servercomposition hebben dit nodig | ✅ (prompt) |
| [spec-redactie](archief/plandocumentatie/spec-redactie/) | SR | ⬜ SR1 geschreven, niet gebouwd | — | Moet PRODUCT.md/GAME-FLOW.md/GAME-RULES.md/DATA-MODEL.md bijwerken (mix→single, 4-vs-5-preset, …) | ✅ (prompt) |
| [integration-plan](integration-plan/) | INT-A/B | 🟡 actief, walking skeleton + repository-conformance in uitvoering | — (buiten deze telling) | INTB-1/2/3: drie open vragen aan DM/AR over repository-poort en atomaire code-claim | 🟡 actief zelf-committend, deels nog niet gecommit |

**Repo-breed: 1.803/1.803 tests groen** op het moment van dit overzicht
(`node --test 'server/**/*.test.*' 'client/**/*.test.*' 'shared/**/*.test.*'
'tests/**/*.test.*'`) — 1.151 in de audit van ±12:00, 1.508 een uur later, 1.803 nu.

## Buiten de plannen — nog niet gecommit

- **`package.json`** — bestaat, geen `dependencies`-veld (die komen via de losse
  `deps`-commit `376bd4e`), `deps`-categorie volgens `CLAUDE.md`. Nog ongecommit.
- **Nieuwe infrastructuur** — `docker-compose.yml`, `caddy/`, `nginx/`,
  `migrations/`, `server/Dockerfile`, `server/index.mjs`, `.env.example`. Wordt nu
  actief door integration-plan gebouwd; bewust niet door mij aangeraakt.
- **`.devkit.yaml`/`AGENTS.md`/`CLAUDE.md`** — inhoudelijk legitiem, mijn
  commitpoging werd door de auto-mode classifier geblokkeerd (devkit-governed).

## Wat er in deze ronde is gebeurd

Na de besluitronde is `docs/product-plan/prompts/PD-RESUME-AFTER-DECISIONS.md`
uitgevoerd: geen nieuwe PD-code (PD3 blijft expliciet dicht, DECISIONS.md #34),
scope-guards gecontroleerd op ongewenste "huidig vereist"-claims (geen gevonden),
`PD-PROGRESS.md`/`README.md` herkaderd van "wacht op mens" naar "bevestigd
uitgesteld". Daarna is een nieuwe ronde ongecommit werk gegroepeerd gecommit:
game-rules GR4/GR5/GR8 (94→157 tests), de DECISIONS.md-aanvulling (#30 bevestigd,
#35 toegevoegd) met doorwerking in AR/DM-RESUME-prompts, en de twee nieuwe
content-plan/spec-redactie-prompts. `docs/integration-plan/` is bewust met rust
gelaten — die agent staat middenin het zelf committen van eigen werk (bestanden
al gestaged in de git-index vóórdat ik keek).
