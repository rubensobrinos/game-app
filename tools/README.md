# `tools/` — meetgereedschap

Losse scripts die je met de hand draait. **Ze draaien niet mee in `npm test`**:
die suite mag geen browser nodig hebben.

| Script | Waarvoor |
| --- | --- |
| `meet.mjs` | past een scherm op een telefoon, en zo niet: welke doos eet de ruimte op |

```bash
node tools/meet.mjs past spel       # PAST / PAST NIET op 390x650
node tools/meet.mjs boxen lobby     # elke doos met top, hoogte, marge
node tools/meet.mjs timer spel      # wat de aftelling werkelijk doet
```

Schermen: `home`, `lobby`, `aftellen`, `spel`, `reveal`, `podium`, `hostmenu`.
Omgeving: `BASIS` (standaard `http://localhost:3992`), `HOOGTE`, `MOCK=0` voor
de echte server in plaats van de mocktransport.

## Wat hier hoort en wat niet

Hier hoort gereedschap dat *over* de app iets vaststelt: meten, tellen,
vergelijken. Code die de app zelf nodig heeft om te draaien hoort in `server/`,
`frontend/` of `shared/` — ook als hij maar één keer per week gebruikt wordt.

Een script dat je voor één onderzoek schrijft, hoort hier niet: gebruik het,
lever de uitkomst op, en gooi het weg. Een meetscript dat blijft, verdient een
regel in de tabel hierboven.

## De referentiemaat

390 × 650. Dat is wat Safari van een iPhone 13 overlaat na de adresbalk, niet
de volle 844. Meten op 844 geeft een te mild antwoord.
