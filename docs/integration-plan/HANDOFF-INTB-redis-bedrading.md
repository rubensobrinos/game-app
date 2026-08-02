# INTB-12 — de server draait op de in-memory fake, niet op Redis

**Van:** INT-B. **Aan:** INT-A (eigenaar van `server/index.mjs`).
**Ernst:** hoog — dit is de laatste blokkade voor de INTB4a-DoD.
**Zelf vastgesteld**, niet gemeld door een agent.

## Wat er aan de hand is

`docker-compose.yml` zet `REDIS_URL: redis://redis:6379` op de
`game-server`-service. Die variabele komt **nergens voor in
`server/index.mjs`**, en `readConfigFromEnvironment()` leest hem niet.

`buildServer()` valt terug op de default:

```js
store = createInMemoryStore(),
```

De draaiende server houdt dus alle roomstate in procesgeheugen. Redis draait
ernaast, is gezond, en wordt niet gebruikt.

**Gevolg:** de DoD van INTB4a — *"`docker compose up` geeft een stack waar een
match een game-server-herstart overleeft"* — is op dit moment niet haalbaar. Niet
omdat de verpakking niet klopt, maar omdat een herstart per definitie alles wist
wat in het geheugen van dat proces zat.

Ook alles wat INT-B heeft gebouwd staat hiermee buiten de keten: 200 groene
adaptertests, het Lua-antwoordpad, de AOF-herstartgarantie — geen daarvan raakt
een draaiende server tot deze regel is gelegd.

## Wat er goed is

De injectie is al voorzien: `store` is een optionele parameter met een default,
niet een harde import. De wijziging is daarom klein en lokaal.

De Dockerfile is in orde (DT6 heeft hem bijgewerkt: `npm ci`, `shared/`,
`client/` en `frontend/` staan in het image). Compose zet `REDIS_URL` al goed en
`depends_on` wacht op een gezonde Redis. Aan de verpakkingskant ontbreekt niets.

## De bedrading — kant-en-klaar

Volledige achtergrond in
[`AKKOORD-INTB-verbindingsbeheer.md`](AKKOORD-INTB-verbindingsbeheer.md). De kern:

```js
import { createRedisConnection } from './data/adapters/redis/connection.mjs';
import { createRedisDataStore }  from './data/adapters/redis/data-store.mjs';

// bij het opstarten, VÓÓR listen():
const connection = createRedisConnection({ url: process.env.REDIS_URL });
await connection.connect();
const store = createRedisDataStore({ connection });

const server = await buildServer({ store /* , … */ });
```

Vier dingen die daarbij horen:

1. **Verbinden vóór `listen()`.** Een server die requests aanneemt terwijl de
   opslag nog niet staat, geeft fouten die op applicatiefouten lijken.
2. **`connection.close()` ná het sluiten van de HTTP-server**, niet ervoor —
   anders krijgen lopende requests `CONNECTION_UNAVAILABLE` in plaats van netjes
   af te ronden. `close()` is idempotent en terminaal.
3. **`/readyz` op de verbindingstoestand.** Die is nu pas echt in te vullen. Een
   readiness die altijd 200 geeft is erger dan geen — dan herstart de
   infrastructuur op basis van een leugen.
4. **`REDIS_URL` blijft bij jou.** De adapter leest `process.env` bewust niet;
   dat is wat hem twee keer naast elkaar instantieerbaar maakt en wat maakt dat
   een secret precies één plek heeft waar het kan lekken.

De in-memory fake blijft bruikbaar als default voor tests — juist daarom is het
een parameter.

## Eén ding dat je van mij moet weten

Een verstuurd Lua-script draait server-side door, ook als de verbinding wegvalt.
Er is geen rollback. Na een reconnect weet je dus niet of je laatste schrijfactie
is geland; herstel gaat via opnieuw lezen, of bij een antwoord via dezelfde
`actionId` — die komt terug als `{ replay: true }` zonder tweede score. Dat
mechanisme is getest met 24 gelijktijdige aanroepen en overleeft een
Redis-herstart.

## Waarom ik dit niet zelf doe

`server/index.mjs` is jouw bestand; de eenrichtingsregel zegt dat integratie
fouten vindt en de eigenaar ze herstelt. Bovendien raakt dit de opstart- en
afsluitvolgorde van de hele server, en dat is precies het soort wijziging waar
twee mensen tegelijk niet in moeten zitten.

Zodra deze regel er staat is de INTB4a-DoD in één test aantoonbaar: match
starten, `docker compose restart game-server`, en verifiëren dat de room, de
scores en de action-cache er nog zijn. De opslagkant daarvan is al bewezen in
`server/data/adapters/redis/aof-restart.test.mjs`.
