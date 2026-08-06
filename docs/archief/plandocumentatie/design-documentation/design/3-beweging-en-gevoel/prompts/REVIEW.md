# Reviews — thema 3

Twee ronden, nieuwste onderaan:
[M6 t/m M10](#review--m6-tm-m10-3-augustus-2026) en
[de resterende lijst](#review--de-resterende-lijst-m1m2m3m5--e13-3-augustus-2026).

---

## Review — M6 t/m M10 (3 augustus 2026)

Datum: 3 augustus 2026. Betreft de vijf nieuwe prompts voor de resterende
niveau-0-momenten (`E02`/`E03`/`E07`/`E11`/`E14`), nog niet gecommit ten
tijde van deze review.

Methode: elke feitelijke claim in de vijf prompts is nagetrokken tegen de
daadwerkelijke code (`home.mjs`, `lobby.mjs`, `gameplay.mjs`,
`scoreboard.mjs`, `podium.mjs`, `standings-model.mjs`, `session-shell.mjs`,
`base.css`) en tegen de brondocumenten (`06-MOTION-SOUND-AND-FEEDBACK.md`,
`11-DESIGN-QA-CHECKLIST.md`, en thema 4's `09-CONTENT-AND-MICROCOPY.md`).

## Samenvattend oordeel

Anders dan bij eerdere reviews in deze repo: **geen enkele feitelijke claim
in M6–M10 bleek onjuist.** Elke code-referentie (regelnummers, functienamen,
het ontbreken van bepaalde state) klopt bij steekproef én bij volledige
controle. Dit is precisiewerk — inclusief het soort claim dat het makkelijkst
fout gaat ("er bestaat geen vorige stand", "de lijst wordt volledig
herbouwd") is elke keer expliciet in de code opgezocht, niet aangenomen.

Geen van de vijf is blokkerend. Wel drie punten die de prompts zelf al als
open vraag markeren, en waarvan het antwoord inmiddels al in de code staat —
die had ik boven water gehaald, dus die kunnen nu concreet ingevuld worden
in plaats van als vraag te blijven staan. Plus één echt open
coördinatiepunt met thema 4 dat geen van beide kanten noemt.

## Geverifieerd en correct

- **M6**: `home.creating` bestaat inderdaad al in alle drie de locales
  (`nl.mjs:23`) en wordt getoond in `quickStartStatus`, een aparte paragraaf
  — de knop zelf (`quickStartButton.textContent`) blijft statisch
  `t('home.quickStart')`. Retry-logica en "knop blijft op plaats" kloppen
  zoals beschreven.
- **M7**: `lobby.mjs`'s `update()` doet `list.textContent = ''` en bouwt de
  hele `<ul>` opnieuw op bij elke aanroep — geverifieerd, geen aanname. De
  gevolgtrekking (een naïeve fade zou bestaande spelers laten heranimeren)
  klopt en is precies het soort fout die pas bij het testen zou zijn
  opgevallen. `applyPlayerChanged` in `session-shell.mjs` verwerkt inderdaad
  één `delta`-object per event, geen array — de "debounce is cliëntzijdig"-
  conclusie klopt.
- **M8**: `.gameplay-timer` is platte tekst (`timer.textContent = ...`),
  `.gameplay-progress` is inderdaad tekst-only ("3/8 beantwoord"), geen
  balk-element — de keuze voor "ticktempo" boven "progress pulseert" volgt
  daar logisch uit.
- **M9**: `standings-model.mjs`'s `standingsFrom()` berekent `position`
  puur uit `index + 1`, geen enkele vorige stand. `session-shell.mjs`
  overschrijft `standingsPayload` bij `scoreboard:updated`
  (regel 447-448) zonder de oude waarde te bewaren — er is inderdaad
  letterlijk niets om een delta uit af te leiden. De FLIP-redenering (geen
  node-reconciliatie nodig, in tegenstelling tot `M7`, want FLIP meet enkel
  posities vóór/ná op `playerId`) is correct.
- **M10**: `podium.mjs` rendert de top 3 synchroon in één `forEach`, geen
  stagger. `selfLine` en `.podium-rematch`'s eigen styling bestaan al zoals
  beschreven — terecht buiten scope gehouden.
- Alle geciteerde motion-tokens (`--motion-fast/base/emphasis/stage`,
  `--ease-enter/rank/stage`) bestaan letterlijk zo in `base.css`, met
  dezelfde bandbreedtes als in de code-commentaar staat.

## Bevindingen

### M8 — de "check eerst" over een warningkleur kan nu een antwoord krijgen

M8 zegt terecht: geen nieuwe kleur verzinnen zonder eerst te checken of er
al een warning/urgentietoken bestaat. Op het moment dat M8 geschreven werd
(14:45) bestond die nog niet. Sindsdien heeft thema 2 'm geleverd
(`9ca5af0`, T2-1, 14:57): `--color-warning: #f59e0b` (licht: `#9a5b0a`), met
het commentaar *"P12: tijd of aandacht, niet fout"* — dat is vrijwel
woordelijk E07's eigen omschrijving. De open vraag in M8 is dus niet meer
open; de prompt kan `--color-warning` direct noemen in plaats van "check
eerst" te laten staan.

### M10 — idem voor het winnaar-accent

Dezelfde situatie: `.podium-step-1` heeft in `components.css:292` al
`border-color: var(--color-accent-competition, #f59e0b)` — een bestaand,
reeds toegepast token specifiek voor de winnaarspositie. M10's stap 2
("geen aparte kleurbeslissing verzinnen... anders melden als open punt")
kan dus concreet worden: gebruik `--color-accent-competition` voor de
entrance-emphasis, geen open punt meer.

Geen van beide is een fout in de prompts — het "check eerst, verzin niet
zelf"-instinct was precies goed, alleen kon het antwoord er nog niet
bijstaan toen ze geschreven werden. Wel de moeite waard om nu bij te werken
vóór uitvoering, anders zoekt de bouwer straks hetzelfde nog een keer uit.

### M9 — `↑2`/`↓1` versus theme 4's eigen microcopy-voorbeelden (open coördinatiepunt, niet opgelost)

M9 citeert `06`'s brondocument voor de notatie ("`↑2`/`↓1` blijft tekstueel
zichtbaar") en verwijst naar `09-CONTENT-AND-MICROCOPY.md` voor "de
gelokaliseerde variant" — maar checkt die verwijzing zelf niet inhoudelijk.

`09` §9 ("Reveal") geeft al concrete voorbeeldcopy voor precies dit type
moment: `Je stijgt naar #4` en `Twee plaatsen omhoog` — volledige zinnen,
geen `↑2`/`↓1`-compacte notatie. Die voorbeelden staan in dezelfde
paragraaf als `JUIST`/`ONJUIST`/`GEEN ANTWOORD`/`+164 punten`, wat suggereert
dat het om het **ronde-reveal-moment** gaat (direct na een antwoord, in
`gameplay.mjs`), niet per se om `E11`'s tussenstand-lijst (`scoreboard.mjs`,
top 5 rijen). `09` §10 ("Sociale headlines") heeft daarnaast nog een derde
variant: `Ruben stijgt vijf plaatsen` — die hoort vermoedelijk bij de nog
niet gebouwde headline-engine (zie thema 5's `T5-8`-review, die dat gat al
eerder signaleerde vanuit een ander thema).

Geverifieerd dat er nog nergens in de code iets van dit type bestaat — geen
`stijg`/`plaatsen` in `nl.mjs`, `round-model.mjs` of `gameplay.mjs`. Dit is
dus geen bestaande tegenspraak, maar drie mogelijk-verschillende momenten
(compacte per-rij-delta in de tussenstand, een persoonlijke reveal-zin, een
sociale headline) die nergens expliciet uit elkaar getrokken zijn, terwijl
M9 er stilzwijgend van uitgaat dat `09`'s copy direct herbruikbaar is voor
de compacte notatie die het zelf bouwt.

**Niet zelf ingevuld** — dit is een vraag voor de eigenaren van thema 3 en
4 samen: is `↑2`/`↓1` een aparte, compacte notatie náást `09`'s voorbeelden
(twee dingen die naast elkaar bestaan), of moet M9 een van `09`'s bestaande
zinnen hergebruiken in plaats van een nieuwe notatie te verzinnen? M9 mag
niet zomaar `↑2`/`↓1` bouwen zonder dat die vraag beantwoord is — anders
ontstaat dezelfde faalmodus die thema 4's eigen review al eerder signaleerde
bij thema 1/4-overlap: twee documenten die stilzwijgend iets anders zeggen
over dezelfde tekst.

## Prioriteit voor correctie

Geen van de vijf prompts is blokkerend voor uitvoering. Vóór start van M8
en M10: de twee kleurtoken-verwijzingen bijwerken (triviaal, één zin per
prompt). Vóór start van M9 specifiek: eerst de coördinatievraag met thema 4
over `09` §9/§10 beantwoorden — de rest van M9 (de FLIP-mechaniek, de
`previousStandingsEntries`-state, de pure delta-functie) staat los van die
vraag en kan intussen al gebouwd worden; alleen de precieze tekst van de
delta-notatie wacht.

M6 en M7 zijn zonder voorbehoud klaar om uitgevoerd te worden zoals ze nu
staan.


---

## Review — de resterende lijst (M1/M2/M3/M5 + E13), 3 augustus 2026

Betreft niet de prompts zelf (die zijn geschreven en grotendeels al
gereviewd), maar de **restlijst**: klopt het dat er alleen nog gebouwd hoeft
te worden, en klopt de status per item? Nagetrokken tegen `base.css`,
`components.css`, `HANDOFF-UI.md`, thema 3's `PROGRESS.md` en de git-historie.

Let op: er stond ongecommit werk in de working tree tijdens deze review
(`base.css` pauze-overlay `z-index` 55 i.v.m. `D-018`, plus
`session-shell.mjs`). De controles hieronder zijn tegen die working tree.

### De statuslijst zelf klopt

M0/M4/M6–M10 zijn gedaan (commits staan in `README.md`), M1/M2/M5 staan open,
M3 is geparkeerd. Dat is correct. En M1 is echt gedeblokkeerd: de motion-tokens
bestaan nu daadwerkelijk in `base.css:57-61` (`--motion-instant` 100ms t/m
`--motion-stage` 900ms), geleverd door thema 2 in `8eb1996`.

### E13 — de premisse van het openstaande item is al weerlegd (blokkerend)

Het laatste punt op de lijst is "E13 (streak) een `HANDOFF-UI`-item geven voor
het protocolgat (server stuurt geen streak-data)".

Dat item moet er niet komen. `HANDOFF-UI.md` bevat al een herziening van
precies deze vraag (thema 1, 3 aug 2026, onder `UI-16`):

> **Herzien, principe 8 — punt 3 was een misverstand.** `GAME-RULES.md`
> §Reactiezinnen en streaks legt vast dat streaks "draaien per speler", "mogen
> client-side worden bepaald uit serverresultaten" en "hebben geen invloed op
> de server-score." (...) **Er is geen protocolgat:** de eigen streak is nu al
> met de bestaande `round:ended`-geschiedenis client-side te berekenen, alleen
> nog niet gebouwd. Dit is dus geen `HANDOFF` naar INT-A meer, maar een gemiste
> (buildbare) feature binnen thema 1 zelf.

Er ligt zelfs al een uitgewerkte bouwtaak:
`1-schermen-en-flow/prompts/11-verzoek-streak-reactiezinnen.md`. En de
`UI-16`-rij in de handoff-tabel zegt het ook al: "twee (niet drie)
headline-typen echt niet bouwbaar — 'streak' bleek een misverstand".

Wat er dus fout staat is niet het ontbreken van een handoff, maar **thema 3's
eigen `PROGRESS.md`**. Regel 47 zegt:

> Dit is geen afhankelijkheid meer op thema 1/4 leveren, maar een protocolgat
> (server zou streak-data moeten meesturen) — (...) nog niet als `HANDOFF-UI`-
> item gelogd.

Dat is achterhaald door de herziening hierboven. Een handoff indienen zou een
tegenstrijdig duplicaat opleveren tegen een analyse die al is teruggedraaid.

Het onderscheid dat wél klopt en overeind blijft: **eigen** streak is
client-side afleidbaar en dus bouwbaar; **andermans** streak is dat niet — maar
dat laatste is precies waarom E12's `social-headline.mjs` streak bewust buiten
scope hield, en het is geen open protocolverzoek meer.

**Actie:** `PROGRESS.md` regel 47 en 110 corrigeren en naar
`11-verzoek-streak-reactiezinnen.md` verwijzen. Geen `HANDOFF-UI`-item
aanmaken.

### E16 wacht op een bevestiging die niemand gevraagd is (M3 blijft anders eeuwig geparkeerd)

M3 staat op "⏸️ wacht op bevestiging van `E16`". Maar `E16` bestaat alleen als
**voorstel** binnen thema 3's eigen `PROGRESS.md` (regels 57, 69, 87, 126, 144).
Er is geen `HANDOFF-UI`-item, geen besluitverzoek, geen genoemde eigenaar — de
bevestiging is aan niemand gevraagd.

Thema 1 doet dit wél expliciet, met `12-besluitverzoek-UI-14-dubbele-tab.md` en
`13-verzoek-UI-17-tijd-per-ronde-en-teams.md`. Zonder zo'n verzoek is "wacht op
bevestiging" geen status maar een doodlopend spoor.

**Actie:** een besluitverzoek indienen (of `E16` als eigen scope-uitbreiding
aannemen en dat opschrijven). Zolang dat niet gebeurt is M3 niet geparkeerd maar
vergeten.

### M1's inventaris is achterhaald op twee van de acht rijen

M1's tabel "Wat er nu staat — volledige inventaris (bijgewerkt ná review)"
klopt niet meer voor de kolom *Transition-bron*:

| Control | M1 zegt | Werkelijk nu |
|---|---|---|
| `.btn-opt` | `transition: all 0.18s` | `base.css:448-450` — expliciete 3-propertylijst met `var(--motion-fast) var(--ease-press)` |
| `.btn-icon` | `transition: border-color 0.2s` | `base.css:393` — `border-color var(--motion-fast) var(--ease-enter)` |

Beide zijn al gemigreerd (vermoedelijk met `8eb1996`), inclusief comments die
naar `06` §3/§9 verwijzen — dus met thema 3's eigen redenering erin.

De kolom `:active`-feedback klopt nog wél: `components.css` heeft
`:active`-regels voor `.btn-primary`/`.podium-rematch`/`.btn-secondary`/
`.btn-destructive`/`.gameplay-option`, en géén voor `.btn-opt`, `.btn-icon` of
`.btn-quiet`. Het eigenlijke werk van M1 staat dus overeind.

Maar de instructie "bestaande transities **aanvullen, niet vervangen**" is voor
die twee controls inmiddels deels achterhaald, en een bouwer die de tabel leest
zou werk kunnen overdoen dat al gedaan is.

**Actie:** de twee rijen verversen vóór M1 start.

### De M0–M5-review bestaat niet meer als document

`git log` op `REVIEW.md` geeft één commit: `a6d7c6c` (M6–M10). De eerdere ronde
— waaruit "M0/M5 goedgekeurd ná aanscherping, M1/M2/M4 bijgesteld, M3
geparkeerd" komt — bestaat alleen nog als die ene zin bovenaan `README.md`. De
onderbouwing is weg.

Voor M0/M4 maakt dat niet meer uit (gebouwd). Voor **M1 en M2**, die nu als
eerste aan de beurt zijn, wel: "bijgesteld" zegt niet wát er is bijgesteld of
waarom, dus een bouwer kan een eerdere reviewbeslissing niet terugvinden en
loopt het risico 'm ongemerkt terug te draaien.

**Actie:** laag prioriteit, maar als de M1/M2-aanscherpingen nog reconstrueerbaar
zijn uit de prompt-diffs, hoort die redenering in dit bestand — niet in één
README-zin.

### Prioriteit

1. **E13** — het item van de lijst halen en `PROGRESS.md` corrigeren. Nu zou
   het een handoff aanmaken tegen een al ingetrokken analyse.
2. **E16-besluitverzoek** — anders is M3 niet geparkeerd maar zoek.
3. **M1's twee inventarisrijen** — vóór M1 start, triviaal.
4. De ontbrekende M0–M5-review — alleen als M1/M2 daadwerkelijk starten.

M2 en M5 hebben geen eigen bevindingen; die kunnen zoals ze zijn.
