# Professionaliseringsadvies — ketenbetrouwbaarheid en contractdiscipline

## Doel

Dit document beschrijft hoe de multiplayerketen duurzaam kan doorgroeien van
goed geteste onderdelen naar een systeem waarvan wijzigingen voorspelbaar,
controleerbaar en veilig door alle lagen bewegen.

De relevante keten is:

```text
browser-UI
  → client-flow en transport
  → HTTP / Socket.IO
  → protocolvalidatie
  → compositie
  → rules / architecture / content
  → DataStore-poort
  → in-memory- of Redis-adapter
```

Het uitgangspunt is positief: de repository heeft al pure domeinmodules,
protocolvalidators, een compositielaag, een DataStore-conformance-harness en
integratietests. De volgende stap is deze onderdelen als één evoluerend systeem
te beheren.

## Gewenste volwassenheid

Een professionele keten heeft vijf eigenschappen:

1. **Eén contract per grens.** De betekenis, vorm, foutuitkomsten en
   atomiciteitsgaranties staan op één canonieke plek.
2. **Eén wijzigingsmoment.** Producer, consument, adapters, fixtures en
   documentatie worden in dezelfde change-set gemigreerd.
3. **Bewijs over de grens heen.** Unit tests bewijzen lokale logica;
   contracttests bewijzen uitwisselbaarheid; ketentests bewijzen het productpad.
4. **Expliciete compatibiliteit.** Een contract is backward-compatible, heeft
   een migratiepad of krijgt bewust een nieuwe versie.
5. **Een altijd bruikbare hoofdlijn.** `main` blijft startbaar en de minimale
   kernflow blijft speelbaar.

## 1. Maak contracten uitvoerbaar

### Contractmanifest per grens

Leg voor iedere belangrijke grens een klein contractmanifest vast. Geen nieuwe
parallelle specificatie, maar een index naar de bestaande bron en het bewijs.

| Grens | Canonieke bron | Producer | Consument | Bewijs |
| --- | --- | --- | --- | --- |
| Browser ↔ REST | `PROTOCOL.md` + validators | REST-laag | frontend transport | contracttest + echte HTTP-test |
| Browser ↔ socket | event- en envelopevalidators | socketlaag | frontend transport | contracttest + twee-clienttest |
| Compositie ↔ opslag | `DataStore`-poort | compositie | fake/Redis | gedeelde conformance-suite |
| Compositie ↔ rules | functiesignaturen rules | compositie | rulesmodules | integratietest per spelvorm |
| Server ↔ content | content-poolinterface | `shared/content` | question selection | build- en integratietest |
| Snapshot ↔ clientstate | snapshotvorm + precedentieregel | server | transport/flow | sequence/reconnecttest |

Het manifest kan als machineleesbare export of als compacte Markdowntabel
bestaan. Belangrijker dan het formaat is dat iedere grens precies één eigenaar,
één versie en één testsuite heeft.

### Contracttests vanuit dezelfde fixtures

Gebruik gedeelde golden fixtures voor wire- en opslagcontracten:

- één geldige minimale vorm;
- één geldige volledige vorm;
- representatieve ongeldige vormen;
- een fixture per ondersteunde versie;
- voorbeelden van foutresponses en idempotente replay.

Laat dezelfde geldige fixture doorlopen langs:

1. de producer;
2. de validator;
3. serialisatie en deserialisatie;
4. de consument.

Hiermee bewijst een test niet alleen dat beide kanten toevallig afzonderlijk
groen zijn, maar dat ze hetzelfde dialect spreken.

## 2. Introduceer een wijzigingsprotocol voor publieke grenzen

Voor iedere wijziging aan wirevorm, DataStore-poort of gedeelde module hoort de
change-set deze volgorde te volgen:

