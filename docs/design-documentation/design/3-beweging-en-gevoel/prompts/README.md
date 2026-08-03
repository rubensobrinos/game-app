# Prompts — Thema 3: Beweging en gevoel

Zelfde stijl als `docs/frontend-plan/prompts/`: doel, brondocument, exact
contract, Regels, Definition of done.

**Review 3 aug 2026 verwerkt.** Oordeel: M0/M5 goedgekeurd ná aanscherping,
M1/M2/M4 bijgesteld, M3 geparkeerd. Volgorde hieronder volgt het eindadvies
uit die review, niet meer de oorspronkelijke volgorde uit `PROGRESS.md`.

| Bestand | Fase | Status | Dekt | Afhankelijk van |
| --- | --- | --- | --- | --- |
| [`M0-reduced-motion.md`](M0-reduced-motion.md) | M0 | 🟡 deels gedaan, scale-fix nog te doen | `prefers-reduced-motion`: blanket-regel + scale echt uitschakelen | niets |
| [`M1-motion-tokens-en-e01.md`](M1-motion-tokens-en-e01.md) | M1 | 🔵 klaar om te bouwen | E01 op álle acht controls (volledige inventaris), transities aanvullen i.p.v. vervangen | M0, **thema 2's motion-tokens** (`HANDOFF-UI` UI-9) |
| [`M2-choreografie-niveau1-naar-2.md`](M2-choreografie-niveau1-naar-2.md) | M2 | 🔵 klaar om te bouwen | E05/E06/E09/E10/E15 naar niveau 2. E08 samengevoegd met E09 (protocolgat, gemeld) | M1 |
| [`M5-performancebudget.md`](M5-performancebudget.md) | M5 | 🔵 klaar om te bouwen | `06` §9 als meetbare gate, direct ná M2 | M1, M2 (niet M3) |
| [`M4-mute-mechanisme.md`](M4-mute-mechanisme.md) | M4 | 🔵 klaar om te bouwen (herzien) | Alleen de voorkeurlaag (`loadMuted`/`saveMuted` + gedeelde `safeSet`) — **geen zichtbare schakelaar** tot er geluid is | niets |
| [`M3-e16-dialoog-transities.md`](M3-e16-dialoog-transities.md) | M3 | ⏸️ geparkeerd | Voorstel `E16` — pas uitvoeren ná bevestiging + na ontwerp van een gedeelde dialog-lifecycle-helper | `E16` bevestigd, `M1` |

## Uitvoeringsvolgorde (herzien ná review)

1. **M0** — verifiëren dat de bestaande blanket-regel klopt, plus de
   scale-verwijdering die de review terecht miste.
2. **M1** — wacht op thema 2's tokens (`UI-9`), dan E01 op de volledige
   inventaris van acht controls.
3. **M2** — met E08 samengevoegd/geparkeerd en E06 pas bij `accepted`, niet
   bij `sending`.
4. **M5** — direct ná M2, als meetbare kwaliteitsgate, niet als
   losse observatie achteraf.
5. **M4** — alleen de opslaglaag; de zichtbare mute-control wacht op het
   eerste echte audiosignaal.
6. **M3** — pas ná expliciete bevestiging van `E16` én ontwerp van een
   gedeelde lifecycle-helper (niet drie losse implementaties).

**Bewust geen prompt voor `E04` (countdown), `E12`/`E13` (sociale
headline/streak), geluidsarchitectuur of haptiek.** Die staan in
`PROGRESS.md` §"Afhankelijkheden van andere thema's" resp. blokkeren op
`O-008`. Die volgen zodra thema 1/4 hun deel leveren, of zodra de Product
Owner `O-008` beslist.
