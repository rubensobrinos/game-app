# INTB2b — Redis-adapter: de zestien niet-atomaire poortmethoden

**Domein:** INT-B. **Blokkade:** `redis`-dependency **én** HANDOFF-item
**INTB-1** (drie methoden missen `roomId` en zijn zonder besluit niet
implementeerbaar). **Bouwt op:** INTB2a.

---

## Prompt

Je implementeert zestien van de achttien poortmethoden tegen Redis. De twee
atomaire zijn INTB2c en INTB2d.

### Eerst controleren

Lees `docs/integration-plan/HANDOFF-INTB.md`, item **INTB-1**. Drie methoden —
`saveRound`, `loadAnswer`, `loadActionCacheEntry` — krijgen geen `roomId` mee,
terwijl `redis-keys.js` dat wél nodig heeft. Is dat item nog niet opgelost,
**bouw er dan niet omheen**: implementeer de dertien methoden die wél kunnen,
laat de drie andere expliciet ongeïmplementeerd met een duidelijke fout, en meld
de stand. Een globale `SCAN` als noodoplossing is geen optie — die schaalt niet
en verbergt het probleem.

### Lees verder

- `server/data/repository.js` — de signaturen.
- `server/data/in-memory-store.js` — de semantiek die je moet evenaren.
- `server/data/adapters/data-store-conformance.mjs` — jouw acceptatietest.
- `server/data/redis-keys.js`, `server/data/ttl.js`.
- `docs/multiplayer/DATA-MODEL.md` §Redis-sleutels, §TTL.

### Wat je bouwt

`server/data/adapters/redis/data-store.mjs` — een fabriek die een object
teruggeeft dat `assertImplementsDataStore` doorstaat.

Aandachtspunten die de fake verbergt:

- **Volgorde.** `listPlayers` leunt op een Redis-structuur zonder
  volgordegarantie. De conformance-suite legt vast wat mag; houd je daaraan.
- **TTL-refresh.** Elke schrijfoperatie ververst de TTL op de roomkern én de
  indexes, via `ttl.js`. Een room die nog gespeeld wordt mag niet verlopen omdat
  alleen het matchdocument werd aangeraakt.
- **Lookup-indexen.** `room:code:{code}` en `room:invite:{inviteHash}` moeten
  meebewegen met `saveRoom`. Een oude code die naar een room blijft wijzen is een
  capability-lek.
- **Ontbrekend record** geeft `null`, nooit `undefined`, nooit een throw.
- **Geen gedeelde referenties** — via JSON gaat dat vanzelf, maar de suite
  controleert het.

### Klaar wanneer

De conformance-suite uit INTB1a draait groen tegen deze adapter, met exact
dezelfde testcode als tegen de in-memory fake. Wijkt een test af, dan is dat óf
een adapterfout óf een gedrag dat de fake per ongeluk vastlegde — onderzoek welk
van de twee en meld het, pas nooit de suite aan om groen te worden.

### Opleveren

Pad, welke methoden af zijn, welke geblokkeerd op INTB-1, het resultaat van de
conformance-suite tegen echte Redis, en elk gedragsverschil met de fake dat je
bent tegengekomen.
