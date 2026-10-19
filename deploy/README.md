# deploy/ — lokaal → test.rounda.io → rounda.io

De omgevingen van deze site, volgens de devkit-standaard ([ADR-0032], [ADR-0035],
[ADR-0038]). Gemaakt met `devkit template omgevingen rounda.io`.

| Omgeving | Adres | Draait uit | Database | launchd |
|---|---|---|---|---|
| lokaal | `localhost` | deze checkout | eigen dev-database | geen |
| test | `https://test.rounda.io` | `$TEST_WORKTREE` (git worktree) | `$DB_TEST` | `nl.aseso.rounda.test` |
| productie | `https://rounda.io` | `$RELEASES/live` | `$DB_PRODUCTIE` | `nl.aseso.rounda.productie` |

Alles wat per site verschilt (poorten, databases, paden, bouw- en startcommando)
staat in [`omgeving.conf`](omgeving.conf). De scripts bevatten daar niets van.

Staat de testomgeving niet op `test.rounda.io` maar op een andere host — cobri-academy
draait op `academy-test.cobrigroup.com` — zet die dan als `PUBLIC_URL_TEST` in
`omgeving.conf`. Leeg of niet gezet betekent `https://test.rounda.io`. De
noindex-controle na een testuitrol gebruikt dat adres, dus zonder deze instelling
waarschuwt elke uitrol onterecht dat `X-Robots-Tag: noindex` ontbreekt.

## Dagelijks

- **Naar test:** committen op main. launchd ziet `.git/refs/heads/main` veranderen en
  start `uitrol-wachter.sh`, en test staat binnen een paar minuten op die commit. Er is
  geen git-hook voor nodig. Log: `~/Library/Logs/rounda-uitrol-test.log`.
  Met de hand, of een andere commit: `deploy/uitrollen-test.sh [ref]`, of zet een ref in
  `deploy/.uitrollen-test`.
- **Naar productie:** `devkit release-site rounda.io [ref]` (devkit ADR-0035), of
  rechtstreeks `deploy/release.sh [ref]`. Dit gebeurt nooit vanzelf. `deploy/release.sh --droog [ref]`
  (en `devkit release-site rounda.io --droog`) toont alleen wat er zou gebeuren en de stand van de ci-poort: exit 0 = een echte release zou
  doorgaan, exit 1 = de poort weigert. Er wordt niets gebouwd, omgewisseld, herstart, getagd of gelogd.
- **Faalt de rookproef**, dan gaan beide scripts zelf terug naar wat er stond.
- **Controle zonder iets te starten:** `deploy/controleer-config.sh [--streng]` meldt in één keer alle bezwaren tegen `omgeving.conf` en de
  env-bestanden (verplichte variabelen, poorten, de weigeringen van `omgeving_eisen` per omgeving, nooit een waarde uit een env-bestand). Draai het
  vóór de eerste uitrol (met `--streng`) en na elke wijziging aan de configuratie.

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
   (`devkit claim poort vrij`, of `lsof -nP -iTCP:<poort> -sTCP:LISTEN` is leeg) en
   claim ze met `devkit claim poort claim <poort> --kaart <nr> --dienst <naam>`. Controleer `BOUWEN`, `STARTEN` en `ROOKPROEF_PADEN`.
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
   deploy/uitrollen-test.sh          # eerste testbuild
   devkit release-site rounda.io    # eerste productierelease (ADR-0035)
   ```

7. **Tunnel en DNS (Ruben):**
   - Voeg in de cloudflared-configuratie `test.rounda.io` toe, gericht op de
     poortwachter (niet rechtstreeks op `POORT_TEST`), en `rounda.io` gericht op
     `http://127.0.0.1:<POORT_PRODUCTIE>`.
   - **Gebruik `cloudflared tunnel route dns` nooit buiten de eigen zone.** Dat
     commando zet het CNAME alleen in de zone van het certificaat van de tunnel
     (`cert.pem`); een hostnaam in een andere zone levert geen record op. Hoort
     `rounda.io` bij een andere zone, maak het record dan in het
     Cloudflare-dashboard of met een API-token dat DNS-edit heeft op alle betrokken
     zones. `devkit validate-structure` signaleert dit commando in draaiboeken,
     README's en deploy-scripts (ADR-0032, regel 9).
   - Controleer daarna met `devkit doctor --omgevingen`.

## Health (ADR-0062)

Twee endpoints voor statusmonitoring en readiness-checks:

- **`GET /health`** is liveness: leeft het proces? Snel, geen I/O. Antwoord: HTTP 200 met `{"status": "ok"}`.
- **`GET /health/ready`** is readiness: kan het werk doen? Controleert de afhankelijkheden. Antwoord: HTTP 200 (of 503 als `status: down`) met `{"status": "ok"|"degraded"|"down", "dienst": "rounda", "versie": "...", "checks": {...}}`.

Voor een FastAPI-app: zie `deploy/health-fastapi.py` voor een voorbeeld. Kopieer het naar je app, vul `CHECKS` met je eigen afhankelijkheden en voeg de router toe met `app.include_router(router)`. Andere frameworks volgen dezelfde vorm.

Voor statische sites (HTML, Assets): zorg dat je buildstap `deploy/schrijf-health.sh <uitvoermap> [versie]` aanroept. Dit schrijft `health.json` en `health-ready.json` naar de opgegeven map (meestal je publicatiemap). De webserver serveert deze als vaste bestanden met `Content-Type: application/json`.

Voorbeelden:

**nginx:**
```nginx
location = /health {
  default_type application/json;
  try_files /health.json =404;
}

location = /health/ready {
  default_type application/json;
  try_files /health-ready.json =404;
}
```

**Node (Express):**
```javascript
const fs = require('fs');
const path = require('path');

app.get('/health', (req, res) => {
  const health = fs.readFileSync(path.join(__dirname, 'health.json'), 'utf8');
  res.type('application/json').send(health);
});

app.get('/health/ready', (req, res) => {
  const ready = fs.readFileSync(path.join(__dirname, 'health-ready.json'), 'utf8');
  res.type('application/json').send(ready);
});
```

[ADR-0032]: https://github.com/Asesobv/devkit/blob/main/docs/decisions/ADR-0032-drie-omgevingen-lokaal-test-domein-domein.md
[ADR-0035]: https://github.com/Asesobv/devkit/blob/main/docs/decisions/ADR-0035-release-standaard-geen-symlink-tag-en-logboek.md
[ADR-0038]: https://github.com/Asesobv/devkit/blob/main/docs/decisions/ADR-0038-sites-test-worktrees-en-productiemappen-naar-een-vaste-plek-per-site.md
