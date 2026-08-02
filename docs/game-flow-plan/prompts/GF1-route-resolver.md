# Prompt — GF1: Route-resolver

Onderdeel van [`../README.md`](../README.md), fase GF1. Vereist dat GF0 is afgerond
(locatie én moduleformaat bevestigd). Doel: pad → routetype, met syntactische
validatie van de identifier, zonder ooit rechten aan een URL te koppelen.

**Herzien** na [`REVIEW.md`](REVIEW.md) en [`REVIEW-CODEX.md`](REVIEW-CODEX.md) — zie
"Verwerkte review-feedback" onderaan voor wat wijzigde en waarom.

## Brondocument

[`GAME-FLOW.md`](../../multiplayer/GAME-FLOW.md) §Routes en de kernregel eronder:
"De inviteId ... bevat geen hostrechten. De hostroute verleent evenmin rechten op
basis van de URL; de tijdelijke sessietoken is altijd leidend."

`ARCHITECTURE.md` §Join-code en inviteId: de code is "zes cijfers, cryptografisch
random"; de inviteId heeft "minimaal 96 bits entropie, base64url of vergelijkbaar
URL-veilig formaat" — syntactische eigenschappen die deze resolver kan toetsen zonder
netwerk.

`ARCHITECTURE.md` §Routing legt vast dat `/game/*`, `/host/*`, `/screen/*` en `/j/*`
server-side (Caddy/nginx) naar de `frontend`-container wijzen. Die rewrite bestaat
vandaag nergens (geen server-config in deze repo) — deze module test daarom
uitsluitend met kale pathname-strings, niet door een browser echt naar die paden te
laten navigeren.

## Invoercontract (voorgesteld — apart van de locatie-/moduleformaatkeuze uit GF0)

- `pathname` is een string die met `/` begint. Alles anders — `null`, `undefined`,
  een lege string, een pad zonder leidende `/`, of een volledige URL met schema/host
  (`https://...`) — levert `{ route: 'unknown' }` op, nooit een throw.
- Matching is hoofdlettergevoelig; er is geen normalisatie van hoofdletters.
- Eén trailing slash na een geldige identifier wordt genegeerd. Dubbele slashes,
  extra padsegmenten of een lege identifier tussen slashes leveren `unknown` op —
  ze worden niet stilzwijgend opgeschoond.
- `search` is een los, optioneel tweede argument (bijvoorbeeld `location.search`),
  nooit onderdeel van de `pathname`-string. Onbekende queryparameters worden
  genegeerd; ze veranderen nooit het routetype.

Dit zijn zichtbare navigatieregels die niet letterlijk in `GAME-FLOW.md` staan —
daarom expliciet als voorstel, niet als vertaling van de bron.

## Te bouwen functie

Bestand: `client/flow/route-resolver.mjs` (of bevestigde locatie/extensie uit GF0).

```js
/**
 * @param {string} pathname
 * @param {string} [search]
 * @returns
 *   | { route: 'home' }
 *   | { route: 'join', inviteId: string }
 *   | { route: 'game' | 'host' | 'screen', code: string }
 *   | { route: 'unknown' }
 */
export function resolveRoute(pathname, search) {}
```

Validatieregels:

- `code` (voor `game`/`host`/`screen`): moet exact zes ASCII-cijfers zijn
  (`/^[0-9]{6}$/`). Alles anders — letters, verkeerde lengte, encoded separators —
  levert `unknown` op.
- `inviteId` (voor `join`): moet één niet-leeg, base64url-achtig segment zijn
  (`/^[A-Za-z0-9_-]+$/`), zonder decodering. Een segment met een letterlijke `/`
  (ook encoded als `%2F`) breekt de match — geen tweede resolve-poging op decoded
  inhoud.
- De functie retourneert nooit een rol- of rechtenveld (`isHost`, `role`, …).
  Autorisatie loopt uitsluitend via het sessietoken, elders.
- De resolver logt nooit en bewaart niets. `inviteId` is een publieke, tijdelijke
  joincapability (`DATA-MODEL.md`/`ARCHITECTURE.md`) — een aanroeper mag hem alleen
  gebruiken voor de joinaanroep, nooit voor logs, analytics of foutmeldingen, en
  nooit ongeëscaped in HTML zetten (PROTOCOL.md §Inputveiligheid).

## Verplichte testgevallen

