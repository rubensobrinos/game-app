# Fase 1-runbook — containerstack op de Mac Studio

**Aangemaakt:** 2 augustus 2026 · hoort bij de bestanden uit dezelfde commit
(`docker-compose.yml`, `compose.tunnel.override.yml`, `caddy/Caddyfile`,
`nginx/default.conf`, `server/Dockerfile`, `server/index.mjs`, `package.json`,
`migrations/001-analytics.sql`, `.env.example`).

## Wat dit is — en wat het nog niet is

De volledige fase 1-stack uit DEPLOYMENT-AND-TESTING.md staat klaar: Caddy,
frontend (de bestaande singleplayer-game), game-server-container, Redis (AOF),
PostgreSQL (met analytics-schema) en optioneel cloudflared.

**Eerlijke status van de game-server:** `server/index.mjs` is een bewuste
placeholder (alleen `/healthz`, `/readyz`, `/api/v1/time`). De echte
multiplayer-server (rooms, sockets, scoring — AR5/AR6) bestaat nog niet in deze
repo; ook `origin/main` bevat hem niet. De stack draait dus, en de
singleplayer-game is er publiek mee te serveren, maar multiplayer werkt pas
zodra AR5/AR6 (of bestaande code van elders, mits gecommit) `server/index.mjs`
vervangt. Het HTTP-contract van de placeholder is daarop voorbereid.

## Starten

```bash
cp .env.example .env        # eenmalig; vul POSTGRES_PASSWORD en TOKEN_PEPPER in
docker compose up -d --build
curl http://localhost/                # → singleplayer-game (via Caddy → nginx)
curl http://localhost/api/v1/time     # → { "serverTime": ... } (via Caddy → game-server)
```

Met Cloudflare Tunnel (poorten 80/443 dicht op de Mac):

```bash
docker compose -f docker-compose.yml -f compose.tunnel.override.yml \
  --profile tunnel up -d --build
```

Stoppen: `docker compose down` (volumes blijven staan).

## Handelingen die alleen Ruben kan doen

1. **Container-runtime kiezen en installeren** op de Mac Studio: OrbStack,
   Docker Desktop of Colima — één keuze (spec: "niet meerdere tegelijk").
2. **Cloudflare Tunnel** aanmaken (Zero Trust dashboard), token in `.env`,
   publieke hostname `play.aseso.nl` → `http://reverse-proxy:80`.
3. **DNS** voor `play.aseso.nl` (regelt Cloudflare bij de tunnelhostname).
4. **Mac als 24/7-server** (checklist DEPLOYMENT-AND-TESTING.md): slaapstand
   uit, runtime autostart, SSD-ruimte bewaken, updates niet tijdens events.
5. `.env` vullen: `POSTGRES_PASSWORD`, `TOKEN_PEPPER`
   (`openssl rand -base64 48`), evt. `CLOUDFLARE_TUNNEL_TOKEN`.

## Openstaande punten (bewust, met reden)

1. **Juridisch — logo's en voetbal:** `logos/` en `football/` worden gemount
   omdat de singleplayer-UI ze verwacht. PRODUCT.md eist dat merk-/clublogo's
   niet zonder vrijgave publiek gaan. Vóór de publieke launch: logospellen
   uitschakelen in de build óf deze mounts verwijderen. **Niet vergeten.**
2. **HSTS uit** tot de publieke HTTPS-route aantoonbaar werkt (spec: "HSTS na
   succesvolle test") — daarna aanzetten in `caddy/Caddyfile`.
3. **Rate limiting op create/join** ontbreekt: vergt een Caddy-plugin of
   afhandeling in de echte game-server. Registreren bij AR5/AR6.
4. **CSP bevat `unsafe-inline`** omdat de bestaande app inline scripts/styles
   gebruikt; aanscherpen kan pas na refactor van `index.html`.
5. **Assets niet gefingerprint** → cache staat op 1 dag i.p.v. "immutable,
   1 jaar". Volgt met een echte build-stap (post-slice).
6. **`/readyz` geeft 503** — klopt: er is nog geen Redis-/DB-verbinding om te
   checken. De compose-healthcheck gebruikt daarom `/healthz`.
7. **CI (`.github/workflows/ci.yml`) blijft kapot** (npm ci/Jest zonder
   lockfile/Jest); keuze uit de drie DT7-opties is nog steeds nodig. De nieuwe
   `package.json` maakt optie "node --test in CI" nu wel direct mogelijk.
8. **Back-upjob naar de NAS** (nachtelijke `pg_dump`) is nog niet opgezet —
   pas relevant zodra er echte analytics-data is.

## Relatie tot het Schaalpad

Dit is de fase 1-infrastructuur uit ARCHITECTURE.md ("volledige Compose-stack,
Redis als bron van waarheid, PostgreSQL voor analytics"). De launchnorm
(1 room × 100 spelers, 20 rondes — loadtest L1) is pas haalbaar en meetbaar
zodra de echte game-server in deze stack draait.
