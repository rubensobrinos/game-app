# INTB4b — tunnel-variant, met bewijs dat de poorten dicht zijn

**Domein:** INT-B. **Blokkade:** INTB4a.

---

## Prompt

Je maakt de publieke route werkend via Cloudflare Tunnel, en bewijst dat daarbij
niet per ongeluk het thuisnetwerk openstaat.

### Lees eerst

- `docs/multiplayer/DEPLOYMENT-AND-TESTING.md`, sectie **Bereikbaarheid** — en
  let op deze passage:

  > De getoonde `ports`-mapping hoort bij directe exposure/port forwarding. Bij
  > Cloudflare Tunnel wordt die mapping in een Compose override verwijderd en
  > gebruikt `cloudflared` uitsluitend het interne `edge`-netwerk. Zo staan niet
  > alsnog onbedoeld poort 80 en 443 op de Mac open terwijl de tunnel actief is.

- `compose.tunnel.override.yml` — bestaat al.
- `caddy/Caddyfile` — TLS, routing, WebSocket-upgrade, security headers.
- De sectie **Reverse-proxy en browsersecurity** in dezelfde spec.

### Wat je doet

De tunnel-variant werkend krijgen, met de `ports`-mapping daadwerkelijk
verwijderd in de override.

### De eis die telt

**Verifieer actief dat 80 en 443 niet op de host luisteren zolang de tunnel
draait.** Niet door de configuratie te lezen, maar door te meten — een
poortscan of `lsof` vanaf de host. De spec waarschuwt hier expliciet voor, wat
betekent dat het een keer is misgegaan of makkelijk misgaat. Een override die
de mapping *lijkt* te verwijderen maar het niet doet, ziet er in YAML precies
hetzelfde uit als een die het wel doet.

Controleer daarnaast:

- WebSocket-upgrade werkt door de tunnel heen — sockets zijn de kern van dit
  spel en gaan als eerste stuk bij een verkeerd geconfigureerde proxy.
- De security headers uit de spec staan er (HSTS pas ná een geslaagde test).
- Redis en Postgres zijn van buiten onbereikbaar. Meet ook dat.

### Wat je NIET doet

- Een tunnel-token of ander secret in git zetten. `.env.example` bevat alleen
  sleutelnamen.
- HSTS aanzetten voordat de route aantoonbaar werkt — dat is moeilijk terug te
  draaien in browsers die het al hebben opgeslagen.

### Klaar wanneer

Een match is te spelen via de publieke route, en de poortmeting bewijst dat 80,
443, Redis en Postgres niet van buiten bereikbaar zijn. Daarna is Pilot A (8–15
spelers) aan de producteigenaar.

### Opleveren

De uitvoer van de poortmeting, het resultaat van de WebSocket-test door de tunnel,
welke security headers actief zijn, en of HSTS aan of uit staat met de reden.
