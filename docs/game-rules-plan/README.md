# Realisatieplan — GAME-RULES.md

Dit is het uitvoeringsplan voor het onderdeel waar ik verantwoordelijkheid voor heb
genomen: [`docs/multiplayer/GAME-RULES.md`](../multiplayer/GAME-RULES.md). Dit
document zelf verandert niets aan de specificatie — het beschrijft hoe ik die
specificatie omzet in geteste code, in welke volgorde, en waar ik moet stoppen om
goedkeuring te vragen.

Zie ook de bredere context in [`docs/multiplayer/README.md`](../multiplayer/README.md)
en de rolverdeling per document daarin.

## Uitgangspunten

1. **Pure logica, geen transport of opslag.** De module kent geen Redis, geen
   sockets, geen REST en geen timers. Ze krijgt platte data binnen (config, round,
   answer, player) en geeft platte data terug (score, validatie, selectie,
   volgorde). Dat is een bewuste grens: `PROTOCOL.md` (`public_api`) en
   `DATA-MODEL.md` (`database_schema`) zijn ADR-plichtig volgens
   `devkit policy --json` en zijn niet mijn beslissingsterrein — ik consumeer straks
   hun vormen, ik bepaal ze niet.
2. **Geen nieuwe dependencies om te beginnen.** De rest van deze repo draait zonder
   build-stap en zonder dependencies. Zolang de logica pure JavaScript-functies
   zijn, kan ik testen met Node's ingebouwde `node:test` + `node:assert` —
   nul nieuwe packages, dus geen `deps`-goedkeuring nodig. `ARCHITECTURE.md` noemt
   uiteindelijk Node.js 22 + TypeScript + Fastify + Socket.IO voor de game-server;
   die keuze staat al vast in de spec, maar het daadwerkelijk toevoegen van die
   dependencies aan een `package.json` blijft `always_ask` (CLAUDE.md, AGENTS.md).
   Ik vraag dat expliciet na bij de eerste stap die het nodig heeft (zie Fasering).
3. **Autonomie-limieten blijven gelden.** Max 15 bestanden en 5.000 regels per actie
   (CLAUDE.md). Elke fase hieronder is bewust klein genoeg om binnen die grens te
   passen; grotere fases worden in meerdere commits gesplitst.
4. **Server is autoritair, dus de module ook.** Alles wat `GAME-RULES.md` als
   server-beslissing aanmerkt (vraagselectie, correctheid, punten, volgorde) wordt
   hier geïmplementeerd als deterministische functie zonder client-input te
   vertrouwen.

## Modules

| Module | Verantwoordelijkheid | Bron in GAME-RULES.md |
| --- | --- | --- |
| `scoring` | puntenformule, snelheidsbonus, deadline-grace, cap op 200 | §Puntentelling |
| `standings` | tiebreak-volgorde (score → correct → responstijd → gedeeld) | §Gelijke eindscore |
| `question-selection` | vraagselectie per match, geen duplicaten, mix-verdeling | §Vraagselectie |
| `rematch-exclusion` | vragen uit vorige match vermijden tot pool te klein is | §Vraagselectie |
| `validators/*` | één validator per Golf 1-spelvorm (5 stuks) | §Spelvormen |
| `late-join` | eligibility en `vanaf ronde {n}`-markering | §Late join |
| `disconnect-accounting` | wel/niet meetellen in antwoordvoortgang-noemer | §Speler verlaat of disconnect |
| `teams-scoring` | gemiddelde-per-ronde-formule (fase 1.5, later) | §Teams — fase 1.5 |

Elke module is een eigen bestand met eigen unit tests, zodat een wijziging in één
spelvorm niet de andere modules raakt.

## Fasering

### GR0 — Scaffold (geen dependencies)
- Mapstructuur voor de module (voorstel, niet definitief totdat de
  architecture-eigenaar de server-layout bevestigt): `server/rules/`.
