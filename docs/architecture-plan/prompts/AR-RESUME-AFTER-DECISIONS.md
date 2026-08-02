# AR — hervat na productbesluiten

Lees eerst `docs/multiplayer/DECISIONS.md`; dat document is bindend en gaat vóór
oudere open vragen, prompts en handoffs.

## Bevestigde antwoorden voor ARCHITECTURE

- Host-tempo gebruikt één hostactie per ronde: `ROUND_RESULT` loopt op timer door
  naar `SCOREBOARD`; de host gaat daarna verder.
- `INVALID_PAUSE_STATE` blijft intern en gaat niet als nieuwe protocolcode naar de
  client.
- `countdownEndsAt` is vluchtig en wordt bij de transitie berekend.
- Room/Match/Round worden eerst als JSON-documenten opgeslagen.
- Antwoordverwerking wordt atomair met Redis Lua.
- Gebruik bij de servercomposition de officiële Node-package `redis`.
- PostgreSQL is de persistente database; ESM is het canonieke moduleformaat.
- De gedeelde contentmodule komt onder `shared/content/`.
- De benodigde server-, test- en deploymentdependencies zijn inhoudelijk
  goedgekeurd. Vraag niet opnieuw om hetzelfde generieke akkoord.
- Teams, spectators, Groepsbattle en mixed games worden nu niet gebouwd.

## Nog niet beslist

De producteigenaar heeft nog niet gekozen of `Room.phase` en `Match.phase` beide
worden opgeslagen of dat één daarvan wordt afgeleid. Introduceer geen niet-atomair
dual-write-pad. Dit blokkeert AR2–AR5 en de overige servercomposition niet.

## Opdracht

1. Werk actuele AR-statussen en handoffs bij; laat historische prompts intact.
2. Pas AR1 plus fixtures aan naar één hostactie per ronde en draai de relevante
   tests.
3. Werk AR2–AR5 in de geplande volgorde uit. Gebruik de bestaande modules en huidige
   repositorytoestand als bron, niet verouderde planningsaannames.
4. Bouw AR6 zodra de concrete composition en dependencies technisch gereed zijn.
5. Voeg geen teams, spectators, Groepsbattle of mixed-gamegedrag toe.
6. Rapporteer gewijzigde bestanden, tests en uitsluitend nog echte blockers.

