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
3. Rapporteer per tool (Playwright, k6) expliciet: target bestaat / bestaat niet,
   met het concrete bestand of de afwezigheid daarvan als bewijs.
4. **Als een target wél bestaat:** voeg geen dependency toe in deze prompt zelf —
   meld het aan `DT-R5` zodat de mens kan beslissen of nu al met Playwright/k6
   begonnen wordt, of eerst nog meer server-/UI-werk wenselijk is.
5. **Als geen target bestaat (verwachte uitkomst):** wijzig niets aan `DT4a`/`DT5`;
   bevestig alleen expliciet, met datum, dat de eerdere blokkade nog steeds geldt.

## Harde grenzen

- Geen `npm install`, geen wijziging aan `package.json`.
- Geen nieuw testbestand onder `tests/e2e/` of `tests/load/`.

## Definition of done

- Eén kort verslag (kan direct als input voor DT-R5, geen apart bestand nodig)
  met per tool: target ja/nee, bewijs, datum van controle.
