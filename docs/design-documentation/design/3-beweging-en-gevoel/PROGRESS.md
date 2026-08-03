# Voortgang — 3. Beweging en gevoel

**Eigenaar:** UI — toegewezen 3 augustus 2026
**Documenten:** `06-MOTION-SOUND-AND-FEEDBACK.md`
**Criteria uit:** `11-DESIGN-QA-CHECKLIST.md` secties C, D, F, G en H
(start/lobby/motion/reveal/podium), plus twee criteria die dit gebied deelt
met thema 5: K ("Respecteert motion de systeemvoorkeur?", "Is geluid
uitschakelbaar en niet essentieel?") en M (§9 Performancebudget — "Zijn
animaties performant op middelmatige Androidhardware?"). De oorspronkelijke
verwijzing (alleen F en G) miste H's twee directe motion-checks
(confetti/reduced-motion, finale overslaan) en negeerde dat
reduced-motion/geluid-mute ook letterlijk in K staan. **C en D toegevoegd
(3 aug 2026, `prompts/M6`–`M7`):** E02/E03 corresponderen direct met
checklistvragen in C ("Verandert de knop direct naar `Potje maken…`?") en
D ("Krijgt een nieuwe join visuele feedback?", "Worden bulkjoins
gebatcht?") die tot nu toe in deze citatie ontbraken.
Schaal: [`NIVEAUS.md`](../NIVEAUS.md)
**Bijgewerkt:** 3 augustus 2026 · `M6`–`M10` uitgevoerd (commits `0a4c9d6`
t/m `148a132`), plus thema 1's zelfstandige bijdrage aan E04/E11/E12/E14

Dit gebied is geen lijst onderdelen maar een **gebeurteniscatalogus**: `06`
beschrijft vijftien momenten (`E01`–`E15`) waarop het spel hoort te reageren.
De vraag per regel is dus niet "hoe ziet het eruit" maar "vuurt er iets, en
wanneer".

Ook geldt hier een bijzondere rekenregel: **dit gebied *is* niveau 3 voor alle
andere vier.** Een 1 hier betekent dat er íéts van feedback is; een 2 is
choreografie. Dat dit gebied achterloopt is verwacht, niet alarmerend — het is
de laag die pas zin heeft als de schermen eronder staan.

## De vijftien momenten

| # | Moment | Fase | Niveau | Wat er vuurt (of niet) |
|---|---|---|---|---|
| E01 | Knop indrukken | overal | 2 | **Gedaan (`M1`, commit `99634a9`).** Alle acht controls uit de inventaris (`.btn-primary`/`.podium-rematch`/`.btn-secondary`/`.btn-destructive`/`.gameplay-option`/`.btn-quiet`/`.btn-opt`/`.btn-icon`) hebben nu identieke, tokengebaseerde `:active`-scale, elk met een non-transform reduced-motion-alternatief. Niveau 2 (niet 3): nog geen haptiek nergens, en niets op een echt apparaat getest. |
| E02 | Potje maken | landing | 1 | **Gedaan (`M6`, commit `a6be5d4`).** Knop-label wisselt zelf naar `Potje maken…` via de gedeelde `setButtonLoading()` (thema 2, T2-2) — spinner, breedte-lock, `aria-busy`. |
| E03 | Speler komt binnen | lobby | 1 | **Gedaan (`M7`, commit `ed6d313`).** Nieuwe spelerchip fade+scale via reconciliatie (geen volledige lijstherbouw meer), tellerpuls gedebouncet (300ms) tegen bulkjoin-ruis. |
| E04 | Countdown | rondestart | 1 | **Niet langer afhankelijk — thema 1 bouwde `S07`** (`1b7f40f`): `countdown`-substate in `gameplay.mjs`, cijfer uit `secondsRemaining(countdownEndsAt)`. Nog geen choreografie (tick-cue, opmaak) — dat is nu een niveau-1→2-vervolgstap, niet langer "bestaat niet". |
| E05 | Antwoordselectie | vraag | 1 | Gekozen optie krijgt direct een accentrand — géén goed/fout, dus anti-afkijk klopt. Hergebruikt E01's pressfeedback (zie noot); geen aparte pressanimatie, geen haptiek. Nog steeds `M2`'s werk. |
| E06 | Antwoord bevestigd | vraag | 1 | Statustekst verschijnt, opties vergrendelen. Bouwt óók op E01. Geen `Verstuurd ✓` in de component (bewust, `D-021`), andere opties dimmen niet. Nog steeds `M2`'s werk. |
| E07 | Laatste drie seconden | vraag | 1 | **Gedaan (`M8`, commit `f8ef891`).** Bouwt op thema 2's `.timer`/`.timer-track`/`.timer-fill`-balk (T2-3) — hun contrast (`--color-warning`) + mijn puls op `.timer-value`. `.gameplay-timer` (platte tekst) is vervangen en verwijderd. |
| E08 | Ronde sluit | rondeslot | — | **Vervalt als apart event ná review.** Bestaat niet als zelfstandig clientmoment: `optionsLocked()` staat voor wie al antwoordde al sinds E06 op `true`, en voor wie niet antwoordde komt sluiten en de volledige uitslag (E09) gelijktijdig binnen via `round:ended`. Samengevoegd met het begin van E09; het ontbrekende protocolmoment is gemeld als `HANDOFF-UI`-item, niet stilzwijgend opgelost. |
| E09 | Reveal correct antwoord | reveal | 1 | Correcte optie krijgt een groene rand, eigen resultaat verschijnt als tekst. Geen opbouw, fout gekozen optie wordt niet gemarkeerd. Nog steeds `M2`'s werk. |
| E10 | Punten tellen | reveal | 1 | Eindwaarde staat direct in de DOM — goed voor toegankelijkheid. Geen oplopende telling. Nog steeds `M2`'s werk. |
| E11 | Rank movement | tussenstand | 1 | **Data/tekst door thema 1** (`b547c8f`): `rankMovementFrom()`, `↑2`/`↓1`-badge met kleur + volledige-zin-`aria-label`. **Visuele beweging door mij** (`M9`, commit `158d531`): FLIP-transform + eigen-rij-emphasis, reduced-motion-gate. Dicht bij niveau 2, maar (nog) niet volledig: "een niveau geldt pas als het volledig gehaald is" (`NIVEAUS.md`) — geen echte apparaat-verificatie van de FLIP-beweging, alleen headless. "Geen complexe animatie bij 100+" was al gedekt door de bestaande `slice(0, 5)`. |
| E12 | Sociale headline | reveal | 1 | **Niet langer afhankelijk — thema 1 bouwde dit volledig** (`6700436`, `social-headline.mjs`): self-sole-correct/comeback/everyone-correct/everyone-wrong/misleading-answer, gewogen tegen expliciete drempels. Streak (E13) bewust buiten scope gehouden — "geen client heeft zicht op andermans streaks", zelfde conclusie als hieronder. |
| E13 | Streak | reveal | 0 | **Correctie (`REVIEW.md`, tweede ronde): de vorige regel hier was achterhaald.** Geen protocolgat — thema 1 trok die analyse zelf in (`HANDOFF-UI` UI-16, herzien): **eigen** streak is al af te leiden uit de bestaande `round:ended`-geschiedenis, alleen nog niet gebouwd. Uitgewerkt als voorstel in [`11-verzoek-streak-reactiezinnen.md`](../1-schermen-en-flow/prompts/11-verzoek-streak-reactiezinnen.md) (thema 1's scope: `streak-model.mjs` + reactiezin + opt-out), wacht daar op bevestiging. Zodra dat gebouwd is, heeft thema 3 nog een kleine motion-laag te doen (`06`'s "kleine persoonlijke viering") — niet eerder. Geen `HANDOFF-UI`-item hier aanmaken, dat zou dupliceren tegen een al ingetrokken analyse. **Andermans** streak (het sociale feit, "Sanne zit op een streak") blijft wél niet-bouwbaar — dat is een ander soort moment dan dit, en zit terecht niet in `social-headline.mjs`. |
| E14 | Podium | eind | 1 | **Stagger/skip door thema 1** (`b547c8f`): 3→2→1-reveal-volgorde, klik-om-te-skippen, winnaar-accent (`--color-accent-competition`, statisch). **Motion door mij** (`M10`, commit `148a132`): entrance-animatie, begrensde confetti, en een programmatische reduced-motion-gate die er nog niet was. Dicht bij niveau 2, maar confetti's performancebudget-conformiteit staat nog niet vastgelegd (wacht op `M5`'s audit) en niets is op een echt apparaat getest. |
| E15 | Reconnecting | overal | 1 | Statusbalk verschijnt en verdwijnt. Geen voortgang, geen successcue. |

**E01 is geen los item.** E05 en E06 hergebruiken letterlijk dezelfde
pressfeedback — `06` beschrijft die daar opnieuw omdat het de vraagcontext is,
niet omdat het een ander mechanisme is. E01 op alle controls + motion-tokens
brengen dus een deel van E05/E06 gratis mee, in plaats van drie keer evenveel
werk te zijn.

## Voorgestelde toevoeging: E16 — Overlay/dialoog open-dicht

**Niet stilzwijgend toegevoegd — expliciet voorstel voor `06`, nog niet
bevestigd.** **Correctie (`REVIEW.md`, tweede ronde): die bevestiging was tot
nu toe aan niemand gevraagd** — er stond geen `HANDOFF-UI`-item of
besluitverzoek tegenover deze regel, dus `M3`'s "wacht op bevestiging" was
een doodlopend spoor. Rechtgezet met
[`prompts/M11-besluitverzoek-E16-dialoog-transities.md`](prompts/M11-besluitverzoek-E16-dialoog-transities.md),
gericht aan de producteigenaar. De vijftien momenten dekken geen enkele dialoogtransitie. Drie
bestaande dialogen (hamburgermenu, QR-overlay, pauze-overlay) wisselen nu
puur via `hidden`/`display:none` — geen fade, geen scale, niets. Dat is een
reëel gat, geen editorial keuze: deze drie zijn precies de plekken waar `06`
§2's regel ("feedback op input start vrijwel onmiddellijk") al door focus-
beheer wordt gedekt, maar niet door motion.

| # | Moment | Fase | Niveau | Wat er vuurt (of niet) |
|---|---|---|---|---|
| E16 (voorstel) | Overlay/dialoog open-dicht | overal | 0 | Hamburgermenu, QR-overlay, pauze-overlay tonen/verbergen instant. Geen fade/scale, dus ook niets om onder `prefers-reduced-motion` te downgraden — dat werkt toevallig al goed. |

## Wat er onder die momenten hoort te liggen

| Fundament | Niveau | Stand |
|---|---|---|
| Motion-tokens | — | **Geleverd (commit `8eb1996`, thema 2, 3 aug 2026):** `--motion-instant` t/m `--motion-stage` + `--ease-press`/`-enter`/`-rank`/`-stage` staan nu in `base.css` en worden al gebruikt in `components.css`/`base.css`. Eigenaarschap blijft bij thema 2 (`HANDOFF-UI` UI-9), niveau bijhouden gebeurt in `2-vorm-en-systeem/PROGRESS.md` — dit **deblokkeert `M1` en maakt `M6`–`M10` zelfstandig bouwbaar met de echte tokens**, niet meer als placeholder. |
| `prefers-reduced-motion` | 1 | **Klaar (commit `7a146a0`):** blanket-regel (`animation`/`transition-duration` naar vrijwel nul, `scroll-behavior: auto`) plus de scale zelf uitgeschakeld (`transform: none !important` op de vier `:active`-controls) met een zichtbare non-transform-vervanging. Geverifieerd via CDP `forcePseudoState`, geen regressie in normale modus. Niveau 2 pas zodra `M2`'s inhoudelijke vervangingen (podium direct compleet, score direct definitief, geen carrousel) er ook zijn — zie `prompts/M0-reduced-motion.md`. |
| Mute-mechanisme | 0 | **Voorkeurlaag klaar (commit `0d94744`):** `loadMuted`/`saveMuted` in `preferences.mjs`, plus een gedeelde `safeSet`-helper die nu ook `saveLang`/`saveTheme` gebruiken (voorheen zonder `try/catch` — een gooiende storage liet die twee dus gewoon een exception opgooien; nu falen alle drie stil). Blijft niveau 0 voor de *zichtbare* schakelaar — die komt pas met het eerste echte audiosignaal, geen placebo-control. |
| Geluidsarchitectuur | 0 | Assets, mixer, categorieën (§5). Zit vast op `O-008` (wie bestuurt geluid) én op geluidsassets die nog niet bestaan — dit deel kán ik niet alleen oplossen. |
| Haptiek | 0 | Geen `navigator.vibrate` bij submit of reveal. |
| Performancebudget | 0 | `06` §9 (transform/opacity-only, confetti-limiet, test op middelmatige Androidhardware) staat nergens als vastgelegde regel — toevallig nog niet geschonden omdat er nog geen motion is, maar ook niet getoetst. |

## Telling

| Niveau | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| Momenten (14, `E08` vervallen/samengevoegd met `E09`) | 1 | 12 (2 dichtbij niveau 2: E11, E14 — zie hun rijen) | 1 (E01) | 0 |
| Momenten incl. voorstel `E16` | 2 | 12 | 1 | 0 |
| Fundamenten (Motion-tokens nu bij thema 2, zie hieronder) | 4 | 1 | 0 | 0 |

**Let op voor wie dit vergelijkt met het lokale dashboard
(`docs/progress/`):** die pagina leest de `Niveau`-kolom letterlijk en
verwacht daar één cijfer 0–3 (of `⏸`) — geen `1→2` of tekst. E11/E14 stonden
hier eerder als `1→2`, wat de parser stil oversloeg (niet fout, gewoon
genegeerd) — vandaar dat het dashboard tijdelijk 18 i.p.v. 20 onderdelen
toonde. Gecorrigeerd naar een schoon `1`, met de "dichtbij niveau 2"-nuance
in de toelichtingskolom, niet in de Niveau-kolom zelf.

Grote sprong t.o.v. de vorige telling (8 op niveau 0) — niet allemaal mijn
werk: `M6`–`M10` deden vijf momenten, thema 1 deed zelfstandig E04/E11
(deels)/E12 terwijl deze prompts nog klaarlagen. Alleen **E13 (streak)**
staat nog op 0 — geen protocolgat (ingetrokken), maar een bouwbare feature
die op bevestiging wacht (`11-verzoek-streak-reactiezinnen.md`).

## Afhankelijkheden van andere thema's

**Niet langer geldig** (was: E04/E12/E13 wachten op thema 1/4) — thema 1
bouwde E04 en E12 zelfstandig terwijl deze prompts nog klaarlagen voor
review, dus die afhankelijkheid is ingehaald door de praktijk. Zie de
momententabel hierboven voor de actuele stand per moment.

- **E13 (streak)** is de enige die nog op 0 staat — niet een protocolgat
  (die analyse is ingetrokken, zie de E13-rij hierboven), maar een
  niet-gebouwde, wél bouwbare feature binnen thema 1's scope
  (`11-verzoek-streak-reactiezinnen.md`), die zelf nog op bevestiging wacht.

## Volgorde die ik zou aanhouden (herzien ná review, 3 aug 2026)

Een review van de zes prompts (`prompts/`) leverde elf bevindingen op — vier
"Hoog": de reduced-motion-regel verkort een scale in plaats van 'm te
verwijderen (`06` §7 is expliciet), `E06` liet opties dimmen vóór de
serverbevestiging, `E08` bleek geen zelfstandig clientevent te zijn, en `M3`
onderschatte de techniek van een echte dialoogsluitanimatie. Alle vier
verwerkt in de prompts zelf; zie die bestanden voor het volledige verhaal.
Oordeel: M0/M5 goedgekeurd ná aanscherping, M1/M2/M4 bijgesteld, M3
geparkeerd tot `E16` bevestigd is.

Herziene volgorde:

1. **`prefers-reduced-motion`, écht** — niet alleen de duur verkorten
   (bestond al), maar ook de scale zelf uitschakelen onder reduced motion,
   met een non-transform-alternatief zodat de interactie voelbaar blijft.
2. **E01 op álle acht controls** (inclusief `.btn-quiet`, `.btn-opt`,
   `.btn-icon`) zodra thema 2's motion-tokens er zijn (`UI-9`) — bestaande
   transities aanvullen, niet vervangen.
3. **E05/E06/E09/E10/E15 naar niveau 2** — met E06 pas bij `accepted`, en
   E08 samengevoegd met E09's begin (protocolgat gemeld, niet verstopt).
4. **Performancebudget direct daarna**, als meetbare gate met numerieke
   criteria — niet als losse aanname achteraf.
5. **Alleen de opslaglaag van het mute-mechanisme** (`loadMuted`/
   `saveMuted` + een gedeelde `safeSet` voor alle drie voorkeuren) — de
   zichtbare schakelaar wacht op het eerste echte audiosignaal, geen
   placebo-control tonen.
6. **`E16` pas ná expliciete bevestiging** als spec-toevoeging, én pas na
   het ontwerp van één gedeelde dialog-lifecycle-helper — niet drie losse
   fade-implementaties.
7. E04, E12, E13 pas zodra thema 1 (en voor E12/E13 ook thema 4) hun deel
   hebben geleverd.
8. Geluidsarchitectuur en haptiek blijven geparkeerd tot `O-008` beslist is.

## Afgerond (3 aug 2026): `M6`–`M10`, inclusief twee tussentijdse correcties

`E02`, `E03`, `E07`, `E11`, `E14` waren de vijf niveau-0-momenten die op
niets anders wachtten. Alle vijf gebouwd, maar niet zonder gaandeweg
ontdekte overlap met ander werk dat tegelijk in dezelfde bestanden
gebeurde — dat is hieronder expliciet vastgelegd in plaats van verzwegen:

- **`M6` (E02)** — eerste versie bouwde een eigen stippen-indicator
  (`0a4c9d6`); vlak daarna bleek thema 2's `button-loading.mjs` (T2-2) al
  hét gedeelde mechanisme te zijn voor precies dit moment, nog nergens
  gebruikt. Gecorrigeerd naar `setButtonLoading()` (`a6be5d4`).
- **`M7` (E03)** — reconciliatie i.p.v. volledige lijstherbouw (bevestigd:
  `update()` deed `list.textContent = ''` bij elke aanroep), plus
  gedebouncete tellerpuls. Geen overlap gevonden.
- **`M8` (E07)** — vlak vóór het bouwen bleek thema 2 al een
  `.timer`/`.timer-track`/`.timer-fill`-balkcomponent (T2-3) geleverd te
  hebben met het commentaar "de puls is thema 3's werk" — de oorspronkelijke
  platte-tekst-aanpak is niet gebouwd; in plaats daarvan is
  `gameplay.mjs`'s timer omgezet naar die balk en is alleen de puls
  toegevoegd.
- **`M9` (E11)** — thema 1 bouwde zelfstandig `rankMovementFrom()` +
  de `↑2`/`↓1`-badge (`b547c8f`) terwijl deze prompt nog klaarlag. Prompt
  herschreven tot alleen de ontbrekende FLIP-beweging + eigen-rij-emphasis.
- **`M10` (E14)** — zelfde patroon: thema 1 bouwde de 3→2→1-stagger en de
  skip-interactie al (`b547c8f`), expliciet "thema 3 levert de motion
  later". Prompt herschreven tot alleen entrance-animatie, confetti, en
  een reduced-motion-gate die er nog niet was (de stagger-timers liepen
  door ongeacht de systeemvoorkeur).

**Patroon over alle vijf heen:** in een repo met meerdere gelijktijdig
werkende agents kan "ik ga X bouwen" tussen het schrijven en het uitvoeren
van een prompt al ingehaald zijn. Bij elk van de vijf is dat gecontroleerd
vóór het bouwen (niet aangenomen dat de eerder geschreven prompt nog
klopt), en is er bijgebouwd op wat er al stond in plaats van te
dupliceren.
