# Multiplayer-bouwspecificatie

**Specificatieversie:** 0.2.0  
**Bijgewerkt:** 2 augustus 2026  
**Werknaam product:** Game App  
**Beoogde live-omgeving:** `play.aseso.nl`

Deze map bevat het product- en technische contract voor de multiplayer-versie van het
bestaande spelplatform. De documenten zijn bedoeld om een developer — mens of AI — de
MVP te laten bouwen zonder zelf nieuwe kernbeslissingen over frictie, rollen,
spelverloop, opslag of schaalbaarheid te introduceren.

De bestaande singleplayer-app blijft werken. Multiplayer is een aanvullende laag.

## Documenten

| Bestand | Beantwoordt |
| --- | --- |
| [`PRODUCT.md`](PRODUCT.md) | Wat bouwen we, voor wie, en wat nadrukkelijk niet? |
| [`GAME-FLOW.md`](GAME-FLOW.md) | Hoe starten, joinen en spelen mensen, inclusief randgevallen? |
| [`GAME-RULES.md`](GAME-RULES.md) | Hoe werken rondes, punten en de afzonderlijke spelvormen? |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Hoe is het systeem opgebouwd en schaalbaar? |
| [`PROTOCOL.md`](PROTOCOL.md) | Wat is het contract tussen client en server? |
| [`DATA-MODEL.md`](DATA-MODEL.md) | Welke tijdelijke en persistente data bestaan? |
| [`DEPLOYMENT-AND-TESTING.md`](DEPLOYMENT-AND-TESTING.md) | Hoe draaien, beveiligen, testen en releasen we het? |
| [`DECISIONS.md`](DECISIONS.md) | Welke cross-documentkeuzes heeft de producteigenaar bindend bevestigd? |

## Aanbevolen leesvolgorde

1. `PRODUCT.md`
2. `GAME-FLOW.md`
3. `GAME-RULES.md`
4. `ARCHITECTURE.md`
5. `PROTOCOL.md`
6. `DATA-MODEL.md`
7. `DEPLOYMENT-AND-TESTING.md`

## Verhouding tot de bestaande code

De bestaande singleplayer-app — momenteel opgebouwd rond `index.html`, `app.js`,
`style.css`, add-ons zoals `hint.js` en `flaginfo.js`, en datasets in `data/` — blijft
de bron voor:

- landen, vlaggen, hoofdsteden en feiten;
- vlagverhalen en contouren;
- merk- en voetbalclubcontent;
- NL/EN/ES-vertalingen;
- moeilijkheidsgraden;
- bestaande antwoordnormalisatie en aliassen;
- nepvlag- en neplogo-generatie.

Voor multiplayer wordt de gedeelde contentlogica zo georganiseerd dat client en server
dezelfde versie gebruiken. De server blijft autoritair over vraagselectie, correcte
antwoorden, deadlines en punten.

## Bronvolgorde bij tegenstrijdigheden

Bij een inhoudelijke tegenspraak geldt deze volgorde:

1. de harde productregels in `PRODUCT.md`;
2. expliciete spelregels in `GAME-RULES.md`;
3. het wire-contract in `PROTOCOL.md`;
4. het state-contract in `DATA-MODEL.md`;
5. technische implementatiekeuzes in `ARCHITECTURE.md`;
6. deploymentvoorbeelden.

Een voorbeeldconfiguratie mag nooit een productregel veranderen.

## Harde productregel

> Iedere gebruiker kan binnen enkele seconden een game starten of joinen zonder account,
> e-mailadres of andere verplichte registratie. Een speler heeft in de game altijd een
> zichtbare naam, maar zelf een naam invullen is optioneel; anders genereert de server
> er één. Een host heeft geen account nodig en hoeft alleen een spelersnaam te hebben
> wanneer die zelf meespeelt. De volledige game werkt op uitsluitend mobiele telefoons,
> zonder verplicht centraal scherm.

## Wijzigingsdiscipline

Een wijziging aan één document moet worden gecontroleerd op gevolgen voor de andere zes.
Vooral wijzigingen aan rollen, tokens, gamefases, timers, events of opslag mogen nooit
in slechts één bestand worden doorgevoerd.

Nieuwe ideeën die niet nodig zijn voor de kernervaring worden eerst onder
**latere uitbreiding** geplaatst. Een gegenereerde groepsvlag of groepsbadge is zo'n
extra: aantrekkelijk, maar geen voorwaarde voor creëren, joinen, spelen, delen of
rematchen.

Menselijke besluiten die meerdere documenten raken worden centraal vastgelegd in
[`DECISIONS.md`](DECISIONS.md). Dat bestand gaat vóór oudere open-vragenlijsten,
handoffs en realisatieprompts totdat de zeven brondocumenten ermee zijn
gesynchroniseerd.
