# De gamekeuze wordt de Rounda-donut

Besluit 45 (producteigenaar, 5 aug 2026).

> Je kijkt tegen de zíjkant van de donut aan; dat is het Rounda-logo. Op de
> rand staan de games. Draai je naar links of rechts, dan komt de volgende
> game in beeld. Omdat je op een computer niet veegt, staan er links en rechts
> pijltjes waarop je kunt klikken.

Vervangt het eerdere voorstel "een strip van vier kaartjes naast elkaar". Dat
was een idee van de regie en het vervalt.

## Wat er nu staat

In `frontend/js/views/lobby.mjs` (rond regel 175) staat al een carrousel: één
kaart, een `‹` en een `›`, en vegen met de duim werkt ook. Draaien naar een
speelbare game stuurt `game:update-config`; de serverstand blijft de waarheid.

**De mechaniek is er dus al.** Wat ontbreekt is het beeld: er is geen donut, er
is geen draaiing, en je ziet niet dat er méér games zijn dan die ene kaart.

## Wat het moet worden

Het merkteken van Rounda is een ring — vier segmenten, twee lime, twee donker.
Dat is de donut. Het idee: je kijkt er van opzij tegenaan, en op de rand staan
de games naast elkaar. Draaien brengt de volgende naar voren.

Praktisch betekent dat drie dingen:

1. **De ring is zichtbaar en draait.** Niet een kaart die verspringt, maar een
   beweging die laat zien dát er een rondgang is. De game die vooraan staat is
   gekozen; de vorige en volgende zijn half zichtbaar aan de zijkanten.
2. **De pijlen blijven.** Ze staan er al en de producteigenaar noemt ze
   expliciet: op een computer kun je niet vegen.
3. **Vegen blijft werken.** De bestaande veegdrempel (40 px) en
   `touch-action: pan-y` blijven zoals ze zijn — verticaal scrollen mag nooit
   kapotgaan.

## Grenzen die blijven gelden

**Wat speelbaar is bepaalt dit scherm niet.** `shared/content/game-catalog.mjs`
is de enige bron. Op 4 aug zette deze lijst zelf een game op speelbaar terwijl
de contentbron hem niet kon bouwen — starten liet de room stil in COUNTDOWN
staan. Die les staat in de code als commentaar en die blijft.

**Niet-speelbare games blijven zichtbaar met "binnenkort".** Ze mogen wel op de
rand staan; ze zijn alleen niet te kiezen.

**Het ruimtebudget.** De lobby is het enige scherm dat bewust niet in één
viewport past, maar alles wat je nodig hebt staat boven de vouw. Een donut die
de startknop naar beneden duwt, is geen verbetering. Meet met
`node tools/meet.mjs past lobby`.

**Beweging is niet voor iedereen.** Bij `prefers-reduced-motion` hoort de
draaiing te vervallen — dan verspringt de kaart gewoon, zoals nu. Dat is
dezelfde regel die al voor de ranglijst geldt.

## Wat dit niet is

Geen 3D, geen bibliotheek, geen physics. Een ring met vier posities en een
overgang ertussen.

## Nog te beslissen bij de bouw

Wat er gebeurt met meer dan vier games. De catalogus telt er nu vier, maar
hoger/lager en hoofdsteden komen erbij (besluit 49) en dan zijn het er zes. Een
ring met zes posities kan, maar de segmenten van het merkteken zijn er vier —
leg vast wat je kiest.
