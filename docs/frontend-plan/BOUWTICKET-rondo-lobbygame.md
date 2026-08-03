# Bouwticket — Rounda, de lobby-minigame

**Naamcorrectie (producteigenaar, 3 aug 2026, ná een kort intern geschil —
zie `HANDOFF-UI.md` UI-23-omgeving): de lobby-minigame heet Rounda, geen
aparte "Rondo"-subnaam.** Bestandsnaam van dit ticket ongewijzigd
(stabiele link), inhoud hieronder bijgewerkt. Component en stylesheet zijn
hernoemd naar `rounda.mjs`/`rounda-model.mjs`/`rounda.css` (inclusief alle
`--rondo-*`/`.rondo-*`-namen daarin, samen met het component hernoemd).

**Bron:** producteigenaar, 3 aug 2026. Stylesheet aangeleverd en vastgelegd
als `frontend/css/rounda.css` (compleet: DOM-contract in de kop, namespaced
`--rounda-*`-variabelen, reduced-motion gedekt). **Dit ticket = de JS + de
inhang; de CSS is af en wordt niet aangepast zonder producteigenaar.**

## Wat het is

De lobby-activiteit (ontwerpopdracht §6): het Rounda-rad draait, van boven
valt een bal, de speler veegt links/rechts om de opening met de juiste
kleur-zijkanten boven te krijgen op het moment dat de bal landt. Werkt
zonder uitleg, telt niet mee voor de score, puur wachttijd-plezier.

## Te bouwen (in volgorde)

1. `frontend/js/views/rounda.mjs` — het component conform het DOM-contract
   in de CSS-kop. Aansturing exact zoals daar beschreven:
   - draaien: `--rounda-angle` op `.rounda-wheel` zetten (geen keyframes in
     spelmodus; `.rounda-wheel--idle` alleen voor de attract-stand);
   - veeg/pointer: horizontaal, `touch-action: pan-y` staat al in de CSS;
   - balkleur per beurt: `--rounda-ball-color` (cyaan ↔ magenta);
   - raak/mis: `.rounda-wheel--catch` / `.rounda-wheel--miss`;
   - tempo: `--rounda-fall-duration` korter bij hogere streak;
   - opening NIET dynamisch maken (staat expliciet buiten scope, 14%).
2. Inhang op ALLE wachtmomenten (aanvulling producteigenaar, 3 aug):
   de regel is "overal waar je wacht, nergens waar je speelt".
   - lobby (speler én host): attract-stand default, spel start bij aanraking;
   - pauze-overlay (spelerskant): zelfde dode moment, zelfde oplossing;
   - reconnect-wachtstand: rad i.p.v. kale statustekst;
   - podium voor niet-hosts (wachten op revanche);
   - NOOIT tijdens een actieve ronde — focus en gelijktijdigheid zijn heilig.
   Lokale score ("beste van deze lobby"), géén serververkeer — volledig
   client-side.
3. `prefers-reduced-motion`: attract-animaties staan al uit via de CSS;
   het spel zelf blijft speelbaar (veeg = directe rotatie, geen easing).
4. Tests conform huisregels; fixtures via echte functies (AGENTS.md).

## Eigenaarschap

Thema 1 (inhang/states) + thema 3 (spelgevoel/aansturing) samen, of één
mandaat. NIET tegelijk met de lobby-transplantatie in hetzelfde bestand
werken — afstemmen wie eerst.
