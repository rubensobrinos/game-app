# Prompt — PR1: Event-envelope & idempotentie

Dekt fase **PR1** uit [`../README.md`](../README.md#fasering). **Status: uitgevoerd.**
Dit bestand is retroactief geschreven zodat elke fase een eigen promptbestand heeft
(zie [`PR0-scaffold.md`](PR0-scaffold.md) voor dezelfde aantekening).

## Brondocument

Letterlijk uit [`PROTOCOL.md`](../../multiplayer/PROTOCOL.md), secties
**Event-envelope**, **Ack** en het deel van **Inputveiligheid** over payloadgrootte,
plus Basisregels 3 en 5.

Client→server-envelope: `{ event, actionId, payload }`. Server→client-envelope:
`{ event, eventId, serverTime, payload }`. Ack: `{ actionId, ok, serverTime, payload }`.
"Bij een retry met dezelfde `actionId` retourneert de server dezelfde logische ack
zonder de mutatie opnieuw uit te voeren." Idempotentie van `round:answer`: zelfde
`actionId` → zelfde ack; nieuwe `actionId` met zelfde of ander antwoord ná een reeds
geaccepteerd antwoord → `ALREADY_ANSWERED`.

## Wat er is uitgevoerd

Twee modules in `server/protocol/`, native ESM, JSDoc, geen dependencies:

**`envelope.mjs`** — `parseClientEnvelope(raw)`, `buildServerEnvelope(event, payload,
serverTime, eventId)`, `buildAck(actionId, ok, serverTime, payload)`,
`assertPayloadSize(rawPayload, maxBytes)`. Alle vier puur, retourneren
`{ ok: true, ... } | { ok: false, reason }` (nooit een throw); `reason`-strings zijn
bewust lowercase en module-intern, geen (nog niet bestaande) officiële
`PROTOCOL.md`-foutcode — die mapping komt pas bij PR2.

**`idempotency.mjs`** — `resolveDuplicateAction(store, actionId, event, options)`:
replay via een geïnjecteerde `store` (`get`/`set`), en de `round:answer`-specifieke
`ALREADY_ANSWERED`-regel via een door de aanroeper geleverd `alreadyAnswered`-predicaat
(deze module kent geen Round-/Answer-state zelf).

## Tests

`envelope.test.mjs` (15 gevallen) + `idempotency.test.mjs` (5 gevallen) — 20 in totaal,
`node:test` + `node:assert/strict`, geen dependencies. Alle 20 slagen.

## Niet in scope

- Mapping van `reason`-strings naar de officiële 23 `PROTOCOL.md`-foutcodes — PR2.
- Redis-opslag van de action-cache — `DATA-MODEL.md`; `idempotency.mjs` neemt alleen
  een `store`-interface aan, kent de echte opslag niet.
- Auth/token-vorm — PR3 (`auth-shape`).

## Definition of done

- Beide modules bestaan met eigen tests, 20/20 groen.
- Geen enkele functie gooit een exception; alle retourneren het
  `{ ok, ... }`-resultaattype.
- Geen `package.json`, geen dependency toegevoegd.
