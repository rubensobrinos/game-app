# Prompt — M1: E01 op álle controls (consumeert thema 2's motion-tokens)

Onderdeel van [`README.md`](README.md), fase M1. Vereist `M0` (incl. de
scale-verwijdering die daar is toegevoegd ná review) **en thema 2's
motion-tokens** (`HANDOFF-UI.md` UI-9).

**Eigenaarswijziging ná HANDOFF-UI UI-9 (thema 2, 3 aug 2026):** deze prompt
schreef de tokens eerder zelf in `base.css`'s `:root` — hetzelfde blok waar
thema 2 ze ook claimt. Twee schrijvers op één blok is precies het patroon dat
al eerder misging (`05` §15, het gedeelde knopblok). Akkoord met thema 2's
voorstel: **thema 2 levert en beheert `--motion-instant` t/m
`--motion-stage`** (`05` §2 is de aangewezen plek voor het designsysteem);
thema 3 **consumeert** ze hier en houdt de eventcatalogus (`E01`–`E16`) bij.
Stap 1 hieronder (tokens vastleggen) is dus geschrapt uit thema 3's werk —
zie thema 2's `PROGRESS.md` voor die kant. Blokkeert dit werk totdat de
tokens daadwerkelijk bestaan.

## Brondocument

`06-MOTION-SOUND-AND-FEEDBACK.md` §3 (Motion tokens — werkhypothese) en §4
`E01` (Knop indrukken). `05-DESIGN-SYSTEM.md` (thema 2, tokens-hoofdstuk) voor
hoe bestaande tokens (`--r`, `--r-sm`, kleuren) zijn opgezet — motion-tokens
volgen dezelfde naamgevingsstijl, geen eigen conventie ernaast.

## Wat er nu staat — volledige inventaris (bijgewerkt ná review)

Geverifieerd tegen de daadwerkelijke CSS, niet uit het geheugen:

| Control | `:active`-feedback | Transition-bron |
|---|---|---|
| `.btn-primary` | `scale(0.98)` (gedeeld met `.podium-rematch`) | `0.12s` losse waarde |
| `.podium-rematch` | idem, via dezelfde selector als `.btn-primary` | idem |
| `.btn-secondary` | `scale(0.99)` | `0.12s` losse waarde |
| `.btn-destructive` | `scale(0.99)` | `0.12s` losse waarde |
| `.gameplay-option:not(:disabled)` | `scale(0.99)` | `0.12s` losse waarde |
| `.btn-quiet` | **geen enkele** — geverifieerd, geen `:active`-regel bestaat | — |
| `.btn-opt` | geen | `transition: all 0.18s` |
| `.btn-icon` | geen | `transition: border-color 0.2s` |

`.podium-rematch` hoort dus niet als apart werkitem in de lijst (die
pressfeedback bestaat al), maar wél expliciet in de inventaris zodat 'm niet
per ongeluk als "nog niet gedekt" wordt behandeld. `.btn-quiet` was in de
eerdere versie van deze prompt gemist — bestaat in `components.css` maar
wordt momenteel nergens toegepast; neem 'm toch mee, want zodra thema 2 'm
ergens gebruikt moet de pressfeedback er al staan.

## Wat dit is

0. **Vooraf: wacht op thema 2's tokens.** `--motion-instant` t/m
   `--motion-stage` komen uit thema 2 (`HANDOFF-UI` UI-9). Bestaan ze nog
   niet, dan is er hier niets te doen — geen eigen tijdelijke tokens
   verzinnen die later weer vervangen moeten worden.

1. **Bestaande `:active`-transities aanvullen, niet vervangen.** Reviewbevinding:
   een kale `transition: transform var(--motion-instant) ease-out` zou de
   bestaande, samengestelde transitionlijst (`box-shadow`, `border-color`,
   `background-color`) overschrijven en hover-/selected-overgangen abrupt
   maken. Voeg `transform` toe aan de bestaande lijst, elk met zijn eigen
   token in plaats van alles op `--motion-instant`:

   ```css
   transition:
     transform var(--motion-instant) ease-out,
     box-shadow var(--motion-fast) ease-out,
     border-color var(--motion-fast) ease-out,
     background-color var(--motion-fast) ease-out;
   ```

   Alleen de eigenschappen die een control al had blijven staan — dit is per
   selector een aanvulling, geen uniforme kopieerregel.

2. **E01 uitbreiden naar `.btn-quiet`, `.btn-opt` en `.btn-icon`** — zelfde
   pressfeedback-patroon (kleine scale, geen layoutshift), niet een nieuw
   mechanisme. `.btn-opt`'s `transition: all 0.18s` en `.btn-icon`'s losse
   `transition: border-color 0.2s` vervallen — beide krijgen de
   tokengebaseerde, per-eigenschap lijst uit punt 1. `all` verdwijnt
   sowieso: het maakt toekomstige layoutwijzigingen onbedoeld animeerbaar
   (reviewbevinding), los van of het token gebruikt.

3. **Non-scale reduced-motion-alternatief, nu onderdeel van M1 zelf, niet
   later.** `M0` verwijdert `transform` onder reduced motion voor de vier
   bestaande selectors — brei die lijst hier door naar `.btn-quiet`,
   `.btn-opt` en `.btn-icon` zodra ze pressfeedback krijgen, zodat geen
   control zonder reduced-motion-dekking blijft. Voeg een merkbare
   non-transform-wijziging toe voor het reduced-motion-pad (bv.
   `border-color`/`background-color` iets donkerder/lichter bij `:active`) —
   anders is er in die modus geen enkele pressfeedback meer, alleen een
   scale die is weggehaald.

## Regels

- Geen nieuwe easingnamen verzinnen naast wat `06` §3 al noemt (input/press:
  snelle ease-out).
- Raak de bestaande `:active`-selectors se transformwaarden niet inhoudelijk
  aan (welke scale-factor, welke controls) — alleen transition-bron en
  -aanvulling veranderen.
- Geen `transition: all` waar dan ook in deze wijziging — altijd met naam.

## Definition of done

- Alle acht controltypes uit de inventaris (inclusief `.btn-quiet` en
  `.podium-rematch` als expliciet-al-gedekt) hebben identieke,
  token-gebaseerde pressfeedback — handmatig getikt in headless Chromium op
  elk scherm waar ze voorkomen.
- Bestaande hover-/selected-kleurovergangen (box-shadow/border-color/
  background-color) zijn nog steeds vloeiend — geen abrupte regressie door
  de nieuwe transformregel.
- Onder `prefers-reduced-motion: reduce`: geen scale meer op geen van de acht
  controls (`M0`'s aanvullende regel dekt dit voor de eerste vier; deze
  prompt breidt 'm uit naar de laatste drie), maar wél een zichtbare
  non-transform-reactie op tik/klik.
- Nul instanties van `transition: all` of losse ms-waarden in
  `components.css`/`base.css` voor de aangeraakte selectors.
- `PROGRESS.md`: E01 niveau 1 → 2 (alle acht controls, inventaris expliciet
  in de toelichting). "Motion-tokens" als fundament verhuist naar thema 2's
  `PROGRESS.md` (UI-9) — niet hier afvinken.
