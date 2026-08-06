# Prompt — T2-8: Motion-tokens leveren

Onderdeel van [`README.md`](README.md). **Dit blokkeert op dit moment alle
animatiewerk in het product.**

## Waarom deze prompt bestaat

Thema 2 en thema 3 claimden allebei de motion-tokens. Dat is beslecht in
`HANDOFF-UI.md` UI-9: **thema 2 levert en beheert ze, thema 3 consumeert ze.**
Thema 3 heeft dat geaccepteerd en zijn eigen prompt herschreven —
`M1-motion-tokens-en-e01.md` heet nu "E01 op álle controls (consumeert thema
2's motion-tokens)" en zegt letterlijk: *"Blokkeert dit werk totdat de tokens
daadwerkelijk bestaan."*

Ze bestaan niet. Thema 3 staat dus stil op thema 2. Dat is de enige reden dat
deze prompt bovenaan hoort: niet omdat het het meeste oplevert, maar omdat
iemand anders wacht.

## Brondocument

`06-MOTION-SOUND-AND-FEEDBACK.md` §3 (Motion tokens — werkhypothese) en §2
(Algemene regels). `05-DESIGN-SYSTEM.md` §2 voor de naamgevingsstijl van
bestaande tokens.

## Wat er nu staat

Geen enkele motion-token. In plaats daarvan losse waarden, verspreid:

- `components.css`: `transition: transform 0.12s ease, box-shadow 0.12s ease,
  border-color 0.12s ease, background-color 0.12s ease` op het gedeelde
  knopblok;
- `base.css`: `transition: border-color 0.2s` op `.btn-icon`,
  `transition: all 0.18s` op `.btn-opt`.

Die `all 0.18s` is bovendien een probleem op zichzelf: `06` §9 vraagt om
transform/opacity waar het kan, en `transition: all` animeert ook layout-
eigenschappen.

`base.css` heeft sinds `58eba07` wél een blanket
`@media (prefers-reduced-motion: reduce)`-regel die alle duraties naar
0,001ms zet. Die blijft leidend — de tokens hieronder mogen daar niet
omheen werken.

## Wat dit is

1. **De schaal vastleggen** in `base.css`'s `:root`, naast de bestaande
   kleur- en radius-tokens. Eén waarde per bucket, gekozen binnen de
   bandbreedte die `06` §3 als werkhypothese geeft:

   ```css
   --motion-instant: 100ms;   /*  80–120ms  */
   --motion-fast:    160ms;   /* 140–180ms  */
   --motion-base:    250ms;   /* 220–280ms  */
   --motion-emphasis: 400ms;  /* 350–500ms  */
   --motion-stage:    900ms;  /* 700–1200ms */
   ```

   Een range doorgeven als token kan niet; de exacte ms binnen de bandbreedte
   is een implementatiedetail, geen ontwerpbesluit. Wijk je van de bandbreedte
   zelf af, meld dat dan als deviatie.

2. **De easingrollen** uit `06` §3 als tokens, niet als losse `ease`-waarden:
   input/press (snelle ease-out), verschijnen (zachte deceleratie), rank
   movement (spring-achtig maar beheerst), podium (stage easing). Vier
   `--ease-*`-tokens volstaan.

3. **De bestaande losse waarden vervangen.** Na deze prompt staat er geen
   enkele harde duration meer in `base.css` of `components.css`.

4. **`transition: all` op `.btn-opt` vervangen** door een expliciete lijst van
   eigenschappen. Dit is geen scope-uitbreiding maar het opruimen van precies
   de regel die deze prompt aanraakt.

## Regels

- **Alleen leveren, niet toepassen.** `E01` uitbreiden naar `.btn-opt` en
  `.btn-icon` is thema 3's `M1`, en die prompt ligt er al. Vervang hier
  uitsluitend bestaande waarden door tokens; voeg geen nieuwe animatie toe.
- **Geen zichtbare gedragsverandering.** Waar nu `0.12s` staat komt
  `var(--motion-instant)` (100ms) — dat is 20ms sneller en dus strikt genomen
  een wijziging. Dat is de bedoeling: de schaal wint van de toevallige waarde.
  Maar een knop die nu in 120ms indrukt hoort er daarna niet anders uit te
  zien, alleen consistenter met de rest.
- **De reduced-motion-regel niet aanraken.** Die staat in `base.css` en is van
  thema 3/5 (`M0`). Controleer alleen dat hij nog steeds wint van de nieuwe
  tokens — een `!important`-duur van 0,001ms hoort elke token te overrulen.
- Meld in `HANDOFF-UI.md` UI-9 dat de tokens er zijn, met hun namen, en zet
  het item op ✅. Thema 3 kan dan door.

## Definition of done

- `grep -rnE "[0-9]+(\.[0-9]+)?s\b|[0-9]+ms" frontend/css/` geeft alleen nog
  treffers binnen de tokendefinities zelf en binnen de reduced-motion-regel.
- `transition: all` komt niet meer voor in `frontend/css/`.
- Met `prefers-reduced-motion: reduce` beweegt er nog steeds niets — in de
  browser gecontroleerd, niet uit de code afgeleid.
- Knoppen zien er in beide thema's onveranderd uit; screenshot vóór en na van
  home, lobby en spelscherm.
- `HANDOFF-UI.md` UI-9 staat op ✅ met de tokennamen erbij, zodat thema 3 `M1`
  kan starten zonder deze prompt te hoeven lezen.
