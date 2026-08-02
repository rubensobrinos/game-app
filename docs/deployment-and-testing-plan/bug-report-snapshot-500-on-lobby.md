# Bugrapport — `GET /api/v1/games/{code}/state` geeft 500 op een LOBBY-room

**Van:** deployment-and-testing-plan (gevonden tijdens DT6-scenario 1,
2026-08-02).
**Voor:** de eigenaar van `server/transport/rest.mjs` — vermoedelijk
integration-plan (INT-A), gezien de bestandsheader ("LIJM, GEEN
DOMEINLOGICA") en de directe verwijzingen naar `docs/integration-plan/`-
terminologie in datzelfde bestand.
**Ernst:** hoog — dit endpoint is het snapshot-/reconnectpad
(`PROTOCOL.md` §Reconnect: "na verbinding vraagt client altijd een
snapshot"). Elke room die nog in `LOBBY` staat (dus: elke room vanaf het
moment van aanmaken tot de eerste match start) kan zijn eigen state niet
opvragen.

## Root cause (al gedocumenteerd in de code zelf)

`server/transport/rest.mjs`, route `GET /games/:code/state`, commentaar
vlak boven de faalcheck:

> "`validateSnapshotShape` is de vormcheck. Zie het handoff-item: die tweede
> faalt vandaag op een LOBBY-snapshot, omdat de validator een niet-lege
> `matchId` en een `matchSequence >= 1` eist die vóór de eerste match niet
> bestaan. Bewust niet omheen gebouwd."

Dit is dus geen mysterieuze fout — de auteur van deze route wist het en heeft
er bewust geen workaround voor gebouwd, in afwachting van een handoff-item.
Ik heb dat handoff-item niet kunnen lokaliseren in `docs/integration-plan/
HANDOFF.md` op het moment van schrijven (mogelijk nog niet toegevoegd, of
onder een ander nummer).

## Reproductie

```bash
# 1. Room aanmaken (blijft in LOBBY — geen match gestart)
curl -s -X POST http://<host>/api/v1/games \
  -H "Content-Type: application/json" \
  -d '{"config":{"preset":"quick_start","language":"nl"},"hostParticipates":true,"displayName":"Repro"}'
# → 201, retourneert o.a. "sessionToken" en "gameCode"

# 2. State opvragen met exact dat token
curl -s -w "\nHTTP %{http_code}\n" \
  http://<host>/api/v1/games/<gameCode>/state \
  -H "Authorization: Bearer <sessionToken>"
# → {"code":"INTERNAL_ERROR","meta":{}}  HTTP 500
```

Geverifieerd 2× onafhankelijk (twee verschillende rooms, twee verschillende
sessies) tegen `aseso-game-chaos` (image gebouwd vanuit de huidige `main`,
2026-08-02). Ook zonder enige restart/chaos aanwezig — dit is geen
gevolg van scenario 1, alleen daar toevallig eerst tegengekomen.

## Wat dit concreet blokkeert

- Elke `GET .../state`-aanroep vóór de eerste match start (dus: de hele
  lobbyfase — QR tonen, wachten op spelers, "Snel starten") faalt met 500 in
  plaats van een snapshot te geven.
- Reconnect tijdens de lobbyfase (bijv. een speler die de pagina ververst
  vóórdat de host op "Start" drukt) is daarmee kapot.
- Matrixrij 11 (twee rooms lekken geen state) en toekomstige reconnect-
  gerelateerde rijen kunnen dit pad niet gebruiken als `GET .../state` al op
  de eenvoudigste room faalt.

## Wat ik niet heb gedaan

Niet gefixt — `server/transport/rest.mjs` en `validateSnapshotShape` zijn
niet mijn module. Twee voor de hand liggende richtingen, geen van beide hier
gekozen:

- `validateSnapshotShape` versoepelen zodat een LOBBY-snapshot geen
  `matchId`/`matchSequence` hoeft te hebben (raakt de PROTOCOL.md-vorm/
  contracteigenaar);
- de route een expliciete LOBBY-tak laten nemen die de match-validatie
  overslaat (raakt de compositie-/transportlaag-eigenaar).

Welke van de twee — of iets anders — is een ontwerpkeuze voor de
contracteigenaar, niet iets wat ik als testrapport beslis.
