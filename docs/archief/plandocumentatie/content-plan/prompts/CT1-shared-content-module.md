# CT1 — gedeelde contentmodule bouwen (`shared/content/`)

**Nieuw domein, prefix `CT`.** Dit was werkpakket 1 uit de projectoverdracht en is
het enige launch-kritieke onderdeel zonder eigenaar. Zonder deze module kan GR4
geen echte vraag selecteren en kan de servercomposition (AR5/AR6) geen match
draaien.

Lees eerst `docs/multiplayer/DECISIONS.md` — bindend. Relevant: #21
(`contentVersion`/`rendererVersion` gepind op Match), #28 (ESM, `.mjs`), #29
(locatie `shared/content/`), #32 (één `gameType` per match), #35 (quick-start
default `flags_mc`, 10 rondes).

## Context

Alle content leeft nu in browser-globals: `app.js` (~108 KB) en `data/*.js`
(countries, country-facts, flag-info, shapes, logos, football). ARCHITECTURE.md
§Principe 6 eist één versieerbare module die client én server gebruiken, zodat een
deploy nooit stilzwijgend een andere vraag of rendering veroorzaakt.

## Opdracht

1. Bouw `shared/content/` als pure ESM-modules (`.mjs`), draaibaar in Node én
   browser: geen DOM, geen globals, geen filesystem, geen dependencies.
2. Prioriteit 1 — de verticale slice: genormaliseerde landen-/vlaggenpool voor
   `flags_mc`: land-ID's, namen en aliassen per taal (NL/EN/ES),
   moeilijkheidsindeling, continent (voor afleiders uit hetzelfde continent,
   GAME-RULES.md), vlag-assetreferenties.
3. Prioriteit 2 — overige Golf 1-vormen: hoofdsteden (`capitals_mc`), metrieken
   inwoners/oppervlak/BBP (`higher_lower`), continentdata (`odd_one_out`) en de
   seed-deterministische nepvlag-specificatie (`real_or_fake_flag`; server maakt
   seed + spec, client rendert — zie PROTOCOL.md-voorbeeld `round:started`).
4. Exporteer een expliciete `CONTENT_VERSION`-constante en een stabiel,
   gedocumenteerd raadpleeg-contract (bijv. `getPool(gameType, difficulty,
   language)`); stem het outputcontract af op wat GR4 verwacht — bij twijfel is
   `docs/game-rules-plan/` leidend, verzin geen tweede vraagselectielaag.
5. **De singleplayer-app blijft ongewijzigd werken.** `app.js` en `data/` niet
   aanraken (hint.js-patroon); de module leest/hergebruikt bestaande databestanden
   of bevat een gedocumenteerde, herhaalbare extractiestap.
6. Volledige testdekking met `node --test`, geen dependencies.
7. Maak `docs/content-plan/CT-PROGRESS.md` aan volgens de vaste statuslegenda
   (✅ 🟡 🔵 ⛔ ⏸️) en meld je contract via een HANDOFF aan GR en AR.
8. Voeg geen teams, spectators, Groepsbattle, mixed games of Golf 2-content toe.
   Logo-/voetbaldata (merkenrecht) uitsluitend achter de bestaande
   feature-flag-afspraak; niet nodig voor Golf 1.
