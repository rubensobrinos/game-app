# Verzoek aan architecture-plan — compositielaag vóór echte dependencies

**Van:** deployment-and-testing-plan (DT3a/DT3b).
**Aan:** de eigenaar van [`docs/architecture-plan/`](../architecture-plan/README.md),
fase AR5/AR6.
**Context:** alle 14 rijen in [`integration-matrix.md`](integration-matrix.md)
staan geblokkeerd op dezelfde prerequisite: een implementatie die de bestaande,
al-geteste pure modules (`server/rules`, `server/architecture`, `server/data`,
`server/protocol`) daadwerkelijk aan elkaar knoopt. Zonder die knoop kan
[`prompts/DT3b-integratie-code.md`](prompts/DT3b-integratie-code.md) geen enkele
rij activeren.

## De vraag is lichter dan AR6 nu suggereert

`docs/architecture-plan/README.md`, fase AR6, bundelt op dit moment twee dingen tot
één checkpoint:

> "Pas ná akkoord op AR5 én op het toevoegen van dependencies (TypeScript, Fastify,
> Socket.IO, Redis-client) bouw ik het daadwerkelijke serverproces dat deze
> bouwstenen aan elkaar knoopt."

Dat hoeft niet één stap te zijn. Er bestaat al een precedent dat aantoont dat de
compositie zelf **geen** nieuwe dependency nodig heeft:
[`tests/contract/protocol/fake-transport.mjs`](../../tests/contract/protocol/fake-transport.mjs)
— een handgerold, dependency-vrij fake-Fastify + fake-Socket.IO-harnas, gebouwd
door protocol-plan voor PR7, expliciet met als doel dat "een latere overstap naar
de echte library (na het `deps`-akkoord)... geen wijziging aan testcode vereist."

Concreet verzoek: splits AR5/AR6 in twee losse stappen.

1. **Nu, geen `deps`-akkoord nodig:** de composition-/interfacelaag uit AR5 (het
   "voorstel voor mapindeling en interfaces waarmee een toekomstige `game-server`
   de modules... aanroept") daadwerkelijk **implementeren** als platte
   JavaScript-functies — bijvoorbeeld `createRoom(config, hostParticipates)`,
   `joinRoom(locator, displayName)`, `submitAnswer(roundId, playerId, answer,
   actionId)` — die de bestaande modules aanroepen en een in-memory
   Map/store gebruiken in plaats van echte Redis (net als
   `createInMemoryActionStore()` in `fake-transport.mjs` al doet voor
   `idempotency.mjs`). Testbaar met `node --test`, geen nieuwe dependency, geen
   netwerk, geen server die luistert op een poort.
2. **Later, wél `deps`-akkoord nodig:** deze functies daadwerkelijk achter echte
   Fastify-routes/Socket.IO-handlers en een echte Redis-verbinding hangen. Dát is
   de stap die TypeScript/Fastify/Socket.IO/een Redis-client vereist — niet stap 1.

## Wat dit ontgrendelt

Zodra stap 1 bestaat, kan DT3b onmiddellijk beginnen te activeren. Voorbeeld van de
eerste, kleinste rij:

- **Rij 1** ([`integration-matrix.md`](integration-matrix.md)): "Room aanmaken met
  `hostParticipates: false`". Prerequisite wordt dan: `createRoom()` bestaat,
  roept `server/architecture`'s room-code-/inviteId-generator aan, bouwt een
  Room/Session-object conform `DATA-MODEL.md`, en slaat het op in de in-memory
  store. Geen Fastify-route nodig om dit te testen — een direct functieaanroep
  vanuit `tests/integration/` volstaat.

Andere rijen (7: volledige matchcyclus; 11: room-isolatie; 12: idempotente
`actionId`) hebben logischerwijs meer van deze compositiefuncties nodig, maar geen
van de 14 rijen vereist voor activatie dat er iets op een poort luistert.

## Wat dit niet is

- Geen `public_api`- of `database_schema`-besluit namens `PROTOCOL.md`/
  `DATA-MODEL.md` — de compositiefuncties roepen bestaande, al vastgelegde vormen
  aan, ze verzinnen er geen nieuwe.
- Geen vervanging van AR5's eigen voorstel voor de uiteindelijke mapindeling — de
  locatie van deze functies (`server/architecture/`? een nieuwe `server/game/`?) is
  nog steeds aan architecture-plan.
- Geen `deps`-omzeiling: zodra deze functies achter een echte Fastify/Socket.IO/
  Redis-laag moeten, geldt AR6's checkpoint onverkort.

## Wie dit oppakt

Dit is niet iets wat deployment-and-testing-plan zelf bouwt — de mapindeling en
compositiekeuzes zijn `architecture`, en horen bij AR5/AR6, niet bij DT3b. Dit
document is uitsluitend het verzoek en de onderbouwing; de implementatie blijft bij
architecture-plan. Zodra die functies bestaan, pakt DT3b ze op via de matrixrij's
prerequisite-check (stap 0 in
[`prompts/DT3b-integratie-code.md`](prompts/DT3b-integratie-code.md)).
