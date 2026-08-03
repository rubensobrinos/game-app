# Prompts — Thema 2: Vorm en systeem

Zelfde stijl als thema 3, 4 en 5: doel, brondocument, wat er nu staat, exact
contract, regels, definition of done.

Dit thema heeft één eigenschap die de andere vier niet hebben: **bijna niets
hier is voor onszelf.** Van de twaalf componenten wachten er zeven op thema 1,
en twee op thema 4. De volgorde volgt daarom niet het niveau
maar wie er stilstaat — een 1 waar drie thema's op wachten gaat vóór een 0
waar niemand op wacht.

| Bestand | Dekt | Niveau | Blokkeert |
| --- | --- | --- | --- |
| [`T2-8-motion-tokens.md`](T2-8-motion-tokens.md) | De schaal uit `06` §3 leveren | 0 → 1 | **thema 3, nu** |
| [`T2-1-semantische-kleurtokens.md`](T2-1-semantische-kleurtokens.md) | Tokenrollen conform `05` §2.1 | 1 → 2 | thema 1, 3 én 4 |
| [`T2-2-laadvariant-op-knoppen.md`](T2-2-laadvariant-op-knoppen.md) | `05` §4.1's ontbrekende loadingvariant | 1 → 2 | thema 1 (`S01`) |
| [`T2-5-qr-kaart-en-room-header.md`](T2-5-qr-kaart-en-room-header.md) | Styling voor `room-header.mjs` — er is er nul | 1 → 2 | thema 1 (`S05`) |
| [`T2-3-timer-en-progress.md`](T2-3-timer-en-progress.md) | Progressbalk i.p.v. kaal getal | 1 → 2 | thema 1 (`S08`) |
| [`T2-4-spelerchip.md`](T2-4-spelerchip.md) | Tijdelijke kleur/symboolidentiteit (`D-022`) | 1 → 2 | thema 1 (`S05`/`S06`) |
| [`T2-6-leaderboard-rij.md`](T2-6-leaderboard-rij.md) | Rankkolom + bewegingskolom (`↑2`) | 1 → 2 | thema 1 (`S15`) |
| [`T2-9-overlays-bottom-sheets.md`](T2-9-overlays-bottom-sheets.md) | Bottom sheet op mobiel (`05` §12) | 1 → 2 | thema 1 (`S18`) |
| [`T2-10-typografierollen.md`](T2-10-typografierollen.md) | Elf losse lettergroottes → negen rollen (`05` §2.3) | 1 → 2 | thema 1 (code, score, timer) |
| [`T2-11-lege-en-foutstaten.md`](T2-11-lege-en-foutstaten.md) | `05` §13's empty en error als patroon i.p.v. per scherm | 1 → 2 | thema 1 en 4 |
| [`T2-7-besluitverzoek-o002-o003.md`](T2-7-besluitverzoek-o002-o003.md) | Wat de producteigenaar moet beslissen | ⏸ | — |

**Gebouwd:** `T2-8` (`8eb1996`), `T2-1` (`9ca5af0`), `T2-2` (`bc89e18`),
`T2-3` (`34aecd7`), `T2-4` (`f615a70`). `T2-5` is vervallen — thema 1 heeft
`room-header.mjs` zelf ingehangen en gestyled (`UI-10` ✅).

## Volgorde

**`T2-8` eerst, en het is dringend.** De motion-tokens waren een naad tussen
thema 2 en 3; die is beslecht in `HANDOFF-UI.md` UI-9 en thema 3 heeft zijn
eigen prompt al herschreven om ze te consumeren. `M1` zegt nu letterlijk
*"blokkeert dit werk totdat de tokens daadwerkelijk bestaan"*. Ze bestaan niet.
Al het animatiewerk in het product staat dus op dit thema te wachten — dat is
geen afweging maar een schuld.

**`T2-1` daarna, en het heeft een tijdslot.** Thema 1, 3 en 4 hebben nog
nauwelijks CSS geschreven. Elke regel die zij vanaf nu tegen `--bg` schrijven
maakt de hernoeming duurder; over een week is het een conflict met vier
schrijvers in plaats van een pas van een half uur.

De rest volgt op wie wacht: `T2-2` en `T2-5` (thema 1 staat er direct op stil),
dan `T2-3`, `T2-4`, `T2-6` en `T2-9`. `T2-7` is geen bouwtaak en kan parallel.

## Waarom `05` §15 (CSS-architectuur) er niet bij staat

De mappenstructuur uit §15 (`styles/`, `components/Button/`, …) is een
verhuizing van alle CSS in de repo. Met vier thema's die tegelijk in
`base.css` en `components.css` schrijven is dat vandaag gegarandeerd een
conflict. Dit hoort ná de eerste ronde van thema 1, 3 en 4, en dan als één
atomaire pas — niet als losse taak ertussendoor.

## Wat deze set ná review is geworden

Alle negen bestanden zijn adversarieel gereviewd, in twee rondes en samen 87
bevindingen — volledig vastgelegd in [`REVIEW.md`](REVIEW.md), inclusief wat
bewust niet is verwerkt. De zwaarste zaten niet in wat er stond maar in wat er
níét stond:

- de motion-tokenpatstelling was al eenzijdig door thema 3 opgelost, en deze
  README weigerde nog te leveren op grond van een conflict dat niet meer
  bestond;
- `T2-1` verzon een rolnaam (`--color-focus-glow`) die in geen enkel document
  staat, en verenigde daarmee precies wat `05` §2.6 scheidt;
- `T2-4` vulde een open producteigenaarsbesluit in dat `T2-7` in dezelfde set
  juist als onaantastbaar behandelde — inmiddels beslecht met `D-022`;
- `T2-5` nam werk over dat `HANDOFF-UI.md` UI-10 aan thema 1 toewijst, en
  beschreef `room-header.mjs` als "ongetest" terwijl het probleem is dat er
  nul CSS voor bestaat;
- `Overlays` blokkeerde thema 1 maar had geen prompt en stond ook niet bij de
  bewuste weglatingen. Dat is nu `T2-9`.
