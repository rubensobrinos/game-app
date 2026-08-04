# INT4a — operationele traceercontext: veilige logger, verloren races, logvorm gelijk

Eerste van twee observability-prompts. Kopieer alles onder **Prompt** naar een
nieuwe agent-aanroep. Zelfstandig leesbaar.

Herzien na review. De oorspronkelijke versie beloofde "één correlatie-ID door de
hele keten" en bouwde vervolgens vier verschillende identifiers — dat is geen
correlatie maar context, en de titel loog erover. Ook de claim dat verloren races
"nergens gelogd" worden bleek onjuist: ze wórden gelogd, maar met de verkeerde
code.

---

## Prompt

Je werkt in de repo `game-app` als INT-A (integrator, vóór de repository-poort).
Deze opdracht maakt de server traceerbaar: nu kun je van een mislukte spelavond
niet reconstrueren wát er misging.

Wijzig `server/transport/rest.mjs`, `server/transport/socket.mjs`,
`server/index.mjs`, een nieuw `server/transport/safe-logger.mjs`, en hun tests.
Raak `server/composition/`, `server/data/`, `server/protocol/`, `client/`,
`shared/` en `frontend/` niet aan — daar werken andere eigenaren. Commit niets.

### Lees eerst

- `docs/multiplayer/DEPLOYMENT-AND-TESTING.md` §Observability → Logging. Harde
  eisen: gestructureerde JSON-logregels, **geen** displaynamen, **geen** tokens,
  **geen** volledige antwoordpayloads, **geen** IP in applicatielogs.
- `docs/multiplayer/PROTOCOL.md` §Basisregels punt 8: foutcodes en veilige
  metadata, geen stacktraces.
- `AGENTS.md` §Conventies — "bouw geen tweede mechanisme naast dat van een
  eigenaar" en de vacuümverificatie-regel.
- `server/transport/socket.mjs`, de functie `logSafe()` met zijn
  `LOGGABLE_FIELDS`-allowlist (rond regel 310). Dat is het patroon dat je
  verplaatst en uitbreidt.

### Deel 1 — operationele context, geen trace-ID

**Dit is bewust géén doorlopend correlatie-ID.** Er bestaan vier identifiers met
elk een eigen reikwijdte, en die bij elkaar zetten in de logregel is wat je
bouwt:

