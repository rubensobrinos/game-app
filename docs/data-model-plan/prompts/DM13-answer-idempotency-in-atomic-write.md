# Prompt — DM13: Idempotentie en "één antwoord per ronde" ín de atomaire schrijfactie

Onderdeel van [`docs/data-model-plan/README.md`](../README.md), fase DM13.
Afhankelijk van DM6 (`saveAcceptedAnswerAtomically`), DM7 (`answer-flow.js`).
Reactie op
[`docs/integration-plan/HANDOFF-INTB.md`](../../integration-plan/HANDOFF-INTB.md),
INTB-4 — ontdekt tijdens de bouw van DM10–DM12 via INT-B's conformance-suite
(`server/data/adapters/data-store-conformance.mjs`), die drie tests bevat die
bewust rood staan tot deze fase is uitgevoerd. Deze prompt is tegen die
testbodies gevalideerd (gelezen, niet aangenomen) — de gekozen contractvorm
hieronder is dus geen eigen verzinsel maar een bevestigde match met wat INT-B
al aanroept.

## Wat er ontbreekt

`saveAcceptedAnswerAtomically` in `server/data/in-memory-store.js` controleert
niet of er al een antwoord voor deze speler in deze ronde bestaat, en niet of
de `actionId` al in de action-cache staat — hij overschrijft domweg beide.

`answer-flow.js`'s `resolveAnswer` doet zulke controles al (stap 1:
idempotentie, stap 5: al beantwoord) — maar op context (`ctx.existingAnswerForRound`,
`ctx.existingActionCacheEntry`) die de aanroeper **vóór** de aanroep heeft
ingelezen. Tussen dat inlezen en de daadwerkelijke schrijfactie past een
tweede, gelijktijdige aanroep die dezelfde, inmiddels-verouderde context ziet
en dus ook denkt dat hij mag schrijven. Dat is dezelfde klasse fout als
INT-1/INTB-2 (check-then-act): de enige plek waar check en write gegarandeerd
samenvallen is de atomaire opslagoperatie zelf. `DATA-MODEL.md` plaatst beide
controles (stappen 4 en 5 van de tien) daarom expliciet ín die operatie, niet
ervóór.

## Beslissing: contract, geverifieerd tegen INT-B's eigen tests

`saveAcceptedAnswerAtomically(roomId, matchId, write)` — **signatuur en
returntype blijven `Promise<void>`, geen breaking change** daarin. Alleen het
interne gedrag en het foutcontract veranderen:

1. **Onbekende `playerId`** → werpt `RangeError` (ongewijzigd, bestaand gedrag).
2. **`write.actionCacheEntry.actionId` staat al in de action-cache van deze
   room** → **replay**: de aanroep **resolvet** (géén throw, géén mutatie van
   `Answer`/`Player`/scoreboard/action-cache — helemaal niets verandert).
   Gecontroleerd vóór de playerId-check (zie hieronder waarom).
3. **Anders, en er bestaat al een `Answer` voor deze `roundId` + `playerId`**
   (een ANDERE `actionId` dus — de idempotentiecontrole hierboven ving de
   exact-dezelfde-actionId-situatie al af) → **afgewezen**: werpt een
   `RangeError` met een `.code = 'ALREADY_ANSWERED'`-property (dezelfde
   codestring als `resolveAnswer`'s eigen `ALREADY_ANSWERED`-returncode —
   zodat een aanroeper met één `catch`-tak dezelfde protocolrespons kan geven
   ongeacht of `resolveAnswer` óf de atomaire operatie het gat ving). Geen van
   de vier writes landt.
4. **Anders**: ongewijzigd — `Answer` + absolute `Player`-waarden + scoreboard
   + action-cache-entry, alle vier of geen van vieren, zoals vandaag.

