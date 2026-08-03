# Prompt — T5-3: Refresh midden in een ronde

**Status in `PROGRESS.md`:** Refresh / sessieherstel | niveau 1 | bewijs:
**aangenomen** ("Sessie in `localStorage`, deep link valt terug op de
code-invoerflow. Niet geverifieerd of score en ingediend antwoord een refresh
midden in een ronde overleven.")

## Brondocument

`08-ACCESSIBILITY-AND-RESILIENCE.md` §5: "refresh herstelt actuele state;
score, naam en ingediend antwoord blijven." `11-DESIGN-QA-CHECKLIST.md` L:
"Herstelt refresh naam, score en actuele game-state?"

## Wat er nu vaststaat en wat niet

Gelezen, niet gemeten: `app.mjs` laadt bij elke `render()` de sessie uit
`localStorage` (`loadSession`) en mount `session-shell.mjs` opnieuw, dat op
zijn beurt `requestFreshSnapshot()` aanroept — dus in theorie herstelt naam,
rol en fase via een verse `room:state`. **Niet gemeten:** of `roundModel`
(de lokale rondedata — huidige vraag, opties, `selectedOptionId`,
`answerStatus`) iets van zijn eigen state overleeft, want dat leeft uitsluitend
in de JS-module van vóór de refresh en verdwijnt sowieso volledig. De vraag is
dus niet "overleeft het" maar "**herstelt** de nieuwe sessie hem opnieuw uit
wat de server nog weet, of laat het de speler zonder vraag achter tot de
volgende serverevent."

`PROTOCOL.md`/`room:state`'s snapshot bevat `currentRound` — of dat veld
genoeg bevat om `round-model.mjs`'s `applyRoundStarted`-vorm opnieuw op te
bouwen (inclusief `startsAt`/`endsAt` voor de timer, en of de eigen
`answeredCurrentRound`-status uit `self` een reeds ingediend antwoord
zichtbaar maakt) is niet gecontroleerd.

## Contract

Playwright, tegen `transport-mock.mjs` (real-timer-onafhankelijk via de
`clock`-API zoals de UI5-verificatie): start een ronde, dien een antwoord in,
`page.reload()` midden in `ROUND_ACTIVE`, en controleer:

1. Landt de speler weer op het spelscherm (niet op lobby of home)?
2. Toont het scherm de huidige vraag, of blijft het leeg tot de volgende
   `round:progress`/`round:ended`?
3. Is het eigen ingediende antwoord zichtbaar als "al beantwoord" (vergrendeld,
   geen tweede tik mogelijk), of kan de speler na een refresh per ongeluk
   nogmaals antwoorden?
4. Klopt de getoonde score na een refresh tijdens `SCOREBOARD`/`FINISHED`?

Herhaal voor een refresh tijdens `LOBBY` (mist de speler een intussen
gewijzigde deelnemerslijst tot de volgende delta?) en tijdens `PAUSED` (toont
de pauze-overlay meteen weer, met de juiste reden?).

## Regels

- Geen giswerk over wat `room:state` behoort te bevatten — als het huidige
  `currentRound`-veld niet genoeg is om de vraag te herstellen, is dat een
  `HANDOFF`-item aan INT-A/PR (protocolgat), geen aanname die de UI zelf
  invult.
- Een speler die ná een refresh alsnog een tweede antwoord probeert te
  versturen mag nooit een dubbel antwoord kunnen registreren — dat is al
  server-autoritatief geborgd (`ALREADY_ANSWERED`), verifieer alleen dat de
  UI dat pad ook netjes toont in plaats van een generieke fout.

## Definition of done

- De vier scenario's hierboven zijn gemeten, met een concreet resultaat per
  scenario (niet één samengevat "werkt").
- Gevonden gaten gefixt in `session-shell.mjs`'s `applyRoomState`/
  `handleEvent`, of vastgelegd als protocolgat als de payload het simpelweg
  niet toestaat.
- `PROGRESS.md`'s rij gaat van "1, aangenomen" naar "gemeten".
