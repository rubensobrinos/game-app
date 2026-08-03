# Prompts — Thema 5: Toegankelijk en robuust

Zelfde stijl als `docs/frontend-plan/prompts/` en thema 3's `prompts/`: doel,
brondocument, exact contract, Regels, Definition of done.

Dit thema heeft een eigenschap die de andere vier niet hebben: de eigen
`PROGRESS.md` scoort zichzelf niet alleen op niveau maar ook op **bewijs**
(gemeten/gelezen/aangenomen). Dat bepaalt de volgorde hier meer dan impact
alleen — een "1, aangenomen" die in werkelijkheid een "0" blijkt te zijn is
gevaarlijker dan een eerlijke "0".

| Bestand | Dekt | Type | Afhankelijk van |
| --- | --- | --- | --- |
| [`T5-1-zoom-200-procent.md`](T5-1-zoom-200-procent.md) | Zoom/tekstvergroting: aangenomen → gemeten | verificatie + mogelijke fix | niets |
| [`T5-2-landscape.md`](T5-2-landscape.md) | Landscape: niet getest → gemeten | verificatie + mogelijke fix | niets |
| [`T5-3-refresh-sessieherstel.md`](T5-3-refresh-sessieherstel.md) | Refresh midden in een ronde: aangenomen → gemeten | verificatie + mogelijke fix | niets |
| [`T5-4-falende-vlagafbeelding.md`](T5-4-falende-vlagafbeelding.md) | Falende asset laat gebroken afbeelding zien | bouwbare fix | niets |
| [`T5-5-screenreader-testplan.md`](T5-5-screenreader-testplan.md) | Screenreader: aangenomen → gemeten | testplan voor een mens met een toestel | niets, maar **niet automatiseerbaar** |
| [`T5-6-testmatrix-proces.md`](T5-6-testmatrix-proces.md) | `08` §9 als doorlopend proces, niet een eenmalig vinkje | proces/checklist | T5-1 t/m T5-5 als eerste vulling |
| [`T5-7-medium-tablet-compositie.md`](T5-7-medium-tablet-compositie.md) | Tweekoloms lobby + tussenstand vanaf tabletbreedte | bouwbare compositie | niets |
| [`T5-8-large-podium-compositie.md`](T5-8-large-podium-compositie.md) | Desktop/tv-podium: lobby-als-podium, grote code/QR, bredere leaderboard | gescoped bouwbare compositie | O-010 (antwoordverdeling) en thema 1/4's headline-engine blokkeren een deel, niet het geheel |

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
