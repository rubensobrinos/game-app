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

Afspraken die in dit repo zijn ontstaan doordat het misging. Elke regel heeft een
concrete aanleiding; het zijn geen algemene wijsheden.

**Een gat in een besluit vul je met een besluit, niet met een comment.**
`DECISIONS.md` besluit 1 legde "één hostactie per ronde" vast maar zei niets over
de situatie waarin de tussenstand uitstaat. Dat gat is met een als-interpretatie
gemarkeerd comment in een modulekop ingevuld. Een ander domein las hetzelfde
besluit letterlijk, en de combinatie leverde een deadlock op waarin de server
wachtte op een knop die de client nooit toont. Raakt je invulling het gedrag van
een ander domein, dan hoort ze in `DECISIONS.md` thuis.

**Nooit breed stagen.** Er werken meerdere agents in dezelfde working tree. `git
add -A` of zelfs `git add <map>/` sleept werk van anderen mee. Stage expliciet je
eigen paden en controleer met `git status` wat er klaarstaat.

**Werk op `main`, geen feature-branches.** Een eigen branch haalt je werk juist
uit de gedeelde lijn, terwijl anderen doorbouwen. Commit klein en vroeg: als een
module onder je verandert, wil je dat binnen minuten zien in een rode test en niet
over een week in een onontwarbare integratie.

**Verifieer de uitkomst van een subagent zelf.** Draai de tests, reproduceer een
bevinding. Een groene suite van een agent die zijn eigen implementatie testte is
geen bewijs; een adversariële review vond in dit repo drie echte defecten ná zo'n
groene suite.

**Bouw geen tweede mechanisme naast dat van een eigenaar.** Geen eigen
hashfunctie naast `auth-session.mjs`, geen tweede fasetabel naast de state
machine, geen eigen moeilijkheidsmapping naast `shared/content/`. Twee bronnen
voor dezelfde waarheid lopen gegarandeerd uit elkaar.

**Vind je een gat in andermans module, bouw er dan niet omheen.** Meld het als
genummerd item in de HANDOFF van je plan en ga verder met wat wél kan. Een
omweg verbergt het probleem precies zolang tot het duur is.

Zie ook: `devkit policy --json` voor machine-leesbare autonomy-limieten.

## Repo-eigen autonomy-overrides

De waarden in `.devkit.yaml` zijn voor deze repo leidend: maximaal 15 gewijzigde
bestanden en 5.000 gewijzigde regels zonder extra goedkeuring. In Devkit 0.15 toont
`devkit policy --json` ten onrechte alleen de globale defaults; de daadwerkelijke
`devkit check-autonomy` voegt de repo-overrides wel correct samen. Agents gebruiken
de checker als autoriteit en mogen geen strengere zelfbedachte bestands- of
regellimiet opleggen.
