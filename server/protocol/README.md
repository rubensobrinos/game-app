# server/protocol/

Deze map realiseert [`docs/multiplayer/PROTOCOL.md`](../../docs/multiplayer/PROTOCOL.md)
volgens het uitvoeringsplan in
[`docs/protocol-plan/README.md`](../../docs/protocol-plan/README.md).

## Locatie: voorlopig

Deze plek staat naast `server/rules/` (game-rules-plan) en
`server/architecture/` (architecture-plan) en is **niet definitief**. Ze kan
verschuiven zodra architecture-plan's A5/A6-voorstel voor een serverskeleton
landt en een bindende mapindeling oplevert (`architecture`-checkpoint).

## Moduleformaat

- Platte JavaScript, native ES modules via de `.mjs`-extensie.
- Typering via JSDoc, geen TypeScript.
- Testrunner: Node's ingebouwde `node --test`, altijd tegen een expliciet
  bestand, bijv. `node --test server/protocol/envelope.test.mjs` — nooit tegen
  een directorypad.
- Geen `package.json`, geen enkele nieuwe dependency.

## Modules (zie modules-tabel in docs/protocol-plan/README.md)

`envelope`, `auth-shape`, `rest-games`, `client-events`, `server-events`,
`error-codes`, `reconnect`, `input-safety`, `contract-tests`.

M1 begint vandaag met de envelope- en idempotentie-bouwstenen.
