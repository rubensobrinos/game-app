# Agent 1 — hostacties & protocol

**Lees eerst `../README.md`.** Jij bent de enige die het protocol raakt. Je
drie punten zitten in dezelfde bestanden (`server/protocol/`,
`server/composition/room-lifecycle.mjs`, `socket.mjs`, `views/hostbar.mjs`);
daarom doe je ze achter elkaar en niemand anders.

`server/` mag je deze ronde aanraken. Dat was in ronde 2 verboden.

## Ronde 1 — "Antwoord automatisch tonen" (middel, ~1,5 dag)

De lobby toont een rij "Antwoord automatisch tonen" met een BINNENKORT-badge en
géén besturingselement (`views/lobby.mjs`, `autoRevealRow`). De producteigenaar
merkte drie keer op dat het niet werkt. Het is nooit gebouwd: dit is besluit C
uit `DOELBEELD-v2-schermen-en-games.md` §3 en het is serverwerk.

**Wat het moet doen:** staat de toggle uit, dan blijft het scherm op de reveal
staan tot de **host** onthult. Staat hij aan (de standaard), dan loopt alles
zoals nu.

**Het besluit dat de lead al genomen heeft** — bouw dit, ga er niet over in
discussie: met host-tempo én handmatig onthullen zou de host twee knoppen per
ronde krijgen, en `DECISIONS.md` besluit 1 staat maar één hostactie per ronde
toe. Dus: **is "automatisch tonen" uit, dan ís het onthullen de hostactie.**
Daarna loopt het door naar de volgende vraag; er komt géén tweede knop
"Volgende" bij.

Een eerdere agent heeft de weg al in kaart gebracht:

| Waar | Wat |
| --- | --- |
| `server/data/types/game-configuration.js` | veld `autoReveal` + validatie + typedef |
| `server/composition/room-lifecycle.mjs` (~r99 `QUICK_START_CONFIG`) | default `true` |
| fixtures: `tests/fixtures/`, `data-store-conformance.mjs`, `room.test.js`, `repository.test.js`, redis-fixtures | de sleutellijst wordt exhaustief getoetst — reken op 6+ bestanden puur fixture |
| `server/composition/match-lifecycle.mjs` (`phaseDurationMs`, `phaseEndsAt`, `isHostActionPhase`) | bij `autoReveal: false` krijgt `ROUND_RESULT` `phaseEndsAt: null` |
| `server/transport/socket.mjs` | de `ROUND_RESULT`-tak wordt voorwaardelijk; nieuwe `game:reveal`-handler |
| `server/protocol/` | validatie voor het nieuwe clientevent |
| `client/flow/host-controls-state.mjs`, `views/hostbar.mjs` | actie `'reveal'` + knop |
| `views/lobby.mjs` + locales | de toggle echt aansluiten, BINNENKORT weg |
| `docs/multiplayer/PROTOCOL.md`, `DECISIONS.md` | vastleggen |

**Let op de 15-bestandsgrens** van `devkit check-autonomy`: dit past niet in één
commit. Splits in server+protocol eerst, daarna client.

## Ronde 2 — een speler die weggaat (klein, ~halve dag)

`player:leave` bestaat in het protocol maar doet niets: `socket.mjs` logt
`clientevent zonder compositiefunctie` en geeft `UNSUPPORTED_EVENT` terug. Er
is geen `leaveRoom()` in `room-lifecycle.mjs`.

Wat een vertrek moet doen: de speler telt niet meer mee, verdwijnt uit de
lijst, en de anderen zien dat via `room:player-changed`. Kijk hoe `kickPlayer`
het doet — dat pad bestaat al en zet `left`/`kicked` op de speler; dit is de
vrijwillige variant. Een vertrokken speler mag geen scores of rondes verstoren
en niet uit de eindstand verdwijnen als hij al punten had.

## Ronde 3 — host wijzigt naam of kleur van een ander (klein, ~halve dag)

`renamePlayer` en `recolorPlayer` werken alleen voor jezelf. Als host kun je
iemand wél verwijderen maar niet hernoemen — terwijl dat precies is wat je wil
als iemand "Speler 7" heet of een onleesbare naam kiest. Staat als ticket in
`STATUS.md`.

Zelfde regels als de speler zelf: alleen in `LOBBY`, naamnormalisatie
ongewijzigd. De limiet van één hernoeming per speler geldt **niet** voor de
host — anders kan hij een fout van de speler niet herstellen.

## Niet doen

- De reveal-inhoud of het hostmenu **vormgeven** — dat is af (ronde 2) en niet
  van jou.
- `views/lobby.mjs` verbouwen; alleen de toggle aansluiten.
- Besluit 1 herzien. De lead heeft de botsing al beslecht.
