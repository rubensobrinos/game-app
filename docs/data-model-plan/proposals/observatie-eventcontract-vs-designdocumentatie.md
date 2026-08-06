# Observatie — DM8's eventcontract vs. de events genoemd in de designdocumentatie

Aanvulling op [`analytics-event-contract.md`](analytics-event-contract.md),
gevonden tijdens het doornemen van `docs/archief/plandocumentatie/design-documentation/design/`. Zelf
geen nieuw voorstel — een reconciliatie die moet gebeuren zodra DM8 weer
wordt opgepakt voor product-/data-review, niet vóór die tijd.

## De twee lijsten naast elkaar

`docs/archief/plandocumentatie/design-documentation/design/1-schermen-en-flow/03-GAME-FLOW-AND-STATES.md`
§8 ("State-events voor analytics en logging") noemt:

```
room_create_started/succeeded/failed
player_join_started/succeeded/failed
game_started
round_started/closed
answer_submitted/confirmed/failed
reconnect_started/succeeded/failed
game_completed
rematch_started
share_invoked
```

[`analytics-event-contract.md`](analytics-event-contract.md) (DM8) stelt voor:

```
room_created
match_started
player_joined
share_opened
match_finished
round_ended
```

## Wat er niet overeenkomt

1. **Geen falen-tak.** DM8 kent alleen het succespad. De designdocumentatie
   wil `_started`/`_succeeded`/`_failed` voor roomcreatie, joinen en
   antwoordindiening. Dat is een reëel verschil, geen naamgevingsdetail: een
   falen-event vertelt iets anders (waar loopt de flow vast) dan een
   succes-event.
2. **`reconnect_started/succeeded/failed` ontbreekt volledig in DM8.** Geen
   equivalent, ook niet impliciet — DM8's kolomtraceabiliteitsmatrix heeft
   nergens een reconnect-gerelateerde kolom.
3. **`round_started` ontbreekt.** DM8 heeft alleen `round_ended`; er is geen
   startmoment-event voor een ronde.
4. **Naamgeving wijkt af zonder duidelijk semantisch verschil** —
   `game_started`/`game_completed` (design) vs. `match_started`/
   `match_finished` (DM8); vermoedelijk hetzelfde concept, niet geverifieerd.
5. **`rematch_started` is in de designdocumentatie een eigen event**; DM8
   leidt een rematch af uit `match_started.rematchOfMatchId != null` — geen
   apart event. Functioneel gelijkwaardig, structureel anders.

## Wat dit niet is

Geen aanleiding om DM8 nu te herzien. `analytics-event-contract.md` is
expliciet "voorstel, geen runtimecode" in afwachting van product-/data-review
(`REVIEW.md` bevinding 9); deze observatie is input vóór die review, niet een
reden om hem te vervroegen. `ARCHITECTURE.md` §9 ("geen databasewrite in het
kritieke antwoordpad") geldt onverkort voor een eventueel uitgebreide
falen-tak — vooral `answer_submitted/failed` verdient extra aandacht, want dat
ligt het dichtst bij het kritieke pad.

## Voor de volgende DM8-ronde

- Reconciliatie van de twee lijsten tot één eventcontract, met een expliciete
  keuze of falen-events het waard zijn (meer telemetriewaarde vs. meer
  complexiteit op precies het pad dat minimaal moet blijven).
- `reconnect_started/succeeded/failed` alsnog opnemen of expliciet afwijzen
  met reden — niet stilzwijgend weglaten zoals nu het geval is.
- `round_started` toevoegen als het ontbreken ervan een analytics-vraag
  (bijv. "hoe lang staat een vraag gemiddeld open vóór het eerste antwoord")
  onbeantwoordbaar maakt.
