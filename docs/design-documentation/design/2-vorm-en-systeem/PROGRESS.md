# Voortgang — 2. Vorm en systeem

**Eigenaar:** _nog toe te wijzen_
**Documenten:** `02-DESIGN-PRINCIPLES.md`, `05-DESIGN-SYSTEM.md`
**Criteria uit:** `11-DESIGN-QA-CHECKLIST.md` sectie I · schaal: [`NIVEAUS.md`](../NIVEAUS.md)
**Bijgewerkt:** 3 augustus 2026 · commit `18b2d53`

Dit gebied gaat niet over schermen maar over het **gereedschap waarmee elk
scherm gemaakt wordt**. Eén zwak fundament hier zakt door naar alle 21
schermen tegelijk — en één reparatie hier tilt ze allemaal op. Daarom staat er
per regel bij welke paragraaf van `05` het criterium levert.

## Fundamenten

De onderste laag: waar elk component uit put.

| Fundament | Niveau | Criterium | Stand |
|---|---|---|---|
| Kleurtokens | 1 | `05` §2.1 | Werkende set met licht/donker, gelijk aan de singleplayer. Maar de namen zijn presentatief (`--bg`, `--surface`) waar semantische rollen gevraagd worden (`--color-bg-canvas`, `--color-accent-competition`). Geen apart competitie-/goudaccent in de multiplayer. |
| Contrast | 2 | `05` §2.2 | Tekst haalt AA, focusring contrasteert op beide thema's, disabled is niet langer alleen opacity. Vlaggen missen nog een neutrale rand tegen lichte achtergronden. |
| Typografie | 1 | `05` §2.3 | Eén leesbare schaal. Geen rollen (`display-hero`, `display-code`, `numeric`), dus code en score krijgen geen eigen moment. Lettertypekeuze is nog open (`O-002`). |
| Spacing | 2 | `05` §2.4 | Consistente ritmiek sinds de fundamentfix; `.screen` en `.lobby-screen` regelen de afstand. Geen vastgelegde schaal, geen safe-area-afhandeling. |
| Radii en randen | 2 | `05` §2.5–2.6 | Twee radii, subtiele randen, weinig schaduw. Volgt de richtlijn: niet alles is een pil, focusring is geen decoratieve glow. |
| Wereldmotieven | 0 | `05` §2.7 | Bestaan niet. Geen raster, routeboog, kaartcontour of atlaslabel; de achtergrond is een vlakke kleur. |
| Iconografie | 0 | `05` §3 | Geen eigen set. Emoji als logo (🌍) en medailles (🥇🥈🥉) zijn placeholders die `D-015` afkeurt. |

## Componenten

| Component | Niveau | Criterium | Stand |
|---|---|---|---|
| Knophiërarchie | 2 | `05` §4 | Primary, secondary, quiet, destructive en gameplay-option staan los sinds `d3c900e` — het gedeelde regelblok waar §15 tegen waarschuwt is opgeruimd. `quiet` bestaat wel maar wordt nergens gebruikt; geen hero-variant. |
| Gameplay option | 1 | `05` §5 | Werkt en heeft eigen regels, maar is visueel nog een knop. Letter- en vormidentiteit bewust uitgesteld (`D-021`). |
| Invoervelden | 2 | `05` §6 | Code- en naamveld met focusstijl, numeriek toetsenbord, placeholder. Geen visuele codeformattering, geen tekenteller. |
| QR-kaart | 1 | `05` §7 | Generator en overlay werken lokaal, zonder externe dienst. Nog geen kaart met label, code en URL bij elkaar — `room-header.mjs` heeft dat wél maar hangt nog nergens. |
| Spelerchip | 1 | `05` §8 | Naam met afkapping. Geen kleur/symbool-identiteit, geen joinmotion. |
| Timer en progress | 1 | `05` §9 | Numerieke aftelling op serveroffset. Geen progressbalk, geen nadruk in de laatste drie seconden. |
| Leaderboard-rij | 1 | `05` §10 | Rank, naam en score met tabular nums. Geen bewegingskolom. |
| Kaarten en panels | 2 | `05` §11 | Deelblok, spelersrij en pauzekaart delen één stijl. Geen onderscheid tussen de zes kaarttypen. |
| Overlays | 1 | `05` §12 | QR- en pauze-overlay met rol, label, Escape en focusherstel. Zijn modals, geen bottom sheets — op mobiel vraagt §12 om een sheet. |
| Loading / empty / error | 1 | `05` §13 | Foutteksten zijn specifiek en volledig vertaald. Laadstatussen benoemen de activiteit niet, lege staten verklaren niets. Disabled is wél gerepareerd. |
| Thema's | 2 | `05` §14 | Donker en licht delen dezelfde rollen, keuze blijft lokaal bewaard, geen flash bij wisselen. |
| CSS-architectuur | 1 | `05` §15 | Twee bestanden met een duidelijke grens (base = reset en layout, components = componenten). Nog niet de mappenstructuur uit §15; alles zit in twee platte bestanden. |

## Telling

| Niveau | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| Fundamenten | 2 | 2 | 3 | 0 |
| Componenten | 0 | 7 | 5 | 0 |

## Waar de hefboom zit

De twee nullen staan allebei in het fundament, en het zijn precies de twee die
`R3` in de roadmap als hoofdrisico noemt: **zonder wereldmotieven en eigen
iconografie blijft dit generieke donkere gaming-esthetiek.** Elk scherm kan
netjes zijn en het product zal er nog steeds uitzien als een template.

Dat is ook het enige onderdeel op deze pagina dat niet door een frontender op
te lossen is — hier is echt ontwerpwerk nodig, en `O-002` (lettertype) en
`O-003` (accentkleur) staan nog open.
