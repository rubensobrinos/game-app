# Bugrapport — server start niet meer: `INVALID_REQUEST` ontbreekt in `rest.mjs`'s statustabel

**Van:** deployment-and-testing-plan (gevonden tijdens DT5, poging tot een
lokale L0-loadtestrun, 2026-08-02).
**Voor:** de eigenaar van `server/transport/rest.mjs` (zelfde module als
[`bug-report-snapshot-500-on-lobby.md`](bug-report-snapshot-500-on-lobby.md))
— de veroorzakende commit zelf raakt alleen `server/protocol/`, dus dit is
een gemiste cross-modulesynchronisatie tussen protocol- en transportlaag,
geen fout in de veroorzakende commit op zichzelf.
**Ernst:** kritiek — de server start op dit moment **helemaal niet meer**,
noch via `node server/index.mjs`, noch via elke test die `buildServer()`
importeert. Dit blokkeert niet alleen mijn eigen L0-loadtestpoging, maar ook
elke andere test/sessie die de server op dit moment probeert te starten.

## Wat er goed nieuws bij is

Deze crash komt van commit `bb07aa9` ("fix(protocol): PR-slotlichting —
pre-match-lobby snapshot (INT-17) + INVALID_REQUEST"), die zelf precies de
bug oploste die ik eerder rapporteerde in
[`bug-report-snapshot-500-on-lobby.md`](bug-report-snapshot-500-on-lobby.md)
(500 op `GET /state` in LOBBY). Die fix zelf lijkt raak — het probleem zit in
een bijwerking ervan.

## Root cause

`bb07aa9` voegt in `server/protocol/error-codes.mjs` een nieuwe foutcode toe:

```js
INPUT: Object.freeze([
  'NAME_TOO_LONG', 'NAME_INVALID', 'RATE_LIMITED',
  'PROTOCOL_VERSION_UNSUPPORTED',
  'INVALID_REQUEST',   // <-- nieuw in bb07aa9
]),
```

Maar `server/transport/rest.mjs` heeft zijn eigen, losse
`HTTP_STATUS_BY_ERROR_CODE`-tabel die *niet* is bijgewerkt, en een
fail-fast-check bij module-load die precies dit soort drift moet vangen:

```js
// server/transport/rest.mjs, regel ~130-137
for (const code of ALL_ERROR_CODES) {
  if (typeof HTTP_STATUS_BY_ERROR_CODE[code] !== 'number') {
    throw new Error(`rest: geen HTTP-status afgesproken voor foutcode "${code}"`);
  }
}
```

Dat vangnet werkt zoals bedoeld — het gooit een duidelijke fout in plaats van
stilletjes een verkeerde statuscode te sturen — maar het gevolg is dat de
module nu principieel niet meer laadt: elke `import` van `rest.mjs`
(rechtstreeks of via `server/index.mjs` → `buildServer()`) gooit bij
module-evaluatie:

```
Error: rest: geen HTTP-status afgesproken voor foutcode "INVALID_REQUEST"
    at file:///Users/ruben/game-app/server/transport/rest.mjs:136:11
```

## Reproductie

```bash
node server/index.mjs
# → crasht onmiddellijk met bovenstaande Error, geen server komt ooit online

node --test tests/integration/full-match-transport.test.mjs
# → 0 pass / 1 fail, dezelfde stacktrace (was 6/6 pass bij mijn vorige run,
#   enkele minuten vóór bb07aa9 landde)
```

Geverifieerd door zowel een losse `node server/index.mjs`-boot als door de
bestaande ketentest opnieuw te draaien — beide falen op exact dezelfde regel.

## Wat dit concreet blokkeert

- Elke lokale serverstart (`npm start`, mijn eigen L0-k6-smoketest, DT6's
  volgende chaos-run) totdat dit is opgelost.
- De net herwonnen 12/12-integratiematrix en het net-compleet-verklaarde
  k6-target (`e2e-load-target-check.md`, commit `d5af53e`) — die golden op
  het moment van meten, maar zijn dus alweer een regressie verder. Ik pas
  daar niets met terugwerkende kracht aan (dat zou de eigen, eerlijke
  tijdlijn van dat document verstoren); een volgende her-audit hoort dit mee
  te nemen.

## Wat ik niet heb gedaan

Niet gefixt — `HTTP_STATUS_BY_ERROR_CODE` in `server/transport/rest.mjs` is
niet mijn module. De fix is triviaal en eenduidig genoeg om hier toch expliciet
te benoemen (in tegenstelling tot het vorige bugrapport, waar twee
ontwerprichtingen openstonden): één regel toevoegen,
`INVALID_REQUEST: 400` (het is een misvormde-requestcode, net als
`INVALID_ANSWER_FORMAT`/`NAME_INVALID` die ook al op 400 staan), aan de
`INPUT`-sectie van de tabel. Ik voeg hem niet zelf toe omdat dat bestand
buiten mijn mandaat valt, ook al is de wijziging klein.
