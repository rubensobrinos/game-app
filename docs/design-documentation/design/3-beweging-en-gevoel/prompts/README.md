# Prompts — Thema 3: Beweging en gevoel

Zelfde stijl als `docs/frontend-plan/prompts/`: doel, brondocument, exact
contract, Regels, Definition of done. Volgorde komt rechtstreeks uit
[`../PROGRESS.md`](../PROGRESS.md) §"Volgorde die ik zou aanhouden" — niet
op eventnummer (`E01`–`E16`), maar op wat zelfstandig te trekken is.

| Bestand | Fase | Dekt | Afhankelijk van |
| --- | --- | --- | --- |
| [`M0-reduced-motion.md`](M0-reduced-motion.md) | M0 | `prefers-reduced-motion` als blanket-regel | niets — bewust eerst |
| [`M1-motion-tokens-en-e01.md`](M1-motion-tokens-en-e01.md) | M1 | Motion-tokens, E01 op álle controls | M0 |
| [`M2-choreografie-niveau1-naar-2.md`](M2-choreografie-niveau1-naar-2.md) | M2 | E05/E06/E08/E09/E10/E15 van niveau 1 naar 2 | M1 |
| [`M3-e16-dialoog-transities.md`](M3-e16-dialoog-transities.md) | M3 | Voorstel `E16`: hamburgermenu/QR-overlay/pauze-overlay | M1 |
| [`M4-mute-mechanisme.md`](M4-mute-mechanisme.md) | M4 | Mute-schakelaar + voorkeur (zonder geluid eronder) | niets — onafhankelijk van `O-008` |
| [`M5-performancebudget.md`](M5-performancebudget.md) | M5 | `06` §9 als vastgelegde, toetsbare regel | M1, M2 |

**Bewust geen prompt voor `E04` (countdown), `E12`/`E13` (sociale
headline/streak), geluidsarchitectuur of haptiek.** Die staan in
`PROGRESS.md` §"Afhankelijkheden van andere thema's" resp. blokkeren op
`O-008` — een prompt schrijven zou een bouwbare taak suggereren die er nog
niet is. Die volgen zodra thema 1/4 hun deel leveren, of zodra de Product
Owner `O-008` beslist.

Elke prompt is los uitvoerbaar en los te reviewen — geen prompt vereist dat
een latere al gedaan is, behalve waar de tabel dat expliciet noemt.
