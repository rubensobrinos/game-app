# Documentatie-audit — 6 augustus 2026

**Opdracht:** onderzoek, geen reparatie. Drie vragen: kloppen de 48 README's nog,
staan bestanden in een begrijpelijke map, en ontbreekt er iets. Alles hieronder is
gemeten tegen de repo-staat van vandaag (commit `2f8efca` en later — er werken
gelijktijdig andere agents in deze map, dus "vandaag" schuift terwijl dit rapport
ontstaat).

**Methode.** Voor elke bewering: bestand/map laten bestaan, testtelling laten
draaien (`node --test ...`), of grep tegen de echte broncode — nooit op het
gezag van de tekst zelf. Waar ik iets niet kon verifiëren staat dat er expliciet
bij. Een Python-scan controleerde alle 992 relatieve markdown-links in de repo
op broken references (resultaat: zie bevinding 12).

---

## Samenvatting — top 4

1. **`docs/openstaand/refactor/README.md`'s statuskolom is fout voor minstens
   zes van de acht opdrachten.** Ze zijn allemaal al uitgevoerd, maar staan er
   nog als "ja"/"zodra vrij" — precies het document dat moet voorkomen dat twee
   agents dezelfde klus doen.
2. **Vijf van de nieuwe mappen die deze week door refactors zijn ontstaan
   hebben geen enkele README**, terwijl elke vergelijkbare buurmap er wél een
   heeft.
3. **`docs/openstaand/README.md` markeert al afgerond werk als "klaar om te
   starten."** Concreet geverifieerd: "Host wijzigt naam/kleur van een ander"
   is gecommit (`ccdb830`), maar staat nog in de "nog te doen"-lijst.
4. **`tests/integration/README.md` en `tests/README.md` beschrijven een lege
   map** ("0/14 rijen geactiveerd", "bestaat nog niet") **die in werkelijkheid
   12 testbestanden bevat** en in elke volledige testrun meedraait.

---

## 1. Kritiek — risico op dubbel werk of een verkeerde beslissing

### 1.1 `docs/openstaand/refactor/README.md` — statustabel klopt niet meer

De tabel houdt bij welke van de acht opsplits-opdrachten "kan starten", "zodra
vrij" of "af" is. Gemeten tegen de daadwerkelijke bestandsgrootte en het bestaan
van de bijbehorende submap:

| # | Bestand | Tabel zegt | Werkelijk |
| --- | --- | --- | --- |
| 4 | `transport-mock.mjs` | "ja" (nog te doen) | **Af.** 1548 → 651 regels, `frontend/js/mock/` bestaat (12 bestanden). Zelf gebouwd en gecommit. |
| 5 | `session-shell.mjs` | "zodra vrij" | **Af.** 1169 → 734 regels, `frontend/js/session/` bestaat (4 bestanden). |
| 6 | `socket.mjs` | "zodra vrij" | **Af.** 1399 → 369 regels, `server/transport/socket/` bestaat (7 bestanden). Zelf gebouwd en gecommit. |
| 7 | `room-lifecycle.mjs` | "ná ronde 2" | **Af.** 1057 → 59 regels, `server/composition/room/` bestaat (6 bestanden). |
| 8 | `match-lifecycle.mjs` | "**als laatste**" (impliceert: nog niet begonnen) | **Af.** 1764 → 64 regels, `server/composition/match/` bestaat (7 bestanden) — juist de opdracht die de tabel zelf "als er één verhuizing iets kan breken, is het die" noemt. |
| 9 | `transport.mjs` | "ja" (nog te doen) | **Af.** 978 → 59 regels, `frontend/js/transport/` bestaat (5 bestanden). |
| 11 | `views/lobby.mjs` | "af" | **Klopt.** 1090 → 191 regels, `frontend/js/views/lobby/` bestaat. Enige rij die correct is bijgewerkt. |
| 1 | `base.css`+`components.css` | "ja" | **Af.** Beide bestandsnamen bestaan niet meer; opgesplitst in 9 bestanden (`tokens.css`, `reset.css`, `layout.css`, `forms.css`, `gameplay.css`, `results.css`, `lobby.css`, `session.css`, `components-core.css`). |
| 2 | serveradapters | "ja" | Vermoedelijk (deels) af: `server/data/adapters/{postgres,redis}/` bestaan als submappen. Niet verder geverifieerd tegen de oorspronkelijke 3591-regel-claim. |
| 3 | `rounda-1c.css` | "ná het uitslagscherm" | `rounda-1c.css` is nu 10 regels (was 1912) — grotendeels leeggetrokken, vermoedelijk samengevallen met opdracht 14. Niet los geverifieerd. |
| 14 | `1c-overrides.css` platslaan | "vóór 3" | `1c-overrides.css` is nu 1571 regels (dicht bij de genoemde 1609) — lijkt in uitvoering of recent gedaan. Niet verder geverifieerd. |

