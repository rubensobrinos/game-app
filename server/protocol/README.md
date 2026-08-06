# server/protocol/

Deze map realiseert [`docs/multiplayer/PROTOCOL.md`](../../docs/multiplayer/PROTOCOL.md)
volgens het uitvoeringsplan in
[`docs/protocol-plan/README.md`](../../docs/protocol-plan/README.md).

## Locatie

Deze map staat waar hij staat. De eerdere kanttekening dat hij "kan verschuiven
zodra het serverskeleton landt" is ingetrokken (6 aug 2026): dat skeleton draait
allang, en geen van deze mappen is verhuisd. De indeling is daarmee stilzwijgend
definitief geworden — nu ook hardop.


## Moduleformaat

- Platte JavaScript, native ES modules via de `.mjs`-extensie.
- Typering via JSDoc, geen TypeScript.
- Testrunner: Node's ingebouwde `node --test`, altijd tegen een expliciet
  bestand, bijv. `node --test server/protocol/envelope.test.mjs` — nooit tegen
  een directorypad.
- Geen `package.json`, geen enkele nieuwe dependency.

## Modules (bestanden in deze map)

Conceptuele modulegroepen staan in de modulestabel van
[`docs/protocol-plan/README.md`](../../docs/protocol-plan/README.md); onderstaande
tabel koppelt die groepen aan de daadwerkelijke bestanden in deze map (bijgewerkt
2026-08-02, ná PR0–PR7).

| Modulegroep | Bestand(en) | Fase | Rol |
| --- | --- | --- | --- |
| `envelope` | `envelope.mjs`, `idempotency.mjs` | PR1 | envelope parsen/bouwen, ack-vorm, `actionId`-idempotentie |
| `error-codes` | `error-codes.mjs`, `error-payload.mjs` | PR2 | foutcode-enum (23 codes) + error-payloadbouw |
| `auth-shape` | `auth-shape.mjs` | PR3 | vormcheck Bearer-header + socket-handshake-payload |
| `rest-games` | `rest-games-create-join.mjs`, `rest-games-session.mjs` | PR3 | schema's/validatie voor de 5 REST-endpoints |
| `input-safety` | `input-safety.mjs` | PR3 | naamnormalisatie/-validatie (NFKC, max 20 tekens) |
| `client-events` | `client-events-game-lifecycle-a.mjs`, `client-events-game-lifecycle-b.mjs`, `client-events-dispatch.mjs`, `client-events-round-answer-variants.mjs` | PR4a–d | schema + rolvalidatie voor de client→server events (17 op 6 aug 2026; `ALL_CLIENT_EVENT_NAMES` is de bron, dit getal niet), `resolveEventValidator`/`UNSUPPORTED_EVENT`, 5 `round:answer`-varianten |
| `server-events` | `server-events-room-lifecycle.mjs`, `server-events-round-lifecycle.mjs`, `server-events-scoring.mjs`, `server-events-session-and-error.mjs`, `server-events-recipients.mjs`, `throttle-round-progress.mjs` | PR5a–e | schema + ontvangersregel voor de server→client events (17 op 6 aug 2026; `ALL_SERVER_EVENT_NAMES` is de bron), throttle voor `round:progress` |
| `snapshot` | `snapshot-shape.mjs` | PR5d | vorm van de state-snapshot + invariant "geen correct antwoord van actieve ronde" |
| `reconnect` | `reconnect.mjs` | PR6 | backoff-reeks, snapshot-leidend-koppeling, niet-herverzenden van geaccepteerde antwoorden |
| `auth-session` | `auth-session.mjs`, `auth-session.test.mjs` | PR8a/PR8b | **Bestaat en draait** — `hashToken` wordt o.a. gebruikt door `server/transport/socket/handshake.mjs`. De eerdere regel hier ("nog geen bestand, wacht op akkoord") was achterhaald; gecorrigeerd 6 aug 2026 |
| `preview-endpoint` | `preview-endpoint.mjs`, `preview-endpoint.test.mjs` | — | de invite-preview vóór het joinen |
| `contract-tests` | leeft in [`tests/contract/protocol/`](../../tests/contract/protocol/) — `fake-transport.mjs`, `envelope-idempotency-scenario.mjs`, `rest-scenario.mjs`, `event-and-snapshot-scenario.mjs`, `reconnect-scenario.mjs` | PR7a–e | fake-Fastify/fake-Socket.IO-harnas + scenario's die bovenstaande modules end-to-end toetsen |

Elk bestand hierboven heeft een gelijknamig `*.test.mjs` ernaast, plus
`error-codes.contract.test.mjs` (leest `PROTOCOL.md` van schijf om de foutcode-enum
tegen de spec te toetsen). Actuele voortgang per fase: zie
[`docs/protocol-plan/PR-PROGRESS.md`](../../docs/protocol-plan/PR-PROGRESS.md).
