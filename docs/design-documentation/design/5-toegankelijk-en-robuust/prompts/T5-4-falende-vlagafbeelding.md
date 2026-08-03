# Prompt — T5-4: Falende vlagafbeelding krijgt een fallback

**Status: uitgevoerd en geverifieerd.** Gebouwd exact zoals gecontracteerd,
met Playwright's `page.route()` bevestigd tegen `node server/index.mjs`
(ad-hoc, geen projectdependency — zie `prompts/README.md`).

## Brondocument

`08-ACCESSIBILITY-AND-RESILIENCE.md` §7 "Vlagafbeelding faalt": "fallback met
land-/vraagcontext indien dit de vraag niet verraadt; ... bij cruciale
ontbrekende asset vraag annuleren of vervangen, geen lege onmogelijke vraag."

## Wat er nu vaststaat en wat niet

Gemeten: `frontend/js/views/gameplay.mjs` zet `flag.src` zonder
`error`-handler. Een 404 (het bekende lokale `/flags/*`-gat, of een
daadwerkelijk ontbrekend bestand in productie) laat de browser-standaard
gebroken-afbeeldingicoon zien, met de `alt`-tekst (`t('game.flagAlt')`,
"Te raden vlag") als enige context — geen antwoordlek, maar ook geen
duidelijke fallback-vormgeving.

## Contract

`gameplay.mjs`'s `flag`-element krijgt een `error`-listener die, éénmalig per
ronde, een fallbackstijl toont: een vaste achtergrondkleur/kader ter grootte
van de normale vlag, met de bestaande `alt`-tekst zichtbaar als tekst in
plaats van als onzichtbaar attribuut op een gebroken icoon (`08` §7's "land-/
vraagcontext... indien dit de vraag niet verraadt" — dus **niet** de
landnaam tonen, alleen dat er een vlag hoorde te staan).

```js
flag.addEventListener('error', () => {
  flag.hidden = true;
  flagFallback.hidden = false;
  flagFallback.textContent = t('game.flagAlt');
});
```

Reset `flag.hidden`/`flagFallback.hidden` bij elke nieuwe ronde (waar
`renderedRoundId` al wisselt) — een fallback van ronde 1 mag niet blijven
hangen als ronde 2's vlag wél laadt.

## Regels

- Geen landnaam of ander antwoord-verradend detail in de fallback — exact
  dezelfde anti-afkijkdiscipline als de rest van het spelscherm.
- De vraag zelf gaat door; een falende vlag annuleert nooit een ronde (dat is
  alleen voor de host/server relevant bij een structureel kapotte contentset,
  niet voor deze UI-fallback).
- Geen `innerHTML` — zelfde precedent als de rest van `frontend/`.

## Definition of done — behaald

- `page.route('**/flags/*.png', ...)` simuleert een 404 tegen de échte
  server: `.gameplay-flag` verbergt zich, `.gameplay-flag-fallback` toont
  `t('game.flagAlt')` ("Te raden vlag") — geen landnaam.
- Licht thema geverifieerd: de fallback-achtergrond resolvet naar
  `--color-surface-1` (wit in licht thema), geen hardgecodeerde kleur.
- `node --test`: 2788/2788 groen.
- `PROGRESS.md`'s rij gaat van "1, gemeten (kapot)" naar "2, gemeten +
  gefixt".
