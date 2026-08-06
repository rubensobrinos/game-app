# Prompt — T5-6: De testmatrix als doorlopend proces

**Status: deels uitvoerbaar, deels wacht op het Playwright-`deps`-besluit**
(zie `prompts/README.md`). Laag 1's contrastscript kan los; de Playwright-
sweep niet als committed proces zolang die dependency er niet is — de
ad-hoc-metingen uit `T5-1`/`T5-2`/`T5-3`/`T5-4` zijn al wel uitgevoerd en
kunnen later als eerste laag-1-specs dienen.

## Waarom dit geen simpele "doe het gewoon"-prompt is

`08` §9 leest als een checklist, maar de eigen conclusie van dit thema
waarschuwt precies hiervoor: **"Alles is gecontroleerd in headless Chromium op
één viewport."** Een testmatrix die één keer wordt afgevinkt en daarna nooit
meer bijgewerkt, verwordt binnen een release of twee tot dezelfde valse "2,
gelezen" die deze `PROGRESS.md`-pas net probeert te repareren. Dit thema
levert dus geen eenmalig testrapport, maar een **proces**: wat automatisch
kan (en dus bij elke wijziging opnieuw draait), en wat een mens met een
toestel periodiek moet herhalen.

## Brondocument

`08-ACCESSIBILITY-AND-RESILIENCE.md` §9, `10-IMPLEMENTATION-ROADMAP.md` §11
"Release gates" (accessibility-check en performancecheck zijn daar een harde
voorwaarde per fase, niet een eindsprint).

## Contract

Twee lagen, niet één lijst:

### Laag 1 — geautomatiseerd, draait bij elke wijziging aan `frontend/`

- De bestaande `node --test`-suite (geen hardgecodeerd aantal hier — dat
  veroudert per definitie tussen twee commits door; `npm test` zelf is de
  bron van waarheid).
- Playwright-sweep: **wacht op het `deps`-besluit** (zie
  `prompts/README.md`'s Playwright-notitie). `T5-1`/`T5-2`/`T5-3`/`T5-4` zijn
  ondertussen wél al ad-hoc gemeten (niet als committed spec) — die metingen
  vervangen laag 1 niet, ze bewijzen alleen dat de onderliggende schermen nu
  kloppen. Zodra Playwright een projectdependency is, worden die ad-hoc-
  scripts de eerste laag-1-specs, geen nieuwe scripts vanaf nul.
- Accessibility-tree-snapshot per scherm (zie `T5-5`'s "wat al automatisch
  kan") — zelfde afhankelijkheid.
- Contrastberekening als script (zoals gebruikt voor de licht-thema-fix,
  commit `58eba07`) — bij elke tokenwijziging opnieuw te draaien in plaats
  van opnieuw met de hand na te rekenen. Geen Playwright nodig, kan los.

### Laag 2 — mens met toestel, periodiek (niet per PR)

- `T5-5`'s screenreader-testplan.
- iOS Safari + Android Chrome op middelmatige hardware — met name
  performant genoeg bij grotere spelersaantallen (`07` §9's schaaltabel,
  100+ spelers).
- Trage 3G/packet loss-simulatie (Chrome DevTools throttling of
  gelijkwaardig) tegen de **echte** transportlaag, niet de mock — reconnect-
  gedrag is met `transport-mock.mjs` sowieso niet te testen (geen simulatie
  van een echte disconnect, zie `UI-PROGRESS.md`).
- 2, 8, 35 en gesimuleerde 200 spelers (`07` §9) — de deelnemerslijst-
  aggregatie die dat vraagt (`21–35: grid + recente joins`, `100+: geen
  permanente volledige namenmuur`) bestaat trouwens nog niet en is zelf een
  aparte bouwtaak, geen testtaak; hier alleen signaleren.

## Regels

- Laag 1 hoort in dezelfde `node --test`-achtige gewoonte als de rest van de
  repo: geen los, makkelijk te vergeten script.
- Laag 2 wordt niet "later een keer" — leg een concreet moment vast (bv. vóór
  elke Fase-afsluiting uit `10`, conform §11's release gates) in plaats van
  een ongedateerde intentie.
- Geen nieuw bewijsniveau boven "gemeten" verzinnen — Laag 1's automatische
  controle is en blijft een aparte, zwakkere categorie dan een echte
  screenreadersessie; wees daar in `PROGRESS.md` expliciet over per rij.

## Definition of done

- Laag 1's contrastscript en de `node --test`-gewoonte bestaan als draaibaar
  onderdeel, niet als voornemen — dit deel is niet geblokkeerd en kan nu.
- Laag 1's Playwright-sweep (screenshots + a11y-tree) blijft "zodra het
  `deps`-besluit valt" — geen committed spec bouwen zonder de dependency.
- Laag 2 heeft een vastgelegd eerstvolgend moment.
- `PROGRESS.md`'s Testmatrix-rij gaat van "0, —" naar een niveau dat het
  onderscheid tussen de twee lagen (en binnen laag 1, wat wel/niet
  geblokkeerd is) zichtbaar maakt, in plaats van één cijfer dat alles
  verbergt (zelfde principe als `NIVEAUS.md`'s eigen regel 3: "een
  gemiddelde verbergt net zo goed waar we sterk staan als waar we zwak
  staan").
