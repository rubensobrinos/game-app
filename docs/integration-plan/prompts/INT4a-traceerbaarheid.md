# INT4a — traceerbaarheid: correlatie, verloren races zichtbaar, logvorm gelijk

Eerste van twee observability-prompts. Kopieer alles onder **Prompt** naar een
nieuwe agent-aanroep. Zelfstandig leesbaar — geen kennis van het gesprek nodig.

De tweede prompt ([`INT4b-metrics.md`](INT4b-metrics.md)) hangt hierop: zonder de
correlatie en de allowlist uit deze prompt kunnen de metriclabels niet fatsoenlijk
worden gekozen.

---

## Prompt

Je werkt in de repo `game-app` als INT-A (integrator, vóór de repository-poort).
Deze opdracht maakt de server traceerbaar: nu kun je van een mislukte spelavond
niet reconstrueren wát er misging.

Wijzig `server/transport/rest.mjs`, `server/transport/socket.mjs`,
`server/index.mjs` en hun tests. Raak `server/composition/`, `server/data/`,
`server/protocol/`, `client/`, `shared/` en `frontend/` niet aan — daar werken
andere eigenaren. Commit niets.

### Lees eerst

- `docs/multiplayer/DEPLOYMENT-AND-TESTING.md` §Observability → Logging. Dat legt
  de harde eisen vast: gestructureerde JSON-logregels, **geen** displaynamen,
  **geen** tokens, **geen** volledige antwoordpayloads, **geen** IP in
  applicatielogs.
- `docs/multiplayer/PROTOCOL.md` §Basisregels punt 8 (server retourneert
  foutcodes en veilige metadata, geen stacktraces) en de envelope-vormen.
- `AGENTS.md` §Conventies — met name "bouw geen tweede mechanisme naast dat van
  een eigenaar" en de vacuümverificatie-regel.
- `server/transport/socket.mjs`, de functie `logSafe()` met zijn
  `LOGGABLE_FIELDS`-allowlist. Dat is het patroon dat je uitbreidt; verzin geen
  tweede logvorm.

### Deel 1 — één correlatie-ID door de hele keten

Dit is het belangrijkste deel. Zonder één ID dat een HTTP-join, een socketevent en
een compositiebesluit aan elkaar knoopt, zijn alle andere signalen losse feiten:
je ziet dat er om 21:14 drie fouten waren, maar niet dat het dezelfde speler in
dezelfde room was. De vraag "waarom liep díé spelavond vast" is dan
onbeantwoordbaar, hoeveel je verder ook logt.

Wat er al is: `actionId` en `eventId` in de envelope, en Fastify's `request.id`
per HTTP-verzoek. Wat ontbreekt: die zijn nergens aan een `roomId` gekoppeld, en
een REST-verzoek en het socketevent dat erop volgt delen niets.

Bouw:

- Elke logregel, aan beide kanten, draagt `roomId` zodra die bekend is. Bij REST
  is dat ná het oplossen van de room (join, state, leave); bij sockets meteen na
  de handshake, waar `socket.data` hem al heeft.
- Elke logregel draagt een verzoek-/actie-identificatie: `request.id` bij REST,
  `actionId` bij een clientevent, `eventId` bij een serverevent.
- Zorg dat een REST-join en het `room:player-changed` dat eruit volgt met
  hetzelfde `roomId` te vinden zijn. Dat is vandaag het enige pad waar de twee
  lagen elkaar raken en het is precies waar een lobby-probleem zichtbaar wordt.

**Verzin geen nieuw ID-formaat** als een bestaand veld volstaat. Motiveer in een
comment welk veld je waarvoor gebruikt.

### Deel 2 — verloren fase-races zichtbaar maken

`server/composition/match-lifecycle.mjs` exporteert `PHASE_RACE_LOST`: de uitkomst
wanneer een timergedreven fasewissel de compare-and-set verliest omdat iemand
anders de fase al verder heeft gezet. Dat is bewust géén foutcode richting de
client — een verloren race is geen gebruikersfout.

Maar hij wordt **nergens gelogd**. Gecontroleerd: `PHASE_RACE_LOST` komt in
`server/transport/` niet voor. Een verloren fasewissel is dus volledig stil, en
dat is precies het spoor dat je mist als een spelavond op een fasewissel
vastloopt.

Log hem op `warn`-niveau met `roomId`, de bronfase en de fase die er werkelijk
stond. Zorg dat de logregel duidelijk maakt dat dit een verwachte uitkomst is en
geen defect — anders gaat iemand hem later "oplossen".

Kijk of er meer interne uitkomsten zo stil zijn. `INTERNAL_ERROR_CODES` in
`server/architecture/state-machine.js` is een goede plek om te beginnen.

### Deel 3 — de REST-laag krijgt dezelfde logvorm als de socketlaag

`socket.mjs` heeft achttien `logSafe()`-aanroepen met een allowlist. `rest.mjs`
heeft er praktisch één: de REST-kant is stil.

Trek dat gelijk. Gebruik dezelfde allowlist-aanpak, en let op de les die eronder
zit: die functie beloofde in zijn comment dat er nooit een token of displaynaam
in belandt, maar kopieerde in werkelijkheid alles wat je meegaf. De bescherming
zat in de discipline van de aanroeper, niet in de code. Bouw hem daarom ook hier
als expliciete allowlist, niet als filter op verboden namen.

Log minimaal: een afgewezen verzoek met zijn foutcode, een authenticatiefout, en
een 500. Niet elk geslaagd verzoek — dat is ruis die de echte signalen begraaft.

### Verboden in elke logregel

Sessietokens, `inviteId`, `gameCode`, displaynamen, IP-adressen, volledige
antwoordpayloads, stacktraces, `error.message` van een onverwachte exception.

`roomId` en `sessionId` mogen wél: dat zijn opake identifiers, geen
join-capability. `gameCode` en `inviteId` zijn dat juist wél — daarmee kan iemand
een room binnenkomen.

### Tests

- Een test die bewijst dat een verloren fase-race daadwerkelijk een logregel
  oplevert. Lok hem echt uit (twee concurrerende fasewissels), niet met een
  gemockte returnwaarde.
- Een test per verboden veld: voer een echt verzoek uit met een token en een
  displaynaam erin, vang alle logoutput op, en controleer dat geen van beide
  erin voorkomt. Zoek op de **waarde**, niet op de veldnaam.
- Een test die aantoont dat een REST-join en het volgende socketevent met
  hetzelfde `roomId` te vinden zijn.

**Belangrijk over de opzet van die tests.** Assert eerst dat de handeling die je
wilde uitlokken ook echt heeft plaatsgevonden — dat het verzoek 201 gaf, dat de
verbinding stond, dat de race werkelijk verloren werd. In dit repo zijn vier keer
verificaties groen geworden omdat het positieve geval nooit plaatsvond: een
handshake die alles weigerde, een create die 400 gaf, een poortcheck die de
sandbox blokkeerde, en een shutdowntest zonder open socket. Een test die groen
wordt omdat er niets gebeurde is erger dan geen test.

### Grenzen

Geen nieuwe dependencies. Geen `console.log` in het requestpad — alles via de
logger. Draai `npm test` in zijn geheel; de stand bij aanvang is 2806 groen en
daar mag niets bij komen.

### Opleveren

Return value voor een orchestrator. Geef: welk veld je voor correlatie hebt
gekozen en waarom, waar de verloren races nu zichtbaar worden, welke velden op de
allowlist staan met per veld de reden dat hij veilig is, hoe je de
verbodstest hebt opgezet, en het testresultaat.
