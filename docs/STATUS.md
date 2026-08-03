# STATUS — de actuele waarheid

**Eigenaar:** regie (Claude). **Bijgewerkt bij elk meetmoment; historie hoort
in git, niet hier.** Bij twijfel wint dit bestand van elk PROGRESS-bestand.

_Laatst geverifieerd: 3 aug 2026 (nacht) · commit `389edab`_

## Stand 3 aug ± 16:00 (115 commits vandaag)

### Live op play.aseso.nl
Werkende multiplayer-keten (create/join/QR/rondes/pauze), Rounda-naam,
menu = één voordeur. Visueel: bouwplaats — herontwerp loopt (drie
designrichtingen liggen bij de producteigenaar).

### Wacht op producteigenaar (de enige echte wachtrij)
1. Keuze designrichting (3 nieuwe varianten onderweg; eisen 5-9 vastgelegd)
2. M11 — besluitverzoek dialoog-transities (thema 3)
3. UI-11 — lettertype- en kleurbesluit
4. UI-20 — arbitrage: T2-9 vs T5-7 claimen beide het voorkeurenpaneel
5. UI-21 — productvraag grote QR-kaart vs room-header (D-018)
6. Rebuild-moment afspreken (alleen op gecommitte, gelande stand)
7. ± 280 ongepushte commits → push naar remote (backup!)

### Spelregel toegevoegd (NIVEAUS.md, regel 0)
Een component telt pas als af wanneer een scherm hem gebruikt — antwoord op
drie "gebouwd maar niet aangesloten"-gevallen vandaag.

### Bekende dubbelingen (eigenaar: thema 2/3 na UI-20-arbitrage)
Timer + rangpijltjes bestaan dubbel (module én handgebouwd in schermen);
handoff-item met drie concrete gebreken ligt klaar.

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

## Tegencontrole-2 (regie, 3 aug ± 07:00) — UITSLAG

**Eerste échte match gespeeld op productie**: 3 spelers (host-mobiel,
speler-mobiel, regie via invite-link), 10 rondes gestart, antwoorden,
pauze/hervat — de kernbelofte van besluit #35 is live bewezen.

| Check | Uitslag |
| --- | --- |
| `26473c9` eerste-snapshot-fix | ✅ live — host ziet lobby direct na Snel starten |
| `eb72578` UX-pass lobby | ✅ live (rebuild nam werkboom mee) |
| Mockmodus `?mock=1` | ✅ live geverifieerd: create → lobby → Ronde 1/5 → antwoord, **nul** `/api/`-verkeer; zonder `?mock` gewoon echte server |
| Kernbelofte end-to-end | ✅ create, join via code én invite-link, rondes, pauze/hervat |
| UX-kwaliteit | niet beoordeeld — staat al in FEEDBACK-eerste-livetest.md (4 punten) |

**Kanttekening hygiëne:** de rebuild kopieert de wérkboom, dus er draait code
live die nog niet gecommit is (mockmodus, branding, acceptance-criteria-
update). Commit door regie klaargezet maar geblokkeerd op `.git/index.lock`/
`HEAD.lock` die alleen de producteigenaar kan verwijderen:
`cd ~/game-app && rm -f .git/index.lock .git/HEAD.lock` → regie commit dan direct.

## Open launchblockers (volgorde = prioriteit)

1. **Git-locks weg + commit werkboom** (zie kanttekening) — producteigenaar + regie
2. **Livegang-sein**: `SHOW_MULTIPLAYER=true` in `public-mode.js` +
   force-recreate frontend (kaart "🎉 Samen spelen" zichtbaar) — wanneer
   producteigenaar de UX goed genoeg vindt
3. Feedbacklijst livetest (namen in lijst, code permanent, pauze-host,
   menu-layering) — elk een los mandaat, zie FEEDBACK-eerste-livetest.md
4. DT's keten-race onder Redis (matrixrij 13, ~1 op 7 flaky) — fixen vóór CI — DT/INT-A
5. **Herstelpad ontbreekt** (ARCHITECTURE.md §10 ongeïmplementeerd) —
   voorstel: accepted risk t/m pilots → **besluit producteigenaar**

## Wachtend op producteigenaar

- `rm -f .git/index.lock .git/HEAD.lock` (blocker 1)
- Sein per feedbackpunt + volgorde (blocker 3)
- Besluit herstelpad-als-accepted-risk (blocker 5)
- Productvraag typed answers: meer punten voor intypen dan meerkeuze?

## Rustende domeinen

GR · PD · PR (slotlichting door regie afgerond, `bb07aa9`) · DM · DT
(afgemeld na chaos-3/INTB-8, `94eee08`/`ab3e834`/`743b921`/`91af744`) ·
INT-A (afgemeld, `bc6e7bd`) — heropstart begint bij het eigen
PROGRESS-bestand.
