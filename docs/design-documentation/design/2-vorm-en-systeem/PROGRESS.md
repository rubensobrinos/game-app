# Voortgang — 2. Vorm en systeem

**Eigenaar:** UX/UI-frontend (Claude) — sinds 3 augustus 2026
**Documenten:** `02-DESIGN-PRINCIPLES.md`, `05-DESIGN-SYSTEM.md`
**Criteria uit:** `11-DESIGN-QA-CHECKLIST.md` sectie I · schaal: [`NIVEAUS.md`](../NIVEAUS.md)
**Prompts:** [`prompts/`](prompts/) — elf tickets, gesorteerd op wie erop wacht · [`REVIEW.md`](prompts/REVIEW.md)
**Bijgewerkt:** 3 augustus 2026 · commit `974ba34`

Dit gebied gaat niet over schermen maar over het **gereedschap waarmee elk
scherm gemaakt wordt**. Eén zwak fundament hier zakt door naar alle 21
schermen tegelijk — en één reparatie hier tilt ze allemaal op. Daarom staat er
per regel bij welke paragraaf van `05` het criterium levert.

## Fundamenten

De onderste laag: waar elk component uit put.

| Fundament | Niveau | Criterium | Stand |
|---|---|---|---|
| Kleurtokens | 2 | `05` §2.1 | Veertien semantische rollen sinds `9ca5af0` (`--color-bg-canvas`, `--color-accent-competition`), plus `--color-focus`, `--color-warning` en `--color-overlay`. Sinds de bouwsprint ook het 1c-signaalpalet als *systeem*token (`--color-signal-lime/-magenta/-cyan/-warm`) plus de drie lettertyperollen: `rounda-1c.css` definieert alleen de donkere variant, dus zonder deze regels moest elk 1c-gebruik in het lichte thema apart gepatcht worden. Lime en cyan halen op wit nooit AA als tekst (lime komt op ~1,2:1 uit) en zijn daar donkerder getrokken; `contrast.test.mjs` bewaakt dat in beide thema's. Naar 3 zou de vier resterende §2.1-rollen vragen, maar die hebben geen toepassing — bewust weggelaten. |
| Motion-tokens | 2 | `05` §2 / `06` §3 | Vijf duraties en vier easingrollen staan in `base.css`'s `:root`; alle harde duraties zijn vervangen en `transition: all` is weg. Geverifieerd dat `prefers-reduced-motion` er nog steeds van wint. **Gebied 3 is hiermee gedeblokkeerd** (`HANDOFF-UI.md` UI-9 ✅). Van 1 naar 2 sinds gebied 3 zijn choreografie bouwde: alle negen tokens hebben inmiddels een gebruiker, ook `--ease-rank` (de FLIP in de tussenstand) en `--ease-stage` (podium). De schaal staat er niet meer alleen — hij wordt gebruikt. |
| Typografie | 2 | `05` §2.3 | Twaalf rollen in `base.css` sinds `66a63b3`; zestien losse `font-size`-waarden zijn weg en `tabular-nums` staat op één plek in plaats van negen. De gamecode in de QR-modal groeide van 1,3rem naar `clamp(2.25rem, 12vw, 3.5rem)` — 46,8px op een telefoon — omdat `04` S05 eist dat hij op kamerafstand leesbaar is. Lettertypekeuze (`O-002`) blokkeert pas niveau 3. |
| Contrast | 2 | `05` §2.2 | Tekst haalt AA in beide thema's, focusring contrasteert, disabled is niet langer alleen opacity. Vlaggen missen nog een neutrale rand tegen lichte achtergronden. Niveau 3 is hier niet van toepassing: dit is een drempel, geen beleving. |
| Spacing | 2 | `05` §2.4 | Consistente ritmiek sinds de fundamentfix; `.screen` en `.lobby-screen` regelen de afstand. Schuld: de schaal is nergens vastgelegd, dus consistentie berust op oplettendheid. Geen safe-area-afhandeling. |
| Radii en randen | 2 | `05` §2.5–2.6 | Drie radii sinds `--r-pill`, subtiele randen, weinig schaduw. Focusring is geen decoratieve glow. De pil is nu een rol-eigenschap: 1c zette hem per instantie op zeven specifieke knoppen, waardoor `.btn-quiet` en een gewone `.btn-primary` als enige rechthoekig bleven — twee knopstelsels in één scherm. |
| Wereldmotieven | ⏸ | `05` §2.7 | **On hold — wacht op `O-003` (accentkleur), `UI-11`.** Bestaan niet: geen raster, routeboog, kaartcontour of atlaslabel; de achtergrond is een vlakke kleur. Dit is ontwerpwerk, geen CSS-werk, en zonder een vastgestelde accentkleur is elke uitwerking weggegooid. Terug naar 0 zodra de kleur vaststaat. |
| Iconografie | ⏸ | `05` §3 | **On hold — wacht op een merkontwerper, `UI-11`.** Geen eigen set: emoji als logo (🌍) en medailles (🥇🥈🥉) zijn placeholders die `D-015` afkeurt, maar er is niets om ze mee te vervangen. `05` §3 stelt geen eis aan de letterkeuze, dus `O-002` is hier bijzaak — de echte blokkade is dat niemand de set tekent. Terug naar 0 zodra die er is. |

