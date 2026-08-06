# Onderzoek: wat de toppers doen + kritische audit van onze eigen UI

**Door:** regie (Claude)  
**Datum:** 3 augustus 2026  
**Doel:** input voor het ontwerptraject, naast het werk van de ontwerpagent die bewust geen huidige-staatinformatie kreeg.

## Deel 1 — Wat de besten in dit genre doen

### Kahoot — de maatstaf voor “samen in één ruimte”

- Antwoorden hebben een identiteit: kleur + vorm. Dat maakt opties op afstand leesbaar en bespreekbaar.
- Het hostscherm is een podium, geen dashboard. Grote code, muziek, binnenkomende spelers en een teller bouwen spanning op.
- Rituelen en ritme: countdown, timergeluid, reveal, antwoordverdeling en daarna leaderboard.
- Streaks vieren antwoordreeksen tegen lage technische kosten.
- Zwakte: account en voorbereiding; voelt eerder als een les starten dan spontaan spelen.

### Jackbox — de maatstaf voor frictieloos joinen

- Eén scherm, roomcode, naam en één knop.
- Code blijft permanent zichtbaar op het gedeelde scherm.
- Eerste speler/VIP heeft duidelijke rol.
- Wachten is niet dood: lobbyactiviteit en zichtbare binnenkomst.

### Quizizz / Blooket / Gimkit — identiteit en beloning

- Quizizz: persoonlijke feedback, memes, power-ups en rustiger tempo.
- Blooket/Gimkit: karakter en verdienmechanieken maken van quiz een gamewereld.
- Relevante light-versie voor Play Aseso: leuke naamvoorstellen en tijdelijke kleur/avatar per potje zonder accounts.

### skribbl.io / GeoGuessr party — geen drempel

- skribbl.io: hele game in één scherm, join via link, nul uitleg; frictie is belangrijker dan schoonheid.
- GeoGuessr: geografie kan premium, volwassen en werelds ogen.

### Rode draad — professioneel betekent

1. antwoordidentiteit;
2. ritueel per ronde;
3. geluid met aan/uit;
4. binnenkomst als moment;
5. code permanent zichtbaar;
6. streaks en microvieringen;
7. geen dode wachtschermen.

## Deel 2 — Kritische audit van de huidige UI

### Knoppen

1. Vrijwel alles gebruikt dezelfde basismaat, radius en typografische zwaarte. Hierdoor ontbreekt hiërarchie tussen primaire en secundaire acties.
2. Antwoordknoppen zijn het zwakste onderdeel terwijl zij het spel vormen: identieke grijze repen, geen vorm-/kleuridentiteit, geen goede tikfeedback en een stille reveal.
3. States zijn onvolledig. Secondary/gameplay options hebben nauwelijks active-state en hover bestaat niet op touch. Tap-highlight is uitgezet.
4. Loadingstates ontbreken. Na `Snel starten` is er circa een seconde geen goede feedback.
5. Typografie is gelijkgeschakeld. Timer, ronde en code hebben onvoldoende eigen moment.
6. Gradient-inflatie: iedere h1/h2 gebruikt dezelfde paars-blauwe gradient.
7. Emoji als identiteit oogt als placeholder naast echte vlagassets.

### Schermen

| Moment | Toppers | Huidig |
|---|---|---|
| Hostlobby | grote code, muziek, spelers komen zichtbaar binnen | code achter knop, statische/lege rijen, stil |
| Rondestart | countdown en geluid | vraag verschijnt direct |
| Reveal | kleur, geluid, antwoordverdeling | border wordt groen en tekstregel |
| Tussen rondes | bewegend leaderboard | statische top vijf |
| Podium | confetti, 3→2→1, muziek | lijst met emoji-medailles |
| Wachten | activiteit, teller, muziek | alleen wachttekst |

### Wat al goed staat

- focusringen, aria-live en screenreaderaankondigingen;
- tabular nums en ellipsis;
- anti-afkijkprincipe diep in architectuur;
- flow zonder account binnen circa dertig seconden.

## Deel 3 — Waar Play Aseso zich kan onderscheiden

1. Snelste start van het genre: geen account, app of drempel.
2. Wereld-esthetiek in plaats van generieke quiz-esthetiek.
3. Huiskamer/borrel boven klaslokaal.
4. Privacy als feature in NL/EU.
5. Eigen inhoud zoals echt-of-nep met gegenereerde vlaggen.

## Deel 4 — Concrete aanbevelingen

### Nu: klein werk, groot effect

1. antwoordopties met positie-identiteit, pressanimatie en `Verstuurd`;
2. permanente code + QR;
3. active- en loadingstates op alle knoppen;
4. countdown 3–2–1;
5. gradient reserveren voor merknaam.

### Met ontwerptraject

6. volledig stijlsysteem en knophiërarchie;
7. reveal- en leaderboardchoreografie;
8. geluidslaag;
9. tijdelijke speleridentiteit;
10. echte logo- en medailleassets.

### Bewust niet doen

- accounts/economie/puntenwinkel nabouwen;
- confetti op ieder scherm.

## Oorspronkelijke bronverwijzingen

- https://www.builtinchicago.org/articles/jackbox-games-design-party-pack
- https://explore.st-aug.edu/exp/jackbox-tv-join-explained-how-a-simple-code-unlocks-a-world-of-party-games
- https://www.teachfloor.com/blog/blooket-vs-gimkit-vs-kahoot--vs-quizizz
- https://slideswith.com/blog/blooket-vs-kahoot-vs-gimkit-vs-quizizz
- https://transcript.study/blog/kahoot-vs-blooket-vs-quizizz
- https://mobisoftinfotech.com/resources/blog/microinteractions-ui-ux-design-trends-examples
- https://pixune.com/blog/game-ui-design/
- https://support.kahoot.com/hc/en-us/articles/32601683697053-New-Kahoot-features-and-updates
- Eigen schouwing van play.aseso.nl en frontend-CSS.
