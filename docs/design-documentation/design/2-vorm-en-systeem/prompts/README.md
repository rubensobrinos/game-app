# Prompts — Thema 2: Vorm en systeem

Zelfde stijl als thema 3, 4 en 5: doel, brondocument, wat er nu staat, exact
contract, regels, definition of done.

Dit thema had één eigenschap die de andere vier niet hadden: **bijna niets
hier was voor onszelf.** Zeven componenten blokkeerden thema 1, twee blokkeerden
thema 4 en één blokkeerde thema 3. De volgorde volgde daarom niet het niveau
maar wie er stilstond.

**Dat is nu opgelost: geen enkel ander thema wacht nog op dit gebied.**

## Stand

| Ticket | Dekt | Stand |
| --- | --- | --- |
| [`T2-8`](T2-8-motion-tokens.md) | Motion-schaal uit `06` §3 | ✅ `8eb1996` — deblokkeerde thema 3 |
| [`T2-1`](T2-1-semantische-kleurtokens.md) | Tokenrollen conform `05` §2.1 | ✅ `9ca5af0` |
| [`T2-2`](T2-2-laadvariant-op-knoppen.md) | Loadingvariant op knoppen (`05` §4.1) | ✅ `bc89e18` |
| [`T2-3`](T2-3-timer-en-progress.md) | Timer als progressbalk (`05` §9) | ✅ `34aecd7` |
| [`T2-4`](T2-4-spelerchip.md) | Kleur/symboolidentiteit (`05` §8, `D-022`) | ✅ `f615a70` |
| [`T2-6`](T2-6-leaderboard-rij.md) | Rank- en bewegingskolom (`05` §10) | ✅ `a9158fc` |
| [`T2-10`](T2-10-typografierollen.md) | Twaalf typografierollen (`05` §2.3) | ✅ `66a63b3` |
| [`T2-11`](T2-11-lege-en-foutstaten.md) | Lege en foutstaten (`05` §13) | ✅ `e20e0b7` |
| [`T2-9`](T2-9-overlays-bottom-sheets.md) | Bottom sheet op mobiel (`05` §12) | ⏸ geblokkeerd — zie hieronder |
| [`T2-7`](T2-7-besluitverzoek-o002-o003.md) | Besluitverzoek `O-002`/`O-003` | 🔵 bij de producteigenaar (`UI-11`) |
| [`T2-5`](T2-5-qr-kaart-en-room-header.md) | QR-kaart als component | ⏹ vervallen — thema 1 deed het (`UI-10` ✅) |

## Waarom `T2-9` niet gebouwd is

Het is de enige bouwprompt die klaarligt en niet mag. `T5-7` van thema 5
claimt hetzelfde onderdeel — het hamburgermenu vanaf medium als vast
zijpaneel — en zijn definition of done eist dat compact portrait (390×844)
ongewijzigd blijft. Precies de breedte waar `T2-9` de bottom sheet invoert.

Twee prompts op één component; dat moet er één worden vóór iemand begint.
Staat als handoff-item, niet als losse notitie hier.

## Wat bewust geen prompt heeft

**`05` §15 (CSS-mappenstructuur).** Een verhuizing van alle CSS terwijl vier
thema's tegelijk in `base.css` en `components.css` schrijven is gegarandeerd
een conflict. Dit hoort ná de eerste ronde, als één atomaire pas — en dan als
eigen ticket, want het moment waarop het kan is kort.

**Gameplay option (`05` §5).** Letter- en vormidentiteit is uitgesteld bij
besluit `D-021`. Pas een prompt als dat besluit wordt teruggedraaid.

**Wereldmotieven en iconografie (`05` §2.7, §3).** Op hold, niet onaangeroerd:
ze wachten op `O-003` en op een merkontwerper. Een bouwprompt zou een taak
suggereren die niemand kan uitvoeren. Het besluitverzoek is `T2-7`.

## Review

Beide rondes staan in [`REVIEW.md`](REVIEW.md), inclusief een sectie met wat
bewust níét is verwerkt. Samen 87 bevindingen; de zwaarste zaten niet in wat
er stond maar in wat er ontbrak — de motion-tokenpatstelling die al eenzijdig
was opgelost, een verzonnen rolnaam die precies verenigde wat `05` §2.6
scheidt, en twee gaten (`Overlays`, `Loading/empty/error`) die wel blokkeerden
maar geen ticket hadden.
