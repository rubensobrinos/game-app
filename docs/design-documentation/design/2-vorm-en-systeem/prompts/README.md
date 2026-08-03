# Prompts — Thema 2: Vorm en systeem

Zelfde stijl als thema 3, 4 en 5: doel, brondocument, wat er nu staat, exact
contract, regels, definition of done.

Dit thema heeft één eigenschap die de andere vier niet hebben: **bijna niets
hier is voor onszelf.** Van de twaalf componenten wachten er zes op thema 1 en
twee op thema 4. De volgorde hieronder volgt daarom niet het niveau maar wie
er stilstaat — een 1 waar drie thema's op wachten gaat vóór een 0 waar niemand
op wacht.

| Bestand | Dekt | Niveau | Blokkeert |
| --- | --- | --- | --- |
| [`T2-1-semantische-kleurtokens.md`](T2-1-semantische-kleurtokens.md) | Tokenrollen conform `05` §2.1 | 1 → 2 | thema 1, 3 én 4 |
| [`T2-2-laadvariant-op-knoppen.md`](T2-2-laadvariant-op-knoppen.md) | `05` §4.1's ontbrekende loadingvariant | 1 → 2 | thema 1 (`S01`), thema 4 (`Potje maken…`) |
| [`T2-3-timer-en-progress.md`](T2-3-timer-en-progress.md) | Progressbalk i.p.v. kaal getal | 1 → 2 | thema 1 (`S08`) |
| [`T2-4-spelerchip.md`](T2-4-spelerchip.md) | Tijdelijke kleur/symboolidentiteit | 1 → 2 | thema 1 (`S05`/`S06`) |
| [`T2-5-qr-kaart-en-room-header.md`](T2-5-qr-kaart-en-room-header.md) | QR-kaart als component + de dode `room-header.mjs` inhangen | 1 → 2 | thema 1 (`S05`) |
| [`T2-6-leaderboard-rij.md`](T2-6-leaderboard-rij.md) | Bewegingskolom (`↑2`) | 1 → 2 | thema 1 (`S15`) |
| [`T2-7-besluitverzoek-o002-o003.md`](T2-7-besluitverzoek-o002-o003.md) | Wat de producteigenaar moet beslissen vóór wereldmotieven en iconografie bestaan | 0 → bouwbaar | thema 5 (medium/tablet), thema 1 (podium) |

## Waarom er geen prompt voor motion-tokens staat

Die staat al in thema 3: [`M1-motion-tokens-en-e01.md`](../../3-beweging-en-gevoel/prompts/M1-motion-tokens-en-e01.md).
Dat is inhoudelijk een goede prompt, maar stap 1 ervan schrijft tokens in
`base.css`'s `:root` — het tokenblok van dít thema. Twee eigenaren op één blok
is precies het patroon dat vandaag al een keer misging.

**Voorstel, geen besluit** (`docs/handoff-principles.md`): thema 2 levert de
tokens, thema 3 consumeert ze en houdt `E01`–`E16` bij. `M1` verliest dan stap
1 en houdt stap 2 en 3. Andersom kan ook — dan schrapt thema 2 de regel
`Motion-tokens` uit zijn `PROGRESS.md`. Wat níét kan is allebei.

Zolang dat niet beslecht is, schrijf ik hier geen concurrerende prompt.

## Waarom `05` §15 (CSS-architectuur) er niet bij staat

De mappenstructuur uit §15 (`styles/`, `components/Button/`, …) is een
verhuizing van alle CSS in de repo. Met vier thema's die tegelijk in
`base.css` en `components.css` schrijven is dat vandaag gegarandeerd een
conflict. Dit hoort ná de eerste ronde van thema 1, 3 en 4, en dan als één
atomaire pas — niet als losse taak ertussendoor.

## Volgorde

`T2-1` hoort **nu**, en dat is de enige met een tijdslot. Thema 1, 3 en 4 zijn
aan het inlezen en hebben nog nauwelijks CSS geschreven; elke regel die zij
vanaf nu tegen `--bg` schrijven maakt die hernoeming duurder. Over een week is
het een conflict met vier gelijktijdige schrijvers in plaats van een pas van
een half uur.

Daarna `T2-2` (twee thema's wachten), dan `T2-3` t/m `T2-6` in willekeurige
volgorde — die blokkeren alle vier alleen thema 1.

`T2-7` is geen bouwtaak en kan parallel: het is een besluitverzoek, en tot het
antwoord er is blijven wereldmotieven en iconografie op 0 hoe veel tijd er ook
in gestoken wordt.
