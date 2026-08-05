# Pakket C — Home & lobby

**Lees eerst `../README.md`.** Je start zodra **A stoppunt 1** klaar is: dan
staan de ruimtetokens vast en weet je hoeveel hoogte je overhoudt.

## De opdracht in één alinea

Twee schermen die de gebruiker als eerste ziet en die nu allebei te lang zijn.
Op home valt "Meedoen met code" onder de vouw; in de lobby kosten een titel,
een tellerregel, acht kleurblokjes en veel zwart zo veel ruimte dat de
startknop over de gamekeuze heen komt te liggen. **Alles moet binnen één
viewport**, zonder dat het gedrongen wordt.

## Wat er nu staat

| Wat | Waar |
| --- | --- |
| Home: logo, tagline, START, zes codecellen, "Meedoen met code" | `frontend/js/views/home.mjs` (297 rgl) |
| Solo-ingang ("Alleen spelen", 5 aug) | `home.mjs` — `soloButton`, `onSolo` |
| Lobby: titel, teller, spelerslijst, JIJ-blok, kleuren, hostinstellingen, start | `frontend/js/views/lobby.mjs` (820 rgl) |
| Kleurpalet van acht | `frontend/js/player-chip.mjs` — `SERVER_KLEUREN` (server kent 8: `client-events-dispatch.mjs:101`) |
| Hostinstellingen in/uitklapbaar | `lobby.mjs` — `settingsHeader`, `aria-expanded` — **bestaat al** |
| Gamecarrousel met ‹ › | `lobby.mjs` — `gamePrev`, `gameNext`, `turnGame()` |
| Sticky startknop | `frontend/css/base.css:990` (`.lobby-start`) |
| Lobbytests (5 aug) | `frontend/js/views/lobby.test.mjs` — carrousel, configsync, niveauknoppen |

## De punten

| # | Punt | Label | Notitie |
| --- | --- | --- | --- |
| 1 | Home binnen één viewport | **bug** | IMG_0290: "Meedoen met code" valt eronder. Met #3 en #4 erbij past het waarschijnlijk al |
| 2 | Zes codevelden + compacte **Go** ernaast | ontwerp | de zes cellen bestaan al; de Go-knop moet ernaast, niet eronder |
| 3 | Knop "Meedoen met code" weg | vereenvoudiging | volgt uit #2 |
| 4 | Subtekst "GEEN ACCOUNT · JIJ LEIDT" weg | tekst | `home.quickStartSub` — sleutel laten staan, alleen niet meer tonen |
| 5 | Logo ~20% groter | visueel | |
| 9 | Titel "Lobby" weg | vereenvoudiging | |
| 10 | Losse regel "1 SPELER" weg of compacter | vereenvoudiging | `.lobby-count` is al een mono-label; het punt is de eigen regel |
| 11 | Grote zwarte vlakken weg, lobby compacter | ontwerp | zie IMG_0289: ~200 px gaat op aan de kleurenrij |
| 19 | Niet standaard acht losse kleurknoppen | ontwerp | |
| 20 | Klik op het kleurvlak opent een palet (~36 kleuren) | **feature + serverwerk** | de server kent er **acht** (gesloten enum). 36 kleuren betekent protocolwerk. **Bouw de interactie (kleurvlak → palet), niet 36 kleuren.** Lever bij stoppunt 2 een inschatting voor de uitbreiding; de lead beslist |
| 21 | Naam en kleur uit hetzelfde compacte blok | ontwerp | het JIJ-blok bestaat, maak het compacter en zet de kleur erin |
| 22 | Hostinstellingen in/uitklapbaar | **bestaat al** | verifiëren, niet herbouwen |
| 23 | Horizontaal swipen tussen games | touch | `scroll-snap` is hier de goedkoopste route |
| 24 | Kleine pijlen mogen blijven | ontwerp | als secundaire bediening, kleiner dan nu |
| 31 | "Start Rounda" iets hoger | layout | |
| 32 | Startknop bedekt niets | bug | **B lost de overlap op**; jij zorgt dat je layout ruimte laat (`padding-bottom`) |

## Stoppunten

### C1 — home (klein, snel af)
- [ ] Punten 1–5. Home past volledig binnen 390×844 **inclusief de footer**
      (punt 6: die blijft, ongewijzigd).
- [ ] Screenshot als bewijs.
- [ ] De solo-ingang ("Alleen spelen") blijft staan en blijft onder het
      codeveld — dat is besluit C-1.

### C2 — lobby compacter
- [ ] Punten 9, 10, 11, 21, 31.
- [ ] Meetbaar: van de bovenkant van de spelerslijst tot de startknop past
      alles binnen één viewport bij **één** speler.
- [ ] Inschatting voor #20 (36 kleuren) aangeleverd, niets gebouwd aan het
      protocol.

### C3 — identiteit en gamekeuze
- [ ] 19, 20 (interactie), 23, 24.
- [ ] `lobby.test.mjs` uitgebreid: de carrousel blijft werken na de omzetting
      naar swipen, en de bestaande tests blijven groen.
- [ ] Verifieer 22 en meld de uitkomst.

## Niet doen

- **De spelersweergave herontwerpen** (punt 12: die vond de producteigenaar
  goed). Compacter mag; anders niet.
- Easy/Medium/Hard, Meer instellingen, de taalinstelling, snelheidsbonus en
  later-meedoen aanpassen (punten 26, 28, 29, 30).
- De kleurenset uitbreiden naar 36 zonder groen licht — de server weigert
  alles buiten zijn acht (`INVALID_ANSWER_FORMAT`).
- De chrome aanraken: dat is A.
