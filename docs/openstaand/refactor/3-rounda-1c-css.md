# 3 — `rounda-1c.css` opsplitsen (1912 regels)

**Geen enkele visuele verandering.** Een verhuizing, geen herontwerp.

## Waarom

Dit is het grootste bestand van de voorkant en het groeide per feedbackronde:
je ziet er secties in als "REVIEWFIXES", "FEEDBACKRONDE 4 aug",
"MOCK-REVIEWFIXES". Elke nieuwe UI-klus moet hier zijn, en dat kan maar één
persoon tegelijk.

## Wat je opsplitst

Het bestand heeft al zeventien eigen secties met kopregels. Die zijn de naad —
maar ze zijn chronologisch geordend (per feedbackronde), niet thematisch. De
opdracht is ze **per scherm of onderdeel** te hergroeperen:

| Nieuw bestand | Wat erin hoort |
| --- | --- |
| `1c-merk.css` | het rad, de wordmark, koppen |
| `1c-chrome.css` | de headerbalk, code, QR, delen, hostmenu |
| `1c-home.css` | starthero, code-invoer |
| `1c-lobby.css` | spelerslijst, hostinstellingen, gamekeuze |
| `1c-spel.css` | vraag, vlag, antwoordpillen, aftellen |
| `1c-uitslag.css` | scherm 5: reveal, tussenstand, podium |
| `1c-licht.css` | het lichte thema |

Bepaal zelf wat klopt als je het bestand leest; dit is de verwachting, geen
voorschrift.

**Let op de volgorde.** De secties "REVIEWFIXES" en "FEEDBACKRONDE" bevatten
vaak overschrijvingen van regels die eerder in het bestand staan. Verplaats je
zo'n regel naar een ander bestand, dan kan hij in de nieuwe volgorde eerder of
later landen — en dan verandert het resultaat. Dat is exact wat je moet
bewijzen dat niet gebeurt.

## De harde eis

De berekende stijlen zijn vóór en ná **identiek**, op alle schermen, in beide
thema's. "Ziet er hetzelfde uit" is geen oplevering.

`tools/meet.mjs` kent de weg naar elk scherm (`home`, `lobby`, `aftellen`,
`spel`, `reveal`, `podium`, `hostmenu`). Schrijf een wegwerpscript dat per
scherm voor élk element de volledige `getComputedStyle` wegschrijft, draai dat
vóór je begint en na afloop opnieuw. De diff moet leeg zijn. Zet in je
oplevering welke schermen, hoeveel elementen, en dat de diff leeg was — ruim
het script daarna op.

## Praktisch

- `frontend/index.html` laadt de stylesheets met een cachebust (`?v=1cXX`).
  De nieuwe bestanden horen daar in de **juiste volgorde** bij, en de bust
  gaat omhoog.
- `contrast-1c.test.mjs` leest `rounda-1c.css` rechtstreeks op pad, inclusief
  een volledigheidscontrole die élke lime-tekstregel afloopt. Die test moet
  groen blijven én even streng blijven.
- Maximaal 15 bestanden per commit (`devkit check-autonomy`).

## Niet doen

- Kleuren, maten of afstanden wijzigen. Ook niet "even opschonen".
- Ongebruikte regels weggooien: je kunt niet zien welke regel een scherm
  gebruikt dat vandaag niet in de flow zit. Meld ze.
- `base.css` of `components.css` aanraken — dat is opdracht 1.

## Prompt

> Je werkt in de repo `game-app` (Rounda). Controleer dat `npm test` draait. Lees `docs/openstaand/refactor/3-rounda-1c-css.md` en voer dat uit: `frontend/css/rounda-1c.css` opsplitsen per scherm, zonder één visuele verandering. De harde eis staat in het document — de berekende stijlen moeten vóór en ná identiek zijn op alle schermen in beide thema's, gemeten met een eigen wegwerpscript naast `tools/meet.mjs`, en die uitkomst wil ik in je oplevering zien. Blijf uit `base.css` en `components.css`. Nederlands. Er werken meer agents in deze map: stage en commit alleen je eigen bestanden, nooit `git add -A`. `devkit check-autonomy --staged` vóór elke commit. Niet pushen. Stop als je klaar bent en lever op.
