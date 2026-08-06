# Professionaliseringsadvies — security en capabilitymodel

## Doel

De multiplayerapp gebruikt geen accounts, maar wel tijdelijke bevoegdheden:
roomcodes, invite-links, sessietokens, hostrollen en action ids. Dat is een
geschikt model voor een laagdrempelig spel, mits capabilities gedurende hun hele
levenscyclus als securityobject worden behandeld.

De basis is al sterk:

- sessietokens zijn willekeurig en worden gehasht opgeslagen;
- verificatie gebruikt versieerbare HMAC en constant-time vergelijking;
- locators en tokens hebben atomaire schrijf- en intrekpaden;
- tokens horen niet in URL's of logs;
- Redis en PostgreSQL zijn niet publiek bereikbaar;
- teams, spectators en accounts vergroten de huidige aanvalsvlakte niet.

De volgende professionaliseringsslag is een samenhangend dreigingsmodel en
bewijsbare lifecycle per capability.

## 1. Maak een formeel capabilityregister

Leg iedere capability in één register vast:

| Capability | Geeft toegang tot | Entropie / raadbaarheid | Uitgifte | Intrekking | TTL | Opslagvorm |
| --- | --- | --- | --- | --- | --- | --- |
| Roomcode | joinen via code | bewust menselijk/raadbaar | roomcreatie | rotatie/roomverval | room-TTL | geclaimde index |
| `inviteId` | preview en join | high entropy | roomcreatie | rotatie/roomverval | room-TTL | alleen hashindex |
| Sessietoken | rollen binnen één room | 256 bit random | create/join | kick/revoke/TTL/rotatie | room-TTL | versieerbare HMAC-index |
| `actionId` | idempotente actie | uniek, geen autoriteit op zichzelf | client | cacheverval | korte TTL | room-scoped cache |
| Hostrol | beheeracties | afgeleid van sessie | server | sessie-intrekking | sessie-TTL | Session.roles |

Voeg per capability vier verplichte vragen toe:

1. Wie mag hem uitgeven?
2. Welke exacte autoriteit geeft hij?
3. Wie kan hem intrekken en is dat atomair?
4. Hoe bewijzen tests dat een ingetrokken waarde nergens meer werkt?

Dit register operationaliseert `DECISIONS.md` #37 en voorkomt dat toekomstige
features impliciet een nieuw authenticatiemechanisme introduceren.

## 2. Schrijf een compact dreigingsmodel per trust boundary

Gebruik bijvoorbeeld STRIDE als checklist, maar houd het modelspecifiek.

### Publieke browser → edge

Onderzoek:

- brute-force van zescijferige codes;
- geautomatiseerde roomcreatie en resource-uitputting;
- misbruik van preview voor namen- of roomenumeratie;
- oversized JSON en Socket.IO-payloads;
- cross-origin socketverbindingen;
- replay van eerder geldige acties;
- XSS via displaynamen, vertalingen of content.

### Edge → game-server

Onderzoek:

- welke proxyheaders vertrouwd worden;
- spoofing van client-IP voor rate limiting;
- requestsmuggling-/timeoutgrenzen;
- maximale verbindingen en bodygrootte;
- verschil tussen tunnel- en directe-exposureconfiguratie.

### Game-server → Redis/PostgreSQL

Onderzoek:

- least-privilege credentials;
- netwerkisolatie;
- secretrotatie;
- keyspace- en querybegrenzing;
- persoonsgegevens in analytics;
- gedrag bij gedeeltelijke beschikbaarheid.

### Operator → productie

Onderzoek:

- toegang tot `.env`, logs, back-ups en dashboards;
- wie secrets kan roteren;
- hoe incidentacties worden gelogd;
- herstel zonder productiegegevens naar development te kopiëren.

Maak per dreiging zichtbaar: preventie, detectie, herstel en resterend risico.

## 3. Centraliseer autorisatie als beleid

Authenticatie beantwoordt “welke sessie is dit”; autorisatie beantwoordt “mag
deze sessie deze actie in deze room en fase uitvoeren”. Houd die vragen apart.

Aanbevolen autorisatiecontext:

```js
{
  roomId,
  sessionId,
  playerId,
  roles,
  sessionStatus,
  roomPhase,
  action,
}
```

Laat één policyfunctie een besluit plus machineleesbare reden geven:

```js
authorize(context) → { allowed: true }
                   | { allowed: false, code }
```

Voordelen:

