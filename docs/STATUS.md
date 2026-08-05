# STATUS — de actuele waarheid

**Eigenaar:** regie (Claude). **Bijgewerkt bij elk meetmoment; historie hoort
in git, niet hier.** Bij twijfel wint dit bestand van elk PROGRESS-bestand.

_Laatst geverifieerd: 5 aug 2026 · stabilisatieronde stap 1–6 geland; 7–9 liggen
bij de producteigenaar, 10 blokkeert op C-1/C-2._

---

## In één oogopslag

| | Stand |
| --- | --- |
| Suite | **2948 groen · 0 rood · 0 skip** (175 suites, ~11 s, zonder live Redis) |
| Live op rounda.io | Werkende multiplayerketen: create/join/QR/rondes/pauze/rematch |
| Speelbare games | **2** — Raad de vlag en Echt of nep (verticaal bewezen). De motor kan er vijf; zie PLAN-CONVERGENTIE §B2 |
| Git | schoon; alles gecommit en gepusht (zie onderaan) |
| Grootste open risico | herstel na serverrestart (ARCHITECTURE §10) — besluit C-3 |

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
| C-1 | Solo als modus van de multiplayer-app, of twee apps met een 1c-restyle? | PLAN-CONVERGENTIE §B4 |
| C-2 | Gameportfolio: de vier uit doelbeeld v2 of de vijf gebouwde? | §B3 |
| C-3 | Herstelpad na serverrestart bouwen, of expliciet accepteren t/m de pilots? | BESLUITVERZOEK-recovery-en-metrics.md |
| M-1/M-2 | Afscherming `/metrics` + timing van de eerste metricset | idem |
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
3. **Stap 8 — recovery** (C-3) — besluit ligt voor.
4. **Stap 9 — kleine metricset** — geblokkeerd op M-1 (afscherming `/metrics`)
   en bewust ná de pilot: metrics kiezen vóór de pilot is gokken welke vraag
   we straks hebben.
5. **Stap 10 — deel B**: solo als modus, `odd_one_out`/`capitals_mc`, contour.
   Blokkeert op C-1/C-2.

### Blijvend open, ongewijzigd

- DT's keten-race onder Redis (matrixrij 13, ~1 op 7 flaky) — fixen vóór CI.
- Timer + rangpijltjes bestaan dubbel (module én handgebouwd in schermen).
- Host wijzigt naam/kleur van ánderen — ticket, serverwerk.
- `player:leave` heeft nog geen compositiefunctie (`UNSUPPORTED_EVENT`).

## Techniek in het kort

Mac Studio, OrbStack/Compose: Caddy → frontend (nginx, `/solo`) + game-server
(Node 22/Fastify/Socket.IO, serveert de multiplayer-frontend uit het image),
redis (AOF), postgres, cloudflared. `PUBLIC_APP_URL=https://rounda.io`.
Mock zonder server: `/samen?mock=1`.

**Valkuilen:** de build kopieert de wérkboom (nooit mid-sprint deployen);
bind-mounts vragen `--force-recreate`, geen `restart`; cachebust `?v=1cX`
ophogen in `frontend/index.html` bij CSS-wijzigingen.

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
