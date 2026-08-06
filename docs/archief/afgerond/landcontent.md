# Landcontent: de bijvoeglijke vormen

Besluit 47 (producteigenaar, 6 aug 2026): **zestig landen, niet 230.**

Stap 3 uit [spelersidentiteit.md](../../openstaand/spelersidentiteit.md). Stap 1 en 2 zijn af:
`server/data/identity-render.js` bestaat en werkt, maar er is nog geen enkel
land om te renderen. Dit is dat land-bestand.

## Wat het moet worden

Eén nieuw contentbestand met per land de bijvoeglijke vorm in nl, en en es.
Het formaat staat vast — `identity-render.js` leest het al:

```
'bg': {
  nl: { de: 'Bulgaarse', het: 'Bulgaars' },
  en: 'Bulgarian',
  es: { m: 'búlgaro', f: 'búlgara' },
}
```

- Een **kale string** is een vorm die niet verbuigt (Engels altijd; Spaans
  bijvoorbeeld *canadiense*).
- Een **object** hoort bij een taal waar de vorm van het woordgeslacht
  afhangt: nl `de`/`het`, es `m`/`f`.
- Een ontbrekend land of een ontbrekende sleutel is geen fout: dan valt de
  renderer terug op *"Koe uit Bulgarije"*. Daarom mag dit bestand groeien.

## Welke zestig

De `easy`- en `medium`-schijf in `shared/content/countries.data.mjs` telt er 96;
kies daaruit de zestig bekendste. Herkenbaarheid is het criterium — dit is een
naam die een speler leuk moet vinden, niet een aardrijkskundetoets.

Sleutel op `iso2`, net als de pool.

## Waar je op moet letten

| Taal | Valkuil |
| --- | --- |
| nl | het-woorden krijgen de onverbogen vorm: *Bulgaars Konijn*, niet *Bulgaarse Konijn* |
| es | het bijvoeglijk naamwoord verbuigt én staat áchter het woord: *vaca búlgara*, *pingüino peruano* |
| en | geen verbuiging, maar let op onregelmatige vormen: Netherlands → Dutch, Switzerland → Swiss |

Schrijf liever vijftig landen goed dan zestig half. Een fout bijvoeglijk
naamwoord valt een moedertaalspreker meteen op.

## Niet doen

- `identity-render.js` aanpassen; dat is af.
- `room-lifecycle.mjs` of het protocol aanraken — dat is stap 4 en van iemand
  anders.
- De woordenlijst met dieren uitbreiden; die staat in `name-word-lists.js` en
  is een andere opdracht.
