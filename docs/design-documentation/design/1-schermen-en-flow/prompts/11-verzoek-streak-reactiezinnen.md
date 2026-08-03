# Prompt — 11: Ontdekt tijdens `07`: streak-reactiezinnen zijn wél bouwbaar

Onderdeel van [`README.md`](README.md). **Kleine bouwtaak, niet uitgevoerd** —
raakt nieuwe UI-copy en een nieuwe instelling (opt-out), dus hier vastgelegd
als voorstel in plaats van stilzwijgend meegenomen in `07`.

## Ingetrokken aanname — met de reden (principe 8)

`HANDOFF-UI.md`'s `UI-16` noemde "streak" oorspronkelijk als één van drie
sociale-headline-typen die een protocolwijziging nodig hebben (geen client
zicht op andermans streaks). Dat klopt voor een **gedeeld sociaal feit**
("Sanne zit op een streak van 5!") — maar `docs/multiplayer/GAME-RULES.md`
§Reactiezinnen en streaks beschrijft iets anders:

```text
- draaien per speler;
- mogen client-side worden bepaald uit serverresultaten;
- staan standaard aan;
- zijn per speler uitzetbaar;
- hebben geen invloed op de server-score;
- mogen nooit vóór round:ended verraden of het antwoord goed was.
```

Dat is een **eigen-speler-reactietekst**, geen groepsfeit — het tegenovergestelde
van wat `UI-16` als geblokkeerd noemde. De eigen streak is nu al af te leiden
uit de bestaande `round:ended`-geschiedenis (`selfCorrect` per ronde, al
beschikbaar in `round-model.mjs`'s `result`) — er is geen protocolgat, alleen
een niet-gebouwde feature.

## Wat er al bestaat, en wat niet

- `round-model.mjs`'s `applyRoundEnded()` levert `result.selfCorrect` per
  ronde, maar dit model wordt bij elke nieuwe ronde volledig vervangen
  (`applyRoundStarted()` doet `{...initialRoundModel(), ...}`) — er is dus
  geen bijgehouden geschiedenis over rondes heen. Een streakteller heeft
  zijn eigen, kleine state nodig (net als `reveal-model.mjs`/`social-
  headline.mjs`: puur, geen DOM).
- Geen enkele plek toont vandaag een reactiezin. `game.resultCorrect`/
  `game.resultIncorrect` (het bestaande JUIST/ONJUIST-stempel) is een ander
  soort tekst — vast, niet oplopend met een streak.
- Geen instelling bestaat om reactiezinnen uit te zetten. `GAME-RULES.md`
  vraagt expliciet "staan standaard aan" + "zijn per speler uitzetbaar" —
  dat is een nieuwe toggle, vergelijkbaar met `preferences.mjs`'s bestaande
  `loadMuted`/`saveMuted`-patroon (geluid), niet in `HostConfig` (dit is een
  lokale kijkersvoorkeur, geen roomregel).

## Wat ik zou voorstellen

1. **`views/streak-model.mjs`** (puur, `node:test`, zelfde stijl als
   `reveal-model.mjs`): houdt een lopende teller bij van opeenvolgende eigen
   `selfCorrect`-rondes, gereset naar 0 bij een foute/geen-antwoord-ronde.
   Puur invoer/uitvoer, geen sessiestatus.
2. **Reactiezin naast (niet in plaats van) het bestaande resultaatstempel**
   in `gameplay.mjs`, alleen zichtbaar vanaf bv. 3 op een rij (een streak van
   1 of 2 is geen "reactie" waard) — drempel is een eigen keuze, geen
   voorschrift in `GAME-RULES.md`.
3. **Opt-out-toggle** in `preferences.mjs` (`loadReactionsEnabled`/
   `saveReactionsEnabled`, zelfde patroon als `loadMuted`/`saveMuted`),
   bereikbaar vanuit het bestaande voorkeurenpaneel (`app-menu.mjs`, S18) —
   geen nieuwe schermlocatie nodig.
4. Nieuwe teksten in alle drie de locales (`headline.streak.one`/`.other` of
   vergelijkbaar), duidelijk *niet* vernederend voor wie geen streak heeft
   (gewoon niets tonen, geen "0 op een rij"-tekst).

## Wat ik nodig heb om verder te kunnen

Dit raakt nieuwe copy en een nieuwe, zichtbare instelling — twee dingen die
niet stilzwijgend door een agent gekozen horen te worden:

1. **Bevestigd, bouw het** — dan pak ik dit op als een tiende, kleine prompt
   in dit gebied, met de aanpak hierboven als uitgangspunt.
2. **Anders, met een richting** — bv. een andere drempel, andere plek voor de
   toggle, of reactiezinnen toch liever samen met `social-headline.mjs`
   ipv. een los `streak-model.mjs`.
3. **Nog niet, bewust** — ook geldig; dan blijft `GAME-RULES.md`'s
   "reactiezinnen en streaks" ongebouwd, met deze prompt als vindplaats voor
   wanneer het wel aan de orde komt.

## Regels

- Geen eigen aanname over de drempel/toggle-plek doorvoeren zonder het hier
  vast te leggen — dit voorstel is een startpunt, geen besluit.
- Nooit vóór `round:ended` verraden of het antwoord goed was (`GAME-RULES.md`
  §Reactiezinnen, laatste regel) — de reactiezin hoort bij het resultaatblok,
  niet ervoor.
