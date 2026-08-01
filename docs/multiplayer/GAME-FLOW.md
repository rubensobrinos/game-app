# GAME-FLOW.md — Hoe gebruikt iemand het?

## Hoofdroute

```text
Homepage
→ [Snel starten] of [Game instellen] of [Code invoeren]
→ host maakt room
→ lobby opent direct met grote QR + deel-link + code
→ spelers scannen QR of openen link
→ optionele naamkeuze; leeg = gegenereerde naam
→ lobby toont deelnemers live
→ host drukt Start
→ countdown
→ vraag op ieder toestel
→ antwoord wordt gelockt
→ ronde-uitslag
→ tussenstand
→ volgende ronde
→ eindpodium
→ rematch of zelf een nieuwe game starten
```

Een laptop, televisie, beamer of centraal scherm komt in deze route niet voor.

## Routes

| Route | Wie | Doel |
| --- | --- | --- |
| `/` | iedereen | snel starten, game instellen of code invoeren |
| `/j/{inviteId}` | iedereen | publieke join-route voor QR en deel-link |
| `/game/{code}` | speler | room na succesvolle join of rejoin |
| `/host/{code}` | host | dezelfde game-UI met hostbediening |
| `/screen/{code}` | optioneel | spectatorroute; nooit vereist |

De `inviteId` is niet hetzelfde als het zescijferige gamecode en bevat geen hostrechten.
De hostroute verleent evenmin rechten op basis van de URL; de tijdelijke sessietoken is
altijd leidend.

## Hostflow

### Snel starten

```text
[Snel starten]
→ server maakt room met preset
→ host kiest: zelf meespelen ja/nee
→ indien ja: naam optioneel
→ lobby + QR
```

De keuze om mee te spelen mag standaard op `ja` staan, maar mag nooit verplicht zijn.

### Game instellen

Geavanceerde instellingen:

- één spelvorm of mix;
- moeilijkheid;
- aantal rondes;
- taal;
- auto-tempo of host-tempo;
- snelheidspunten;
- late join aan/uit;
- individueel of teams wanneer teams beschikbaar zijn.

De host kan alle standaardwaarden accepteren zonder ieder veld te openen.

## Joinflow

### Via QR of deel-link — primair

```text
Scan QR / open link
→ inviteId wordt gevalideerd
→ naamveld met reeds voorgestelde willekeurige naam
→ [Meedoen]
→ tijdelijke sessie wordt aangemaakt
→ lobby of actuele gamefase
```

De willekeurige naam is direct bruikbaar. De speler hoeft dus niets te typen.

### Via code — fallback

```text
Open homepage
→ voer zescijferige code in
→ room wordt gevalideerd
→ dezelfde naam- en joinflow
```

### Naamgedrag

- iedere speler heeft één effectieve naam;
- zelfgekozen naam: maximaal 20 zichtbare tekens;
- leeg of overgeslagen: server genereert een unieke naam;
- dubbele naam: server voegt een suffix toe;
- naam wordt als platte tekst behandeld, nooit als HTML;
- naam wijzigen kan eenmaal in de lobby;
- een host die niet meespeelt heeft geen spelersnaam nodig.

## QR- en deelgedrag

Elke deelnemer heeft een vaste actie `Delen`:

1. toon QR schermvullend;
2. open native share sheet;
3. kopieer join-link;
4. toon handmatige code.

De QR en deel-link:

- zijn voor alle deelnemers identiek;
- geven alleen joinrechten;
- kunnen tijdens de game geopend worden zonder de game te verlaten;
- keren na sluiten terug naar exact dezelfde fase;
- werken alleen zolang de room bestaat;
- respecteren `allowLateJoin` en `roomLocked`.

De host hoeft dus niet fysiek langs iedereen te lopen. Iedere speler kan de room verder
verspreiden.

## Spelscherm

Iedere speler ziet:

- spelvorm en rondenummer;
- vraag en alle noodzakelijke beelden;
- antwoordopties;
- timer;
- bevestiging dat antwoord is ontvangen;
- aantal antwoorden ontvangen, zonder namen;
- ronde-uitslag;
- eigen verdiende punten;
- top 5 en eigen positie;
- deelknop;
- reconnectstatus wanneer nodig.

De host ziet daarnaast een inklapbare bedieningsbalk.

## Hostbediening

- start;
- pauzeer/hervat;
- volgende bij host-tempo;
- room vergrendelen/ontgrendelen;
- speler verwijderen;
- game beëindigen;
- rematch.

