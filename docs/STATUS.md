# STATUS — de actuele waarheid

**Eigenaar:** regie (Claude). **Bijgewerkt bij elk meetmoment; historie hoort
in git, niet hier.** Bij twijfel wint dit bestand van elk PROGRESS-bestand.

_Laatst geverifieerd: 5 aug 2026 · stabilisatieronde af, mobiele UX-ronde af en
live (v1c28), ronde 3 loopt._

---

## In één oogopslag

| | Stand |
| --- | --- |
| Suite | **3000+ groen · 0 rood** (telling van 5 aug: 2963; de UX-ronde heeft er tests bij gezet) |
| Live op rounda.io | Werkende multiplayerketen: create/join/QR/rondes/pauze/rematch. Speelbaar op een telefoon: home, spel, tussenstand en podium passen in één scherm |
| Speelbare games | **3 van de 4** — Raad de vlag, Echt of nep, Welke hoort er niet bij (alle drie verticaal bewezen). Raad het land (contour) resteert |
| Git | schoon; alles gecommit en gepusht (zie onderaan) |
| Grootste open risico | de pilot is nog niet gedraaid — alles is getest, niets is met echte mensen gespeeld |
| Loopt nu | ronde 3: hostacties, spelinstellingen, betrouwbaarheid (`docs/agent-opdrachten/ronde-3/`) |

De volledige analyse en volgorde staan in **`docs/PLAN-CONVERGENTIE.md`**. Dat
document is leidend voor wat er nu gebeurt; dit bestand zegt waar we staan.

## Wat er 5 aug is gerepareerd (stabilisatieronde)

| | Was | Nu |
| --- | --- | --- |
| **A0** | Carrousel zette `real_or_fake_flag` speelbaar, contentbron kon 'm niet bouwen → room bleef stil in COUNTDOWN | `shared/content/game-catalog.mjs` is de enige bron voor "speelbaar"; contentbron faalt bij module-load als de catalogus meer belooft; `buildQuestion` in een try/catch met een interne `CONTENT_UNAVAILABLE` die op `error` gelogd wordt |
| **A1** | `gameTypes` accepteerde elke niet-lege lijst; compositie gebruikte alleen `[0]` | exact één speelbare waarde, afgedwongen in de protocolvalidatie én in `resolveGameConfiguration` (de trechter voor create én update) |
| **A2** | "geen tweede countdown"-fix las `runtime.round`, dat vlak ervoor op null wordt gezet → dode code | beslissing uit persistente `match.roundIds`; matchstart telt af, ronde 1→2 opent direct, hervatten na pauze telt weer af; getest inclusief serverherstart met leeg runtimegeheugen |
| **A3** | tussenstand 1-2-3-4, podium 1-2-2-4, client gooide de serverrang weg, mock had een eigen sortering | één rangschikker (`shared/rules/ranking.mjs`) voor scoreboard, snapshot, eindstand én mock; contracttest bij een échte tie. Bijvangst: spelers zonder score staan nu óók in de tussenstand |
| **A4** | vier publieke events stonden niet in PROTOCOL.md | `player:rename`, `player:recolor`, `game:update-config` en `room:config-changed` vastgelegd, inclusief de zeven regels voor update-config en een sectie over rang bij gelijke stand; DATA-MODEL bijgewerkt |
| **A5** | geen `gameplay.test.mjs`, geen `lobby.test.mjs`, carrousel en inline voortgang ongetest | beide bestanden er, met de carrousel → `game:update-config`-koppeling, de terugsynchronisatie vanuit de serverconfig, de BINNENKORT-staat en de inline antwoordvoortgang |

Gesloten handoff-items: **UI-15** (tie-regel door de hele keten) en de
mock-pin die de afwijking vastlegde.

## Wat er nu open staat

### Besluiten producteigenaar

| # | Besluit | Waar |
| --- | --- | --- |
| ~~C-1~~ | ✅ 5 aug: **solo wordt een modus**. Uitgevoerd — "Alleen spelen" staat op home | PLAN-CONVERGENTIE §B4 |
| ~~C-2~~ | ✅ 5 aug: **de vier uit doelbeeld v2**. Drie staan, contour resteert | §B3 |
| ~~C-3~~ | ✅ 5 aug: **bouwen**. Geland — een herstart zet lopende matches op `PAUSED(server_recovery)`, de host hervat met een nieuwe aftelling | BESLUITVERZOEK-recovery-en-metrics.md |
| ~~M-1/M-2~~ | ✅ 5 aug: **metrics mogen komen**. Geland achter een eigen secret; **zet `METRICS_SECRET` in `.env`** (min. 16 tekens) om `/metrics` aan te zetten — zonder secret geeft het pad 404 | idem |
| ~~Naamvorm~~ | ✅ 5 aug: **besluit 41** — spelersidentiteit wordt land + speels woord in de bijvoeglijke vorm (*Bulgaarse Koe*). Vastgelegd, **nog niet gebouwd** | DECISIONS.md 41 |
| — | Sein per feedbackpunt uit FEEDBACK-eerste-livetest.md | los mandaat |
| — | Productvraag typed answers: meer punten voor intypen dan voor meerkeuze? | FEATURE-typed-answers |

