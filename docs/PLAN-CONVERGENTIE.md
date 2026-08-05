# PLAN-CONVERGENTIE — stabiliseren, dan één Rounda

**Aanleiding:** productvraag 5 aug 2026 — "we hebben 2 apps beetje in 1, de
single lijkt heel anders dan de multiplayer en de multiplayer heeft maar 1
game" — plus de stabilisatie-analyse van de producteigenaar diezelfde dag.

**Status: analyse + voorstel.** Deel A (stabilisatie) is uitvoerbaar binnen de
bestaande beslisbevoegdheid; deel B (convergentie) wacht op twee besluiten.

**Verificatie:** alle bevindingen hieronder zijn tegen de repo gecontroleerd
(OVERDRACHT-regel 5), met bestand:regel. Waar de aangeleverde analyse afwijkt
van de code staat dat erbij. Suite op moment van schrijven: **2900/2900 groen,
174 suites, 11,5 s** — bevestigd, niet overgenomen.

---

# Deel A — stabilisatieronde (eerst)

De kern staat er goed voor, maar tussen productkeuzes, implementatie en tests
zitten gaten. Uitbreiden vóórdat die dicht zijn, vergroot ze alleen.

## A0. BLOKKEREND — "Echt of nep" is selecteerbaar maar onspeelbaar

Dit is de zwaarste bevinding en hij staat nog niet in de aangeleverde lijst:
de drie lagen zijn los van elkaar opengezet en sluiten niet aan.

| Laag | Stand | Bestand |
| --- | --- | --- |
| Lobby-carrousel | `real_or_fake_flag` → `speelbaar: true`, stuurt `game:update-config` | `frontend/js/views/lobby.mjs:157,191` |
| Protocolvalidatie | `SELECTABLE_GAME_TYPES = ['flags_mc','real_or_fake_flag','higher_lower']` — accepteert het | `server/protocol/client-events-dispatch.mjs:144` |
| Contentbron | `FILLED_GAME_TYPES = ['flags_mc']` — **werpt** op alle andere | `server/composition/content-source.mjs:63` |

`startRound()` roept `source.buildQuestion()` aan **zonder try/catch**
(`server/composition/match-lifecycle.mjs:804`), en dat gebeurt vanuit een
geplande timer-callback (`server/transport/socket.mjs:530,565`). Een host die
in de lobby naar "Echt of nep" draait en start, krijgt dus geen ronde en geen
foutmelding — de room blijft in COUNTDOWN staan. Groen in de suite, want geen
enkele test draait die combinatie.

Ook ná het openzetten van `FILLED_GAME_TYPES` is het nog niet klaar:
`buildMatchQuestionPlan()` eist `generateFlagSpec` voor deze gameType
(`server/rules/question-selection.js:345`) en `createContentSource()` geeft die
niet door. De functie zelf bestaat wel (`shared/content/flag-spec.mjs:195`) —
de CT-3-blokkade in de commentaarkop van `content-source.mjs` is achterhaald.

**Fix (twee keuzes, allebei goed):** carrousel terug op alleen `flags_mc` tot
de keten af is, óf de keten in één keer afmaken (zie A5). Wat er níét mag
blijven staan is de huidige tussenstand. Plus: een defensieve `catch` rond
`buildQuestion` die een nette foutcode geeft in plaats van een stille hang.

## A1. `gameTypes` accepteert stilzwijgend meerdere spellen

Bevestigd. De validator laat iedere niet-lege lijst met geldige elementen door:

```js
// server/protocol/client-events-dispatch.mjs:198-202
if (!Array.isArray(list) || list.length === 0) return { ok: false, code: null };
if (!list.every((entry) => VALID_SELECTABLE_GAME_TYPES.has(entry))) return { ok: false, code: null };
```

De compositie gebruikt vervolgens uitsluitend `room.config.gameTypes[0]`
(`server/composition/match-lifecycle.mjs:356,692`). Een client kan dus drie
typen sturen, de server bevestigt ze in `room:config-changed` en negeert er
twee — en dat leest als heropende mixed games, die expliciet buiten scope
staan (besluit 32).

**Eis:** exact één gameType; alleen end-to-end ondersteunde typen; duplicaten
en meerdere waarden afwijzen; snapshot en `room:config-changed` bevestigen
dezelfde ene waarde.