Een host die meespeelt moet de bediening kunnen inklappen zodat de antwoordinterface
niet kleiner of onrustiger wordt.

## Randgevallen

### 1. Host sluit browser of verliest verbinding

- auto-tempo loopt server-side door;
- host kan via de sessietoken rejoinen;
- bij host-tempo wacht de game maximaal 60 seconden;
- daarna schakelt de server over naar auto-tempo of pauzeert volgens configuratie;
- spelers krijgen een korte statusmelding.

### 2. Speler refresht, vergrendelt telefoon of wisselt app

- sessietoken blijft lokaal bewaard;
- client probeert automatisch te rejoinen;
- actuele snapshot overschrijft oude lokale state;
- score en geaccepteerde antwoorden blijven behouden;
- gemiste rondes worden niet ingehaald.

### 3. Speler komt binnen na de start

Wanneer `allowLateJoin = true` en de room niet is vergrendeld:

- speler joint de huidige fase;
- begint op 0 punten;
- ziet vanaf welke ronde die meedoet;
- kan pas antwoorden vanaf een volledig nieuwe actieve ronde als de huidige vraag bijna
  is afgelopen.

Wanneer late join uitstaat of de room is vergrendeld, verschijnt een duidelijke melding.

### 4. Dubbele naam

De server maakt de naam uniek, bijvoorbeeld `Sanne 2`.

### 5. Geen naam ingevuld

De server gebruikt de reeds voorgestelde naam of genereert `Speler {n}` / een alias.

### 6. Niemand antwoordt

De ronde eindigt normaal. Na drie volledig onbeantwoorde rondes achter elkaar:

- auto-tempo pauzeert;
- host krijgt `Doorgaan` of `Beëindigen`;
- is de host offline, dan eindigt de game na een aanvullende timeout.

### 7. Antwoord komt te laat

De server weigert het antwoord. De client toont geen goed/fout vóór `round:ended`.

### 8. Room vol

Melding: room is vol. De gamecode wordt niet automatisch doorgestuurd naar een nieuwe
room.

### 9. Verkeerde, ingetrokken of verlopen uitnodiging

Melding: game bestaat niet meer of uitnodiging is niet geldig. Knop terug naar homepage.

### 10. Host verwijdert speler

- huidige sessie wordt geblokkeerd;
- socket wordt gesloten;
- speler kan met die sessietoken niet terug;
- de MVP garandeert niet dat dezelfde persoon niet opnieuw via een nieuw apparaat of
  privatievenster kan joinen;
- tegen herhaald misbruik kan de host de room vergrendelen.

### 11. Speler verlaat vrijwillig

- bevestiging vóór verlaten;
- speler telt niet meer mee voor antwoordvoortgang;
- bestaande score kan in de eindstand als `verlaten` blijven staan;
- sessie kan binnen de room-TTL opnieuw worden geactiveerd zolang niet gekickt.

### 12. Rematch

- dezelfde room, code en inviteId;
- nieuwe `matchId`;
- aanwezige spelers blijven in de lobby;
- scores en streaks gaan naar nul;
- instellingen blijven staan;
- vragen uit de direct vorige match worden vermeden;
- geen nieuwe naam, scan of link nodig.

### 13. Room-TTL verloopt

Na vier uur zonder activiteit wordt de room verwijderd. Join- en rejoinlinks werken dan
niet meer.

### 14. Serverproces herstart

- Redis bewaart de state;
- actieve rooms worden bij herstel gepauzeerd;
- clients rejoinen via snapshot;
- de server hervat met een korte nieuwe countdown, niet door stilletjes meerdere fases
  over te slaan.

## Teams — latere MVP-uitbreiding

- spelers kiezen een team of worden automatisch verdeeld;
- ieder antwoordt individueel;
- teamscore wordt server-side berekend;
- QR en joinflow veranderen niet;
- teamkeuze komt na naamkeuze en vóór de lobby.

## Spectatorroute — optioneel

`/screen/{code}` toont lobby, QR, vraag, antwoordverdeling, scoreboard en podium, maar:

- is niet nodig om te spelen;
- heeft geen hostbediening;
- toont nooit antwoordknoppen;
- kan later worden gebouwd zonder de mobiele kernflow te wijzigen.

## Gegenereerde groepsvlag of badge — optionele extra

Een eventuele groepsvlag/badge komt pas ná succesvolle roomcreatie en mag:

- nooit vereist zijn;
- de QR niet vertragen;
- de game niet blokkeren wanneer generatie faalt;
- met één tik worden overgeslagen.

Deze extra staat buiten de MVP-happy-path.
