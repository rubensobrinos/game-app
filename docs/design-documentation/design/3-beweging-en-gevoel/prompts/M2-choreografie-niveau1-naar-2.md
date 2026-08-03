# Prompt — M2: E05/E06/E08/E09/E10/E15 van niveau 1 naar 2

Onderdeel van [`README.md`](README.md), fase M2. Vereist `M1` (tokens,
uitgebreide E01) — dit bouwt op die tokens, introduceert er geen nieuwe.

## Brondocument

`06-MOTION-SOUND-AND-FEEDBACK.md` §4, events `E05`, `E06`, `E08`, `E09`,
`E10`, `E15`. `11-DESIGN-QA-CHECKLIST.md` E (vraag/antwoord), F (timer/
rondeflow), G (reveal), K (accessibility — screenreader-dosering).

## Waarom deze zes samen

Alle zes hebben al een functionele trigger (niveau 1: er gebeurt iets). Dit
is dus per stuk goedkoop naar niveau 2 te tillen — geen nieuw mechanisme,
alleen de choreografie die `06` per event al voorschrijft. Geluid staat
overal expliciet **niet** in scope hier (zit vast op `O-008`, zie `M4` en
`PROGRESS.md`); waar `06` een cue noemt, is dat een latere laag bovenop wat
hier gebouwd wordt, geen blokkade.

## E05 — Antwoordselectie

`06`: pressfeedback (nu van `M1`), merkaccent op gekozen optie, statusindicator.
Beide bestaan al (`gameplay.mjs`'s `.is-selected` + statustekst). **Verwacht
geen extra werk hier** — controleer na `M1` of dit al niveau 2 haalt zonder
wijziging; zo niet, meld wat concreet ontbreekt in plaats van iets nieuws te
verzinnen.

## E06 — Antwoord bevestigd

Ontbreekt: "andere opties dimmen gecontroleerd". Voeg een `is-dimmed`-state
toe aan de niet-gekozen opties zodra `answerStatus` `sending`/`accepted`
wordt (`round-model.mjs` heeft die state al; dit is puur `gameplay.mjs`'s
`update()` die er een class bij zet). Geen sound hier (`O-008`).

## E08 — Ronde sluit

Ontbreekt: "korte transition cue" bij vergrendeling. Eén korte, token-
gebaseerde overgang (`--motion-fast`) op de optiegroep zodra `optionsLocked()`
van `false` naar `true` gaat door een servergebeurtenis (niet door de eigen
tik — dat is al E06). Geen kleur die op correct/incorrect lijkt (`D-006`).

## E09 — Reveal correct antwoord

Twee aparte dingen, niet één:

1. **Opbouw.** Correcte optie krijgt eerst focus/accent, dán pas het label
   met uitleg — een korte, vaste volgorde (`--motion-emphasis`), geen
   losse re-render ineens.
2. **Foute eigen keuze markeren.** Als `model.selectedOptionId !==
   result.correctOptionId`, moet die knop een `is-wrong`-marker krijgen
   "zonder agressieve shake" (`06`) — dit is een echt ontbrekend
   functioneel detail, niet alleen motion: op dit moment markeert
   `gameplay.mjs` uitsluitend de correcte optie.

## E10 — Punten tellen

Ontbrekend: oplopende telling naar de eindwaarde. **Let op:** dit is een
JS-gedreven telling, geen CSS-transition — `M0`'s blanket-regel dekt dit
dus **niet** automatisch. Check `window.matchMedia('(prefers-reduced-
motion: reduce)').matches` expliciet in de tel-functie en toon bij `true`
direct de eindwaarde, geen animatie. De eindwaarde blijft altijd
onmiddellijk in de DOM/accessibility tree staan (bestaande gedrag, niet
laten wachten op de telling — dat zou de huidige toegankelijkheidswinst
juist verslechteren).

## E15 — Reconnecting

Ontbrekend: voortgang en successcue. `reconnect-state.mjs` heeft `attempt`
al beschikbaar — toon 'm in de bestaande statusbalk (`Opnieuw verbinden…
(poging {n})`, nieuwe `tCount`-achtige of gewone sleutel in alle drie de
locales). Bij terugkeer naar `connected` een korte, stille successtransitie
(bv. kleurwissel van de balk, geen geluid) vóórdat de balk verdwijnt.

## Regels

- Geen van deze zes krijgt hier geluid — waar `06` een cue noemt, is dat
  `M4`/latere, PO-afhankelijke laag.
- Alle nieuwe transitions gebruiken `M1`'s tokens, geen nieuwe losse
  ms-waarden.
- E09's `is-wrong`-marker en E06's `is-dimmed` zijn functionele
  correctheidssignalen (moeten kloppen), niet alleen cosmetisch — verifieer
  met een fout én een goed antwoord, niet alleen het gelukkige pad.

## Definition of done

- Elk van de zes events handmatig doorlopen in headless Chromium, met
  zowel `reducedMotion: 'no-preference'` als `'reduce'` — E10 expliciet
  met beide, want dat is de ene die `M0` niet automatisch dekt.
- `round-model.test.mjs`/`gameplay.mjs`: geen regressie op de bestaande
  330+ tests; nieuwe zuivere logica (bv. "is dit de foute eigen keuze")
  krijgt eigen `node:test`-dekking in `round-model.mjs` als het daar hoort.
- `PROGRESS.md`: E06, E08, E09, E10, E15 van niveau 1 naar 2. E05 naar 2
  alleen als bevestigd zonder extra werk (zie boven).