## Componenten

| Component | Niveau | Criterium | Stand |
|---|---|---|---|
| Knophiërarchie | 2 | `05` §4 | Primary, secondary, quiet, destructive en gameplay-option staan los sinds `d3c900e`, met een loadingvariant (`button-loading.mjs` + `.is-loading`): eigen uiterlijk, blokkeert dubbele taps, `aria-busy`, geen layoutshift, spinner stil onder `prefers-reduced-motion`. `quiet` heeft inmiddels vier gebruikers. Vorm is sinds `974ba34` een eigenschap van de rol en niet van de plek — het zichtbaarste geval was `Game beëindigen`, een rechthoek van 14px tussen vier pillen van 12,5px, waardoor juist de onomkeerbare knop las als een fout in plaats van als een waarschuwing. |
| Loading / empty / error | 2 | `05` §13 | Alle drie gedekt: laadstaat op knoppen (`bc89e18`), lege en foutstaten als patroon (`e20e0b7`), disabled al eerder. De foutcomponent hangt sinds `af4503b` aan het terminale sessiescherm — dat bouwde zijn eigen kop/tekst/knop en miste daardoor `role="alert"` én styling (`.session-terminated-title` stond in geen enkel CSS-bestand). De drie `.field-error`-plekken zijn nog niet omgezet; dat vraagt afstemming met gebied 1. |
| Timer en progress | 2 | `05` §9 | Twaalf segmenten die van rechts naar links doven, met het getal tabulair ernaast (`7479280`). Een doorlopende balk laat je aflezen dat er "iets minder" is; blokjes laat je tellen. De laatste twee zijn altijd magenta, ook als ze nog niet aan de beurt zijn — zo zie je de gevarenzone aankomen. Geen puls en geen knipper: de urgentie zit in kleur én in het aantal (`08` §2.4). Daarmee is ook de laatste `§9`-overtreding uit thema 3's performancebudget weg — segmenten wisselen alleen `background-color`. Screenreader hoort twee keer iets per ronde, niet dertig keer. |
| Spelerchip | 2 | `05` §8 | Naam plus tijdelijke kleur/symboolidentiteit (`f615a70`): acht kleuren × acht `clip-path`-vormen, berekend uit de `playerId`, dus zonder opslag reproduceerbaar. Naam kapt af met de volledige naam nog beschikbaar. Joinmotion (`E03`) hoort bij gebied 3. |
| QR-kaart | 2 | `05` §7 | Ingehangen en gestyled door gebied 1 (`UI-10` ✅): code permanent in de appheader, QR achter een pictogram als modal, label/code/URL als één kaart. Generator blijft lokaal, geen externe dienst. |
| Invoervelden | 2 | `05` §6 | Code- en naamveld met focusstijl, numeriek toetsenbord, placeholder, plakbaar. De 1c-codeinvoer (zes cellen van één teken) heeft sinds `974ba34` CSS — daarvóór stonden die zes als volle-breedte velden ónder elkaar op de voorpagina. Een tekenteller zou dit naar 3 tillen. |
| Overlays | 1 | `05` §12 | QR- en pauze-overlay met rol, label, Escape en focusherstel — toegankelijk in orde. Maar het zijn modals; §12 vraagt op mobiel om een bottom sheet. **Gebied 1 wacht hierop** voor `S17`/`S18`. |
| Gameplay option | 1 | `05` §5 | Werkt en heeft eigen regels, maar is visueel nog een knop. Letter- en vormidentiteit bewust uitgesteld door `D-021` — dat is geen schuld maar een besluit. |
| Kaarten en panels | 2 | `05` §11 | Deelblok, spelersrij en pauzekaart delen één stijl en dat oogt rustig. Geen onderscheid tussen de zes kaarttypen. |
| Thema's | 2 | `05` §14 | Donker en licht delen dezelfde rollen, keuze blijft lokaal bewaard, geen flash bij wisselen. |
| CSS-architectuur | 1 | `05` §15 | Drie bestanden nu: base (reset en layout), components (componenten) en `rounda-1c.css` (regie, laadt als laatste). Die derde laag overschrijft componentregels per instantie in plaats van per rol, en dat is precies waar de knopvorm en de dode `.gameplay-timer`-selector uit voortkwamen. Werkt; schaalt niet naar vier gelijktijdige schrijvers. |

