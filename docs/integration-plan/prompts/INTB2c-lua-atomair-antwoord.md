# INTB2c — het Lua-script voor atomaire antwoordverwerking

**Domein:** INT-B. **Blokkade:** INTB2a. **Dit is het moeilijkste losse stuk van
het hele INT-B-domein.**

---

## Prompt

Je implementeert `saveAcceptedAnswerAtomically` als één Redis Lua-script. Hier
wordt score toegekend; een half uitgevoerde operatie is de ernstigste fout die
dit systeem kan maken.

### Lees eerst

- `docs/multiplayer/DECISIONS.md` — **#23** (één Lua-script, conditioneel en
  atomair), **#13** (250 ms grace: binnen grace kan een antwoord correct zijn maar
  krijgt het nooit tijdbonus).
- `docs/multiplayer/DATA-MODEL.md`, sectie **Atomische antwoordverwerking** — de
  tien stappen, in volgorde.
- `server/data/repository.js` — de typedef `AcceptedAnswerWrite`. Let op:
  `updatedPlayer` bevat **absolute** waarden, geen delta. De aanroeper heeft de
  punten al berekend.
- `server/data/answer-flow.js` — de aanroeper.
- `server/data/adapters/data-store-conformance.mjs` en de atomiciteitstests uit
  INTB1b — jouw acceptatiecriterium.
- `server/rules/scoring.js` — voor begrip van wat er ingaat; je herberekent
  **niets**, dat is domeinlogica en niet van jou.

### Wat het script moet doen

In één uitvoering, zonder tussentoestand: sessie en speler valideren, match en
ronde valideren, de deadline controleren, `actionId`-idempotentie controleren,
een bestaand antwoord voor deze speler in deze ronde controleren, het antwoord
schrijven, de speler bijwerken, het sorted scoreboard bijwerken, en de ack
bewaren.

Alles of niets. Er mag geen pad bestaan waarlangs het antwoord is geschreven
maar het scoreboard niet, of waarlangs de ack ontbreekt terwijl de punten al
staan.

### Waar je op moet letten

- **Idempotentie is niet hetzelfde als "al geantwoord".** Dezelfde `actionId`
  opnieuw moet dezelfde ack teruggeven zonder iets te muteren. Een *andere*
  `actionId` van dezelfde speler in dezelfde ronde is een afwijzing. Die twee
  gevallen mogen niet door elkaar lopen.
- **Het script berekent geen punten.** Krijg je de neiging in Lua iets over
  correctheid of bonus te beslissen, dan zit je in domeinlogica die van GR is.
  Stop en meld het.
- **KEYS en ARGV netjes scheiden.** Alle sleutels via `KEYS`, zodat het script in
  een geclusterde opstelling niet stukloopt. Bouw geen sleutelnamen in Lua.
- **Het script wordt geladen en via zijn hash aangeroepen**, met een terugval op
  volledig laden als Redis het script niet kent (na een herstart).
- **Geen `TIME` in het script.** Tijd komt als argument binnen, net als overal
  elders in deze codebase — anders is het gedrag niet deterministisch testbaar.

### Klaar wanneer

De atomiciteitstests uit INTB1b draaien ongewijzigd groen tegen deze adapter,
inclusief het interleaving-scenario. Dat scenario bewees tegen de in-memory fake
weinig; tegen echte Redis bewijst het alles. Draai het meerdere keren en met
meer gelijktijdige aanroepen dan de fake ooit kreeg.

Voeg daarnaast een test toe die niet in INTB1b past omdat hij Redis-specifiek is:
twee processen (of twee clients) die tegelijk hetzelfde antwoord aanbieden. Één
wint, één wordt afgewezen, en de score is precies één keer toegekend.

### Opleveren

Pad van het script en de wrapper, hoe je idempotentie en "al geantwoord"
onderscheidt, hoe het script wordt geladen en wat er gebeurt na een Redis-restart,
het resultaat van de atomiciteitstests, en het resultaat van de
concurrency-test met het aantal gelijktijdige aanroepen dat je hebt gedraaid.