## A2. De "geen tweede countdown"-fix is dode code

Bevestigd, inclusief de oorzaak:

```js
// server/transport/socket.mjs:526 — bedoeld: alleen ronde 1 telt af
if (runtime.round !== null && runtime.round !== undefined) { await runStartRound(roomId); return; }
scheduleAt(roomId, phaseEndsAt, () => runStartRound(roomId));
```

`runEndRound()` zet `runtime.round = null` (`socket.mjs:614`) vóórdat de
volgende COUNTDOWN wordt betreden. `runtime.round` is bij élke COUNTDOWN dus
leeg en de directe-start-tak wordt **nooit** genomen. De stilte tussen de
rondes die deze fix moest wegnemen, is er nog steeds.

**Fix:** "eerste ronde" afleiden uit persistente matchstate (`roundIds.length`
/ roundIndex), niet uit vluchtig runtimegeheugen. Test alle drie de paden:
matchstart → echte 3-2-1; ronde 1 → 2 zonder extra stilte; restart/reconnect
zonder op leeg runtimegeheugen te leunen.

## A3. Ranking en ties: de keten lekt op twee plekken

De aangeleverde analyse klopt in richting; de precieze plek is scherper — en
gunstiger, want de server is nergens fout.

| Schakel | Wat er gebeurt | Oordeel |
| --- | --- | --- |
| `server/rules/standings.js:105` `rankPlayers()` | competitierang 1–2–2–4 met `position` | ✅ |
| `server/composition/match-lifecycle.mjs:1187,1465,1519` | draagt `position` in podium én snapshot | ✅ |
| `server/transport/socket.mjs:540` | persoonlijke regel krijgt `position: entry.rank` | ✅ |
| `frontend/js/views/standings-model.mjs:18` | **gooit `row.rank` weg** en zet `position: index + 1` | ❌ |
| `frontend/js/views/standings-model.mjs:29` | overschrijft de **correcte** serverpositie met die index | ❌ |
| `frontend/js/views/scoreboard.mjs:169` | rendert `#${index + 1}` | ❌ (volgt uit het model) |
| `frontend/js/transport-mock.mjs` `toScoreboardEntry` | stuurt **helemaal geen** rank/position mee; snapshot gebruikt `findRankIndex() + 1` (regel 859) | ❌ |

De server rekent ties dus goed uit en de client gooit het antwoord weg: bij
een gelijke stand toont élk clientscherm 1–2–3–4 waar de server 1–2–2–4 zegt.
De mock kan het niet eens goed doen, want het veld zit niet in zijn payload.

**Eén ketencontract:** `rankPlayers()` bepaalt, events en snapshot dragen,
frontend toont `entry.position`, mock stuurt hetzelfde veld, en één
contracttest vergelijkt scoreboard, finished en snapshot bij een tie.

## A4. Vier publieke events staan niet in PROTOCOL.md

Geteld in `docs/multiplayer/PROTOCOL.md`: `player:rename` 1 vermelding
(onvolledig), `player:recolor` **0**, `game:update-config` **0**,
`room:config-changed` **0**. De code is daarmee de enige bron van waarheid
voor toegestane configvelden, rollen, foutcodes, idempotentie,
broadcastontvangers en wat reconnect herstelt.

Vastleggen vóór deploy, met voor `game:update-config` expliciet: alleen in
`LOBBY`, host-only, exact één speltype, atomische configpatch, canonieke
volledige config naar alle clients, dezelfde config in de reconnectsnapshot,
en een reeds gestarte match houdt zijn gepinde instellingen.

## A5. Testdekking: groen bewijst het oude, niet het nieuwe

2900 groen bewijst dat het bestaande systeem heel is. Van het nieuwe werk
ontbreekt: `gameplay.test.mjs`, `lobby.test.mjs`, carrousel →
`game:update-config`, disabled games wijzigen niets, serverconfig
synchroniseert de carrousel terug, inline antwoordvoortgang, countdown alleen
vóór ronde 1, en grensgevallen voor `gameTypes`. Bevestigd: die bestanden
bestaan niet en `COUNTDOWN` komt in `socket.test.mjs` drie keer voor, geen
enkele keer voor dit gedrag.

