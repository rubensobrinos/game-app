# Prompt — PR11: Bestaande validators bijwerken naar DECISIONS.md

**Herzien na menselijke review (2 aug 2026)** — zie "Verwerkte review-feedback"
onderaan. De belangrijkste wijziging: sectie 2 gebruikte verzonnen
`question`-vormen die niet overeenkwamen met de al gebouwde
`server/rules/question-selection.js` — dat is nu de bron van waarheid.

Dekt fase **PR11** — nieuw, volgend op
[`docs/multiplayer/DECISIONS.md`](../../multiplayer/DECISIONS.md). Vijf losse
wijzigingen aan al bestaande bestanden in `server/protocol/`. Vereist dat **PR9**
(spec-tekst) al is uitgevoerd of gelijktijdig gebeurt.

## 1. `eligibleFromRound` in de snapshot

**Bestand:** `server/protocol/snapshot-shape.mjs` (PR5d).

`DECISIONS.md` punt 3. Voeg `eligibleFromRound` toe aan `self`, met de exacte eis
uit `DATA-MODEL.md`/`GAME-RULES.md` (niet zomaar "een getal"):

```js
Number.isInteger(eligibleFromRound) && eligibleFromRound >= 1
```

Testtabel: geldig (bv. `1`, `7`), `0` (ongeldig, moet ≥ 1 zijn), negatief getal,
niet-geheel getal (`1.5`), string, ontbrekend — elk apart.

## 2. Discriminated `question`-payload voor alle 5 spelvormen

**Bestand:** `server/protocol/server-events-round-lifecycle.mjs` (PR5b,
`validateRoundStartedPayload`) — nu alleen `real_or_fake_flag` strikt gevalideerd,
tegen een vorm (`promptKey`/`image`/`options`) die **niet overeenkomt** met wat
`server/rules/question-selection.js` daadwerkelijk produceert.

Lees `question-selection.js` zelf vóór je begint — dit is de bron van waarheid
voor `publicQuestionPayload`, niet een aanname. Op het moment van schrijven
(regelnummers kunnen verschuiven):

| `gameType` | Echte `publicQuestionPayload`-vorm | `correctAnswer` (nooit in `round:started`) | Extra rules-only velden die nooit mogen lekken tijdens `ROUND_ACTIVE` |
| --- | --- | --- | --- |
| `flags_mc` | `{ targetIso2, optionIso2s }` | `{ optionId }` | — |
| `capitals_mc` | `{ targetIso2, optionIso2s }` | `{ optionId }` | — |
| `real_or_fake_flag` | `{ kind: 'real', iso2 }` of `{ kind: 'generated', seed, rendererVersion, spec }` | `{ choice }` | — |
| `higher_lower` | `{ metric, sides: [{ side, iso2 }] }` (precies 2) | `{ side }` | `resultDetails.values` (de rauwe metriekwaarden — verraadt het antwoord) |
| `odd_one_out` | `{ cards: [{ cardIndex, iso2 }] }` (precies 4) | `{ cardIndex }` | `resultDetails.majorityContinent`/`minorityContinent` (verraadt het antwoord) |

Bouw per `gameType` een eigen strikte vormvalidator (zelfde patroon als de
bestaande multiple-choice-check, maar dan tegen de bovenstaande echte vormen), en
verwijder de aanname dat alleen `real_or_fake_flag` een uitgewerkt voorbeeld heeft.
Ook bijwerken in hetzelfde bestand: het top-level `rendererVersion`-veld
toevoegen aan de toegestane sleutels van `validateRoundStartedPayload` (naast
`contentVersion`), volgens `PR9`'s spec-wijziging (**punt 21**) — zie de open
ontwerpvraag daar over de relatie met het geneste `rendererVersion` bij
`real_or_fake_flag`.

**Bijwerken in `server/protocol/snapshot-shape.mjs`:** `SAFE_ACTIVE_ROUND_KEYS`
uitbreiden met `'rendererVersion'`, zodat `assertNoActiveRoundAnswerLeak` dit
nieuwe toegestane veld niet per ongeluk als lek aanmerkt.

