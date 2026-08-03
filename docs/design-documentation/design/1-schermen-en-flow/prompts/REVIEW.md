# Review — de negen prompts van thema 1

Datum: 3 augustus 2026. Reviewer: dezelfde agent die de prompts schreef
(`c36acb4`) — dit is dus een zelfreview, met de beperking die daarbij hoort.
Wat hier staat is geverifieerd tegen de code, niet tegen mijn eigen geheugen
van wat ik bedoelde.

Methode: elke feitelijke claim in de negen prompts (bestandsnamen, functienamen,
payloadvelden, aantallen, "bestaat al"/"ontbreekt") is nagetrokken in
`frontend/js/`, `client/flow/` en `frontend/locales/`. Onderstaande bevindingen
zijn alleen de punten waar de prompt en de code uit elkaar lopen, of waar de
prompt een bouwer een verkeerde kant op stuurt.

## Samenvattend oordeel

De prompts zijn bruikbaar en de zwaarste claims kloppen. Wat er goed aan is:
elke prompt scheidt "dit bestaat al" van "dit ontbreekt", en de vier plekken
waar de designspec méér vraagt dan het protocol levert (S14's headline-typen,
S02's spelvorm/teams, S03's plak-URL, S04's sociaal bewijs) zijn allemaal
correct als `HANDOFF` gemarkeerd in plaats van weggemoffeld. Dat is precies wat
je wil.

Wat er niet goed aan is: **één prompt is inmiddels achterhaald** (06),
**één kruisverwijzing wijst naar een niet-bestaand bestand** (08), en **drie
prompts bevatten een redenering die een bouwer aantoonbaar de verkeerde kant op
stuurt** (04's countdownduur, 07's lege-ronde-headline, 08's medaille-swap).
Die vijf moeten worden gecorrigeerd voordat iemand ermee gaat bouwen.

## Geverifieerd en correct

Kort, omdat dit het grootste deel is:

- `edge-case-messaging.KNOWN_ERROR_CODES` bevat inderdaad exact **23** codes
  (prompt 05).
- `room-header.mjs` is compleet (`role="dialog"`, `aria-modal`, `setJoinUrl()`,
  `destroy()`, `formatCode()`), heeft **geen enkele** CSS-regel in
  `frontend/css/`, en wordt **nergens geïmporteerd** — de "90% al gebouwd,
  alleen inhangen en stylen"-diagnose van prompt 02 klopt letterlijk (prompt 02).
- `countdownEndsAt`, `COUNTDOWN_MS`, `secondsRemaining()` en
  `view-switcher.mjs`'s `GAMEPLAY_PHASES` (met `COUNTDOWN` erin) bestaan alle
  vier zoals beschreven (prompt 04).
- `SETTABLE_CONFIG_KEYS` bevat exact de acht genoemde sleutels;
  `defaultHostConfig()` zet `gameTypes: ['flags_mc']` en `mode: 'individual'`;
  `home.mjs` dispatcht inderdaad géén van `OPEN_ADVANCED`/`SET_FIELD`/
  `TOGGLE_HOST_PARTICIPATES` (prompt 09).
- `join-state.mjs` kapt stil af op 20 grafeem-clusters via `Intl.Segmenter`, en
  de preview is aantoonbaar invite-only — de code-comment op regel 20 zegt het
  met zoveel woorden. De beperking op sociaal bewijs in prompt 06 is dus echt,
  geen aanname (prompt 06).
- `codeInput` in `home.mjs` heeft geen keydown-handler: Enter doet niets
  (prompt 06).
- `game:finish`'s enige wire-validatie is "niet al `FINISHED`" — de S21-zorg
  van prompt 01 is terecht (prompt 01).
- `transport-mock.mjs` doet `room.listeners.set(sessionToken, listener)`, dus
  de dubbele-tab-hypothese van prompt 05 is goed onderbouwd. Prompt 05 vraagt
  terecht om reproductie vóór een fix (prompt 05).
- `round:ended`'s `distribution` is `[{optionId, count}]` zonder
  speleridentiteiten, en `selfCorrect` bestaat wél — de scheiding tussen
  bouwbare en niet-bouwbare headline-typen in prompt 07 klopt (prompt 07).
- Er zijn inderdaad drie locales (`nl`/`en`/`es`) met een parity-test
  (alle prompts die "alle drie de locales" zeggen).

## Bevindingen

### Prompt 06, S01.1 — achterhaald, thema 4 heeft dit al gebouwd (blokkerend)

`06-start-en-join-polish.md` regel 14–19 zegt dat `quickStartButton` alleen
`.disabled = true` zet en dat de tekst `Snel starten` blijft, en draagt op de
statuswissel naar `Potje maken…` toe te voegen.

Dat klopte op het moment van schrijven, maar niet meer. Thema 4 (`2f313c1`)
heeft dit al gebouwd:

- [`home.mjs:113`](../../../../../frontend/js/views/home.mjs#L113) rendert
  `quickStartStatus.textContent = state.status === 'creating' ? t('home.creating') : ''`
- `frontend/locales/nl.mjs` bevat `'home.creating': 'Potje maken…'` — exact de
  gevraagde tekst.

Bovendien heet de knop nu `'home.quickStart': 'Start direct een game'`, niet
meer `Snel starten` — prompt 06 citeert dus verouderde copy.

**Actie:** S01 punt 1 schrappen of herschrijven naar "geverifieerd, staat al in
`quickStartStatus`". De verwijzing naar `Snel starten` in punt 3 bijwerken.
Niet de bouwer een tweede `Potje maken…` laten toevoegen naast de bestaande.

### Prompt 08 — verwijst naar een niet-bestaand bestand (blokkerend)

[`08-leaderboard-en-podium.md:45`](08-leaderboard-en-podium.md#L45) schrijft
`02-S02-spel-aanpassen`. Dat bestand bestaat niet: het is
[`09-S02-spel-aanpassen.md`](09-S02-spel-aanpassen.md), en `02` is de
QR/code-prompt. De README nummert het correct als 09; alleen prompt 08 zit
ernaast.

**Actie:** verwijzing corrigeren naar `09-S02-spel-aanpassen.md`.

### Prompt 04 — negeert dat de countdown 1200 ms duurt (blokkerend)

Dit is de inhoudelijk belangrijkste bevinding.

`04-S07-countdown.md` draagt op "een grote `3`/`2`/`1`" te tonen en zegt in de
Definition of done: "een zichtbare, server-gesynchroniseerde aftelling
**gedurende `COUNTDOWN_MS`**". Maar:

- [`transport-mock.mjs:48`](../../../../../frontend/js/transport-mock.mjs#L48):
  `const COUNTDOWN_MS = 1200;`
- Het brondocument (`03` §6) noemt een richtduur van **2,5–3,0 s**.

Je kunt geen 3→2→1 tonen in 1,2 seconde. De prompt ziet dit half — route B
noemt terloops "~1,2–3s" — maar trekt de conclusie niet, en de DoD schrijft een
resultaat voor dat met de huidige mock onhaalbaar is. Een bouwer die dit
letterlijk uitvoert bouwt óf een aftelling die één frame per cijfer krijgt, óf
gaat stilzwijgend de mock aanpassen.

Er zit hier een echte open vraag onder: is `COUNTDOWN_MS = 1200` een bewuste
afwijking van `03` §6, of is de mock nog niet bijgetrokken? Dat is geen keuze
die de frontender alleen mag maken.

**Actie:** prompt 04 een expliciete stap geven: eerst vaststellen welke van de
twee bronnen leidend is (en het verschil melden als `HANDOFF`-item als dat een
protocol-/serverbesluit raakt). En de weergave zó specificeren dat hij bij korte
countdowns niet stukgaat — bijvoorbeeld: tel af vanaf `ceil(secondsRemaining)`
in plaats van hardcoded vanaf 3.

### Prompt 07, S14 — "iedereen fout" vuurt op een lege ronde

[`07-reveal-en-sociale-headline.md:44-45`](07-reveal-en-sociale-headline.md#L44)
zegt: "0 op de correcte optie is iedereen fout."

`buildDistribution()` initialiseert elke optie op 0 en telt alleen daadwerkelijk
ontvangen antwoorden op. Een ronde waarin **niemand** antwoordt levert dus een
`distribution` met overal 0 — inclusief de correcte optie. De regel zoals
geschreven toont dan de headline "iedereen had het fout", terwijl er niemand
geantwoord heeft. Dat is precies het soort onjuiste headline dat de eigen regel
bovenaan de prompt verbiedt ("liever geen headline dan een onjuiste"), en het is
nu extra relevant omdat thema 4 (`2f313c1`) net server-autoritatieve
GEEN ANTWOORD heeft geland.

**Actie:** de conditie aanscherpen tot "som van alle tellingen > 0 **én** 0 op
de correcte optie". Hetzelfde geldt spiegelbeeldig voor "iedereen correct":
vergelijk met het aantal gegeven antwoorden, niet met `eligiblePlayerCount`,
anders vuurt hij nooit zodra er één speler niet antwoordt.

### Prompt 08, S20.4 — de medaille-swap is geen CSS-wijziging

[`08-leaderboard-en-podium.md:49-51`](08-leaderboard-en-podium.md#L49) zegt dat
de latere asset-swap "een pure CSS/asset-wijziging" moet zijn.

Dat kan niet: de medailles zitten in de **locales**, niet in CSS.
`frontend/locales/nl.mjs` heeft `'podium.first': '🥇'`, `'podium.second': '🥈'`,
`'podium.third': '🥉'`, en `podium.mjs:47` haalt ze op via `t(medals[index])`.
De swap raakt dus drie localebestanden plus de parity-test — precies het soort
wijziging waarvan de prompt zegt dat hij 'm níet zal zijn.

**Actie:** de zin corrigeren. De constructieve kern (bouw geen eigen
iconografie, `D-015`) blijft staan; alleen de bewering over wat de swap kost
klopt niet. Overweeg meteen vast te leggen dat emoji-als-i18n-sleutel eigenlijk
een modelleerfout is — een emoji is geen vertaalbare tekst.

### Prompt 09 — `mode` betekent er twee verschillende dingen

[`09-S02-spel-aanpassen.md:15-18`](09-S02-spel-aanpassen.md#L15) zet in één zin:
`OPEN_ADVANCED` "wisselt `mode` naar `'advanced'`", en `SET_FIELD` wijzigt onder
meer `mode`.

Dat zijn twee verschillende velden:

- `HostSetupState.mode` — `'quick-start'` | `'advanced'` (welk scherm)
- `HostConfig.mode` — alleen `'individual'` (teams of niet)

Verderop (regel 34–38) wordt de tweede correct beschreven, en regel 57 mengt ze
weer ("een nieuwe `initialHostSetupState()` met `mode: 'advanced'` behouden" —
dat is de eerste). Een bouwer kan hier plausibel `SET_FIELD` met `key: 'mode'`
dispatchen in de verwachting van een schermwissel.

**Actie:** consequent `state.mode` en `config.mode` schrijven.

### Taal — Afrikaanse bezitsvorm, 7 plekken (systematisch)

`de hostbalk se aparte spelerslijst`, `lobby se eigen`, `de leaderboard se
laatste stand`, `de mock se ontvangen request`. Dat is Afrikaans, geen
Nederlands; het moet `de aparte spelerslijst van de hostbalk` of `lobby's eigen`
zijn. Zeven plekken, in 01, 02 (×2), 03, 08 en 09.

Het is niet alleen deze map: `frontend/locales/nl.mjs` regel 3 heeft
`de singleplayer-app se T['nl']`. Het is dus een terugkerende tic in door mij
geschreven tekst, niet een losse typo — de moeite waard om er breder op te
letten.

### Prompt 02 — linkt niet naar `HANDOFF` UI-10

`UI-10` in [`HANDOFF-UI.md`](../../../../frontend-plan/HANDOFF-UI.md) beschrijft
exact hetzelfde probleem als prompt 02 (dode `room-header.mjs`, `D-018` daardoor
niet zichtbaar) en is aan thema 1 geadresseerd. Prompt 02 noemt het niet.
Volgens `docs/handoff-principles.md` is de traceerbaarheid tussen die twee juist
het punt.

**Actie:** één regel in prompt 02: "lost `UI-10` op". En `UI-10` sluiten zodra
prompt 02 is uitgevoerd.

### Prompt 08, S15 — `standings-model.mjs` bestaat al

[`08-leaderboard-en-podium.md:19`](08-leaderboard-en-podium.md#L19) zegt "Zet
het in `views/standings-model.mjs` als pure functie". Het bestand bestáát al,
met `standingsFrom()`, `podiumTop3()` en vijf tests. Elke andere prompt is
scrupuleus over "bestaat al"; deze niet, en een bouwer zou het bestand opnieuw
kunnen aanmaken.

**Actie:** herformuleren naar "voeg toe aan het bestaande
`views/standings-model.mjs` (naast `standingsFrom`/`podiumTop3`), inclusief
tests in het bestaande testbestand".

### README — overschat het niveau van S09/S10

[`README.md:27`](README.md#L27) zegt dat `S08`/`S09`/`S10`/`S11`/`S12`/`S18` "al
op niveau 1" staan. In `../PROGRESS.md` staan **S09 en S10 op niveau 0**
(regels 37–38). De parenthese erna ("vallen sowieso buiten de lanceerscope")
verzacht het, maar de zin zoals hij staat klopt niet.

**Actie:** "S08/S11/S12/S18 staan op niveau 1; S09/S10 op niveau 0 en buiten de
lanceerscope."

## Wat ik expliciet níet als bevinding tel

- **Prompt 01 en 05 vragen om reproductie vóór een fix** (S21, dubbele tab).
  Dat leest als besluiteloosheid maar is het niet: in beide gevallen is de
  hypothese wél concreet opgeschreven en toetsbaar. Dat is de juiste vorm.
- **Prompt 07 is lang.** Dat is verdiend — het is het enige stuk waar de
  designspec zeven headline-typen vraagt en het protocol er drie kan leveren.
  De lengte zit in het uitleggen van dat verschil, niet in vulling.
- **De volgorde 01–09 is geen afhankelijkheidsketen.** De README zegt dat, en
  dat is correct; alleen 07 en 08 delen echt code. Geverifieerd: die gedeelde
  code is de vorige-versus-huidige-standvergelijking, en beide prompts wijzen
  naar elkaar.

## Prioriteit voor correctie

Voor gebruik, de drie blokkerende: **06 S01.1** kost een bouwer dubbel werk,
**08's kruisverwijzing** stuurt 'm naar een bestand dat niet bestaat, en
**04's countdown** laat 'm iets bouwen dat aantoonbaar niet in de beschikbare
tijd past.

Daarna: **07's lege ronde**, **08's medaille-swap** en **09's dubbele `mode`** —
allemaal fouten die pas tijdens het bouwen pijn doen, maar dan wel echt.

De rest (taal, de UI-10-link, `standings-model.mjs`, de README-telling) is
tekstueel en kan mee in dezelfde pas.
