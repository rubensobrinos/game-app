# Realisatieplan — DEPLOYMENT-AND-TESTING.md

Dit is het uitvoeringsplan voor het onderdeel waar ik verantwoordelijkheid voor heb
genomen: [`docs/multiplayer/DEPLOYMENT-AND-TESTING.md`](../multiplayer/DEPLOYMENT-AND-TESTING.md).
Dit document zelf verandert niets aan de specificatie — het beschrijft hoe ik die
specificatie omzet in geteste testinfrastructuur, in welke volgorde, en waar ik moet
stoppen om goedkeuring te vragen.

**Herzien op 2026-08-02 na [`prompts/REVIEW.md`](prompts/REVIEW.md).** De review vond
T0 niet uitvoerbaar zoals geschreven (bestandslimiet overschreden, ongeldig
verificatiecommando, misleidende groene placeholders) en wees op vermenging van
testsoorten en overclaims verderop in de fasering. Dit document verwerkt die
bevindingen. Er was nog niets uitgevoerd, dus er valt niets terug te draaien — alleen
het plan zelf is aangepast.

Zie ook [`docs/multiplayer/README.md`](../multiplayer/README.md) voor de rolverdeling
per document, en de zusterplannen van
[`GAME-RULES.md`](../game-rules-plan/README.md),
[`ARCHITECTURE.md`](../architecture-plan/README.md) en
[`GAME-FLOW.md`](../game-flow-plan/README.md). Voor `PROTOCOL.md` en `DATA-MODEL.md`
bestaat op het moment van schrijven nog geen eigen plan; waar mijn testwerk hun vorm
raakt, lever ik een voorstel dat hún bevestiging nodig heeft, geen bindende keuze.

## Uitgangspunten

1. **`DEPLOYMENT-AND-TESTING.md` bevat twee heel verschillende dingen, en ik neem er
   maar één van.** Testlagen zijn `test` (`approve`, zelfstandig); deployment (Docker
   Compose, Mac Studio, Cloudflare Tunnel, secrets, back-ups, release/rollback,
   handmatige pilots) is `prod` (`always_ask`). Ik bouw de testsuite; ik zet niets in
   productie en raak geen secrets aan.
2. **Geen dubbel werk met de moduleplannen.** `GAME-RULES.md`- en
   `ARCHITECTURE.md`-eigenaren schrijven hun eigen unittests al. Mijn laag is wat
   niemand anders claimt: contracttests, integratietests, E2E/load/chaos-scripts en
   een gedeelde teststructuur.
3. **Nog niet uitvoerbare scenario's eerst als matrix, niet meteen als skip-code.**
   Voor lagen die van ander werk afhangen (integratie, E2E, load, chaos) leg ik het
   scenario eerst vast in een genummerde testmatrix (bron, eigenaar-afhankelijkheid,
   prerequisite, activatiecriterium) in platte markdown. Pas als een prerequisite
   concreet genoeg is, wordt een scenario omgezet in uitvoerbare code — en dan alleen
   met `test.skip` plus een aparte controle die overdatum/onverwachte skips
   rapporteert, zodat een vergeten skip niet stilzwijgend groen blijft nadat de
   implementatie is geland.
4. **Groen betekent bewezen, niet "map bestaat".** Een triviale groene test onder
   `e2e/`, `load/` of `chaos/` bewijst niets over Playwright, k6, echte browsers of
   een Compose-omgeving. Ik plaats geen placeholder-tests die als bewijs meetellen
   voor iets dat nog niet bestaat; lege structuur krijgt `.gitkeep`, geen test.
5. **Contracttests zijn gezamenlijk eigendom, niet alleen van mij.** Een afgeleid
   schema kan ongemerkt het feitelijke publieke contract worden als de eigenaar van
   `PROTOCOL.md` (en waar relevant `DATA-MODEL.md`) het niet bevestigt. Elke
   contractvorm die ik afleid is daarom een voorstel met een expliciet
   bevestigingsmoment, niet iets dat ik zelfstandig activeer.
6. **Geen nieuwe dependencies om te beginnen.** Zolang een teststuk pure assertions of
   structurele validatie tegen platte JSON is, gebruik ik `node:test` + `node:assert`
   — nul nieuwe packages. Playwright (E2E) en k6/Artillery (loadtest) zijn wél nieuwe
   afhankelijkheden of externe tools; installatie én latere uitvoering zijn losse
   `deps`/`prod`-checkpoints, niet één gecombineerde stap.
7. **De testboom draait voorlopig alleen lokaal — dat gat documenteer ik, ik verberg
   het niet.** De bestaande, devkit-managed CI (`.github/workflows/ci.yml`) draait
   `npm ci` + ESLint + Jest en dekt geen `node:test`-bestanden; deze repo heeft geen
   `package.json`. Zolang er geen goedgekeurd CI-wiringvoorstel is, staat dat gat
   letterlijk in dit document (zie T0b) in plaats van dat groen lokaal lijkt op
   "geborgd in CI". Het devkit-managed blok wijzig ik nooit handmatig.
