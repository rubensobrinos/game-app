# Bugrapport — `round:progress` verliest de definitieve "iedereen heeft geantwoord"-update

**Van:** deployment-and-testing-plan (gevonden tijdens DT5, de eerste
uitvoering van de L0-loadtestrun tegen de lokale stack, 2026-08-02).
**Voor:** de eigenaar van `server/transport/socket.mjs` (`maybeEmitRoundProgress`)
— de throttle-beslisfunctie zelf (`server/protocol/throttle-round-progress.mjs`)
is een pure, correct geïmplementeerde functie die precies doet wat haar eigen
contract belooft; de bug zit in hoe de aanroeper met een `allow: false`-
beslissing omgaat, niet in de throttle-functie zelf.
**Ernst:** middelhoog — geen dataverlies en geen kapotte match (score/uitslag
kloppen; `round:ended` komt gewoon), maar het **enige realtime-signaal** dat
een host-UI of monitoring kan gebruiken om "iedereen heeft geantwoord" te
detecteren vóórdat de rondedeadline verloopt, mist structureel precies in het
scenario waar dat signaal het meest waardevol zou zijn: een antwoordpiek.
Relevant voor `load-evidence-matrix.md` rij 5 ("antwoordpieken van 100
spelers binnen twee seconden verwerkt") — zie "Wat dit concreet blokkeert".

## Reproductie

Gevonden met [`tests/load/l1-event-latency-and-answer-peak.js`](../../tests/load/l1-event-latency-and-answer-peak.js)
(DT5), tegen een lokaal gestarte server (`node server/index.mjs`), 1 room, 3
en 20 spelers, meerdere runs:

```bash
node server/index.mjs &
k6 run --env BASE_URL=http://127.0.0.1:3900 --env PLAYERS=3 \
  tests/load/l1-event-latency-and-answer-peak.js
```

Met debug-logging op elk binnenkomend event (tijdelijk toegevoegd, niet
gecommit) is het volledige verloop van één ronde met 3 spelers zichtbaar:

```
round:progress answered=1 eligible=3   (t+0ms)
round:progress answered=2 eligible=3   (t+~3ms)
# … geen enkele volgende round:progress meer voor deze ronde …
round:ended                            (t+~15000ms, op de normale deadline)
```

De derde, volledige update (`answered=3 eligible=3`) **komt nooit**, ook niet
als er ruim gewacht wordt tot de rondedeadline. Geverifieerd met 3 spelers
(reproduceerbaar, 2×) en met 20 spelers (reproduceerbaar, 2×, zie
`round_progress_full_broadcast_latency_ms` in de k6-output van beide runs: 0
samples — de metric die specifiek de volle update meet, bleef in alle vier
runs leeg).

## Root cause

`server/protocol/throttle-round-progress.mjs`'s `throttleRoundProgress()` is
een pure beslisfunctie: maximaal 2 emissies per rollend venster van 1000 ms
per `roundId`, en dat doet hij correct — dit is precies wat PROTOCOL.md eist
("`round:progress` wordt maximaal tweemaal per seconde gebroadcast").

Het probleem zit in de aanroeper, `server/transport/socket.mjs`'s
`maybeEmitRoundProgress()` (regel 597–610):

```js
async function maybeEmitRoundProgress(roomId, round) {
  const now = context.now();
  const decision = throttleRoundProgress(throttleStore, round.roundId, now);
  if (!decision.allow) {
    return false;   // <-- de update wordt hier stilletjes weggegooid
  }
  throttleRecordsByRound.set(round.roundId, decision.record);
  const runtime = runtimeFor(roomId);
  const eligible = await eligiblePlayerCount(roomId, round.roundNumber);
  emitToRoom(roomId, 'round:progress', {
    answeredCount: Math.min(runtime.answeredPlayerIds.size, eligible),
    eligiblePlayerCount: eligible,
  });
  return true;
}
```

Deze functie wordt precies één keer per `round:answer` aangeroepen (regel
960, in de `after`-hook van de answer-handler), fire-and-forget. Als een
derde (of latere) speler binnen hetzelfde 1s-venster antwoordt nadat de
throttle al twee keer heeft gevuurd, wordt er voor dát antwoord **geen enkele
nieuwe poging** ondernomen: geen retry, geen "trailing" emissie zodra het
venster weer ruimte heeft, geen laatste her-check bij `round:ended`. De eerst
volgende gelegenheid om de *actuele* telling te zien is dus letterlijk
`round:ended` — een heel ander event, met een heel andere payloadvorm, geen
`round:progress` meer.

Dit is het klassieke throttle-zonder-trailing-edge-patroon: een throttle die
alleen "leading" emissies toestaat en de laatste, ná het venster genegeerde
aanroep nooit alsnog verstuurt. Precies dát ontbrekende trailing-gedrag is
hier de bug — niet de 2×/seconde-limiet zelf.

## Wat dit concreet blokkeert

- Elke host-UI (of ander realtime dashboard) die "N van M heeft geantwoord"
  wil tonen, blijft na twee snelle antwoorden potentieel voor de rest van de
  ronde op een verouderd getal staan (bijv. "2 van 20") totdat de ronde
  vanzelf eindigt — ook als in werkelijkheid allang alle 20 hebben
  geantwoord.
- `load-evidence-matrix.md` rij 5 ("antwoordpieken binnen twee seconden
  verwerkt") kan niet via `round:progress` bewezen worden zodra de piek zelf
  binnen het throttlevenster valt — en dat is per definitie precies wat een
  "piek" betekent. De onderliggende *verwerking* zelf is overigens wél
  aantoonbaar snel (elke individuele `round:answer`-ack kwam in de L0-run
  binnen enkele milliseconden terug, zie `answer_ack_latency_ms` in
  `e2e-load-target-check.md`) — het is specifiek het *room-brede
  voortgangssignaal* dat ontbreekt, niet de antwoordverwerking zelf.

## Wat ik niet heb gedaan

Niet gefixt — `server/transport/socket.mjs` is niet mijn module. Een voor de
hand liggende richting (niet hier gekozen, ontwerpkeuze voor de
contracteigenaar): bij een `allow: false`-beslissing een trailing-timer
zetten die, zodra het venster vrijkomt, alsnog éénmalig de dan-actuele
telling verstuurt — met een extra check of de telling sindsdien is veranderd,
zodat een ronde zonder verdere antwoorden na de laatste toegestane emissie
geen overbodige extra broadcast krijgt.

## Wat ik wél heb gedaan

`tests/load/l1-event-latency-and-answer-peak.js` vertrouwde in zijn eerste
versie op de volle `round:progress`-update om de match vroegtijdig af te
ronden (`game:finish` zodra `answeredCount === eligiblePlayerCount`) — dat
liep hierdoor structureel vast op de eigen `HARD_TIMEOUT_MS`. Aangepast om in
plaats daarvan op `round:ended` te wachten (dat komt altijd, op de normale
deadline); de volle `round:progress`-meting blijft wel in het script staan
(`round_progress_full_broadcast_latency_ms`) om deze bug in elke toekomstige
run zichtbaar te houden in plaats van hem stilletjes te omzeilen.
