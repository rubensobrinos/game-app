# Prompt — PR13: Contracttests bijwerken naar DECISIONS.md

**Herzien na menselijke review (2 aug 2026)** — zie "Verwerkte review-feedback"
onderaan. Dekking uitgebreid naar alle PR9-wijzigingen (niet alleen PR10-PR12), en
PR9 toegevoegd als expliciete afhankelijkheid.

Dekt fase **PR13** — nieuw, volgend op
[`docs/multiplayer/DECISIONS.md`](../../multiplayer/DECISIONS.md). **Afhankelijk
van PR9, PR10, PR11 en PR12** — PR9 wijzigt het fundamentele `PROTOCOL.md` dat deze
contracttests toetsen, dus is net zo goed een harde afhankelijkheid als de drie
codefases. Voer dit pas uit nadat alle vier bestaan; lees hun daadwerkelijke
exportnamen/vormen (kunnen afwijken van de aanname als de bouwer onderweg een net
iets andere keuze maakte).

## Brondocument

De bestaande contracttestsuite in `tests/contract/protocol/` (PR7):
`fake-transport.mjs`, `envelope-idempotency-scenario.mjs`, `rest-scenario.mjs`,
`event-and-snapshot-scenario.mjs`, `reconnect-scenario.mjs` — elk met een eigen
`.test.mjs`.

## Traceability — elke PR9-wijziging expliciet toegewezen

Niet elke wijziging hoeft een fake-transportscenario te worden. Wijs elk punt
hieronder expliciet toe aan één van drie categorieën, en rapporteer dat bij
oplevering:

| PR9-wijziging | Categorie | Toelichting |
| --- | --- | --- |
| Preview-endpoint (PR10) | Contracttest | nieuw REST-scenario, zie hieronder |
| Discriminated `question`-payloads, 5 spelvormen (PR11) | Contracttest | nieuw event-scenario, zie hieronder |
| `eligibleFromRound` in snapshot (PR11) | Contracttest | zie hieronder |
| `share:opened.method = code` (PR11) | Contracttest | zie hieronder |
| Lokale `/time`-foutcode (PR11) | Contracttest | update bestaand scenario |
| `verifyToken`/pepper-versionering (PR12) | Contracttest | nieuw scenario, zie hieronder |
| Volledige `pausedState` in snapshot | Contracttest | nieuw assert in het bestaande snapshot-scenario |
| Volledige `game:paused`-payload + `rendererVersion` per ronde | Contracttest | uitbreiding van het bestaande event-scenario |
| 4 pauzeredenen + onbekende-waarde-fallback | **Unit-test volstaat** — dit is een gesloten enum-check binnen één validator, geen end-to-end-scenario nodig | zie `PR11` sectie 1/`PR9`'s reason-enum |
| Leave trekt token niet in | **Uitsluitend service-integratietestbaar** — vereist een echte sessiestore/serverproces dat `POST /leave` daadwerkelijk afhandelt; deze contracttestsuite werkt tegen een fake transport zonder echte sessie-persistentie. Markeer als openstaande blocker, niet als "gedekt" | — |
| `session:revoked`-afbakening (alleen expliciete intrekking) | **Uitsluitend service-integratietestbaar** — zelfde reden als hierboven | — |
| TTL-verval → `GAME_NOT_FOUND` | **Uitsluitend service-integratietestbaar** — vereist een echte TTL-klok/Redis-expiry | — |
| Antwoordverdeling zonder ruwe antwoorden/correctheidslek | Contracttest | uitbreiding van het bestaande `round:ended`-scenario: assert dat de payload geen individuele antwoorden of een correctheidsveld per speler bevat |

De drie "uitsluitend service-integratietestbaar"-punten zijn **geen falen van
PR13** — ze zijn structureel niet bouwbaar tegen een fake transport zonder echte
sessieopslag. Rapporteer ze expliciet als openstaande blocker voor een latere,
échte integratietestfase (`DEPLOYMENT-AND-TESTING.md`), niet als stilzwijgend
overgeslagen.

## Uit te breiden scenario's

