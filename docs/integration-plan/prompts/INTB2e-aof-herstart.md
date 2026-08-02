# INTB2e — AOF-herstart: actieve rooms overleven een Redis-restart

**Domein:** INT-B. **Blokkade:** INTB2b, INTB2c, INTB2d.

---

## Prompt

Je bewijst dat de opslag doet wat `ARCHITECTURE.md` §10 belooft: een Redis- of
hostprocesrestart verwijdert niet standaard alle rooms.

### Lees eerst

- `docs/multiplayer/ARCHITECTURE.md` §10 **Herstelbaarheid** — AOF met
  `appendfsync everysec`, de room-index, en het hervatten via `PAUSED` plus een
  nieuwe korte countdown.
- `docs/multiplayer/DEPLOYMENT-AND-TESTING.md`, testlaag 5 — restart- en
  chaostests.
- `docker-compose.yml` — de Redis-service met AOF staat er al.
- `server/data/ttl.js` — TTL-gedrag over een herstart heen.

### Wat je bouwt

Een test die een echte Redis-herstart uitvoert (of simuleert door de service te
stoppen en te starten) en daarna controleert:

1. **Een actieve room bestaat nog** — roomdocument, matchdocument, spelers en het
   scoreboard zijn ongewijzigd terug te lezen.
2. **De lookup-indexen werken nog** — `loadRoomByCode` en `loadRoomByInviteId`
   vinden de room. Dit is het makkelijkst kapot: als indexen buiten AOF om
   worden opgebouwd, overleven ze niet.
3. **De room-index (`roomsActiveKey`) klopt nog** — een herstellende server moet
   de actieve rooms kunnen vinden, anders is een room onvindbaar maar niet
   verlopen.
4. **TTL's zijn niet stilletijk verdwenen of gereset.** Een room die nog een uur
   had, heeft er na de herstart ongeveer nog een uur.
5. **Geen dubbele punten na herstel** — bied een antwoord aan dat vóór de
   herstart al was verwerkt, met dezelfde `actionId`, en assert dat de score
   ongewijzigd blijft. De action-cache moet de herstart dus ook overleven, of het
   moet expliciet gedocumenteerd zijn dat hij dat niet doet.

### Aandachtspunt

`appendfsync everysec` betekent dat maximaal één seconde aan schrijfwerk verloren
kan gaan. Dat is een bewuste keuze, geen bug. Schrijf de test zo dat hij dat
tolereert zonder de eis te verwateren: het gaat erom dat de room bestaat en
consistent is, niet dat élke laatste schrijfactie er is. Leg in een comment vast
wat wél en niet gegarandeerd is, zodat een latere lezer de test niet aanscherpt
tot iets wat AOF niet kan waarmaken.

### Wat je NIET doet

- Het herstelgedrag van de game-server zelf testen — dat is INT-A's ketentest.
  Jij test uitsluitend of de opslag zijn kant waarmaakt.
- Redis-configuratie wijzigen om de test te laten slagen.

### Opleveren

Pad, hoe je de herstart uitvoert, welke van de vijf punten groen zijn, en wat er
precies verloren gaat binnen het `everysec`-venster.
