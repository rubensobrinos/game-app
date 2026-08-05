# Feedback ronde 3 — producteigenaar, 5 aug 2026

Vier bevindingen op de live build, in volgorde van ernst zoals de
producteigenaar ze zelf rangschikte. **Nog niet toegewezen.**

| # | Bevinding | Ernst |
| --- | --- | --- |
| F1 | Verversen van de hostpagina maakt de game kapot | blokkeert de pilot |
| F2 | Eerste room niet meer joinbaar terwijl het hosttabblad openstond | hoog |
| F3 | `/game/{code}` stuurt naar de homepage in plaats van de joinflow | middel |
| F4 | Fonts komen van Google Fonts; eerste klik reageert soms niet | klein |

---

## F1 — een refresh van de hostpagina beëindigt de game

> "Ik ververste `/host/844895` en kreeg *Deze game bestaat niet (meer)*."

De spec zegt dat een host binnen de reconnect-termijn moet kunnen terugkeren.
Dat gebeurt niet.

**Waarom dit vóór de pilot moet:** op een telefoon is één onbedoelde swipe of
één keer wegklikken genoeg om de quiz voor de hele kamer te beëindigen. De
pilot is een avond met echte mensen; als dit daar gebeurt is de avond voorbij
en meten we niets.

### Wat de lead gemeten heeft (5 aug, ná de melding)

**Verversen reproduceert niet.** Op `https://rounda.io` een room aangemaakt en
twee keer achter elkaar ververst: beide keren kwam de lobby gewoon terug, met
code, speler en instellingen. Lokaal idem. De sessie staat per roomcode in
`localStorage` (`mp:session:{code}`), dus een tweede room overschrijft de
eerste niet — de eerste verklaring voor F2 valt daarmee af.

**Wat wél klopt:**

| Waarneming | Bron |
| --- | --- |
| Room `844895` bestaat niet meer in Redis | `redis-cli --scan` |
| De game-server is om 20:59 UTC opnieuw opgestart — precies rond de test | `docker inspect`, 0 crashes |
| De room-TTL is 4 uur en wordt **niet** verlengd bij activiteit | `server/data/ttl.js` |
| De server logt geen enkele join, create of fout op `info` | 1 logregel in de hele container |

**De TTL is de sterkste kandidaat, en is sowieso een bug.**
`ROOM_TTL_SECONDS = 14400` heet in de documentatie "na laatste activiteit",
maar de verversmatrix is nooit gebouwd — dat staat letterlijk als open punt
bovenaan `ttl.js`. Een room verdwijnt dus **vier uur na het aanmaken**, hoe
druk er ook gespeeld wordt. Een avond die om 20:00 begint, is om 24:00 weg,
midden in een potje.

**De tweede kandidaat is de herstart.** Een deploy vervangt de container;
alle open sockets vallen weg. Rooms in Redis overleven dat, maar een tabblad
dat al openstond, verliest zijn verbinding — en de client vertaalt élke fout
uit dat pad naar "Deze game bestaat niet (meer)".

**Daarom drie taken, niet één:**

1. **TTL verlengen bij activiteit** — de verversmatrix uit `DATA-MODEL.md`
   alsnog bouwen. Dit is de reparatie met de meeste kans dat F1 en F2 er echt
   door verdwijnen.
2. **De foutmelding eerlijk maken** — een verbroken verbinding, een verlopen
   room en een onbekende code zijn nu alle drie "bestaat niet (meer)". Een
   host die zijn verbinding kwijt is, hoort te lezen dat hij het opnieuw kan
   proberen, niet dat zijn game weg is.
3. **Logging** — zonder één logregel per create/join/fout is dit soort
   meldingen niet na te trekken. Dat mag niet nog een keer.

## F2 — de eerste room stierf terwijl zijn tabblad nog openstond

> "Mijn allereerste room (844 895) was al niet meer joinbaar terwijl het
> hosttabblad nog openstond."

Vermoeden van de producteigenaar: het aanmaken van een nieuwe room vanuit
dezelfde browser doodt de vorige.

**Die verklaring is gemeten en klopt niet:** de sessie staat per roomcode
(`mp:session:{code}` in `localStorage`), en een tweede room krijgt een eigen
sleutel. Wat overblijft is dezelfde wortel als F1 — TTL of herstart.

Onderzoek F1 en F2 samen; het is vermoedelijk één reparatie.

## F3 — de directe link werkt niet

`/game/{code}` uit de adresbalk delen stuurt de ontvanger naar de homepage in
plaats van naar de joinflow. Als de QR-code een andere route gebruikt is de QR
zelf niet stuk — maar de link kopiëren en plakken is wat mensen dóén, en dat
werkt nu niet.

