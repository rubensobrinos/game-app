# Refactor: `analytics.mjs`, `redis/data-store.mjs` en `index.mjs` opsplitsen

**Geen gedragsverandering.** De tests die er nu zijn, blijven groen en blijven
even streng.

## Waarom

Drie bestanden van 1365, 1313 en 913 regels. Ze zijn niet stuk, maar ze zijn te
groot om met z'n tweeën in te werken — en dat is precies de rem op dit project
geworden.

Het gunstige is: alle drie zijn ze zwaar gedekt. `analytics.test.mjs` (813),
`data-store.test.mjs` (1694), `index.test.mjs` (858), plus de
`data-store-conformance.mjs` (2217) die het poortcontract van 18 methoden
afdwingt. Als die groen blijven, is de verhuizing goed.

## Wat je opsplitst

Bepaal de opdeling door de bestanden te lezen; dit is de verwachting:

| Bestand | Voor de hand liggende naad |
| --- | --- |
| `redis/data-store.mjs` | per entiteit: room, player, match, round, session — het poortcontract blijft één module die ze samenbindt |
| `postgres/analytics.mjs` | schrijven, lezen en schema/migratie zijn drie verschillende dingen |
| `index.mjs` | omgeving lezen, de store bouwen, de server bouwen, de routes bedraden |

De **buitenkant blijft gelijk**: dezelfde exports, dezelfde namen, dezelfde
importpaden voor de aanroeper. Wie `createRedisDataStore` importeert, merkt
niets.

## Volgorde

Begin met `index.mjs` — die is het kleinst en het minst risicovol, en je leert
er de commitritmiek mee. Daarna de Redis-adapter, dan analytics.

Draai na elke stap de volledige suite, en voor Redis ook de tests die een
echte Redis nodig hebben (`REDIS_URL=redis://127.0.0.1:6380`). De
AOF-herstarttest en de conformancesuite zijn hier je vangnet.

## Praktisch

- `devkit check-autonomy` staat op maximaal 15 bestanden en 5000 regels per
  commit. Eén bestand per commit is hier de juiste ritmiek.
- Verplaatste code hoort **letterlijk** verplaatst te worden. Zie je onderweg
  iets dat beter kan, meld het — repareer het niet in dezelfde commit, want
  dan is niet meer te zien of een testfout van de verhuizing of van de
  verbetering komt.

## Niet doen

- Gedrag wijzigen, ook niet iets dat duidelijk beter zou zijn.
- `server/composition/` of `server/transport/` aanraken — daar werken anderen.
- Tests versoepelen om een verhuizing groen te krijgen. Valt een test om, dan
  is de verhuizing fout, niet de test.