## Telling

| Niveau | 0 | 1 | 2 | 3 | ⏸ |
|---|---|---|---|---|---|
| Fundamenten | 0 | 0 | 6 | 0 | 2 |
| Componenten | 0 | 3 | 8 | 0 | 0 |

**Er staat niets meer op 0.** Wat er ligt is werk aan onderdelen die al
bestaan, plus twee dingen op hold omdat niemand ze kán bouwen: wereldmotieven
en iconografie. Het besluitverzoek daarvoor is
[`T2-7`](prompts/T2-7-besluitverzoek-o002-o003.md) en het staat als `UI-11`
bij de producteigenaar. Die twee krijgen bewust geen bouwprompt — dat zou een
taak suggereren die niemand kan uitvoeren.

## Waar de hefboom zit

Zeven van de negen tickets zijn gebouwd. Wat op 1 blijft staan:

| Onderdeel | Waarom nog geen 2 |
| --- | --- |
| Overlays | `T2-9` ligt klaar maar mag nog niet: thema 5's `T5-7` claimt hetzelfde zijpaneel, en zijn definition of done eist dat compact portrait ongewijzigd blijft. Twee prompts op één component — dat moet eerst één worden. |
| Gameplay option | Bewust uitgesteld door `D-021`. Geen schuld, een besluit. |
| CSS-architectuur | De mappenstructuur uit §15 is een verhuizing van alle CSS terwijl vier thema's er tegelijk in schrijven. Hoort ná de eerste ronde, als één atomaire pas. |

Wat níét zelf te trekken is, is het enige dat het uiterlijk van het product
bepaalt. Wereldmotieven en iconografie zijn samen precies wat `R3` in de
roadmap als hoofdrisico noemt: **zonder eigen visuele grammatica blijft dit
generieke donkere gaming-esthetiek**. Elk component hier kan op 2 staan en dat
blijft waar.

De volgorde binnen dit gebied volgde niet het niveau maar wie erop wachtte:
motion-tokens (gebied 3 stond stil), kleurtokens (gebied 1, 3 en 4),
laadvariant (gebied 1 en 4), timer, spelerchip, typografie en de
lege/foutstaten (gebied 1). Er staat nu geen enkel gebied meer op dit gebied
te wachten.

**Regel 0 is geïnd.** Van de vier componenten die hier gebouwd waren zonder
gebruiker hangen er nu twee ingehangen (`button-loading` in home/join,
`player-chip` in de lobby), hangt de foutstaat aan het terminale
sessiescherm, en is de leaderboard-rij verwijderd omdat het scherm zijn eigen
rij inmiddels verder had gebracht dan de component. `UI-21` is daarmee
gesloten: dit gebied heeft geen zwevende modules meer.

## Twee naden die niet van mij alleen zijn

Conform `docs/handoff-principles.md` hier gemeld in plaats van stil opgelost.

**Motion-tokens staan in twee bestanden** — als fundament hierboven én in
`3-beweging-en-gevoel/PROGRESS.md`. Inhoudelijk horen tokens bij het
designsysteem (`05` §2), maar gebied 3 is de enige gebruiker. Voorstel: ik
lever de tokens, gebied 3 gebruikt ze en houdt de vijftien gebeurtenissen bij.
Eén van beide regels kan dan weg — welke, is aan ons samen.

**`rounda-1c.css` stylet per instantie, niet per rol.** Dat bestand is van
regie en is hier niet aangeraakt, maar het is inmiddels twee keer misgegaan op
dezelfde manier. De knopvorm stond op zeven specifieke knoppen in plaats van
op `.btn-*`, waardoor `.btn-quiet` als enige rechthoekig bleef; en
`.gameplay-timer` (mono, 26px, lime) wijst sinds de segmententimer nergens
meer naar — de platte-tekst-timer bestaat niet meer, die vormgeving is
opnieuw opgebouwd op `.timer-value` met systeemtokens. Voorstel: wat een rol
beschrijft verhuist naar de tokens en de componentlaag, wat écht één plek
betreft blijft in 1c. De dode selector is voor regie om op te ruimen.
