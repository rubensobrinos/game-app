# Voortgang — 2. Vorm en systeem

**Eigenaar:** UX/UI-frontend (Claude) — sinds 3 augustus 2026
**Documenten:** `02-DESIGN-PRINCIPLES.md`, `05-DESIGN-SYSTEM.md`
**Criteria uit:** `11-DESIGN-QA-CHECKLIST.md` sectie I · schaal: [`NIVEAUS.md`](../NIVEAUS.md)
**Prompts:** [`prompts/`](prompts/) — elf tickets, gesorteerd op wie erop wacht · [`REVIEW.md`](prompts/REVIEW.md)
**Bijgewerkt:** 3 augustus 2026 · commit `e20e0b7`

Dit gebied gaat niet over schermen maar over het **gereedschap waarmee elk
scherm gemaakt wordt**. Eén zwak fundament hier zakt door naar alle 21
schermen tegelijk — en één reparatie hier tilt ze allemaal op. Daarom staat er
per regel bij welke paragraaf van `05` het criterium levert.

## Fundamenten

De onderste laag: waar elk component uit put.

| Fundament | Niveau | Criterium | Stand |
|---|---|---|---|
| Kleurtokens | 2 | `05` §2.1 | Veertien semantische rollen sinds `9ca5af0` (`--color-bg-canvas`, `--color-accent-competition`), plus `--color-focus`, `--color-warning` en `--color-overlay`. Waarden ongewijzigd; thema 5's contrastcorrecties staan er onaangeroerd in. Naar 3 zou de vier resterende §2.1-rollen vragen, maar die hebben geen toepassing — bewust weggelaten. |
| Motion-tokens | 1 | `05` §2 / `06` §3 | Vijf duraties en vier easingrollen staan in `base.css`'s `:root`; alle harde duraties zijn vervangen en `transition: all` is weg. Geverifieerd dat `prefers-reduced-motion` er nog steeds van wint. **Gebied 3 is hiermee gedeblokkeerd** (`HANDOFF-UI.md` UI-9 ✅). Blijft 1 en geen 2: `--motion-base`, `--motion-emphasis`, `--motion-stage` en drie van de vier easings hebben nog geen enkele gebruiker — de schaal staat er, hij is nog niet in gebruik. |
| Typografie | 2 | `05` §2.3 | Twaalf rollen in `base.css` sinds `66a63b3`; zestien losse `font-size`-waarden zijn weg en `tabular-nums` staat op één plek in plaats van negen. De gamecode in de QR-modal groeide van 1,3rem naar `clamp(2.25rem, 12vw, 3.5rem)` — 46,8px op een telefoon — omdat `04` S05 eist dat hij op kamerafstand leesbaar is. Lettertypekeuze (`O-002`) blokkeert pas niveau 3. |
| Contrast | 2 | `05` §2.2 | Tekst haalt AA in beide thema's, focusring contrasteert, disabled is niet langer alleen opacity. Vlaggen missen nog een neutrale rand tegen lichte achtergronden. Niveau 3 is hier niet van toepassing: dit is een drempel, geen beleving. |
| Spacing | 2 | `05` §2.4 | Consistente ritmiek sinds de fundamentfix; `.screen` en `.lobby-screen` regelen de afstand. Schuld: de schaal is nergens vastgelegd, dus consistentie berust op oplettendheid. Geen safe-area-afhandeling. |
| Radii en randen | 2 | `05` §2.5–2.6 | Twee radii, subtiele randen, weinig schaduw. Volgt de richtlijn: niet alles is een pil, focusring is geen decoratieve glow. |
| Wereldmotieven | ⏸ | `05` §2.7 | **On hold — wacht op `O-003` (accentkleur), `UI-11`.** Bestaan niet: geen raster, routeboog, kaartcontour of atlaslabel; de achtergrond is een vlakke kleur. Dit is ontwerpwerk, geen CSS-werk, en zonder een vastgestelde accentkleur is elke uitwerking weggegooid. Terug naar 0 zodra de kleur vaststaat. |
| Iconografie | ⏸ | `05` §3 | **On hold — wacht op een merkontwerper, `UI-11`.** Geen eigen set: emoji als logo (🌍) en medailles (🥇🥈🥉) zijn placeholders die `D-015` afkeurt, maar er is niets om ze mee te vervangen. `05` §3 stelt geen eis aan de letterkeuze, dus `O-002` is hier bijzaak — de echte blokkade is dat niemand de set tekent. Terug naar 0 zodra die er is. |

## Componenten

