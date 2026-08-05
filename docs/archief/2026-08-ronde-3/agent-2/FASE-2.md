# Agent 2 — fase 2: home scrolt 13 px

**Pas beginnen als je fase 1 (het continentfilter) hebt opgeleverd.**

## Wat er aan de hand is

Home past precies binnen 390×650. Zodra de foutmelding bij een verkeerde
gamecode verschijnt, wordt de pagina 663 px en moet je scrollen. Een eerdere
agent meldde het en liet het bewust staan.

De regel verschijnt precies waar de gebruiker al kijkt, dus het is geen ramp —
maar 13 px terugwinnen kan zonder iets weg te halen.

## Meten

```
node tools/meet.mjs past home
```

Met én zonder zichtbare fout. Het script zegt PAST / PAST NIET en noemt wat er
onder de vouw valt. Referentie 390×650: dat is wat Safari van een iPhone 13
overlaat, niet de volle 844.

## De regel die hier geldt

**Ruimte terugwinnen mag nooit betekenen dat er iets verdwijnt.** De
foutmelding moet zichtbaar en leesbaar blijven — hij is de reden dat iemand
weet dat zijn code fout is. Zoek de 13 px in marges, niet in inhoud.

Een oplossing die de melding korter, kleiner of onzichtbaarder maakt, is geen
oplossing.
