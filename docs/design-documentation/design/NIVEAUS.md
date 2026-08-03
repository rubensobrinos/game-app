# Niveaus — de schaal waarop elk gebied zichzelf meet

Eén schaal voor alle vijf gebieden, zodat "niveau 2" overal hetzelfde betekent.
Staat hier los, niet in elke `PROGRESS.md` herhaald.

| Niveau | Betekenis | Vraag die je stelt |
|---|---|---|
| **0** | Bestaat niet, of bestaat maar is onbruikbaar | Moet dit nog gebouwd worden? |
| **1** | Het staat er — werkt, kaal, basiskleur uit de tokens | Kun je de taak afmaken zonder vast te lopen? |
| **2** | Het is ontworpen — compositie, hiërarchie, ruimte, en álle staten zijn vormgegeven | Ziet het eruit alsof iemand het bedoeld heeft? |
| **3** | Het leeft — beweging, geluid, reactie op gebeurtenissen | Voelt het als een game in plaats van een formulier? |
| **⏸** | On hold — bestaat niet en is nu ook niet te bouwen | Wacht dit op een besluit of op iemand anders? |

### Waarom ⏸ geen niveau 0 is

Dezelfde reden waarom 0 en 1 uit elkaar staan: het zijn verschillende
opdrachten. Een 0 zegt "hier moet iemand aan werken". Een ⏸ zegt "hier kán
niemand aan werken" — het wacht op een producteigenaarsbesluit, op een
ontwerper, of op een ander thema.

Zet je die samen, dan lijkt de achterstand groter dan hij is en verdwijnt de
enige informatie die ertoe doet: wie moet er iets doen om dit los te trekken.

Een ⏸ is alleen geldig **mét de blokkade erbij**. "On hold" zonder te zeggen
waarop is een 0 met een mooier gezicht. En zodra de blokkade weg is, gaat de
regel terug naar 0 — niet direct naar 1.

Het teken sluit aan bij de legenda die de `*-PROGRESS.md`-bestanden onder
`docs/*-plan/` al gebruiken (`⏸️ bewust uitgesteld`).

## Vier regels bij het invullen

1. **Een niveau geldt pas als het volledig gehaald is.** Half niveau 2 blijft
   een 1. Anders schuift alles binnen een maand naar 2 zonder dat er iets is
   veranderd.
2. **0 en 1 zijn verschillende opdrachten.** 0 betekent bouwen, 1 betekent
   verbeteren. Die samenvoegen kost je precies het onderscheid dat de
   werkvolgorde bepaalt.
3. **Niet naar beneden liegen.** Waar we goed zijn — toetsenbordtoegang,
   foutmeldingen, anti-afkijk — hoort een 2 te staan. Valse bescheidenheid
   verstopt waar we sterk staan net zo goed als opschepperij verstopt waar we
   zwak staan.
4. **De criteria komen uit de documenten, niet uit een gevoel.**
   `11-DESIGN-QA-CHECKLIST.md` levert de checks, `04` de acceptatiecriteria per
   scherm, `08` §10 de definition of done. Wie een niveau opschrijft, noemt
   erbij welk criterium nog niet gehaald is.

## Het format van een PROGRESS.md

De vijf bestanden hebben elk een eigen invalshoek — schermen op volgorde van de
spelersreis, taal met de huidige tekst naast de voorgeschreven — maar ze delen
een vaste vorm. Wijk daar niet van af zonder overleg: het overzicht op
`docs/progress/` telt de vijf bestanden tegen elkaar, en dan moet een regel in
gebied 4 hetzelfde gewicht hebben als een regel in gebied 1.

1. **Kopblok:** eigenaar, documenten, criteria uit, schaal, bijgewerkt-datum.
2. **Eén inleidende alinea** die zegt hoe dít gebied zichzelf meet.
3. **Twee of drie tabellen**, elk met een kolom `Niveau` met een cijfer 0–3.
   Naast `Niveau` maximaal twee andere kolommen: waaróver de regel gaat, en hoe
   het ervoor staat.
4. **Telling** — een tabel met de aantallen per niveau.
5. **Slotparagraaf** met de conclusie die uit de tabel volgt.

### Eén regel = één onderdeel dat af kan zijn

Dit is de regel die het vaakst misgaat. De granulariteit bepaalt de telling, en
de telling bepaalt hoe groot een gebied lijkt op de hoofdpagina. Splits je een
gebied per documentparagraaf op, dan krijg je vijftig regels waar een ander
gebied er twintig heeft — en dan lijkt dat gebied ineens de helft van al het
werk, terwijl er niets veranderd is.

Vuistregel: **vijftien tot vijfentwintig regels per gebied.** Kom je daar ruim
overheen, dan meet je onderdelen van onderdelen. Zit je er ruim onder, dan zijn
je regels te grof om werk aan op te hangen.

Details die niet aan een niveau hangen — een correctie, een afhankelijkheid, een
naad met een ander gebied — horen in de slotparagraaf, niet als extra tabelrij.

## Waarom niet één cijfer per gebied

Een gebied is nooit gelijkmatig. De schermen staan gemiddeld op 1, maar de
naamflow is een 2 en de countdown een 0 — en dat gemiddelde van "1" zou beide
verbergen. Daarom staat het niveau per onderdeel, en is de samenvatting een
telling, geen gemiddelde.
