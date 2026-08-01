# PRODUCT.md — Wat bouwen we?

## Harde productregels

> **Iedere gebruiker kan binnen enkele seconden een game starten of joinen zonder account,
> e-mailadres of andere verplichte registratie.**

> **Iedere speler heeft tijdens het spel een zichtbare naam. Zelf invullen is optioneel;
> bij een leeg veld genereert de server direct een unieke naam. Een host hoeft alleen een
> spelersnaam te hebben wanneer die zelf meespeelt.**

> **Elke rol werkt volledig op een eigen telefoon. Een laptop, televisie, beamer of
> centraal scherm mag de ervaring verbeteren, maar is nooit vereist.**

Deze regels gaan boven alle andere afspraken in de specificatie.

## Visie in één zin

Eén persoon start binnen seconden een live quiz, deelt een QR of link, en een hele groep
speelt direct tegelijk mee op de eigen telefoon.

## Kernmoment

Het product is in de eerste plaats een sociaal spel voor situaties waarin mensen al
samen zijn of in één groepsapp zitten:

- studentenborrel, introductiegroep of vereniging;
- vriendengroep, huisfeest of verjaardag;
- sportteam, kantine of teamuitje;
- werkborrel of informele bijeenkomst;
- gezin of klas als aanvullende context.

Kennis is het speelveld. Plezier, competitie, discussie en revanche zijn het primaire
productdoel.

## Rollen

### Host

- creëert de room zonder account;
- kiest een snelle preset of past instellingen aan;
- deelt de room via QR, link of code;
- start, pauzeert, hervat en beëindigt;
- kan zelf meespelen, maar dat is niet verplicht;
- krijgt tijdelijke hostrechten voor uitsluitend deze room.

### Speler

- joint via QR, link of code;
- vult desgewenst een naam in;
- krijgt anders automatisch een unieke naam;
- speelt volledig op de eigen telefoon;
- kan op elk moment de uitnodigings-QR of deel-link van de room openen;
- krijgt nooit hostrechten via de publieke QR of deel-link.

Een host die meespeelt heeft één tijdelijke sessie met zowel de rol `host` als `player`.

## Primaire toegang: QR en link

De QR-code en directe deel-link zijn de voorkeursroute. De handmatige zescijferige code
is een fallback.

De QR:

- bevat uitsluitend een publieke join-link;
- bevat nooit een hosttoken;
- kan door de host én iedere al aangesloten speler worden geopend;
- werkt in de lobby en, als late join is toegestaan, tijdens de game;
- kan ook als gewone link via WhatsApp of andere apps worden gedeeld.

## MVP-scope — verplicht

### Starten en joinen

- volledig responsive mobiele web-app;
- geen download of installatie;
- `Snel starten` met goede standaardinstellingen;
- geavanceerde instellingen ingeklapt beschikbaar;
- tijdelijke, anonieme rooms;
- QR, directe link en zescijferige code;
- naam optioneel invoeren, effectieve spelersnaam verplicht;
- hostdeelname optioneel;
- maximaal 100 spelers per room als initiële configureerbare limiet.

### Spelen

- alle vragen, beelden, knoppen, timer, ronde-uitslag en eigen positie op ieder toestel;
- gedeelde server-timeline;
- auto-tempo als standaard;
- host-tempo als optie;
- live antwoordvoortgang;
- tussenstand;
- eindpodium;
- refresh- en reconnectherstel;
- late join volgens roominstelling;
- rematch zonder opnieuw joinen.

### Delen

- vaste `Delen`-actie voor iedere deelnemer;
- QR schermvullend te openen;
- native share sheet waar beschikbaar;
- kopieerbare join-link;
- code als fallback.

### Talen

- Nederlands, Engels en Spaans;
- één voertaal per room;
- bestaande vertalingen worden hergebruikt;
- technische foutcodes worden client-side vertaald.

## Spelvormen in multiplayer

### Golf 1 — MVP-launch

1. **Vlaggen Quiz** — meerkeuze.
2. **Hoofdsteden Quiz** — meerkeuze.
3. **Echt of Nep? — vlaggen** — binair.
4. **Hoger of Lager** — binair.
5. **Buitenbeentje** — vierkeuze.

`Logo: Echt of Nep?` mag technisch worden voorbereid, maar staat achter een feature flag
tot de juridische en commerciële inzet expliciet is beoordeeld.

### Golf 2

6. **Typen-invoer** voor vlaggen en hoofdsteden.
7. **Logo Quiz**.
8. **Voetballogo's**.
9. **Logo: Echt of Nep?**, indien vrijgegeven.

De host kiest één spelvorm of een mix van aangevinkte spelvormen.

## Juridische productgrens voor logo's

Een privéroom is geen automatische juridische vrijstelling. Merk- en clublogo's worden
daarom:

- achter een server-side feature flag geplaatst;
- niet gebruikt in publieke advertenties of social posts zonder expliciete vrijgave;
- niet als kern van het betaalmodel gepositioneerd voordat specialistisch advies of
  toestemming beschikbaar is.

De vlaggen- en landencontent vormt de veilige publieke launchbasis.

## Nadrukkelijk niet in de MVP

- accounts, profielen, e-mail, wachtwoorden;
- native iOS- of Android-app;
- globaal leaderboard over rooms heen;
- vriendenlijsten of chat;
- verplichte avatars;
- co-host- en moderatorrollen;
- user-generated quizsets;
- betalingen of premium;
- uitgebreide groepshistorie;
- spectator-scherm als vereiste;
- permanente opslag van spelersnamen;
- één container of proces per game.

## Latere uitbreidingen — niet launch-blocking

Deze ideeën mogen nooit de basisflow vertragen:

- gegenereerde groepsvlag of groepsbadge;
- stemmen op meerdere gegenereerde ontwerpen;
- vlag/badge bewaren en opnieuw gebruiken;
- branded eindkaart;
- seizoens- of eventformats;
- teamcompetities over meerdere avonden;
- optionele spectator-route;
- betaalde white-label- of eventversies.

De gegenereerde groepsvlag/badge is expliciet een **extra feature**. De kern moet zonder
die feature volledig aantrekkelijk, deelbaar en commercieel testbaar zijn.

## Standaard quick-start preset

De eerste launchversie bevat minimaal één preset:

**Groepsbattle**

- taal: browsertaal, handmatig wijzigbaar;
- moeilijkheid: normaal;
- rondes: 10;
- tempo: automatisch;
- snelheidspunten: aan;
- late join: aan;
- spelvormen: vlaggen, echt/nep, hoger/lager en buitenbeentje;
- modus: individueel.

Een host kan met één tik een room maken en daarna direct de QR tonen.

## Succescriteria MVP

1. Van homepage naar aangemaakte room in maximaal 10 seconden via `Snel starten`.
2. Van QR-scan naar lobby in maximaal 10 seconden op een gemiddelde telefoon.
3. Geen account-, e-mail- of installatieprompt vóór of tijdens een game.
4. Iedere aangesloten speler kan de QR of join-link opnieuw delen.
5. Eén room met 100 spelers doorloopt 20 rondes zonder desynchronisatie of crash.
6. Refresh of korte netwerkuitval herstelt binnen 5 seconden met behoud van score.
7. Een rematch start zonder nieuwe code, QR-scan of naamkeuze.
8. Alleen de anonieme, geaggregeerde statistieken uit `DATA-MODEL.md` blijven bewaard.
9. De kernflow werkt zonder groepsvlag, logo-generator, spectator-scherm of betaling.
