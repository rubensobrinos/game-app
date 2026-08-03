# Review — de tien prompts van thema 5

Datum: 3 augustus 2026. Reviewer: dezelfde agent die de prompts schreef — dus
een zelfreview, met de beperking die daarbij hoort. Alles hieronder is
nagetrokken tegen de code, niet tegen mijn herinnering van wat ik bedoelde.

Volgorde zoals gevraagd: eerst T5-9/T5-10 (nieuw), dan T5-7/T5-8 (correctieronde
bevestigen), dan T5-1 t/m T5-6.

## Samenvattend oordeel

De codeverwijzingen kloppen vrijwel allemaal, en de twee correctierondes op
T5-7/T5-8 waren terecht — die bevestig ik hieronder met de bron erbij.

Maar er is één bevinding die boven alle andere uitstijgt en die ik in de vorige
twee reviews niet had: **acht van de tien prompts hangen hun Definition of Done
op aan Playwright, en Playwright bestaat niet in deze repo.** Dat maakt die acht
niet afrondbaar zoals ze nu geschreven zijn. Daarnaast is T5-3 achterhaald en
kan T5-10's meetstap nu al worden overgeslagen.

---

## Cross-cutting — Playwright bestaat niet en vraagt een `deps`-besluit (blokkerend)

`tests/e2e/` bevat precies één bestand: een README die zegt

> **Deel 2 — echte specs:** pas na een `deps`-akkoord voor Playwright én de
> betreffende prerequisite. Nog geen enkel bestand hier.

Er is geen `playwright.config.*`, geen Playwright-dependency in `package.json`,
geen enkele spec. En `CLAUDE.md` zet `deps` onder **"Altijd vragen aan een
human"** — dit is dus niet iets wat een uitvoerende agent onderweg zelf oplost.

Toch staat Playwright in de Definition of Done van **acht** prompts: T5-1, T5-2,
T5-3, T5-4, T5-6, T5-7, T5-8 en T5-9. Bij T5-9 is de DoD zelfs volledig
Playwright (screenshots per drempel + de batching-meting). Geen van de acht
noemt dat het gereedschap ontbreekt.

Gevolg: wie een van deze acht oppakt, loopt vast op een dependency-besluit dat
niet van hem is — precies het soort verrassing dat deze prompts elders zo
zorgvuldig vermijden.

**Actie:** één van tweeën, maar wel expliciet.
1. Het `deps`-akkoord voor Playwright eerst halen (één beslissing, deblokkeert
   acht prompts), en dat als voorwaarde bovenaan `prompts/README.md` zetten; of
2. Per prompt een tussenstap toevoegen die zonder Playwright wél iets oplevert
   (handmatige meting met vastgelegde uitkomst), en de Playwright-DoD apart
   markeren als "zodra de e2e-laag bestaat".

Zolang dit niet gekozen is, is "klaar om uit te voeren" voor die acht te
optimistisch.

---

## T5-9 — Spelerslijst bij schaal

### De mock kan geen 150 spelers (blokkerend)

De DoD vraagt de lobby gesimuleerd met "0, 5, 15, 30, 50 en **150** deelnemers"
en noemt daarbij zelf het mechanisme: "`transport-mock.mjs` kan dit via
herhaalde `joinGame`-aanroepen vóór `connect()`".

Dat kan niet tot 150. `transport-mock.mjs:39` zet `MAX_PLAYERS = 100`, en
`joinGame` gooit `GAME_FULL` zodra `countActivePlayers(target) >= MAX_PLAYERS`
(regel 164-166). De mock levert dus maximaal 100 spelers.

Uitgerekend de 100+-rij is de interessantste van de tabel — dat is de enige rij
waar `07` §9 iets verbiedt ("geen permanente volledige namenmuur"). Die is met
het voorgestelde mechanisme niet aantoonbaar.

**Actie:** kies expliciet — `MAX_PLAYERS` in de mock verhogen (het is een
testdubbel, dus verdedigbaar, maar het is wél een gedragswijziging die je moet
benoemen), of de 100+-variant puur op `participantPresentationFor()`'s unit
tests bewijzen en de visuele controle bij 100 laten ophouden. Nu belooft de DoD
iets dat het genoemde gereedschap niet kan.

### De 44px komt niet uit `08` §2.6

