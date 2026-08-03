# 02 — Ontwerpprincipes

Deze principes zijn beslisregels. Een scherm dat mooi oogt maar deze regels schendt, is geen goed Play Aseso-ontwerp.

## P1 — Eén dominante taak per scherm

De gebruiker moet binnen twee seconden begrijpen:

1. waar hij is;
2. wat er gebeurt;
3. wat hij nu kan of moet doen.

Secundaire acties mogen de primaire actie niet even zwaar maken.

**Voorbeeld:** `Start game — 7 spelers` domineert; `Delen`, `Vergrendelen` en `Beheren` zijn stil of secundair.

## P2 — Snel spelen vóór configureren

De standaardroute start direct een goed standaardpotje. Instellingen zijn bereikbaar, maar nooit een verplichte muur vóór de lobby.

**Niet toegestaan:** een landingspagina waarop spelvorm, taal, moeilijkheid, aantal vragen, invoermethode en snelheid allemaal gelijkwaardig om aandacht vragen.

## P3 — Iedere telefoon is zelfstandig

Spelers hoeven niet naar een tv of hostscherm te kijken om:

- de vraag te lezen;
- antwoordopties te zien;
- antwoordbevestiging te krijgen;
- ronde-uitkomst te begrijpen;
- hun score en positie te zien;
- te weten wat er daarna gebeurt.

## P4 — Het hostscherm kan een podium worden

Wanneer ruimte beschikbaar is, schaalt het hostscherm op naar gezamenlijke informatie:

- QR en code;
- groeiende spelerswand;
- antwoordverdeling;
- sociale headline;
- leaderboard;
- podium.

De podiumlaag voegt beleving toe, maar geen noodzakelijke spelerinformatie.

## P5 — Wachten is nooit leeg

Iedere wachtstate toont minimaal twee van de volgende:

- concrete status;
- voortgang;
- sociaal bewijs;
- verwachting van de volgende stap;
- zinvolle actie zoals uitnodigen;
- beheeractie voor de host.

**Niet toegestaan:** alleen “Wachten tot de host start…” zonder teller, activiteit of uitnodigingsmogelijkheid.

## P6 — Antwoorden hebben identiteit, niet visuele herrie

Iedere antwoordpositie krijgt een vaste letter en geometrisch symbool. De optie blijft vóór reveal hoofdzakelijk neutraal.

- A — driehoek
- B — diamant
- C — cirkel
- D — vierkant

Een subtiel positieaccent is toegestaan. Volledig verzadigde rode/blauwe/gele/groene tegels zijn geen baseline.

## P7 — Geen goed/fout vóór ronde-einde

Selectie en verzending worden onmiddellijk bevestigd, maar correctheid blijft verborgen tot de ronde sluit.

Groen en rood zijn gereserveerd voor semantiek na reveal. Een gekozen antwoord gebruikt vóór reveal de primaire merkaccentkleur.

## P8 — Iedere actie antwoordt onmiddellijk

Binnen circa 100 ms moet zichtbaar zijn dat een input is ontvangen:

- knop drukt in;
- state verandert;
- tekst wisselt;
- spinner of progress verschijnt;
- haptiek of geluid ondersteunt optioneel.

Bij langere verwerking verandert de tekst, bijvoorbeeld `Potje maken…`.

## P9 — Ritme is onderdeel van het product

Een ronde is geen reeks losse schermen maar een mini-verhaal:

`countdown → vraag → submit → ronde sluit → reveal → sociale headline → leaderboard`.

De timing en volgorde zijn consistent, voorspelbaar en kort.

## P10 — Sociale competitie vóór kunstmatige economie

Voorkeursmechanieken:

- snelste antwoord;
- grootste stijger;
- enige juiste speler;
- iedereen koos dezelfde valstrik;
- comeback;
- streak;
- gedeelde eerste plaats.

Niet in de kernredesign:

- munten;
- winkels;
- upgrades;
- accountgebonden inventaris;
- dagelijkse beloningen.

## P11 — De wereld is de visuele grondstof

Vlaggen en geografische content krijgen de hoofdrol. Decoratie ondersteunt die inhoud met subtiele wereldmotieven.

**Niet toegestaan:** generieke paarse gradient-SaaS zonder herkenbare relatie tot landen, routes, kaarten of internationale competitie.

## P12 — Semantische kleur blijft schaars

- primair accent: acties en selectie;
- goud/warm accent: prestatie, rank, podium;
- groen: correct of succesvol;
- rood: incorrect, destructief of kritieke fout;
- waarschuwing: tijd of aandacht, niet standaard de hele timer.

Wat overal fel gekleurd is, heeft geen hiërarchie.

## P13 — Motion markeert gebeurtenissen

Animatie wordt gebruikt bij:

- speler komt binnen;
- countdown;
- selectie;
- ronde sluit;
- reveal;
- rank verandert;
- podium.

Motion is kort, doelgericht, onderbreekt invoer niet en heeft een reduced-motionvariant.

## P14 — Geluid is aanvullend

Geen essentiële status wordt alleen met geluid gecommuniceerd. Geluid is uitschakelbaar en gecentraliseerd beheersbaar.

Geen autoplay-ervaring die in een onverwachte openbare context storend wordt zonder duidelijke mute.

## P15 — Componenten hebben contextuele hiërarchie

Niet iedere actie is dezelfde volle-breedte knop. Het systeem onderscheidt:

- hero;
- primary;
- secondary;
- quiet;
- icon-with-label;
- destructive;
- gameplay option.

Vorm, hoogte en typografisch gewicht volgen betekenis.

## P16 — Mobile touch is de standaard

Hover is een verbetering, nooit de enige feedback. Alle interactieve elementen hebben:

- active-state;
- focus-visible-state;
- minimaal bruikbaar touch target;
- voldoende afstand;
- duidelijke disabled- en loadingbetekenis.

## P17 — Toegankelijkheid wordt niet opgeofferd aan gamefeel

Kleur, motion, geluid en timing krijgen alternatieven. Screenreader- en keyboardgebruik blijven mogelijk. De uitslag is ook zonder animatie direct te begrijpen.

## P18 — Herstel is een eersteklas state

Netwerkverlies, refresh, dubbele submit en verlopen rooms worden als ontworpen states behandeld, niet als generieke foutmelding.

## P19 — Iedere spelmodus heeft karakter binnen één shell

De navigatie, typografie, controls en statusbalk blijven consistent. De modus varieert met:

- vraagcompositie;
- microcopy;
- tempo;
- revealmotief;
- beperkte accentdetails.

## P20 — Geen ontwerp zonder acceptatiecriteria

Voor ieder scherm of component worden minimaal vastgelegd:

- primaire taak;
- allowed actions;
- loading;
- error;
- empty;
- mobile;
- keyboard/screenreader;
- anti-afkijkimpact;
- meetbaar “done”-criterium.
