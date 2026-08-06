# Prompts — Thema 5: Toegankelijk en robuust

Zelfde stijl als `docs/frontend-plan/prompts/` en thema 3's `prompts/`: doel,
brondocument, exact contract, Regels, Definition of done.

Dit thema heeft een eigenschap die de andere vier niet hebben: de eigen
`PROGRESS.md` scoort zichzelf niet alleen op niveau maar ook op **bewijs**
(gemeten/gelezen/aangenomen). Dat bepaalt de volgorde hier meer dan impact
alleen — een "1, aangenomen" die in werkelijkheid een "0" blijkt te zijn is
gevaarlijker dan een eerlijke "0".

| Bestand | Status | Dekt | Afhankelijk van |
| --- | --- | --- | --- |
| [`T5-1-zoom-200-procent.md`](T5-1-zoom-200-procent.md) | **uitgevoerd** — gemeten, één bug gefixt | Zoom/tekstvergroting: aangenomen → gemeten | niets |
| [`T5-2-landscape.md`](T5-2-landscape.md) | **uitgevoerd** — gemeten, geen bugs | Landscape: niet getest → gemeten | niets |
| [`T5-3-refresh-sessieherstel.md`](T5-3-refresh-sessieherstel.md) | **uitgevoerd** — gemeten, één bug gefixt | Refresh midden in een ronde: aangenomen → gemeten | niets |
| [`T5-4-falende-vlagafbeelding.md`](T5-4-falende-vlagafbeelding.md) | **uitgevoerd** — gebouwd en geverifieerd | Falende asset laat gebroken afbeelding zien | niets |
| [`T5-5-screenreader-testplan.md`](T5-5-screenreader-testplan.md) | open — wacht op een mens met toestel | Screenreader: aangenomen → gemeten | niets, maar **niet automatiseerbaar** |
| [`T5-6-testmatrix-proces.md`](T5-6-testmatrix-proces.md) | **laag 1 uitgevoerd** (`frontend/css/contrast.test.mjs`, draait mee in `npm test`, vond en fixte 2 echte AA-fouten), Playwright-sweep wacht op `deps`, laag 2 heeft nu een concreet moment | `08` §9 als doorlopend proces, niet een eenmalig vinkje | T5-1 t/m T5-5 als eerste vulling |
| [`T5-7-medium-tablet-compositie.md`](T5-7-medium-tablet-compositie.md) | **lobby/tussenstand uitgevoerd**, menu-paneel gebouwd maar op ⏸ (conflict met thema 2's `T2-9`, `HANDOFF-UI.md` UI-20) | Tweekoloms lobby + tussenstand + vast menu-panel vanaf tabletbreedte | Menu-paneel: afstemming met thema 2 (UI-20) |
| [`T5-8-large-podium-compositie.md`](T5-8-large-podium-compositie.md) | **deels uitgevoerd** — bredere tussenstand/podium + spelerswand + grotere code op een nieuwe 1200px-laag, gemeten met Playwright op 390/900/1300px | Desktop/tv-podium: lobby-als-podium, grote code/QR, bredere leaderboard | Afstemming met thema 1's `S20` bleek inmiddels feitelijk beantwoord (S20 = mobiel, dit = desktop/tv, geen overlap). De permanente QR-kaart uit `07` §7 blijft open — zie `HANDOFF-UI.md` UI-21 (D-018 staat geen tweede QR-ingang naast `room-header.mjs` toe) |
| [`T5-9-spelerslijst-bij-schaal.md`](T5-9-spelerslijst-bij-schaal.md) | **uitgevoerd** — gebouwd en gemeten tot 100 spelers | `07` §9's presentatietabel (0/1–8/9–20/21–35/36–100/100+) + joinbatching | niets |
| [`T5-10-host-verliest-verbinding.md`](T5-10-host-verliest-verbinding.md) | **uitgevoerd als meting + HANDOFF** | Recovery: gemeten (werkt). Timeout/uitslagbehoud: geen server-side timeout gevonden, vastgelegd als `HANDOFF-UI.md` UI-18 | VIP-overdracht blijft expliciet buiten scope (open PO-besluit) |

## Playwright-notitie (blokkeerde acht van de tien prompts)

`tests/e2e/` bevat alleen een README die wacht op een `deps`-akkoord voor
Playwright — dat bestaat niet in deze repo (`CLAUDE.md`: `deps` vraagt altijd
een mens). Acht prompts hingen hun Definition of Done op aan een committed
Playwright-testsuite die er niet is.

**Oplossing, gekozen door de producteigenaar:** geen `deps`-toevoeging nu.
In plaats daarvan is elke meting die al iets bestaands verifieert (T5-1,
T5-2, T5-3, T5-4) **ad-hoc uitgevoerd**: een tijdelijke Playwright-install
(niet in `package.json`, geen commit van test-infrastructuur) tegen een
lokaal gestarte `node server/index.mjs`, met het resultaat rechtstreeks in
het prompt-document vastgelegd. Dat leverde twee echte bugfixes op (zie
T5-1 en T5-3) die een geschreven-maar-nooit-uitgevoerde Playwright-DoD
nooit had gevonden.

T5-7 en T5-9 (compositie- en schaalwerk, geen pure verificatie) zijn
inmiddels ook gebouwd en met dezelfde ad-hoc-aanpak geverifieerd — de
Playwright-notitie hierboven gold voor hun DoD-tekst, niet voor de bouw zelf.
**T5-7's menu-paneel-onderdeel kreeg ná oplevering een nieuw
afstemmingspunt**, ditmaal niet van Playwright maar van thema 2: `T2-9`
claimt hetzelfde voorkeurenpaneel met een tegenstrijdige eis over compact
portrait (`HANDOFF-UI.md` UI-20). Niet zelf teruggedraaid of doorgebouwd —
zie de prompt zelf en `PROGRESS.md`. T5-8's afstemmingsvraag met thema 1's
`S20` bleek inmiddels feitelijk beantwoord (zie de tabel hierboven), en het
buildbare deel is gebouwd; alleen de permanente-QR-vraag (`HANDOFF-UI.md`
UI-21) blijft open, geen Playwright- of `deps`-vraag meer. Zodra het
`deps`-besluit ooit wél valt, worden de
ad-hoc-scripts van T5-1–T5-4/T5-7–T5-9 de eerste laag-1-specs uit `T5-6`,
niet iets wat opnieuw geschreven hoeft te worden. Los daarvan draait T5-6's
contrastcontrole al wél als een committed, automatische `node --test`-check —
dat hing nooit aan de Playwright-`deps`-vraag.

[`REVIEW.md`](REVIEW.md) — feitelijke controle van alle tien prompts tegen de
code (3 aug 2026), inmiddels verwerkt in bovenstaande statussen.

Met T5-9/T5-10 heeft nu **elke rij** in `PROGRESS.md` óf een prompt, óf een
expliciete reden waarom niet (thema 3's `M0` voor reduced motion; VIP-
overdracht binnen `T5-10` als open PO-besluit). Geen rij staat meer zonder
vervolgstap of onderbouwing.

**Correctie op een eerdere versie van deze README:** hier stond dat er bewust
geen prompt was voor medium/tablet- en large/podium-composities, "geblokkeerd
op `O-002`/`O-003`" resp. "Fase 3/4-scope". Beide waren fout — zie de
toelichting bij `T5-7` en `T5-8` zelf, en de correctieregels in `PROGRESS.md`.
Een tweekoloms breakpoint is een layoutvraag, geen typografie-/kleurvraag; en
`10` §8 zet "podium" expliciet op Fase 2. `T5-8` is wél gescoped — een deel
wacht écht op iets (`O-010`, een nog niet bestaande headline-engine), maar dat
is een andere reden dan "verkeerde fase".

**Al gedaan, niet als prompt hier** (zie `PROGRESS.md`, commit `58eba07`):
contrast in het lichte thema (echte WCAG-berekening, geen aanname), `env(safe-
area-inset-*)`, en de stille-fout-bug bij een verlopen/verwijderde room
(ontbrekend `S21`-scherm). `prefers-reduced-motion` staat er ook al, maar dat
is thema 3's `M0` — zie die prompt, niet hier herhalen.