- HTTP en Socket.IO gebruiken hetzelfde beleid;
- nieuwe acties krijgen niet per ongeluk lichtere controles;
- een policy-matrix kan volledig worden getest;
- logging kan het besluit vastleggen zonder token of payload.

Test de matrix op rol, roomisolatie, sessiestatus en fase. Voeg vooral negatieve
eigenschapstests toe: een playeractie wordt nooit hostactie door een andere
payload, roomcode of action id.

## 4. Ontwerp rate limiting als product- én securityfunctie

Gebruik verschillende limieten per risico; één globale teller is te grof.

| Handeling | Primaire sleutel | Secundaire sleutel | Gedrag |
| --- | --- | --- | --- |
| Roomcode proberen | netwerkprefix / privacyvriendelijke hash | code | oplopende vertraging |
| Invitepreview | inviteHash | netwerkprefix | ruime limiet, geen enumeratiedetails |
| Room creëren | netwerkprefix | globale capaciteit | strengere burstlimiet |
| Joinen | roomId | netwerkprefix | bescherm room én server |
| Antwoorden | sessie + ronde | room | protocol/idempotentie leidend |
| Hostacties | hostsessie | room | lage natuurlijke frequentie |

Professionele eigenschappen:

- atomair in Redis;
- expliciete TTL per bucket;
- begrensde cardinaliteit;
- generieke externe foutinformatie;
- interne metrics per limiter;
- een noodrem voor globale room- of socketgroei;
- geen permanente blokkade van gedeelde school- of bedrijfsnetwerken.

Overweeg proof-of-work of CAPTCHA pas bij aantoonbaar publiek misbruik. Voor een
pilot zijn goede limieten en capaciteitsgrenzen eenvoudiger en toegankelijker.

## 5. Maak secret- en pepperrotatie operationeel

Versieerbare hashes zijn pas waardevol wanneer rotatie uitvoerbaar en getest is.

Leg een runbook vast voor:

1. nieuwe pepperversie toevoegen;
2. nieuwe uitgifte op de actieve versie zetten;
3. oude en nieuwe versies tijdelijk verifiëren;
4. actieve rooms laten uitlopen of gecontroleerd herindexeren;
5. oude versie verwijderen;
6. rollback binnen het overeengekomen venster.

Scheiding van secrets:

- sessietoken-HMAC;
- invite-index-HMAC indien gebruikt;
- analytics-pseudonimisering;
- databasecredentials;
- tunnelcredential;
- back-upencryptiesleutel.

Gebruik niet één `TOKEN_PEPPER` voor meerdere doelen. Scope secrets per omgeving,
doel en versie. Leg alleen identifiers zoals `pepper-v3` vast; nooit de waarde.

## 6. Versterk browsers en edge als eerste verdedigingslaag

Aanbevolen browserbeleid:

- strikte Content-Security-Policy zonder `unsafe-inline` waar haalbaar;
- `frame-ancestors 'none'` of een bewuste allowlist;
- `object-src 'none'`;
- `base-uri 'self'`;
- strikte `Referrer-Policy`, zodat invitepaden niet uitlekken;
- `Permissions-Policy` met alleen werkelijk gebruikte browserfuncties;
- HSTS pas na verificatie van alle subdomeinconsequenties;
- Subresource Integrity voor externe assets, of liever volledig lokale assets;
- geen gevoelige state in querystrings, history state of analytics-URL's.

Voor WebSockets:

- valideer `Origin` expliciet;
- stel maximale payloadgrootte in;
- begrens handshake- en idleduur;
- limiteer sockets per sessie en per netwerkbron;
- sluit ingetrokken sessies actief;
- behandel reconnect als nieuwe authenticatie, niet als impliciet vertrouwen.

## 7. Maak privacy aantoonbaar met datastromen en retentie

Maak een klein datastroomdiagram voor:

```text
displayName
session/player-id
joinmethode
antwoordevent
IP/proxygegevens
operationele logs
analyticsaggregaten
back-ups
```

Leg per gegeven vast:

- doel;
- rechtsgrond/verwachting voor pilots;
- opslaglocatie;
- retentie;
- toegang;
- verwijder- of aggregatiemoment;
- of het in back-ups voorkomt.

De bestaande kanarie-aanpak voor privacytests is sterk. Breid die uit naar logs,
Redis-dumps, PostgreSQL, metricslabels en fouttraces. Een displaynaam hoort niet
als metricslabel te verschijnen; dat geeft zowel privacy- als cardinaliteitsrisico.