**Volgorde: idempotentie (2) vóór de playerId-check, en vóór "al beantwoord"
(3).** Zelfde principe als `answer-flow.js` al toepast
(`REVIEW-DM2-DM9.md` bevinding 1: "idempotentie... EERST... anders krijgt een
retry... niet dezelfde ack als de oorspronkelijke, geslaagde aanroep") — een
replay van een eerder geslaagde actie moet hetzelfde resultaat geven, ook als
er ondertussen iets anders in de room is veranderd.

**Geen ack in de returnwaarde van de replay — bewust, en bevestigd door
INT-B's eigen tests.** Hun `doesNotReject`-assertie op de replay-tak checkt
alleen dát de aanroep resolvet, niet wát hij teruggeeft. Een aanroeper die in
het (zeldzame) race-scenario de daadwerkelijk-bewaarde `ack` nodig heeft —
niet zijn eigen, mogelijk-verouderde berekening — gebruikt de al-bestaande
`loadActionCacheEntry(roomId, actionId)`. Geen dubbele leesweg toevoegen aan
een write-methode.

**Relatie met `answer-flow.js`/DM7 — geen codewijziging, wel een
verduidelijking.** `resolveAnswer`'s eigen stap 1/stap 5-controles blijven
ongewijzigd bestaan: ze zijn een legitiem snelpad (voorkomt onnodige
validatie/score-berekening als de aanroeper toch al weet dat dit een replay
of een duplicaat is), maar zijn **niet langer de bron van waarheid** — dat is
nu de atomaire operatie. Praktisch gevolg voor een aanroeper (compositielaag,
buiten deze scope): zelfs als `resolveAnswer` `{ok:true, replay:false, write}`
teruggeeft, moet de aanroeper een `ALREADY_ANSWERED`-worp van
`saveAcceptedAnswerAtomically` alsnog afvangen en vertalen naar exact dezelfde
protocolrespons als `resolveAnswer`'s eigen `ALREADY_ANSWERED`-pad — dat is
precies het race-scenario dat deze fase dichtzet.

## Stappen

### 1. `server/data/in-memory-store.js`

`saveAcceptedAnswerAtomically`: twee nieuwe guards vóór de bestaande writes,
in de volgorde uit de Beslissing hierboven (idempotentie eerst, dan pas de
al-bestaande playerId-check, dan pas "al beantwoord"). Geen wijziging aan de
vier bestaande writes zelf.

### 2. `server/data/repository.js`

JSDoc bij `saveAcceptedAnswerAtomically`/`AcceptedAnswerWrite` uitbreiden met
het foutcontract (replay → resolve zonder mutatie; tweede actionId voor een
al-beantwoorde ronde → `RangeError` met `.code = 'ALREADY_ANSWERED'`). Geen
signatuurwijziging.

### 3. `server/data/answer-flow.js`

Geen logicawijziging. Eén commentaarregel bij `resolveAnswer`'s stap 1/stap 5
die verwijst naar deze fase: deze controles zijn een snelpad, de atomaire
operatie is de bron van waarheid onder gelijktijdigheid.

### 4. Tests (`repository.test.js`)

- **#39** dezelfde `actionId` een tweede keer (met een andere, hogere score in
  de write) → resolvet zonder te muteren: `Player`-score/`correctCount`/
  `correctResponseTimeMsTotal`, het bewaarde `Answer` en de action-cache-entry
  blijven exact die van de EERSTE, geslaagde aanroep;
- **#40** een tweede, ANDERE `actionId` voor dezelfde speler in dezelfde ronde
  → werpt `RangeError` met `err.code === 'ALREADY_ANSWERED'`; geen van de vier
  onderdelen van de afgewezen inzending landt (de eerste blijft ongewijzigd
  staan);
- **#41** dezelfde speler in twee VERSCHILLENDE rondes → allebei geaccepteerd,
  scores tellen op (regressiebewijs: deze fase mag legitieme opeenvolgende
  rondes niet blokkeren);
- **#42** het volledige scenario in één test — retry (replay), een afgewezen
  tweede inzending in dezelfde ronde, en daarna een geldige volgende ronde —
  eindscore is precies de som van de twee legitieme rondes, niet meer en niet
  minder (rechtstreeks ontleend aan INT-B's eigen `INTB-4`-scenario in
  `server/data/adapters/data-store-conformance.mjs`, ter bevestiging dat de
  twee implementaties tot dezelfde uitkomst komen);
- **#43** idempotentie gaat vóór de playerId-check: een replay van een
  `actionId` die al in de action-cache staat resolvet ook als de betrokken
  `playerId` op dit moment niet (meer) bestaat (bewijst de gekozen volgorde,
  niet toevallig gedrag).

## Harde grenzen

- Geen wijziging aan de signatuur of het returntype van
  `saveAcceptedAnswerAtomically` — blijft `Promise<void>`.
- Geen ack in de replay-returnwaarde — een aanroeper die hem nodig heeft
  gebruikt `loadActionCacheEntry`.
- Geen logicawijziging aan `answer-flow.js`, alleen een verwijzende
  commentaarregel.
- Geen nieuwe dependency, geen nieuwe Errorklasse — een `RangeError` met een
  `.code`-property, zelfde stijl als de bestaande `GameCodeExhaustedError` in
  `server/architecture/room-codes.js` maar zonder een aparte klasse (er is
  hier maar één variant, geen taxonomie).
- 3 bestanden gewijzigd (`in-memory-store.js`, `repository.js`,
  `answer-flow.js`) + 1 testbestand.

## Definition of done

- `saveAcceptedAnswerAtomically` controleert idempotentie vóór de playerId-
  check, en "al beantwoord" daarna — beide binnen dezelfde atomaire stap, vóór
  enige write.
- De vijf nieuwe tests (#39–43) slagen, inclusief het end-to-end-scenario dat
  rechtstreeks overeenkomt met INT-B's eigen `INTB-4`-tests.
- `node --test 'server/data/**/*.test.js'` slaagt (472 → 477 tests groen
  verwacht).
- **Niet mijn bestand om te wijzigen, wel te verifiëren:** na deze fase horen
  INT-B's drie `INTB-4`-tests in `server/data/adapters/
  data-store-conformance.mjs` van rood naar groen te gaan zonder dat hun
  testbodies veranderen — dat is de eigenlijke acceptatietoets van deze fase.
  Als dat niet zo is, klopt de implementatie niet met wat hierboven is
  afgesproken.
- [`HANDOFF.md`](../HANDOFF.md) krijgt een regel: INTB-4 beantwoord, met de
  expliciete waarschuwing aan de compositielaag dat een `ALREADY_ANSWERED`-worp
  van de atomaire operatie nu ook ná een `resolveAnswer`-`ok:true` kan
  optreden (het race-scenario) en naar dezelfde protocolrespons vertaald moet
  worden.
