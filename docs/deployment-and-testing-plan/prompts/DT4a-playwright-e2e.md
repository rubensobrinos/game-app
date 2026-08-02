# Prompt — DT4a: Browser-E2E met Playwright

Onderdeel van [`README.md`](../README.md), fase DT4a. Twee delen met een harde knip
ertussen: Deel 1 is nu uitvoerbaar (documentatie), Deel 2 pas na een `deps`-akkoord.

## Deel 1 — nu uitvoerbaar: scenario's als pseudocode

### Context

- Scope: alles wat Chromium/WebKit-emulatie daadwerkelijk kan bewijzen —
  routes/navigatie, refresh, responsive viewports, browser-API-fallbacks. Niet:
  schermlock, native share, echte Safari/iPhone, trage 4G op een echt toestel (dat
  is DT4b).
- Playwright is niet geïnstalleerd. Zonder Playwright's eigen parser/linter kunnen
  syntax- of API-fouten in echte `.spec.ts`-bestanden niet gevalideerd worden —
  echte specbestanden schrijven zou dus een valse indruk van gereedheid geven. Dit
  deel levert daarom leesbare scenario-beschrijvingen/pseudocode in markdown, geen
  `.spec.ts`-bestanden.
- Bron: `docs/multiplayer/DEPLOYMENT-AND-TESTING.md` §Testlagen → Browser/E2E, plus
  de routes uit `docs/multiplayer/GAME-FLOW.md` §Routes (`/`, `/j/{inviteId}`,
  `/game/{code}`, `/host/{code}`, `/screen/{code}`).

### Stappen

1. Maak `docs/deployment-and-testing-plan/e2e-playwright-scenarios.md`.
2. Eén sectie per scenario, elk met: doel, betrokken route(s), voorwaarden (bijv.
   viewport-grootte), stappen als genummerde pseudocode (`goto`, `click`,
   `expect`-achtige beschrijvingen in proza, geen echte Playwright-API-calls), en
   verwacht resultaat. Dek minimaal: QR-link (`/j/{inviteId}`) opent de juiste
   room; refresh behoudt fase/score (client-side, dus tegen een gemockte
   transportlaag — zie `client-flow-plan`'s aanpak); portrait/landscape-viewport;
   kleine schermen; host speelt mee zonder dat de bedieningsbalk de
   antwoordinterface verdringt; geen centraal scherm nodig voor de kernflow.
3. Sluit af met een expliciete lijst van wat **niet** in dit deel zit en waarom
   (schermlock, native share, echte Safari, trage 4G — zie DT4b).

### Harde grenzen

- Eén nieuw bestand:
  `docs/deployment-and-testing-plan/e2e-playwright-scenarios.md`. Geen
  `.spec.ts`/`.spec.js`-bestanden, geen map onder `tests/e2e/` met code erin.
- Geen Playwright installeren, geen `package.json` aanmaken.

### Definition of done (Deel 1)

- Bestand bestaat, dekt alle automatiseerbare scenario's uit de bron.
- Nul bestanden onder `tests/e2e/` met code — die map blijft bij `.gitkeep` tot
  Deel 2.

---

## Deel 2 — pas na expliciet `deps`-akkoord: echte Playwright-specs

**Checkpoint: STOP hier. Vraag eerst akkoord om Playwright toe te voegen —
`deps`, always_ask (CLAUDE.md §Beslisbevoegdheid). Ga pas door na een go.**

### Stappen (pas na akkoord)

1. Playwright toevoegen (eerste keer dat dit een `package.json` nodig maakt in deze
   repo — meld dat expliciet, het raakt de hele repo, niet alleen `tests/`).
2. Elk scenario uit Deel 1 wordt een echt bestand in `tests/e2e/*.spec.ts`, met
   dezelfde dekking, nu als draaiende Playwright-test tegen een lokaal gestarte
   dev-server (niet tegen productie/Mac Studio — dat is `prod`).
3. Verifieer dat de suite daadwerkelijk draait (`npx playwright test`) en groen is
   vóór het als "klaar" te melden.

### Definition of done (Deel 2)

- Akkoord op de dependency is aantoonbaar gegeven vóórdat er een regel
  Playwright-code bestaat.
- Alle scenario's uit Deel 1 hebben een 1-op-1 corresponderende, echt draaiende
  spec.