| Veld | Wat het identificeert |
| --- | --- |
| `roomId` | één spelavond — groepeert alles van één room |
| `requestId` | één REST-verzoek (Fastify's `request.id`) |
| `actionId` | één muterende clientactie |
| `eventId` | één uitgaand serverevent |

**Wat dit wél oplost:** je kunt alles van één spelavond bij elkaar zoeken, en
binnen één REST-verzoek of één clientactie de keten volgen.

**Wat dit níét oplost, en documenteer dat expliciet:** bij twintig joins in
dezelfde room kun je niet bepalen wélk serverevent door wélk verzoek werd
veroorzaakt. Dat vraagt een echte `traceId` die van REST via de compositie naar de
publicatie wordt doorgegeven, en dat raakt interne functiesignaturen en mogelijk
publieke contracten. Bouw dat hier **niet**. Noteer het als vervolgvraag.

Concreet: elke logregel draagt `roomId` zodra die bekend is — bij REST ná het
oplossen van de room, bij sockets meteen na de handshake waar `socket.data` hem
al heeft. Plus het identificerende veld dat bij die laag hoort.

Verzin geen nieuw ID-formaat; alle vier bestaan al.

### Deel 2 — één gedeelde veilige logger

`logSafe()` zit nu als closure ín `attachSocketServer()` (regel 310, functie
begint op 223). REST kan hem dus niet gebruiken, en kopiëren zou precies het
tweede mechanisme opleveren dat `AGENTS.md` verbiedt.

Maak `server/transport/safe-logger.mjs`: één allowlist, één formatter. REST,
socket en de lifecyclelogs in `index.mjs` geven alleen `layer: 'rest' | 'socket'
| 'server'` mee. Dit is geen extra mechanisme maar het weghalen ervan.

**De allowlist moet minimaal bevatten:**

```
roomId, sessionId, requestId, actionId, eventId,
event, code, outcome, reason, method,
expectedPhase, actualPhase, source, layer
```

`source` heeft een gesloten waardeverzameling: `host` | `timer` | `recovery`.

Bouw hem als expliciete allowlist, niet als filter op verboden namen. De vorige
versie beloofde in zijn comment dat er nooit een token in belandt, maar kopieerde
in werkelijkheid alles wat je meegaf — de bescherming zat in de discipline van de
aanroeper.

### Deel 3 — verloren fase-races krijgen hun eigen betekenis

**Corrigeer een aanname:** deze uitkomst wordt al gelogd. In `socket.mjs` regel
564 staat:

```js
logSafe('warn', 'timerovergang geweigerd', { roomId, code: toPublicErrorCode(result.code) });
```

Het probleem is niet dat er niets gelogd wordt, maar dat `toPublicErrorCode()`
`PHASE_RACE_LOST` vertaalt naar `INVALID_PHASE`. In het log staat dus een
generieke fasefout, terwijl het in werkelijkheid een verwachte verloren
compare-and-set was. Die twee zijn operationeel totaal verschillend: de eerste
wijst op een bug, de tweede op normale gelijktijdigheid.

Classificeer de **interne** uitkomst vóór de publieke vertaling:

```js
{ outcome: 'phase_race_lost', roomId, source: 'timer', expectedPhase, actualPhase }
```

De client blijft ongewijzigd geen interne code ontvangen — dat verandert niet.

Loop `INTERNAL_ERROR_CODES` in `server/architecture/state-machine.js` na op
dezelfde vermomming: interne uitkomsten die als publieke code in het log belanden.

### Deel 4 — de REST-laag krijgt dezelfde logvorm

`socket.mjs` heeft achttien `logSafe()`-aanroepen; `rest.mjs` praktisch één. Trek
dat gelijk via de gedeelde logger.

Log minimaal: een afgewezen verzoek met zijn foutcode, een authenticatiefout, en
een 500. **Niet** elk geslaagd verzoek — dat is ruis die de echte signalen
begraaft.

### Deel 5 — Fastify's eigen logger mag de privacyregels niet omzeilen

Dit is de gevaarlijkste stap, want hij lekt zonder dat iemand code schrijft.
Fastify/Pino kan afhankelijk van configuratie requestmetadata, headers en het
remote address loggen. Een veilige applicatielog is waardeloos als de
automatische requestlogging er een IP of een `Authorization`-header naast zet.

Doe daarom alle drie:

- zet automatische requestlogging uit, óf configureer geteste veilige
  serializers;
- geef nooit het volledige `request`-object, headers, body of een exception aan
  de logger;
- laat de privacytest **alle** loggeroutput opvangen, niet alleen die van de
  gedeelde logger.

### Tests

- **Allowlist:** elk toegestaan veld komt aantoonbaar door, en een onbekend veld
  wordt aantoonbaar weggegooid.
- **Privacy:** doe een echt verzoek met een token, een `gameCode`, een `inviteId`
  en een displaynaam, plus een herkenbare IP-kanarie in een header. Vang alle
  loggeroutput op en controleer dat geen van die **waarden** voorkomt. Zoek op de
  waarde, niet op de veldnaam.
- **Onverwachte exception** logt een stabiele foutklasse, niet `message` of stack.
- **Een uitgaand serverevent** logt werkelijk zijn `eventId`.
- **Roomcorrelatie:** een REST-join en het volgende `room:player-changed` zijn met
  hetzelfde `roomId` te vinden. Documenteer in de test dat dit roomcorrelatie is
  en geen causale één-op-één-trace.

**De race-test — lees dit zorgvuldig.** Twee fasewissels via `Promise.all()`
afvuren geeft een timinggevoelige test die soms groen wordt zonder dat er een race
was. Bouw hem deterministisch: gebruik de échte compositie en de échte
compare-and-set, maar met een bestuurbare barrière in de store.

1. beide aanroepen lezen dezelfde beginfase;
2. laat beide door tot vlak vóór de atomaire claim, en houd ze daar;
3. laat er één winnen;
4. laat de ander los en toon aan dat híj verliest;
5. controleer daarna de logregel.

Dat is geen gemockte returnwaarde maar bestuurde gelijktijdigheid.

**Over de opzet van al deze tests:** assert eerst dat de handeling die je wilde
uitlokken ook echt plaatsvond — dat het verzoek 201 gaf, dat de verbinding stond,
dat de race werkelijk verloren werd. In dit repo zijn vier keer verificaties groen
geworden omdat het positieve geval nooit plaatsvond.

### Grenzen

Geen nieuwe dependencies. Geen `console.log` in het requestpad.

**Leg de testbaseline vast bij aanvang** (`npm test`) en eindig met minstens
hetzelfde aantal groene bestaande tests. Pin geen vast getal: er werken meerdere
agents in dit repo en de suite groeit gedurende de dag.

### Opleveren

Return value voor een orchestrator. Geef: welk veld je per laag voor identificatie
gebruikt, wat de gedeelde logger exporteert, de volledige allowlist met per veld
waarom hij veilig is, hoe verloren races nu in het log te herkennen zijn, hoe je
de race-test deterministisch hebt gemaakt, wat je met Fastify's eigen logging hebt
gedaan, en de baseline vóór en ná.
