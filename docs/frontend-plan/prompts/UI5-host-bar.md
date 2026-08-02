# Prompt — UI5: Hostbalk

Onderdeel van [`../README.md`](../README.md), fase UI5. Vereist UI0, UI3, UI4.
Bouwt scherm 6 van UI1a — een overlay, geen eigen route/fase.

## Brondocument

`GAME-FLOW.md` §Hostbediening: "Een host die meespeelt moet de bediening
kunnen inklappen zodat de antwoordinterface niet kleiner of onrustiger wordt."
`docs/game-flow-plan/prompts/GF10-host-controls-state.md` voor het volledige
contract.

## Wat dit scherm doet

Een dunne render-laag over `host-controls-state`, zichtbaar op elke fase ná de
lobby, **alleen voor sessies met de `host`-rol**:

1. Bouw de `HostControlContext` (`{ phase, pacing, playerCount, locked }`) uit
   de actuele `match-phase-state` + roomconfig + lokale spelerscount (UI2).
2. `availableHostActions(context)` → render precies die knoppen, in willekeurig
   maar consistente volgorde. Geen knop tonen die niet in de lijst staat —
   geen eigen aanname over wanneer iets "waarschijnlijk" ook zou mogen.
3. Bij een tik: `hostActionRequest(action, context, params)`. `'kick'` heeft een
   `playerId` nodig — haal die uit de deelnemerslijst (UI2), niet uit een eigen
   nieuwe bron.
4. **Inklapbaar.** Puur lokale UI-state (geen reducer nodig): een
   toggle-knop die de balk open/dicht klapt. Standaard ingeklapt zodra de host
   zelf ook aan het antwoorden is (fase `ROUND_ACTIVE`), zodat het
   antwoordscherm niet kleiner wordt — dat is een `hostParticipates`-afhankelijke
   keuze uit `host-setup-state`, niet iets om hier opnieuw te bepalen; lees het
   gewoon uit de sessie.

## Regels

- Deze module beslist zelf niets over welke actie geldig is — dat blijft
  volledig bij `host-controls-state`. Geen tweede legaliteitscontrole.
- Nooit `innerHTML` voor de spelersnaam bij een kick-bevestiging.
- Een niet-hostsessie ziet deze balk nooit, in geen enkele fase.

## Definition of done

- Tegen `transport-mock.mjs`: elke actie (pauze/hervat/lock/kick/beëindig/
  rematch) is bruikbaar op het moment dat `availableHostActions` het toestaat,
  en verdwijnt zodra dat niet meer zo is (bijvoorbeeld `'resume'` na een
  geslaagde hervatting).
- De balk klapt in/uit zonder de rest van het scherm te laten springen.
- `UI-PROGRESS.md` bijgewerkt — dit is ook het moment om de UI1a-DoD
  (twee browsertabs, volledige match) te proberen zodra INT-A's transportlaag
  er is.
