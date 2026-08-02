# INTB2a — Redis-adapter: verbinding, lifecycle en documentserialisatie

**Domein:** INT-B. **Blokkade:** geen — `redis@^6.2.0` staat al in `package.json`
met lockfile sinds commit `376bd4e`. **Bouwt op:** INTB1a/INTB1b.

---

## Prompt

Je legt het fundament van de Redis-adapter: verbinding, levenscyclus en de
manier waarop documenten worden opgeslagen. Nog géén poortmethoden — die komen
in INTB2b/c/d.

### Lees eerst

- `docs/multiplayer/DECISIONS.md` — **#22** (Room/Match/Round als *versieerbare*
  JSON-documenten; indexes, sessies en idempotency mogen passende
  Redis-structuren gebruiken), **#24** (officiële `redis`-package), **#28** (ESM,
  `.mjs`).
- `docs/multiplayer/DATA-MODEL.md`, secties **Redis-sleutels** en **TTL**.
- `server/data/redis-keys.js` en `server/data/ttl.js` — bestaand, gebruiken, niet
  herbouwen.
- `docs/multiplayer/ARCHITECTURE.md` §10 Herstelbaarheid (AOF, room-index).

### Wat je bouwt

`server/data/adapters/redis/connection.mjs` en
`server/data/adapters/redis/documents.mjs`.

**Verbinding:** een fabriek die een `redis`-client opzet en teruggeeft, met
expliciet gedrag voor verbindingsverlies en heropbouw. Configuratie komt uit
argumenten, niet uit `process.env` — de aanroeper leest de omgeving. Een
`close()` die netjes afsluit, zodat tests niet blijven hangen.

**Documentserialisatie:** #22 zegt "versieerbaar" maar niet hóé. Leg dat hier
vast en documenteer de keuze:

- elk JSON-document krijgt een expliciet schemaversieveld;
- lezen van een document met een onbekende of nieuwere versie faalt luid, en
  raadt niet;
- lezen van een oudere bekende versie is een migratiepad dat nu leeg mag zijn,
  maar de plek waar het komt moet bestaan.

Zonder dit is "versieerbaar" een woord in een besluit in plaats van een
eigenschap van de opslag, en merken we het pas bij de eerste incompatibele
deploy tijdens een live room.

### Harde eisen

- Geen enkele poortmethode implementeren. Dat is INTB2b/c/d.
- `roomsActiveKey` bijhouden is onderdeel van de room-index uit ARCHITECTURE §10;
  bepaal hier wáár dat gebeurt en leg het vast, ook al schrijf je het nog niet.
- TTL uitsluitend via `server/data/ttl.js`; verzin geen eigen waarden.
- Sleutels uitsluitend via `server/data/redis-keys.js`; nooit een string
  samenstellen.
- Geen secrets in code of logs. Pepper en verbindings-URL komen als argument
  binnen.
- Tests draaien tegen een echte lokale Redis. Is die er niet, dan slaat de suite
  zichzelf gecontroleerd over met een duidelijke melding — nooit stilzwijgend
  groen.

### Opleveren

Paden, de gekozen serialisatie- en versiestrategie met motivering, hoe
verbindingsverlies wordt afgehandeld, en hoe de tests zich gedragen zonder Redis.
