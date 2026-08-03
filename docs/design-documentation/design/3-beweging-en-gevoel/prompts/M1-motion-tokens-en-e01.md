# Prompt — M1: Motion-tokens + E01 op álle controls

Onderdeel van [`README.md`](README.md), fase M1. Vereist `M0`.

## Brondocument

`06-MOTION-SOUND-AND-FEEDBACK.md` §3 (Motion tokens — werkhypothese) en §4
`E01` (Knop indrukken). `05-DESIGN-SYSTEM.md` (thema 2, tokens-hoofdstuk) voor
hoe bestaande tokens (`--r`, `--r-sm`, kleuren) zijn opgezet — motion-tokens
volgen dezelfde naamgevingsstijl, geen eigen conventie ernaast.

## Wat er nu staat

`components.css` heeft losse, herhaalde waarden (`0.12s`, `0.18s`) verspreid
over meerdere regels, en `:active`-scales alleen op `.btn-primary`,
`.btn-secondary`, `.btn-destructive`, `.gameplay-option`. `.btn-opt`
(taal-/themaknoppen in het hamburgermenu) en `.btn-icon` (hamburger,
QR-terugknop) hebben er geen — geverifieerd in `base.css`.

## Wat dit is

1. **Tokens vastleggen** in `base.css`'s `:root` (naast de bestaande
   kleur/radius-tokens), exact de schaal uit `06` §3:

   ```css
   --motion-instant: 100ms;
   --motion-fast: 160ms;
   --motion-base: 250ms;
   --motion-emphasis: 400ms;
   --motion-stage: 900ms;
   ```

   Kies één waarde per bucket (niet een range doorgeven als token) — de
   exacte ms binnen de bandbreedte uit `06` is een implementatiedetail, geen
   ontwerpbesluit; wijk je hiervan af, meld het als deviatie (§9
   `00-DESIGN-INDEX.md`).

2. **Bestaande `:active`-scales vervangen** door `transition: transform
   var(--motion-instant) ease-out` (of `--motion-fast`, toets tegen `06`'s
   "maximaal circa 100–140 ms" voor E01 specifiek) — geen losse `0.12s`/
   `0.18s` meer in `components.css`.

3. **E01 uitbreiden naar `.btn-opt` en `.btn-icon`** — zelfde
   pressfeedback-patroon (kleine scale, geen layoutshift), niet een nieuw
   mechanisme.

## Regels

- Geen nieuwe easingnamen verzinnen naast wat `06` §3 al noemt
  (input/press: snelle ease-out) — dit is de enige rol die E01 nodig heeft.
- Raak de bestaande `:active`-selectors niet inhoudelijk aan (welke
  transform, welke controls) — alleen de duration/token-bron verandert.
- `M0`'s blanket-regel blijft ongewijzigd; dit voegt er nieuwe transities
  aan toe, het vervangt niets.

## Definition of done

- Alle zes controltypes (`.btn-primary`, `.btn-secondary`, `.btn-destructive`,
  `.gameplay-option`, `.btn-opt`, `.btn-icon`) hebben identieke, token-
  gebaseerde pressfeedback — handmatig getikt in headless Chromium op elk
  scherm waar ze voorkomen (home, join, lobby, gameplay, hostbalk,
  hamburgermenu).
- Onder `prefers-reduced-motion: reduce` (van `M0`) is de pressfeedback
  vrijwel instant, niet afwezig — E01 blijft *iets* laten vuren, alleen sneller
  (`06` §7: "functionele durations worden niet onnodig langer", niet
  "motion verdwijnt").
- `PROGRESS.md`: Motion-tokens niveau 0 → 1. E01 niveau 1 → 2 (alle controls,
  geen `:not(alle controls)`-uitzondering meer in de toelichting).