1. **Intentie:** noteer semantiek en compatibiliteitsklasse.
2. **Contract:** pas canonieke typedef/schema/validator aan.
3. **Conformance:** voeg eerst het nieuwe grensbewijs toe.
4. **Implementaties:** migreer producer en alle adapters.
5. **Consumenten:** migreer frontend/compositie.
6. **Ketenbewijs:** voer minstens één echt productscenario uit.
7. **Opruiming:** verwijder oude overloads, tijdelijke shims en verouderde
   fixtures.

Classificeer iedere wijziging:

- `additive`: oude consumenten blijven werken;
- `behavioral`: vorm gelijk, betekenis verandert;
- `breaking`: bestaande payload of aanroep is niet meer geldig;
- `operational`: contract gelijk, maar latency, retries of beschikbaarheid
  verandert.

Voor `behavioral` en `breaking` hoort een korte migratienotitie verplicht te
zijn. Dat voorkomt dat een wijziging klein lijkt omdat de diff klein is.

## 3. Definieer een smalle maar harde kwaliteitsstraat

Niet iedere push hoeft chaos- en loadtests te draaien. Wel hoort iedere commit de
volgende gelaagde poorten te passeren:

```text
syntax/import
  → unit
  → contract/conformance
  → composition
  → transport smoke
  → build/start smoke
```

Aanbevolen gates:

### Gate A — importeerbaarheid

- alle runtime-entrypoints kunnen worden geïmporteerd;
- centrale enums en afgeleide mappings zijn volledig;
- geen module-load side effect start onbedoeld een server of verbinding.

Deze gate is goedkoop en vangt repositorybrede koppelfouten eerder dan duizenden
unit tests.

### Gate B — contract en conformance

- iedere DataStore-implementatie draait exact dezelfde suite;
- protocolenums en foutmappings zijn totaal;
- iedere publieke serverpayload valideert tegen het huidige protocol;
- frontendtransport accepteert dezelfde golden fixtures.

### Gate C — minimale verticale slice

Eén snelle test met echte HTTP- en socketgrenzen:

```text
create room
→ tweede speler joint
→ host start
→ één antwoord
→ ronde eindigt
→ scoreboard ontvangen
→ resources sluiten
```

Deze test is de kanarie van het systeem. Houd hem klein, deterministisch en snel.

### Gate D — uitgebreide keten

Dagelijks of vóór release:

- volledige match;
- twee rooms gelijktijdig;
- reconnect tijdens een actieve ronde;
- pauze en hervatten;
- rematch;
- procesrestart met Redis.

## 4. Maak tijd, volgorde en idempotentie eersteklas concepten

Multiplayerproblemen zijn vaak geen validatieproblemen maar ordeningsproblemen.
Behandel daarom de volgende waarden als een gezamenlijk causaliteitsmodel:

- `matchSequence`: totale volgorde tussen matches in een room;
- `serverTime`: tijdsvolgorde binnen dezelfde match;
- `eventId`: identiteit van een serverevent;
- `actionId`: identiteit van een clientactie;
- `protocolVersion`: betekenis van de payload;
- eventueel later `stateRevision`: totale volgorde van statewijzigingen.

Aanbevolen regel:

```text
room-identiteit
  → matchSequence
  → stateRevision of serverTime
  → event/action-idempotentie
```

Leg per waarde vast:

- wie hem maakt;
- of hij monotoon of alleen uniek is;
- hoe lang hij geldig blijft;
- waar hij persistent wordt opgeslagen;
- wat een consument doet bij duplicaat, achterstand of sprong vooruit.

Een toekomstige `stateRevision` per room kan snapshots en events nog sterker
ordenen dan milliseconden. Voor één serverinstance is dit niet noodzakelijk,
maar het is een duurzame uitbreiding richting horizontale schaal.

## 5. Maak de fake aantoonbaar equivalent, niet alleen handig

De in-memory-store is waardevol voor snelheid en determinisme. Behandel hem als
referentie-implementatie van semantiek, niet als vereenvoudigde testhelper.

Iedere DataStore-methode hoort in de conformance-suite bewijs te hebben voor:

