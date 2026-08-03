# Ontwerpbriefing — Rounda, multiplayer quizgame

**Voor:** een ontwerp-/UX-agent zonder toegang tot repo of code. Dit document
is alles wat je krijgt en alles wat je nodig hebt.

**Bewust weggelaten:** de huidige vormgeving (kleuren, typografie, layout).
Je ontwerpt vanaf een schone lei. Beschrijf je voorstel in woorden en
structuur (of mockups), niet als aanpassing op iets bestaands — je weet niet
hoe het er nu uitziet en dat is de bedoeling.

---

## 1. Wat is Rounda?

Rounda (voorheen werktitel Play Aseso; besluit 39) is een gratis browser-quizplatform over de wereld: vlaggen,
landen, geografie. Geen account, geen download, geen drempel — je opent een
link en je speelt. Het draait op play.aseso.nl en werkt op elke telefoon,
tablet en laptop.

Er zijn twee werelden:

1. **Solo spelen** (staat al live): een speler kiest een quiz (bijv.
   Vlaggenquiz, Echt of Nep?, Geo Quiz) en speelt in z'n eentje.
2. **Samen spelen** (net af, dit is jouw opdracht): één iemand start een
   potje, de rest doet mee op hun eigen telefoon. Denk aan het sociale
   moment: vrienden op de bank, een klas, een verjaardag, collega's in de
   pauze. Tien vragen, iedereen antwoordt tegelijk, scorebord, podium,
   revanche.

De kernbelofte van Samen spelen: **binnen 30 seconden van "zullen we?" naar
een draaiend potje.** Eén tik om te starten, één code of QR om mee te doen,
geen instellingen nodig (ze kúnnen wel).

## 2. De twee rollen

**De host** start het potje en heeft de regie: spelers binnenlaten, het spel
starten, pauzeren/hervatten, spelers verwijderen, de room vergrendelen
(niemand meer erbij), het spel beëindigen, en na afloop een revanche
starten. De host kan zelf meespelen (default) of alleen hosten.

**De speler** doet mee via een 6-cijferige code, een gedeelde link of een
QR-code, kiest een naam (of accepteert een voorgestelde naam), wacht in de
lobby, beantwoordt vragen, ziet tussenstanden en het eindpodium.

Belangrijk ontwerpgegeven: de host staat vaak vóór een groep met z'n scherm
zichtbaar of leesbaar voor anderen (tv, laptop opengeklapt, telefoon
omhoog). Spelers zitten vrijwel altijd op hun eigen telefoon.

## 3. De volledige flow, scherm voor scherm

### 3.1 Start ("Samen spelen"-ingang)

- Eén primaire actie: **Snel starten** → je bent direct host van een potje
  met verstandige defaults (10 vragen, vlaggenquiz).
- Eén secundaire actie: **code invoeren** (6 cijfers) → meedoen met het
  potje van iemand anders.
- Er bestaat ook een uitgebreide instellingenflow voor de host (aantal
  rondes, taal van de vragen, moeilijkheid, tempo, late instap toestaan,
  zelf meespelen of niet) — die mag onder een "geavanceerd"-achtige ingang,
  de snelstart is heilig.

### 3.2 Meedoen (speler)

- Via link/QR: speler landt op een pagina die het potje herkent en vraagt
  alleen nog een **naam** (optioneel — er ligt altijd een voorstel klaar,
  bijv. "Speler 3", dus doorklikken zonder typen moet kunnen).
- Via code: zelfde naamstap na het invoeren van de code.
- Foutpaden die een nette boodschap nodig hebben: code bestaat niet, potje
  is vergrendeld, potje is al bezig (als late instap uit staat), potje zit
  vol.

### 3.3 Lobby (het wachtscherm vóór de start)

Voor de host het belangrijkste scherm van het product:

- **De code en QR moeten hier permanent en groot zichtbaar zijn** — de host
  leest de code voor of houdt de QR omhoog terwijl mensen binnendruppelen.
  (Uitdrukkelijke wens van de producteigenaar; nu zit dat achter knopjes en
  dat werkt niet.)
- Live spelerslijst: namen verschijnen zodra iemand joint, teller ("7
  spelers"). Binnenkomst mag voelbaar zijn (er gebeurt iets als er iemand
  bij komt — dat is het feestje van dit scherm).
- Hostacties: starten (primair), vergrendelen, spelers verwijderen, delen
  (native share/link kopiëren).
- Spelers zien: wie er al zijn, "wachten tot de host start".

### 3.4 De vraag (het spelscherm)

Ritme per ronde: vraag verschijnt → iedereen antwoordt binnen de tijd →
uitslag van de ronde → (soms) tussenstand → volgende vraag. Dit ritme is
server-gestuurd en voor iedereen gelijktijdig.

Op het scherm tijdens een vraag:

- De vraag zelf: een **vlagafbeelding** met vier landnamen als
  antwoordopties (meerkeuze). Later komt er een typmodus bij
  (autocomplete op landnaam), ontwerp de antwoordzone dus niet zó vast dat
  alleen vier knoppen ooit passen.
- Een aflopende **timer** (seconden). Spanning is goed, stress is niet het
  doel — dit is een gezelschapsspel, geen exam.
- Rondenummer ("6/10") en hoeveel spelers al geantwoord hebben ("3/7").
- Na je antwoord: bevestiging dat het binnen is — maar **nooit** goed/fout
  tonen vóórdat de ronde voorbij is (anti-afkijken, hard spelregel-principe).
- Ronde-uitslag: het juiste antwoord, of jij goed zat, je punten. Snelheid
  telt mee in de score (speedbonus), dus wie snel én goed is wordt beloond.

