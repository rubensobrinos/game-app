# `frontend/` — de app op je telefoon

Geen framework, geen bouwstap. De browser laadt `index.html` en de modules
eronder rechtstreeks.

## Wat waar staat

| Map/bestand | Waarover |
| --- | --- |
| `index.html` | de enige pagina; laadt de stylesheets in een vaste volgorde |
| `js/app.mjs` | kiest op basis van de URL welk scherm er komt |
| [`js/session/`](js/session/) | de spil: ontvangt serverevents en verdeelt ze over de schermen |
| [`js/views/`](js/views/) | de schermen zelf — home, lobby, spel, uitslag, podium |
| [`js/transport/`](js/transport/) | de echte verbinding: REST plus websocket |
| [`js/mock/`](js/mock/) | dezelfde keten nagebootst in de browser, voor solo en demo |
| `css/` | zie hieronder |
| `locales/` | nl, en, es — drie bestanden met dezelfde sleutels |

## De mock is geen testdubbel

`js/mock/` is een **tweede implementatie van het protocol**. Zonder server
speelbaar zijn is een productregel, geen testgemak: "Alleen spelen" draait
erop, en `?mock=1` laat de hele keten zien zonder backend.

Dat betekent ook: wijzig je het gedrag van de server, dan hoort de mock mee te
veranderen. Een echte bug is hier ooit maanden onzichtbaar gebleven omdat de
mock het correcter deed dan de server, en alle tests bleven groen.

## De stylesheets laden in volgorde

`index.html` somt ze op en die volgorde is dragend. `tokens.css` eerst, dan de
reset, dan layout en de schermen, en als laatste de 1c-laag. `1c-overrides.css`
is chronologisch opgebouwd — bijschrijven doe je aan het eind, nooit ertussen.
De kop van dat bestand legt uit waarom.

Wijzig je iets in `css/`, hoog dan de `?v=1cXX` in `index.html` op. Anders
serveert een browser die de vorige versie in zijn cache heeft de oude stijl bij
de nieuwe code.

## Het ruimtebudget

Elk scherm moet passen binnen **390 × 650** — wat Safari van een iPhone 13
overlaat. Meet met `node tools/meet.mjs past <scherm>`.

Eén uitzondering, met opzet: de lobby past niet. Daar geldt "alles wat je nodig
hebt boven de vouw"; de opengeklapte warm-up mag eronder.