De Regels citeren "Geen kleiner touch-target dan 44px ... (`08` §2.6)". `08`
§2.6 "Touch en motoriek" zegt alleen "grote targets; voldoende afstand" — geen
getal. De 44px is een bestaande repo-conventie (`base.css:251`
`min-height: 44px`), geen spec-eis.

De regel zelf is goed; alleen de bronvermelding klopt niet. **Actie:** naar
`base.css`' conventie verwijzen in plaats van naar `08` §2.6.

### Correct

De diagnose klopt: `lobby.mjs` rendert elke deelnemer als losse `<li>` in
`.lobby-players`, `hostbar.mjs` doet hetzelfde voor de kick-lijst, en
`lobby.emptyTitle`/`lobby.emptyHint` bestaan al. `applyPlayerChanged` bestaat
precies onder die naam (`session-shell.mjs:496`), dus de batching-aanwijzing
landt op de juiste plek. De scopekeuze om de kick-lijst er bewust buiten te
houden is goed onderbouwd.

---

## T5-10 — Host verliest verbinding

### Stap 1 is al te beantwoorden: er is geen server-side timeout

De prompt zet als eerste stap "meet of er server-side al een afkap-timeout
bestaat ná `host_disconnected`". Dat kan ik nu beantwoorden: **nee.**

`host_disconnected` komt in `server/` uitsluitend voor in commentaar, als
enum-waarde — `server/architecture/state-machine.js:82` en
`server/composition/match-lifecycle.mjs:186` ("maakt er geen [onderscheid]").
Er is geen grace-, abandon- of recoverytimer. De enige grace in de server is
`deadlineGraceMs: 250` (`room-lifecycle.mjs:105`) en dat is de
antwoord-deadlinemarge, iets heel anders.

Dat betekent dat T5-10 precies eindigt waar de prompt het voorziet: bij een
`HANDOFF`-item aan INT-A/PR. Dat is goed voorspeld — maar de meetstap kan eruit,
en de prompt kan meteen als handoff-formulering beginnen.

**Actie:** stap 1 vervangen door de uitkomst plus de bronregels, en de rest van
de prompt herschalen naar "dit is een `HANDOFF`, hier is het voorstel".

### Correct

`terminate()` (`session-shell.mjs:515`) en `standingsPayload` (`:172`) bestaan
zoals beschreven, dus het voorstel om het S21-scherm mét laatste stand te tonen
is uitvoerbaar zodra er iets is om op te reageren. De weigering om VIP-overdracht
aan te raken is juist. De gesplitste `PROGRESS.md`-rij in de DoD is precies de
goede vorm.

---

## T5-7 — Medium/tablet-compositie: correctieronde bevestigd

De correctie klopt. Een tweekoloms breakpoint is inderdaad een layoutvraag;
`O-002`/`O-003` bepalen typografie en accentkleur, niet of er kolommen mogen
staan. Het weghalen van die blokkade was terecht.

Ook de tweede correctie (§3 "Medium" noemt drie dingen, niet twee — het
voorkeuren-side-panel hoorde erbij) klopt, en het gevolg is goed ingeschat:
`app-menu.mjs` gebruikt een `setOpen()`-dropdownpatroon (`:93`) met
`aria-haspopup` (`:26`), dus een vast side panel is inderdaad een ander
interactiepatroon en meer werk dan de andere twee.

`#app-root`'s `max-width: 480px` (`base.css:210`) en de waarschuwing om die niet
globaal te verruimen: allebei correct.

Geen bevindingen buiten de Playwright-DoD hierboven.

---

## T5-8 — Large/podium-compositie: correctieronde bevestigd

De fasecorrectie klopt en is sterker dan de prompt zelf zegt. Twee bronnen, niet
één: `10-IMPLEMENTATION-ROADMAP.md:151` heeft `| podium | hoog | middel | 2 |`,
én Fase 2's acceptatiecriteria noemen letterlijk **"groot hostscherm heeft
podiumcompositie"** (regel 82). "Fase 3/4, dus te vroeg" was dus fout op twee
manieren.

De eigen waarschuwing bovenaan — dat de roadmap-rij mogelijk (deels) over thema
1's `S20` gaat en dat dit vóór de start afgestemd moet worden — is het beste
stuk van deze prompt. Het is exact hetzelfde overlappatroon dat ik in thema 4's
review vond tussen T4-4/T4-5 en thema 1. Hier is het wél vooraf gesignaleerd.

