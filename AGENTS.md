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

**Een verificatie is pas bewijs als het happy path ook echt gelopen heeft.**
Twee keer op één dag ging dit mis, allebei op dezelfde manier: de negatieve
controle slaagde omdat het positieve geval nooit had plaatsgevonden. Eerst een
handshake-probe waarin álle verbindingen werden geweigerd — óók de geldige,
doordat de auth verkeerd genest was — waarna "geen token in de logs" niets
bewees. Daarna een lekcontrole waarvan de `POST /games` een 400 gaf, zodat er
nooit een sessietoken bestond om te kunnen lekken.

Assert daarom eerst dat de opzet is gelukt (`statusCode === 201`, er ís een
token, de verbinding stáát) en pas daarna wat je wilde toetsen. Een test die
groen wordt omdat er niets gebeurde, is erger dan geen test: hij geeft
zekerheid zonder dekking.

Zie ook: `devkit policy --json` voor machine-leesbare autonomy-limieten.

## Werkwijze

Dit repo wordt per specificatiedocument opgebouwd door aparte rollen (GR, GF, DM,
PR, AR, PD, DT, CT, INT). Elke rol heeft een eigen map onder `docs/*-plan/` met
een `README.md` (het plan), een `*-PROGRESS.md` (de stand) en een `HANDOFF.md`
(wat andere eigenaren moeten oplossen). `docs/STATUS.md` is de actuele waarheid en
wint van elk PROGRESS-bestand; `docs/multiplayer/DECISIONS.md` is bindend en wint
van alles.

De werkwijze die zich heeft bewezen, in volgorde:

1. **Schrijf eerst de prompt, laat die reviewen, bouw daarna pas.** Een review op
   de opdracht is goedkoper dan een review op de code. De eerste promptreview hier
   vond zes gaten die anders in de implementatie waren beland.
2. **Pin de naad vast vóór je uitwaaiert.** Bepaal zelf het gedeelde contract
   tussen twee stukken werk — een contextobject, een functiesignatuur — en zet dan
   pas twee agents parallel. Zonder die naad bouwen ze tegen elkaar aan.
3. **Scheid bouwen van toetsen.** Laat implementatie en testsuite door
   verschillende agents schrijven, uit dezelfde spec, zonder elkaars bestand te
   lezen. Een suite van de agent die zijn eigen code testte bewijst weinig.
4. **Review adversarieel.** Geef reviewers een expliciete bril (spec-conformiteit,
   defectjacht, mutatietesten) en de opdracht te wéérleggen. Drie echte defecten
   in deze repo zijn zo gevonden ná een groene suite.
5. **Verifieer zelf.** Draai de tests, reproduceer de bevinding. Neem geen enkele
   uitkomst van een subagent op zijn woord.
6. **Commit per onderwerp, klein en vroeg.** Controleer `git diff --cached` vóór
   elke commit: er werken meerdere agents in dezelfde tree en er staat geregeld
   werk van een ander klaar in de index.

Parallelliseer waar het kan. Werk dat geen state deelt hoort niet op elkaar te
wachten; één blok serieel afwerken kost hier aantoonbaar dagen.

## Handoff tussen domeinen

Wie een probleem vindt lost het niet op — hij beschrijft het zo dat de eigenaar
het goedkoop kan oplossen. De volledige principes, met de aanleiding per regel,
staan in [`docs/handoff-principles.md`](docs/handoff-principles.md).

Samengevat: meld met een reproductie, doe een concreet voorstel maar neem het
besluit niet, zet er urgentie bij als het tijdkritisch is, pin het gat vast in
een test met de opdracht die om te draaien, en bouw er nooit stil omheen. Ook
als je zelf de eigenaar bent schrijf je het item — anders verdwijnt de
traceerbaarheid.

## Repo-eigen autonomy-overrides

De waarden in `.devkit.yaml` zijn voor deze repo leidend: maximaal 15 gewijzigde
bestanden en 5.000 gewijzigde regels zonder extra goedkeuring. In Devkit 0.15 toont
`devkit policy --json` ten onrechte alleen de globale defaults; de daadwerkelijke
`devkit check-autonomy` voegt de repo-overrides wel correct samen. Agents gebruiken
de checker als autoriteit en mogen geen strengere zelfbedachte bestands- of
regellimiet opleggen.
