# Prompt — DT-R4: Bevestigen dat Playwright/k6 nog geen concreet target hebben

Onderdeel van [`DT-RESUME-AFTER-DECISIONS.md`](DT-RESUME-AFTER-DECISIONS.md),
opdracht 3 ("voeg Playwright- en loadtesttooling toe wanneer hun concrete targets
bestaan"). Doel: opnieuw, met bewijs, vaststellen of die targets er al zijn — niet
aannemen dat het antwoord nog hetzelfde is als bij het schrijven van DT4a/DT5.

## Context

- `docs/multiplayer/DECISIONS.md` §Uitvoeringsakkoord dekt Playwright/loadtests al
  principieel goed. Deze prompt gaat niet over toestemming, maar over de vraag of
  er al iets is om tegen te testen.
- DT4a's scenario's hebben elk een **implementatieprerequisite**
  (geïntegreerde, gerenderde multiplayer-UI). DT5's evidence-matrix wijst criteria
  toe aan k6 die een **draaiende, spelbelastbare server** vereisen.

## Stappen

1. Zoek naar een gerenderde multiplayer-frontend: een HTML-entrypoint of
   route-koppeling die `client/flow/`'s modules (`route-resolver.mjs`,
   `join-state.mjs`, `match-phase-state.mjs`, enz.) daadwerkelijk aan de DOM
   koppelt. Het bestaande `index.html`/`app.js` is de singleplayer-app en telt
   niet als multiplayer-target.
2. Zoek naar een `game-server` die verder gaat dan `server/index.mjs`'s
   placeholder (§DT-R1) — d.w.z. echte `/api/v1/games`-afhandeling en
   Socket.IO-events, niet `501 NOT_IMPLEMENTED`.
3. Schrijf de bevindingen naar
   [`e2e-load-target-check.md`](../e2e-load-target-check.md) (nieuw bestand) — per
   tool (Playwright, k6): target bestaat / bestaat niet, met het concrete bestand
   of de afwezigheid daarvan als bewijs, en de datum van controle. Dit is het
   persistente overdrachtsartefact dat DT-R5 leest — geen mondelinge of
   cross-conversatie "melding".
4. **Als een target wél bestaat:** de dependency-goedkeuring is al gegeven
   (`docs/multiplayer/DECISIONS.md` §Uitvoeringsakkoord, expliciet: "voeg
   Playwright- en loadtesttooling toe wanneer hun concrete targets bestaan") —
   vraag **niet opnieuw** om een generiek akkoord. Noteer in
   `e2e-load-target-check.md` concreet wat de volgende stap zou zijn (Playwright
   toevoegen voor DT4a Deel 2, of k6 voor DT5 Deel 2) als aparte, uitvoerbare
   vervolgprompt — de daadwerkelijke `npm install` blijft wel een eigen actie,
   niet iets wat deze prompt zelf al doet.
5. **Als geen target bestaat (verwachte uitkomst):** wijzig niets aan `DT4a`/`DT5`;
   bevestig alleen expliciet, met datum, dat de eerdere blokkade nog steeds geldt —
   ook dit gaat in `e2e-load-target-check.md`, niet alleen in een chatbericht.

## Harde grenzen

- Geen `npm install`, geen wijziging aan `package.json` — het vaststellen dat een
  target bestaat is niet hetzelfde als de dependency toevoegen; dat blijft een
  eigen, aparte actie ook al is er geen nieuw mens-akkoord meer voor nodig.
- Geen nieuw testbestand onder `tests/e2e/` of `tests/load/`.

## Definition of done

- `e2e-load-target-check.md` bestaat, met per tool: target ja/nee, bewijs, datum.
  Dit bestand is wat DT-R5 leest.
