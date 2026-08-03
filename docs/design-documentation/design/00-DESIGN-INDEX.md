# 00 — Design Index en besluitregister

**Doel:** één ingang en bron van waarheid voor ontwerpers, ontwikkelaars en AI-agents.

## 1. Autoriteit van documenten

Bij tegenstrijdigheid geldt deze volgorde:

1. expliciet Product Owner-besluit;
2. dit besluitregister;
3. `01-PRODUCT-EXPERIENCE-NORTH-STAR.md`;
4. `02-DESIGN-PRINCIPLES.md`;
5. functionele specificaties in `03` en `04`;
6. designsysteem en gedragsdocumenten in `05` t/m `09`;
7. roadmap en QA in `10` en `11`;
8. onderzoeksrapporten.

Onderzoeksrapporten verklaren waarom keuzes zijn gemaakt, maar zijn niet rechtstreeks uitvoerbaar. Een agent mag geen concurrerende observatie uit een onderzoeksrapport boven een later ontwerpbesluit plaatsen.

De nummers hierboven zijn documentnummers, niet mappen. De elf documenten zijn
verdeeld over vijf gebieden (`1-schermen-en-flow/` t/m
`5-toegankelijk-en-robuust/`), elk met een eigen `PROGRESS.md` en één eigenaar;
`00`, `01`, `10` en `11` gaan over alle vijf en staan los in `design/`. Zie
[`package-readme/README.md`](../package-readme/README.md) voor de volledige
indeling. Verwijzingen op nummer (`zie 05 §2.3`) blijven ongewijzigd geldig.

## 2. Scope van deze documentatieset

Deze baseline dekt:

- publieke start- en joinflow;
- host- en spelerslobby;
- countdown en actieve vraag;
- antwoordbevestiging en wachten;
- ronde-reveal en sociale feedback;
- leaderboard en podium;
- pauze, beheer, reconnect en basale foutstates;
- responsive gedrag voor telefoon en grotere hostschermen;
- componenten, interactiestates, motion, geluid en microcopy;
- toegankelijkheid, veerkracht, implementatiefasering en QA.

Niet volledig uitgewerkt:

- accounts, profielen en langetermijnprogressie;
- uitgebreide virtuele economie of power-ups;
- asynchrone quizcompetities;
- commercieel prijsmodel;
- moderatiebeleid voor zeer grote openbare rooms;
- exacte backend- en netwerkarchitectuur;
- marketingwebsite buiten de primaire speelentry.

## 3. Kernbesluiten

| ID | Besluit | Status | Reden |
|---|---|---|---|
| D-001 | Play Aseso wordt gepositioneerd als **telefoon-eerste world-party-game**, niet als educatieve quiztool. | BESLOTEN | Onderscheidt van schoolse en zakelijke quizplatforms. |
| D-002 | Geen account, download of verplicht gedeeld scherm voor de kernflow. | BESLOTEN | Frictieloze start is de primaire producttroef. |
| D-003 | Een groot hostscherm is een verrijking, geen vereiste. | BESLOTEN | Combineert mobiele zelfstandigheid met podiumenergie. |
| D-004 | De lobby is een entertainmentfase met permanente QR/code, levende spelerstoetreding en duidelijke startactie. | BESLOTEN | Wachten moet spanning en sociaal bewijs opbouwen. |
| D-005 | Antwoorden krijgen positie-identiteit via letter en geometrisch symbool; geen vier volledig gekleurde Kahoot-vlakken. | BESLOTEN | Herkenbaarheid zonder Kahoot-kloon of visuele onrust. |
| D-006 | Groen en rood worden pas na het sluiten van de antwoordfase gebruikt voor correct/incorrect. | BESLOTEN | Anti-afkijkprincipe en semantische helderheid. |
| D-007 | Iedere actie geeft onmiddellijk visuele feedback; geen stille taps of lege wachttijd. | BESLOTEN | Essentieel voor gamefeel en vertrouwen. |
| D-008 | Sociale groepsfeedback gaat vóór munten, power-ups en accountgebonden beloningen. | BESLOTEN | Past bij spontane groepen en nul-accounts. |
| D-009 | Donker is de primaire arena-uitstraling; licht blijft een volwaardige systeemoptie. | VOORGESTELD | Premium gamegevoel én bruikbaarheid buiten/in fel licht. |
| D-010 | De wereld vormt de visuele grondstof via subtiele kaart-, route- en atlasmotieven. | BESLOTEN | Creëert eigen merkgrammatica en voorkomt generieke gaming-SaaS. |
| D-011 | Motion en geluid markeren gebeurtenissen, maar blokkeren of vertragen de vervolgstap niet. | BESLOTEN | Energie zonder irritatie. |
| D-012 | Bestaande toegankelijkheidskwaliteiten worden minimaal behouden. | BESLOTEN | Huidige focusringen en aria-live liggen boven genre-niveau. |
| D-013 | Snel starten staat vóór uitgebreide configuratie. | BESLOTEN | Landingspagina moet bijna direct lobby worden. |
| D-014 | Elke spelmodus gebruikt dezelfde shell maar mag eigen ritme en microcopy hebben. | BESLOTEN | Herkenbaarheid én spelkarakter. |
| D-015 | Emoji zijn geen definitieve merk- of podiumassets. | BESLOTEN | Prototype-uitstraling vervangen door eigen iconografie. |
| D-016 | De game heet **Rounda**. Vervangt `Play Aseso` als productnaam in titels, og-tags en interface. | BESLOTEN | Product Owner, 3 aug 2026. Sluit O-001. Domein `play.aseso.nl` blijft vooralsnog ongewijzigd. |
| D-017 | Gradient is uitsluitend voor de merknaam/hero. Schermtitels (`Lobby`, `Tussenstand`, `Eindstand`) zijn rustige koppen. | BESLOTEN | Product Owner, 3 aug 2026. Beslecht het conflict met `HANDOFF-UI.md` UI-5, dat dezelfde gradient op álle titels eiste; heft de gradient-inflatie uit de audit op. |
| D-018 | De gamecode staat permanent in de **appheader** en blijft het hele potje zichtbaar. Een QR-pictogram ernaast opent de QR als modal. | BESLOTEN | Product Owner, 3 aug 2026. Invulling van D-004 voor mobiel: permanent zichtbaar zonder de QR blijvend ruimte te laten kosten. |
| D-019 | Code en QR zijn **altijd** zichtbaar, ook voor spelers en ook bij een vergrendelde room. Vergrendelen blokkeert alleen het daadwerkelijk joinen, niet het tonen. | BESLOTEN | Product Owner, 3 aug 2026. Sluit O-007, ruimer dan de aanbevolen werkhypothese. |
| D-020 | De startknop heet `Start Rounda`, zónder spelersaantal. | BESLOTEN | Product Owner, 3 aug 2026. Wijkt bewust af van `Start game — N spelers` in `03` §4.2, `04` S05 en `09` §6; die teksten zijn hiermee vervallen. |
| D-021 | Antwoordknoppen behouden voorlopig hun huidige vorm: géén letter/vorm-identiteit. `Verstuurd` blijft een aparte statusregel naast de antwoordcomponent. | BESLOTEN | Product Owner, 3 aug 2026. Stelt D-005/P6 en `04` S12 bewust uit; geen stil verschil maar een expliciet uitstel. |

