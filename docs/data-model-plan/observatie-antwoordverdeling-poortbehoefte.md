# Observatie — antwoordverdeling: ontbrekende poortcapaciteit, nog geen aanroeper

**Van:** DM-agent, tijdens het doornemen van `docs/design-documentation/`.
**Aan:** PR (protocol-plan, wire-contract voor `round:ended`/reveal), cc
INT-A (compositielaag).
**Status:** signaal + geschetste richting, NIET gebouwd — er is nog geen
bevestigde aanroeper, en deze sessie bouwt niet vooruit op een vermoeden
(zelfde discipline als DM9's reconciliatiepatroon: geen projectie zonder
echte consument).

## Wat er is gevonden

"Antwoordverdeling" (hoeveel spelers per gekozen optie) komt niet één keer
maar in drie documenten terug als een reëel, niet-vrijblijvend UI-element:

- `04-SCREEN-SPECIFICATIONS.md`: "Host/podium: kan antwoordverdeling als
  staafdiagram tonen."
- `02-DESIGN-PRINCIPLES.md`: genoemd als onderdeel van de reveal-principes.
- `07-RESPONSIVE-HOST-PLAYER-MODES.md`: "antwoordverdeling en sociale
  headline centraal" (host/podiumweergave).

## De poortkant

De `DataStore`-poort heeft geen methode om alle antwoorden van één ronde op
te vragen of te aggregeren. `loadAnswer(roomId, matchId, roundId, playerId)`
is per-speler; er is geen `listAnswersForRound`/`getAnswerDistribution`. Om
dit UI-element te bouwen heeft de compositielaag straks een nieuwe leesweg
nodig — die vandaag niet bestaat.

## Geschetste richting (voor als het zover is, geen voorstel om nu te bouwen)

```js
getAnswerDistribution(roomId, matchId, roundId) → Promise<Record<string, number>>
```

Twee dingen die deze richting nu al lastiger maken dan hij lijkt, dus vast
benoemd:

1. **Geen uniforme sleutel over gameTypes heen.** `flags_mc`/`capitals_mc`
   antwoorden dragen `optionId`; `real_or_fake_flag` draagt `choice`;
   `higher_lower` draagt `side` (0|1); `odd_one_out` draagt `cardIndex`. Een
   distributie-teller moet dus per `gameType` weten welk veld van `Answer.answer`
   de "welke optie"-sleutel is — dezelfde soort vormverschil dat
   `answer-flow.js`'s `buildRoundContext()` al per gameType oplost, niet een
   nieuw probleem maar wel iets dat deze methode moet overnemen.
2. **Aggregeren tijdens reveal, niet bijhouden tijdens het antwoordpad.**
   Een lopende teller bijwerken in `saveAcceptedAnswerAtomically` zou een
   extra write op het kritieke antwoordpad toevoegen — precies wat
   `ARCHITECTURE.md` principe 9 verbiedt (dezelfde reden waarom INTB-1
   richting 3 destijds is afgewezen). Eén keer alle `Answer`-documenten van de
   ronde lezen op het moment van reveal is de kostbaardere maar principieel
   juiste route.

## Wat ik vraag

Geen actie van mij nu. Als PR/INT-A dit daadwerkelijk gaan bouwen (het staat
niet in `10-IMPLEMENTATION-ROADMAP.md`'s vroege fases, dus vermoedelijk niet
acuut), hoor ik graag de exacte vorm die de reveal-payload nodig heeft, en
ontwerp ik de poortmethode daarop — niet andersom.
