# Agent 3 — fase 2: contrastcontrole op de 1c-kleuren

Fase 1 (de flaky Redis-race) is gemerged. Dank voor de mutatietoets — die
manier van bewijzen is precies wat hier ook nodig is.

## Wat er ontbreekt

`contrast.test.mjs` toetst alleen de kleurtokens in `base.css` en
`components.css`. De hardgecodeerde kleuren in `frontend/css/rounda-1c.css`
vallen buiten élke controle.

Dat is niet theoretisch: een agent ontdekte zelf dat zijn labelkleur op de
magenta revealkaart 4,30:1 haalde waar AA 4,5 eist. Dat werd toevallig gezien,
niet gemeten.

## Wat je bouwt

Breid de controle uit naar `rounda-1c.css`, op **beide** thema's — donker én
licht (`:root[data-theme='light']` overschrijft een deel van de kleuren).

## Hoe je oplevert

**Verwacht dat er meer dan één kleur doorheen zakt.** Lever een lijst van wat
je vindt, met de gemeten verhouding erbij. Wat aantoonbaar fout is repareer je;
wat een bewuste keuze lijkt — een decoratieve rand, een uitgeschakelde knop —
meld je in plaats van het stilletjes bij te stellen.

Een test die groen wordt doordat jij de drempel of de dekking hebt verlaagd, is
geen test. Zoals in fase 1: laat zien dat hij faalt als het fout is.

## Niet doen

- Kleuren veranderen die de producteigenaar zelf heeft gekozen zonder het te
  melden. Het lime-palet en de magenta revealkaart zijn productbesluiten.
- `base.css` of `components.css` verbouwen; die zijn al gedekt.
