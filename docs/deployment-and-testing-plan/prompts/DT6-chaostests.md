# Prompt — DT6: Restart- en chaostestprocedures

Onderdeel van [`README.md`](../README.md), fase DT6. Twee delen: Deel 1
(runbook-tekst) nu uitvoerbaar, Deel 2 (daadwerkelijke uitvoering) pas na
gefaseerde autorisatie.

## Deel 1 — nu uitvoerbaar: runbook per scenario

### Context

Bron: `docs/multiplayer/DEPLOYMENT-AND-TESTING.md` §Testlagen → 5. Restart- en
chaostests. Ook een lokale Compose-restart verandert externe proces-/datastate —
dus zelfs deel 1 blijft tekst, geen enkele opdracht wordt hier al uitgevoerd.

### Stappen

1. Maak `docs/deployment-and-testing-plan/chaos-runbook.md`.
2. Eén sectie per scenario uit de bron: game-server-restart midden in een ronde;
   Redis-restart met AOF; PostgreSQL tijdelijk weg; tunnel-reconnect; host offline;
   10% spelers-disconnect/reconnect. Elke sectie bevat: voorwaarde (welke stack
   moet al draaien), exacte te geven opdracht(en) (bijv.
   `docker compose restart game-server`), verwacht hersteltijdvenster, en het
   concrete controlepunt uit de bron (bijv. "Redisstate blijft bij
   game-serverrollback behouden", "clients rejoinen via snapshot", "hervat met een
   korte nieuwe countdown, niet door stilzwijgend fases over te slaan").
3. Voeg vooraan een expliciete drieledige volgorde toe die voor élk scenario geldt
   (zie README.md Fasering DT6): (1) stack installeren/opstarten, (2) resetten,
   (3) het scenario zelf uitvoeren — met een dedicated compose-projectnaam/netwerk
   zodat dit nooit een bestaande omgeving kan raken.

### Harde grenzen

- Eén nieuw bestand: `docs/deployment-and-testing-plan/chaos-runbook.md`. Puur
  tekst — geen enkele opdracht uit dit bestand wordt tijdens het schrijven ervan
  uitgevoerd.

### Definition of done (Deel 1)

- Bestand bestaat, dekt alle zes scenario's uit de bron, elk met een concreet
  controlepunt (niet alleen "en dan werkt het weer").

---

## Deel 2 — pas na gefaseerde autorisatie: daadwerkelijk uitvoeren

**Checkpoint: STOP hier, drie losse momenten, elk met eigen bevestiging vooraf
(README.md Fasering DT6 / Checkpoints):**

1. Lokale Compose-stack **installeren/opstarten** — vraag akkoord.
2. De stack **resetten** naar een schone teststand — vraag akkoord.
3. Eén runbook-scenario **daadwerkelijk uitvoeren** — vraag akkoord per scenario,
   niet één keer voor alle zes tegelijk.

Geen van deze drie gebeurt zonder expliciete, aparte bevestiging — ook niet als
scenario 1 al is goedgekeurd.
