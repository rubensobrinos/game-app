# Pakket B — Bugs en functionele eisen

**Lees eerst `../README.md`.** Jij kunt **direct beginnen**: dit pakket raakt de
chrome niet en wacht dus niet op A.

## De opdracht in één alinea

Dit zijn de punten waar iets níét werkt, niet waar iets lelijk is. Timer die
stilstaat, voortgangsbalk die niet afloopt, menuknop zonder inhoud, opties die
niet klikken. **Elk punt dat je oplost krijgt een test** — dit is precies de
categorie die zonder test stilletjes terugkomt.

## Wat er nu staat

| Wat | Waar |
| --- | --- |
| Segmententimer (module) | `frontend/js/timer-bar.mjs` (+ eigen test) |
| Timer gemount in het spelscherm | `frontend/js/views/gameplay.mjs` — `createTimerBar`, `timerHost` |
| Reveal-voet met aflopende balk op `scoreboardSeconds` | `frontend/js/views/scoreboard.mjs` — `nextBar`, `lastDrainKey` |
| Hostmenu (⋯-paneel) | `frontend/js/views/hostbar.mjs` (168 rgl) |
| Antwoordvorm-knoppen Kiezen/Mix/Typen | `frontend/js/views/lobby.mjs` — `answersChoose`, `answersMix`, `answersType` |
| Tussen rondes direct starten (vandaag gerepareerd) | `server/transport/socket.mjs` — `onPhaseEntered`, §A2 |

## De punten

| # | Punt | Label | Wat ik al weet |
| --- | --- | --- | --- |
| 25 | Kies/Mix/Typ lijken niet klikbaar | **deels bug, deels besluit** | Mix en Typen zijn **bewust uit** (besluit 40D) — niet aanzetten. Maar "Kiezen" heeft óók geen klikhandler (`segButton(answersGroup)` zonder `onPick`), dus het hele rijtje voelt dood. Geef Kiezen een echte, zichtbare bevestiging en maak van Mix/Typen een uitlegbare "binnenkort"-staat |
| 27 | "Antwoord automatisch tonen" mag niet BINNENKORT zijn | **botst / serverwerk** | Dit is besluit C uit doelbeeld v2: een nieuwe hostactie in de match-lifecycle, geen CSS-toggle. **Scope is een beslissing van de producteigenaar.** Bouw hem niet zomaar; lever bij stoppunt 1 een inschatting en wacht op de lead |
| 32 | Startknop bedekt hostinstellingen | bug | `.lobby-start` is `position: sticky` (`base.css:990`) zonder ruimte eronder. Zie IMG_0289: "RAAD DE VLAG" komt onder de knop vandaan |
| 36 | Segmententimer i.p.v. kaal cijfer | **aansluiting** | `timer-bar.mjs` bestáát en wordt gemount — op de foto zie je alleen een cijfer. Zoek uit of de balk niet rendert, leeg is, of buiten beeld valt |
| 37 | Timer telt niet vloeiend af | bug | hangt aan 36 |
| 40 | Voortgangsbalk reveal loopt niet af | bug | op IMG_0296 staat hij vol. De code kent `scoreboardSeconds` uit de serverconfig — controleer of die waarde aankomt |
| 41 | Direct de volgende vraag na de overgang | **mogelijk al gefixt** | vandaag gerepareerd in `socket.mjs` (§A2: tussen rondes start de ronde direct). Verifieer tegen de huidige tree vóór je iets bouwt |
| 43 | Consistentie vlag / juist antwoord / spelersantwoord | verificatie | schrijf een test die dit vastlegt; vind je niets, meld dat als uitkomst |
| 52 | Lege menuactie die alleen puntjes toont | bug | IMG_0294: in het hostmenu staat een omkaderde knop met alleen "…" naast Verwijder |
| 53 | Menu rendert niet consistent op elk scherm | bug | reproduceer eerst per fase (lobby / spel / reveal / eindstand) |

## Stoppunten

### B1 — reproduceren en vastleggen
- [ ] Per punt: reproduceerbaar gemaakt en in één zin beschreven **wat** er
      misgaat en **waarom** (niet "de timer werkt niet", maar de oorzaak).
- [ ] Voor 41 en 36: eerst controleren of het in de huidige tree al klopt. De
      screenshots komen van een **oudere build**; het is goed mogelijk dat een
      deel al opgelost is. Meld dat dan als uitkomst — dat is een geldig
      resultaat, geen mislukking.
- [ ] Voor 27: inschatting + voorstel, **geen bouw**.

### B2 — repareren, met test
- [ ] 32, 36, 37, 40, 52, 53 opgelost.
- [ ] Elk opgelost punt heeft een test die zónder de fix rood is. Draai die
      test één keer met de fix teruggedraaid en meld dat je dat gedaan hebt.

### B3 — 25 en 43
- [ ] Kiezen is klikbaar en bevestigt zichtbaar; Mix/Typen blijven uit (40D)
      maar leggen uit waaróm ("binnenkort" is geen uitleg).
- [ ] 43: consistentie aangetoond of het gat gevonden.
- [ ] Volledige suite groen.

## Niet doen

- **Mix of Typen aanzetten.** Besluit 40D. Dit is de meest waarschijnlijke
  fout in dit pakket.
- Punt 26, 28, 29, 30 aanraken — die vond de producteigenaar goed.
- Layout of styling "even meenemen" omdat je er toch bent. Compacter maken is
  C en D; jij repareert gedrag.
- `server/` aanraken zonder groen licht van de lead (punt 27, 41).
