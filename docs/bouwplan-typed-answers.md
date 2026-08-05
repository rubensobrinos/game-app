# Bouwplan — antwoordmodus Kiezen / Mix / Typen

**Besluiten 40 en 40D**, producteigenaar 3 aug 2026. De spec staat in
`docs/frontend-plan/FEATURE-typed-answers.md` en is compleet genoeg om te
bouwen. Dit plan zegt wat die spec openlaat, en waar het werk werkelijk zit.
**Eigenaar:** regie. **Peildatum:** 5 aug 2026.

In de lobby staan Mix en Typen zichtbaar maar uitgeschakeld ("binnenkort").
Dat is de enige plek waar de gebruiker deze feature vandaag tegenkomt.

---

## Eén productbesluit moet eerst

De spec noemt het en laat het open; het is **de** vraag van deze feature:

> Intypen is moeilijker dan kiezen. Moet het ook meer opleveren?

Vandaag is de scoring: 100 punten voor goed, plus maximaal 100 snelheidsbonus
naar rato van de resterende tijd (`server/rules/scoring.js`). Dat is precies
het mechanisme dat botst met typen. Op een telefoon kost "België" intikken
enkele seconden — de snelheidsbonus straft dus niet je kennis maar je duimen,
en in **Mix** zitten beide vormen in dezelfde partij, waar de scores direct
vergelijkbaar moeten zijn.

Drie mogelijke antwoorden, geen ervan is technisch moeilijk:

| Optie | Wat het doet | Gevolg |
| --- | --- | --- |
| **A** Zelfde score | Niets veranderen | Typen is strikt slechter; in Mix zijn typrondes gratis puntverlies |
| **B** Hogere basis bij typen | Bijv. 150 in plaats van 100 | Beloont de moeilijkere vorm; Mix blijft eerlijk |
| **C** Bonus per vorm ijken | Snelheidsbonus telt bij typen vanaf een later startpunt | Het eerlijkst, het meeste uitzoekwerk |

**Advies regie: B.** Eén getal, uit te leggen aan spelers ("intypen levert meer
op"), en het verandert niets aan het bestaande bonusmechanisme. C is netter op
papier maar vraagt meetwerk uit een pilot die nog niet gedraaid is.

Dit hoort in DECISIONS.md met een eigen nummer voordat er een regel code valt.

## Wat de spec goed heeft, en wat eronder ligt

De spec zet één anker dat alles simpel houdt: **het antwoord blijft een iso2
over de lijn**, nooit vrije tekst die de server moet raden. Daardoor is dit
geen tekstverwerkingsfeature maar een invoerfeature.

Wat daar wél uit volgt, en niet in de spec staat:

1. **De gesloten optieverzameling gaat open.** Vandaag valideert de server een
   antwoord tegen de vier `optionIso2s` van de ronde. Bij typen is elk land uit
   de pool geldig. Dat raakt `assertRoundShape`, de `INVALID_OPTION`-tak en de
   rondegeneratie — de vier opties blijven bestaan (Mix heeft ze nodig), maar
   ze zijn niet langer de grens van wat mag.
2. **De antwoordverdeling in de reveal breekt.** "9 van de 14 zaten goed" blijft
   werken. Maar de balkjes per antwoord gaan van vier bakjes naar
   tweehonderddertig. Voorstel: in typmodus alleen goed/fout tonen, plus de
   twee meestgekozen foute landen. Zonder dat wordt de reveal een lijst van
   enen.
3. **Mix moet voorspelbaar eerlijk zijn**, zegt besluit 40: bij tien vragen vijf
   en vijf, willekeurige volgorde, nooit meer dan twee dezelfde achter elkaar.
   Bouw dat als een **vooraf berekende reeks bij matchstart**, niet als een
   muntworp per ronde. Precies dat ging mis bij echt/nep: per ronde beslissen
   maakte van de halfom-garantie een kansspel, en dat is later hersteld door de
   balans uit de al gebruikte vragen af te leiden. Dezelfde les geldt hier.

## Waar het werk zit

| Stap | Wat | Duur |
| --- | --- | --- |
| 1 | Besluit over de score vastleggen (zie boven) | producteigenaar |
| 2 | `answerMode` in de configuratie: typedef, validatie, defaults, fixtures. Reken op 6+ fixturebestanden — de sleutellijst wordt exhaustief getoetst | 1 dag |
| 3 | Servervalidatie: elk pool-land geldig in typmodus; `assertRoundShape` mee | 1 dag |
| 4 | Mixreeks bij matchstart, met tests op de twee regels (5/5, nooit drie achter elkaar) | halve dag |
| 5 | Invoercomponent: tekstveld, prefixfilter op `country-names.mjs`, diakritics-ongevoelig, kiezen met tik of enter. Geen vrije tekst verzendbaar | 1,5 dag |
| 6 | Scoring per vorm (het besluit uit stap 1) | halve dag |
| 7 | Reveal in typmodus | halve dag |
| 8 | Mock, zodat het solo te demonstreren is | halve dag |
| 9 | Lobby: Mix en Typen inschakelen, BINNENKORT weg | uur |

**Zes tot zeven dagen** na het productbesluit.

## Twee valkuilen

**De suggestielijst is een toetsenbord op een telefoon.** Vier suggesties
tegelijk, niet meer — het toetsenbord eet al de helft van het scherm, en het
spelscherm is met moeite binnen één viewport gekregen. Meet met
`node tools/meet.mjs past spel` mét geopend toetsenbord voordat je dit af
noemt.

**De suggesties staan in de vraagtaal van de match, niet in de UI-taal van de
speler.** Dat is bewust en consistent met hoe vragen nu werken — maar het botst
optisch met besluit 41, waar spelersnamen juist wél in je eigen taal komen. Als
dat verwarrend blijkt, is het een productvraag, geen bug.

## Afbakening, ongewijzigd uit de spec

Per match één modus, niet per speler. Geen fuzzy matching in v1: alleen prefix
en diakritics-ongevoelig. Wie "Belgie" typt vindt België; wie "Belgien" typt,
niet.
