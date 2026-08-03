# 04 — Schermspecificaties

## Gebruik van dit document

Per scherm worden vastgelegd:

- **doel**;
- **primaire actie**;
- **inhoudshiërarchie**;
- **componenten**;
- **states**;
- **responsive gedrag**;
- **acceptatiecriteria**.

## S01 — Landing / Samen spelen

**Doel:** direct starten of joinen zonder dashboardgevoel.

**Primaire actie:** `Start direct een game`.

**Secundaire route:** code invoeren en `Meedoen`.

**Tertiair:** `Spel aanpassen`.

**Inhoudshiërarchie:**

1. productlock-up;
2. korte belofte;
3. hero startknop;
4. compacte scheiding `of doe mee`;
5. codeveld + join;
6. aanpaslink;
7. onder de fold: `Geen account. Geen download. Iedereen speelt op zijn eigen telefoon.`

**Niet tonen:** alle spelinstellingen tegelijk.

**Loading:** hero wordt `Potje maken…`.

**Error:** inline boven of onder de actie; behoud interactiemogelijkheid.

**Acceptatiecriteria:**

- primaire route zichtbaar zonder scroll op gangbare telefoon;
- code-invoer ondersteunt plakken en numeriek toetsenbord waar van toepassing;
- Enter/submit werkt;
- geen twee even dominante primaire knoppen.

## S02 — Spel aanpassen

**Doel:** defaults bewust wijzigen zonder de startflow in een dashboard te veranderen.

**Structuur:** stapsgewijze sheet/pagina met logische groepen:

1. spelvorm;
2. moeilijkheid en inhoud;
3. aantal rondes/tijd;
4. teams of individuele modus;
5. aanvullende regels.

**Primaire actie:** `Start met deze instellingen`.

**Secundair:** `Herstel standaardinstellingen`.

**Acceptatiecriteria:**

- huidige keuzes worden samengevat;
- elke optie heeft begrijpelijke taal;
- geavanceerde opties zijn progressief onthuld;
- teruggaan verliest geen keuzes.

## S03 — Roomcode invoeren

Kan onderdeel zijn van S01 of losse route.

**Doel:** code snel en foutarm invoeren.

- duidelijke label en voorbeeld;
- automatische spaties in visuele weergave toegestaan;
- onderliggende waarde blijft schoon;
- paste van volledige join-URL mag code extraheren;
- fout toont specifieke reden.

## S04 — Naam kiezen

**Doel:** met één submit in de lobby komen.

**Inhoud:**

- `Je doet mee aan game 482 917`;
- `Hoe noemen we je?`;
- vooraf ingevulde leuke naam;
- `Ik doe mee`;
- sociaal bewijs zoals `19 spelers wachten al`.

**Naamregels:**

- lengtebegrenzing zichtbaar bij nadering;
- trims whitespace;
- duplicaten krijgen suffix of gerichte suggestie;
- moderatie-uitkomst is duidelijk, niet moraliserend;
- naam blijft bewaard bij tijdelijke netwerkfout.

## S05 — Hostlobby

**Doel:** laten joinen, spanning opbouwen en starten.

**Mobiele compositie:**

1. compacte kop met roomstatus en geluid;
2. QR-card met permanente code en URL;
3. spelersteller;
4. spelerspreview;
5. sticky primaire startactie;
6. stille acties `Delen`, `Vergrendelen`, `Beheren`.

**Groot scherm:** tweekoloms compositie, QR/code links en spelerswand rechts.

**Lege state:**

- teller `0 spelers`;
- start disabled;
- tekst `Laat iemand de QR scannen om te beginnen`;
- deelactie actief.

**Nieuwe speler:**

- subtiele scale/fade;
- teller pulseert;
- geen layoutschokken;
- naam wordt veilig afgekapt.

**Schaal:**

- 1–12: individuele namen prominent;
- 13–35: compact grid;
- 36+: recente joins + totaal + `Bekijk alle spelers`;
- 200+: geen poging om alle namen permanent te tonen.

## S06 — Spelerslobby

**Doel:** bevestigen dat deelname gelukt is en wachten betekenis geven.

**Inhoud:**

- eigen naam en symbool/kleur;
- roomcode of herkenning;
- aantal aanwezige spelers;
- status `De host start zo`;
- `Nodig iemand uit`;
- lokale voorkeuren.

**Niet tonen:** hostcontrols of overvolle spelerslijst.

## S07 — Countdown

**Doel:** gezamenlijke aandacht synchroniseren.

**Inhoud:** grote `3`, `2`, `1`; eventueel rondecontext klein.

**Gedrag:**

- duurt maximaal circa drie seconden;
- tik/geluid optioneel;
- reduced motion toont statische snelle wissel of tekst;
- vraag wordt vooraf geladen zodat geen wit moment volgt.

## S08 — Standaard meerkeuzevraag

**Doel:** vraag begrijpen en één antwoord indienen.

**Hiërarchie:**

1. ronde en antwoordstatus;
2. timer/progress;
3. vraagtekst;
4. vlag/afbeelding;
5. antwoorden;
6. statusfeedback.

**Antwoordcomponent:**

- minimaal circa 52–56 px hoog;
- letter + symbool + label;
- volledige knop tappable;
- active, selected, submitting, submitted, correct, incorrect;
- label wrapt beheerst of schaalt volgens contentregels;
- geen hover-only feedback.

