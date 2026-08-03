# Prompts — Thema 3: Beweging en gevoel

Zelfde stijl als `docs/frontend-plan/prompts/`: doel, brondocument, exact
contract, Regels, Definition of done.

**Review 3 aug 2026 verwerkt.** Oordeel: M0/M5 goedgekeurd ná aanscherping,
M1/M2/M4 bijgesteld, M3 geparkeerd. Volgorde hieronder volgt het eindadvies
uit die review, niet meer de oorspronkelijke volgorde uit `PROGRESS.md`.
M0/M4 zijn intussen gebouwd; thema 2 heeft de motion-tokens geleverd
(`8eb1996`), dus M1 is niet langer geblokkeerd. M6–M10 zijn nieuw
geschreven voor de vijf resterende zelfstandige niveau-0-momenten.

**Tweede reviewronde (3 aug 2026) — de restlijst, zie [`REVIEW.md`](REVIEW.md).**
Statuslijst klopt en M1 is echt gedeblokkeerd. Drie punten verwerkt:
`E13`'s protocolgat-framing is uit `PROGRESS.md` gehaald (verwijst nu naar
`11-verzoek-streak-reactiezinnen.md`), `E16` heeft nu een echt besluitverzoek
([`M11`](M11-besluitverzoek-E16-dialoog-transities.md), gericht aan de
producteigenaar) i.p.v. een bevestiging die aan niemand gevraagd was, en
`M1`'s inventaris is bijgewerkt (`.btn-opt`/`.btn-icon` waren al gemigreerd
naar `--motion-fast`).

**M6–M10 zijn gereviewd, zie [`REVIEW.md`](REVIEW.md).** Geen blokkerende
fouten — wel twee kleurtoken-verwijzingen die inmiddels een concreet
antwoord hebben (`M8`, `M10`) en één open coördinatiepunt met thema 4 over
`09` §9/§10 vs. `M9`'s `↑2`/`↓1`-notatie, nog niet zelf opgelost.

| Bestand | Fase | Status | Dekt | Afhankelijk van |
| --- | --- | --- | --- | --- |
| [`M0-reduced-motion.md`](M0-reduced-motion.md) | M0 | ✅ gedaan (`7a146a0`) | `prefers-reduced-motion`: blanket-regel + scale echt uitgeschakeld | niets |
| [`M1-motion-tokens-en-e01.md`](M1-motion-tokens-en-e01.md) | M1 | ✅ gedaan (`99634a9`) | E01 op álle acht controls — niveau 1 → 2 | niets |
| [`M2-choreografie-niveau1-naar-2.md`](M2-choreografie-niveau1-naar-2.md) | M2 | 🔵 klaar om te bouwen | E05/E06/E09/E10/E15 naar niveau 2. E08 samengevoegd met E09 (protocolgat, gemeld) | M1 |
| [`M5-performancebudget.md`](M5-performancebudget.md) | M5 | 🔵 klaar om te bouwen | `06` §9 als meetbare gate, direct ná M2 | M1, M2 (niet M3) |
| [`M4-mute-mechanisme.md`](M4-mute-mechanisme.md) | M4 | ✅ gedaan (`0d94744`) | Alleen de voorkeurlaag (`loadMuted`/`saveMuted` + gedeelde `safeSet`) — **geen zichtbare schakelaar** tot er geluid is | niets |
| [`M3-e16-dialoog-transities.md`](M3-e16-dialoog-transities.md) | M3 | ⏸️ geparkeerd, besluitverzoek ingediend | Voorstel `E16` — pas uitvoeren ná bevestiging + na ontwerp van een gedeelde dialog-lifecycle-helper | `E16` bevestigd via `M11`, `M1` |
| [`M11-besluitverzoek-E16-dialoog-transities.md`](M11-besluitverzoek-E16-dialoog-transities.md) | M11 | 🟡 wacht op producteigenaar | Besluitverzoek: `E16` toevoegen aan `06`, plus een gedeelde dialog-lifecycle-helper | niets — dit ís het verzoek waar `M3` op wacht |
| [`M6-e02-potje-maken.md`](M6-e02-potje-maken.md) | M6 | ✅ gedaan (`a6be5d4`) | E02 niveau 0→1: `setButtonLoading()` i.p.v. eigen indicator (correctie ná `0a4c9d6`) | niets |
| [`M7-e03-speler-komt-binnen.md`](M7-e03-speler-komt-binnen.md) | M7 | ✅ gedaan (`ed6d313`) | E03 niveau 0→1: reconciliatie + chip-fade + gedebouncete tellerpuls | niets |
| [`M8-e07-laatste-drie-seconden.md`](M8-e07-laatste-drie-seconden.md) | M8 | ✅ gedaan (`f8ef891`) | E07 niveau 0→1: puls op thema 2's timer-balk (bouwt op T2-3, niet de oorspronkelijke platte-tekst-aanpak) | niets |
| [`M9-e11-rank-movement.md`](M9-e11-rank-movement.md) | M9 | ✅ gedaan (`158d531`) | E11 niveau 1→2-richting: FLIP-beweging + eigen-rij-emphasis bovenop thema 1's al bestaande data/badge | niets |
| [`M10-e14-podium.md`](M10-e14-podium.md) | M10 | ✅ gedaan (`148a132`) | E14 niveau 1→2-richting: entrance-animatie + confetti + reduced-motion-gate bovenop thema 1's al bestaande stagger/skip | niets |

## Uitvoeringsvolgorde (herzien ná review)

1. ✅ **M0** — gedaan (`7a146a0`): blanket-regel geverifieerd, scale-
   verwijdering die de review terecht miste toegevoegd en herverifieerd.
2. ✅ **M1** — gedaan (`99634a9`): E01 op de volledige inventaris van acht
   controls, inclusief de twee die de tweede reviewronde als achterhaald
   markeerde (`.btn-opt`/`.btn-icon` waren al gemigreerd naar tokens).
3. **M2** — met E08 samengevoegd/geparkeerd en E06 pas bij `accepted`, niet
   bij `sending`.
4. **M5** — direct ná M2, als meetbare kwaliteitsgate, niet als
   losse observatie achteraf.
5. ✅ **M4** — gedaan (`0d94744`): alleen de opslaglaag; de zichtbare
   mute-control wacht op het eerste echte audiosignaal.
6. **M3** — pas ná expliciete bevestiging van `E16` én ontwerp van een
   gedeelde lifecycle-helper (niet drie losse implementaties).

✅ **M6–M10 (3 aug 2026)** — alle vijf gedaan. Twee (`M9`, `M10`) zijn
onderweg herschreven omdat thema 1 zelfstandig al een deel van hun scope
bouwde terwijl ze klaarlagen — zie `PROGRESS.md`'s "Afgerond"-sectie voor
het volledige verhaal per prompt.

**Geen prompt hier voor `E04`/`E12`** — thema 1 bouwde beide zelfstandig
(zie `PROGRESS.md`). **`E13` (streak)** wacht op thema 1's eigen
`11-verzoek-streak-reactiezinnen.md`, niet op iets van thema 3. Geluidsarchitectuur
en haptiek blokkeren op `O-008`.
