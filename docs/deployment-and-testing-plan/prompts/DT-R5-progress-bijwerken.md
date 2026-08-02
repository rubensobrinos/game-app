# Prompt — DT-R5: DT-PROGRESS.md bijwerken + rapportage

Onderdeel van [`DT-RESUME-AFTER-DECISIONS.md`](DT-RESUME-AFTER-DECISIONS.md),
opdrachten 7 en 8. **Uitvoeren ná DT-R1, DT-R2 en DT-R4** — dit bestand synthetiseert
hun bevindingen, het herhaalt ze niet zelf.

## Context

`DT-PROGRESS.md` gebruikt al zes bewijsniveaus (📄/💻/✅/🚧/⚪/⏹️) — dat blijft zo.
**Geen nieuw top-level niveau toevoegen** (herzien na review: een zevende
"handmatig verifieerbaar"-categorie overlapt met 🚧 en maakt de legenda minder
eenduidig, niet meer). In plaats daarvan: het bestaande 🚧-niveau eist al een
"specifieke reden"; breid de opsomming van redenen uit met **handmatig** naast
implementatie/dependency/omgeving/autorisatie, en gebruik die voor DT4b
(devicechecks — geen dependency lost dit op, een mens met een toestel wel).

**Persistente bronnen om te lezen, geen aannames:**
- `integration-matrix.md`'s "Audit-log"-sectie (DT-R1).
- `chaos-runbook.md`'s bevestigde/gecorrigeerde markeringen (DT-R2).
- `e2e-load-target-check.md` (DT-R4).

## Stappen

1. Neem de resultaten uit de drie bronnen hierboven letterlijk over in de tabel
   "Per sectie in DEPLOYMENT-AND-TESTING.md" — citeer, verzin niets bij als een
   bron ontbreekt (meld dat expliciet in plaats van te gokken).
2. Pas de bestaande 🚧-redenopsomming toe met "handmatig" als expliciete reden voor
   DT4b, zonder een nieuw symbool of niveau te introduceren.
3. Schrijf een kort rapportageblok (nieuwe sectie "## Rapportage
   uitvoeringsakkoord", onderaan) met exact wat DT-RESUME opdracht 8 vraagt:
   - welke dependencies inmiddels daadwerkelijk aanwezig zijn (`package.json`,
     `docker-compose.yml`) versus welke nog niet (Playwright, k6) — uit
     `e2e-load-target-check.md`;
   - welke tests er sinds het uitvoeringsakkoord daadwerkelijk zijn uitgevoerd, met
     resultaat. **Tel dit daadwerkelijk na** (bijv. `git log` sinds de
     `DECISIONS.md`-commit doorzoeken op nieuwe `*.test.*`-bestanden en hun
     testrun-uitkomst) — neem niet aan dat het bij de bestaande DT2-fixtures blijft,
     andere plannen (data-model-plan, architecture-plan, protocol-plan) hebben in
     dezelfde periode zelf ook veel tests toegevoegd en gedraaid;
   - de resterende technische blockers per fase, één zin elk, geen herhaling van
     de volledige tabel.
4. Werk de datumregel bovenaan bij.

## Harde grenzen

- Geen nieuwe claims zonder dat DT-R1/R2/R4 dat bewijs al opleverden — dit
  bestand voegt niets inhoudelijks toe, het consolideert.
- Eén bestand: `DT-PROGRESS.md`.

## Definition of done

- De bestaande zes niveaus blijven ongewijzigd als verzameling; "handmatig" is
  toegevoegd als 🚧-reden, geen nieuw symbool.
- Elke tabelrij die verandert, citeert de bron (DT-R1/R2/R4-artefact), geen
  ongefundeerde upgrade van status.
- Het rapportageblok bevat concrete, nageteld cijfers (aantallen, niet "sommige"),
  of expliciet "0" waar dat de eerlijke uitkomst is.
