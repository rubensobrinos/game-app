# Prompts — Thema 3: Beweging en gevoel

Zelfde stijl als `docs/frontend-plan/prompts/`: doel, brondocument, exact
contract, Regels, Definition of done.

**Review 3 aug 2026 verwerkt.** Oordeel: M0/M5 goedgekeurd ná aanscherping,
M1/M2/M4 bijgesteld, M3 geparkeerd. Volgorde hieronder volgt het eindadvies
uit die review, niet meer de oorspronkelijke volgorde uit `PROGRESS.md`.
M0/M4 zijn intussen gebouwd; thema 2 heeft de motion-tokens geleverd
(`8eb1996`), dus M1 is niet langer geblokkeerd. M6–M10 zijn nieuw
geschreven voor de vijf resterende zelfstandige niveau-0-momenten — nog
niet uitgevoerd, wachten op review.

| Bestand | Fase | Status | Dekt | Afhankelijk van |
| --- | --- | --- | --- | --- |
| [`M0-reduced-motion.md`](M0-reduced-motion.md) | M0 | ✅ gedaan (`7a146a0`) | `prefers-reduced-motion`: blanket-regel + scale echt uitgeschakeld | niets |
| [`M1-motion-tokens-en-e01.md`](M1-motion-tokens-en-e01.md) | M1 | 🔵 gedeblokkeerd, klaar om te bouwen | E01 op álle acht controls (volledige inventaris), transities aanvullen i.p.v. vervangen | M0, **thema 2's motion-tokens** — geleverd (`8eb1996`) |
| [`M2-choreografie-niveau1-naar-2.md`](M2-choreografie-niveau1-naar-2.md) | M2 | 🔵 klaar om te bouwen | E05/E06/E09/E10/E15 naar niveau 2. E08 samengevoegd met E09 (protocolgat, gemeld) | M1 |
| [`M5-performancebudget.md`](M5-performancebudget.md) | M5 | 🔵 klaar om te bouwen | `06` §9 als meetbare gate, direct ná M2 | M1, M2 (niet M3) |
| [`M4-mute-mechanisme.md`](M4-mute-mechanisme.md) | M4 | ✅ gedaan (`0d94744`) | Alleen de voorkeurlaag (`loadMuted`/`saveMuted` + gedeelde `safeSet`) — **geen zichtbare schakelaar** tot er geluid is | niets |
| [`M3-e16-dialoog-transities.md`](M3-e16-dialoog-transities.md) | M3 | ⏸️ geparkeerd | Voorstel `E16` — pas uitvoeren ná bevestiging + na ontwerp van een gedeelde dialog-lifecycle-helper | `E16` bevestigd, `M1` |
| [`M6-e02-potje-maken.md`](M6-e02-potje-maken.md) | M6 | 🟡 nieuw, wacht op review | E02 niveau 0→1: knop-label + progressindicator | niets |
| [`M7-e03-speler-komt-binnen.md`](M7-e03-speler-komt-binnen.md) | M7 | 🟡 nieuw, wacht op review | E03 niveau 0→1: chip-fade + tellerpuls + bulkjoin-debounce; vraagt eerst een reconciliatiefix in `lobby.mjs` | niets |
| [`M8-e07-laatste-drie-seconden.md`](M8-e07-laatste-drie-seconden.md) | M8 | 🟡 nieuw, wacht op review | E07 niveau 0→1: timer-urgentie (contrast + puls) | niets |
| [`M9-e11-rank-movement.md`](M9-e11-rank-movement.md) | M9 | 🟡 nieuw, wacht op review | E11 niveau 0→1: FLIP-rankbeweging + `↑2`/`↓1`; vraagt eerst nieuwe "vorige positie"-state | niets |
| [`M10-e14-podium.md`](M10-e14-podium.md) | M10 | 🟡 nieuw, wacht op review | E14 niveau 0→1: 3→2→1-opbouw, begrensde confetti, skip | niets |

## Uitvoeringsvolgorde (herzien ná review)

1. ✅ **M0** — gedaan (`7a146a0`): blanket-regel geverifieerd, scale-
   verwijdering die de review terecht miste toegevoegd en herverifieerd.
2. **M1** — gedeblokkeerd (thema 2's tokens geleverd, `8eb1996`): E01 op
   de volledige inventaris van acht controls.
3. **M2** — met E08 samengevoegd/geparkeerd en E06 pas bij `accepted`, niet
   bij `sending`.
4. **M5** — direct ná M2, als meetbare kwaliteitsgate, niet als
   losse observatie achteraf.
5. ✅ **M4** — gedaan (`0d94744`): alleen de opslaglaag; de zichtbare
   mute-control wacht op het eerste echte audiosignaal.
6. **M3** — pas ná expliciete bevestiging van `E16` én ontwerp van een
   gedeelde lifecycle-helper (niet drie losse implementaties).

**M6–M10 (nieuw, 3 aug 2026)** — de vijf resterende zelfstandige
niveau-0-momenten (`E02`/`E03`/`E07`/`E11`/`E14`), onafhankelijk van
elkaar en van `M1`–`M5` te bouwen. Nog niet uitgevoerd — wacht op review.

**Bewust geen prompt voor `E04` (countdown), `E12`/`E13` (sociale
headline/streak), geluidsarchitectuur of haptiek.** Die staan in
`PROGRESS.md` §"Afhankelijkheden van andere thema's" resp. blokkeren op
`O-008`. Die volgen zodra thema 1/4 hun deel leveren, of zodra de Product
Owner `O-008` beslist.