**Viewport:** primaire vraag en antwoorden passen idealiter zonder scroll. Bij lange inhoud is de antwoordzone prioritair bereikbaar en blijft status zichtbaar.

## S09 — Echt of Nep

**Zelfde shell**, eigen karakter:

- centrale vlag/visual;
- twee duidelijke antwoordopties;
- microcopy met spanning, bijvoorbeeld `Echt` en `Nep`;
- reveal kan een korte “authenticiteitsstempel” of atlasmotief gebruiken;
- semantische kleur pas na sluiting.

Geen horror- of casino-esthetiek.

## S10 — Hoger of Lager

**Zelfde shell**, duelcompositie:

- twee landen/waarden visueel vergelijkbaar;
- primaire keuze `Hoger` / `Lager` of directe side-select;
- reveal animeert de waarden kort naar hun werkelijke positie;
- toegankelijk alternatief beschrijft de uitkomst tekstueel.

## S11 — Antwoord versturen

Tussenstate binnen het vraagscherm.

- gekozen optie is gelockt;
- tekst `Antwoord versturen…` wanneer bevestiging langer duurt;
- overige opties zijn disabled maar niet visueel verdwenen;
- timer blijft zichtbaar;
- geen goed/fout.

## S12 — Antwoord bevestigd / wachten

- gekozen knop toont `Verstuurd ✓`;
- status toont `Wachten op 4 spelers…` of `Wachten tot de ronde sluit`;
- bij grote room kan teller afgerond of geaggregeerd worden;
- speler kan niet wijzigen, tenzij een expliciete productregel dit toestaat;
- geen sharepanel tijdens de resterende actieve vraag.

## S13 — Ronde-reveal

**Doel:** correct antwoord, eigen resultaat en groepsmoment helder maken.

**Volgorde:**

1. ronde sluit;
2. correct antwoord krijgt focus;
3. eigen keuze wordt gemarkeerd;
4. resultaatlabel `Juist`, `Onjuist` of `Geen antwoord`;
5. punten en bonus;
6. rankbeweging;
7. maximaal één sociale headline.

**Host/podium:** kan antwoordverdeling als staafdiagram tonen.

**Speler:** persoonlijke informatie staat vóór groepsgrafiek.

## S14 — Sociale headline

**Selectieregel:** toon alleen een headline als deze werkelijk onderscheidend is.

Prioriteitvoorbeeld:

1. één speler als enige correct;
2. comeback/grootste stijger;
3. uitzonderlijk snelle speler;
4. iedereen correct;
5. iedereen fout;
6. opvallende misleider;
7. streak.

Nooit vernederend of persoonsgegevens buiten de roomcontext gebruiken.

## S15 — Leaderboard

**Doel:** positie en beweging begrijpen.

**Standaard:** top vijf plus eigen rij indien buiten top vijf.

Rij bevat:

- rank;
- naam;
- score;
- beweging `↑2`, `↓1`, `—`;
- eigen rij visueel herkenbaar.

**Groot scherm:** meer posities toegestaan zonder scanbaarheid te verliezen.

**Gelijke score:** consistente tie-regel; gedeelde plaats of secundaire sortering wordt expliciet productbesluit.

## S16 — Pauze

### Speler

`Gepauzeerd door de host`  
`We gaan zo verder.`

Toont verbindingstatus en lokale voorkeuren, maar geen nutteloze loader.

### Host

- `Hervatten` primair;
- spelers beheren;
- room vergrendelen;
- QR tonen;
- game beëindigen destructief.

## S17 — Spelers beheren

Bij voorkeur bottom sheet op mobiel, paneel op desktop.

Functies:

- naam bekijken;
- verwijderen;
- eventueel dempen/modereren indien chat ooit bestaat;
- VIP/hostoverdracht alleen als product ondersteund;
- bevestiging voor destructieve actie, contextueel en compact.

## S18 — Voorkeuren

Mobiel bottom sheet; desktop zijpaneel.

- interfacetaal;
- thema: systeem/licht/donker;
- geluid aan/uit;
- reduced motion volgt systeem met optionele override indien gewenst.

Niet openen als overlay die de actieve onbeantwoorde vraag volledig bedekt. Tijdens actieve vraag alleen beperkte mute of na submit.

## S19 — Reconnecting

**Doel:** onzekerheid wegnemen en herstel mogelijk maken.

- `Verbinding herstellen…`;
- recente veilige state blijft waar mogelijk zichtbaar;
- geen antwoordwijziging zonder serverbevestiging;
- na enkele seconden `Opnieuw proberen`;
- bij definitief falen specifieke terugvalroute.

## S20 — Podium

**Doel:** finale en vervolgactie.

**Reveal:** 3 → 2 → 1, kort en overslaanbaar/reduced motion.

**Definitieve compositie:**

- winnaar dominant;
- nummers twee en drie;
- eigen eindpositie indien buiten podium;
- aantal deelnemers;
- `Revanche` primair;
- `Nieuw spel`, `Deel uitslag`, `Afsluiten` secundair.

Confetti alleen hier of bij uitzonderlijke streak; niet continu.

## S21 — Game beëindigd / room verlopen

Specifieke oorzaken:

- host beëindigde game;
- room verlopen;
- technische beëindiging;
- speler verwijderd.

Iedere oorzaak heeft passende, neutrale tekst en primaire terugkeeractie.
