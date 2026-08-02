# PR — hervat na productbesluiten

Lees eerst `docs/multiplayer/DECISIONS.md`; dat document is het bindende antwoord op
de open-vragensectie van het protocolplan.

## Bevestigde antwoorden voor PROTOCOL

- Verlopen room-TTL wordt extern `GAME_NOT_FOUND`.
- Exposeer proactief `eligibleFromRound` voor de eigen speler; servervalidatie blijft
  leidend.
- Vrijwillig leave zet `left: true` en trekt het sessietoken niet in.
- Een vertrokken speler telt niet automatisch mee in een rematch.
- `joinUrl` gebruikt serverconfiguratie `PUBLIC_APP_URL`.
- Voeg een licht pre-join-previewendpoint toe voor invitevalidatie en een
  servergegenereerde naamsuggestie.
- Snapshot en `game:paused` gebruiken de volledige `pausedState`-vorm.
- Pauzeredenen: `host`, `host_disconnected`, `no_answers`, `server_recovery`.
- `INVALID_PAUSE_STATE` blijft intern.
- Deadlinegrace is 250 ms; binnen grace kan correct worden geaccepteerd zonder
  tijdbonus, daarna volgt `DEADLINE_PASSED`.
- De rules/service-laag berekent antwoordverdelingen.
- De vijf `correctAnswer`-vormen uit `DECISIONS.md` zijn bevestigd.
- Publiek `roundNumber` is 1-based; `countdownEndsAt` is vluchtig.
- `session:revoked` is alleen voor expliciete server-/beheerintrekking.
- `share:opened.method` wordt `qr | link | native | code`.
- Een misvormde `/time`-response gebruikt lokaal `INVALID_SERVER_RESPONSE`.
- Definieer voor alle vijf spelvormen een discriminated question-payload zonder
  `correctAnswer` in `round:started`.
- Sessietokens: 32 random bytes/base64url, versieerbare HMAC-SHA256 met pepper en
  constant-time verificatie.
- Teams en spectators worden nu niet gebouwd.

## Opdracht

1. Markeer de historische open vragen als beantwoord of buiten scope.
2. Werk het fundamentele `PROTOCOL.md`, validators en contracttests consistent bij.
   Publieke contractwijzigingen in deze lijst zijn expliciet geaccordeerd.
3. Bouw PR8b conform het bevestigde authvoorstel en voeg tests toe.
4. Voeg het previewendpointcontract toe; bouw ten minste de pure validator-/shape-
   laag als de serverroute nog door de composition-agent moet worden aangesloten.
5. Voeg geen team- of spectatoroppervlak toe.
6. Draai alle protocol- en contracttests en rapporteer echte resterende blockers.

