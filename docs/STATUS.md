# STATUS — de actuele waarheid

**Eigenaar:** regie (Claude). **Bijgewerkt bij elk meetmoment; historie hoort
in git, niet hier.** Bij twijfel wint dit bestand van elk PROGRESS-bestand.

_Laatst geverifieerd: 3 aug 2026 (nacht) · commit `389edab`_

## Runtimeketen (wat draait er echt)

| Laag | Stand |
| --- | --- |
| play.aseso.nl | ✅ live (singleplayer, Play Aseso-branding, merkspellen-flag, deelknop) |
| Game-server | ✅ store-factory geland (`bc6e7bd`): `REDIS_URL` ⇒ Redis-adapter — **productie draait op Redis** |
| Multiplayer-frontend | ✅ **swap gedaan** (`98a114d`): echte `transport.mjs`; `/samen` rendert live (na Dockerfile-rechtenfix) |
| POST /api/v1/games (Snel starten) | 🔴 **500 in productie tot rebuild** — INT-18 gefixt in `389edab`, maar het draaiende image bevat die fix nog niet |
| Routering één-domein + /samen | ✅ actief; "Samen spelen"-kaart nog achter `SHOW_MULTIPLAYER=false` |

## Nacht van 2→3 aug: wat er gebeurde

1. **Blanco `/samen`** → oorzaak: `frontend/locales/nl.mjs` met host-rechten
   600 het image in gekopieerd → `EACCES`/500 voor user `node` → hele
   ESM-graaf dood. Fix: `chmod -R a+rX` in `server/Dockerfile` (structureel).
2. **"Er ging iets mis" op Snel starten** → live ingekaderd door regie
   (statisch ✅, API ✅, Redis-lezen ✅, tokencode lokaal ✅ → Redis-sessiepad
   verdacht) en door DT onafhankelijk exact benoemd als **INT-18**: de
   versioned tokenhash `v1:<hex>` bevat `:`, de segmentvalidator van
   `redis-keys.js` verbood dat → `saveSession` wierp bij élke roomaanmaak.
3. **INT-18 opgelost** (`389edab`): `assertFinalHashSegment` staat `:` toe in
   het laatste sleutelsegment; fixtures nu uit de échte `hashToken`
   (DT's vacuümverificatie-les). Resolutie gedocumenteerd in
   `docs/integration-plan/HANDOFF.md` §INT-18.

## Actuele testuitslag

Regie (sandbox, zonder live Redis): `npm test` **2515 groen · 0 rood**.
DT (met Redis, vóór de INT-18-fix): **2727 groen · 0 rood · 1 skip** — die
skip was de Redis-herstarttest, geblokkeerd op INT-18 → kan nu opnieuw.

## Open launchblockers (volgorde = prioriteit)

1. **Rebuild game-server** met `389edab` — producteigenaar, één commando:
   `cd ~/game-app && docker compose -f docker-compose.yml -f compose.tunnel.override.yml --profile tunnel up -d --build --force-recreate game-server`
2. **Twee-spelertest** door producteigenaar: laptop `/samen` → Snel starten;
   telefoon `/samen` → code → Meedoen → Start
3. **Livegang-sein**: `SHOW_MULTIPLAYER=true` in `public-mode.js` +
   force-recreate frontend (kaart "🎉 Samen spelen" zichtbaar)
4. DT's keten-race onder Redis (matrixrij 13, ~1 op 7 flaky: 3 i.p.v. 4
   `round:progress`) — fixen vóór CI, anders leert het team flaky negeren — DT/INT-A
5. **Herstelpad ontbreekt**: `RECOVERY_RESUME` wordt nergens aangeroepen, geen
   `rooms:active`-read bij boot, geen `PAUSED(server_recovery)` —
   ARCHITECTURE.md §10 ongeïmplementeerd. Voorstel: accepted risk t/m pilots
   (zelfde categorie als besluit #38) → **besluit producteigenaar**

## Wachtend op producteigenaar

- Rebuild + twee-spelertest (blockers 1–2 hierboven)
- Besluit over herstelpad-als-accepted-risk (blocker 5)

## Rustende domeinen

GR · PD · PR (slotlichting door regie afgerond, `bb07aa9`) · DM · DT
(afgemeld na chaos-3/INTB-8, `94eee08`/`ab3e834`/`743b921`/`91af744`) ·
INT-A (afgemeld, `bc6e7bd`) — heropstart begint bij het eigen
PROGRESS-bestand.
