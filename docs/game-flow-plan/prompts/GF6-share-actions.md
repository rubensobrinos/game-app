# Prompt — GF6: Share-actions

**Aangevuld na `docs/multiplayer/DECISIONS.md` #18** (2 aug 2026, regie-sessie,
bindend): "`share:opened.method` wordt gelijkgetrokken met de vier herkomsten: `qr |
link | native | code`." Deze module krijgt er daarom één extra, kleine functie bij —
`shareOpenedMethodFor` — die een deelactie naar die exacte waarde vertaalt. Geen van
de rest van dit document verandert.

Onderdeel van [`../README.md`](../README.md), fase GF6. Doel: welke deelactie
beschikbaar is en in welke volgorde, plus de URL-vorm die QR en kopieerlink uit
elkaar houdt — geen echte QR-rendering, geen echte `navigator.share()`/clipboard-
aanroep, geen DOM.

## Toegevoegd: `shareOpenedMethodFor`

```js
/** @param {'show-qr'|'native-share'|'copy-link'|'show-code'} action @returns {'qr'|'link'|'native'|'code'|null} */
export function shareOpenedMethodFor(action) {}
```

Mapping: `show-qr → 'qr'`, `copy-link → 'link'`, `native-share → 'native'`,
`show-code → 'code'`. Een onbekende actie geeft `null`, geen throw. Puur een
vertaaltabel voor het `share:opened`-analyticsevent uit `PROTOCOL.md` — deze functie
roept dat event zelf niet aan.

## Brondocument

`GAME-FLOW.md` §QR- en deelgedrag:

```text
Elke deelnemer heeft een vaste actie Delen:
1. toon QR schermvullend;
2. open native share sheet;
3. kopieer join-link;
4. toon handmatige code.
```

en: "zijn voor alle deelnemers identiek; geven alleen joinrechten; ... respecteren
`allowLateJoin` en `roomLocked`." `DEPLOYMENT-AND-TESTING.md` §Assets: "QR lokaal in
de browser genereren uit de joinUrl, zodat geen externe QR-dienst nodig is."

## Lost een eerder gevlagde open vraag op (GF2a)

`join-state`'s prompt (GF2a) markeerde expliciet: de client kan `qr` en `shared_link`
als `joinSource` niet uit elkaar houden, want beide openen exact dezelfde route
(`/j/{inviteId}`). Dit plan lost dat hier op: de QR-encodede URL en de kopieerbare
link krijgen elk een eigen `src`-queryparameter bij het genereren. `route-resolver`
(GF1) negeert `search` bewust voor het bepalen van het routetype — dat blijft zo; deze
module leest `search` apart, voor een ander doel (`joinSource`), niet om de route te
beïnvloeden. Een aanroeper geeft dus zowel `pathname` aan `resolveRoute` als `search`
aan `joinSourceFor` door — twee losse velden van dezelfde `location`, niet met elkaar
vermengd.

## Te bouwen module

Bestand: `client/flow/share-actions.mjs`.

```js
/**
 * @param {string} joinUrl De kale joinUrl uit PROTOCOL.md (zonder querystring).
 * @returns {{ qrUrl: string, copyUrl: string }}
 */
export function shareUrlsFor(joinUrl) {}

/**
 * Inverse van shareUrlsFor: leest de src-parameter terug.
 * @param {string} search bv. `location.search` op de `/j/{inviteId}`-route.
 * @returns {'qr' | 'shared_link' | 'unknown'}
 */
export function joinSourceFor(search) {}

/**
 * @param {{ nativeShareAvailable: boolean }} capabilities
 * @returns {Array<'show-qr' | 'native-share' | 'copy-link' | 'show-code'>}
 */
export function shareActionsFor(capabilities) {}

/**
 * Puur informatief (bv. voor een waarschuwing naast de deelknop) — bepaalt niet
 * of de Delen-actie zelf zichtbaar is, die is altijd beschikbaar.
 * @param {{ locked: boolean, allowLateJoin: boolean, gameHasStarted: boolean }} roomState
 * @returns {boolean} of een nieuwe joiner nu via deze link zou kunnen meedoen
 */
