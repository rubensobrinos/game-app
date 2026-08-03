# Voortgang — 2. Vorm en systeem

**Eigenaar:** UX/UI-frontend (Claude) — sinds 3 augustus 2026
**Documenten:** `02-DESIGN-PRINCIPLES.md`, `05-DESIGN-SYSTEM.md`
**Criteria uit:** `11-DESIGN-QA-CHECKLIST.md` sectie I · schaal: [`NIVEAUS.md`](../NIVEAUS.md)
**Prompts:** [`prompts/`](prompts/) — negen tickets, gesorteerd op wie erop wacht · [`REVIEW.md`](prompts/REVIEW.md)
**Bijgewerkt:** 3 augustus 2026 · commit `49028a8`

Dit gebied gaat niet over schermen maar over het **gereedschap waarmee elk
scherm gemaakt wordt**. Eén zwak fundament hier zakt door naar alle 21
schermen tegelijk — en één reparatie hier tilt ze allemaal op. Daarom staat er
per regel bij welke paragraaf van `05` het criterium levert.

## Fundamenten

De onderste laag: waar elk component uit put.

| Fundament | Niveau | Criterium | Stand |
|---|---|---|---|
| Kleurtokens | 1 | `05` §2.1 | Werkende set met licht/donker, gelijk aan de singleplayer. Namen zijn presentatief (`--bg`, `--surface`) waar semantische rollen gevraagd worden (`--color-bg-canvas`, `--color-accent-competition`); goud bestaat alleen als fallback. Naar 2 zodra de rolnamen kloppen en er een competitieaccent is dat in beide thema's contrasteert. **Gebieden 1, 3 en 4 wachten hierop** — elke regel CSS die zij tegen `--bg` schrijven maakt de hernoeming duurder. |
| Motion-tokens | 1 | `05` §2 / `06` §3 | Vijf duraties en vier easingrollen staan in `base.css`'s `:root`; alle harde duraties zijn vervangen en `transition: all` is weg. Geverifieerd dat `prefers-reduced-motion` er nog steeds van wint. **Gebied 3 is hiermee gedeblokkeerd** (`HANDOFF-UI.md` UI-9 ✅). Blijft 1 en geen 2: `--motion-base`, `--motion-emphasis`, `--motion-stage` en drie van de vier easings hebben nog geen enkele gebruiker — de schaal staat er, hij is nog niet in gebruik. |
| Typografie | 1 | `05` §2.3 | Eén leesbare schaal, verder niets. Geen rollen (`display-hero`, `display-code`, `numeric`), dus code, score en timer krijgen geen eigen moment. Naar 2 zodra die rollen als klassen bestaan; de definitieve lettertypekeuze (`O-002`) blokkeert pas niveau 3. **Gebied 1 wacht hierop** voor de timer- en scoreweergave. |
| Contrast | 2 | `05` §2.2 | Tekst haalt AA in beide thema's, focusring contrasteert, disabled is niet langer alleen opacity. Vlaggen missen nog een neutrale rand tegen lichte achtergronden. Niveau 3 is hier niet van toepassing: dit is een drempel, geen beleving. |
| Spacing | 2 | `05` §2.4 | Consistente ritmiek sinds de fundamentfix; `.screen` en `.lobby-screen` regelen de afstand. Schuld: de schaal is nergens vastgelegd, dus consistentie berust op oplettendheid. Geen safe-area-afhandeling. |
| Radii en randen | 2 | `05` §2.5–2.6 | Twee radii, subtiele randen, weinig schaduw. Volgt de richtlijn: niet alles is een pil, focusring is geen decoratieve glow. |
| Wereldmotieven | ⏸ | `05` §2.7 | **On hold — wacht op `O-003` (accentkleur), `UI-11`.** Bestaan niet: geen raster, routeboog, kaartcontour of atlaslabel; de achtergrond is een vlakke kleur. Dit is ontwerpwerk, geen CSS-werk, en zonder een vastgestelde accentkleur is elke uitwerking weggegooid. Terug naar 0 zodra de kleur vaststaat. |
| Iconografie | ⏸ | `05` §3 | **On hold — wacht op een merkontwerper, `UI-11`.** Geen eigen set: emoji als logo (🌍) en medailles (🥇🥈🥉) zijn placeholders die `D-015` afkeurt, maar er is niets om ze mee te vervangen. `05` §3 stelt geen eis aan de letterkeuze, dus `O-002` is hier bijzaak — de echte blokkade is dat niemand de set tekent. Terug naar 0 zodra die er is. |

## Componenten

