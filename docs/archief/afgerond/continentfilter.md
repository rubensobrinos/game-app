# Continentfilter

Punt 7 uit de productspec. **Nooit gebouwd** — de agent die het zou doen, is er
niet aan toegekomen.

Standaard alle landen wereldwijd, geen configuratie. Onder "Meer instellingen"
mag een host continenten aan- of uitzetten. **Geen lijst waarin hij losse
landen kiest.**

De standaard is er al; het filter is nieuw.

| Waar | Wat |
| --- | --- |
| `server/data/types/game-configuration.js` | veld voor de gekozen continenten + validatie |
| `server/composition/room-lifecycle.mjs` | default: alle continenten |
| `server/rules/question-selection.js` (`buildCandidatePool`) | de pool filteren |
| `views/lobby.mjs` — "Meer instellingen" | de keuze zelf |

Zes continenten: Europe, Asia, Africa, North America, South America, Oceania.

**Besluit dat al genomen is:** "Welke hoort er niet bij" heeft in zijn
continentvariant minstens twee continenten nodig. **Geen harde ondergrens
instellen.** Kiest een host één continent, dan valt die game terug op de
echt-of-nep-logica (`fake_among_real` / `real_among_fake`) — die heeft geen
continenten nodig. Geen foutmelding, geen beperking op wat de host mag kiezen.

Let op dat "Raad de vlag" met één klein continent te weinig landen kan
overhouden voor vier antwoordopties. `buildCandidatePool` werpt dan een
`RangeError`. Zorg dat dat niet in een stille hang eindigt — zie hoe
`content-source.mjs` dat afvangt.

Reken op zes of meer fixturebestanden: de sleutellijst van de configuratie
wordt exhaustief getoetst.
