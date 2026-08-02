# GR — hervat na productbesluiten

Lees eerst `docs/multiplayer/DECISIONS.md`; de `correctAnswer`-tabel daarin is
bindend.

## Bevestigde antwoorden voor GAME RULES

- De bestaande vijf `correctAnswer`-vormen zijn bevestigd.
- Deadlinegrace kan een laat correct antwoord accepteren, maar geeft nooit extra
  bonus.
- Antwoordverdelingen worden door de rules/service-laag berekend.
- Een match gebruikt voorlopig precies één `gameType`; bouw nu geen mixed games.
- Teams en Groepsbattle worden nu niet gebouwd.
- De gedeelde contentmodule komt onder `shared/content/`.

## Opdracht

1. Verwijder actuele blokkadestatussen rond `correctAnswer`; historische reviews
   mogen blijven staan.
2. Voer GR4 uit voor één gameType per match en behoud deterministische RNG-injectie,
   rematch-exclusie per spelvorm en het bestaande outputcontract.
3. Werk GR5 uit voor late join, leave/disconnect en rematch-leftgedrag conform
   `DECISIONS.md`.
4. Sla GR6 over; teams zijn uit de huidige scope.
5. Lever de rules-functie voor antwoordverdeling indien die nog ontbreekt, zonder
   protocoltransport in deze laag te bouwen.
6. Koppel uitsluitend via een expliciete interface aan `shared/content/`; bouw geen
   tweede contentbron in `server/rules/`.
7. Draai alle rules-tests en rapporteer echte resterende blockers.