| Component | Niveau | Criterium | Stand |
|---|---|---|---|
| Knophiërarchie | 2 | `05` §4 | Primary, secondary, quiet, destructive en gameplay-option staan los sinds `d3c900e`. De loadingvariant uit §4.1 bestaat nu ook (`button-loading.mjs` + `.is-loading`): eigen uiterlijk, blokkeert dubbele taps, `aria-busy`, geen layoutshift, en de spinner staat stil onder `prefers-reduced-motion`. Gebied 1 en 4 zijn hiermee los. Rest: `quiet` heeft nog geen gebruiker. |
| Loading / empty / error | 1 | `05` §13 | Foutteksten zijn specifiek en volledig vertaald — dat deel is af. Laadstatussen benoemen hun activiteit niet, lege staten verklaren zichzelf niet. Disabled is wél gerepareerd. **Gebieden 1 en 4 wachten hierop.** |
| Timer en progress | 1 | `05` §9 | Numerieke aftelling op serveroffset, verder niets. §9 vraagt een horizontale progressbalk als basisvorm, met nadruk pas in de laatste drie seconden. **Gebied 1 wacht hierop** voor `S08`. |
| Spelerchip | 1 | `05` §8 | Naam met afkapping. Geen tijdelijke kleur/symboolidentiteit, geen joinmotion. **Gebied 1 wacht hierop** voor `S05`/`S06`. |
| QR-kaart | 1 | `05` §7 | Generator en overlay werken lokaal, zonder externe dienst. Nog geen kaart met label, code en URL bij elkaar — `room-header.mjs` heeft die wél maar hangt nergens; zie de slotparagraaf. **Gebied 1 wacht hierop** voor `S05`. |
| Leaderboard-rij | 1 | `05` §10 | Rank, naam en score met tabular nums. Geen bewegingskolom, dus `↑2` kan niet worden getoond. **Gebied 1 wacht hierop** voor `S15`. |
| Overlays | 1 | `05` §12 | QR- en pauze-overlay met rol, label, Escape en focusherstel — toegankelijk in orde. Maar het zijn modals; §12 vraagt op mobiel om een bottom sheet. **Gebied 1 wacht hierop** voor `S17`/`S18`. |
| Gameplay option | 1 | `05` §5 | Werkt en heeft eigen regels, maar is visueel nog een knop. Letter- en vormidentiteit bewust uitgesteld door `D-021` — dat is geen schuld maar een besluit. |
| Invoervelden | 2 | `05` §6 | Code- en naamveld met focusstijl, numeriek toetsenbord, placeholder, plakbaar. Visuele codeformattering en een tekenteller zouden dit naar 3 tillen. |
| Kaarten en panels | 2 | `05` §11 | Deelblok, spelersrij en pauzekaart delen één stijl en dat oogt rustig. Geen onderscheid tussen de zes kaarttypen. |
| Thema's | 2 | `05` §14 | Donker en licht delen dezelfde rollen, keuze blijft lokaal bewaard, geen flash bij wisselen. |
| CSS-architectuur | 1 | `05` §15 | Twee bestanden met een duidelijke grens (base = reset en layout, components = componenten). Werkt nu; schaalt niet naar vier gelijktijdige schrijvers. |

## Telling

| Niveau | 0 | 1 | 2 | 3 | ⏸ |
|---|---|---|---|---|---|
| Fundamenten | 0 | 3 | 3 | 0 | 2 |
| Componenten | 0 | 8 | 4 | 0 | 0 |

**Er staat niets meer op 0.** Wat er ligt is werk aan onderdelen die al
bestaan, plus twee dingen die op hold staan omdat niemand ze kán bouwen:
wereldmotieven en iconografie. Het besluitverzoek daarvoor is
[`T2-7`](prompts/T2-7-besluitverzoek-o002-o003.md) en het staat als `UI-11`
bij de producteigenaar.

Die twee krijgen bewust geen bouwprompt — dat zou een taak suggereren die
niemand kan uitvoeren. Zodra de blokkade weg is gaan ze naar 0 en volgt de
prompt.

Verschoven sinds de eerste opname: knophiërarchie van 2 naar 1 (geen
laadvariant, `05` §4.1), en motion-tokens toegevoegd als eigen fundament.

## Waar de hefboom zit

Twee van de drie nullen zijn **niet door mij op te lossen**. Wereldmotieven en
iconografie wachten op `O-002` en `O-003` en op echt ontwerpwerk; ze in een
werklijst zetten suggereert dat er een frontender voor nodig is. Mijn
werkelijke speelveld is de negen onderdelen op niveau 1 — plus de
motion-tokens, die ik wél zelf kan leggen.

Samen zijn die twee wel precies wat `R3` in de roadmap als hoofdrisico noemt:
**zonder eigen visuele grammatica blijft dit generieke donkere
gaming-esthetiek**, hoe netjes elk scherm ook wordt.

De volgorde die daaruit volgt gaat niet op niveau maar op wie wacht:
kleurtokens hernoemen (gebieden 1, 3 en 4), dan motion-tokens (gebied 3), dan
de laadvariant op knoppen (gebieden 1 en 4), dan timer, spelerchip, QR-kaart en
leaderboard-rij (gebied 1). De hernoeming hoort nú, terwijl de andere drie nog
inlezen: elke regel die zij tegen `--bg` schrijven maakt hem duurder.

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
