# Prompt — M2: E05/E06/E08/E09/E10/E15 van niveau 1 naar 2

Onderdeel van [`README.md`](README.md), fase M2. Vereist `M1`.

## Brondocument

`06-MOTION-SOUND-AND-FEEDBACK.md` §4, events `E05`, `E06`, `E08`, `E09`,
`E10`, `E15`. `11-DESIGN-QA-CHECKLIST.md` E (vraag/antwoord), F (timer/
rondeflow), G (reveal), K (accessibility — screenreader-dosering).

## Waarom deze zes samen

Alle zes hebben al een functionele trigger (niveau 1). Geluid staat overal
expliciet **niet** in scope (zit vast op `O-008`, zie `M4`).

## E05 — Antwoordselectie

`06`: pressfeedback (van `M1`), merkaccent op gekozen optie, statusindicator.
Beide bestaan al. **Verwacht geen extra werk** — controleer ná `M1` of dit al
niveau 2 haalt zonder wijziging; zo niet, meld wat concreet ontbreekt.

## E06 — Antwoord bevestigd

**Gecorrigeerd ná review.** De eerdere versie liet niet-gekozen opties dimmen
zodra `answerStatus` `sending` *of* `accepted` werd — maar `sending` is nog
vóór de serverbevestiging, en E05/E06 zijn in `06` bewust aparte momenten.
Dimmen tijdens `sending` suggereert een bevestiging die er nog niet is.

Exacte toestandstabel, geen brede aanname meer:

| `answerStatus` | Weergave |
|---|---|
| `idle` | alle opties actief |
| `sending` | gekozen optie geselecteerd, invoer vergrendeld (dubbele inzending voorkomen), neutrale verzendstatus — **geen dim** |
| `accepted` | overige opties gecontroleerd gedimd, bevestiging zichtbaar |
| afwijzing, retrybaar (niet `DEADLINE_PASSED`/`ALREADY_ANSWERED`) | terug naar `idle`-weergave, geen dim |
| afwijzing, terminaal (`DEADLINE_PASSED`/`ALREADY_ANSWERED`) | vergrendeld, expliciete foutstatus, geen dim (er komt toch geen bevestiging meer) |

`round-model.mjs` heeft deze vijf statussen al (`applyAnswerAccepted`/
`applyAnswerRejected`) — dit is puur `gameplay.mjs`'s `update()` die de juiste
class per status zet, geen nieuwe reducer-logica.

## E08 — Ronde sluit

**Herzien ná review — E08 bestaat niet als zelfstandig clientevent.**
`optionsLocked()` is voor wie al antwoordde al `true` sinds de eigen tik
(E06); voor wie niet antwoordde komt vergrendeling en de volledige uitslag
(E09) tegelijk binnen via `round:ended` — er is geen apart, waarneembaar
"ronde sluit nu"-moment ertussen. De vorige versie van deze prompt deed alsof
dat triggerpunt al bestond.

**Besluit voor de MVP (optie 1 uit de review, de eenvoudigste van drie):**
E08 vervalt als apart event en gaat op in het begin van E09 — geen aparte
transition cue, de E09-opbouw hieronder ís de sluit-en-revealovergang
ineen. Opties 2 (nieuw `round:closed`-servermoment) en 3 (clientzijdige
`endsAt`-cue) zijn bewust niet gekozen: allebei voegen een nieuw signaal toe
dat niet in `PROTOCOL.md` staat, en dat is geen beslissing voor thema 3
alleen.

**Actiepunt, geen stille aanname:** dit gat (geen protocolmoment tussen
"ronde actief" en "uitslag compleet") hoort gemeld te worden — als
`HANDOFF-UI`-item aan wie `PROTOCOL.md`/de servergebeurtenissen beheert, niet
als iets wat hier onder de motten wordt verstopt. Leg vast dát E08 en E09
zijn samengevoegd en waarom, zodat een latere protocoluitbreiding (een
losstaand `round:closing`-signaal) dit bewust kan losmaken in plaats van een
verrassing te zijn.

## E09 — Reveal correct antwoord

Twee aparte dingen:

1. **Opbouw.** Correcte optie krijgt eerst focus/accent, dán het label met
   uitleg — een korte, vaste volgorde (`--motion-emphasis`).
