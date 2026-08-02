# Prompt — DT5: Loadtests

Onderdeel van [`README.md`](../README.md), fase DT5. Drie delen, elk met een eigen
checkpoint: Deel 1 nu uitvoerbaar, Deel 2 na `deps`-akkoord (k6), Deel 3 na apart
akkoord voor daadwerkelijke uitvoering.

## Deel 1 — nu uitvoerbaar: evidence-tabel

### Context

Bron: `docs/multiplayer/DEPLOYMENT-AND-TESTING.md` §Loadtests (tabel L0–L3) en
§Slagingscriteria L1. REVIEW.md #8 en #10: k6 kan niet alle criteria alleen
bewijzen — L0 vereist visuele beoordeling, sommige L1-criteria vereisen
state-inspectie of observability, niet alleen doorvoer-metrics.

### Stappen

1. Maak `docs/deployment-and-testing-plan/load-evidence-matrix.md`.
2. Eén rij per criterium uit de bron (L0 "functioneel en visueel"; L1: geen
   desynchronisatie, geen dubbele antwoorden/scores, p95 < 300 ms, antwoordpieken
   van 100 spelers binnen 2 s verwerkt, reconnectsnapshot correct, geen blijvende
   geheugengroei na room-TTL, assetervaring op echte mobiele verbindingen; L2/L3
   schaaldoelen) met kolommen: criterium | welke runner/methode het daadwerkelijk
   bewijst (k6 / integratietest (DT3) / observability-metric / E2E (DT4) /
   handmatige pilot) | reden waarom die en niet k6.
3. Voeg een korte paragraaf toe over L2/L3: die vereisen een expliciete
   omgeving-/providercheck vóór uitvoering (de bron zegt dit letterlijk: "L2 en L3
   worden eerst lokaal/LAN uitgevoerd").

### Harde grenzen

- Eén nieuw bestand: `docs/deployment-and-testing-plan/load-evidence-matrix.md`.
  Geen k6-scripts, geen nieuwe dependency.

### Definition of done (Deel 1)

- Bestand bestaat, elk criterium uit L0/L1 heeft een rij met een runner die het
  ook echt kan bewijzen (niet zomaar overal "k6" invullen).

---

## Deel 2 — pas na expliciet `deps`-akkoord: k6-scripts schrijven

**Checkpoint: STOP hier. Vraag akkoord om k6 te installeren/gebruiken — `deps`,
always_ask. Ga pas door na een go.**

1. Voor elke rij in Deel 1 waar k6 als runner staat: een script in `tests/load/`
   (L0–L3 uit de bron-tabel), met de p95/foutthreshold uit
   §Slagingscriteria L1 als assertie in het script zelf, niet alleen als
   commentaar.
2. Scripts schrijven mag na dit akkoord; ze **uitvoeren** is Deel 3, apart.

## Deel 3 — pas na apart akkoord: daadwerkelijk uitvoeren

**Checkpoint: STOP hier. Uitvoering tegen elke omgeving (ook lokaal/LAN) is
`prod`-gebonden zodra het niet een triviale lokale rooktest is — vraag expliciet
akkoord, en extra nadrukkelijk voordat er ooit via de publieke route (Mac Studio/
Cloudflare Tunnel) wordt getest, conform de bron: "Grote tests via tunnel of
publieke infrastructuur alleen gecontroleerd en conform providerlimieten."**
