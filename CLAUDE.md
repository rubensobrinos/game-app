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
- **Product lead op dit project?** Meld je aan in de projectchat van het bord (of `.regie/chat.md` van de PL) en lees die bij start; besluiten daar gaan vóór de kaarttekst. Zet zelf je wekker, nooit AskUserQuestion: vragen naar de PL — zie docs/werkwijze/regie.md § Regie (ADR-0050).
- **Thuismap:** maak nooit mappen of bestanden direct in `~/`. Code: `~/dev/…`; test/productie: `~/.devkit/sites/<naam>/`; geheimen: `~/.config/<app>/` (map 700, bestanden 600). Controle: `devkit doctor --thuismap` — zie docs/werkwijze/mac.md § Thuismap (ADR-0040).
- **Sleutelhanger:** nooit een eigen sleutelhanger aanmaken, nooit een sleutelhanger vergrendelen of zijn instellingen/wachtwoord wijzigen, nooit ACL/partition-lists aanpassen; secrets alleen in de login-keychain of `~/.config/<app>/` (600). Controle: `devkit doctor --keychain` — zie docs/werkwijze/mac.md § Sleutelhanger (ADR-0046).
- **Mappenbeleid in `~/dev`:** bovenaan alleen `platform`, `producten`, `creative`, `cobri-group`, `bedrijfsvoering`, `klanten`, `archief`; worktrees alleen onder `~/.devkit/worktrees/<repo>-<kaart>`; geen productie- of releasemappen (`~/.devkit/sites/<site>/productie`) en geen logs van diensten in `~/dev`; maak nooit mappen bovenaan `~/dev` en bouw nooit paden relatief aan `~/dev`. Controle: `devkit doctor --devmap` — zie docs/werkwijze/mac.md § Mappenbeleid (ADR-0061).
- **Testen:** tests alleen voor gedrag, één test per gedrag op het laagste niveau dat het bewijst; bewijs op een kaart is een groene run van de bestaande suite. Grens: testcode hoogstens 2x de app-code (`devkit stats --tests`; rood in `devkit ci` voor een repo op `ci.teststrategie: streng`, anders een waarschuwing). Nooit tests weghalen om onder de grens te komen; een bestaande suite afslanken is een aparte kaart, met bewijs dat hetzelfde gedrag gedekt blijft (bijvoorbeeld een mutatietest) en een review. Zie docs/werkwijze/kwaliteit.md § Testen (ADR-0049).

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

## Doorwerken

Je stopt niet na één kaart. Je werkt door tot er in dit project geen kaart meer is die je kunt doen. Eerst wat je PL toewijst, daarna de todo-kaart met de hoogste prioriteit die niemand heeft. Loop je vast: noteer in de feedback wat ontbreekt en wie het moet oplossen, zet de kaart op review of terug op todo met 'geblokkeerd: ...', meld het in één regel in het kanaal en pak meteen de volgende kaart. Wachten is geen reden om te stoppen. Pas als er niets meer is: meld 'rij leeg' en lees het kanaal over 30 minuten opnieuw.

- **Melden in het kanaal:** bij elke kaart die je pakt één regel ("#nr gepakt"), en bij elke kaart die je afrondt één regel ("#nr done"). Zo ziet de PL altijd de voortgang.
- **Reviewrij:** staan er in dit project 10 of meer kaarten op `review`, review je eerst kaarten van anderen voordat je een nieuwe kaart pakt. Zet ze op `done` of terug op `todo` met de reden, en meld dat in het kanaal. Review nooit je eigen werk.
- **Voor een PL:** een opdracht aan een agent noemt de kaarten in volgorde, plus de regel dat hij daarna zelf doorpakt. Nooit alleen "pak kaart X op".

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

**Altijd vragen aan een human**:

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

- DevKit-revisie: `0.50.11`
- Config-versie: `0.50.11`
- Config-bron: `bundled`
- Policy-revisie (agent-rules.md versie): `1.1`
- Policyclassificatie (ENFORCED/ADVISORY/DOCUMENTED): `devkit policy --json` → `agent_rules.rule_modes`.
<!-- END DEVKIT MANAGED -->
