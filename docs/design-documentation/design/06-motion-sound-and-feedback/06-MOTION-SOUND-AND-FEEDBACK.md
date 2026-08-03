# 06 — Motion, Sound en Feedback

## 1. Doel

Gamefeel ontstaat uit consequente gebeurtenissen, niet uit willekeurige animatie. Dit document beschrijft welke momenten nadruk krijgen en hoe alternatieven zonder motion of geluid werken.

## 2. Algemene regels

- feedback op input start vrijwel onmiddellijk;
- functionele statewijziging is leidend, animatie volgt;
- geen blokkerende animatie langer dan noodzakelijk;
- motion gebruikt een kleine set durations en easings;
- geluid is kort, herkenbaar en muteable;
- haptiek is optioneel en subtiel;
- reduced motion behoudt volgorde en betekenis.

## 3. Motion tokens — werkhypothese

```text
--motion-instant: 80–120ms
--motion-fast: 140–180ms
--motion-base: 220–280ms
--motion-emphasis: 350–500ms
--motion-stage: 700–1200ms
```

Easingrollen:

- input/press: snelle ease-out;
- verschijnen: zachte deceleratie;
- rank movement: spring-achtig maar beheerst;
- podium: stage easing, niet cartoonesk stuiterend.

## 4. Eventcatalogus

### E01 — Knop indrukken

- scale of translate van zeer kleine omvang;
- direct bij pointer/touch down;
- maximaal circa 100–140 ms;
- geen layoutshift.

### E02 — Potje maken

- label verandert naar `Potje maken…`;
- compacte progressindicator;
- knop blijft op plaats;
- success transition naar lobby;
- fout stopt indicator en toont retry.

### E03 — Speler komt binnen

- nieuwe spelerchip fade + lichte scale;
- teller pulseert één keer;
- optionele korte zachte joincue;
- bij snelle bulkjoins worden cues geclusterd om geluidschaos te voorkomen.

### E04 — Countdown

- groot cijfer wisselt 3–2–1;
- zachte tick per cijfer;
- laatste cue opent vraag;
- vraagassets zijn vooraf geladen;
- reduced motion: snelle opacitywissel of alleen tekst/tick.

### E05 — Antwoordselectie

- pressfeedback;
- gekozen option krijgt merkaccent;
- statusindicator verschijnt;
- optionele lichte haptiek;
- geen feestgeluid: correctheid is nog onbekend.

### E06 — Antwoord bevestigd

- `Verstuurd ✓` verschijnt in option;
- korte success neutral cue, niet dezelfde als correct antwoord;
- andere opties dimmen gecontroleerd;
- screenreader krijgt één bevestiging.

### E07 — Laatste drie seconden

- timercontrast neemt toe;
- progress pulseert of ticktempo stijgt subtiel;
- geen volledige schermflits;
- geen alarmgeluid op iedere telefoon tenzij expliciet gekozen.

### E08 — Ronde sluit

- inputs locken;
- korte transition cue;
- host/podium kan een gezamenlijke “close” sound gebruiken;
- geen verwarrende successkleur.

### E09 — Reveal correct antwoord

- correcte option krijgt semantische focus;
- antwoordlabel en uitleg verschijnen;
- korte reveal-stoot;
- fout gekozen option wordt gemarkeerd zonder agressieve shake;
- geen negatieve buzzer die publiekelijk vernederend werkt als default.

### E10 — Punten tellen

- score kan kort oplopen indien totale duur beperkt blijft;
- definitieve waarde staat direct in DOM/accessibility tree;
- snelheidsbonus als secundaire regel;
- reduced motion toont eindwaarde meteen.

### E11 — Rank movement

- row beweegt gecontroleerd naar nieuwe positie;
- `↑2`/`↓1` blijft tekstueel zichtbaar;
- eigen row krijgt korte emphasis;
- geen complexe animatie bij 100+ deelnemers op hostscherm; alleen top/recente beweging.

### E12 — Sociale headline

- één headline komt rustig in;
- relevante naam/waarde benadrukt;
- geen carrousel met meerdere headlines;
- automatisch overslaan als geen onderscheidende statistiek bestaat.

### E13 — Streak

- kleine persoonlijke viering;
- host/podium alleen bij betekenisvolle streak;
- confetti niet standaard;
- copy kort: `4 op rij`.

### E14 — Podium

- optioneel 3 → 2 → 1;
- totale opbouw kort;
- winnaar krijgt warme competitieaccenten;
- confetti beperkt in duur/dichtheid;
- acties verschijnen direct of uiterlijk na korte finale;
- skip/reduced motion toont volledig podium onmiddellijk.

### E15 — Reconnecting

- rustige, niet-feestelijke progress;
- tekst benoemt herstel;
- achterliggende content bevriest of blijft veilig zichtbaar;
- successcue klein;
- failure geeft concrete actie.

## 5. Geluidsarchitectuur

### Categorieën

- ambience: lobby-loop, standaard uit of zeer zorgvuldig gestart;
- event: join, countdown, reveal, podium;
- input: select/confirm;
- warning: laatste seconden, reconnect/failure;
- celebration: streak/podium.

### Beheer

- host bepaalt gedeelde/podiumgeluiden;
- iedere speler heeft lokale mute;
- mute is altijd bereikbaar zonder actieve vraag te blokkeren;
- voorkeur blijft lokaal bewaard;
- eerste audioactivatie respecteert browserbeleid en gebruikersactie.

### Mixregels

- korte cues;
- geen stapeling bij snelle joins;
- lagere intensiteit op individuele telefoons dan op podium;
- geen sound die essentieel is om deadline of correctheid te begrijpen;
- test in stille kamer én luidruchtige borrelcontext.

## 6. Haptiek

Optioneel:

- lichte tap bij answer submit;
- iets sterkere cue bij countdownstart of reveal;
- geen herhaalde vibraties tijdens timer;
- respecteer apparaat- en gebruikersinstellingen.

## 7. Reduced motion

Bij `prefers-reduced-motion`:

- geen scale/spring/bewegende rankrows;
- opacity- of instantstatewissel;
- podium direct compleet;
- score direct definitief;
- confetti uit;
- countdown blijft tekstueel begrijpelijk;
- functionele durations worden niet onnodig langer.

## 8. Feedbackmatrix

| Gebeurtenis | Visueel | Tekst | Geluid | Haptiek | Screenreader |
|---|---|---|---|---|---|
| room gemaakt | lobby verschijnt | code/status | optioneel | nee | lobby + code aangekondigd |
| speler joined | chip + teller | naam/totaal | join cue | nee | totaal niet bij iedere bulkjoin spammen |
| antwoord tap | press + selected | versturen | input cue | licht | gekozen antwoord |
| submit success | submitted state | `Verstuurd` | confirm cue | licht | één bevestiging |
| correct reveal | groen + icoon | `Juist` | reveal cue | optioneel | juist + antwoord |
| incorrect reveal | rood + icoon | `Onjuist` | neutrale reveal | optioneel | onjuist + correct antwoord |
| reconnect | status | hersteltekst | waarschuwing klein | nee | statuswijzigingen gedoseerd |

## 9. Performancebudget

- animaties gebruiken bij voorkeur transform/opacity;
- geen zware blur/glass op lage mobiele hardware;
- confetti en particles hebben limiet;
- geluidassets worden slim vooraf geladen;
- motion mag timer of inputthread niet blokkeren;
- test op middelmatige Androidtelefoon, niet alleen high-end desktop.
