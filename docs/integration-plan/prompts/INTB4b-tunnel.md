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

### Vóór je iets activeert — dit maakt een route publiek bereikbaar

Het uitvoeringsakkoord in `DECISIONS.md` dekt test- en deploymentwerk, maar houdt
publieke routes, productiegegevens en secrets **afzonderlijk afgeschermd**. Een
tunnel opzetten is geen testhandeling: hij stelt een draaiende stack open voor
het internet. Vraag daarom expliciet bevestiging voordat je hem activeert, en
leg vast:

- **welke omgeving** is aangewezen als test-/tunnelomgeving;
- **welke hostname** wordt gebruikt;
- **dat er geen productiegegevens** in de aangesloten Redis of Postgres zitten —
  controleer dat, neem het niet aan;
- **dat HSTS uit blijft** tenzij daar apart om wordt gevraagd. HSTS is in
  browsers die het al hebben opgeslagen nauwelijks terug te draaien.

Krijg je die bevestiging niet, dan voer je deze prompt niet uit. Alles wat je
zonder tunnel kunt voorbereiden (de override controleren, de poortmeting
inrichten) mag wel.

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

Meet vanaf **twee kanten**: vanaf de host zelf, én vanaf een extern netwerkpunt.
Een host-meting laat zien wat er luistert; alleen een externe meting laat zien
wat er dóór de router heen bereikbaar is. Die twee kunnen verschillen, en het
verschil is precies waar het risico zit.

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
