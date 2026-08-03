# Prompt — T5-6: De testmatrix als doorlopend proces

**Status in `PROGRESS.md`:** Testmatrix | niveau 0 | bewijs: **—** ("`08` §9
vraagt om iOS Safari, Android, screenreader, reduced motion, 200% zoom en
trage verbinding. Geen daarvan gedaan.")

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

- `node --test` (bestaat al, 363/363).
- Playwright-sweep: de screenshotcontroles uit `T5-1` (zoom) en `T5-2`
  (landscape), plus een accessibility-tree-snapshot per scherm (zie `T5-5`'s
  "wat al automatisch kan"). Dit is geen vervanging van een echte
  screenreader, wél een goedkope regressiewacht die bestaande, al-geverifieerde
  labels/rollen bewaakt.
- Contrastberekening als script (zoals gebruikt voor de licht-thema-fix,
  commit `58eba07`) — bij elke tokenwijziging opnieuw te draaien in plaats
  van opnieuw met de hand na te rekenen.

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

- Laag 1 bestaat als draaibaar script/testbestand, niet als voornemen.
- Laag 2 heeft een vastgelegd eerstvolgend moment.
- `PROGRESS.md`'s Testmatrix-rij gaat van "0, —" naar een niveau dat het
  onderscheid tussen de twee lagen zichtbaar maakt, in plaats van één cijfer
  dat beide verbergt (zelfde principe als `NIVEAUS.md`'s eigen regel 3: "een
  gemiddelde verbergt net zo goed waar we sterk staan als waar we zwak
  staan").
