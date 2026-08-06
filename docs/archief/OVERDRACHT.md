# OVERDRACHT — Rounda-regiesessie (4 aug 2026)

Voor elke nieuwe Claude-sessie (mobiel/remote/vers): dit is de complete
context. Producteigenaar: Ruben (Aseso B.V.).

## Werkafspraken
1. Kort en direct, tabellen bij feedback, geen lange alinea's.
2. "Noteer" = noteren; "bouw" = bouwen. Nooit verwarren.
3. Challenge met inhoud, niet azijnzeikerig. Ruben beslist snel; leg vast.
4. Agents parkeren bij bezette bestanden (één regel) en gaan door.
5. Verifieer agent-claims tegen de repo, niet tegen rapporten.
6. NIVEAUS.md regel 0: component telt pas als een scherm hem gebruikt.

## Product
Rounda (besluit 39; voorheen Play Aseso): gratis browser-partygame over de
wereld. 30 sec van "zullen we?" naar potje. Host start, rest joint via
code/QR/link, 10 vragen, speedbonus, tussenstand, podium, revanche, max 100.
Live: rounda.io (+ play.aseso.nl redirect). Solo-spellen op /solo.
Naam: alles heet Rounda, geen subnamen (ook het rad-minigame).
Socials @playrounda; .com geparkeerd; merkcheck ROUNDS vóór registratie.

## Design (1c, heilig)
Ink #0a0a0c · lime #d8ff3e (actie, inkttekst erop) · magenta #ff3ea5
(competitie) · cyaan/oranje accenten. Space Grotesk / Archivo / JetBrains
Mono. Rad-logo (draait, R mee). Donker-eerst. Antwoord-vormen: RUIT/BOL/
PIEK/BLOK. Geen goed/fout vóór ronde-einde. Telefoon-eerst, a11y is eis,
NL/EN/ES. Bron: docs/design-documentation/ + frontend/css/rounda-1c.css
(transplantatielaag, eigenaar regie).

## Techniek
Mac Studio, OrbStack/Compose: reverse-proxy (Caddy), frontend (nginx solo +
bind-mounts), game-server (Node22/Fastify/Socket.IO, serveert multiplayer-
frontend uit het image), redis (AOF), postgres, cloudflared. .env:
PUBLIC_APP_URL=https://rounda.io. Mock: /samen?mock=1 (solo, geen server).
Valkuilen: build kopieert wérkboom (nooit mid-sprint deployen);
bind-mounts = --force-recreate, nooit restart; git-locks: rm -f
.git/index.lock; css-cachebust ?v=1cX ophogen in frontend/index.html.
Deploy: cd ~/game-app && rm -f .git/index.lock && docker compose -f
docker-compose.yml -f compose.tunnel.override.yml --profile tunnel up -d
--build --force-recreate game-server  (+ frontend / reverse-proxy indien
hun mounts wijzigden).

## Repo-kaart
docs/STATUS.md = waarheid · docs/multiplayer/DECISIONS.md (1-39) ·
docs/frontend-plan/HANDOFF-UI.md (UI-14..23) · docs/progress/ (dashboard,
live /progress) · docs/frontend-plan/: BRIEFING-UX-ontwerp, ONDERZOEK-
genre-en-ui-audit, FEEDBACK-eerste-livetest, FEATURE-typed-answers,
BOUWTICKET-rondo-lobbygame (=minigame). Code: frontend/js(+views),
server/, shared/, client/flow.

## Stand & open punten (4 aug)
Klaar voor deploy: segmententimer, countdown, 6-cellen-invoer, streaks,
minigame in lobby/pauze/reconnect/podium, permanente mini-QR, donker-
standaard, drietalig, 2600+ tests groen.
Open: (1) ticket A agents — mock toont geen reveal/scorebord/podium na
ronde; timer is-urgent vanaf sec 1 + 0 segmenten; (2) ticket B — hostbalk
naar 3 stille pillen onder start; spelerrij "NaamVerwijder" structureren;
(3) hercheck 11 reviewpunten na deploy (o.a. gekozen antwoord wit i.p.v.
lime); (4) INVALID_PAUSE_STATE naar compositie-eigenaar; (5) DT keten-race
onder Redis vóór CI; (6) besluit herstelpad ARCH §10 (accepted risk?);
(7) typed answers (spec klaar); (8) singleplayer-restyle 1c; (9) GIT PUSH
naar github.com/rubensobrinos/game-app — grootste openstaande risico;
(10) mijlpaal: eerste volledig uitgespeelde potje t/m podium+revanche.
