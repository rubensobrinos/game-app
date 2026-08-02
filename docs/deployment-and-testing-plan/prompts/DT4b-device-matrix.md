# Prompt — DT4b: Echte-device-/handmatige matrix

Onderdeel van [`README.md`](../README.md), fase DT4b. Volledig nu uitvoerbaar —
geen checkpoint nodig, dit wordt nooit geautomatiseerde code.

## Context

- Playwright (of enige browser-automatiseringstool) kan dit niet betrouwbaar
  bewijzen: app-switch, schermlock, native share sheets, gedrag op echte
  Safari/iPhone, en echte trage-4G-netwerkcondities. De bron
  (`DEPLOYMENT-AND-TESTING.md` §Testlagen → Browser/E2E) eist expliciet zowel
  emulatie als echte toestellen.
- Dit is dus bewust een runbook/checklist voor een mens, nooit een test die
  "groen" kan worden.

## Stappen

1. Maak `docs/deployment-and-testing-plan/device-matrix.md`.
2. Eén rij per scenario met kolommen: scenario | toestel/browser (bijv. "echte
   iPhone, Safari"; "echte Android, Chrome") | stappen | verwacht resultaat |
   laatst uitgevoerd (leeg bij aanmaak) | uitkomst (leeg bij aanmaak). Dek
   minimaal: app-switch en terugkeer tijdens een actieve ronde; schermlock en
   ontgrendelen; native share sheet openen vanuit de "Delen"-actie
   (`DEPLOYMENT-AND-TESTING.md` §Assets: "QR lokaal in de browser genereren");
   gedrag op een trage/gethrottelde 4G-verbinding; host speelt mee op een klein
   scherm zonder dat de bedieningsbalk de antwoordinterface verdringt (overlap met
   DT4a, hier specifiek op een echt klein fysiek scherm getoetst).
3. Voeg een korte "Hoe te gebruiken"-sectie toe: dit document wordt handmatig
   ingevuld tijdens/na een testronde, niet vooraf al met uitkomsten.

## Harde grenzen

- Eén nieuw bestand: `docs/deployment-and-testing-plan/device-matrix.md`.
- Geen code, geen automatisering, geen nieuwe dependency.

## Definition of done

- Bestand bestaat, dekt alle in de context genoemde scenario's, en de kolommen
  "laatst uitgevoerd"/"uitkomst" staan leeg (nog niet ingevuld — dat is een
  toekomstige, handmatige actie, geen onderdeel van deze schrijffase).
