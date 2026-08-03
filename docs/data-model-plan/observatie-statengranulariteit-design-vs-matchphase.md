# Observatie — statengranulariteit: designdocumentatie vs `Match.phase`

**Van:** DM-agent, tijdens het doornemen van `docs/design-documentation/`.
**Aan:** AR (eigenaar `state-machine.js`/de fasewaarden) en GF (eigenaar
game-flow-tijdlijn/substaten).
**Status:** signaal, geen voorstel met een uitgewerkte oplossing — de vraag
is voor AR/GF, niet iets wat ik zelf kan of moet beslissen.

## Wat er is gevonden

`docs/design-documentation/design/1-schermen-en-flow/03-GAME-FLOW-AND-STATES.md`
§3 ("Global state model") noemt zeventien UI-states:

```
LANDING, ROOM_CREATING, HOST_LOBBY, NAME_ENTRY, PLAYER_LOBBY, COUNTDOWN,
QUESTION_ACTIVE, ANSWER_SUBMITTING, ANSWER_CONFIRMED, ROUND_CLOSED, REVEAL,
SOCIAL_HIGHLIGHT, LEADERBOARD, PAUSED, PODIUM, RECONNECTING, GAME_ENDED
```

`server/data/types/match.js`'s `Match.phase` (en de bijbehorende
`Room.phase`-projectie, besluit 30) kent er zeven:

```
LOBBY, COUNTDOWN, ROUND_ACTIVE, ROUND_RESULT, SCOREBOARD, PAUSED, FINISHED
```

## Waar het overduidelijk klopt of niet raakt

- `COUNTDOWN`, `PAUSED` — 1-op-1.
- `LANDING`, `ROOM_CREATING`, `NAME_ENTRY`, `ANSWER_SUBMITTING`,
  `ANSWER_CONFIRMED`, `RECONNECTING` — client-/sessiegebonden transiënte UI-
  states, geen `Match.phase`-kandidaten. Deze horen sowieso niet in het
  serverfasemodel: `ANSWER_SUBMITTING`/`ANSWER_CONFIRMED` zijn bijvoorbeeld
  per-speler-UI-status tijdens `QUESTION_ACTIVE`/`ROUND_ACTIVE`, geen
  aparte matchfase.
- `HOST_LOBBY`/`PLAYER_LOBBY` → `LOBBY`. `QUESTION_ACTIVE` → `ROUND_ACTIVE`.
  `GAME_ENDED` → `FINISHED`. `PODIUM` → waarschijnlijk `FINISHED`
  (podium is een presentatiemoment ná afloop, geen aparte serverfase — maar
  zie hieronder).

## De echte vraag

Drie ontwerp-states (`ROUND_CLOSED`, `REVEAL`, `SOCIAL_HIGHLIGHT`) vallen
allemaal binnen wat vandaag simpelweg `ROUND_RESULT` heet, en `LEADERBOARD`
valt binnen `SCOREBOARD`. Twee routes zijn allebei verdedigbaar, en dat is
precies waarom dit geen eenzijdige DM-beslissing is:

1. **Client-side substaten.** `Match.phase` blijft `ROUND_RESULT`; de timing
   van "eerst het correcte antwoord, dan de sociale headline" is een
   client-/composition-detail (`GAME-FLOW.md`'s tijdlijn), niet iets wat de
   server per stap hoeft te weten. Kleinste ingreep, geen schemawijziging.
2. **Eigen fasewaarden.** `ROUND_CLOSED`/`REVEAL`/`SOCIAL_HIGHLIGHT` worden
   afzonderlijke `Match.phase`-waarden, zodat de server (en dus reconnect,
   analytics, en de state machine zelf) exact weet in welke sub-stap een
   match zit. Grotere ingreep: raakt `types/match.js`/`types/room.js`'s
   `ROOM_PHASE_VALUES`/`MATCH_PHASE_VALUES`, `state-machine.js`, en alle
   transitielogica die op deze waarden let (inclusief DM19's net gebouwde
   `setRoomAndMatchPhaseAtomically`, die zelf geen aanpassing zou nodig
   hebben — de enum-lijst verandert dan wel).

Losstaand: verdient `PODIUM` een eigen fasewaarde naast `FINISHED`, of is het
altijd een clientgestuurde weergave ná `FINISHED`? Dezelfde soort vraag.

## Wat ik vraag

Geen actie van mij totdat AR/GF een richting kiezen. Als richting 2 wordt
gekozen, is dat een `database_schema`/`architecture`-vraag (devkit-policy) en
dus sowieso `always_ask` — niet iets wat ik zelfstandig zou doorvoeren, ook
niet als DM-agent met schrijfrecht op `types/match.js`.