export function canNewJoinerUse(roomState) {}
```

## Regels

- `shareUrlsFor`: voegt `?src=qr` resp. `?src=shared_link` toe aan `joinUrl`. Als
  `joinUrl` onverwacht al een querystring bevat, wordt `&src=...` gebruikt, nooit een
  dubbele `?`.
- `joinSourceFor`: alleen de twee bekende waarden (`qr`, `shared_link`) komen terug
  als zodanig; alles anders — ontbrekend `src`-veld, een onbekende waarde, een lege
  of niet-stringinvoer — geeft `'unknown'`, nooit een throw. Dit moet de inverse zijn
  van `shareUrlsFor`: een URL die daar uitkomt, moet hier de juiste bron opleveren.
- `shareActionsFor`: `'native-share'` wordt **weggelaten** (niet als
  disabled-maar-zichtbaar getoond) wanneer `nativeShareAvailable` niet `true` is —
  gekozen gedrag, want "waar beschikbaar" in de spec impliceert afwezigheid, geen
  uitgegrijsde knop. De overige drie acties staan er altijd, in de vaste volgorde uit
  de spec. Ontbrekende/malformed `capabilities` gedraagt zich als
  `{ nativeShareAvailable: false }`.
- `canNewJoinerUse`: `locked: true` blokkeert altijd. Vóór de start van de game
  (`gameHasStarted: false`) is `allowLateJoin` niet relevant — iedereen die nu joint
  is geen "late" joiner. Ná de start telt `allowLateJoin` wel. Malformed/ontbrekende
  input geeft `false` — bij twijfel liever ten onrechte "kan niet" melden dan ten
  onrechte "kan wel" beloven.

## Verplichte testgevallen

| # | Scenario | Verwacht |
| --- | --- | --- |
| 1 | `shareUrlsFor('https://play.aseso.nl/j/N4x7pQm2K8tW')` | `qrUrl` eindigt op `?src=qr`, `copyUrl` op `?src=shared_link`, beide met de rest van de URL intact |
| 2 | `shareUrlsFor` met een `joinUrl` die al `?foo=bar` bevat | resultaat gebruikt `&src=...`, geen dubbele `?` |
| 3 | `joinSourceFor('?src=qr')` en `joinSourceFor('?src=shared_link')` | `'qr'` resp. `'shared_link'` |
| 4 | `joinSourceFor('')`, `joinSourceFor(undefined)`, `joinSourceFor('?src=bogus')`, `joinSourceFor('?utm_source=whatsapp')` | allemaal `'unknown'`, geen throw |
| 5 | Rondje: `joinSourceFor(new URL(shareUrlsFor(url).qrUrl).search)` | `'qr'` — bewijst dat de twee functies elkaars inverse zijn |
| 6 | `shareActionsFor({ nativeShareAvailable: true })` | exact `['show-qr', 'native-share', 'copy-link', 'show-code']` |
| 7 | `shareActionsFor({ nativeShareAvailable: false })` | exact `['show-qr', 'copy-link', 'show-code']`, `'native-share'` ontbreekt volledig |
| 8 | `shareActionsFor(null)`, `shareActionsFor({})` | beide gelijk aan test 7, geen throw |
| 9 | `canNewJoinerUse({ locked: false, allowLateJoin: true, gameHasStarted: false })` | `true` |
| 10 | `canNewJoinerUse({ locked: true, allowLateJoin: true, gameHasStarted: false })` | `false` — locked wint altijd |
| 11 | `canNewJoinerUse({ locked: false, allowLateJoin: false, gameHasStarted: true })` | `false` |
| 12 | `canNewJoinerUse({ locked: false, allowLateJoin: false, gameHasStarted: false })` | `true` — late join is nog niet relevant vóór de start |
| 13 | `canNewJoinerUse({ locked: false, allowLateJoin: true, gameHasStarted: true })` | `true` |
| 14 | `canNewJoinerUse(null)`, `canNewJoinerUse({})` | beide `false`, geen throw |

## Niet in scope voor GF6

- Het daadwerkelijk renderen van een QR-afbeelding (canvas/SVG) — dat vereist een
  keuze (eigen implementatie of een package) die een `deps`-checkpoint kan zijn,
  ook al is er geen externe QR-*dienst* nodig. Deze module levert alleen de URL die
  gecodeerd moet worden.
- De daadwerkelijke `navigator.share()`-aanroep, clipboard-schrijfactie en
  featuredetectie zelf (`'share' in navigator`, enzovoort) — de aanroeper bepaalt
  `nativeShareAvailable` en geeft het door; deze module beslist alleen de volgorde.
- Of de Delen-actie zelf zichtbaar is — die is altijd beschikbaar voor iedere
  deelnemer (`GAME-FLOW.md`); `canNewJoinerUse` is puur informatief ernaast.
- De handmatige zescijferige code zelf tonen/opmaken — die komt al uit de bestaande
  roomstate, deze module noemt `'show-code'` alleen als vaste laatste actie.

## Definition of done

- Alle testgevallen slagen, met `node --test client/flow/share-actions.test.mjs`.
- Geen enkele functie gooit een exception.
- `joinSourceFor(shareUrlsFor(x).qrUrl-of-copyUrl)` levert altijd de juiste bron —
  geen enkele wijziging aan één functie zonder de andere in dezelfde test te raken.
