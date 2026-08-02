# GF — hervat na productbesluiten

Lees eerst `docs/multiplayer/DECISIONS.md`. GF8 is daarmee beantwoord.

## Bevestigde antwoorden voor GAME FLOW

- Voeg een pre-join-previewstap toe voor invitevalidatie en servergegenereerde
  naamsuggestie.
- De eigen speler krijgt proactief `eligibleFromRound` te zien.
- Leave behoudt de herstelbare sessie binnen TTL; een vertrokken speler komt niet
  automatisch terug bij rematch.
- Snapshot en live pauze-event gebruiken dezelfde volledige `pausedState`.
- Pauzeredenen zijn `host`, `host_disconnected`, `no_answers`, `server_recovery`,
  met een generieke fallback.
- Host-tempo gebruikt één hostactie per ronde.
- Teams en spectators worden nu niet gebouwd; GF7 vervalt voor de huidige MVP.
- Groepsbattle en mixed games worden nu niet gebouwd.

## Opdracht

1. Houd GF7 gesloten als buiten scope en verwijder actuele wachtstatussen.
2. Herzie `join-state` voor de previewresponse en het definitieve joinverzoek.
3. Herzie phase-/edge-case-state waar nodig voor volledige `pausedState` en de
   bevestigde redenen.
4. Controleer host-controls op één actie per ronde en stem tests af op de
   state-machine.
5. Controleer leave/session-store/rematchgedrag tegen de bevestigde semantics.
6. Voeg geen teams, spectators, Groepsbattle of mixed-game-UI-state toe.
7. Draai alle client/flow-tests en rapporteer echte resterende blockers.