8. **Autonomie-limieten blijven gelden, inclusief het bestandsaantal per actie.** Max
   5 bestanden en 400 regels per actie (CLAUDE.md). Een fase die dat dreigt te
   overschrijden — zoals de oorspronkelijke T0 — wordt gesplitst, niet afgerond.
9. **`infra/prod/**` en `.github/workflows/deploy.yml` raak ik nooit aan.**

## Testlagen → eigenaarschap

| Laag (uit DEPLOYMENT-AND-TESTING.md) | Wie schrijft de tests | Mijn rol |
| --- | --- | --- |
| Unit | eigenaar van de betreffende module | geen — niet dupliceren |
| Contracttests | gezamenlijk met de `PROTOCOL.md`-eigenaar | **ik lever het voorstel**, zij bevestigen de vorm |
| Integratie | niemand claimt dit | **ik**, matrix eerst, code pas bij concrete prerequisites |
| Browser/E2E | `GAME-FLOW.md`-plan dekt een deel via gemockte transport | **ik** voor de rest, gesplitst in automatiseerbaar (T4a) en handmatig (T4b) |
| Restart-/chaostests | niemand claimt dit | **ik**, als scripts + runbook, met aparte autorisatie per stap |
| Loadtests | niemand claimt dit | **ik**, k6 alleen voor wat k6 daadwerkelijk bewijst |
| Handmatige pilots, release, rollback, back-ups, hosting | — | **niet ik** — `prod`, always_ask |

## Fasering

### T0 — Mapstructuur (alleen mappen, verder niets)
- Voorstel: `tests/{contract,integration,e2e,load,chaos}/`, elk met precies één
  `.gitkeep` — vijf bestanden, exact op de grens van de autonomielimiet. Geen
  placeholder-`node:test`-bestanden en geen README-wijziging in dezelfde actie (dat
  waren samen zes bestanden bij een limiet van vijf).
- Verificatie is een bestaanscontrole (`find tests -type f` / `ls -R tests`), niet
  `node --test tests/`: die opdracht behandelt een expliciet meegegeven map als
  testmodule en faalt op een lege map met `MODULE_NOT_FOUND` (geverifieerd op de hier
  geïnstalleerde Node v24.16.0) — geen geldige recursieve discoverycheck.
- **Checkpoint:** locatie bevestigen voordat ik iets buiten `docs/` aanmaak.
- **Status (2026-08-02): afgerond.** Alle vijf mappen bestaan, elk met precies één
  `.gitkeep`: `tests/{contract,integration,e2e,load,chaos}/`. Geverifieerd met
  `find tests -type f`. Er staan nog geen testbestanden in, dus er is nu nog geen
  testrunner-commando om uit te voeren — zie T0b hieronder voor het canonieke
  commando-sjabloon voor zodra dat wel zo is.

### T0b — Documentatie: canoniek testcommando + CI-kloof (eigen, aparte actie)
- Aanvulling in dit README, los van T0's bestandenbudget: het canonieke lokale
  commando per laag zodra die laag bestanden heeft (bijv.
  `node --test tests/contract/*.test.js`), plus expliciet benoemd dat de huidige
  managed CI dit niet draait. Geen wijziging aan `.github/workflows/ci.yml`.
- **Status (2026-08-02): afgerond** — dit is de aanvulling zelf, hieronder.
- **Canoniek lokaal testcommando-sjabloon per laag** (sjabloon, geen commando dat nu
  al iets uitvoert: elke map bevat op dit moment alleen een `.gitkeep`, dus dit levert
  pas resultaat op zodra een laag daadwerkelijk `.test.js`-bestanden krijgt):
  - Contract: `node --test tests/contract/*.test.js`
  - Integratie: `node --test tests/integration/*.test.js`
  - E2E: `node --test tests/e2e/*.test.js`
  - Load: `node --test tests/load/*.test.js`
  - Chaos: `node --test tests/chaos/*.test.js`
- **CI-kloof, expliciet herhaald:** de bestaande, devkit-managed
  `.github/workflows/ci.yml` draait `npm ci` + ESLint + Jest en dekt deze
  `node:test`-boom onder `tests/` niet; deze repo heeft ook geen `package.json`. Dat
  gat wordt niet stilzwijgend opgelost door lokaal groene tests. Het wordt pas
  dichtgezet ná een goedgekeurd T7-voorstel (CI-volgordevoorstel, zie de fasering
  hieronder) — nooit door het devkit-managed blok handmatig te wijzigen. Tot een
  T7-voorstel is goedgekeurd, draaien bovenstaande commando's uitsluitend lokaal, niet
  in CI.