### Herformulering van de "niet-afleidbaar"-eis (punt 9)

`PROTOCOL.md` zegt letterlijk: "De juiste optie is niet afleidbaar uit ID,
volgorde, URL, seed of metadata." Een vormvalidator kan dit **niet** semantisch
bewijzen — bij `flags_mc` maakt `targetIso2` het antwoord zelfs bewust inhoudelijk
bepaalbaar, want de client moet de vlag en opties kunnen renderen. Toets in plaats
daarvan **structureel, per spelvorm**:

- geen expliciet correctheidsveld (`correctAnswer`, `correctOptionId`, `isCorrect`
  o.i.d.) in de `question`-payload;
- een **strikte allowlist** van toegestane sleutels per `gameType` (zie tabel
  hierboven) — geen extra, onverwachte velden;
- expliciet **verboden** tijdens `ROUND_ACTIVE`: `resultDetails`, rauwe
  metriekwaarden, `majorityContinent`/`minorityContinent` of vergelijkbare
  rules-only velden — die mogen pas in `round:ended` (zie `PR9`).

Semantische geheimhouding (bijv. of de content zelf slim te raden is) blijft een
verantwoordelijkheid van de rules-/contentlaag, niet iets wat deze
protocolvalidator kan of hoeft te bewijzen.

## 3. `share:opened.method` — 3 naar 4 waarden

**Bestand:** `server/protocol/client-events-dispatch.mjs`
(`validateShareOpenedPayload`). Voeg `'code'` toe aan de toegestane enum-waarden
(**punt 18**). Test: `method: 'code'` wordt geaccepteerd.

## 4. `/time`-foutafhandeling: lokale `INVALID_SERVER_RESPONSE`

**Bestand:** `server/protocol/rest-games-session.mjs` (`validateTimeResponse`) —
vervang de tijdelijke, geleende `PROTOCOL_VERSION_UNSUPPORTED`-placeholder door een
eigen lokale constante `INVALID_SERVER_RESPONSE = 'INVALID_SERVER_RESPONSE'`
(**punt 19**: "dit wordt geen nieuwe wire-foutcode"). **Niet** toevoegen aan
`error-codes.mjs`'s `ALL_ERROR_CODES`. Update bestaande tests die op de oude
placeholder controleerden.

## Niet in scope

- Elke wijziging aan `PROTOCOL.md` zelf — dat is PR9.
- Team-/spectator-velden (**punt 8/9**).
- De daadwerkelijke content (welke landen/opties) — komt uit `shared/content/`
  (punt 29); deze validators toetsen alleen de *vorm*.

## Definition of done

- Alle vijf deelwijzigingen doorgevoerd (inclusief `SAFE_ACTIVE_ROUND_KEYS`), elk
  met bijgewerkte/uitgebreide tests, gebaseerd op de daadwerkelijke
  `question-selection.js`-output (geverifieerd door dat bestand te lezen).
- Volledige `server/protocol/*.test.mjs`-suite groen (regressiecheck).
- Geen nieuwe code toegevoegd aan `error-codes.mjs`'s officiële enum.
- Kort verslag: welke bestanden gewijzigd, hoeveel testgevallen
  toegevoegd/gewijzigd, en bevestiging dat elke `question`-vorm 1-op-1 overeenkomt
  met `question-selection.js`.

## Verwerkte review-feedback

- Sectie 2 volledig herschreven op basis van de echte `question-selection.js`-
  output — bevinding 1.
- `eligibleFromRound` nu expliciet `Number.isInteger(x) && x >= 1` — bevinding 12.
- `rendererVersion` toegevoegd aan `validateRoundStartedPayload` en
  `SAFE_ACTIVE_ROUND_KEYS` — bevinding 4.
- "Niet-afleidbaar"-eis geherformuleerd naar structurele allowlist + verboden-
  veldenlijst, in plaats van een onmogelijke semantische bewijsplicht — bevinding 9.
