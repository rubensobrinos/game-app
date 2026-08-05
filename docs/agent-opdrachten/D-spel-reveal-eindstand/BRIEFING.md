# Pakket D — Spel, reveal, eindstand en hostbediening

**Lees eerst `../README.md`.** Je start zodra **A stoppunt 1** klaar is: pas dan
weet je hoeveel hoogte je hebt.

## De opdracht in één alinea

Dit zijn de schermen waar het spel gespeeld wordt, en precies daar gaat het
mis: **het vierde antwoord valt buiten beeld**, de reveal is voor de helft leeg,
de eindstand gebruikt een half scherm voor één regel, en het hostmenu bestaat
vrijwel alleen uit rode knoppen die je game beëindigen.

## Wat er nu staat

| Wat | Waar |
| --- | --- |
| Spelscherm: kop, timer, vraag, vlag, antwoorden | `frontend/js/views/gameplay.mjs` (634 rgl) |
| Inline antwoordvoortgang "9/14 BINNEN" in de kop | `gameplay.mjs` — `headerProgress` — **bestaat al, staat niet live** |
| Reveal + tussenstand (scherm 5) | `frontend/js/views/scoreboard.mjs` (367 rgl) |
| Podium/eindstand | `frontend/js/views/podium.mjs` (260 rgl) |
| Hostmenu (⋯-paneel met acties) | `frontend/js/views/hostbar.mjs` (168 rgl) |
| Hostbalk verborgen in de lobby | `frontend/css/rounda-1c.css:746` |
| Tests | `gameplay.test.mjs`, `scoreboard.test.mjs` (5 aug) |

## De punten

| # | Punt | Label | Notitie |
| --- | --- | --- | --- |
| 33 | Vraag, vlag én vier antwoorden binnen één viewport | **harde eis** | dit is jouw belangrijkste punt. Budget: media ≤ 200 px, antwoorden 4 × 56 + 3 × 11 |
| 34 | Vlag, witruimte en bovenbalk verkleinen | ontwerp | de bovenbalk is A; jij doet vlag en witruimte |
| 35 | Vraag en antwoorden primair | ontwerp | samen met A |
| 38 | Toon hoeveel spelers geantwoord hebben | **bestaat al** | `headerProgress`, "9/14 BINNEN" — verifiëren, niet herbouwen |
| 39 | Die status hoog genoeg in beeld | **bestaat al** | staat in de kop |
| 42 | Lege ruimte op de reveal weg, voortgangsgevoel toevoegen | ontwerp | zie IMG_0296: onderste helft is leeg |
| 44 | Pauzeren werkt en is bereikbaar | functioneel | de knop komt van A op zijn nieuwe plek; jij zorgt dat de actie klopt |
| 46 | Hostacties gebundeld | ontwerp | A levert de plek, jij de inhoud |
| 47 | Hostinstellingen verdwijnen niet zonder alternatief tijdens het spel | UX | `rounda-1c.css:746` verbergt de hostbalk in de lobby; controleer wat er tijdens het spel overblijft |
| 48 | Het menu sluit aan op wat een host verwacht | ontwerp | nu: bijna alleen destructief |
| 49 | "Game beëindigen" en "Verwijder" niet dominant | **safety** | IMG_0294/0295: twee rode knoppen als hoofdinhoud |
| 50 | Destructief gescheiden + bevestiging | **safety** | er is nu geen bevestigingsstap |
| 51 | Het menu bedekt de vraag niet onnodig | UX | IMG_0295: het paneel ligt over de vraag |
| 54 | Eindstand compacter | ✅ **door de lead gedaan** | CSS-only, in het LEAD-blok onderaan `rounda-1c.css`. Kijk of het klopt als je bij D2 bent; verbeter gerust, maar bouw het niet opnieuw |
| 55 | Revanche primair, rest secundair | ✅ **door de lead gedaan** | idem: Nieuw spel + Deel uitslag delen één rij en zijn lager |
| 56 | Codebalk/menu niet dominanter dan de uitslag | layout | A haalt de balk weg bij FINISHED; jij vult de vrijgekomen ruimte |

## Stoppunten

### D1 — het spelscherm (de harde eis)
- [ ] Punten 33, 34, 35.
- [ ] **Screenshot op 390×844 waarop alle vier de antwoorden zichtbaar zijn
      zonder te scrollen.** Zonder die foto is D1 niet af.
- [ ] Verifieer 38 en 39 in de huidige tree en meld de uitkomst — waarschijnlijk
      is er niets te bouwen.

### D2 — reveal en eindstand
- [ ] Punten 42, 54, 55, 56.
- [ ] De reveal krijgt zichtbaar voortgangsgevoel. Let op: **de balk zelf is
      pakket B** (#40) — bouw geen tweede balk ernaast, stem af.

### D3 — hostbediening
- [ ] Punten 44, 46, 47, 48, 49, 50, 51.
- [ ] Destructieve acties: apart gezet, visueel ondergeschikt, mét een
      bevestigingsstap. Een host die per ongeluk een potje beëindigt met tien
      mensen erin is de duurste fout in deze hele lijst.
- [ ] Het menu opent zonder de actieve vraag te bedekken.

## Niet doen

- `hostbar.mjs` **verplaatsen** — dat is A. Jij vult de inhoud in.
- De lege menuknop repareren (#52) en het rendergedrag (#53) — dat is B.
  Kom je ze tegen, meld het, bouw het niet.
- De reveal-voortgangsbalk repareren (#40) — B.
- Een tweede reeks hostinstellingen bouwen. Als er tijdens het spel iets mist
  (#47), meld dat eerst met een voorstel.