**Risico, concreet:** de eigen kopnotitie van dit document zegt "Twee van deze
in één opdracht betekent dat de agent halverwege leegloopt" en "8 gaat als
laatste... als er één verhuizing stil iets kan breken, is het die." Een agent
die dit document leest zoals bedoeld — als bron van waarheid over wat nog moet
— zou op basis hiervan **een tweede keer** aan `socket.mjs`, `match-lifecycle.mjs`
of `transport-mock.mjs` beginnen. Dat gebeurde in mindere mate al zichtbaar
tijdens dit onderzoek: meerdere van deze bestanden stonden bij aanvang van deze
sessie als "gewijzigd door een andere agent" gemarkeerd, wat past bij nog
lopende, mogelijk overlappende pogingen.

**Wat wél klopt:** de eerdere correctie in ditzelfde bestand (opdrachten 10, 12,
13 als "vervallen" gemarkeerd, met reden) is intern consistent en up-to-date —
dus het bestand wordt kennelijk af en toe bijgewerkt, alleen niet voor de
opdrachten die deze week daadwerkelijk klaar kwamen.

### 1.2 Vijf refactor-mappen zonder enige README

Elke vergelijkbare buurmap in deze repo heeft een `README.md`
(`server/architecture/`, `server/data/`, `server/protocol/`, `server/rules/`,
`client/flow/`, `shared/product/`). De mappen die deze week door de refactors
in 1.1 zijn ontstaan hebben er **geen enkele**, op geen enkel niveau:

- `server/composition/` — geen README, en ook geen README in de submap
  `server/composition/room/` of `server/composition/match/`.
- `server/transport/` — geen README, en ook geen README in `server/transport/socket/`.
- `frontend/` — geen enkele README, op geen enkel niveau (geverifieerd met
  `find frontend -iname "README*"` → leeg). Dat raakt ook `frontend/js/mock/`,
  `frontend/js/session/`, `frontend/js/views/lobby/` en `frontend/js/transport/`.

**Nuance, geverifieerd:** dit is geen totale black box. De "voordeur"-bestanden
(`room-lifecycle.mjs`, `match-lifecycle.mjs`, `socket.mjs`, `transport-mock.mjs`,
`session-shell.mjs`, `transport.mjs`, `views/lobby.mjs`) hebben stuk voor stuk
een degelijke koptekst die de opsplitsing uitlegt: welk bestand welke functies
kreeg en waarom. De informatie bestaat dus wél — alleen niet op de plek waar
elke andere map in deze repo hem zet (een `README.md` die je ziet zodra je de
map opent, vóór je één bestand hoeft te openen). `server/composition/` en
`server/transport/` zijn bovendien twee van de meest centrale lagen van de hele
server — beide zonder enige oriëntatie-README, terwijl het inhoudelijk minder
kritieke `server/rules/` er wel een heeft.

### 1.3 `docs/openstaand/README.md` — al afgerond werk staat nog als open

Peildatum in het bestand: 6 augustus 2026 (vandaag). Concreet geverifieerd:

