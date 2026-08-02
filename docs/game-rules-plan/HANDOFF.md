# HANDOFF — voor andere realisatiesessies

Deze map (`docs/game-rules-plan/`) realiseert
[`docs/multiplayer/GAME-RULES.md`](../multiplayer/GAME-RULES.md) via
`server/rules/`. Dit bestand verzamelt de punten daaruit die **niet** binnen
die scope op te lossen zijn — ze raken `PROTOCOL.md`/`DATA-MODEL.md` of de
state machine. Er is geen directe verbinding tussen deze sessie en die van
`server/protocol/` / `server/architecture/`, dus dit is het enige kanaal:
gevonden via `docs/`, of doorgestuurd door een mens.

## 1. Aan `server/protocol/` (of wie `DATA-MODEL.md`/`PROTOCOL.md` vastlegt) — actie gevraagd

**Status: bevestigd door de producteigenaar op 2 augustus 2026.** De tabel hieronder
is bindend; zie `docs/multiplayer/DECISIONS.md` #15.

`server/rules/validators.js` (GR3, `GAME-RULES.md` §Spelvormen) moet weten
welke vorm `Round.correctAnswer` heeft per spelvorm om een ingestuurd antwoord
te kunnen valideren. `DATA-MODEL.md` toont daarvoor precies één voorbeeld
(`{ choice: "fake" }` voor `real_or_fake_flag`). Voor de andere vier hebben wij
aangenomen dat `correctAnswer` exact de vorm van de client-`answer` spiegelt
(zelfde velden als in `PROTOCOL.md`'s `round:answer`-voorbeelden):

| `gameType` | Voorgestelde `correctAnswer`-vorm |
| --- | --- |
| `flags_mc` | `{ optionId: string }` |
| `capitals_mc` | `{ optionId: string }` |
| `real_or_fake_flag` | `{ choice: "real" \| "fake" }` (bevestigd door jullie voorbeeld) |
| `higher_lower` | `{ side: 0 \| 1 }` |
| `odd_one_out` | `{ cardIndex: number }` |

De bestaande code (`server/rules/validators.js`, 39/39 tests groen) sluit al op
de bevestigde vormen aan; hiervoor is geen extern antwoord meer nodig.

Details: [`prompts/GR3-validators.md`](prompts/GR3-validators.md), ontwerpbeslissing 2.

## 2. Aan `server/architecture/` (of wie de state machine/broadcast-laag bouwt) — beleid, klaar om te implementeren

**Status: besloten door de mens, nog niet geïmplementeerd** (hoort niet in
`server/rules/` thuis — dat blijft een pure module zonder logging/fallback).

Als `server/rules/standings.js`'s `rankPlayers()` een corrupt spelerrecord
tegenkomt (negatieve score, dubbel id, etc.) gooit die een `TypeError`/
`RangeError` — met opzet, dat is een pure functie die nooit stilzwijgend een
foute ranglijst mag teruggeven. De vraag was wat de aanroeper daarmee moet
doen tijdens een live game. Besluit:

- **Fail-soft richting spelers**: vang de fout op, val terug op de laatst
  bekende geldige scoreboard-snapshot. Een game van 50 mensen crasht niet om
  één corrupt record.
- **Fail-loud richting logs/monitoring**: log dit als een harde fout (niet als
  waarschuwing) zodat de onderliggende datacorruptie niet onopgemerkt blijft.

Details: [`prompts/GR2-standings.md`](prompts/GR2-standings.md), sectie
"Nadrukkelijk buiten scope".

## 3. Aan `shared/content/` (locatie bevestigd, `DECISIONS.md` #29) — nog te bouwen

**Status: eigenaar/locatie nu bekend, module bestaat nog niet.** Niet
blokkerend voor GR4 zelf (die test met mocks), wel iets dat vóór een echte
match gebouwd moet zijn.

**3a — Content laden en normaliseren.** `ARCHITECTURE.md` #6 beschrijft één
versieerbare contentmodule die client én server gebruiken voor landen,
hoofdsteden, moeilijkheidsindeling, vertalingen en vraagpools. Die bestaat nog
niet. `server/rules/question-selection.js` (GR4) neemt daarom een
al-genormaliseerde `ContentEntry[]`-pool aan als parameter in plaats van zelf
`data/countries.js`/`data/country-facts.js` te laden — zie
[`prompts/GR4-question-selection.md`](prompts/GR4-question-selection.md),
sectie "Outputcontract", voor het exacte `ContentEntry`-schema dat GR4
verwacht (incl. `name`/`capital` per taal, niet alleen een boolean).

**3b — Echt-of-Nep-renderer is niet seed-deterministisch.** De bestaande
singleplayer-functie `generateFakeParams()` gebruikt zelf `Math.random()` en
kan dus vandaag niet gebruikt worden om alle clients dezelfde specificatie uit
dezelfde seed te laten renderen — een harde eis in `GAME-RULES.md`. GR4
verwacht een geïnjecteerde `generateFlagSpec(seed) => { pattern, palette, ...,
rendererVersion }` (ontwerpbeslissing 2 in `GR4-question-selection.md`) en
test met een mock; de echte, seed-deterministische versie moet nog gebouwd
worden — waarschijnlijk een extractie/herschrijving van de bestaande
singleplayer-logica, niet iets nieuws vanaf nul.

Relevante feiten uit onderzoek van de bestaande data (mogelijk nuttig voor wie
dit bouwt): 230 landen, sleutel `iso2`; vier moeilijkheidsniveaus in de echte
data (`easy/medium/hard/extreme` — `data/README.md`'s schema-tabel is
verouderd en noemt er maar drie); `continent`/`population`/`area`/`gdp` zitten
in `data/country-facts.js`, niet in `data/countries.js`; hoofdstad-coverage is
230/230 volledig.

## 4. Informationeel — geen actie nodig

- **Naammismatch: "normaal" vs. `easy/medium/hard/extreme`.**
  `DECISIONS.md` #35 noemt "moeilijkheid normaal" als default bij Snel
  starten, en `DATA-MODEL.md`'s `GameConfiguration`-voorbeeld gebruikt zelfs
  `"difficulty": "normal"`. De echte content (`data/countries.js`) kent geen
  `"normal"`-niveau — alleen `easy/medium/hard/extreme`. GR4's
  `buildMatchQuestionPlan` accepteert dus geen `"normal"`; wie roomconfig naar
  GR4 vertaalt (vermoedelijk `"normal" → "medium"`) moet die mapping ergens
  vastleggen. Niet door ons opgelost — wij kennen alleen de content-tiers.
- **GR1's deadline-grace-gedrag is extern bevestigd.** `DECISIONS.md` #13
  ("binnen grace kan een antwoord correct zijn, maar krijgt nooit tijdbonus")
  komt exact overeen met `scoreAnswer()`s bestaande gedrag — geen wijziging
  nodig.
- **Competitierangschikking bevestigd.** Gedeelde posities in `rankPlayers()`s
  output volgen `1,1,3,4`, niet `1,1,2,3` — relevant voor wie scoreboard-UI of
  -snapshots bouwt: positienummers kunnen dus gaten vertonen.
- **Moduleformaat wijkt af.** `server/rules/` gebruikt CommonJS (`.js`,
  `module.exports`); `server/protocol/` gebruikt native ES modules (`.mjs`,
  `export`). Werkt nu allebei los prima, maar moet gereconcilieerd worden zodra
  iets dit daadwerkelijk aan elkaar knoopt.
- **Locatie van `server/rules/` is voorlopig**, net als `server/protocol/`
  volgens diens eigen README — beide wachten op een bindend serverskeleton-
  voorstel uit architecture-plan.