- succes;
- not-found;
- conflict/CAS-verlies;
- idempotente replay;
- isolatie tussen rooms en matches;
- TTL-semantiek waar relevant;
- alles-of-niets bij atomaire writes;
- immutable kopieën aan de applicatiegrens;
- herstel na adapterreconnect.

Voeg daarnaast *differential tests* toe: voer een gegenereerde reeks operaties
uit tegen fake en Redis en vergelijk na iedere stap de observeerbare uitkomst.
Dit is vooral waardevol voor fasewissels, locatorrotatie, sessierotatie en
antwoordverwerking.

## 6. Ontwerp expliciet voor deterministische tests

De codebase gebruikt al geïnjecteerde tijd en randomfuncties. Trek dit door:

- één `Clock`-poort voor epoch-tijd en monotone duur;
- één `IdGenerator`-poort voor ids en action ids;
- één `RandomSource` voor vraagselectie;
- een bestuurbare scheduler voor timers en throttling;
- geen verborgen `Date.now()` of modulebrede mutable klok in domeinlogica.

Hierdoor kunnen race- en reconnectscenario's met virtuele tijd in milliseconden
worden bewezen, zonder sleeps of instabiele deadlines.

## 7. Houd documentatie actueel zonder dubbel onderhoud

Maak onderscheid tussen:

- **fundamentele specificaties:** gewenste waarheid;
- **besluiten:** waarom een richting gekozen is;
- **actuele status:** wat nu aantoonbaar werkt;
- **historie:** changelog en git.

Aanbevolen actuele statusvelden:

```text
verifiedCommit
verifiedAt
testCommand
passed / failed / skipped
verticalSliceStatus
knownReleaseBlockers
```

Laat testtotalen bij voorkeur door een script genereren. Handmatig bijgehouden
totalen verouderen snel en voegen weinig waarde toe naast een testartefact.

## Gefaseerde route

### Nu — integratiebasis

1. Contractmanifest voor wire, DataStore en snapshotvolgorde.
2. Import/start-smoke als eerste CI-gate.
3. Eén minimale verticale slice verplicht groen.
4. DataStore-conformance als enige definitie van adapteruitwisselbaarheid.
5. Frontend standaard tegen echte transportlaag in geïntegreerde tests.

### Daarna — robuust wijzigen

1. Compatibiliteitsclassificatie in PR-/committemplate.
2. Golden fixtures gedeeld door server en client.
3. Differential testing fake versus Redis.
4. Virtuele klok voor reconnect, timers en throttling.
5. Automatisch statusrapport per geverifieerde commit.

### Later — schaal en versie-evolutie

1. `stateRevision` per room evalueren.
2. Backward-compatibilitysuite voor actieve rooms tijdens deploys.
3. Rolling-upgradeproef met twee serverversies.
4. Consumer-driven contracts wanneer meerdere zelfstandige clients ontstaan.

## Meetbare kwaliteitsdoelen

- `main` is op iedere commit importeerbaar en startbaar.
- De minimale verticale slice blijft onder 15 seconden.
- Iedere publieke contractwijziging heeft producer-, consumer- en
  conformancebewijs in dezelfde change-set.
- Fake en Redis leveren voor dezelfde commandoreeks dezelfde observeerbare
  resultaten.
- Geen tijd- of retrytest gebruikt een echte sleep.
- Een bestaand actief spel kan een compatibele deploy overleven zonder
  betekenisverandering van zijn gepinde content en protocol.

## Besluiten die hiervoor nuttig zijn

1. Is `PROTOCOL.md` uitsluitend menselijk leesbaar, of komt er daarnaast één
   machineleesbaar schema als canonieke bron?
2. Wordt `stateRevision` vóór publieke pilots ingevoerd of pas bij horizontale
   schaal?
3. Welke verticale slice is de verplichte merge-gate?
4. Welke compatibiliteitsduur geldt voor actieve rooms tijdens een deploy?

