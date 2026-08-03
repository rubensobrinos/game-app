# Review — M6 t/m M10

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
