<!-- BEGIN DEVKIT MANAGED -->
<!-- Voeg lokale wijzigingen BUITEN deze markers toe — devkit update overschrijft alleen dit blok. -->
# Repo: profiel `node-esm-app`

**Eindantwoord in je sessie = één regel, max 300 tekens; details op de kaart.**

Node.js ESM application, JavaScript with JSDoc and the built-in node:test runner
Taal: **javascript**

## Hoe deze repo werkt

- Standaarden komen uit het devkit-profiel — zie `devkit show-profile` voor de details.
- Mandatory gates draaien via `devkit ci` (lokaal) en de GitHub Actions CI (remote).
- Voor uitleg over een specifieke gate: `devkit explain gate <naam>`.
- Voor het volledige beleid (gates, advisory, autonomy): `devkit policy --json`.
- Nieuwe repo of groot plan? Eerst de winkel checken: `python3 ~/dev/platform/thereisacodeforit/scripts/cli.py toonbank "<plan>"` (of `GET http://127.0.0.1:8090/api/toonbank`) en de uitkomst terugmelden — advisory, zie docs/werkwijze/hergebruik.md § Herbruikbaarheid.
- **Nieuw product of nieuwe repo?** Vóór je een plan, profiel of repo-sjabloon kiest eerst het stackadvies: `python3 ~/dev/platform/thereisacodeforit/scripts/cli.py stackadvies "<product in gewone taal>"` (of `GET http://127.0.0.1:8090/api/stackadvies?plan=…`). Neem het advies (stack per laag, alternatief, afweging, gaten) op in het plan; wijk je af, zet dan de reden erbij. Draait de winkel niet: een waarschuwing in het plan, geen blokkade — zie docs/werkwijze/hergebruik.md § Herbruikbaarheid (ADR-0048).
- **Product lead op dit project?** Meld je aan in de projectchat van het bord (of `.regie/chat.md` van de PL) en lees die bij start; besluiten daar gaan vóór de kaarttekst. Zet zelf je wekker. Een vraag mag in het kanaal, maar je wacht nooit op een antwoord — zie 'Zelf beslissen' hieronder en docs/werkwijze/regie.md § Regie (ADR-0050, ADR-0101).
- **Thuismap:** maak nooit mappen of bestanden direct in `~/`. Code: `~/dev/…`; test/productie: `~/.devkit/sites/<naam>/`; geheimen: `~/.config/<app>/` (map 700, bestanden 600). Controle: `devkit doctor --thuismap` — zie docs/werkwijze/mac.md § Thuismap (ADR-0040).
- **Sleutelhanger:** nooit een eigen sleutelhanger aanmaken, nooit een sleutelhanger vergrendelen of zijn instellingen/wachtwoord wijzigen, nooit ACL/partition-lists aanpassen; secrets alleen in de login-keychain of `~/.config/<app>/` (600). Controle: `devkit doctor --keychain` — zie docs/werkwijze/mac.md § Sleutelhanger (ADR-0046).
- **Mappenbeleid in `~/dev`:** bovenaan alleen `platform`, `producten`, `creative`, `cobri-group`, `bedrijfsvoering`, `klanten`, `archief`; worktrees alleen onder `~/.devkit/worktrees/<repo>-<kaart>`; geen productie- of releasemappen (`~/.devkit/sites/<site>/productie`) en geen logs van diensten in `~/dev`; maak nooit mappen bovenaan `~/dev` en bouw nooit paden relatief aan `~/dev`. Controle: `devkit doctor --devmap` — zie docs/werkwijze/mac.md § Mappenbeleid (ADR-0061).
- **Testen:** tests alleen voor gedrag, één test per gedrag op het laagste niveau dat het bewijst; bewijs op een kaart is een groene run van de bestaande suite. Grens: testcode hoogstens 2x de app-code (`devkit stats --tests`; rood in `devkit ci` voor een repo op `ci.teststrategie: streng`, anders een waarschuwing). Nooit tests weghalen om onder de grens te komen; een bestaande suite afslanken is een aparte kaart, met bewijs dat hetzelfde gedrag gedekt blijft (bijvoorbeeld een mutatietest) en een review. Zie docs/werkwijze/kwaliteit.md § Testen (ADR-0049).
- **Productiedatabase:** vóór een schrijfactie op een productiedatabase eerst een back-up van de betrokken tabellen (`pg_dump -t <tabel> ... > ~/.devkit/sites/<site>/backups/<bestand>.sql`), met het pad in de feedback van de kaart. Geen automatische terugrol bij een mislukte migratie — zie devkit ADR-0098. Zie docs/decisions/ADR-0100 voor waar de rechten op productie staan.
- **Restmateriaal:** alles wat je buiten git op schijf of in Docker achterlaat (werkkopieën en branches, dumps en back-ups, kopieën van config- en env-bestanden, images en containers voor test of proef, screenshots, meetresultaten, losse scripts in /tmp of scratch) is van jou en heeft een termijn: standaard 24 uur; werk op review tot de kaart dicht is plus 24 uur; gestopte terugweg-containers 7 dagen; back-ups de laatste 3 per doel, hooguit 30 dagen. Langer bewaren: reden en termijn in `~/.devkit/restmateriaal.jsonl` (`devkit clean --registreer <pad> --soort … --kaart … --agent … --termijn … --reden …`). Over de termijn is rood (`devkit clean --restmateriaal`) — zie docs/decisions/ADR-0104.
- **Releasepoort:** elke commit krijgt één oordeel, PASS, FAIL of BLOCKED (`devkit release-site <site> --alleen-poort`, exit 0/1/2). Een uitrol naar productie kan alleen bij PASS; een ontbrekende voorziening (`release_poort.voorzieningen` in `.devkit.yaml`) of een sha zonder bewijs is altijd BLOCKED, nooit PASS. De uitkomst staat per repo in ADM — zie devkit ADR-0106.

