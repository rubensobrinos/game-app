# Handoff-principes

Hoe domeinen in dit repo een probleem aan elkaar overdragen. Ontstaan tijdens de
integratiesprints; elk principe heeft een aanleiding uit
[`docs/integration-plan/HANDOFF.md`](integration-plan/HANDOFF.md), waar de
genummerde items zelf staan.

De kern in één zin: **wie een probleem vindt, lost het niet op — hij beschrijft
het zo goed dat de eigenaar het goedkoop kan oplossen.**

## 1. Eénrichtingsverkeer

Integratie en tests vínden fouten; de domeineigenaar herstelt ze. Wie een gat
tegenkomt bouwt er niet omheen en repareert het niet zelf.

Dat voelt traag en is het niet. Elke keer dat een item werd overgedragen in
plaats van omzeild, kwam er een betere oplossing terug dan de vinder had
voorgesteld. INT-16 vroeg om één compare-and-set; er kwam een dubbele terug, plus
een `RangeError` voor contractschendingen — een onderscheid tussen racefout en
programmeerfout dat de indiener niet had gemaakt.

**Uitzondering:** triviale interop (een ontbrekende export, een ESM/CJS-import,
een aanroep die met een gewijzigde signatuur mee moet). Die mag je zelf doen,
mits je het meldt.

## 2. Een omweg is duurder dan een blokkade

Een workaround verbergt het probleem precies zolang tot het duur is. Twee
voorbeelden waarin dat is nagelaten en dat goed uitpakte:

- De poort kon een bearer token niet naar een sessie herleiden. Er is géén
  schaduwindex gebouwd; `resolveSession` bleef eisen wat hij nodig had en faalde
  eerlijk buiten stap 1. Het gat werd daardoor opgelost in plaats van bedekt.
- De client-transport kon de precedentiemodule niet importeren in een browser.
  Er is geen kopie gemaakt; `createTransport()` faalt luid met een actionabele
  melding. Stil doorgaan zou een invariant op papier hebben gezet.

## 3. Meld met een reproductie, niet met een vermoeden

Een item zonder reproductie is een gevoel. Zet erin: de exacte invoer, de
waargenomen uitkomst, de verwachte uitkomst. Kun je het niet reproduceren, zeg
dat dan expliciet ("vermoeden, niet gereproduceerd") in plaats van het te laten
klinken als een feit.

Reproduceer ook wat een subagent meldt vóór je het doorzet. En let op de
omgekeerde fout: een reproductie die faalt om een andere reden dan je denkt. Een
handshake-probe wees álle verbindingen af doordat de auth verkeerd genest was —
bijna doorgegeven als serverdefect.

## 4. Doe een concreet voorstel, maar neem het besluit niet

Een item dat alleen een probleem beschrijft, kost de eigenaar denkwerk. Een item
met een uitgewerkte methodenaam, semantiek en randgevallen kost hem een ja of
een nee.

Maak het voorstel zo klein mogelijk. INT-1 vroeg oorspronkelijk om een wijziging
in twee modules; door de retry-lus naar de aanroeper te verplaatsen bleef er één
nieuwe poortmethode over en hoefde de andere module niet te veranderen. Kleinere
vraag, sneller ja.

Laat expliciet open wat niet van jou is. Bij INT-1 stonden drie varianten voor de
vrijgave-strategie met een voorkeur erbij — de keuze bleef bij de schema-eigenaar.

## 5. Zet er urgentie bij als het tijdkritisch is

Sommige items verliezen hun waarde na een bepaald moment. Schrijf dat erbij, met
de reden.

INT-14 en INT-16 moesten beslist zijn vóórdat het Lua-script af was: erna zou
dezelfde wijziging een herschrijving van atomaire code zijn in plaats van een
veld erbij. INT-15 was input voor een besluit dat op dat moment werd genomen —
een dag later was het commentaar op een gepasseerd station geweest.

## 6. Pin het gat vast in een test, met de opdracht hem om te draaien

Een gemeld gat dat nergens in de testsuite staat, verdwijnt. Leg het huidige,
foute gedrag vast in een test met het itemnummer in de naam, en zet er in een
comment bij welke assertie moet worden omgedraaid zodra het opgelost is.

Dat werkt twee kanten op: het gat blijft zichtbaar, én de suite gaat rood zodra
de eigenaar het repareert — precies het signaal dat je wil. Bij INT-17 sloegen
vier vastgepinde plekken tegelijk om toen de fix landde.

Let op wat zo'n pin ondersteboven kan houden. De test die bewees dat geen interne
foutcode de wire haalt, gebruikte juist die lobby-500 als uitlokking; toen die
verdween, moest er een nieuwe uitlokking komen, anders bewees de test niets meer.

## 7. Meld ook als je zelf de eigenaar bent

Draag je twee petten, schrijf het item dan alsnog en fix het als aparte
handeling. Anders verdwijnt de traceerbaarheid waar de regel voor bedoeld is, en
kan niemand later zien waarom iets veranderde.

## 8. Trek in wat fout blijkt, met de reden

INT-4 meldde dat het contentcontract twee velden miste. Bij navraag bleek dat die
velden uit een heel andere module kwamen en dat het verzoek zelf verkeerd was
opgesteld. Het item is ingetrokken met de correctie erin, niet stilletjes
verwijderd — een ingetrokken item met uitleg is waardevoller dan een item dat
nooit bestond.

## 9. Sluit expliciet af

Zet bij een opgelost item wat er is gebeurd, door wie, en met welk commit. Laat
de oorspronkelijke beschrijving staan: die legt uit waarom de oplossing eruitziet
zoals hij eruitziet. Een tabel met alleen ✅ is een geheugengat.

## De anti-patronen, kort

| Doe dit niet | Waarom |
| --- | --- |
| Er stil omheen bouwen | Verbergt het tot het duur is |
| Een tweede mechanisme naast dat van de eigenaar | Twee bronnen voor dezelfde waarheid lopen uiteen |
| "Dit klopt niet" zonder reproductie | Kost de eigenaar het werk dat jij al had gedaan |
| Een besluit nemen dat niet van jou is | Het landt in code in plaats van in `DECISIONS.md` |
| Een gat melden zonder het in een test te pinnen | Het verdwijnt |
| Een item stilletjes intrekken | De volgende loopt tegen hetzelfde aan |