### Techniek (volgorde uit PLAN-CONVERGENTIE deel C)

1. ~~Stap 6 — "Echt of nep" verticaal~~ **klaar** (5 aug). Onderweg twee
   defecten gevonden en gerepareerd: `distribution` ging als object over de
   lijn terwijl de client een array leest (scherm-5-telling en sociale
   headlines verschenen buiten de mock nooit), en echt/nep was een muntworp per
   vraag in plaats van de gebalanceerde reeks.
2. **Stap 7 — één echte groepspilot** (6–10 mensen). Draaiboek + meetlat staan
   klaar: `docs/pilot-b-draaiboek.md`. **Uitvoering is aan de producteigenaar.**
3. ~~Stap 8 — recovery~~ **klaar** (C-3 = bouwen). De Redis-herstarttest die het
   gat vastlegde is omgedraaid en bewijst nu het herstel.
4. ~~Stap 9 — metricset~~ **klaar**, achter `METRICS_SECRET`. Zeven signalen,
   gericht op de pilotvragen; event-loop lag en room-size bewust overgeslagen.
5. **Stap 10 — deel B** (C-1/C-2 genomen): solo-als-modus ✅ en `odd_one_out` ✅
   staan. Resteert **"Raad het land"** — de enige game die niet op bestaande
   motoronderdelen meelift: contourdata (257 landen, gesleuteld op Engelse
   naam, zonder iso2) koppelen aan de pool, een eigen module vanwege het
   gewicht, nieuwe gameType, renderer porten. Uitgeschreven in
   PLAN-CONVERGENTIE §"Wat Raad het land nog vraagt".

### Mobiele UX-ronde — af

De 58 punten van de producteigenaar plus acht uit een tweede feedbackronde:
allemaal gebouwd, gereviewd en live. Verslag in
`docs/agent-opdrachten/ronde-2/VOORTGANG.md`.

### Ronde 3 — in uitvoering

| Wie | Ronde 1 | Ronde 2 | Ronde 3 |
| --- | --- | --- | --- |
| agent 1 | antwoord automatisch tonen | speler die weggaat | host wijzigt naam/kleur ander |
| agent 2 | continentfilter | home scrolt 13 px | — |
| agent 3 | Redis keten-race (~1 op 7 flaky) | contrastcontrole op 1c-kleuren | solo overleeft reload |

Dat sluit de vier punten die hier eerder als "blijvend open" stonden.

### Blijvend open, ongewijzigd

- Timer + rangpijltjes bestaan dubbel (module én handgebouwd in schermen).
- `capitals_mc` en `higher_lower` zijn gebouwd en getest maar staan in geen
  enkel scherm — weggooien of alsnog tonen is een productkeuze.

## Techniek in het kort

Mac Studio, OrbStack/Compose: Caddy → frontend (nginx, `/solo`) + game-server
(Node 22/Fastify/Socket.IO, serveert de multiplayer-frontend uit het image),
redis (AOF), postgres, cloudflared. `PUBLIC_APP_URL=https://rounda.io`.
Mock zonder server: `/samen?mock=1`.

**Valkuilen:** de build kopieert de wérkboom (nooit mid-sprint deployen);
bind-mounts vragen `--force-recreate`, geen `restart`; cachebust `?v=1cX`
ophogen in `frontend/index.html` bij CSS-wijzigingen.

**Meten op een telefoonformaat:** `node tools/meet-viewport.mjs <url> <flow>`
met flow `home|lobby|spel|tussenstand|podium`; referentie 390×650.

**Deploy:** `cd ~/game-app && docker compose -f docker-compose.yml -f
compose.tunnel.override.yml --profile tunnel up -d --build --force-recreate
game-server` (+ frontend/reverse-proxy als hun mounts wijzigden).

## Spelregels die blijven gelden

- **NIVEAUS.md regel 0:** een component telt pas als af wanneer een scherm hem
  gebruikt.
- **Besluit 32:** één gameType per match.
- **Speelbaar is een ketenuitspraak**, geen wens: vraagselectie, contentbron,
  spelscherm, uitslagscherm én mock moeten het aankunnen. Eén lijst:
  `shared/content/game-catalog.mjs`.
- **Een positie wordt op één plek bepaald:** `shared/rules/ranking.mjs`. Geen
  enkele client mag `index + 1` gebruiken.

## Rustende domeinen

GR · PD · PR · DM · DT · INT-A — heropstart begint bij het eigen
PROGRESS-bestand.