| Component | Niveau | Criterium | Stand |
|---|---|---|---|
| Knophiërarchie | 2 | `05` §4 | Primary, secondary, quiet, destructive en gameplay-option staan los sinds `d3c900e`. De loadingvariant uit §4.1 bestaat nu ook (`button-loading.mjs` + `.is-loading`): eigen uiterlijk, blokkeert dubbele taps, `aria-busy`, geen layoutshift, en de spinner staat stil onder `prefers-reduced-motion`. Gebied 1 en 4 zijn hiermee los. Rest: `quiet` heeft nog geen gebruiker. |
| Loading / empty / error | 2 | `05` §13 | Alle drie gedekt: laadstaat op knoppen (`bc89e18`), lege en foutstaten als patroon (`e20e0b7`), disabled al eerder. Foutcomponent draagt `role="alert"` en de herstelactie zelf, zodat geen scherm ze kan vergeten. De vier bestaande plekken zijn nog niet omgezet — dat vraagt afstemming met gebied 1. |
| Timer en progress | 2 | `05` §9 | Horizontale balk die leegloopt, met het getal tabulair ernaast (`34aecd7`). Nadruk in de laatste seconden via `--color-warning` — niet rood, want `P12` reserveert dat voor fout. Screenreader hoort twee keer iets per ronde, niet dertig keer. De puls hoort bij `E07` en dus bij gebied 3. |
| Spelerchip | 2 | `05` §8 | Naam plus tijdelijke kleur/symboolidentiteit (`f615a70`): acht kleuren × acht `clip-path`-vormen, berekend uit de `playerId`, dus zonder opslag reproduceerbaar. Naam kapt af met de volledige naam nog beschikbaar. Joinmotion (`E03`) hoort bij gebied 3. |
| QR-kaart | 2 | `05` §7 | Ingehangen en gestyled door gebied 1 (`UI-10` ✅): code permanent in de appheader, QR achter een pictogram als modal, label/code/URL als één kaart. Generator blijft lokaal, geen externe dienst. |
| Leaderboard-rij | 2 | `05` §10 | Rank, naam, score en bewegingskolom (`a9158fc`). Beweging draagt symbool, getal én een voorleesbare zin — kleur is nooit de enige drager. Gedeelde plaats is toonbaar zodra het model hem meegeeft; de regel wannéér blijft `UI-15`. Rankanimatie hoort bij `E11`, gebied 3. |
| Overlays | 1 | `05` §12 | QR- en pauze-overlay met rol, label, Escape en focusherstel — toegankelijk in orde. Maar het zijn modals; §12 vraagt op mobiel om een bottom sheet. **Gebied 1 wacht hierop** voor `S17`/`S18`. |
| Gameplay option | 1 | `05` §5 | Werkt en heeft eigen regels, maar is visueel nog een knop. Letter- en vormidentiteit bewust uitgesteld door `D-021` — dat is geen schuld maar een besluit. |
| Invoervelden | 2 | `05` §6 | Code- en naamveld met focusstijl, numeriek toetsenbord, placeholder, plakbaar. Visuele codeformattering en een tekenteller zouden dit naar 3 tillen. |
| Kaarten en panels | 2 | `05` §11 | Deelblok, spelersrij en pauzekaart delen één stijl en dat oogt rustig. Geen onderscheid tussen de zes kaarttypen. |
| Thema's | 2 | `05` §14 | Donker en licht delen dezelfde rollen, keuze blijft lokaal bewaard, geen flash bij wisselen. |
| CSS-architectuur | 1 | `05` §15 | Twee bestanden met een duidelijke grens (base = reset en layout, components = componenten). Werkt nu; schaalt niet naar vier gelijktijdige schrijvers. |

## Telling

| Niveau | 0 | 1 | 2 | 3 | ⏸ |
|---|---|---|---|---|---|
| Fundamenten | 0 | 1 | 5 | 0 | 2 |
| Componenten | 0 | 3 | 9 | 0 | 0 |

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
| Motion-tokens | Zes van de negen tokens hebben geen gebruiker; de schaal staat er, hij is nog niet in gebruik. Gaat vanzelf naar 2 als gebied 3 zijn choreografie bouwt. |
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
laadvariant (gebied 1 en 4), timer, spelerchip, leaderboard-rij, typografie en
de lege/foutstaten (gebied 1). Er staat nu geen enkel gebied meer op dit
gebied te wachten.

## Twee naden die niet van mij alleen zijn

Conform `docs/handoff-principles.md` hier gemeld in plaats van stil opgelost.

**Motion-tokens staan in twee bestanden** — als fundament hierboven én in
`3-beweging-en-gevoel/PROGRESS.md`. Inhoudelijk horen tokens bij het
designsysteem (`05` §2), maar gebied 3 is de enige gebruiker. Voorstel: ik
lever de tokens, gebied 3 gebruikt ze en houdt de vijftien gebeurtenissen bij.
Eén van beide regels kan dan weg — welke, is aan ons samen.

**`room-header.mjs` hangt nergens.** Gebouwd in `d3c900e` op besluit `D-018`,
volledig en zelfstandig, maar niet ingehangen; de bijbehorende opruiming in de
lobby (`Toon code` en `Toon QR-code` vervallen dan) is niet gedaan. Als
component is hij van mij, als scherm is `S05` van gebied 1. Voorstel: gebied 1
hangt hem in, ik onderhoud de component. Zolang dat niet gebeurt is het dode
code, en dat is mijn schuld.
