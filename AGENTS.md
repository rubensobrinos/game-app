# AGENTS.md - Game app

## Wat agents zelfstandig mogen doen
- Lint-fouten en type-errors corrigeren
- Tests schrijven en uitvoeren
- Docstrings en README bijwerken
- Refactoring binnen bestaande modules

## Wat menselijke goedkeuring vereist
- Dependencies toevoegen of upgraden
- Publieke API-contracten aanpassen
- Database-migraties aanmaken of uitvoeren
- Deployment-gerelateerde wijzigingen

## Conventies
TODO: voeg repo-specifieke conventies toe.

Zie ook: `devkit policy --json` voor machine-leesbare autonomy-limieten.

## Repo-eigen autonomy-overrides

De waarden in `.devkit.yaml` zijn voor deze repo leidend: maximaal 15 gewijzigde
bestanden en 5.000 gewijzigde regels zonder extra goedkeuring. In Devkit 0.15 toont
`devkit policy --json` ten onrechte alleen de globale defaults; de daadwerkelijke
`devkit check-autonomy` voegt de repo-overrides wel correct samen. Agents gebruiken
de checker als autoriteit en mogen geen strengere zelfbedachte bestands- of
regellimiet opleggen.
