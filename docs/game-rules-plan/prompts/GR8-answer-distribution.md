# Prompt — GR8: Antwoordverdeling per ronde

Onderdeel van [`docs/game-rules-plan/README.md`](../README.md), fase GR8.
Vereist dat GR3 (validators) is afgerond (is het geval). Nieuwe fase, niet uit
de oorspronkelijke `GAME-RULES.md`-doorlichting — zie herkomst hieronder.

## Herkomst en brondocument

[`docs/multiplayer/DECISIONS.md`](../../multiplayer/DECISIONS.md) #14: "De
rules/service-laag berekent antwoordverdelingen; het protocol transporteert
en valideert alleen de uitkomst." `GAME-RULES.md` zelf beschrijft dit nergens
expliciet als aparte regel; [`PROTOCOL.md`](../../multiplayer/PROTOCOL.md)
noemt alleen dat `round:ended`s kernpayload een "verdeling" bevat, zonder de
berekening te specificeren. Deze module vult dat gat, direct op basis van de
al-vastgelegde `answer`-vormen per spelvorm (`PROTOCOL.md` §`round:answer`,
bevestigd in `DECISIONS.md` #15).

## Ontwerpbeslissingen

1. **Verdeling = optelling over reeds geaccepteerde antwoorden, niet over
   alle spelers.** Hoeveel spelers *niet* antwoordden is `eligiblePlayerCount
   - answers.length`, triviale aftrekking bij de aanroeper — geen functie
   hier nodig.
2. **Elke mogelijke uitkomst staat altijd in het resultaat, ook met 0
   stemmen.** Een verdeling die stilzwijgend een optie weglaat omdat niemand
   'm koos is misleidend voor een UI die alle opties naast elkaar toont.
3. **Sleutels zijn strings, altijd.** `higher_lower`s `side` (0/1) en
   `odd_one_out`s `cardIndex` (0–3) zijn getallen in de antwoordvorm, maar
   objectsleutels in JavaScript zijn sowieso strings — expliciet
   gedocumenteerd zodat niemand per ongeluk `dist[0]` i.p.v. `dist['0']`
   verwacht.
4. **`flags_mc`/`capitals_mc` hebben de `validOptionIds` van de ronde nodig**
   om te weten welke 4 sleutels de verdeling moet hebben — deze module kent
   de ronde-inhoud niet uit zichzelf (zelfde grens als GR3/GR4: geen
   contentkennis, alleen wat de aanroeper meegeeft).
5. **Een antwoord met een waarde buiten de bekende opties werpt een
   `RangeError`.** Op het moment dat deze functie draait, zijn antwoorden al
   door GR3's validators geaccepteerd — dit zou dus nooit mogen gebeuren.
   Stilzwijgend negeren zou die aanname verbergen; hard falen legt een
   inconsistentie tussen validatie en telling meteen bloot.

## Nadrukkelijk buiten scope

- **Wie welk antwoord gaf** — persoonsgebonden data hoort niet in een
  geaggregeerde verdeling; deze module krijgt alleen de antwoorden, geen
  spelers-ID's, en geeft ze ook niet terug.
- **"Populairste optie" of andere afgeleide statistieken** — niet gevraagd
  door `DECISIONS.md` #14 of `PROTOCOL.md`; niet toevoegen zonder concrete
  eis.
- **Golf 2 (typen-invoer)** — geen vaste optieset, dus geen zinvolle
  "verdeling over opties"; buiten scope zoals de rest van Golf 2.

## Te bouwen functies

Bestand: `server/rules/answer-distribution.js`, plus
`server/rules/answer-distribution.test.js`.

```js
/**
 * Berekent de verdeling van geaccepteerde antwoorden over de mogelijke
 * keuzes voor één ronde. Werpt RangeError bij een onbekende gameType, of als
 * een antwoord een waarde bevat die niet in de bekende sleutelset voorkomt.
 * @param {"flags_mc"|"capitals_mc"|"real_or_fake_flag"|"higher_lower"|"odd_one_out"} gameType
 * @param {Array<{ answer: object }>} answers - reeds geaccepteerde antwoorden (na GR3-validatie)
 * @param {{ validOptionIds?: string[] }} roundContext - alleen nodig voor flags_mc/capitals_mc
 * @returns {Record<string, number>}
 */
function computeAnswerDistribution(gameType, answers, roundContext) {}

module.exports = { computeAnswerDistribution };
```

Eén publieke functie — geen interne laag zoals GR3/GR4 nodig, de dispatch is
simpel genoeg om in één `switch` te blijven.

## Verplichte testgevallen

| # | Scenario | Verwacht |
| --- | --- | --- |
| 1 | `flags_mc`, gemengde antwoorden over 3 van de 4 opties | alle 4 sleutels aanwezig, tellingen kloppen, de ongebruikte optie staat op `0` |
| 2 | `capitals_mc`, zelfde mechanisme | routeert correct (zelfde tellogica als flags_mc) |
| 3 | `real_or_fake_flag`, mix van `real`/`fake` | `{ real: <n>, fake: <m> }`, beide sleutels altijd aanwezig |
| 4 | `higher_lower`, mix van `side` 0/1 | `{ '0': <n>, '1': <m> }` — sleutels zijn strings |
| 5 | `odd_one_out`, antwoorden verspreid over alle 4 `cardIndex`-waarden | alle 4 sleutels, tellingen kloppen |
| 6 | Lege `answers`-array | alle bekende sleutels aanwezig, allemaal op `0` — geen leeg object |
| 7 | `flags_mc`, een antwoord met een `optionId` buiten `validOptionIds` | `RangeError` |
| 8 | `higher_lower`, een antwoord met `side: 2` | `RangeError` |
| 9 | `odd_one_out`, een antwoord met `cardIndex: 4` | `RangeError` |
| 10 | Onbekende `gameType` | `RangeError` |
| 11 | `answers`-array en de antwoord-objecten na aanroep | ongewijzigd (geen mutatie) |
| 12 | Twee identieke aanroepen | identiek resultaat (triviaal deterministisch, geen willekeur betrokken) |

## Definition of done

- Alle 12 testgevallen slagen via `node --test 'server/rules/**/*.test.js'`.
- Geen enkele functie raadpleegt content-data, Redis, sockets, de klok, of
  geeft spelersidentiteit terug.
- Geen mutatie van input.
