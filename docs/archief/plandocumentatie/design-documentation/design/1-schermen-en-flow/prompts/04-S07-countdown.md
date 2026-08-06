# Prompt — 04: S07 — Countdown

Onderdeel van thema 1 ([`../PROGRESS.md`](../PROGRESS.md)). Niveau 0 —
bestaat nog niet. Fase 1 in de roadmap.

## Brondocument

[`../03-GAME-FLOW-AND-STATES.md`](../03-GAME-FLOW-AND-STATES.md) §6 (timing:
richtduur 2,5–3,0s), [`../04-SCREEN-SPECIFICATIONS.md`](../04-SCREEN-SPECIFICATIONS.md)
S07.

## De data is er al — dit is precies wat ontbreekt

`game:started`'s payload bevat al `countdownEndsAt` (`PROTOCOL.md`, en
`transport-mock.mjs` broadcast 'm al correct: `Date.now() + COUNTDOWN_MS`).
`match-phase-state.applyServerEvent` zet de fase op `COUNTDOWN` bij dat event.
`view-switcher.mjs`'s `GAMEPLAY_PHASES`-set bevat `COUNTDOWN` al en routeert
'm naar de `gameplay`-view. **Er bestaat dus al een server-gesynchroniseerd
tijdstip en een fase — er bestaat alleen geen scherm dat er iets mee doet.**
Nu toont `gameplay.mjs` gewoon niets zichtbaars tot de eerste `round:started`
binnenkomt (`displayState(model) === 'empty'`).

## Eerst: welke duur is leidend? — intern tegenstrijdig, niet zelf kiezen

`03` §6 noemt een richtduur van 2,5–3,0s; `transport-mock.mjs` zet
`COUNTDOWN_MS` echter vast op 1200ms (1,2s). Dat is geen afrondingsverschil —
bij 1,2s past een aftelling met discrete stappen op hele seconden (`3`→`2`→
`1`) domweg niet. Zoek eerst uit welke van de twee leidend is vóórdat je een
weergave bouwt:

- Als `COUNTDOWN_MS` een bewuste mock-vereenvoudiging is die in productie
  richting 2,5–3,0s gaat: leg dat vast als `HANDOFF`-item aan de eigenaar van
  `transport-mock.mjs`/het protocol — dit is een serverwaarde, geen
  clientkeuze, dus niet zelf de mock ophogen om 'm te laten kloppen.
- Als 1,2s de werkelijke waarde is (en `03` §6 verouderd is): meld dat ook als
  `HANDOFF`, en bouw ondertussen tegen wat `transport-mock.mjs` daadwerkelijk
  stuurt — niet tegen de documentwaarde.

Bouw in beide gevallen de weergave zo dat ze bij **elke** duur werkt (zie
hieronder), zodat de uiteindelijke serverkeuze de client niet breekt.

## Aanpak

Twee routes, kies er één en leg de keuze vast:

**A — countdown als sub-state van `gameplay.mjs`** (voorstel, sluit aan bij
hoe `match-phase-state` bewust geen aparte rondedata bijhoudt): geef
`createGameplayView`'s `update()` de huidige fase mee naast het model. Bij
`phase === 'COUNTDOWN'` toont de view een groot getal, afgeleid van
`Math.ceil(secondsRemaining(startsAt, countdownEndsAt, offsetMs))` — zelfde
patroon en dezelfde helper als de bestaande ronde-timer, alleen met
`countdownEndsAt` in plaats van `endsAt`. Reken dus het getal uit de
resterende tijd, neem geen vaste `3`/`2`/`1`-reeks aan: bij 1,2s tel je
bijvoorbeeld af vanaf `2`, bij 3,0s vanaf `3` — de weergave moet bij elke
serverduur kloppen zonder aanpassing. Geen aparte `createCountdownView`
nodig, geen aparte mount/unmount-cyclus vlak vóór de vraag (voorkomt een
flits).

**B — eigen `views/countdown.mjs`**, met een eigen entry in `view-switcher.mjs`
(`COUNTDOWN` uit `GAMEPLAY_PHASES` halen, eigen viewnaam). Zuiverder
gescheiden, maar `session-shell.mjs` moet dan binnen ~1,2–3s twee keer
mounten/unmounten (countdown → gameplay) — kijk of dat visueel hapert vóórdat
je hiervoor kiest.

Bij beide routes: **de vraag zelf mag al vooraf geladen worden** (`04` S07:
"vraag wordt vooraf geladen zodat geen wit moment volgt") — maar
`round:started` (met de vraaginhoud) komt pas ná de countdown-periode
binnen volgens het huidige protocol. Als je dit letterlijk wilt (de vlag al
zichtbaar tijdens het aftellen), is dat een protocolwijziging en dus een
`HANDOFF`-item aan INT-A, geen aanname die je zelf client-side oplost.

## Regels

- Geen eigen telling op clienttijd — reken via `secondsRemaining()` +
  `offsetMs`, exact zoals de bestaande rondetimer.
- Duur is server-bepaald (`countdownEndsAt`); niet zelf een vaste 3 seconden
  aannemen die kan gaan afwijken van wat de server werkelijk stuurt.
- `prefers-reduced-motion`: nu nog geen animatiesysteem (thema 3/5 leveren
  dat pas), dus dit hoeft geen choreografie te hebben — een statische
  tekstwissel per afgerond getal (zie boven) is voldoende en per definitie
  reduced-motion-veilig. Bouw geen aparte animatie die je later weer moet
  intomen.
- Geen blokkerende interactie tijdens de countdown (geen knoppen nodig, maar
  ook niets dat de daaropvolgende vraag vertraagt).

## Definition of done

- Tegen `transport-mock.mjs`: na `Start de game` verschijnt een zichtbare,
  server-gesynchroniseerde aftelling gedurende `COUNTDOWN_MS`, gevolgd door de
  eerste vraag zonder wit scherm ertussen.
- Werkt identiek voor host én speler (`COUNTDOWN` is een roomfase, geen
  hostspecifiek scherm).
- `../PROGRESS.md` bijgewerkt: S07 van niveau 0 naar minimaal 1, met de
  gekozen route (A of B) benoemd in de toelichting.
