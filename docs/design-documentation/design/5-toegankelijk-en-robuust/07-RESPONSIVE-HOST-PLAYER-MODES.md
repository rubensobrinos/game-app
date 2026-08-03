# 07 — Responsive Host- en Spelermodes

## 1. Hoofdprincipe

> Iedere telefoon kan de volledige game dragen; extra schermruimte verandert de compositie en sociale rijkdom, niet de kernfunctionaliteit.

Responsive ontwerp is daarom niet alleen “dezelfde pagina smaller”, maar een combinatie van rol, apparaat en kijkafstand.

## 2. Contextmatrix

| Context | Kijkafstand | Input | Prioriteit |
|---|---|---|---|
| Spelertelefoon | handafstand | touch | vraag, antwoord, persoonlijke feedback |
| Hosttelefoon | handafstand | touch | QR/code, starten, beheer, status |
| Hosttablet | tafel/hand | touch | lobby + grotere spelersview |
| Hostdesktop/laptop | tafel/kamer | muis/keyboard | podium, beheer, groepsinformatie |
| Tv/projectie | kamerafstand | indirect via host | grote code, groepsritme, leaderboard, podium |

## 3. Breakpoints als gedrag, niet alleen pixels

Exacte waarden volgen implementatie. Gebruik content-driven omslagpunten.

### Compact

- één kolom;
- sticky primaire actie;
- bottom sheets;
- beperkte secundaire metadata;
- vraag en antwoorden geoptimaliseerd voor viewport.

### Medium

- twee zones mogelijk;
- QR en spelerspreview naast elkaar indien leesbaar;
- side panel voor voorkeuren;
- ruimere leaderboardweergave.

### Large/stage

- podiumcompositie;
- zeer grote code/QR;
- spelerswand;
- antwoordverdeling en sociale headline centraal;
- controls kunnen discreet in hostbar staan.

## 4. Spelertelefoon

### Algemene regels

- geen permanente desktopnavigatie;
- safe-area padding;
- belangrijkste controls binnen duimbereik waar passend;
- antwoordtargets minimaal circa 52–56 px;
- vraagcontext blijft zichtbaar bij keyboard of sheet;
- lange vlag/afbeelding schaalt zonder antwoorden weg te drukken.

### Actieve vraag

- topstatus compact;
- timer horizontaal;
- afbeelding/vlag flexibel;
- antwoorden in scanbare stack of 2×2 alleen wanneer labels en touchruimte dat toelaten;
- status na submit in dezelfde antwoordzone.

## 5. Hosttelefoon

De host is tegelijk deelnemer of organisator, afhankelijk van productmodus. In beide gevallen blijft hostbeheer bereikbaar zonder de game te overschaduwen.

### Lobby

- QR-card bovenaan;
- code permanent;
- teller;
- compacte spelerspreview;
- sticky startbutton;
- beheer via bottom sheet.

### Tijdens game

- ronde, timer, antwoordcount;
- primaire flowcontrol;
- pauze/noodbeheer;
- geen overvolle groepsgrafieken als dit primaire taak belemmert.

## 6. Hosttablet

- QR en spelerslijst naast elkaar;
- grotere namen/grid;
- startactie duidelijk onder of over volle breedte;
- tijdens reveal kunnen groepsstatistiek en controls naast elkaar.

## 7. Desktop/laptop als podium

### Lobby

- linker zone: QR, code, URL;
- rechter zone: spelersteller en levende spelerswand;
- startactie groot maar niet over QR;
- code leesbaar op afstand;
- geluid/mute zichtbaar.

### Vraag

Twee mogelijke modi:

1. **volledig podium:** vraag, media, antwoordstatus zonder individuele antwoorden;
2. **hostconsole + podium:** console op hostapparaat, aparte cast/view voor publiek.

Productarchitectuur bepaalt welke haalbaar is. De visuele specificatie ondersteunt beide.

### Reveal

- antwoordverdeling;
- correct antwoord;
- sociale headline;
- leaderboard met rank movement;
- geen persoonlijke geheime data.

## 8. Tv/projectie

- minimale interactieve controls op publiek scherm;
- tekst en code getest op afstand;
- geen kleine bodycopy;
- animatie niet afhankelijk van hoge refresh of perfecte kleurweergave;
- QR met voldoende fysieke grootte en contrast;
- podium blijft begrijpelijk zonder geluid.

## 9. Responsive spelerlijsten

| Aantal | Presentatie |
|---:|---|
| 0 | empty state met uitnodigingsactie |
| 1–8 | ruime chips/rows met identiteit |
| 9–20 | compact grid |
| 21–35 | grid + recente joins |
| 36–100 | totaal, recente joins, scroll/management apart |
| 100+ | geaggregeerde visualisatie, geen permanente volledige namenmuur |

Nieuwe joins mogen bij grote groepen worden gebatcht: `+8 spelers` in plaats van acht geluids- en motionevents.

## 10. Oriëntatie

- portrait is primaire spelerervaring;
- landscape wordt ondersteund maar hoeft niet andere featurehiërarchie te krijgen;
- podium/desktop gebruikt landscape;
- rotatie tijdens actieve vraag behoudt antwoordstate en timer;
- geen reload of reset bij oriëntatiewissel.

## 11. Typografie en kijkafstand

- code en rank gebruiken responsive clamp;
- line length van vraagtekst blijft beheerst;
- spelernaam mag afkappen, volledige naam toegankelijk beschikbaar;
- podiumlabels zijn veel groter dan telefoonlabels;
- cijfers gebruiken tabular nums.

## 12. Inputmodaliteiten

- touch: active feedback en grote targets;
- mouse: hover als enhancement;
- keyboard: logische tabvolgorde, sneltoetsen alleen aanvullend;
- screenreader: stateupdates gedoseerd;
- tv/cast: geen noodzakelijke directe input.

## 13. Contentprioriteit bij ruimtegebrek

Volgorde van behoud:

1. primaire taak en actie;
2. vraag/antwoord of QR/code;
3. kritieke status/timer;
4. persoonlijke score/rank;
5. sociaal bewijs;
6. secundaire acties;
7. decoratie.

Decoratie verdwijnt als eerste, nooit de antwoordbevestiging.