| # | Input | Verwacht |
| --- | --- | --- |
| 1 | `resolveRoute('/')` | `{ route: 'home' }` |
| 2 | `resolveRoute('/j/N4x7pQm2K8tW')` | `{ route: 'join', inviteId: 'N4x7pQm2K8tW' }` |
| 3 | `resolveRoute('/game/482917')` | `{ route: 'game', code: '482917' }` |
| 4 | `resolveRoute('/host/482917')` | `{ route: 'host', code: '482917' }` |
| 5 | `resolveRoute('/screen/482917')` | `{ route: 'screen', code: '482917' }` |
| 6 | `resolveRoute('/game/482917/')` (trailing slash) | gelijk aan #3 |
| 7 | `resolveRoute('/game/482917', '?utm_source=whatsapp')` | `search` genegeerd, gelijk aan #3 |
| 8 | `resolveRoute('/JOIN/foo')`, `resolveRoute('/Game/482917')` | `unknown` — case-sensitive |
| 9 | `resolveRoute('/g/482917')`, `resolveRoute('/hosts/482917')` | `unknown` — geen prefix-fuzzy-match |
| 10 | `resolveRoute('/game/foo')`, `resolveRoute('/game/12345')` (5 cijfers), `resolveRoute('/game/1234567')` (7 cijfers), `resolveRoute('/game/12345a')` | stuk voor stuk `unknown` — code moet exact 6 cijfers zijn |
| 11 | `resolveRoute('/game/..%2Fhost%2F482917')` | `unknown` — geen 6-cijferige match, geen decodering, geen tweede resolve |
| 12 | Elk van `/j/`, `/game/`, `/host/`, `/screen/` zonder identifier | `unknown` — vier losse tests |
| 13 | `resolveRoute('https://play.aseso.nl/game/482917')`, `resolveRoute(null)`, `resolveRoute('')`, `resolveRoute('game/482917')` (geen leidende `/`) | stuk voor stuk `unknown`, geen throw |
| 14 | Shape-toets: sleutels van `resolveRoute('/host/482917')` | uitsluitend `route` en `code`, nooit `role`/`isHost`/vergelijkbaar — dit is een lokale shape-invariant, geen bewijs dat de applicatie later geen rechten uit `route: 'host'` afleidt; dat hoort bij een sessie-/integratietest in een latere fase |

Reken door de meervoudige varianten in rij 8–13 op ruim 20 losse `node:test`-cases.

## Niet in scope voor GF1

- Of de inviteId/code bij een bestaande room hoort — netwerkoproep, `PROTOCOL.md`.
- Sessietoken-afhandeling en autorisatie, en het bewijs dat `/host/{code}` zonder
  geldige hostsessie geen hostactie kan uitvoeren — dat is een integratietest voor
  later, niet dit unit-niveau.
- Navigatie zelf (`history.pushState`, `popstate`) en de nginx/Caddy-rewrite die deze
  paden serveert.
- Hoe `joinSource` (`qr`/`shared_link`/`code`) wordt bepaald — UI-context uit GF2.

## Definition of done

- Alle testgevallen uit de tabel slagen, inclusief alle opgesomde varianten.
- Getest met een expliciet bestand, bijvoorbeeld
  `node --test client/flow/route-resolver.test.mjs` — niet met een directorypad (dat
  wordt door de lokale Node-versie niet betrouwbaar als recursieve discoveryroot
  behandeld).
- `resolveRoute` gooit nooit een exception, voor geen enkele input uit de tabel.

## Verwerkte review-feedback

- Code-validatie (exact 6 cijfers) toegevoegd — was afwezig, waardoor willekeurige
  padinhoud als geldige route doorging (REVIEW-CODEX #3).
- Testfixture #7 gecorrigeerd naar de werkelijke tweeargumentsignatuur
  (REVIEW-CODEX #4).
- Expliciet invoercontract toegevoegd voor malformed/absolute/lege input
  (REVIEW-CODEX #5).
- Testcommando in Definition of done verwijst nu naar een bestand, niet een map
  (REVIEW-CODEX #6, en `game-rules-plan/prompts/REVIEW.md` #5).
- Expliciete no-log/no-telemetry-regel voor `inviteId` toegevoegd (REVIEW-CODEX #7).
- Test 14 (voorheen 12) herbenoemd tot lokale shape-invariant, met verwijzing naar de
  echte autorisatietoets die later hoort te volgen (REVIEW-CODEX #8).
- Moduleformaat verplaatst naar GF0 als expliciet te bevestigen keuze (native ESM,
  `.mjs`) in plaats van aangenomen CommonJS (REVIEW-CODEX #2).
