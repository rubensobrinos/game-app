# INT-A — voortgang van de keten

Bijgewerkt: 2 augustus 2026. Rol: integrator vóór de repository-poort
(compositie, transport, keten-tests). Alles áchter de poort — Redis-adapter,
Postgres-analytics, verpakking — is INT-B.

**Een pijl is pas ✅ als er een echte test overheen loopt.** Niet als de modules
bestaan, niet als het "zou moeten werken".

Legenda: ✅ groen en getest — 🟡 deels — 🔵 in aanbouw — ⛔ geblokkeerd —
⏸️ later.

## De tien ketenpijlen

| # | Pijl | Status | Bewijs / blokkade |
| --- | --- | --- | --- |
| 1 | room aanmaken | 🔵 | matrixrij 1, 2 |
| 2 | join | 🔵 | matrixrij 3, 4 |
| 3 | preview / naamsuggestie | 🔵 | besluit 7 (pre-join-preview), matrixrij 5 |
| 4 | sessie + socket | ⏸️ | echt transport is stap 2; stap 1 gebruikt directe aanroepen |
| 5 | ronde | 🔵 | matrixrij 7 |
| 6 | vraagselectie | ⛔ | wacht op `shared/content/` (CT1) — zie onder |
| 7 | antwoord | 🔵 | matrixrij 12 (idempotentie) |
| 8 | scoring | 🔵 | `server/rules/scoring.js` + `standings.js` |
| 9 | scoreboard | 🔵 | `getScoreboardTop` uit de poort |
| 10 | rematch | 🟡 | matrixrij 7; ordening beperkt door HANDOFF INT-2 |

## De veertien DT3b-matrixrijen

Bron: `docs/deployment-and-testing-plan/integration-matrix.md`. Een rij is
geactiveerd zodra de keten-test hem daadwerkelijk afdekt.

| Rij | Onderwerp | Status |
| --- | --- | --- |
| 1 | room aanmaken, `hostParticipates: false` | 🔵 |
| 2 | room aanmaken, `hostParticipates: true` | 🔵 |
| 3 | join via `inviteId` | 🔵 |
| 4 | join via code, foutcode bij onbekende code | 🔵 |
| 5 | eigen naam vs. gegenereerde naam | 🔵 |
| 6 | iedere deelnemer kan de invite opnieuw tonen | 🔵 |
| 7 | volledige matchcyclus incl. rematch | 🔵 |
| 8 | room vergrendelen/ontgrendelen | 🔵 |
| 9 | late join | 🔵 |
| 10 | kick + sessierevocatie | 🔵 |
| 11 | twee rooms lekken geen state | 🔵 |
| 12 | idempotente `actionId` | 🔵 |
| 13 | `round:progress` throttling | ⏸️ stap 2 (heeft echt transport nodig) |
| 14 | snapshot bevat nooit `correctAnswer` | 🔵 |

## Stappen

| Stap | Inhoud | Status |
| --- | --- | --- |
| 1 | walking skeleton: in-process compositie, in-memory fake, keten-test | 🔵 in aanbouw |
| 2 | echt transport: Fastify + Socket.IO, `server/index.mjs` als entrypoint | ⏸️ |
| 3 | echte adapters — **INT-B** | ⏸️ |
| 4 | verpakking — **INT-B** | ⏸️ |

## Vastgestelde feiten

- **ESM→CJS interop werkt zonder shim.** Alle modules die de compositie nodig
  heeft (`state-machine`, `room-codes`, `snapshot-precedence`, `scoring`,
  `repository`, `in-memory-store`) leveren volledige named imports aan een
  `.mjs`-module. Vooraf geprobeerd, niet aangenomen. Besluit 28 kan dus zonder
  omweg worden gevolgd.
- **`createInMemoryStore()`** implementeert alle achttien poortmethoden, inclusief
  `setRoomAndMatchPhaseAtomically` (besluit 30) en
  `saveAcceptedAnswerAtomically` (besluit 23).
- **Elk documenttype heeft een shape-assertion** in `server/data/types/`. De
  compositie bouwt documenten, die assertions toetsen ze. Dat is het
  verificatiemiddel, geen eigen validatie.

## Openstaand

- **HANDOFF INT-1** (DM + AR): de poort mist een atomaire claim voor de
  join-code. Stap 1 kan door met de fake; de claim staat achter één functie zodat
  de latere wijziging één plek raakt.
- **HANDOFF INT-2** (PR): `Match.sequence` ontbreekt in het snapshot-`room`-
  object, waardoor rematch-ordening niet sluitend is.
- **Pijl 6 — vraagselectie** wacht op het contract van `shared/content/` (CT1).
  Tot dat er is: een minimale stub-pool achter exact het met CT afgesproken
  interface, gemarkeerd `// TIJDELIJK tot CT1`, zodat de swap één import is. Het
  interface wordt met CT afgestemd, niet zelf verzonnen.
