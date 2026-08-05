# Agent 2 — spelinstellingen

**Lees eerst `../README.md`.** Je raakt de vraagselectie en de lobby; agent 1
zit in het protocol en agent 3 in tests en de soloflow.

`server/rules/` en `server/data/types/` mag je aanraken. Blijf uit
`server/transport/` en `server/protocol/` — daar zit agent 1.

## Ronde 1 — continentfilter (middel, ~1 dag)

Punt 7 uit de productspec: **standaard alle landen wereldwijd, geen
configuratie**. Onder "Meer instellingen" mag een host continenten aan- of
uitzetten. **Geen lijst waarin hij losse landen kiest.**

De standaard is er al; het filter is nieuw.

| Waar | Wat |
| --- | --- |
| `server/data/types/game-configuration.js` | veld voor de gekozen continenten + validatie |
| `server/composition/room-lifecycle.mjs` | default: alle continenten |
| `server/rules/question-selection.js` (`buildCandidatePool`) | de pool filteren |
| `views/lobby.mjs` — "Meer instellingen" | de keuze zelf |

De pool kent zes continenten: Europe, Asia, Africa, North America, South
America, Oceania.

**Het besluit dat de lead al genomen heeft:** "Welke hoort er niet bij" heeft
in zijn continentvariant minstens twee continenten nodig. **Geen harde
ondergrens instellen.** Kiest een host één continent, dan valt die game terug op
de echt-of-nep-logica (`fake_among_real` / `real_among_fake` in
`question-selection.js`) — die heeft geen continenten nodig. Geen foutmelding,
geen beperking op wat de host mag kiezen.

Let op dat "Raad de vlag" met één klein continent te weinig landen kan
overhouden voor vier antwoordopties. `buildCandidatePool` werpt dan een
`RangeError`. Zorg dat dat niet in een stille hang eindigt — zie hoe
`content-source.mjs` dat afvangt sinds §A0.

## Ronde 2 — home scrollt 13 px (klein, ~uur)

Home past precies binnen 390×650. Zodra de foutmelding bij een verkeerde
gamecode verschijnt, wordt de pagina 663 px en moet je scrollen. Een eerdere
agent meldde het en liet het bewust staan.

De regel verschijnt precies waar de gebruiker al kijkt, dus het is geen ramp —
maar 13 px terugwinnen kan zonder iets weg te halen. Meet met
`tools/meet-viewport.mjs <url> home`, met en zonder zichtbare fout.

## Niet doen

- De lobby-layout verbouwen; die is af (ronde 2) en de producteigenaar is er
  tevreden over.
- Individuele landen selecteerbaar maken — dat is expliciet níét gevraagd.
- `server/transport/` of `server/protocol/` aanraken (agent 1).
