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

**Bewust geen prompt voor medium/tablet- en large/podium-composities.** Dat is
geen verificatie- of kleine-fixklus maar echt compositiewerk — nieuwe layouts,
geen bestaande te testen. `10-IMPLEMENTATION-ROADMAP.md` zet dat ook pas in
latere fasen (podiumcompositie is Fase 3/4-scope). Een prompt schrijven zou nu
een bouwbare taak suggereren die zonder eerst `O-002`/`O-003` (thema 2) en een
werkende large/stage-compositie geen stabiele basis heeft.

**Al gedaan, niet als prompt hier** (zie `PROGRESS.md`, commit `58eba07`):
contrast in het lichte thema (echte WCAG-berekening, geen aanname), `env(safe-
area-inset-*)`, en de stille-fout-bug bij een verlopen/verwijderde room
(ontbrekend `S21`-scherm). `prefers-reduced-motion` staat er ook al, maar dat
is thema 3's `M0` — zie die prompt, niet hier herhalen.
