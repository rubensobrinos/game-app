# 14 — `1c-overrides.css` platslaan (1609 regels)

**Dit is de enige refactoropdracht die gedrag mág veranderen** — en precies
daarom de enige met een harde visuele controle.

## Waarom dit apart staat

`1c-overrides.css` is de chronologische staart van de 1c-laag: het lichte
thema, gevolgd door elke review- en feedbackronde die daarna kwam. Elke ronde
overschrijft bewust regels uit een eerdere. Daardoor staat dezelfde selector
soms twee keer in het bestand, en wint de tweede.

Splitsen per scherm — home, lobby, spel, uitslag — is gemeten en **botst op
zeven plekken**: dan wisselen die twee van volgorde en wint ineens de andere.

| Selector | Regels |
| --- | --- |
| `.lobby-start` | 119 vs 942, en 321 vs 942 |
| `.lobby-gamearrow`, `.lobby-settings-more`, `.lobby-settings-morebody` | 695 vs 942 |
| `.session-hostbar-kick` | 695 vs 1240 |
| `@media (prefers-reduced-motion: no-preference)` | 199, 321, 695 vs 778 |

Zolang die zeven bestaan, is het bestand niet splitsbaar. Deze opdracht ruimt
ze op; opdracht 3 (splitsen per scherm) kan daarna alsnog.

## Wat je doet

**Per selector nog één plek.** Staat een eigenschap twee keer, dan verwerk je
de latere waarde in de eerdere regel en verwijder je de tweede. Dat is
letterlijk hetzelfde resultaat, maar dan zonder dat de volgorde het bepaalt.

Begin bij de zeven hierboven — dat zijn de blokkerende. Kom je onderweg meer
duplicaten tegen, ruim die dan ook op, maar **alleen als je kunt aantonen dat
het resultaat gelijk blijft**.

Let op bij de media-queries: `prefers-reduced-motion` staat vier keer in het
bestand. Die mogen samen, maar controleer of de regels erbinnen elkaar niet
overschrijven — anders verplaats je het probleem alleen naar binnen.

## De harde controle

Voor élke wijziging: de berekende stijlen zijn vóór en ná identiek, op alle
zeven schermen (`home`, `lobby`, `aftellen`, `spel`, `reveal`, `podium`,
`hostmenu`), in beide thema's.

Anders dan bij de eerdere CSS-opdrachten kun je hier **niet** met een
concatenatie-vergelijking volstaan: je verandert de inhoud, niet alleen de
plaats. `tools/meet.mjs` kent de weg naar elk scherm; schrijf daarnaast een
wegwerpscript dat per scherm voor elk element de volledige `getComputedStyle`
wegschrijft. Draai dat vóór je begint en na elke stap. De diff moet leeg zijn.

Zet in je oplevering: welke schermen, hoeveel elementen, hoeveel duplicaten
opgeruimd, en dat de diff leeg was.

## Niet doen

- Kleuren, maten of afstanden "verbeteren" terwijl je toch bezig bent.
- Ongebruikte regels weggooien. Je kunt niet zien welke regel een scherm
  gebruikt dat vandaag niet in de flow zit — meld ze.
- Het bestand alsnog splitsen. Dat is opdracht 3 en komt hierna.

## Prompt

> Je werkt in de repo `game-app` (Rounda). Controleer dat `npm test` draait. Lees `docs/openstaand/refactor/14-overrides-platslaan.md` en voer dat uit: in `frontend/css/1c-overrides.css` de dubbele regels platslaan zodat er per selector nog één plek is, te beginnen bij de zeven die in het document staan. Dit is de enige refactor die gedrag mág veranderen, en dus de enige met een harde visuele controle: de berekende stijlen moeten vóór en ná identiek zijn op alle zeven schermen in beide thema's, gemeten met een eigen wegwerpscript naast `tools/meet.mjs`. Een concatenatie-vergelijking volstaat hier niet — je verandert de inhoud, niet alleen de plaats. Zet in je oplevering welke schermen, hoeveel elementen, hoeveel duplicaten en dat de diff leeg was. Splits het bestand niet; dat is een andere opdracht. Blijf uit de andere CSS-bestanden. Nederlands. Er werken meer agents in deze map: stage en commit alleen je eigen bestanden, nooit `git add -A`. Draait er een rode test die niet van jou is, dan telt die niet mee. `devkit check-autonomy --staged` vóór elke commit. Niet pushen. Stop als je klaar bent en lever op.
