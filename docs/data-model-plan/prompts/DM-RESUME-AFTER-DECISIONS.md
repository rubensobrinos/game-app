# DM — hervat na productbesluiten

Lees eerst `docs/multiplayer/DECISIONS.md`. De daar vastgelegde keuzes vervangen de
oude menselijke checkpoints in het data-modelplan.

## Bevestigde antwoorden voor DATA MODEL

- `contentVersion` en `rendererVersion` zijn canonieke, onveranderlijke
  `Match`-velden; roundpayloads dragen ze mee.
- Room, Match en Round worden eerst als versieerbare JSON-documenten opgeslagen.
- Indexes, sessies en idempotencydata mogen passende Redis-structuren gebruiken.
- Antwoordverwerking gebruikt Redis Lua.
- Gebruik de officiële Node-package `redis` bij de concrete adapter.
- Gebruik PostgreSQL, geen SQLite-pilot.
- Tokenhashing, invitehashing en analytics-HMAC volgen `DECISIONS.md` #26.
- Naamfiltering gebruikt een kleine lokale, versieerbare NL/EN-lijst.
- ESM is canoniek voor nieuwe modules.
- CorrectAnswer-vormen, rematch-leftgedrag en 1-based roundNumber zijn bevestigd.
- Teams, spectators, Groepsbattle en mixed games worden nu niet gebouwd.

## Nog niet beslist

De autoriteit tussen `Room.phase` en `Match.phase` is nog open. Introduceer geen
niet-atomair dual-write-pad. Houd dit als één smal checkpoint; laat het de overige
DM-fasen niet blokkeren.

## Opdracht

1. Herzie DM2b/DM3 zodat versions op Match staan en Room niet als onvolledig
   surrogaattype blijft hangen.
2. Voer de uitvoerbare DM2–DM9-fasen uit tegen de echte huidige code.
3. Gebruik JSON-semantiek in repository/fake en Lua-semantiek in het adaptervoorstel;
   claim niet dat de in-memory fake Redis-atomiciteit bewijst.
4. Bouw geen teamprojecties en geen Groepsbattle-/mixed-gameconfiguratie.
5. Draai relevante tests en werk DM-PROGRESS.md bij met alleen echte blockers.

