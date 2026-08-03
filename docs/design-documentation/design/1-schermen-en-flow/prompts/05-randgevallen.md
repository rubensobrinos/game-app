# Prompt — 05: Randgevallen zonder eigen schermnummer

Onderdeel van thema 1 ([`../PROGRESS.md`](../PROGRESS.md), sectie
"Randgevallen zonder eigen schermnummer"). Twee losse punten uit `03` die
geen `S`-nummer hebben en daarom nergens getrackt stonden.

## Brondocument

[`../03-GAME-FLOW-AND-STATES.md`](../03-GAME-FLOW-AND-STATES.md) §5.1
(`ROOM_VALIDATING`), §7 ("Dubbele tab").

## 1. Gedifferentieerde foutafhandeling bij `ROOM_VALIDATING`

**Nu:** `join.mjs` toont voor alle 23 `PROTOCOL.md`-foutcodes dezelfde
generieke `Opnieuw proberen`-knop (`join.retry` → dispatch `RETRY` op
`join-state.mjs`). `03` §5.1 vraagt: "iedere fout heeft een specifieke
vervolgstap."

**Eerst uitzoeken, niet aannemen:** welke foutcodes een joinpoging
daadwerkelijk kan opleveren (zie `edge-case-messaging.KNOWN_ERROR_CODES` voor
de volledige lijst; niet alle 23 zijn relevant voor joinen — `PLAYER_NOT_ELIGIBLE`
hoort bijvoorbeeld bij een actieve ronde, niet bij joinen).

**Voorstel voor categorisering** (aanpasbaar, dit is geen vastgelegd besluit):

| Categorie | Codes | Vervolgactie |
|---|---|---|
| Blijvend ongeldig | `GAME_NOT_FOUND`, `INVITE_INVALID` | Terug naar start, niet "opnieuw proberen" met dezelfde code/link |
| Kan veranderen, maar niet direct | `GAME_FULL`, `ROOM_LOCKED`, `GAME_ALREADY_STARTED`, `LATE_JOIN_DISABLED` | Terug naar start als primaire actie; "opnieuw proberen" secundair, want een halve seconde later opnieuw proberen lost meestal niets op |
| Tijdelijk/technisch | `CODE_RATE_LIMITED`, netwerkfout (geen `.code`) | "Opnieuw proberen" blijft primair, eventueel met een korte wachttip bij rate-limiting |

**Aanpak:** `join-state.mjs`'s `error`-status heeft al `code` — voeg in
`join.mjs` een kleine mapping toe die op basis daarvan bepaalt welke
knop(pen) getoond worden (`RETRY` vs. terug-naar-`/`), in plaats van altijd
dezelfde ene knop.

## 2. Dubbele tab

**Nu:** niets in de code regelt dit. Twee tabs met dezelfde `sessionToken` in
`localStorage` (via `session-store.mjs`) roepen allebei onafhankelijk
`transport.connect(sessionToken, ...)` aan.

**Eerst reproduceren, niet aannemen:** open twee tabs op dezelfde
`/game/{code}` met dezelfde opgeslagen sessie tegen `transport-mock.mjs` (die
houdt per sessie één `listeners`-entry bij, `room.listeners.set(sessionToken,
listener)` — een tweede `connect()` overschrijft mogelijk gewoon de eerste
listener in de Map, wat zou betekenen dat de EERSTE tab stil stopt met events
ontvangen zodra de tweede opent, zonder dat die tab dat zelf weet). Bevestig
dit gedrag expliciet vóórdat je een fix bedenkt — het kan zijn dat de mock
zich anders gedraagt dan de echte Socket.IO-server straks doet.

**Aanpak, afhankelijk van wat je vindt:** `03` §7 vraagt om "de nieuwste of
eerste actieve sessie deterministisch leidend", en de ándere tab moet een
uitleg tonen in plaats van stil dood te gaan. Client-side is er geen
betrouwbare manier om een tweede tab te *detecteren* zonder een mechanisme als
`BroadcastChannel` of een `localStorage`-event — overweeg dat, maar leg een
eventuele nieuwe afhankelijkheid/aanpak vast als voorstel, niet als
stilzwijgend besluit (`00-DESIGN-INDEX.md` §6, punt 9).

## Regels

- Beide punten: geen giswerk over server-gedrag dat je niet hebt
  gereproduceerd.
- Geen nieuwe niet-vertaalde tekst — nieuwe knoppen/berichten door alle drie
  de locales heen.

## Definition of done

- Punt 1: minimaal twee zichtbaar verschillende foutafhandelingen bestaan
  (niet meer één generieke knop voor alle codes), gedemonstreerd tegen
  `transport-mock.mjs` met minstens twee verschillende foutcodes.
- Punt 2: het daadwerkelijke gedrag bij twee tabs is gedocumenteerd (in de
  commitmessage of hier in dit bestand) vóórdat er een fix wordt gebouwd; als
  er geen fix in deze ronde past, is dat een expliciete beslissing, geen
  weggelaten stap.
- `../PROGRESS.md` bijgewerkt: beide rijen in "Randgevallen zonder eigen
  schermnummer" naar het niveau dat het werk rechtvaardigt.