## 8. Bouw securitybewijs in lagen

### Eigenschapstests

- capabilities zijn onvoorspelbaar waar dat vereist is;
- hashes zijn domeingescheiden en versieerbaar;
- vergelijking is constant-time voor gelijkvormige input;
- ingetrokken capabilities blijven ingetrokken;
- iedere write en revoke is atomair;
- roomisolatie houdt onder gegenereerde commandoreeksen.

### Misbruiktests

- brute-forcebudgetten;
- payloadlimieten;
- socketflood en reconnectstorm;
- action-id replay;
- tokenrotatie tijdens een actieve verbinding;
- hosttoken aangeboden als playerpayload en omgekeerd;
- vervuilde/prototype-rijke JSON-objecten;
- log- en metricscanaries.

### Dependency- en supply-chainbeleid

- lockfile verplicht;
- minimale runtime-dependencies;
- periodieke audit met triage, geen automatische blind upgrades;
- herkomst en licentie van vendored browsercode vastleggen;
- containerimages op digest pinnen voor releasebuilds;
- SBOM genereren bij releases;
- provenance/signing later toevoegen wanneer distributie breder wordt.

## 9. Incidentrespons passend bij een kleine pilot

Een compact runbook is voldoende, mits vooraf geschreven:

### Mogelijke signalen

- plotseling veel mislukte codejoins;
- abnormale roomcreatie;
- veel tokens van één bron;
- verhoogde `NOT_HOST`/`TOKEN_INVALID`-frequentie;
- ongebruikelijke socketgroei;
- privacycanarie in log of database;
- onverwachte capabilitylookup na intrekking.

### Directe acties

- publieke toegang tijdelijk beperken;
- invite of sessies atomair roteren/intrekken;
- nieuwe roomcreatie uitschakelen terwijl bestaande rooms uitlopen;
- relevante logs en versies veilig bewaren;
- peppers of tunnelcredentials volgens runbook roteren;
- na herstel gerichte regressietest uitvoeren.

Geen uitgebreid enterpriseproces nodig; wel duidelijk eigenaarschap en een
volgorde die tijdens stress niet hoeft te worden bedacht.

## Gefaseerde route

### Nu — pilotfundament

1. Capabilityregister afronden.
2. Eén gedeelde autorisatiematrix voor REST en sockets.
3. Rate limits op create, codejoin, preview en sockets.
4. Origin-, body- en socketpayloadbegrenzing.
5. Privacycanaries over logs, Redis, PostgreSQL en metrics.
6. Secretrotatie-runbook schrijven en eenmaal in test uitvoeren.

### Daarna — publieke robuustheid

1. Threat model als releaseartefact bijwerken.
2. Reconnectstorm- en brute-forceloadtests.
3. CSP aanscherpen op basis van browserrapportage.
4. Dependency/SBOM-controle aan releaseproces toevoegen.
5. Audittrail voor operatoracties en capabilityrotatie.

### Later — onderwijs of bredere publieke inzet

1. Bekende afleidbaarheid van correcte antwoorden verwijderen.
2. Misbruikdetectie op trends, zonder persoonsgerichte tracking.
3. Formele privacy- en retentiebeoordeling.
4. Externe penetratietest rond auth, sockets en roomisolatie.

## Meetbare kwaliteitsdoelen

- Iedere capability staat in het register met issuer, authority, revoke en TTL.
- Geen token, inviteId, displaynaam of antwoordpayload verschijnt in logs of
  metricslabels.
- Iedere hostactie heeft dezelfde autorisatie-uitkomst via REST en socket.
- Rotatie van iedere secretsoort is in een niet-productieomgeving gerepeteerd.
- Een ingetrokken capability faalt onmiddellijk langs iedere lookuproute.
- Rate limiting beschermt zowel individuele rooms als globale capaciteit.
- Releaseimages zijn reproduceerbaar en hebben een SBOM.

## Besluiten die hiervoor nuttig zijn

1. Wordt `inviteHash` domeingescheiden HMAC of blijft high-entropy SHA-256 het
   definitieve model?
2. Hoe lang moeten actieve rooms een oude pepperversie kunnen overleven?
3. Welke privacyvriendelijke bronidentiteit mag rate limiting gebruiken?
4. Welke operator mag tijdens een pilot rooms of sessies globaal intrekken?

