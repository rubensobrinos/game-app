# deploy/ — lokaal → test.rounda.io → rounda.io

De omgevingen van deze site, volgens de devkit-standaard ([ADR-0032], [ADR-0035]).
Gemaakt met `devkit template omgevingen rounda.io`.

| Omgeving | Adres | Draait uit | Database | launchd |
|---|---|---|---|---|
| lokaal | `localhost` | deze checkout | eigen dev-database | geen |
| test | `https://test.rounda.io` | `$TEST_WORKTREE` (git worktree) | `$DB_TEST` | `nl.aseso.rounda.test` |
| productie | `https://rounda.io` | `$RELEASES/live` | `$DB_PRODUCTIE` | `nl.aseso.rounda.productie` |

## Stand in deze repo (27 september 2026, kaart #100641)

- **Productie** is het compose-project `aseso-game` op deze Mac: caddy op 80/443,
  nginx-frontend, game-server, redis, postgres, en cloudflared als container op een
  token. Uitrollen gaat met de hand (`docker compose ... up -d`, zie
  `docs/fase1-runbook.md`), niet via `release.sh`. `POORT_PRODUCTIE` is leeg, dus
  `release.sh` weigert. Dit is een afwijking van ADR-0032 regel 6, voor een voorstel
  op #100642.
- **Test** is het compose-project `rounda-test`:
  - uit de worktree `~/dev/creative/rounda-test`, op `127.0.0.1:8140`;
  - met eigen volumes en een eigen database `gamestats_test`, zonder spelers of
    statistieken;
  - met eigen geheimen in `~/.config/rounda/test.env`;
  - met dezelfde Caddyfile als productie, plus het blok voor `test.rounda.io`
    (`caddy/Caddyfile.test`).

  launchd `nl.aseso.rounda.test` houdt test in de lucht, en `nl.aseso.rounda.uitrol-test`
  zet elke commit op main erop.
- **Startweigering:** naast de database-controle eist `EIS_TEST` dat
  `PUBLIC_APP_URL` `https://test.rounda.io` is (anders wijzen de QR-codes van test naar
  productie) en dat er geen tunneltoken in het test-env-bestand staat. Een tweede
  connector op het productietoken zou het verkeer van rounda.io over twee stacks
  verdelen. `compose.testsite.override.yml` start cloudflared daarom ook nooit.

### Gevonden op productie: statische bestanden geven 404 (niet aangeraakt)

De containers van `aseso-game` draaien sinds 1 september en mounten hun bestanden uit
`/Users/ruben/game-app/`. Dat pad bestaat niet meer sinds de repo naar
`~/dev/creative/rounda` verhuisde. Op rounda.io geven `/solo`, `/style.css`, `/app.js`
en alles onder `/flags/` daardoor 404. Dat raakt ook de vlaggen in de
multiplayer-schermen. Alleen de home op `/` werkt, want die komt uit de game-server.
De frontend staat daarom al weken op "unhealthy": zijn healthcheck vraagt `/` op bij
een lege map.

Oplossing (Ruben, live): de stack opnieuw aanmaken vanuit de nieuwe map. De volumes
horen bij de projectnaam, dus de data blijft staan.

```sh
cd ~/dev/creative/rounda
docker compose -f docker-compose.yml -f compose.tunnel.override.yml --profile tunnel up -d
curl -s -o /dev/null -w "%{http_code}\n" https://rounda.io/solo     # verwacht 200
```

Let op: de huidige stack is gestart zónder `compose.tunnel.override.yml`, dus 80 en
443 staan open op alle interfaces van de Mac. Het commando hierboven sluit ze, zoals
het override-bestand bedoelt. Gebruikt iets op het lokale netwerk die poorten, laat
dan `-f compose.tunnel.override.yml` weg. De chaos-stack (`aseso-game-chaos`) heeft
dezelfde oude mounts en bezet `127.0.0.1:8080`, de poort die `~/dev/0. PORTS.md` aan
aseso-invoices geeft. Hij hoort na de chaostests gestopt te worden:
`docker compose -p aseso-game-chaos down`.

### Live zetten (Ruben)

1. **Poortwachter eerst** (`~/dev/platform/devkit/poortwachter/README.md`). Hij kent
   `test.rounda.io -> 8140` al.
2. **DNS:** `test.rounda.io` bestaat al in DNS, maar geeft geen antwoord. Kijk in het
   Cloudflare-dashboard waar het record naartoe wijst, en haal een eventuele Public
   Hostname `test.rounda.io` van de productietunnel af.
3. **Tunnel:** voeg in `~/.cloudflared/config.yml` (tunnel `aseso-dev`, launchd
   `nl.aseso.devplatform.tunnel`) toe, boven de catch-all:

   ```yaml
   - hostname: test.rounda.io
     service: http://127.0.0.1:8120
   ```

   Zet het DNS-record met `cloudflared tunnel route dns aseso-dev test.rounda.io` (met
   `--overwrite-dns` als het record al bestaat). Herstart daarna de tunnel met
   `launchctl kickstart -k gui/$(id -u)/nl.aseso.devplatform.tunnel`.
