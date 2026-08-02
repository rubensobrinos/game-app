# Prompt — UI3: Spelscherm flags_mc

Onderdeel van [`../README.md`](../README.md), fase UI3. Vereist UI0–UI2. Bouwt
scherm 4 van UI1a — **alleen `flags_mc`**, de overige Golf 1-spelvormen komen
in UI1b zodra de keten ze aankan.

## Brondocument

`GAME-FLOW.md` §Spelscherm (het volledige lijstje van wat een speler ziet).
`PROTOCOL.md` §`round:started` → `flags_mc` (exacte payloadvorm),
`round:answer`, `round:progress`, `round:ended`. `GAME-RULES.md` §Vlaggen Quiz.

## Faseovergangen

`match-phase-state.applyServerEvent` levert de fase; dit scherm toont zich bij
`COUNTDOWN`/`ROUND_ACTIVE`/`ROUND_RESULT` (zie `viewFor()` uit UI0). Elke
binnenkomende `round:started`/`round:ended` gaat éérst door die reducer, dan
pas naar dit scherm se eigen (lokale, niet-gedeelde) rondedata-state — die
data hoort hier, niet in `match-phase-state` (dat bewaart bewust geen
rondedata).

## `round:started` → vraag tonen

Payload voor `flags_mc` (exact, niet verzinnen):

```json
{
  "gameType": "flags_mc",
  "question": { "targetIso2": "FR", "optionIso2s": ["FR", "DE", "IT", "ES"] },
  "startsAt": 1785623412000,
  "endsAt": 1785623427000
}
```

- Vlag: `flags/{targetIso2}.png` (bestaande assets, geen nieuwe genereren).
- Vier opties: landnaam per `optionIso2s`-waarde, opgezocht via
  `shared/content.getCountryPool()` in de roomtaal (NL leidend in UI1a).
  **Nooit** de juiste optie afleidbaar maken uit volgorde/styling — toon de
  vier opties in de volgorde die de payload al geeft.
- Timer: `secondsRemaining(startsAt, endsAt, offsetMs)` (UI0), herberekend bij
  elke render — geen eigen aftelteller die op zichzelf doortikt.

## Antwoord versturen

Bij een tik op een optie: verstuur `round:answer` met
`{ roundId, answer: { optionId: <gekozen iso2> }, clientAnsweredAt: Date.now() }`
via de socket (`transport.connect(...).send(...)`), met een verse `actionId`
per verzending. Vergrendel de andere opties direct na de tik (één antwoord per
ronde, `PROTOCOL.md`) en toon een "ontvangen"-status — **nooit** goed/fout vóór
`round:ended`, ook niet als de speler zelf al "weet" dat het antwoord fout was.

## Voortgang en uitslag

- `round:progress` (`{ answeredCount, eligiblePlayerCount }`, max. 2×/seconde
  volgens `PROTOCOL.md`) → toon als "x van y hebben geantwoord", zonder namen.
- `round:ended` → toon het juiste land (via `correctAnswer.optionId`, dezelfde
  iso2 → naam-opzoek als hierboven), of het eigen antwoord goed/fout was, en de
  eigen behaalde punten uit de payload. Verberg de timer en de opties.

## Regels

- Geen enkele state hier verhuist naar `match-phase-state` — dat blijft puur
  fase + `matchId` + `pausedState`. Rondedata (vraag, opties, voortgang,
  uitslag) is dit scherm se eigen, lokale verantwoordelijkheid.
- Geen eigen antwoordvalidatie of -correctheid berekenen — de server is
  autoritair; dit scherm toont alleen wat binnenkomt.
- Nooit `innerHTML` voor content die uit de payload komt.

## Definition of done

- Tegen `transport-mock.mjs` (met een vaste `flags_mc`-reeks, UI0): een volledige
  ronde — vraag, timer loopt zichtbaar af zonder te haperen, antwoord
  vergrendelt de opties, voortgang werkt, uitslag toont het juiste land en
  eigen punten.
- Getest met een vertraagde/trage tik (antwoord vlak vóór `endsAt`) zonder dat
  de UI vastloopt of een dubbel antwoord verstuurt.
- `UI-PROGRESS.md` bijgewerkt.
