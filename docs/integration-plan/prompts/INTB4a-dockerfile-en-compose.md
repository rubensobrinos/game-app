# INTB4a — Dockerfile bijwerken en de stack draaiend krijgen

**Domein:** INT-B. **Blokkade:** INTB2 en INTB3 (er moet iets te verpakken zijn).

---

## Prompt

Je maakt van de Fase 1-infra die op de plank ligt een stack die daadwerkelijk
start.

### Lees eerst

- `server/Dockerfile` — bestaat, met placeholder-verwijzingen.
- `docker-compose.yml` — de vijf services staan er.
- `docs/multiplayer/DEPLOYMENT-AND-TESTING.md`, sectie **Referentie Docker
  Compose** en **Observability**.
- `.env.example` — alleen sleutelnamen, nooit waarden.
- `package.json` — `npm start` draait `server/index.mjs`.

### Wat je doet

Werk `server/Dockerfile` bij: dependencies installeren met `npm ci`, `shared/`
meekopiëren (die map wordt gebruikt en ontbreekt nu in de kopieerstap), en de
placeholder-verwijzingen vervangen. Zorg dat `docker compose up -d --build` een
werkende stack oplevert.

### Aandachtspunten

- **`/healthz` en `/readyz`.** De eerste zegt dat het proces leeft, de tweede dat
  Redis en Postgres bereikbaar zijn. `/readyz` mag pas 200 geven als dat echt zo
  is — een readiness-check die altijd slaagt is erger dan geen, want dan schaalt
  of herstart de infrastructuur op basis van een leugen.
- **Healthchecks in compose** moeten iets betekenen. Een check die alleen kijkt
  of de poort openstaat, vertelt niets over de verbinding met Redis.
- **Logrotatie** is verplicht volgens de deploymentspec; zonder loopt de SSD een
  keer vol en dat merk je op de verkeerde avond.
- **Geen secrets in het image.** `.env` gaat nooit mee in de build; alleen
  `.env.example` met sleutelnamen staat in git.
- **`server/index.mjs` is van INT-A.** Raak hem niet aan. Werkt de stack niet
  omdat de entrypoint iets mist, dan is dat een HANDOFF-item aan INT-A.

### Klaar wanneer

`docker compose up -d --build` levert vijf draaiende, gezonde services op, en
INT-A's ketentest kan er via de lokale route overheen.

### Opleveren

Wat je hebt gewijzigd, de uitvoer van de healthchecks, en elk punt waar de
referentieconfiguratie uit de spec afweek van wat er nodig bleek.
