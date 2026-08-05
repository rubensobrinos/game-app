# Refactor: `base.css` en `components.css` opsplitsen

**Geen enkele visuele verandering.** Dit is een verhuizing, geen herontwerp.

## Waarom

`base.css` is 1367 regels, `components.css` 1054. Samen met `rounda-1c.css`
(1912) is dit de reden dat twee mensen niet tegelijk aan de voorkant kunnen
werken: bijna elke wijziging moet in een van deze drie bestanden zijn.

## Wat je opsplitst

`base.css` doet nu vier dingen door elkaar: de ontwerptokens, een reset,
schermlayout, en losse onderdelen (formulierlabels, het menu). `components.css`
bevat de componentfamilies: knoppen, velden, `gameplay-*`, `scoreboard-*`,
`podium-*`.

Een voor de hand liggende opdeling — maar bepaal zelf wat klopt als je het
bestand leest:

| Nieuw bestand | Inhoud |
| --- | --- |
| `tokens.css` | `:root` en het lichte thema: kleuren, typografie, radii |
| `reset.css` | de reset en de elementbasis |
| `layout.css` | schermen, kolommen, de header |
| `components-*.css` | per familie: knoppen, velden, spel, uitslag, podium |

`rounda-1c.css` blijft deze klus buiten beschouwing — die is van iemand anders.

## De harde eis: bewijs dat er niets verandert

De volgorde van CSS-regels bepaalt het resultaat. Twee regels van plek wisselen
kan iets breken op een scherm dat je die dag niet opent. "Ziet er hetzelfde
uit" is daarom geen oplevering.

Wat wél telt: **de berekende stijlen zijn vóór en ná identiek**, op alle
schermen, in beide thema's.

`tools/meet.mjs` kent de weg naar elk scherm al (`home`, `lobby`, `aftellen`,
`spel`, `reveal`, `podium`, `hostmenu`). Schrijf daarnaast een wegwerpscript dat
per scherm voor élk element de volledige `getComputedStyle` wegschrijft, draai
dat vóór je begint, en na afloop opnieuw. Het verschil moet leeg zijn.

Neem die uitkomst op in je oplevering: welke schermen, hoeveel elementen, en
dat de diff leeg was. Ruim het wegwerpscript daarna op.

## Praktisch

- `frontend/index.html` laadt de stylesheets met een cachebust (`?v=1cXX`).
  Nieuwe bestanden horen daar in de **juiste volgorde** bij, en de bust gaat
  omhoog.
- `contrast-1c.test.mjs` en `contrast.test.mjs` lezen `base.css` en
  `components.css` rechtstreeks op pad. Verhuizen betekent dat die tests
  meeveranderen — ze moeten groen blijven en hun controle behouden.
- `devkit check-autonomy` staat op maximaal 15 bestanden per commit. Dit past
  niet in één keer; splits per stap.

## Niet doen

- Kleuren, maten of afstanden wijzigen. Ook niet "even opschonen".
- `rounda-1c.css` aanraken.
- Ongebruikte regels weggooien. Dat lijkt netjes, maar je kunt niet zien welke
  regel een scherm gebruikt dat vandaag toevallig niet in de flow zit. Meld ze.