## Bord (action-list)

Twee wegen naar het bord; welke je hebt hangt af van waar je draait (docs/werkwijze/bord.md, ADR-0041):

- **Agent op de Mac** (VS Code, Claude Code): de API op `127.0.0.1:8085` of de bord-MCP.
- **Cowork-sessie** (Claude desktop-app, afgeschermde VM): alleen de MCP-tools van de app (`kaarten`, `kaart`, `kaart_aanmaken`, `kaart_bijwerken`, `kaart_claimen`, `kaart_vrijgeven`, `punt_toevoegen`, `punt_afvinken`, `feature_taken`, `reviewrij`). `127.0.0.1:8085` is vanuit die VM onbereikbaar: niet met `curl` proberen.
- Schrijf **nooit rechtstreeks in `action-list.db`** (lezen mag).
- Eerst dubbelchecken (`kaarten` met `zoek`): bestaat er al een kaart, voeg dan een punt toe in plaats van een nieuwe kaart.
- Handmatige stappen voor Ruben: een punt op OpdeMac `#100655`, geen losse kaart.
- Geen bord-tools? Geef de kaarttekst als prompt terug aan Ruben, voor een agent op de Mac; raad geen endpoints.
- Nooit sleutelwaarden, tokens of `docker inspect`-uitvoer met env in een kaart of in de chat.
- Het verslag van een kaart hoort **in de kaart**: veld `feedback` (max 400 tekens; MCP `kaart_bijwerken(feedback=…)`, API `PATCH /acties/{id}`). Nooit een los `.md`-verslag (`verslagen/`, `rapporten/`): de commit-msg-hook waarschuwt bij een nieuw verslagbestand. Vraagt Ruben er in het gesprek om, zet dan `[md-verslag gevraagd]` in de commitboodschap.
- Prioriteit is schaars: hooguit 3 open `hoog`/`kritiek` per project. Is het vol, kies `normaal`, tenzij er een aantoonbare blokkade is (ADR-0043).
- Naar `review` alleen met bewijs: in `feedback` de regels `sha: <commit, 7-40 hex>` en `bewijs: <regel uit runs.jsonl of testuitvoer>`; anders weigert de API (ADR-0044). Zodra het bord het afdwingt (#101284) ook `model: <naam>` (haiku, sonnet, …; hoofdmodel eerst). Een kaart die via review kwam, zet de lead of een andere agent naar `done`, nooit de schrijver.

## Werkregels van Ruben

1. Werk door tot er geen claimbare of reviewbare kaarten meer zijn. Een beurt eindigt nooit met een vraag of een verzoek om toestemming. Loop je vast: zet het op de kaart en in het vastlooplog (`devkit vast`), kaart terug naar todo of review, pak de volgende. "Gestopt bij een natuurlijk punt" bestaat niet.
2. Bij Ruben ligt alleen: geld, sleutels en de productie-go. Zet dat met `wacht_op_mens` op de kaart en werk intussen door. Al het andere doe je zelf: pushen, mergen, uitrollen naar test, diensten laden of herstarten, opruimen. Een productie-release zet je klaar tot alleen zijn go ontbreekt.
3. Ruben draait geen terminalcommando's. Wat je voor hem op een kaart zet, is hooguit een klik in een dashboard of een sleutel aanmaken, in gewone woorden.
4. Verzin geen grenzen, limieten, afkoeltijden, maximale rondes of looptijden waar niemand om vroeg en die niet op data rusten.
5. Lees het bord opnieuw voordat je iets parkeert, als geblokkeerd meldt of als "wacht op" noteert.
6. Blijf binnen je opdracht. Werk dat bij een ander project hoort, zet je als kaart in dat project. Raak geen kaarten van een feature die een andere coordinator heeft.
7. Een coordinator zorgt dat alle kaarten van zijn opdracht worden uitgevoerd en verdeelt ze zelf over agents die hij spawnt.
8. Geen meldplicht: je hoeft niet in het kanaal te melden dat je begint of klaar bent. Het resultaat staat op de kaart.
9. Beveiligingsupdates van afhankelijkheden voer je altijd meteen door, zonder te vragen.
10. Eerst op test, daarna bekijkt de PL het op test, pas dan productie. Noem iets alleen "live" als het op test zichtbaar is.
11. Geen vermoedens over Rubens machines of netwerk als feit: meet het, of zeg dat je het niet weet. Noem exacte aantallen, geen "ongeveer" als het getal op te zoeken is.
12. Geen symlinks of snelkoppelingen, geen wegwerp-worktrees, geen losse promptbestanden (prompts horen in de kaart), geen geheimen in kaarten of repo, geen meldingen via e-mail.
13. We bouwen zelf. Stel geen kant-en-klare diensten van derden voor.
14. Releases noem je met hun echte versiecode.
15. Wacht nooit op een geplande ronde, een timer of een wachtlus als je het zelf nu kunt draaien (CI, een meting, een controle). Loop je vast op je eigen gereedschap (profiel, map, instelling), los dat eerst op.

## Doorwerken

Je stopt niet na één kaart. Eerst wat je PL toewijst, daarna de todo-kaart met de hoogste prioriteit die niemand heeft. Wachten is geen reden om te stoppen.

- **Reviewrij:** staat er een kaart op `review` die je mag reviewen, doe die eerst (een claim op een andere kaart geeft 409). Zet hem op `done` of terug op `todo` met de reden. Review nooit je eigen werk.
- **Voor een PL:** een opdracht aan een agent noemt de kaarten in volgorde, plus de regel dat hij daarna zelf doorpakt. Nooit alleen "pak kaart X op".
- **Coördinator (besluit Ruben 27-10, kaart #103923):** Een coördinator krijgt nooit één kaart. Hij krijgt de hele set: alle kaarten van een tag, feature of project. Hij zorgt dat ze allemaal worden uitgevoerd en verdeelt ze over agents die hij zelf start. Iedereen werkt op main, zonder worktrees. Raken twee kaarten dezelfde bestanden, dan geeft hij ze samen aan één agent. Hij stopt pas als elke kaart van de set done is of geblokkeerd op geld of sleutels.

## Zelf beslissen

Gebruik nooit AskUserQuestion. Je bent zelf verantwoordelijk en beslist zelf: er is geen verschil in gezag tussen agents. De PL coördineert, maar je wacht niet op de PL of op Ruben. Is iets onduidelijk, kies dan de redelijkste aanpak, zet je keuze en de reden in één regel in de feedback en ga door. Loop je vast op iets wat je echt niet kunt (geld, aankopen, sleutelwaarden), zet het op de kaart en pak de volgende kaart. Vragen in het kanaal mogen, maar je wacht nooit op het antwoord.

## Vastlopen

Wie vastloopt, schrijft het weg en pakt de volgende kaart: `devkit vast <soort> <kaart> "<wat precies niet kon>"`. Soorten: toestemming-geweigerd, sleutel-ontbreekt, rechten-of-toegang-ontbreekt, netwerk-onbereikbaar, besluit-nodig, externe-afhankelijkheid, passief-gestopt. Alleen werk dat niet of maar deels kan: wachten, traag tempo, botsingen met andere agents, een claim van een ander of een tweede poging zijn geen blokkade. Lees eerst `devkit vast lijst --open` (`--project`, `--soort`): is de blokkade bekend, verwijs ernaar in plaats van opnieuw te onderzoeken. Is hij opgelost: `devkit vast opgelost <id> "<hoe>"` (ADR-0105).

## Beslisbevoegdheid

**Zelfstandig uitvoeren** (geen bevestiging nodig):

- lint
- test
- format
- refactor
- docs
- bugfix
- design
- ux
- deps
- prod
- architecture

**Naar Ruben via `wacht_op_mens` op de kaart** (nooit als vraag aan het eind van je beurt; werk intussen door):

- purchases
- secrets
- data_deletion
- customer_production
- force_push

## Autonomy-grenzen

Er staat **geen grens op het aantal bestanden of regels** per wijziging of commit (ADR-0009). Werk dat bij elkaar hoort gaat in één commit — niet opknippen.

Wel begrensd — deze paden raak je niet zonder overleg:

- `infra/prod/**`
- `.github/workflows/deploy.yml`

Controleren kan met `devkit check-autonomy --staged`; die meldt de omvang ter informatie en blokkeert alleen op verboden paden.

## Skills

- `.claude/skills/devkit-policy.md` — toont de actieve gates, advisory en agent-rules.
- `.claude/skills/devkit-explain.md` — uitleg-on-demand voor profielen, gates en mappen.

## Rollback

Bij problemen met de gegenereerde `.claude/`-configuratie:

```bash
rm -rf .claude/
git restore .pre-commit-config.yaml
devkit doctor --here
```

## Herkomst

- DevKit-revisie: `0.50.32`
- Config-versie: `0.50.32`
- Config-bron: `editable`
- Policy-revisie (agent-rules.md versie): `1.1`
- Policyclassificatie (ENFORCED/ADVISORY/DOCUMENTED): `devkit policy --json` → `agent_rules.rule_modes`.
<!-- END DEVKIT MANAGED -->
