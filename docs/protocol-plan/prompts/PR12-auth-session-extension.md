# Prompt — PR12: auth-session uitbreiden (pepper-versionering + constant-time verify)

**Herzien na menselijke review (2 aug 2026)** — zie "Verwerkte review-feedback"
onderaan. De vorige versie liet de aanroeper de pepper-versie zelf meegeven aan
`verifyToken`, wat het hele doel van versionering (verificatie zonder vooraf te
weten welke pepper gebruikt is) teniet deed. Ook is nu definitief gekozen: de
naam `hashToken` blijft, met een gewijzigde signatuur.

Dekt fase **PR12** — nieuw, volgend op
[`docs/multiplayer/DECISIONS.md`](../../multiplayer/DECISIONS.md), punt 26. Bouwt
voort op `server/protocol/auth-session.mjs` (PR8b) — **`hashToken`'s signatuur
wijzigt hier bewust**; alle aanroepers/tests worden in dezelfde actie aangepast,
niet los achtergelaten.

## Brondocument

`DECISIONS.md` punt 26: "Sessietokens gebruiken 32 random bytes, base64url.
Opslag gebruikt versieerbare HMAC-SHA256 met pepper en verificatie gebruikt
constant-time vergelijking." Het eerste deel is al gebouwd (PR8b,
`generateSessionToken`, ongewijzigd). Dit dekt de twee ontbrekende delen.

## Ontwerp (definitief, na review)

**Waarom de vorige versie fout was:** een `verifyToken(token, pepper,
pepperVersion, storedHash)`-signatuur vereist dat de aanroeper al weet welke
pepper/versie hoort bij een gegeven `storedHash` — maar het hele punt van
versionering is dat de opgeslagen hash zelf aangeeft welke pepper gebruikt is, zodat
verificatie dat kan opzoeken. Daarom:

```js
/**
 * @param {string} token
 * @param {{ version: string, pepper: string }} pepperConfig - de *huidige*
 *   pepperversie waarmee nieuwe tokens gehasht worden.
 * @returns {string} samengestelde opslagvorm `${version}:${hex-hash}`.
 */
export function hashToken(token, pepperConfig) { /* ... */ }

/**
 * @param {string} token - de binnenkomende, te verifiëren token.
 * @param {string} storedHash - vorm `${version}:${hex-hash}` uit `hashToken`.
 * @param {Record<string, string>} peppersByVersion - alle nog geldige peppers,
 *   bv. `{ v1: oudePepper, v2: huidigePepper }` — tijdens een rotatie blijven
 *   oude sessies verifieerbaar zolang hun versie hier nog in staat.
 * @returns {boolean} `false` bij een onbekende versie in `storedHash`, een
 *   malformed `storedHash`, of een niet-matchende hash — nooit een throw.
 */
export function verifyToken(token, storedHash, peppersByVersion) { /* ... */ }
```

`verifyToken` leest de versie uit `storedHash`, zoekt de bijbehorende pepper op in
`peppersByVersion`, hasht `token` opnieuw met die pepper, en vergelijkt
constant-time. Nieuwe tokens gebruiken altijd de huidige versie uit
`hashToken`'s `pepperConfig`; oude, nog actieve sessies blijven verifieerbaar
zolang hun versie in `peppersByVersion` staat.

**`hashToken`'s signatuur wijzigt** (van `hashToken(token, pepper)` naar
`hashToken(token, { version, pepper })`) — dit is bewust, geen ongewenste
breuk: er is nog geen productiedata, dus een legacy-parser voor onversioned hashes
is **niet nodig**. Werk `auth-session.test.mjs`'s bestaande PR8b-tests in dezelfde
actie bij naar de nieuwe signatuur — laat ze niet los kapot achter.

## Verplichte testgevallen

| # | Functie | Scenario | Verwacht |
| --- | --- | --- | --- |
| 1 | `hashToken` | zelfde token/pepperConfig, twee aanroepen | identieke output |
| 2 | `hashToken` | andere `version` in `pepperConfig`, zelfde token/pepper | andere output-string |
| 3 | `hashToken` | output-vorm | begint met `` `${version}:` ``, gevolgd door 64 hex-tekens |
| 4 | `verifyToken` | juiste token tegen de bijbehorende `storedHash`, juiste `peppersByVersion` | `true` |
| 5 | `verifyToken` | onjuiste token (verschilt in het eerste byte van de hash-invoer) | `false`, geen throw |
| 6 | `verifyToken` | onjuiste token (verschilt in het laatste byte) | `false`, geen throw |
| 7 | `verifyToken` | `storedHash`'s versie zit niet in `peppersByVersion` (bv. ingetrokken/onbekende versie) | `false` |
| 8 | `verifyToken` | `storedHash` zonder `version:`-scheiding, of met ongeldige hex | `false`, geen throw |
| 9 | `verifyToken` | `storedHash` en de herberekende hash hebben een verschillende lengte | `false`, geen throw — `timingSafeEqual` gooit zelf bij ongelijke lengte, dus vang dat expliciet af vóórdat je het aanroept |
| 10 | `verifyToken` (rotatiescenario) | een `storedHash` gemaakt met `v1`, geverifieerd met `peppersByVersion = { v1: oldPepper, v2: currentPepper }` (beide nog aanwezig tijdens rotatie) | `true` |
| 11 | integratie | `hashToken` → `verifyToken` met dezelfde `pepperConfig`/token | slaagt zonder Buffer/string-typefouten |

**Over "bewijs dat `timingSafeEqual` gebruikt wordt" (niet als losse test):** test
geen implementatiedetail via dependency-injectie van de crypto-primitive — dat
test de constructie, niet het gedrag, en vervuilt de productie-API onnodig. Volstaat
in plaats daarvan met: (a) een codereview-/statische aantekening in de JSDoc dat
`crypto.timingSafeEqual` gebruikt wordt (geen `===`/`Buffer.equals` op
stringniveau), en (b) de functionele tests hierboven (gelijke hash, verschillend
eerste/laatste byte, malformed hex, ongelijke lengte). Geen timingbenchmark in de
unit tests.

## Niet in scope

- Echte pepper-opslag, -rotatieproces of -bron (`.env`, secrets manager) — `prod`.
- Redis-koppeling van `verifyToken`'s resultaat aan een echte sessie-lookup.
- Wijzigingen aan `generateSessionToken` — die blijft ongewijzigd.
- Een legacy-parser voor onversioned hashes — niet nodig, geen productiedata.

## Definition of done

- `hashToken` en `verifyToken` bestaan met de bovenstaande signaturen, alle 11
  testgevallen slagen.
- Bestaande PR8b-tests zijn bijgewerkt naar de nieuwe `hashToken`-signatuur, niet
  losgelaten.
- Volledige `server/protocol/*.test.mjs`-suite groen (regressiecheck).
- Kort verslag: gekozen opslagvorm-scheidingsteken (`:`), en bevestiging dat geen
  legacy-pad is gebouwd.

## Verwerkte review-feedback

- API herontworpen: `verifyToken` leest de versie uit `storedHash` en zoekt de
  pepper op via `peppersByVersion`, in plaats van dat de aanroeper de versie al
  moet weten — bevinding 6.
- Definitief gekozen: `hashToken` behoudt zijn naam, signatuur wijzigt bewust,
  alle aanroepers/tests in dezelfde actie bijgewerkt, geen legacy-pad — bevinding 7.
- Testgeval voor "timing-safe gebruik" vervangen door functionele tests +
  codereview-aantekening, geen dependency-injectie van de crypto-primitive —
  bevinding 8.
