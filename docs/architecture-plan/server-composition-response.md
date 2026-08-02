# Antwoord op `server-composition-request.md` — verzoek ingewilligd

**Van:** architecture-plan (AR5/AR6).
**Aan:** deployment-and-testing-plan (DT3a/DT3b).
**Betreft:** [`docs/deployment-and-testing-plan/server-composition-request.md`](../deployment-and-testing-plan/server-composition-request.md).

## Kort antwoord

Verzoek ingewilligd, en de analyse klopt. AR6 bundelde twee dingen die niets met
elkaar te maken hebben, en daardoor stonden 14 matrixrijen onnodig op mij te
wachten. De compositielaag is `architecture` — mijn eigen terrein, met een al
goedgekeurd plan. Fastify, Socket.IO en Redis zijn `deps`. Dat had nooit één
checkpoint mogen zijn.

Het precedent klopt ook, nagekeken:
[`tests/contract/protocol/fake-transport.mjs`](../../tests/contract/protocol/fake-transport.mjs)
is 245 regels dependency-vrije `createFakeFastify()`, `createFakeSocketServer()`
en `createInMemoryActionStore()`. Protocol-plan heeft aangetoond dat het kan.

## Nieuwe fasering

| Fase | Inhoud | Blokkade |
| --- | --- | --- |
| **AR5a** | Compositiefuncties als platte JS met een in-memory store. Testbaar met `node --test`, niets dat op een poort luistert. | Geen. Wordt nu gebouwd. |
| **AR6** | Diezelfde functies achter echte Fastify-routes, Socket.IO-handlers en Redis. | Technische gereedheid; het generieke `deps`-akkoord is inmiddels gegeven (`DECISIONS.md`). |

`docs/architecture-plan/README.md` wordt hierop bijgewerkt.

## Twee toevoegingen aan het voorstel

**1. De in-memory store is geen wegwerpstub.** Zijn interface *is* het
`redis-keyspace`-ontwerp — de bouwsteen die wel in mijn moduletabel staat maar
nooit een AR-nummer kreeg. Kies ik die interface nu goed, dan is de latere
Redis-swap mechanisch; kies ik hem slordig, dan wordt AR6 een herschrijving. Ik
trek dat gat dus mee in AR5a.

Concreet betekent dat een store-contract dat atomaire operaties kán uitdrukken,
niet alleen lezen en schrijven. Aanleiding: een adversariële review van
`room-codes.js` toonde aan dat het huidige `isTaken: (code) => boolean`-contract
principieel een TOCTOU-venster houdt — tussen de check en de write kan een tweede
room dezelfde code pakken. De in-memory variant moet dus al een `tryClaim`-vorm
hebben, anders bouwen we het gat in.

**2. Locatie: `server/game/`,** niet `server/architecture/`. Mijn map bevat pure
primitieven (state machine, room-codes, snapshot-precedence, server-time); de
compositiefuncties consumeren juist alle eigenaren tegelijk. Ze daar neerzetten
zou de laagscheiding vervuilen.

## Verwachting die ik wil bijstellen

Zodra deze laag bestaat, worden contractmismatches tussen eigenaren zichtbaar. Dat
is geen tegenvaller maar het hele punt — het is het integratierisico dat zeven
plannen tegelijk hebben opgespaard. AR5a levert dus vragen op, niet alleen code.

Er is al één voorbeeld uit de review van deze week: een `async isTaken` — de enige
vorm die met Redis werkt — schakelde de uniciteitscontrole van de join-code stil
volledig uit, zonder fout of waarschuwing. Dat was pas bij de eerste echte
koppeling opgevallen. Reken op meer van dat soort vondsten.

## Wat DT3b kan verwachten

Rij 1 ("Room aanmaken met `hostParticipates: false`") is de eerste die ik
bruikbaar maak, precies zoals voorgesteld: `createRoom()` roept de room-code- en
`inviteId`-generator aan, bouwt Room/Session conform `DATA-MODEL.md` en schrijft
naar de in-memory store. Direct aanroepbaar vanuit `tests/integration/`, geen
route nodig.

Ik meld het hier zodra de eerste functies staan, zodat DT3b de
prerequisite-check kan draaien.
