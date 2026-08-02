# Prompt — PR0: Scaffold

Dekt fase **PR0** uit [`../README.md`](../README.md#fasering). **Status: uitgevoerd.**
Dit bestand is retroactief geschreven (net als de zusterplannen doen voor hun
scaffold-fase) zodat elke fase een eigen promptbestand heeft, ook de fases die al vóór
de eerste `prompts/`-batch zijn uitgevoerd.

## Brondocument

`../README.md`, fase PR0: "Mapstructuur (voorstel, niet definitief): `server/protocol/`,
naast `server/rules/` (game-rules-plan) en `server/architecture/` (architecture-plan).
Testrunner: `node --test`, geen `package.json`-wijziging. Checkpoint: ik meld waar ik de
map plaats vóórdat ik buiten `docs/` iets aanmaak, en stem af met de
`architecture`-eigenaar zodat dit niet vooruitloopt op diens AR5/AR6-voorstel voor de
serverstructuur."

## Wat er is uitgevoerd

- Map aangemaakt: `server/protocol/`, met daarin uitsluitend `README.md` (geen code in
  deze fase).
- Moduleformaat vastgelegd: platte JavaScript, native ES modules via de
  `.mjs`-extensie, JSDoc voor typering, geen TypeScript.
- Testrunner vastgelegd: `node --test`, altijd tegen een expliciet bestand (bijv.
  `node --test server/protocol/envelope.test.mjs`), nooit tegen een directorypad.
- Geen `package.json` aangemaakt of gewijzigd, geen nieuwe dependency.
- De negen modules uit de modules-tabel benoemd als toekomstige inhoud van deze map.

## Checkpoint — hoe die is afgehandeld

De locatiekeuze is niet vooraf goedgekeurd door de `architecture`-eigenaar (dat
checkpoint stond nog open toen dit werd uitgevoerd), maar wél expliciet gemeld in het
gesprek waarin dit gebouwd is, met de kanttekening dat de map kan verschuiven zodra
`architecture-plan`'s AR5/AR6-voorstel voor een serverskeleton landt. Dat voorstel is
op het moment van schrijven nog niet uitgevoerd; deze map blijft dus voorlopig
provisorisch, niet bindend.

## Niet in scope

- Elke daadwerkelijke code — dat is PR1 en later.
- Een definitieve mapindeling/serverstructuur — `architecture`, hoort bij
  `architecture-plan`'s AR5/AR6.

## Definition of done

- `server/protocol/` bestaat met een `README.md` die moduleformaat, testrunner en
  locatie-voorbehoud vastlegt.
- Geen `package.json`, geen dependency.
