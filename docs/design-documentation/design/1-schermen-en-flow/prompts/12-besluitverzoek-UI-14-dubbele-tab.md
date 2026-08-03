# Prompt — 12: Besluitverzoek `UI-14` — dubbele-tab-aanpak bevestigen

Onderdeel van [`README.md`](README.md). **Geen bouwtaak — al gebouwd.** Dit is
een bevestigingsverzoek, geschreven zoals `docs/handoff-principles.md` het
voorschrijft: het voorstel staat er al, het besluit blijft bij de
producteigenaar.

## Gereproduceerd (principe 3)

Twee tabs met dezelfde `sessionToken` (localStorage deelt die tussen tabs)
roepen allebei `transport.connect(sessionToken, ...)` aan. `transport-mock.mjs`
houdt per sessie één listener bij: `room.listeners.set(sessionToken,
listener)`. Een tweede `connect()` overschrijft die entry stilzwijgend.
Reproductiescript + een Playwright-test met twee tabs in dezelfde
browsercontext bevestigen: de **eerste** tab stopt na dat moment voorgoed met
events ontvangen, zonder dat 'ie dat zelf weet — geen foutmelding, geen
statuswijziging, gewoon stilte.

`03-GAME-FLOW-AND-STATES.md` §7 vraagt twee dingen: (a) de nieuwste of eerste
sessie moet deterministisch leidend zijn, (b) de andere tab moet een uitleg
tonen in plaats van stil dood te gaan. (a) gebeurt al vanzelf (Map-overschrijving
= laatste `connect()` wint). (b) ontbrak volledig.

## Wat al gebouwd is (`session-shell.mjs`)

Een `BroadcastChannel` per sessie (`rounda-session-{code}`, browser-native,
geen nieuwe dependency in `package.json`). Elke tab kondigt bij het mounten
zijn eigen `tabId` + tijdstip aan. Een tab die een latere aankondiging voor
dezelfde sessie ziet, toont een banner (`session.duplicateTab`, alle drie de
locales) in plaats van stil door te draaien. Lost de onderliggende
Map-overschrijving niet op (transportlaag-gedrag, bewust niet aangeraakt) —
maakt de situatie alleen zichtbaar.

Geverifieerd met Playwright: de oudere tab toont de banner zodra de nieuwere
opent; de nieuwere tab zelf niet.

## Wat het besluit raakt

- **Nieuw mechanisme.** `BroadcastChannel` is geen bestaand patroon elders in
  de frontend — het eerste cross-tab-communicatiekanaal in deze codebase.
  `00-DESIGN-INDEX.md` §6 punt 9 vraagt expliciet om zo'n keuze niet
  stilzwijgend vast te leggen.
- **Alleen een banner, geen actieve stap.** De oudere tab blijft verder
  "leven" (kan nog steeds acties proberen te sturen, al komen er dus geen
  events meer terug) — er wordt niets afgesloten of geforceerd.

## Wat ik nodig heb om verder te kunnen

1. **Bevestigd** — `BroadcastChannel` + banner is de gewenste aanpak. Geen
   verdere actie nodig, dit item sluit.
2. **Anders, met een richting** — bv. een `localStorage`-event in plaats van
   `BroadcastChannel` (functioneel gelijk, minder direct — geen los kanaal,
   wel een polyfill-vrij alternatief voor de zeldzame browser zonder
   `BroadcastChannel`), of een actievere stap (de oudere tab zijn eigen
   socket laten sluiten zodra hij de aankondiging ziet, in plaats van alleen
   een banner te tonen).
3. **Nog niet, bewust** — dan blijft de banner staan als eerste stap, met dit
   item als open punt voor een latere, uitgebreidere aanpak.

## Regels

- Geen tweede cross-tab-mechanisme naast dit ene bouwen zonder het hier vast
  te leggen (`handoff-principles.md`'s anti-patroon "een tweede mechanisme
  naast dat van de eigenaar").
