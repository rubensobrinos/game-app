# Reactiezinnen: van zes naar vijftig

Besluit 44 (producteigenaar, 5 aug 2026): **minimaal 50 zinnen per taal, nooit
twee tegelijk op het scherm.**

## Wat er nu is

Zes zinnen in `frontend/locales/{nl,en,es}.mjs`, sleutels `headline.*`:

| Sleutel | Wanneer |
| --- | --- |
| `headline.selfSoleCorrect` | jij was de enige met het goede antwoord |
| `headline.everyoneCorrect` | iedereen had het goed |
| `headline.everyoneWrong` | niemand had het goed |
| `headline.misleadingAnswer` | veel spelers kozen hetzelfde foute land |
| `headline.comeback` | iemand klimt meerdere plaatsen |
| `headline.streak` | reeks van n goede antwoorden |

`frontend/js/views/social-headline.mjs` kiest er één per ronde. Bij vijf rondes
zie je in één avond de halve voorraad — daarom deze opdracht.

## Wat je bouwt

**Per situatie meerdere varianten**, zodat dezelfde situatie niet elke keer
dezelfde zin geeft. Mik op acht à tien varianten per situatie; dat brengt je
op ruim vijftig per taal.

De selectielogica in `social-headline.mjs` blijft staan — die bepaalt wélke
situatie het sterkst is. Daar komt alleen een keuze uit de varianten bij.

Twee eisen aan die keuze:

1. **Niet twee keer achter elkaar dezelfde variant** binnen één partij.
2. **Nooit twee zinnen tegelijk** op het scherm. Eén situatie wint, en die
   toont één zin. Dat is besluit 44 en het is niet onderhandelbaar.

## Over de zinnen zelf

Drie talen: nl, en, es. Geen letterlijke vertalingen — een grap die in het
Nederlands werkt, hoeft in het Spaans niet dezelfde te zijn. Toon: het spel is
een feestje met vrienden, niet een examen. Kort genoeg voor één regel op een
telefoon (390 px breed).

`{n}`, `{naam}` en `{country}` zijn de bestaande plaatshouders; gebruik ze
zoals ze er staan. `locales.test.mjs` bewaakt dat de drie talen dezelfde
sleutels hebben — die test moet groen blijven.

## Niet doen

- Het uitslagscherm verbouwen; dat is van iemand anders.
- Twee zinnen tegelijk tonen.
- Een zin die iemand kan kwetsen. Plagen mag, afzeiken niet.