## A6. Werkstand veiligstellen

Geverifieerd: lokaal `main` staat **2 commits** vóór `origin/main`, er zijn
**10** opnieuw gewijzigde bestanden (protocol, socket, frontend, locales), en
er zijn **geen** git-locks meer. STATUS.md noemde tot vandaag nog ±280
ongepushte commits, oude locks en 2515 tests — die drie zijn hierbij
gecorrigeerd; de volledige herschrijving hoort ná de fixes van A0–A3.

## A7. Herstel na serverrestart (ARCHITECTURE §10)

Ongewijzigd open: Redis/AOF houdt room/match/round, maar timers en
socket-runtime zijn na een herstart weg — geen automatische
`PAUSED(server_recovery)`, geen beheerste `RECOVERY_RESUME`. Voor een kleine
pilot acceptabel als expliciet risico ("bij serverrestart start de host een
nieuwe room"). Voor een professionelere pilot: actieve rooms vinden bij
startup, naar `PAUSED(server_recovery)`, nooit een verlopen answerwindow
hervatten, host krijgt een herstelactie, hervatten via nieuwe countdown, oude
timers kunnen nooit dubbel afgaan, en recovery + uitkomst in de logs.
**Besluit producteigenaar** (staat al als launchblocker 5 in STATUS).

---

# Deel B — de convergentie zelf

## B1. Wat er feitelijk staat

| | Solo | Multiplayer |
| --- | --- | --- |
| Code | `index.html` + `app.js` (2641 rgl, vanilla) | `frontend/` ESM-views + `server/` + `shared/` |
| Design | `style.css` (1414 rgl, oude stijl) | `frontend/css/rounda-1c.css` (1c) |
| Content | eigen `data/*.js` | `shared/content/` — 230 landen, 3 talen |
| i18n | eigen tabel `T` in app.js | `frontend/locales/{nl,en,es}.mjs` |
| Games gebouwd | 10 | 5 (server) |
| Games **live** | 3 (`btn-flags`, `btn-real-or-fake`, `btn-geo`) | **1** |
| Route | `/solo` (nginx) | `/samen` (game-server) |

Aparte data, i18n, CSS en renderers. Alleen `flags/` wordt gedeeld.

## B2. Multiplayer heeft niet één game — hij *toont* er één

- `server/rules/question-selection.js` bouwt alle vijf vormen, met tests.
- `shared/content/` is voor alle vijf gevuld (capital, population, area, gdp,
  continent, namen + aliassen in NL/EN/ES, 230 landen).
- `generateFlagSpec(seed)` bestaat (`shared/content/flag-spec.mjs:195`).
- De kraan zit dicht op één regel: `content-source.mjs:63`.
- De client takt al af op gameType: `real_or_fake_flag` en `higher_lower`
  hebben een volledige rendertak in `frontend/js/views/gameplay.mjs`.

| Game | Server | Content | Client | Rest-werk |
| --- | --- | --- | --- | --- |
| Raad de vlag (`flags_mc`) | ✅ | ✅ | ✅ | — (live) |
| Echt of nep (`real_or_fake_flag`) | ✅ | ✅ | ✅ | A0: kraan + `generateFlagSpec` + mock + tests |
| Hoger/lager (`higher_lower`) | ✅ | ✅ | ✅ | idem |
| Hoofdsteden (`capitals_mc`) | ✅ | ✅ | ⚠️ | payload heeft dezelfde vorm als flags_mc, dus de default-tak rendert 'm fout (vlag + landnamen). Nodig: eigen tak + hoofdstadnamen in de frontend |
| Welke hoort er niet bij (`odd_one_out`) | ✅ | ✅ | ❌ | rendertak (meerdere vlaggen) + uitlegregel (open ontwerppunt doelbeeld §1) |

## B3. Het gat dat niemand dekt

| Doelbeeld v2 | Motor |
| --- | --- |
| Raad de vlag | `flags_mc` ✅ |
| Echt of nep | `real_or_fake_flag` ✅ |
| Welke hoort er niet bij | `odd_one_out` ✅ |
| **Raad het land (contour)** | **bestaat niet server-side** |
| — | `capitals_mc` (gebouwd, niet in doelbeeld) |
| — | `higher_lower` (gebouwd, niet in doelbeeld) |

"Raad het land" is de solo-game `btn-geo`, met contourdata in
`data/geo-countries.js` (284 KB) + `build-shapes.js`. Die data zit niet in
`shared/content/` — de enige echte contentmigratie in dit plan.

## B4. Voorstel: solo wordt een modus van de multiplayer-app

`frontend/js/transport-mock.mjs` draait de volledige keten (create → lobby →
rondes → antwoord → uitslag) zonder server, live geverifieerd via
`/samen?mock=1`. Solo is dan geen tweede app maar dezelfde app op de
mock-transport: één kamer, één speler. Dat lost design, i18n, content én
renderers in één keer op, en elke nieuwe game verschijnt automatisch in beide
modi.

**Alternatief** (goedkoper, permanent duurder): twee apps houden en
`style.css` met de hand naar 1c hertekenen. Lost één van de vier divergenties
op en verdubbelt daarna elke nieuwe game. Niet aanbevolen.

---

# Deel C — volgorde en besluiten

De twee volgordes (stabilisatie en convergentie) zijn hier één lijst; ze
botsen niet, want "Echt of nep end-to-end" ís stap 1 van beide.

| # | Stap | Aard |
| --- | --- | --- |
| 1 | Feedbackronde-3-werk afmaken; **A0** dichten (carrousel terug óf keten af) | bugfix |
| 2 | **A2** countdown + **A1** `gameTypes`-contract repareren, met tests | bugfix |
| 3 | **A3** ranking/ties door de hele keten gelijk, met contracttest bij een tie | bugfix |
| 4 | **A4** de vier events in PROTOCOL + DATA-MODEL | docs |
| 5 | **A5** ontbrekende UI-tests; committen, pushen, **A6** STATUS herschrijven | test/docs |
| 6 | "Echt of nep" verticaal bewijzen: lobbykeuze → config → snapshot → vraag → antwoord → reveal → scorebord → rematch → reconnect. Pas dán live markeren | feature |
| 7 | Eén echte groepspilot (6–10 mensen): QR/link/code, laat joinen, verbindingsverlies, dubbele tab, naam+kleur, twee speltypen, 10 rondes, tie in de eindstand, rematch, iemand vertrekt. Meten: tijd tot eerste vraag, mislukte joins, antwoordlatency, reconnectduur, waar uitleg nodig was | pilot |
| 8 | **A7**-besluit: recovery bouwen vóór volgende pilots, of risico expliciet tijdelijk accepteren | besluit |
| 9 | Kleine gerichte metricset (verbindingen, rooms met sockets, connect/disconnect, geaccepteerde/afgewezen antwoorden, foutcodes per event, eventlatency, verloren fase-races, recoverypogingen, joins per methode) — alleen signalen die tijdens de pilot een concrete vraag beantwoorden | observability |
| 10 | Daarna pas deel B: solo als modus, `odd_one_out`/`capitals_mc`, contour-game | feature |

**Niet nu bouwen:** game drie, typed answers, meer instellingen. Eerst moeten
één en twee speltypen, ranking, configuratie, reconnect en herstel samen één
betrouwbare keten vormen.

## Besluiten voor de producteigenaar

| # | Besluit | Waarom nu |
| --- | --- | --- |
| **C-0** | A0 nu: carrousel terug naar alleen "Raad de vlag" (veilig, kost een regel), of direct de hele Echt-of-nep-keten afmaken (stap 6 naar voren)? | Er staat nu onspeelbare code in de werkboom; dit mag niet mee de deploy in |
| **C-1** | Richting: **solo als modus van de multiplayer-app** (voorstel) of twee apps met een 1c-restyle van solo? | Bepaalt of "singleplayer-restyle 1c" (OVERDRACHT open punt 8) nog werk is |
| **C-2** | Portfolio: de **vier uit doelbeeld v2** (dan is contour te bouwen en zijn `capitals_mc`/`higher_lower` dood hout), of de **vijf gebouwde** met contour later? | Bepaalt de volgorde binnen stap 10 |
| **C-3** | A7: recovery bouwen of expliciet accepteren t/m de pilots? | Stond al open als launchblocker 5 |

C-1 en C-2 blokkeren de stabilisatieronde niet: stappen 1–9 zijn in beide
scenario's hetzelfde werk.