### 3.5 Tussenstand

Kort scorebordmoment tussen rondes: top 5 + je eigen positie ("Jij: #12 —
340"). Moet in een paar seconden leesbaar zijn, dit scherm duurt niet lang.

### 3.6 Podium (einde)

Top 3 met scores, je eigen eindpositie, en voor de host een prominente
**Revanche**-knop (zelfde groep, nieuw potje, niemand hoeft opnieuw te
joinen). Dit is het scherm waar de groep samen naar kijkt — het mag een
moment zijn.

### 3.7 Dwarsliggers (overlays die overal overheen kunnen komen)

- **Pauze:** de host kan pauzeren; spelers zien dan "gepauzeerd door de
  host" en kunnen niets. De host moet tijdens een pauze WEL bij z'n
  hostacties kunnen (spelers beheren, beëindigen, hervatten) — nu blokkeert
  de pauze ook de host en dat is een bekend pijnpunt.
- **Verbinding kwijt:** korte wifi-dip moet onaangekondigd herstellen; een
  langere onderbreking toont een statusmelding en herstelt daarna zelf de
  actuele stand (het spel loopt server-side gewoon door).
- **Verwijderd door de host / potje beëindigd:** nette eindboodschap, terug
  naar start.

### 3.8 App-brede zaken

- **Talen:** NL, EN, ES — apart van de vragentaal (de host kiest de taal
  van de vrágen; elke speler kiest z'n eigen interface-taal).
- **Thema:** licht en donker bestaan allebei als capability.
- Deze voorkeuren zitten nu in een menu rechtsboven; hoe dit hoort te
  werken mag jij opnieuw bedenken. Bekend pijnpunt: het menu valt nu
  rommelig over de spelinhoud heen.

## 4. Harde randvoorwaarden (hier kun je niet omheen)

1. **Telefoon-eerst voor spelers.** Elk spelerscherm moet perfect zijn op
   een klein scherm, portrait, met één duim bedienbaar. Host-schermen
   moeten óók op een telefoon werken maar mogen op groot scherm extra
   schitteren (lobby met grote code/QR!).
2. **Tot 100 spelers in één potje.** Spelerslijsten en scoreborden moeten
   daar een antwoord op hebben (top-N + eigen positie is het bestaande
   patroon).
3. **Gelijktijdigheid is heilig.** Iedereen ziet dezelfde fase op hetzelfde
   moment; het ontwerp mag nooit suggereren dat je vooruit of terug kunt.
4. **Geen goed/fout zichtbaar vóór het einde van de ronde** — ook niet
   subtiel (kleurverschil, animatie).
5. **Spelersnamen zijn user input**: onvoorspelbaar lang, emoji, rare
   tekens. Max 20 tekens, maar ontwerp op afkappen.
6. **Toegankelijkheid is een eis, geen nice-to-have**: schermlezers worden
   actief ondersteund (aankondiging van schermwissels, statusupdates),
   zoom tot 200% mag niets breken, en de vlag-afbeelding krijgt bewust
   géén landnaam als alt-tekst (zou het antwoord verklappen).
7. **Performance-realiteit:** geen zware assets per ronde; vlaggen zijn
   kleine afbeeldingen; alles moet vlot voelen op een middenklasse-telefoon
   op feest-wifi.
8. **Merkkader:** de productnaam is "Rounda" (rounda.io; één woord, geen
   leestekens). De naam draagt zelf al een ontwerpwereld aan — rondes,
   cirkels, countdowns, "nog een Rounda" als rematch-ritueel — maar je bent
   vrij in hoe letterlijk je die neemt. Er is een bestaand,
   simpel merkgevoel (donker met een uitgesproken accentkleur) maar je bent
   NIET gebonden aan de huidige uitwerking — stel gerust een volledig
   kleur-/stijlsysteem voor. Voorwaarde: één systeem dat licht én donker
   aankan en dat energie uitstraalt zonder kinderachtig te worden.

## 5. Wat er NIET is (ontwerp er niet voor)

- Geen accounts, geen profielen, geen avatars, geen vriendenlijsten.
- Geen spectator-/beamerscherm als aparte weergave (bewust buiten scope;
  de host-lobby met grote code/QR vervult die rol).
- Geen teams/groepsbattle — iedereen speelt individueel.
- Geen chat.

## 6. Bekende pijnpunten uit de eerste echte speeltest (gisteravond)

Vier waarnemingen van de producteigenaar tijdens een echt potje met drie
spelers — beschouw ze als user needs, niet als lijstje af te vinken fixes:

1. Namen van medespelers waren niet (goed) zichtbaar in lijsten op mobiel.
2. De host wil de join-code permanent in beeld, niet achter een knop.
3. De pauze blokkeerde ook de host zelf — die kon alleen nog hervatten.
4. Het voorkeuren-menu viel visueel over de spelinhoud heen.

## 7. Wat we van je vragen

1. **Een schermflow/ontwerpvoorstel voor de hele Samen spelen-ervaring**
   (§3.1 t/m §3.8), telefoon-eerst, met extra aandacht voor de host-lobby
   en het podium — de twee "groepsmomenten".
2. **Een stijlrichting** (kleursysteem, typografieprincipes,
   feedback-/animatietaal) die de energie van een gezelschapsspel draagt en
   §4 respecteert.
3. **Motivatie per keuze** in gewone taal — dit voorstel wordt besproken
   met de producteigenaar en daarna vertaald naar bouwopdrachten.

Wat je NIET hoeft: code, technische implementatie, of rekening houden met
"hoe het nu is". Dat is bewust bij je weggehouden.
