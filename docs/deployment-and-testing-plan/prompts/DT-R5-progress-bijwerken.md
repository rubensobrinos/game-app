# Prompt — DT-R5: DT-PROGRESS.md bijwerken + rapportage

Onderdeel van [`DT-RESUME-AFTER-DECISIONS.md`](DT-RESUME-AFTER-DECISIONS.md),
opdrachten 7 en 8. **Uitvoeren ná DT-R1, DT-R2 en DT-R4** — dit bestand synthetiseert
hun bevindingen, het herhaalt ze niet zelf.

## Context

`DT-PROGRESS.md` gebruikt sinds de vorige review al vier bewijsniveaus (📄/💻/✅/🚧).
DT-RESUME-AFTER-DECISIONS.md vraagt een preciezere driedeling daarbovenop:
**uitgevoerd**, **technisch geblokkeerd**, **alleen handmatig verifieerbaar**
(DT4b hoort in die laatste categorie — nooit geautomatiseerd, per ontwerp).

## Stappen

1. Neem de resultaten van DT-R1 (aantal geactiveerde integratierijen, met bewijs),
   DT-R2 (bevestigde vs. gecorrigeerde chaos-aannames) en DT-R4 (Playwright-/
   k6-target ja/nee) over in de tabel "Per sectie in DEPLOYMENT-AND-TESTING.md".
2. Voeg de derde categorie "alleen handmatig verifieerbaar" toe aan de
   niveaulegenda, en pas 'm toe op DT4b (devicechecks — nooit "technisch
   geblokkeerd" in de zin dat een dependency het oplost; ze wachten op een mens
   met een toestel).
3. Schrijf een kort rapportageblok (nieuwe sectie "## Rapportage
   uitvoeringsakkoord", onderaan) met exact wat DT-RESUME opdracht 8 vraagt:
   - welke dependencies inmiddels daadwerkelijk aanwezig zijn (`package.json`,
     `docker-compose.yml`) versus welke nog niet (Playwright, k6);
   - welke tests er sinds het uitvoeringsakkoord daadwerkelijk zijn uitgevoerd,
     met resultaat (verwacht: alleen de al bestaande DT2-fixtures, tenzij DT-R1
     iets activeerde);
   - de resterende technische blockers per fase, één zin elk, geen herhaling van
     de volledige tabel.
4. Werk de datumregel bovenaan bij.

## Harde grenzen

- Geen nieuwe claims zonder dat DT-R1/R2/R4 dat bewijs al opleverden — dit
  bestand voegt niets inhoudelijks toe, het consolideert.
- Eén bestand: `DT-PROGRESS.md`.

## Definition of done

- Alle drie bewijscategorieën (uitgevoerd/technisch geblokkeerd/handmatig
  verifieerbaar) zijn consistent toegepast, niet alleen toegevoegd aan de legenda.
- Het rapportageblok bevat concrete cijfers (aantallen, niet "sommige"), of
  expliciet "0" waar dat de eerlijke uitkomst is.
