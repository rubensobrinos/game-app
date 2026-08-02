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
| 1 | room aanmaken | ✅ | `createRoom`, matrixrij 1 en 2 |
| 2 | join | ✅ | `joinRoom` via code én inviteId, matrixrij 3 en 4 |
| 3 | preview / naamsuggestie | ✅ | `previewInvite`, besluit 7; drie tests bewijzen dat er niets wordt weggeschreven |
| 4 | sessie + socket | 🟡 | sessies werken; sockets zijn stap 2. **Geblokkeerd door HANDOFF INT-3** |
| 5 | ronde | ✅ | `startRound`/`endRound`, matrixrij 7 |
| 6 | vraagselectie | 🟡 | draait op de tijdelijke stub achter het CT-contract; wacht op CT1 |
| 7 | antwoord | ✅ | `submitAnswer`, matrixrij 12 — **alleen sequentieel bewezen, zie INT-22** |
| 8 | scoring | ✅ | via `server/rules/scoring.js`, incl. grace uit besluit 13 |
| 9 | scoreboard | ✅ | `getScoreboard` via `getScoreboardTop`; tiebreak via `standings.js` |
| 10 | rematch | ✅ | matrixrij 7; ordening nog beperkt door INT-2 |

## De veertien DT3b-matrixrijen

| Rij | Onderwerp | Status |
| --- | --- | --- |
| 1 | room aanmaken, `hostParticipates: false` | ✅ |
| 2 | room aanmaken, `hostParticipates: true` | ✅ |
| 3 | join via `inviteId` | ✅ |
| 4 | join via code, foutcode bij onbekende code | ✅ |
| 5 | eigen naam vs. gegenereerde naam | ✅ |
| 6 | iedere deelnemer kan de invite opnieuw tonen | ✅ |
| 7 | volledige matchcyclus incl. rematch | ✅ |
| 8 | room vergrendelen/ontgrendelen | ✅ |
| 9 | late join | ✅ |
| 10 | kick + sessierevocatie | ✅ |
| 11 | twee rooms lekken geen state | ✅ |
| 12 | idempotente `actionId` | 🟡 sequentieel bewezen, niet onder gelijktijdigheid (INT-22) |
| 13 | `round:progress` throttling | ⏸️ stap 2, heeft echt transport nodig |
| 14 | snapshot bevat nooit `correctAnswer` | ✅ recursief gecontroleerd, drie sessies |

## Stappen

| Stap | Inhoud | Status |
| --- | --- | --- |
| 1 | walking skeleton: in-process compositie, in-memory fake | ✅ **af**, op de keten-test na |
| 1b | keten-test `tests/integration/full-match.test.mjs` | 🔵 volgende |
| 2 | echt transport: Fastify + Socket.IO | ⛔ geblokkeerd door INT-3 |
| 3 | echte adapters — **INT-B** | ⏸️ |
| 4 | verpakking — **INT-B** | ⏸️ |

## Cijfers

- **80/80** compositietests, **2096/2096** repobreed.
- Vijf matrixrij-tests onder `tests/integration/` draaien groen tegen deze laag.
- Twaalf van de veertien matrixrijen zijn geactiveerd.

## Vastgestelde feiten

- **ESM→CJS interop werkt zonder shim.** Vooraf geverifieerd voor alle zes de
  modules die de compositie nodig heeft.
- **Faselegaliteit staat op één plek.** De compositie delegeert volledig aan
  `transition()`; er is geen tweede fasetabel.
- **`Match.phase` is autoritair** (besluit 30); `Room.phase` volgt als projectie
  in dezelfde atomaire operatie. De compositie schrijft nergens een losse fase.

## Openstaand — zie [`HANDOFF.md`](HANDOFF.md)

| # | Voor | Waarom het hier telt |
| --- | --- | --- |
| INT-1 | DM + AR | ✅ **opgelost** — atomaire claim geleverd, compositie gemigreerd |
| INT-6 | DM | ✅ **opgelost** — poort neemt nu de hash, niet de invite |
| INT-3 | DM | **Blokkeert stap 2.** Geen token→sessie-lookup, terwijl een request alleen een bearer token draagt |
| INT-22 | DM + INT-B | `saveAcceptedAnswerAtomically` is onvoorwaardelijk; idempotentie zit nu vóór de write, dus rij 12 geldt niet onder gelijktijdigheid |
| INT-10 | GR | ✅ **opgelost** — deadlock weg; consequentie voor `scoreboardFrequency` genoteerd |
| INT-11 | PR | `preset`-waarde loopt drie kanten op; voorstel `'quick_start'` |
| INT-2 | PR | `Match.sequence` ontbreekt in het snapshot-object |
| INT-4 | CT | Contentcontract mist `validOptionIds`/`resultDetails` |
| INT-5 | GR | `correctAnswer` afleidbaar uit de publieke payload van `flags_mc` |

Daarnaast een reeks kleinere items uit de matchcyclus-bouw: geen
`listAnswersForRound` (N+1 tegen Redis), `getScoreboardTop` mist spelers die
nooit antwoordden, `Player` heeft geen `disconnectedSinceMs`, `Match` kent geen
`gameType`, en de lobby-snapshot eist een `matchId` die vóór de eerste match niet
bestaat. Alle vastgelegd in `HANDOFF.md`.