## 4. Open Product Owner-besluiten

Deze punten mogen niet stilzwijgend door een agent worden ingevuld:

| ID | Open vraag | Aanbevolen werkhypothese |
|---|---|---|
| ~~O-001~~ | ~~Definitieve merknaamweergave~~ | **Gesloten door D-016: de game heet Rounda.** |
| O-002 | Definitief lettertype en licentie? | Eerst prototypen met `Space Grotesk` of `Sora` voor display en `Inter` voor UI. |
| O-003 | Exacte primaire accentkleur? | Indigo/violet, gevalideerd op contrast en onderscheid met vlagkleuren. |
| O-004 | Roomcode-lengte en tekenreeks? | Zes cijfers voor leesbaarheid; QR/link als primaire snelle route. |
| O-005 | Hoeveel spelers ondersteunt de UI als officieel doel? | Ontwerp minimaal voor 2, 8, 35 en 200 deelnemers; technische limiet apart bepalen. |
| O-006 | Scoreformule en snelheidsbonus? | Bestaande logica behouden tot afzonderlijke game-balancingreview. |
| ~~O-007~~ | ~~Mogen spelers zelf de room-QR permanent delen?~~ | **Gesloten door D-019: ja, altijd — ook bij een vergrendelde room.** |
| O-008 | Wie bestuurt geluid: host, speler of beide? | Host bepaalt gedeelde cues; iedere telefoon heeft lokale mute. |
| O-009 | Worden gegenereerde avatars direct onderdeel van MVP-redesign? | Alleen simpele kleur/symboolidentiteit in fase 3; geen kinderkarakters. |
| O-010 | Welk moment toont antwoordverdeling? | Op gedeeld hostscherm tijdens reveal; op spelertelefoon alleen wanneer dit geen persoonlijke informatie verdringt. |

## 5. Bewust niet doen

- Geen dashboard met vele gelijkwaardige kaarten als startscherm.
- Geen accounts of onboarding vóór een spontaan potje.
- Geen volledig andere UI per spelmodus.
- Geen overdaad aan gradients, glassmorphism of neon.
- Geen kinderavatars als dragend merkconcept.
- Geen virtuele economie in de redesignkern.
- Geen confetti op ieder correct antwoord.
- Geen verborgen roomcode of QR in de hostlobby.
- Geen hover-afhankelijke feedback.
- Geen instellingenpopover over actieve spelinhoud.
- Geen animatie die invoer vertraagt of een actie tijdelijk onmogelijk maakt.

## 6. Werkwijze voor agents

Voor iedere ontwerp- of implementatietaak:

1. benoem de relevante game-state;
2. benoem de rol: host, speler of gedeeld podium;
3. controleer primaire taak en primaire actie;
4. gebruik bestaande component- en statebenamingen;
5. voeg loading-, fout-, lege en reconnectstate toe;
6. controleer mobiel zonder hover;
7. controleer anti-afkijklogica;
8. toets aan de QA-checklist;
9. markeer afwijkingen als expliciet voorstel, niet als stil besluit.