De vier "bewust niet"-punten zijn allemaal correct gemotiveerd (`O-010` is een
echt open PO-besluit, de headline-engine bestaat werkelijk niet, `D-015` staat
er).

Geen bevindingen buiten de Playwright-DoD hierboven.

---

## T5-1 t/m T5-6

### T5-3 is achterhaald (blokkerend)

T5-3's kernvraag is: "herstelt de nieuwe sessie `roundModel` opnieuw uit wat de
server nog weet, of laat het de speler zonder vraag achter." En contractvragen 2
en 3 gaan over of de vraag terugkomt en of een reeds ingediend antwoord
zichtbaar is als vergrendeld.

Dat is inmiddels gebouwd, door thema 4's T4-3 (commit `2f313c1`), ná het
schrijven van deze prompt: `session-shell.mjs:492` doet

```js
roundModel = hydrateFromSnapshot(payload?.currentRound, payload?.self?.answeredCurrentRound === true);
```

en `round-model.mjs`'s `hydrateFromSnapshot` zet `answerStatus: 'accepted'` als
dat snapshotveld waar is. Vragen 2 en 3 zijn dus grotendeels beantwoord —
gebouwd, niet gemeten, dus er blijft werk over, maar de prompt beschrijft het
nog als onbekend terrein.

Zelfde staleness-klasse als thema 1's prompt 06. **Actie:** T5-3 herschrijven
naar "verifieer de bestaande `hydrateFromSnapshot`-route" in plaats van "zoek
uit of er iets herstelt".

### T5-6's testaantal is fors verouderd

De prompt schrijft "`node --test` (bestaat al, 363/363)". Werkelijk nu:
**2749 tests, 0 fail** — de suite is groen. (Thema 4's T4-1 noemde 372; ook dat
is inmiddels achterhaald.)

**Actie:** het getal weghalen in plaats van bijwerken. Een hardgecodeerd
testaantal in een procesdocument veroudert per definitie tussen twee commits
door; "de bestaande `node --test`-suite" volstaat.

### T5-1, T5-2, T5-4, T5-5 — correct

- **T5-1**: `frontend/index.html:5` heeft inderdaad geen `maximum-scale`/
  `user-scalable=no`. De splitsing tussen paginazoom en tekstvergroting als twee
  aparte tests is goed — dat zijn echt verschillende faalmodi.
- **T5-2**: `.screen`'s `min-height: calc(100dvh - var(--header-h))`
  (`base.css:467`) en `#app-root`'s `max-width: 480px` (`:210`) bestaan zoals
  beschreven, en de redenering dat rotatie geen state-verlies geeft (module-
  closure, geen reload) klopt. Terecht dat de `max-width` hier niet aangepakt
  wordt maar naar T5-7 doorgeschoven — die twee prompts spreken elkaar niet
  tegen.
- **T5-4**: geverifieerd. `gameplay.mjs:81` zet `flag.src` zonder enige
  `error`-listener, `flag.alt` is `t('game.flagAlt')` (`:39`), en
  `renderedRoundId` (`:51`, `:79-81`) is inderdaad de plek waar de reset hoort.
  De anti-lek-regel (geen landnaam in de fallback) is de juiste lezing van
  `08` §7.
- **T5-5**: terecht geen bouwprompt. De volgorde (eerst de goedkope
  accessibility-tree-controle, dán de handmatige sessie) is goed, en de eis om
  te citeren wat de screenreader daadwerkelijk zegt in plaats van "werkt over
  het algemeen" is precies wat dit soort bewijs bruikbaar houdt. Het
  `window.confirm`-punt is relevant: die staat er echt (`hostbar.mjs:45,130`).

---

## Prioriteit

1. **Het Playwright-`deps`-besluit** — één beslissing, deblokkeert acht prompts.
   Alles hieronder is minder waard zolang dit openstaat.
2. **T5-9's 150-spelers-DoD** en **T5-3's staleness** — beide maken een prompt
   nu onuitvoerbaar of misleidend.
3. **T5-10's stap 1 schrappen** — het antwoord staat hierboven; de prompt kan
   meteen als handoff verder.
4. De rest (44px-citaat, T5-6's testaantal) is tekstueel.

T5-7 en T5-8 hebben geen eigen correctie meer nodig — de rondes die je al deed
waren juist, en de bronnen bevestigen ze.