### T1a — Traceability-matrix (markdown, geen code)
- Tabel: gedocumenteerd payloadveld/regel uit `PROTOCOL.md` → brontekst/paragraaf →
  open beslispunt (bijv. "is dit veld optioneel of altijd aanwezig?"). Dekt
  REST-bodies, socket-envelopes, foutcodes, de `round:started`-voorbeeldpayload.
- Legt ook de keuze voor: een echt JSON Schema (validator-library, dus een eigen
  `deps`-checkpoint) of een klein, dependency-vrij JSDoc-/handmatig
  validatorcontract.
- **Checkpoint:** bevestiging door de (toekomstige) `PROTOCOL.md`-eigenaar vóórdat er
  contractcode op wordt gebouwd — anders wordt een afgeleid schema ongemerkt het
  feitelijke contract.

### T1b — Contracttests: uitsluitend statische vorm (pas na T1a-bevestiging)
- Beperkt tot structuur, enums, verplichte/verboden velden op fixtures én later op
  echte produceroutput. Bijvoorbeeld: `correctAnswer` ontbreekt in de voorbeeld-
  snapshotvorm; de foutcode-envelope heeft de gedocumenteerde velden.
- **Expliciet niet hier, verplaatst naar T3 (integratie):** `round:progress` max.
  2×/seconde is temporeel gedrag; `actionId`-idempotentie vereist verwerking en
  opslagstate; dat een actieve snapshot nooit `correctAnswer` bevat moet uiteindelijk
  tegen de échte snapshotproducer bewezen worden, niet tegen een eigen fixture.

### T2 — Gedeelde testfixtures (voorstel, geen ADR)
- Pure data-factories voor Room/Session/Player/Match/Round/Answer conform
  `DATA-MODEL.md`, zodat integratie- en E2E-tests niet ieder hun eigen fixtures
  verzinnen. Voorstel ter review bij de toekomstige `DATA-MODEL.md`-eigenaar, geen
  bindende vastlegging namens hen.

### T3 — Integratie: eerst matrix, dan pas code
- **T3a:** genummerde testmatrix (scenario, bron in DEPLOYMENT-AND-TESTING.md
  §Integratie, eigenaar-afhankelijkheid, prerequisite, activatiecriterium) voor: create
  met/zonder hostdeelname, join via QR/inviteId/code, start→rondes→finish→rematch,
  lock/unlock, late join, kick + sessierevocation, room-isolatie, idempotente
  `actionId`, plus de temporele/idempotente checks die uit T1b hierheen zijn
  verplaatst.
- **T3b:** pas wanneer een scenario's prerequisites concreet zijn (interfaces van de
  betrokken eigenaren liggen vast), omzetten naar uitvoerbare `test.skip`-code mét
  metadata (prerequisite-referentie, datum) en een aparte controle die overdatum/
  onverwachte skips rapporteert.

### T4a — Browser-E2E met Playwright (automatiseerbare subset)
- Scope: routes/navigatie, refresh, responsive viewports, browser-API-fallbacks —
  dingen die Chromium/WebKit-emulatie daadwerkelijk kan bewijzen.
- Vóór installatie: scenario's als leesbare beschrijving/pseudocode in markdown, niet
  als `.spec.ts`-bestanden — zonder Playwright's eigen parser/linter kunnen syntax-
  of API-fouten in echte specbestanden toch niet gevalideerd worden, dus
  "geschreven maar niet-uitvoerbaar" zou een valse indruk van gereedheid geven.
- **Checkpoint:** Playwright toevoegen — `deps`, always_ask.

### T4b — Echte-device-/handmatige matrix (niet geautomatiseerd)
- App-switch, schermlock, native share sheets, echte Safari/iPhone, trage 4G op een
  echt toestel: dit bewijst Playwright niet betrouwbaar. Vastgelegd als runbook/
  checklist voor een mens om uit te voeren, nooit als geautomatiseerde test die
  "groen" kan worden.

### T5 — Loadtests: per criterium expliciet welk bewijs
- Tabel per L0–L3-criterium uit de spec, met welke runner/omgeving het daadwerkelijk
  bewijst:
  - k6: alleen doorvoer, latency- en foutthresholds (bijv. p95 < 300 ms bij L1).
  - State-invarianten (geen dubbele antwoorden/scores, geen desync): integratietests
    (T3), niet k6.
  - Blijvende geheugengroei na room-TTL: observability/metrics, niet k6.
  - "Functioneel en visueel" (L0) en assetervaring op echte mobiele verbindingen:
    E2E (T4) of handmatige pilot, niet k6.
- L0 vereist expliciet (virtuele) spelers én visuele beoordeling; geen k6-script
  bewijst L0 alleen. L2/L3 vereisen een expliciete omgeving-/providercheck vóór
  uitvoering.
