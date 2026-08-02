# Review — GF0 scaffold en GF1 route-resolver

Reviewdatum: 2026-08-02

## Conclusie

Beide prompts zijn uitvoerbaar zonder verborgen aannames. Er blijven twee punten
over die geen bug zijn maar een keuze die niet bij mij alleen hoort te liggen:
naamgeving van de scaffold-locatie, en de timing van de drie losse
scaffold-bevestigingen die momenteel parallel aan de gebruiker gevraagd worden.

## Bevindingen

### 1. Middel — `client/` vs `frontend/` is een onbesliste naamskeuze, geen vaststaand feit

`ARCHITECTURE.md` en `DEPLOYMENT-AND-TESTING.md` gebruiken uitsluitend `frontend`
als containernaam en broncomponent; "client" komt alleen voor als term voor de
browser/het toestel ("mobiele webclients"), nooit als mapnaam. Mijn voorstel
`client/flow/` in GF0 kiest bewust een ándere naam dan `frontend/`, met als
redenering dat dit een tijdelijke, build-loze plek is die niet moet suggereren dat
hij al samenvalt met de toekomstige `frontend/dist`-brontree.

Dat is een verdedigbare keuze, maar wel een echte — niet iets dat al uit de specs
volgt. Als de uiteindelijke `frontend/`-boom er komt, is een latere hernoeming van
`client/` → `frontend/src/flow/` een extra stap die te voorkomen was geweest.

**Voorstel:** leg deze keuze expliciet aan de gebruiker voor bij de GF0-bevestiging
(al in stap 1 van `GF0-scaffold.md` gevraagd), in plaats van hem te laten doorlopen
als vanzelfsprekend.

### 2. Middel — drie scaffold-voorstellen worden onafhankelijk van elkaar bevestigd

`server/rules/` (GAME-RULES), `server/architecture/` (ARCHITECTURE) en `client/flow/`
(dit plan) zijn drie losse go/no-go-momenten bij drie losse agents. Ze vormen samen
straks één repo-layout; onafhankelijk bevestigen kan tot inconsistente conventies
leiden (bijvoorbeeld: twee mappen onder `server/` maar de derde niet onder een
vergelijkbare `frontend/`-koepel).

**Voorstel:** geen wijziging aan de prompts zelf — dit is iets voor de gebruiker om
te regisseren (bijvoorbeeld: alle drie de GR0/AR0/GF0-voorstellen in één keer bekijken
vóórdat een van de agents doorgaat naar de eerste echte modulecode).

### 3. Laag — de nginx/Caddy-rewrite-aanname is impliciet correct maar ongetest

GF1 gaat er terecht van uit dat `resolveRoute` alleen kale strings ziet en geen
routing-server nodig heeft. Dat klopt voor de unit-tests, maar niemand test op dit
moment of de uiteindelijke Caddy-config (nog te bouwen, `DEPLOYMENT-AND-TESTING.md`)
daadwerkelijk alle vier de paden naar `index.html` doorstuurt. Dat hoort niet in GF1
thuis, maar ontbreekt ook nergens expliciet in een ander plan als to-do.

**Voorstel:** geen actie nu; opnemen als contracttest zodra `DEPLOYMENT-AND-TESTING.md`
wordt gerealiseerd (buiten scope van dit plan, alleen hier genoteerd zodat het niet
tussen wal en schip valt).

## Wat al goed staat

- GF0 pauzeert terecht vóór een naamskeuze en een dependency-beslissing.
- GF1 retourneert bewust geen rol/recht-veld en waarschuwt expliciet tegen
  `innerHTML` op de teruggegeven identifier — sluit aan bij PROTOCOL.md
  §Inputveiligheid.
- Testgevallen 9–11 dekken case-sensitiviteit, prefix-verwarring en het ontbreken
  van een identifier voor alle vier de routes, niet alleen de eerste.
- De schaal-toets (#12) maakt "geen rol/recht-veld" toetsbaar in plaats van alleen
  een claim in proza.
- Scope-afbakening t.o.v. `PROTOCOL.md` (roomvalidatie), sessies en `joinSource` is
  expliciet, niet impliciet aangenomen.

## Advies vóór uitvoering

Beslis bevinding 1 (`client/` vs. `frontend/`) bij de GF0-bevestiging zelf — dat staat
al zo in de prompt. Bevinding 2 is een proces-vraag voor jou, niet iets wat ik als
agent kan oplossen door een prompt aan te passen. Daarna kunnen GF0 en GF1 zonder
verborgen aannames worden uitgevoerd.