- **"Host wijzigt naam/kleur van een ander"** staat onder "Klein — uren" met
  status "klaar om te starten." Werkelijkheid: commit `ccdb830 feat(host): host
  wijzigt naam of kleur van een andere speler` bestaat, en
  `server/transport/socket/clientevents.mjs` bevat de daadwerkelijke
  `case 'game:rename-player'`-implementatie. Dit is af, niet "klaar om te
  starten" (wat "nog niet begonnen" suggereert).
- **"Raad het land"** staat onder "Groot — weken" met dezelfde status "klaar om
  te starten." Van de vier deelopdrachten in `raad-het-land.md` is opdracht A
  (de contourvraag in `server/composition/content-source.mjs`) aantoonbaar af
  (eigen commit `2f8efca`, tests groen), en opdracht B is zichtbaar in
  uitvoering (`frontend/js/views/shape-renderer.mjs` bestaat al, nog
  ongecommit). "Klaar om te starten" klopt dus niet meer voor het geheel.

`docs/README.md` (de eigen regel van deze laag) zegt: "Zodra iets af is
verdwijnt het hier en komt het niet terug in statusoverzichten." Deze twee
items — en het losse bestand in bevinding 2.5 hieronder — laten zien dat die
regel niet consequent wordt toegepast.

### 1.4 `tests/README.md` en `tests/integration/README.md` — beschrijven een lege map die niet leeg is

`tests/README.md`: *"[integration/] Matrix klaar (DT3a), 0/14 code (DT3b)."*
`tests/integration/README.md`: *"DT3b — code (0/14 rijen geactiveerd)"* en
*"Waarom deze map nu leeg is: ... Die bestaat nog niet."*

Werkelijkheid, geverifieerd met `find`:

```
tests/integration/full-match-transport.test.mjs
tests/integration/full-match.test.mjs
tests/integration/games-vertical.test.mjs
tests/integration/matrix-row-01 t/m -14 (12 van de 14 rijen, niet 0)
tests/integration/metrics.test.mjs
tests/integration/support/composition-harness.mjs
tests/integration/support/transport-harness.mjs
```

Dit is niet een verwaarloosbaar hoekje: `npm test` draait deze hele map al
mee, en in **elke** testrun van vandaag (3309 tests, 0 rood) zaten expliciet
benoemde integratietests als "Matrixrij 11 over de wire" en "Keten over echt
HTTP en echte WebSockets." Het onderliggende plandocument
(`docs/deployment-and-testing-plan/integration-matrix.md`) heeft zelf al een
activatietabel die rijen 1, 2, 3, 5, 7–14 als "geactiveerd" markeert (van
2026-08-02) — de twee README's zijn dus niet bijgewerkt nadat het eigen
brondocument allang verder was.

---

## 2. Belangrijk — concrete onjuistheden, geen coördinatierisico maar wel misleidend

### 2.1 `server/protocol/README.md` — drie geverifieerd foute beweringen

- *"`auth-session` — (nog geen bestand)... PR8b-code wacht op menselijk
  akkoord."* — `server/protocol/auth-session.mjs` én `auth-session.test.mjs`
  bestaan wél en worden actief gebruikt (o.a. door `server/transport/socket/handshake.mjs`
  voor `hashToken`).
- *"12 client→server events."* Gemeten via
  `ALL_CLIENT_EVENT_NAMES.length` (geïmporteerd en uitgevoerd): **17**.
- *"16 server→client events."* Gemeten via `ALL_SERVER_EVENT_NAMES.length`:
  **17**.
- De rijentabel mist `preview-endpoint.mjs`/`preview-endpoint.test.mjs`, die
  wel in de map staan.

### 2.2 Root `README.md` — vermeldt het eigenlijke product niet

Het bestand beschrijft uitsluitend de losstaande singleplayer-prototype-app
("Open `index.html` in any modern browser... no build step, no dependencies").
Dat klopt nog steeds voor wat het beschrijft — `index.html`, `app.js`,
`style.css` staan er nog. Maar het rept met geen woord over wat inmiddels het
eigenlijke, actief ontwikkelde product is: de multiplayer-app in `server/` +
`frontend/`, `npm start`/`npm test`, of zelfs een verwijzing naar
`docs/README.md`. Wie dit bestand als eerste opent (de standaard GitHub-ingang
van de repo) krijgt de indruk dat dit een los HTML-bestand is — niet dat er een
Node-server, een Socket.IO-protocol en 3300+ tests bij horen.