- **Checkpoints, apart van elkaar:** k6 installeren, en k6 daadwerkelijk uitvoeren
  tegen enige omgeving — beide always_ask, nooit als één gecombineerde stap
  behandeld.

### T6 — Restart- en chaostestprocedures
- Eén script/runbook per scenario (game-server-restart midden in ronde,
  Redis-restart met AOF, PostgreSQL tijdelijk weg, tunnel-reconnect, host offline,
  10% spelers-disconnect/reconnect).
- Ook een lokale Compose-restart is geen productieactie, maar verandert wel externe
  proces- en datastate. Daarom apart geautoriseerd, in deze volgorde: (1) stack
  installeren/opstarten, (2) resetten, (3) daadwerkelijk een restart-/chaos-scenario
  uitvoeren — elk met eigen bevestiging, en met een dedicated compose-projectnaam/
  netwerk zodat testdata nooit een bestaande omgeving kan raken.

### T7 — CI-volgordevoorstel
- Voorstel (geen besluit) voor een eventueel nieuw, apart testworkflow-bestand —
  nooit het devkit-managed blok in `.github/workflows/ci.yml` en nooit
  `deploy.yml`. Lost de kloof uit T0b pas op ná akkoord; tot die tijd draait alles
  lokaal, expliciet gedocumenteerd, niet stilzwijgend aangenomen als geborgd.

## Wat hier expliciet buiten valt

- Alles onder "Mac Studio als 24/7 pilotserver", de referentie-Compose in productie
  draaien, Cloudflare Tunnel/port forwarding daadwerkelijk opzetten — `prod`.
- Secrets: `.env`, `TOKEN_PEPPER`, `POSTGRES_PASSWORD`, `CLOUDFLARE_TUNNEL_TOKEN`.
- Back-ups, restore-tests op echte data, release/rollback-uitvoering.
- Handmatige pilots met echte mensen (Pilot A/B).
- Bindende schema's namens `PROTOCOL.md`/`DATA-MODEL.md` vaststellen.
- Unittests van andere modules overschrijven of dupliceren.
- Groene tests voor gedrag dat de gekozen runner niet daadwerkelijk bewijst (zie T4b,
  T5).

## Checkpoints die ik niet zelfstandig neem

- Playwright, k6/Artillery of enige andere nieuwe dependency **toevoegen** — `deps`.
- k6 (of vergelijkbare tool) **uitvoeren** tegen enige omgeving — apart van
  installatie, `prod`-gebonden zodra het een gedeelde/publieke omgeving raakt.
- Een lokale Compose-stack **installeren/opstarten**, **resetten**, of een
  restart-/chaos-scenario **uitvoeren** (T6) — drie losse momenten, geen
  gecombineerde stap.
- Contractvormen (T1a/T1b) activeren zonder bevestiging van de `PROTOCOL.md`-eigenaar.
- Fixtures (T2) bindend maken namens de `DATA-MODEL.md`-eigenaar.
- Een nieuw GitHub Actions-workflowbestand toevoegen (T7) — en sowieso nooit het
  devkit-managed blok of `deploy.yml` handmatig wijzigen.

Ik werk dus zelfstandig door tot en met het opstellen van matrices, mapstructuur en
voorstellen (T0, T0b, T1a, T2, T3a); alles wat zo'n matrix omzet in bindende code of
echte uitvoering (T1b, T3b, T4, T5, T6, T7) wacht op het bijbehorende, hierboven
genoemde checkpoint.

## Prompts per fase

Uitvoerbare, zelfstandige taakbeschrijvingen per fase staan in
[`prompts/`](prompts/), zodat ze los te reviewen en los te starten zijn:

- [`prompts/T0-scaffold.md`](prompts/T0-scaffold.md) — herzien na
  [`prompts/REVIEW.md`](prompts/REVIEW.md); wordt momenteel uitgevoerd.
- [`prompts/T0b-status-en-ci-gap.md`](prompts/T0b-status-en-ci-gap.md)
- [`prompts/T1a-traceability-matrix.md`](prompts/T1a-traceability-matrix.md)
- [`prompts/T2-fixtures-voorstel.md`](prompts/T2-fixtures-voorstel.md)
- [`prompts/T3a-integratie-matrix.md`](prompts/T3a-integratie-matrix.md)

Deze vijf dekken alles wat ik zelfstandig kan doorlopen (matrix, voorstel of
mapstructuur, geen bindende code of echte uitvoering). T1b, T3b, T4, T5, T6 en T7
krijgen hun prompt pas vlak voordat ze starten, niet vooraf in bulk — zo blijft elke
prompt actueel ten opzichte van wat de vorige fase echt opleverde en van wat de
`PROTOCOL.md`-/`DATA-MODEL.md`-eigenaren inmiddels hebben vastgelegd.