4. **Controleren:**
   - `curl -sI https://test.rounda.io/ | grep -iE "^HTTP|^location|^x-robots"` geeft
     een 302 naar de login en `X-Robots-Tag: noindex, nofollow`.
   - Log in, start een spel en controleer of de join-QR naar `test.rounda.io` wijst.
   - `devkit doctor --omgevingen` meldt rounda.io als `ok`.
5. **Terugdraaien:** haal de twee regels uit `config.yml` weg, herstart de tunnel en
   zet het DNS-record terug zoals het stond.

---

Alles wat per site verschilt (poorten, databases, paden, bouw- en startcommando)
staat in [`omgeving.conf`](omgeving.conf). De scripts bevatten daar niets van.

## Dagelijks

- **Naar test:** committen op main. launchd ziet `.git/refs/heads/main` veranderen en
  start `uitrol-wachter.sh`, en test staat binnen een paar minuten op die commit. Er is
  geen git-hook voor nodig. Log: `~/Library/Logs/rounda-uitrol-test.log`.
  Met de hand, of een andere commit: `deploy/uitrollen-test.sh [ref]`, of zet een ref in
  `deploy/.uitrollen-test`.
- **Naar productie:** `devkit release-site rounda [ref]` (devkit ADR-0035), of
  rechtstreeks `deploy/release.sh [ref]`. Dit gebeurt nooit vanzelf. `--droog`
  toont alleen wat er zou gebeuren. Let op: `POORT_PRODUCTIE` is hier leeg (zie
  "Stand in deze repo" hierboven) — productie draait via het compose-project
  `aseso-game`, niet via dit pad, tot #100642 dat gelijktrekt.
- **Faalt de rookproef**, dan gaan beide scripts zelf terug naar wat er stond.

## Wat de scripts weigeren (exit 78)

- Een `DATABASE_URL*` die naar de database van de andere omgeving wijst, of die
  ontbreekt terwijl `omgeving.conf` een database noemt.
- Een variabele die het adres van de andere omgeving bevat (bijvoorbeeld
  `PUBLIC_BASE_URL=https://rounda.io` in het test-env-bestand).
- Een lege poort of een ontbrekend env-bestand.
- Een eigen eis uit `omgeving.conf` (`EIS_TEST`, `EIS_PRODUCTIE`) die niet waar is.

Er worden alleen namen van variabelen en databases gelogd, nooit waarden.

## Eenmalig inrichten

Agents mogen stap 1 tot en met 5 doen. Stap 6 en 7 zet Ruben live.

1. **`omgeving.conf` invullen.** Kies twee vrije poorten
   (`lsof -nP -iTCP:<poort> -sTCP:LISTEN` is leeg) en schrijf ze in
   `~/dev/0. PORTS.md`. Controleer `BOUWEN`, `STARTEN` en `ROOKPROEF_PADEN`.
2. **Databases:** `createdb rounda_test`, met schema maar zonder echte
   klantgegevens.
3. **Test-worktree:** `git worktree add --detach "$TEST_WORKTREE" main`.
4. **Env-bestanden:** `mkdir -p ~/.config/rounda`, maak `test.env` en
   `productie.env` aan en zet ze op `chmod 600`. Wat de buitenwereld raakt (sms,
   e-mail, betalingen) staat in `test.env` uit of wijst naar een testbestemming.
5. **Automatisch naar test** hoeft niet ingericht te worden: `nl.aseso.rounda.uitrol-test`
   kijkt naar `.git/refs/heads/main`. Is deze checkout zelf een worktree, of heet de
   hoofdbranch anders dan `main`, pas dan het pad in
   `launchd/nl.aseso.rounda.uitrol-test.plist` aan.

6. **launchd (Ruben):**

   ```sh
   for p in test productie uitrol-test; do
     plutil -lint deploy/launchd/nl.aseso.rounda.$p.plist &&
       cp deploy/launchd/nl.aseso.rounda.$p.plist ~/Library/LaunchAgents/ &&
       launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/nl.aseso.rounda.$p.plist
   done
   deploy/uitrollen-test.sh       # eerste testbuild
   devkit release-site rounda     # eerste productierelease (ADR-0035; zie voorbehoud hierboven)
   ```

7. **Tunnel en DNS (Ruben):**
   - Voeg in de cloudflared-configuratie `test.rounda.io` toe, gericht op de
     poortwachter (niet rechtstreeks op `POORT_TEST`), en `rounda.io` gericht op
     `http://127.0.0.1:<POORT_PRODUCTIE>`.
   - Maak `cloudflared tunnel route dns <tunnel> test.rounda.io` aan.
   - Controleer daarna met `devkit doctor --omgevingen`.

[ADR-0032]: https://github.com/Asesobv/devkit/blob/main/docs/decisions/ADR-0032-drie-omgevingen-lokaal-test-domein-domein.md
[ADR-0035]: https://github.com/Asesobv/devkit/blob/main/docs/decisions/ADR-0035-release-standaard-geen-symlink-tag-en-logboek.md
