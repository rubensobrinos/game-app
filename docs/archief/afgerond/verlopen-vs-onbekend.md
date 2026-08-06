# Een verlopen game is iets anders dan een verkeerde code

Besluit 48 (producteigenaar, 6 aug 2026): het onderscheid echt maken.

## Wat er nu gebeurt

Drie verschillende dingen leveren dezelfde melding op:

| Wat er werkelijk aan de hand is | Wat de speler leest |
| --- | --- |
| Je typte een code die nooit heeft bestaan | Deze game bestaat niet (meer) |
| De game bestond, maar is verlopen | Deze game bestaat niet (meer) |
| Je verbinding is weg | Deze game bestaat niet (meer) |

Dat derde geval is het ergste: een host die even geen bereik heeft, leest dat
zijn game vernietigd is. Dit is precies de melding die de producteigenaar
kreeg toen hij zijn hostpagina ververste.

Het protocol weet zelf al dat dit onopgelost is. In `error-codes.mjs` staat
letterlijk: *"TTL-verval (4 uur) hergebruikt dit impliciet `GAME_NOT_FOUND`, of
komt er een aparte code? Onbeslist."* Nu is het beslist.

## Waarom je er niet omheen kunt met slim raden

Als een room verloopt, verdwijnen zijn sleutels gewoon uit Redis. Er blijft
niets achter. Op het moment dat iemand de code intypt, is er dus geen enkel
verschil tussen "heeft nooit bestaan" en "is opgeruimd" — beide zijn simpelweg
afwezig.

Er moet dus iets achterblijven. Dat is een bewuste kostenpost en de reden dat
dit een besluit vroeg.

## De aanpak

**Een grafsteen.** Bij het aanmaken van een room wordt naast de gewone
vindsleutel een tweede, veel langer levende sleutel geschreven die alleen
zegt: *deze code is ooit gebruikt.* Geen spelersnamen, geen scores, geen
inhoud — alleen het feit.

| | Nu | Erbij |
| --- | --- | --- |
| Sleutel | `room:code:{code}` | `room:used:{code}` |
| Leeft | 4 uur, verlengd bij activiteit | vast, bijvoorbeeld 7 dagen |
| Inhoud | roomId | niets, of het tijdstip van aanmaken |

Bij `GAME_NOT_FOUND` kijkt de server dan één keer extra:

- vindsleutel weg **én** grafsteen weg → de code heeft nooit bestaan
- vindsleutel weg **maar** grafsteen er nog → de game is afgelopen

Dat vraagt één nieuwe foutcode (bijvoorbeeld `GAME_EXPIRED`), één sleutel in
`redis-keys.js`, één schrijfactie bij het aanmaken en één opzoeking op het
foutpad. De in-memory store krijgt hetzelfde gedrag, anders lopen de twee
adapters uiteen en dat is eerder al fout gegaan.

**Hoe lang de grafsteen leeft, is een keuze.** Zeven dagen is een redelijk
begin: lang genoeg dat "ik speelde gisteren nog" klopt, kort genoeg dat het
niets kost. Leg de keuze vast waar je hem maakt.

## Het derde geval: geen verbinding

Dat is geen serverprobleem. Als de socket wegvalt, komt er helemaal geen
antwoord — de client vult zelf `GAME_NOT_FOUND` in. Dat moet uit elkaar
getrokken worden aan de clientkant: een mislukt verzoek is iets anders dan een
server die netjes zegt dat de game niet bestaat.

De juiste boodschappen:

| Situatie | Wat de speler leest |
| --- | --- |
| Code bestaat niet | Deze code klopt niet. Kijk je hem na? |
| Game is verlopen | Deze game is afgelopen |
| Geen verbinding | Geen verbinding. We proberen het opnieuw… |

Alleen de derde is een tijdelijke toestand, en alleen daar hoort een
herhaalpoging bij — die zit er sinds kort al in (drie pogingen met oplopende
wachttijd).

## Niet doen

- De grafsteen vullen met roominhoud. Het enige wat je bewaart is dát de code
  gebruikt is; alles daarbovenop is een privacyvraag die niemand gesteld heeft.
- De room-TTL verlengen om dit op te lossen. Dat is een andere knop en die is
  net goed gezet.
