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
| 9 | Titel "Lobby" weg | **harde eis, doe dit eerst** | |
| 10 | Losse regel "1 SPELER" weg of compacter | **harde eis, doe dit eerst** | |
| 11 | Grote zwarte vlakken weg, lobby compacter | **wacht op besluit** | De grootste "lege zwarte ruimte" is de minigamekaart: `clamp(260px, 38vh, 360px)` = ~335 px, meer dan de helft van het scherm, en donker zolang niemand tikt (`rounda-1c.css:423`). Dit haal je niet met marges. Zie `../VERKENNING.md §1.2` — de producteigenaar beslist of de warm-up ingeklapt start. **Begin met de rest van C2 en pak dit als het besluit er is.** |
| 19 | Niet standaard acht losse kleurknoppen | ontwerp | |
| 20 | Klik op het kleurvlak opent een palet (~36 kleuren) | **feature + serverwerk** | de server kent er **acht** (gesloten enum). 36 kleuren betekent protocolwerk. **Bouw de interactie (kleurvlak → palet), niet 36 kleuren.** Lever bij stoppunt 2 een inschatting voor de uitbreiding; de lead beslist |
| 21 | Naam en kleur uit hetzelfde compacte blok | ontwerp | het JIJ-blok bestaat, maak het compacter en zet de kleur erin |
| 22 | Hostinstellingen in/uitklapbaar | **bestaat al** | verifiëren, niet herbouwen |
| 23 | Horizontaal swipen tussen games | touch | `scroll-snap` is hier de goedkoopste route |
| 24 | Kleine pijlen mogen blijven | ontwerp | als secundaire bediening, kleiner dan nu |
| 31 | "Start Rounda" iets hoger | layout | |
| 32 | Startknop bedekt niets | bug | **B lost de overlap op**; jij zorgt dat je layout ruimte laat (`padding-bottom`) |

## Stoppunten

### C0 — twee regels weg (doe dit vóór al het andere)

Gemeten op de screenshot van de producteigenaar: de titel **"Lobby"** en de
regel **"1 SPELER"** kosten samen **~108 px** — een zesde van het bruikbare
scherm, voor twee woorden die niets toevoegen. Je staat in de lobby; dat weet
je. En het aantal spelers staat al in de lijst eronder.

- [ ] Titel weg (#9). Screenreaders houden een `sr-only`-kop, zichtbaar niets.
- [ ] De tellerregel verdwijnt als eigen regel (#10) — het aantal mag mee in de
      spelersrij of als klein label ernaast, niet op een eigen regel met marge
      erboven én eronder.
- [ ] Meet na: van de onderkant van de codebalk tot de eerste spelersrij mag
      **≤ 24 px** zitten.

Dit is losstaand en kost minuten. Lever het apart op, vóór C1 — de
producteigenaar wil dit als eerste terugzien.

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