### 2.3 `server/architecture/README.md` — "AR5/AR6 nog niet begonnen" terwijl de server draait

*"AR5 — server-skeleton (voorstel): ⬜ Niet begonnen"*, *"AR6 — proces-skeleton:
⏸️ Geblokkeerd... wacht op akkoord AR5"* — zowel in dit bestand als in het
onderliggende `docs/architecture-plan/AR-PROGRESS.md`. Geverifieerd: er
bestaat een volledig werkend serverproces (`server/index.mjs`,
`server/transport/`, `server/composition/`), dat ik in een eerdere sessie
zelf heb gestart en bevraagd via `curl`/Playwright. Dit is geen kleine
woordkeuze-kwestie — het staat er letterlijk als "nog geen draaiende code."

Kleinere bijvangst: de tekst verwijst naar `docs/STATUS-AUDIT-2026-08-02.md`
als bronbestand; dat bestand staat inmiddels op
`docs/archief/STATUS-AUDIT-2026-08-02.md` (verplaatst, referentie niet
meegewerkt — dit is een platte code-vermelding, geen hyperlink, dus mijn
geautomatiseerde linkcheck (bevinding 12) ving hem niet).

De testtelling zelf ("390/390") klopt overigens nog precies — gemeten met
`node --test server/architecture/*.test.js`.

### 2.4 Test- en inhoudstellingen die niet meer kloppen

| README | Beweert | Gemeten | Verschil |
| --- | --- | --- | --- |
| `server/data/README.md` | "509 tests groen" | 549 (`node --test 'server/data/**/*.test.js'`) | +40 |
| `server/rules/README.md` | "157/157 tests groen"; modultabel eindigt bij GR8 | 161 (`node --test 'server/rules/**/*.test.js'`); tabel vermeldt `country_shape_mc`/`selectCountryShapeQuestion` niet, terwijl die functie al in het bestand staat | +4, en een hele game-vorm ontbreekt in de tabel |
| `shared/product/README.md` | "35/35 tests groen" | 35 — **klopt** | — |

### 2.5 `docs/openstaand/verlopen-vs-onbekend.md` — voltooid werk niet opgeruimd

