# Prompt — T0b: Statusregel + canoniek testcommando + CI-kloof

Onderdeel van [`docs/deployment-and-testing-plan/README.md`](../README.md), fase
T0b. Doel: één gerichte aanvulling in dat README nadat T0 is afgerond — bewust los
van T0's eigen bestandenbudget (zie [`REVIEW.md`](REVIEW.md) #1).

## Context

- Vereist: T0 is afgerond, d.w.z. `tests/{contract,integration,e2e,load,chaos}/`
  bestaan elk met een `.gitkeep`. Verifieer dit eerst met `find tests -type f`
  voordat je begint.
- [`REVIEW.md`](REVIEW.md) #9: de bestaande, devkit-managed CI
  (`.github/workflows/ci.yml`) draait `npm ci` + ESLint + Jest en dekt geen
  `node:test`-bestanden; deze repo heeft geen `package.json`. Dat gat mag niet
  stilzwijgend blijven staan terwijl T1–T3 lokaal groen worden.

## Stappen

1. Voeg in `docs/deployment-and-testing-plan/README.md` een korte statusregel toe
   (bijvoorbeeld onder de T0-alinea in Fasering) die vermeldt: T0 is afgerond, de
   vijf mappen bestaan, verificatie gebeurde met `find tests -type f` (nog geen
   testrunner-commando — er staan nog geen testbestanden in).
2. Documenteer het canonieke lokale testcommando-sjabloon per laag, te gebruiken
   zodra die laag daadwerkelijk bestanden krijgt, bijvoorbeeld
   `node --test tests/contract/*.test.js`. Expliciet als sjabloon, niet als iets
   dat nu al iets uitvoert (de mappen bevatten alleen `.gitkeep`).
3. Herhaal expliciet de CI-kloof: de managed CI dekt deze boom niet; dat wordt pas
   opgelost na een goedgekeurd T7-voorstel. Tot die tijd draaien deze tests
   uitsluitend lokaal — zeg dat letterlijk, laat het niet impliciet.
4. Wijzig geen ander bestand. Raak in het bijzonder `.github/workflows/ci.yml` niet
   aan — dat blok is devkit-managed.

## Harde grenzen

- Precies 1 bestand gewijzigd: `docs/deployment-and-testing-plan/README.md`.
- Geen nieuwe mappen, geen testbestanden, geen dependency.
- Geen wijziging aan enig CI-bestand.

## Definition of done

- README bevat een statusregel dat T0 is afgerond, met locatie en
  verificatiecommando.
- README documenteert het canonieke testcommando-sjabloon per laag én de expliciete
  CI-kloof, met een concrete verwijzing naar T7 als plek waar dat wordt opgelost.
- Alleen dat ene bestand is gewijzigd.
