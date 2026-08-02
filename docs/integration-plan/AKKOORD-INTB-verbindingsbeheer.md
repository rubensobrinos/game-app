# Verbindingsbeheer — wat INT-A moet weten voor de stap 3-wiring

**Van:** INT-B (opslagadapters).
**Aan:** INT-A (compositie en transport).
**Status:** akkoord van mijn kant; dit is het contract waarop je kunt bouwen.

De Redis-adapter staat op 200 groene tests. Dit document beschrijft hoe je hem
aan je server hangt: wie de verbinding maakt, wie hem sluit, en wat er gebeurt
als Redis wegvalt.

---

## De twee objecten

```js
import { createRedisConnection } from './server/data/adapters/redis/connection.mjs';
import { createRedisDataStore }  from './server/data/adapters/redis/data-store.mjs';

const connection = createRedisConnection({ url /* , … */ });
const store      = createRedisDataStore({ connection });
```

`createRedisDataStore` verwacht een object met `getClient()`. Meer niet — de
store kent geen verbindingsdetails, en de verbinding kent geen sleutels of
domeinbegrippen. Die scheiding is bewust: je kunt de store tegen een fake
verbinding zetten zonder Redis, en je kunt de verbinding hergebruiken.

## Configuratie komt van jou, niet uit de omgeving

**De adapter leest `process.env` niet.** Jij leest `REDIS_URL` en geeft hem door.

Twee redenen. Een adapter die zelf de omgeving leest is niet twee keer naast
elkaar te instantiëren — dat maakt tests en een latere tweede instantie
onmogelijk. En een secret dat alleen via een parameter binnenkomt heeft precies
één plek waar het kan lekken.

De URL mag credentials bevatten. Hij wordt in een closure bewaard, staat nooit
op het teruggegeven object, en elke melding — foutmelding, event, `describe()`,
`util.inspect` — toont uitsluitend protocol, host en poort met de credentials
vervangen door `***`. Een `console.log(connection)` kan de URL dus niet lekken.

**Geen pepper.** De adapter krijgt er geen en hoort er geen te krijgen: de
invite-hash wordt vóór de poort berekend, zodat de opslaglaag nooit de platte
capability én nooit de pepper ziet.

## `getClient()` — het patroon

De store roept `connection.getClient()` aan per operatie, niet één keer bij het
opstarten. Dat is met opzet: na een herverbinding is de oude client dood, en een
vastgehouden referentie zou dat niet merken.

Wat `getClient()` doet:

| Toestand | Gedrag |
| --- | --- |
| verbonden | geeft de client |
| herverbindend | geeft de client — node-redis buffert en verwerpt luid bij definitieve mislukking |
| definitief mislukt | **werpt** `CONNECTION_UNAVAILABLE`, geeft nooit een dode client |

Dat middelste geval is een keuze: een hik van een seconde kapt geen lopende
ronde af. Het derde geval is de andere kant daarvan — als opgeven eenmaal
vaststaat, krijg je geen client meer, ook niet "voor de zekerheid".

## Wat er gebeurt als Redis wegvalt

Eigen backoff met een maximum, daarna **stoppen**. Het standaardgedrag van
node-redis is oneindig herproberen, en dan staat een server met een
onbereikbare Redis er eeuwig "bijna" bij zonder dat iemand het merkt.

Na opgave gaat de toestand naar `failed` en werpt `getClient()`. Heropbouw is
expliciet: een nieuwe `connect()` gooit de kapotte client weg en bouwt een
verse. Er loopt geen verborgen achtergrondlus.

**Voor jouw `/readyz`:** de verbindingstoestand is het signaal. Een readiness
die altijd 200 geeft is erger dan geen, want dan herstart de infrastructuur op
basis van een leugen.

## Opstarten en afsluiten

**Opstarten:** maak de verbinding vóór je de HTTP-server laat luisteren. Een
server die requests accepteert terwijl de opslag nog niet staat, geeft fouten
die op applicatiefouten lijken.

**Afsluiten:** `connection.close()` is idempotent en terminaal — na sluiten komt
er geen nieuwe client, ook niet als er nog een aanroep onderweg is. Een `QUIT`
die niet terugkomt wordt afgekapt met `destroy()`, zodat een afsluitende server
niet blijft hangen op een Redis die al weg is.

Sluit ná de HTTP-server, niet ervoor: anders krijgen lopende requests een
`CONNECTION_UNAVAILABLE` in plaats van netjes af te ronden.

## Eén ding dat je van mij moet weten, en dat je makkelijk mist

Een Lua-script dat is verstuurd **draait server-side door, ook als jouw
verbinding wegvalt.** Er is geen rollback. De garantie is "alle writes of geen
enkele", niet "bij een netwerkfout is er niets gebeurd".

Praktisch betekent dat: na een reconnect weet je niet of je laatste
schrijfactie is geland. Herstel doe je door opnieuw te lezen, of — bij een
antwoord — door dezelfde `actionId` opnieuw aan te bieden. Die komt dan terug
als `{ replay: true }` zonder tweede score. Dat mechanisme is gebouwd en getest
met 24 gelijktijdige aanroepen, en het overleeft een Redis-herstart.

## Wat ik niet lever

- **Geen levenscyclusbeheer van jouw kant.** Ik open en sluit niets uit mezelf;
  jij bepaalt wanneer.
- **Geen retry op poortmethoden.** Een mislukte operatie komt bij jou terug. De
  adapter herprobeert alleen intern waar dat aantoonbaar veilig is (de
  compare-and-set-lus, maximaal vijf pogingen, en dan met de garantie dat er
  niets is geschreven).
- **Geen `loadSessionByTokenHash`** tot dat werk af is — hij werpt
  `NotImplementedError` en staat in `UNIMPLEMENTED_METHODS`. Controleer die set
  als je wilt weten wat er nog niet kan; hij is er juist omdat
  `assertImplementsDataStore` een werpende functie niet van een echte kan
  onderscheiden.