- Testrunner: `node --test`, geen package.json-wijziging nodig.
- **Checkpoint:** ik meld waar ik de map plaats voordat ik buiten `docs/` iets
  aanmaak, zodat dit niet vooruitloopt op een architecture-beslissing.

### GR1 — Scoring
- `computeScore()` volgens de exacte formule (`bonus = round(100 × clamp((endsAt -
  receivedAt) / questionDuration, 0, 1))`), inclusief cap van 250 ms grace en de
  "snelheidspunten uit" kortsluiting (100/0).
- Cumulatieve `correctResponseTimeMsTotal`-opbouw.

### GR2 — Standings
- Comparator die op score, correcte antwoorden, totale responstijd en gedeelde
  positie sorteert, exact in die volgorde.

### GR3 — Spelvormvalidators (Golf 1)
- Vijf validators: Vlaggen Quiz, Hoofdsteden Quiz, Echt of Nep?, Hoger of Lager,
  Buitenbeentje. Elke validator toetst alleen structurele + inhoudelijke
  correctheid van het antwoord tegen de ronde — geen afleidbaarheid van het
  correcte antwoord uit id/volgorde/seed (expliciete eis in `PROTOCOL.md`).

### GR4 — Vraagselectie & rematch-exclusie
- Geen dubbele vraag binnen een match, gelijkmatige verdeling bij mixgames,
  uitsluiting van `previousMatchQuestionKeys` totdat de pool onvoldoende groot is.

### GR5 — Late join & disconnect-accounting
- Eligibility vanaf `eligibleFromRound`, uitsluiting uit de noemer tijdens
  graceperiode, geen terugwerkende puntenaftrek.

### GR6 — Teams (fase 1.5, na Golf 1)
- Gemiddelde-per-ronde-formule zodat teamgrootte en late joins niet oneerlijk
  meewegen. Bouw ik pas nadat GR1–GR5 groen zijn — `PRODUCT.md` merkt teams al als
  latere uitbreiding aan, dus dit heeft geen launch-prioriteit.

### GR7 — Interfacevoorstel voor PROTOCOL.md / DATA-MODEL.md
- Geen ADR, wel een voorstel: de input/output-types die deze module verwacht
  (`Round`, `Answer`, `Player`-subset), zodat de eigenaar van die ADR-plichtige
  documenten iets concreets heeft om tegenaan te reviewen in plaats van vanaf nul
  te ontwerpen.

## Testplan

