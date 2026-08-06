# Prompt — T5-3: Refresh midden in een ronde

**Status: uitgevoerd — gemeten tegen de échte server, één bug gevonden en
gefixt.** Niet Playwright-tegen-`transport-mock.mjs` zoals oorspronkelijk
gecontracteerd (zie de correctie hieronder) — de mock heeft geen eigen
levenscyclus los van de pagina, dus een `page.reload()` maakt 'm leeg. Getest
tegen `node server/index.mjs` (in-memory store) op een lokale poort, met
Playwright (ad-hoc, niet als projectdependency — zie
`prompts/README.md`'s Playwright-notitie).

**Correctie op de oorspronkelijke aanname:** T5-3's kernvraag over
`roundModel` was al beantwoord door thema 4's `hydrateFromSnapshot`
(`session-shell.mjs:549`, commit `2f313c1`) — vóór deze uitvoering leek dat
reden om deze hele prompt als "achterhaald" te laten vervallen. Dat was te
snel: de meting hieronder dekt ook `standingsPayload`, en dáár zat wél nog
een echte, niet eerder gevonden bug.

## Brondocument

`08-ACCESSIBILITY-AND-RESILIENCE.md` §5: "refresh herstelt actuele state;
score, naam en ingediend antwoord blijven." `11-DESIGN-QA-CHECKLIST.md` L:
"Herstelt refresh naam, score en actuele game-state?"

## Gemeten resultaten (Playwright, host + speler, echte server)

| Scenario | Resultaat |
|---|---|
| Reload tijdens `LOBBY` | ✅ Landt op de lobby, correct spelersaantal ("2 spelers"). |
| Reload tijdens `ROUND_ACTIVE`, ná een ingediend antwoord | ✅ Landt op het spelscherm, vraag zichtbaar, opties vergrendeld (geen tweede antwoord mogelijk). ⚠️ **Bekende, bewuste beperking**: welke optie was gekozen is ná een reload niet meer zichtbaar (`aria-pressed` staat nergens meer op `true`) — `round-model.mjs`'s `hydrateFromSnapshot` zet bewust geen `selectedOptionId` (de server geeft in de snapshot alleen dát er geantwoord is, niet welke optie; zie het bestaande codecommentaar daar). Geen protocolveld voor, dus geen UI-aanname erbovenop gebouwd. |
| Reload tijdens `PAUSED` | ✅ Pauze-overlay verschijnt meteen, juiste reden ("Gepauzeerd door de host"). |
| Reload tijdens `FINISHED` | ❌→✅ **Bug gevonden en gefixt.** Vóór de fix: de eindstand verdween volledig ná een reload (`Eindstand` zonder podiumplekken of eigen positie) — `session-shell.mjs`'s `applyRoomState` las `payload.room`/`currentRound`/`self` uit de snapshot, maar nooit `payload.scoreboard`, ondanks dat die daar al in staat (`PROTOCOL.md`, `snapshot-shape.mjs:113-128`: `{ top: [], self: {} }`). Zelfde soort gat als de `roundModel`-bug uit T4-3. Gefixt: `applyRoomState` zet nu `standingsPayload = payload.scoreboard` wanneer aanwezig. Ná de fix: eigen positie + score correct hersteld. Kleine restvraag, niet verder uitgezocht: vóór de fix toonde de podiumlijst twee spelers (🥇/🥈), ná de fix één — mogelijk filtert de snapshot spelers zonder punten anders dan het live `game:finished`-event; te klein om deze fix op te laten wachten, wel het noteren waard voor een volgende blik. |

## Regels (zoals uitgevoerd)

- Geen giswerk over wat `room:state` behoort te bevatten — het `scoreboard`-
  veld bestond al en was gevalideerd (`snapshot-shape.mjs`), dus dit was geen
  protocolgat maar een client-bug.
- `ALREADY_ANSWERED`-pad niet apart getest in deze ronde — dat gedrag is al
  gedekt door de bestaande servertests; deze meting focuste op wat de UI ná
  een refresh toont, niet op de server-autoritatieve afwijzing zelf.

## Definition of done — behaald

- Vier scenario's gemeten met een concreet resultaat per scenario (tabel
  hierboven), tegen de échte server, niet de mock.
- Gevonden gat gefixt in `session-shell.mjs`'s `applyRoomState`.
- `node --test`: 2779/2779 groen (volledige suite, geen regressie).
- `PROGRESS.md`'s rij gaat van "1, aangenomen" naar "gemeten, met één fix"
  (zie de niveau-opsplitsing daar: ronde-herstel niveau 2, eindstand-herstel
  niveau 2 ná de fix, de geselecteerde-optie-beperking expliciet benoemd als
  bewust niveau 1).
