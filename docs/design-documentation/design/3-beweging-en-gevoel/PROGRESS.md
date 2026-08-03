# Voortgang — 3. Beweging en gevoel

**Eigenaar:** _nog toe te wijzen_
**Documenten:** `06-MOTION-SOUND-AND-FEEDBACK.md`
**Criteria uit:** `11-DESIGN-QA-CHECKLIST.md` secties F en G · schaal: [`NIVEAUS.md`](../NIVEAUS.md)
**Bijgewerkt:** 3 augustus 2026 · commit `18b2d53`

Dit gebied is geen lijst onderdelen maar een **gebeurteniscatalogus**: `06`
beschrijft vijftien momenten (`E01`–`E15`) waarop het spel hoort te reageren.
De vraag per regel is dus niet "hoe ziet het eruit" maar "vuurt er iets, en
wanneer".

Ook geldt hier een bijzondere rekenregel: **dit gebied *is* niveau 3 voor alle
andere vier.** Een 1 hier betekent dat er íéts van feedback is; een 2 is
choreografie. Dat dit gebied achterloopt is verwacht, niet alarmerend — het is
de laag die pas zin heeft als de schermen eronder staan.

## De vijftien momenten

| # | Moment | Fase | Niveau | Wat er vuurt (of niet) |
|---|---|---|---|---|
| E01 | Knop indrukken | overal | 1 | `:active` geeft een kleine schaalsprong op primary, secondary en gameplay-option. Niet op alle controls, geen haptiek. |
| E02 | Potje maken | landing | 0 | Knop wordt alleen disabled. Geen labelwissel, geen voortgang. |
| E03 | Speler komt binnen | lobby | 0 | Naam verschijnt zonder overgang, teller pulseert niet, geen batching bij bulkjoins. |
| E04 | Countdown | rondestart | 0 | Het scherm bestaat niet. |
| E05 | Antwoordselectie | vraag | 1 | Gekozen optie krijgt direct een accentrand — géén goed/fout, dus anti-afkijk klopt. Geen aparte pressanimatie, geen haptiek. |
| E06 | Antwoord bevestigd | vraag | 1 | Statustekst verschijnt, opties vergrendelen. Geen `Verstuurd ✓` in de component (bewust, `D-021`), andere opties dimmen niet. |
| E07 | Laatste drie seconden | vraag | 0 | Timer verandert niet van uiterlijk of tempo. |
| E08 | Ronde sluit | rondeslot | 1 | Inputs vergrendelen op serverevent. Geen overgangscue. |
| E09 | Reveal correct antwoord | reveal | 1 | Correcte optie krijgt een groene rand, eigen resultaat verschijnt als tekst. Geen opbouw, fout gekozen optie wordt niet gemarkeerd. |
| E10 | Punten tellen | reveal | 1 | Eindwaarde staat direct in de DOM — goed voor toegankelijkheid. Geen oplopende telling. |
| E11 | Rank movement | tussenstand | 0 | Rijen springen naar hun nieuwe plek zonder beweging of `↑2`-notatie. |
| E12 | Sociale headline | reveal | 0 | Bestaat niet. |
| E13 | Streak | reveal | 0 | Bestaat niet. |
| E14 | Podium | eind | 0 | Volledige lijst verschijnt ineens. Geen 3→2→1, geen confetti. |
| E15 | Reconnecting | overal | 1 | Statusbalk verschijnt en verdwijnt. Geen voortgang, geen successcue. |

## Wat er onder die momenten hoort te liggen

| Fundament | Niveau | Stand |
|---|---|---|
| Motion-tokens | 0 | Geen `--motion-fast`/`--base`/`--emphasis`-schaal. Er staan losse `0.12s`- en `0.18s`-waarden verspreid door de CSS. |
| `prefers-reduced-motion` | 0 | Nergens gerespecteerd. |
| Geluidslaag | 0 | Geen assets, geen mixer, geen mute. `O-008` (wie bestuurt geluid) staat nog open. |
| Haptiek | 0 | Geen `navigator.vibrate` bij submit of reveal. |

## Telling

| Niveau | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| Momenten (`E01`–`E15`) | 8 | 7 | 0 | 0 |
| Fundamenten | 4 | 0 | 0 | 0 |

## Volgorde die ik zou aanhouden

De zeven momenten op 1 hebben allemaal al een *functionele* trigger — er
gebeurt iets, het is alleen stil. Die zijn dus goedkoop naar 2 te tillen zodra
de tokens er zijn.

Maar één ding hoort vóór alle andere: **`prefers-reduced-motion` als vaste
regel**. Nu kost dat één mediaquery. Na het eerste echte animatiewerk is het
overal terugbouwen, en `08` §2.4 maakt het geen keuze.