### Wat agent 2 gemeten heeft (fase 3, 6 aug)

**Niet reproduceerbaar met de huidige code.** `route-resolver.mjs` herkent
`/game/{code}` en `/host/{code}` correct, en `app.mjs`'s fallback zonder
lokale sessie (`mountJoin(root, { type: 'code', code: route.code })`) mount
wél degelijk de joinflow, niet home.

Getest, telkens met een **verse browsercontext** (geen localStorage, dus
gegarandeerd "zonder lokale sessie"):

1. Rechtstreeks tegen `node server/index.mjs` (poort 3992): een echte room
   aangemaakt via `POST /api/v1/games`, code in de URL geplakt
   (`/game/{code}`) — landt in de Lobby, "Je bent binnen". Ook getest met een
   niet-bestaande code: landt op het joinscherm met "Deze game bestaat niet
   (meer)", niet op home. `/host/{code}` idem.
2. Door de **echte** Caddy-reverse-proxy heen (`aseso-game-reverse-proxy-1`,
   poort 80, dezelfde stack als `docker-compose.yml`): zelfde uitkomst, met
   de productie-CSP-headers erbij (zie F4 — dát blokkeerde wél iets, de
   routing niet).

Beide keren: joinflow, geen home. Ik heb geen enkel scenario gevonden waarin
de huidige code naar home valt. Mogelijke verklaringen die ik niet vanaf hier
kan toetsen: een browser met een verouderde cache van vóór de SPA-fallback
(landde 2 aug, dit ticket is van 5 aug — dus eigenlijk al te laat voor die
verklaring, tenzij een CDN een oude `index.html` langer vasthield dan
`Cache-Control: no-cache` toestaat), of het bekende iOS Safari-gedrag waarbij
de adresbalk bij scrollen inklapt tot alleen het domein en een tik daarop dán
de root-URL kopieert in plaats van het volledige pad. Geen van beide is een
code-bug in `route-resolver.mjs`/`app.mjs` — als het tweede het is, ligt de
echte oplossing bij een expliciete "kopieer link"-knop naast het adresbalk-
kopiëren, niet bij deze twee bestanden. **Geen wijziging aangebracht**; meld
dit aan de lead in plaats van te gokken.

## F4 — fonts en de eerste klik

Twee kleine dingen, mogelijk hetzelfde:

- De fonts komen van Google Fonts; er kwam zelfs een 503 voorbij. De spec wil
  assets in eigen beheer. Zelf hosten haalt een externe storing én een
  privacylek weg.
- Het eerste klikje op "Start direct een game" deed pas bij de tweede poging
  iets. Dat kan een trage eerste interactie zijn — bijvoorbeeld omdat er nog
  op een lettertype gewacht wordt.

### Wat agent 2 gedaan en gemeten heeft (fase 3, 6 aug)

**Fonts zelf gehost** (`frontend/vendor/fonts/`, licenties erbij) — geen
`fonts.googleapis.com`/`fonts.gstatic.com`-verzoek meer, geverifieerd met het
netwerktabblad (Playwright: nul externe requests). Terzijde bevestigd waarom
dit vóór de pilot moet: door de échte Caddy-proxy heen blokkeerde de
production-CSP (`style-src 'self' 'unsafe-inline'`) de Google Fonts-
stylesheet gewoon (console: CSP-violation) — de fonts vielen dus al terug op
de systeemfont, onopgemerkt tot deze meting.

**Eerste klik**: 20 verse pageloads, direct bij verschijnen van de knop
getikt (geen wachttijd), met én zonder 4G-throttle (CDP
`Network.emulateNetworkConditions`, 4 Mbps/1 Mbps/100 ms) — 0/20 keer deed de
eerste tik niets. De layout-shift tussen fallback-font en de geladen webfont
is met zelf hosten 0px zonder throttle, ~4px met throttle (was met Google
Fonts een extra DNS/TLS-round trip naar een derde partij, dus een langer
venster waarin zoiets kán). Ik kan niet met zekerheid zeggen dát dit de
oorzaak was — ik heb de oude (Google Fonts-)situatie niet nog eens apart
gemeten, want de enige plek om dat eerlijk te vergelijken is de gedeelde
Docker-stack, en die opnieuw bouwen op het huidige (gedeelde, door agent 1
live bewerkte) werkkopie-commit leek me riskanter dan de meting waard. Als
het na deze fix ooit weer gemeld wordt, is de fonts-verklaring dus niet meer
geldig en moet er opnieuw gemeten worden.