2. **Foute eigen keuze markeren — niet alleen kleur.** Als
   `model.selectedOptionId !== result.correctOptionId`, krijgt die knop een
   `is-wrong`-marker. **Aangescherpt ná review:** een rode rand alleen is
   onvoldoende als functioneel signaal (kleur niet als enige
   informatiedrager, `11` K / `D-006`-geest). Voeg een niet-kleur-indicator
   toe — een icoon, of een `aria-label`/sr-only-tekst ("Jouw antwoord") op
   die specifieke knop — naast de kleur, niet in plaats van de bestaande
   `game.correctAnswer`/`game.youWereWrong`-tekst die al `aria-live` heeft.

**Accessibility-scheiding, nieuw punt ná review.** De volledige reveal-inhoud
(correct antwoord, eigen resultaat) moet **onmiddellijk** semantisch
beschikbaar zijn — de opbouw uit punt 1 is uitsluitend een
presentatievolgorde via classes/opacity, nooit een timer die het correcte
antwoord tijdelijk uit de accessibility tree houdt. De bestaande
`aria-live`/`aria-atomic` op `.gameplay-result` blijft dus meteen de volledige
tekst bevatten; alleen het *zichtbare* verschijnen mag gefaseerd zijn.

## E10 — Punten tellen

Ontbrekend: oplopende telling naar de eindwaarde.

**DOM-structuur, aangescherpt ná review.** Eén tekstnode die `0, 1, 2…`
doorloopt is onbetrouwbaar voor assistive technology (leest mogelijk elke
tussenwaarde, of ziet de eindwaarde niet op tijd). Gebruik twee losse nodes:

```html
<span class="gameplay-score-animated" aria-hidden="true">…</span>
<span class="sr-only">Jouw punten: 164</span>
```

De `aria-hidden`-span animeert visueel; de `sr-only`-span krijgt direct de
definitieve waarde, ongeacht animatieduur. Dit vervangt niet de bestaande
`aria-live`-region op `.gameplay-result` — dat blijft de volledige
uitslagtekst aankondigen; deze twee nodes zijn specifiek voor de
scoreweergave binnen die regio.

**Reduced motion, JS-gedreven, niet door `M0` gedekt.** Check
`window.matchMedia('(prefers-reduced-motion: reduce)').matches` expliciet in
de tel-functie en toon bij `true` direct de eindwaarde — `M0`'s CSS-blanket-
regel raakt geen `setInterval`/`requestAnimationFrame`-gedreven telling.

## E15 — Reconnecting

Ontbrekend: voortgang en successcue. `reconnect-state.mjs` heeft `attempt`
al beschikbaar — toon 'm in de bestaande statusbalk. Bij terugkeer naar
`connected` een korte, stille successtransitie vóórdat de balk verdwijnt.

**Coördinatiepunt, nieuw ná review:** thema 4 (taal en tekst) werkt mogelijk
al aan reconnect-copy/sleutels. Stem de exacte tekst (`Opnieuw verbinden…
(poging {n})` of vergelijkbaar) af vóór een eigen sleutel in alle drie de
locales toe te voegen — anders ontstaan twee implementaties van dezelfde
tekst, zoals de review terecht waarschuwt.

## Regels

- Geen van deze zes krijgt hier geluid.
- Alle nieuwe transitions gebruiken thema 2's tokens (via `M1`), geen nieuwe
  losse ms-waarden.
- E06's dim en E09's `is-wrong`-marker zijn functionele correctheidssignalen
  — verifieer met een fout én een goed antwoord, niet alleen het gelukkige
  pad.
- Geen kleur-only-signalen waar `06`/`11` K "niet als enige informatiedrager"
  eisen (E09's foutmarkering specifiek).

## Definition of done

- Elk van de zes events handmatig doorlopen in headless Chromium, met zowel
  `reducedMotion: 'no-preference'` als `'reduce'` — E10 expliciet met beide.
- E06 expliciet getest tijdens `sending` (geen dim) én ná `accepted` (wel dim).
- E09's foutmarkering herkenbaar met een simulatie die kleur uitschakelt
  (bv. grayscale-filter in devtools) — moet nog steeds duidelijk zijn welke
  knop de eigen (foute) keuze was.
- `round-model.test.mjs`/`gameplay.mjs`: geen regressie op de bestaande
  tests; nieuwe zuivere logica krijgt eigen `node:test`-dekking.
- Een `HANDOFF-UI`-item gelogd over E08's ontbrekende protocolmoment
  (samengevoegd met E09, niet stilzwijgend).
- E15's tekst afgestemd met thema 4 vóór 'm in de locales landt.
- `PROGRESS.md`: E06, E09, E10, E15 van niveau 1 naar 2. E08 vervalt als apart
  regel (opgegaan in E09) i.p.v. naar niveau 2 te gaan. E05 naar 2 alleen als
  bevestigd zonder extra werk.