### 1. `rest-scenario.mjs` — preview-endpoint (PR10)
Scenario: geldige `inviteId`/`gameCode` (via de echte generator/validator, niet een
handgeschreven voorbeeld) → `{ suggestedName }`; syntactisch ongeldige locator →
`INVITE_INVALID`; geldige maar onbekende locator → `GAME_NOT_FOUND`. Assert dat de
succesrespons geen `sessionToken`/`playerId`/`hostgegevens`/`playerCount` bevat.

### 2. `event-and-snapshot-scenario.mjs` — discriminated question-payloads (PR11)
Voor elk van de 5 `gameType`-waarden: een scenario dat `round:started` met de
echte `question-selection.js`-vorm door `validateRoundStartedPayload` haalt, met
expliciete assertie dat `correctAnswer`/`resultDetails`/rauwe metriekwaarden er
niet in zitten. Voeg ook een scenario toe voor `snapshot-shape.mjs`'s uitgebreide
`self.eligibleFromRound` (inclusief de integer-≥1-eis) en het uitgebreide
`SAFE_ACTIVE_ROUND_KEYS` (met `rendererVersion`).

### 3. `event-and-snapshot-scenario.mjs` — volledige `pausedState`/`game:paused` (PR9)
Scenario: snapshot met `pausedState` in de volledige vorm; `game:paused`-event met
dezelfde volledige vorm; elk van de 4 toegestane `reason`-waarden geaccepteerd via
een unit-test in `PR11` (niet per se hier), plus één contract-scenario dat een
onbekende `reason`-waarde niet laat crashen (client-side fallback-verantwoordelijk-
heid, hier alleen vormcheck).

### 4. `event-and-snapshot-scenario.mjs` (of `rest-scenario.mjs`) — `method: 'code'` (PR11)
Scenario dat `share:opened` met `method: 'code'` accepteert.

### 5. `rest-scenario.mjs` — `/time`-foutafhandeling (PR11)
Update het bestaande `/time`-scenario naar de nieuwe lokale
`INVALID_SERVER_RESPONSE`-constante.

### 6. Nieuw scenario-bestand: `auth-session-scenario.mjs` (PR12)
Scenario: `generateSessionToken` → `hashToken` (met `pepperConfig`) →
`verifyToken` met de juiste token en `peppersByVersion`; plus een
pepper-rotatiescenario (oude versie nog verifieerbaar naast een nieuwe huidige
versie) en een onbekende-versie-scenario (`false`, geen throw).

### 7. `event-and-snapshot-scenario.mjs` — antwoordverdeling (PR9 punt 14)
Uitbreiding van het bestaande `round:ended`-scenario: assert dat de
verdelingsvelden geen individuele antwoorden of een per-speler-correctheidsveld
bevatten.

## Niet in scope

- Wijzigingen aan PR9/PR10/PR11/PR12's eigen modules — dit bestand voegt alleen
  tests toe die ze aanroepen.
- Team-/spectator-scenario's (**punt 8/9**).
- De drie service-integratietestbare punten hierboven (leave-token, session:
  revoked-afbakening, TTL-verval) — expliciet buiten bereik van een fake-
  transportsuite, gerapporteerd als blocker.

## Definition of done

- Alle 7 uitbreidingen hierboven zijn toegevoegd als `node:test`-cases.
- De traceability-tabel is compleet en gerapporteerd (categorie per PR9-punt).
- Volledige `tests/contract/protocol/*.test.mjs`-suite groen, samen met de
  volledige `server/protocol/*.test.mjs`-suite (regressiecheck, expliciete
  bestandsnamen).
- Kort verslag: totaal aantal testgevallen ná deze fase, en de expliciete lijst
  van echte resterende blockers (de drie service-integratiepunten), per
  [`PR-RESUME-AFTER-DECISIONS.md`](PR-RESUME-AFTER-DECISIONS.md) punt 6.

## Verwerkte review-feedback

- PR9 toegevoegd als formele afhankelijkheid, niet alleen PR10-PR12 —
  bevinding 11.
- Volledige traceability-tabel toegevoegd die elke PR9-wijziging toewijst aan
  contracttest/unit-test/service-integratie-only, in plaats van alleen de
  makkelijk testbare punten te dekken — bevinding 10.