Dit dekt direct de "Unit"-laag uit
[`DEPLOYMENT-AND-TESTING.md`](../multiplayer/DEPLOYMENT-AND-TESTING.md#testlagen):

- puntenformule en deadline-grace (GR1);
- alle spelvormvalidators (GR3);
- vraagselectie en rematchuitsluiting (GR4);
- teamformule wanneer teams worden gebouwd (GR6).

Elke module krijgt tests vóór of samen met de implementatie, nooit erna.

## Wat hier expliciet buiten valt

- Redis, sockets, REST, deployment — dat zijn `PROTOCOL.md`, `DATA-MODEL.md`,
  `ARCHITECTURE.md` en `DEPLOYMENT-AND-TESTING.md`.
- Logo-spelvormen (Golf 2, feature-flagged) — pas relevant na juridische vrijgave
  per `PRODUCT.md`.
- Alles wat `TOKEN_PEPPER`, `.env` of productie-secrets raakt — dat is `prod`.

## Checkpoints die ik niet zelfstandig neem

- Nieuwe dependencies toevoegen (TypeScript, Fastify, Socket.IO, testrunner buiten
  Node core) — `deps`, always_ask.
- De definitieve locatie/laag-structuur van de server-code — `architecture`.
- Concrete types vastleggen die `DATA-MODEL.md` of `PROTOCOL.md` binden —
  `database_schema` / `public_api`, ADR-plichtig.

Ik werk dus door tot en met GR6 als losstaande, geteste module, en leg bij GR0 en GR7
expliciet een vraag neer in plaats van door te bouwen op een aanname.

## Prompts per fase

Na de productbesluiten van 2 augustus 2026 gebruikt de uitvoerder eerst
[`prompts/GR-RESUME-AFTER-DECISIONS.md`](prompts/GR-RESUME-AFTER-DECISIONS.md).

Uitvoerbare, zelfstandige taakbeschrijvingen per fase staan in
[`prompts/`](prompts/), zodat ze los te reviewen en los te starten zijn:

- [`prompts/GR0-scaffold.md`](prompts/GR0-scaffold.md)
- [`prompts/GR1-scoring.md`](prompts/GR1-scoring.md)
- [`prompts/GR2-standings.md`](prompts/GR2-standings.md) — herzien na
  [`REVIEW-GR2-GR3.md`](prompts/REVIEW-GR2-GR3.md), **afgerond en geverifieerd**.
- [`prompts/GR3-validators.md`](prompts/GR3-validators.md) — herzien na
  [`REVIEW-GR2-GR3.md`](prompts/REVIEW-GR2-GR3.md), **afgerond en geverifieerd**.
- [`prompts/GR4-question-selection.md`](prompts/GR4-question-selection.md) —
  volledig herzien na [`REVIEW-GR4.md`](prompts/REVIEW-GR4.md): beide blockers
  (outputcontract, Echt-of-Nep-renderdata) en alle zes overige bevindingen
  verwerkt. Daarna op instructie verder vereenvoudigd: **één `gameType` per
  match, geen mix** — round-robin/verdeling tussen spelvormen is daarmee
  geschrapt, niet bevestigd. Klaar om uit te voeren.

**GR2 — afgerond.** `server/rules/standings.js` (136 regels) +
`standings.test.js` (216 regels). Zelf geverifieerd (niet alleen het
agentrapport aangenomen): 23/23 nieuwe tests groen, de 32 bestaande
scoring-tests ongewijzigd groen, competitierangschikking (`1,1,3,4`) correct
geïmplementeerd exact zoals voorgesteld. Twee kleine interpretaties die de spec
openliet: `TypeError` voor een verkeerd fundamenteel type versus `RangeError`
voor een geldig type met ongeldige waarde (standaard JS-idioom); `id`-tiebreak
op kale `&lt;`/`&gt;` in plaats van locale-aware vergelijking (deterministischer,
geen ICU-afhankelijkheid). Beide onschuldig, geen herziening nodig.

GR2 en GR3 zijn op verzoek vooraf geschreven (wat afweek van het oorspronkelijke
just-in-time-uitgangspunt), daarna extern gereviewd, herschreven, en
geïmplementeerd — 12 van de 14 reviewbevindingen zijn direct verwerkt. Twee
bevindingen waren geen implementatiedetail maar een beslissing die niet aan
mij was; beide zijn inmiddels expliciet voorgelegd:

1. **Competitierangschikking (`1,1,3,4`) bij gedeelde positie in GR2** —
   **bevestigd.** Geen open punt meer.
2. **De vijf `correctAnswer`-vormen in GR3** (bv. `{ choice: "fake" }`) —
   **geblokkeerd, bewust.** De mens koos wachten op bevestiging door het
   protocol-team boven doorbouwen op de aanname. Code staat er en is getest,
   maar telt als voorstel, niet als vastgesteld contract, totdat
   [`HANDOFF.md`](HANDOFF.md) beantwoord is.

Een derde punt kwam pas tijdens het schrijven van GR2 naar boven en is nu ook
besloten: **foutafhandeling wanneer `rankPlayers()` een corrupt spelerrecord
tegenkomt tijdens een live game** — fail-soft richting spelers (terugvallen op
laatste geldige stand), fail-loud richting logs. Dat hoort niet in
`server/rules/` thuis (pure module, geen logging), dus overgedragen aan wie de
state machine bouwt.

Alle drie punten, inclusief de exacte vraag aan het protocol-team, staan
uitgeschreven in **[`HANDOFF.md`](HANDOFF.md)** — het enige kanaal naar de
parallelle sessies, aangezien er geen directe verbinding tussen sessies
bestaat. GR4–GR7 volgen hierna, niet in bulk.

**Status:** GR0 en GR1 zijn gereviewd — zie [`prompts/REVIEW.md`](prompts/REVIEW.md)
— en op basis daarvan bijgewerkt (grace-validatie, `scoreAnswer()` als
gecombineerde acceptatie+score-ingang, vaste testtabel i.p.v. willekeur, en een
gecorrigeerde GR0-verificatie).

- **GR0 — afgerond.** Locatie bevestigd: `server/rules/`. `.gitkeep` staat er,
  door Git gezien als toe te voegen (niet genegeerd), geen dependencies
  toegevoegd.
- **GR1 — afgerond en geverifieerd.** Een gespawnde agent implementeerde
  `server/rules/scoring.js` + `scoring.test.js` op basis van
  `prompts/GR1-scoring.md`; ik heb de code zelf gelezen en de tests onafhankelijk
  gedraaid (niet alleen het agentrapport aangenomen). `REVIEW-GR2-GR3.md`
  bevinding 5 legde daarna alsnog een gat bloot in
  `accumulateCorrectResponseTime` (geen validatie van `currentTotalMs`/
  `responseTimeMs`); dat is met terugwerkende kracht gepatcht. Huidige status:
  **32/32 tests groen**, geen dependencies.
- **De volledige parallelle bouw is inmiddels zichtbaar.** Niet alleen
  `server/architecture/` — de hele repo heeft nu ook `server/protocol/`,
  `client/flow/`, `shared/product/`, `src/{components,screens}/` en
  `tests/{unit,contract,integratie,e2e,chaos,load}`-scaffolding. Elke map komt
  overeen met één document uit `docs/multiplayer/`: `server/protocol/` →
  `PROTOCOL.md`, `shared/product/` → `PRODUCT.md`, `client/flow/` →
  `GAME-FLOW.md`, `tests/*` → de testlagen uit `DEPLOYMENT-AND-TESTING.md`. Dit
  is duidelijk dezelfde per-document-verantwoordelijkheidsverdeling als deze
  map (`docs/game-rules-plan/`), parallel uitgevoerd door andere sessies. Ik
  heb alleen bestandsnamen bekeken, verder niets gelezen of aangeraakt buiten
  `server/rules/` en een korte blik in `server/protocol/README.md` +
  `envelope.mjs` (zie hieronder) — niet mijn scope om te reviewen.
  - `server/protocol/README.md` bevestigt dat ook zij `server/protocol/` als
    **voorlopige** locatie zien, in afwachting van een bindend
    serverskeleton-voorstel uit architecture-plan — dezelfde voorzichtigheid
    als GR0 hier hanteerde voor `server/rules/`.
  - **Geconstateerde inconsistentie, niet door mij opgelost:**
    `server/protocol/` gebruikt native ES modules (`.mjs`, `export function`);
    `server/rules/` (dit werk) gebruikt CommonJS (`.js`, `module.exports`).
    Werkt nu allebei prima los, maar moet gereconcilieerd worden zodra iemand
    ze daadwerkelijk aan elkaar knoopt — vermoedelijk bij het
    architecture-serverskeleton.
  - `server/protocol/` is nog bij hun eigen GR1 (envelope + idempotentie); de
    `client-events`-module die de `round:answer`/`correctAnswer`-vorm zou
    vastleggen bestaat daar nog niet. GR3's ontwerpbeslissing 2 (de vijf
    `correctAnswer`-vormen zijn een voorstel) blijft dus terecht open — niet
    ergens anders al stilzwijgend beantwoord.
