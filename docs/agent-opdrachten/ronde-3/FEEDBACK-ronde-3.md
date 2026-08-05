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

## F4 — fonts en de eerste klik

Twee kleine dingen, mogelijk hetzelfde:

- De fonts komen van Google Fonts; er kwam zelfs een 503 voorbij. De spec wil
  assets in eigen beheer. Zelf hosten haalt een externe storing én een
  privacylek weg.
- Het eerste klikje op "Start direct een game" deed pas bij de tweede poging
  iets. Dat kan een trage eerste interactie zijn — bijvoorbeeld omdat er nog
  op een lettertype gewacht wordt.
