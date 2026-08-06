# 10 — Implementatieroadmap

## 1. Strategie

Niet alles tegelijk redesignen. Eerst de kernflow en het componentfundament, daarna choreografie en onderscheidende gamefeel.

Iedere fase moet zelfstandig testbaar en releasable zijn. Vermijd een maandenlange volledige rewrite zonder gebruikersfeedback.

## 2. Fase 0 — Inventarisatie en baseline

**Doel:** weten wat er bestaat en regressie voorkomen.

Werk:

- route- en state-inventarisatie;
- huidige componenten en CSS-afhankelijkheden;
- screenshots/video van complete happy path op mobiel en desktop;
- toegankelijkheidsbaseline;
- performancebaseline;
- game-statecontracten en realtime events;
- featureflags voor geleidelijke rollout;
- testdata voor 0, 2, 8, 35 en gesimuleerde 200 spelers.

**Deliverables:**

- componentmap;
- state-diagram gekoppeld aan code;
- regressietestset;
- lijst van bestaande sterke punten die behouden moeten blijven.

## 3. Fase 1 — Fundament en directe kwaliteitswinst

**Doel:** de “AI-template”-uitstraling en stille interacties aanpakken zonder complete flowrewrite.

### Scope

1. semantische designtokens;
2. knophiërarchie;
3. active/focus/loading/disabled voor alle controls;
4. nieuwe gameplay-option met letter/vormidentiteit;
5. inline `Verstuurd ✓`;
6. `Potje maken…` loadingstate;
7. gewone headings; gradient alleen waar bedoeld;
8. emoji-placeholderinventaris en vervangplan;
9. minimale 3–2–1 countdown;
10. permanente code + QR in hostlobby.

### Acceptatiecriteria

- iedere tap heeft feedback;
- hero/primary/secondary/quiet zijn visueel onderscheidend;
- answer submit lekt geen correctheid;
- QR/code niet verborgen;
- focusrings behouden;
- mobiel werkt zonder hover;
- geen grote functionele regressie.

## 4. Fase 2 — Kernflow redesign

**Doel:** landing tot podium als één professionele ervaring.

### Scope

- nieuwe landing en snel-startflow;
- progressieve configuratie;
- naamflow;
- levende hostlobby;
- spelerslobby met uitnodigen;
- vraaglayout;
- ronde sluiten/reveal;
- persoonlijke uitslag;
- antwoordverdeling op podium;
- top-vijf + eigen leaderboardrow;
- podium en revanche;
- hostpauze en beheerstate.

### Acceptatiecriteria

- start tot lobby zonder onnodige tussenstap;
- alle kernschermen hebben loading/error/empty;
- volledig speelbaar zonder gedeeld scherm;
- groot hostscherm heeft podiumcompositie;
- sociale headline-engine kan één veilige headline kiezen;
- gebruikstest zonder uitleg slaagt voor primaire flow.

## 5. Fase 3 — Gamefeel en sociale identiteit

**Doel:** van nette UX naar herkenbare partygame.

### Scope

- motiontokens en choreografie;
- soundlaag met host/local mute;
- joinmomenten en batching;
- rank movement;
- streaks;
- tijdelijke speleridentiteit met kleur/symbool;
- eigen medaille/podiumassets;
- wereldmotieven en motion-signature;
- share-uitnodigingsflow vanuit spelers.

### Acceptatiecriteria

- reduced motion volledig;
- geen soundstapeling bij bulkjoins;
- game blijft performant op middelmatige telefoon;
- geen kinderavatarstijl;
- sociale effecten vertragen flow niet;
- rematch behoudt deelnemers correct.

## 6. Fase 4 — Moduskarakter en schaal

**Doel:** spelvormen onderscheidend maken en grotere groepen ondersteunen.

### Scope

- specifieke Echt-of-Nep-reveal;
- Hoger-of-Lager-duelchoreografie;
- mode-specifieke microcopy;
- large-room lobby en geaggregeerde joins;
- event/stage optimalisatie;
- antwoordverdeling en tiegedrag;
- late join;
- hostoverdracht/VIP indien besloten;
- netwerk- en loadtesten.

## 7. Fase 5 — Verfijning en experimenten

Mogelijkheden na kernvalidatie:

- extra sociale headlines;
- result sharing;
- teamidentiteit;
- optionele thema’s;
- privacypropositie op marketinglaag;
- async of daily modes;
- content discovery.

Accounts, economie en power-ups blijven buiten scope tenzij productstrategie bewust verandert.

## 8. Prioriteitsmatrix

| Item | Impact | Complexiteit | Fase |
|---|---|---|---|
| tap/loadingstates | hoog | laag | 1 |
| answer identity | hoog | laag/middel | 1 |
| permanente QR/code | hoog | laag/middel | 1 |
| landing vereenvoudigen | hoog | middel | 2 |
| levende lobby | zeer hoog | middel | 2 |
| reveal/leaderboard | zeer hoog | middel/hoog | 2 |
| podium | hoog | middel | 2 |
| geluid | middel/hoog | middel | 3 |
| tijdelijke identiteit | middel | middel | 3 |
| large-room gedrag | hoog voor events | hoog | 4 |
| virtuele economie | onzeker | zeer hoog | buiten scope |

## 9. Aanpak per ticket

Ieder implementation ticket bevat:

- betrokken state(s);
- rol/apparaat;
- schermspecreferentie;
- componenten;
- API/realtime events;
- loading/error/reconnect;
- a11ycriteria;
- analytics/logging;
- screenshots of prototype;
- QA-cases;
- featureflag/rollout.

## 10. Gebruikstesten

### Test 1 — Startfrictie

- vijf nieuwe gebruikers;
- opdracht: start een potje en laat twee anderen joinen;
- geen uitleg;
- meet tijd, fouten en vragen.

### Test 2 — Borrelcontext

- 8–20 spelers;
- lawaai en verschillende telefoons;
- observeer QR, join, wachten, reveal en gesprekken.

### Test 3 — Zonder gedeeld scherm

- alle deelnemers alleen telefoon;
- controleer of niemand noodzakelijke informatie mist.

### Test 4 — Podium

- hostlaptop/tv;
- scanbaarheid op afstand;
- timing van social headline en leaderboard.

### Test 5 — Netwerk

- packet loss, refresh en korte disconnects;
- controleer vertrouwen en herstel.

## 11. Release gates

Een fase gaat niet live zonder:

- functionele tests;
- visuele QA op relevante viewports;
- accessibility-check;
- performancecheck;
- realtime/loadcheck waar relevant;
- copyreview NL/EN;
- rollback/featureflag;
- expliciete controle op anti-afkijklogica.

## 12. Belangrijkste risico's

### R1 — Alles tegelijk bouwen

Mitigatie: fasering en featureflags.

### R2 — Mooie mock-up, zwakke statecoverage

Mitigatie: state- en errorcriteria verplicht per ticket.

### R3 — Generieke dark gaming-esthetiek

Mitigatie: eigen wereldgrammatica en merkassets, niet alleen paars palet.

### R4 — Overgamification

Mitigatie: sociale headlines vóór economie; maximaal één highlight per ronde.

### R5 — Gedeeld scherm stiekem noodzakelijk

Mitigatie: aparte test zonder tv; spelertelefoon is functioneel compleet.

### R6 — Motion schaadt snelheid/accessibility

Mitigatie: durations, reduced motion, skip en performancebudget.

### R7 — Realtime edge cases pas laat ontdekt

Mitigatie: reconnect/refresh/submit-ID al in fase 0–2 meenemen.