Niet zelf een README, maar rechtstreeks relevant voor vraag 3 (wat ontbreekt) en
gelinkt aan bevinding 1.3. Het bestand beschrijft besluit 48 ("een verlopen game
is iets anders dan een verkeerde code"). Commit `46f316b feat(protocol): een
verlopen game is niet hetzelfde als een verkeerde code` heeft dit al gebouwd —
`GAME_EXPIRED` staat in `server/protocol/error-codes.mjs` én is correct
bijgewerkt in `docs/multiplayer/PROTOCOL.md` (de canonieke laag deed het dus
goed). Maar: het bestand staat nog gewoon in `openstaand/`, wordt nergens door
`docs/openstaand/README.md` genoemd (niet eens als afgerond), en is niet naar
`docs/archief/` verplaatst — precies de drie dingen die `docs/README.md`'s
eigen regel voor die map voorschrijft.

---

## 3. Matig — ruis en kleine inconsistenties

### 3.1 "Locatie: voorlopig" — vijf READMEs wachten op een poort die al open is

`server/architecture/README.md`, `server/data/README.md`,
`server/protocol/README.md`, `server/rules/README.md` en `shared/product/README.md`
bevatten allemaal (bijna letterlijk gelijkluidend) een sectie **"Locatie:
voorlopig"**: de map "kan verschuiven zodra architecture-plan's AR5/AR6-voorstel
voor een serverskeleton landt." Zoals bevinding 2.3 laat zien is dat skeleton er
al lang, en geen van deze vijf mappen is sindsdien verplaatst — het lijkt erop
dat de mapindeling stilzwijgend definitief is geworden zonder dat deze
boilerplate-sectie is ingetrokken of bevestigd.

### 3.2 Losse bestanden op een rare plek

- **`brave_screenshot_rounda.io (1).png`** (185 KB) staat gecommit in de
  **repo-root** (`git ls-files` bevestigt: getrackt), met een spatie en
  haakjes in de bestandsnaam — typisch een debug-screenshot die per ongeluk is
  meegecommit (commit `1534f61`, een UI-fix over het voorkeurenmenu). Geen
  enkele README verwijst ernaar; het hoort niet in de root.
- **`src/`, `android/`, `ios/`** — drie lege mappen (alleen `.gitkeep`) in de
  root. `docs/archief/STATUS-AUDIT-2026-08-02.md` (zelf al gearchiveerd)
  verklaart waarom ze ooit zijn aangemaakt: een verkeerd devkit-profiel
  (`react-native-app`) dat inmiddels is gecorrigeerd naar `node-esm-app`
  (geverifieerd in `.devkit.yaml`). De oorspronkelijke reden voor deze drie
  mappen is dus al opgelost, maar de mappen zelf staan er nog, zonder dat
  ergens (nog) uitgelegd wordt waarom.
- **`play-aseso-design-documentation-v1.0.zip`** in de root is **niet**
  gecommit (`.gitignore` sluit `*.zip` uit) — geen repo-probleem, wel
  vermeldenswaardig als lokale rommel naast de wél-gecommitte screenshot
  hierboven.

### 3.3 Broken relatieve links — 35 gevonden, geen enkele in een README.md zelf

Een volledige scan van alle 992 relatieve markdown-links in de repo vond 35
kapotte verwijzingen. **Geen van de 48 README.md-bestanden zelf is de bron van
een kapotte link** — dat is een geruststellende, expliciet geverifieerde
uitkomst, geen aanname. De 35 zitten verspreid over niet-README-documenten,
grotendeels in `docs/archief/` (kruisverwijzingen die braken toen mappen op
verschillende momenten naar archief verhuisden, bv.
`docs/archief/IMPLEMENTATION-INDEX.md` heeft er 15) en in de `*-plan/`-map
(bv. `docs/product-plan/prompts/PD6-interface-proposal.md` verwijst naar een
niet-bestaand pad). Voorbeeld van een nog levend (niet-gearchiveerd) geval:
`docs/deployment-and-testing-plan/DT-PROGRESS.md` linkt naar
`../e2e-load-target-check.md`, terwijl het bestand in dezelfde map staat
(`docs/deployment-and-testing-plan/e2e-load-target-check.md`) — één `../` te
veel.

### 3.4 `data/README.md` — geen kruisverwijzing naar de nieuwe afnemer

`data/geo-countries.js` (singleplayer-contourdata) is sinds deze week ook de
bron voor de multiplayer-contourdata: `shared/content/build-shapes.mjs` leest
dit bestand rechtstreeks in om `shared/content/shapes.data.mjs`/`shapes-index.mjs`
te genereren (geverifieerd door de import/`readFile`-aanroepen in
`build-shapes.mjs` te lezen). `data/README.md`'s "New geo entry"-instructie
("Add an object with name, aliases, region, lat, lon, and shape") vermeldt niet
dat een wijziging hier ook `node shared/content/build-shapes.mjs` opnieuw
vereist om de multiplayer-game "Raad het land" niet stil te laten afwijken.
`docs/openstaand/raad-het-land.md` legt deze koppeling zelf wél goed uit — de
kennis bestaat, alleen niet op de plek waar iemand `data/geo-countries.js` gaat
bewerken.

### 3.5 `tools/` heeft geen README

`tools/` bevat inmiddels `meet.mjs` (expliciet aangehaald in `docs/STATUS.md`
als het meetinstrument voor het 390×650-schermbudget) plus twee nieuwere,
nog ongecommitte scripts. Geen README legt uit wat hier hoort te staan of
wanneer een script hier versus in `server/`/`frontend/` thuishoort. Laag risico
— het is een kleine, overzichtelijke map — maar wel de enige "gereedschap"-map
zonder enige oriëntatie.

---

## 4. Klein / ter informatie

- **`docs/STATUS.md`** ("de actuele waarheid", "bijgewerkt bij elk
  meetmoment") noemt zelf "Laatst geverifieerd: 5 aug 2026" en een testtelling
  van 2963. Vandaag gemeten: **3309**, nog steeds 0 rood. Het bestand is dus
  zelf-gelabeld als een moment-opname en is intern niet tegenstrijdig, maar is
  circa één dag werk achter — inclusief het feit dat het geen woord rept over
  de refactorronde uit hoofdstuk 1.
- **Positief:** ondanks het ontbreken van READMEs (bevinding 1.2) zijn de
  "voordeur"-bestanden van elke opsplitsing (zie 1.2) zelf goed gedocumenteerd
  met een kopnotitie die uitlegt wat waarheen is verplaatst en waarom. Een
  agent die het juiste bestand opent, komt niet met lege handen te staan —
  alleen wie eerst de mapinhoud scant (`ls server/composition/`) ziet zeven
  kale bestandsnamen zonder enige duiding.
- **Positief/context:** `AGENTS.md` noemt "Docstrings en README bijwerken"
  expliciet als iets wat agents zelfstandig mogen doen — het bijwerken van de
  bevindingen hierboven vergt dus geen aparte goedkeuring, alleen een aparte
  opdracht (deze was uitdrukkelijk onderzoek, geen reparatie).

---

## Bijlage — verdict per README (klopt / verouderd / ontbreekt)

Legenda: **klopt** = kerninhoud en concreet geverifieerde cijfers/bestanden
kloppen nog; **verouderd** = bevat minstens één concreet geverifieerde
onjuistheid; **bevroren** = hoort er volgens `docs/README.md`'s eigen regels
niet meer bijgewerkt te worden, en is dat ook niet — geen gebrek; **ontbreekt**
= directory zonder README waar de buurmappen er wel een hebben.

| Bestand/map | Verdict | Toelichting |
| --- | --- | --- |
| `README.md` (root) | verouderd (door omissie) | Bevinding 2.2 |
| `client/flow/README.md` | klopt | Modulelijst, conventies en testcommando geverifieerd tegen `ls client/flow/*.mjs` |
| `data/README.md` | klopt, met een gemis | Bevinding 3.4 |
| `flags/README.md` | klopt | Steekproef: structuur en instructies komen overeen met `flags/` |
| `football/README.md` | klopt | Idem |
| `logos/README.md` | klopt | Idem |
| `server/architecture/README.md` | **verouderd** | Bevinding 2.3, 3.1 |
| `server/data/README.md` | **verouderd** | Bevinding 2.4, 3.1 |
| `server/data/types/README.md` | klopt | Tabel komt overeen met bestandslijst; niet elk testaantal individueel herverifieerd |
| `server/protocol/README.md` | **verouderd** | Bevinding 2.1, 3.1 |
| `server/rules/README.md` | **verouderd** | Bevinding 2.4, 3.1 |
| `server/composition/` | **ontbreekt** | Bevinding 1.2 |
| `server/composition/room/` | **ontbreekt** | Bevinding 1.2 |
| `server/composition/match/` | **ontbreekt** | Bevinding 1.2 |
| `server/transport/` | **ontbreekt** | Bevinding 1.2 |
| `server/transport/socket/` | **ontbreekt** | Bevinding 1.2 |
| `shared/product/README.md` | klopt, op de bevroren locatiesectie na | Bevinding 3.1; testtelling (35/35) klopt exact |
| `frontend/` (elk niveau) | **ontbreekt** | Bevinding 1.2 — geen enkele README in heel `frontend/` |
| `docs/README.md` | klopt | Zelf recent bijgewerkt (6 aug), dekking tegen dit onderzoek geverifieerd |
| `docs/multiplayer/README.md` | klopt | Documentenlijst en leesvolgorde kloppen tegen `ls docs/multiplayer/` |
| `docs/openstaand/README.md` | **verouderd** | Bevinding 1.3; wel: `verlopen-vs-onbekend.md` ontbreekt zelfs helemaal in de lijst |
| `docs/openstaand/refactor/README.md` | **verouderd (kritiek)** | Bevinding 1.1 |
| `docs/architecture-plan/README.md` | bevroren, klopt als zodanig | Geen broken links, consistent met `docs/README.md`'s eigen regel |
| `docs/architecture-plan/prompts/README.md` | bevroren, klopt als zodanig | — |
| `docs/data-model-plan/README.md` | bevroren, klopt als zodanig | — |
| `docs/data-model-plan/prompts/README.md` | bevroren, klopt als zodanig | — |
| `docs/data-model-plan/proposals/README.md` | bevroren, klopt als zodanig | Recent aangeraakt (6 aug) |
| `docs/deployment-and-testing-plan/README.md` | bevroren, klopt als zodanig | — |
| `docs/deployment-and-testing-plan/prompts/README.md` | bevroren, klopt als zodanig | — |
| `docs/frontend-plan/README.md` | bevroren, klopt als zodanig | — |
| `docs/frontend-plan/prompts/README.md` | bevroren, klopt als zodanig | — |
| `docs/game-flow-plan/README.md` | bevroren, klopt als zodanig | — |
| `docs/game-flow-plan/prompts/README.md` | bevroren, klopt als zodanig | — |
| `docs/game-rules-plan/README.md` | klopt | Recent bijgewerkt (6 aug) |
| `docs/product-plan/README.md` | bevroren, klopt als zodanig | — |
| `docs/protocol-plan/README.md` | bevroren, klopt als zodanig | — |
| `docs/protocol-plan/prompts/README.md` | bevroren, klopt als zodanig | — |
| `docs/archief/2026-08-mobiele-ux-ronde/README.md` | klopt | Steekproef gelezen, intern consistent, geen broken links |
| `docs/archief/2026-08-ronde-3/README.md` | klopt (niet diepgaand herverifieerd) | Archief, per ontwerp bevroren |
| `docs/archief/plandocumentatie/**/README.md` (6×) | bevroren, niet individueel herverifieerd | Archief, per ontwerp bevroren; linkcheck vond geen kapotte links vanuit deze bestanden zelf |
| `tests/README.md` | **verouderd** | Bevinding 1.4 |
| `tests/chaos/README.md` | klopt | Zelf-beschreven als "nog geen scriptbestand" — klopt: alleen `.gitkeep` aanwezig |
| `tests/contract/README.md` | klopt | `tests/contract/protocol/` bestaat zoals beschreven |
| `tests/e2e/README.md` | klopt | Zelf-beschreven als "nog geen enkel bestand" — klopt |
| `tests/fixtures/README.md` | klopt | "9/9 tests groen" — niet exact herverifieerd op regelniveau, bestand en aanpak kloppen |
| `tests/integration/README.md` | **verouderd (kritiek)** | Bevinding 1.4 |
| `tests/load/README.md` | klopt (niet uitgevoerd, zoals beschreven) | Scripts bestaan zoals genoemd |

**Telling:** van de 48 gevonden README.md-bestanden zijn er **9 concreet
verouderd** (met geverifieerde onjuistheden: root, `server/architecture`,
`server/data`, `server/protocol`, `server/rules`, `docs/openstaand`,
`docs/openstaand/refactor`, `tests`, `tests/integration`), waarvan 2
(`docs/openstaand/refactor/README.md`, `tests/integration/README.md`) met een
reëel coördinatie- of misleidingsrisico. Vijf mappen missen een README waar
vergelijkbare buurmappen die wel hebben (`server/composition/` en zijn twee
submappen, `server/transport/` en zijn submap), plus heel `frontend/` als
geheel (dat raakt onder meer de drie in de opdracht genoemde mappen
`frontend/js/mock/`, `frontend/js/session/` en `frontend/js/views/lobby/`). De
overige README's kloppen of zijn terecht **bevroren** conform
`docs/README.md`'s eigen regels.
