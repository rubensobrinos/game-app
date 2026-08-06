# Documentatie — waar staat wat

Vier lagen, met een verschillende houdbaarheid. Als je twijfelt welke wint:
`multiplayer/` boven alles, en `STATUS.md` boven elk voortgangsbestand.

## 1. Canoniek — dit is de waarheid

| Bestand | Waarover |
| --- | --- |
| [`multiplayer/PRODUCT.md`](multiplayer/PRODUCT.md) | wat Rounda is en voor wie |
| [`multiplayer/DECISIONS.md`](multiplayer/DECISIONS.md) | elk genomen besluit, genummerd, met de reden |
| [`multiplayer/PROTOCOL.md`](multiplayer/PROTOCOL.md) | elk event over de lijn, en elke foutcode |
| [`multiplayer/DATA-MODEL.md`](multiplayer/DATA-MODEL.md) | de documenten, sleutels en TTL's |
| [`multiplayer/ARCHITECTURE.md`](multiplayer/ARCHITECTURE.md) | de lagen en waarom ze zo liggen |
| [`multiplayer/GAME-FLOW.md`](multiplayer/GAME-FLOW.md) | de fases van een partij |
| [`multiplayer/GAME-RULES.md`](multiplayer/GAME-RULES.md) | scoring, timing, reactiezinnen |
| [`STATUS.md`](STATUS.md) | waar we vandaag staan |

Wijzigt er iets aan het gedrag, dan hoort het hier terug te komen. Een besluit
dat alleen in een commit-boodschap staat, bestaat over een maand niet meer.

## 2. Openstaand — wat er nog moet gebeuren

[`openstaand/`](openstaand/) bevat **alleen werk dat nog niet af is**, één
bestand per klus, met de uitwerking erin. Zodra iets af is verdwijnt het hier
en komt het niet terug in statusoverzichten.

- [`openstaand/README.md`](openstaand/README.md) — de lijst, per maat
- [`openstaand/PLAN-BOUWEN.md`](openstaand/PLAN-BOUWEN.md) — volgorde en afweging
- [`openstaand/refactor/`](openstaand/refactor/) — de opsplitsopdrachten

Maten in plaats van uren: XS, S, M, L, XL. Een agent kan niet weten hoe lang
iets duurt, en een schatting in dagen klopt nooit.

## 3. Bouwdocumentatie — historisch, maar nog geciteerd

De `*-plan`-mappen zijn de uitwerkingen waarmee de app gebouwd is:
`protocol-plan/`, `data-model-plan/`, `integration-plan/`, `game-rules-plan/`,
`game-flow-plan/`, `frontend-plan/`, `architecture-plan/`, `product-plan/`,
`deployment-and-testing-plan/`.

**Ze staan er nog omdat de code eraan refereert.** Tientallen
codecommentaren verwijzen naar een prompt of een besluit in deze mappen — dat
is waar de "waarom staat dit hier zo"-uitleg zit. Verplaatsen betekent die
verwijzingen breken, en dan is de uitleg weg terwijl de code blijft.

Ze worden niet meer bijgewerkt. Wijkt zo'n document af van `multiplayer/`, dan
wint `multiplayer/`.

Hetzelfde geldt voor [`PLAN-CONVERGENTIE.md`](PLAN-CONVERGENTIE.md) en
[`PROGRESS.md`](PROGRESS.md): historisch, nog geciteerd, niet leidend.

## 4. Archief — afgerond, komt niet terug

[`archief/`](archief/) bevat wat klaar is: de mobiele UX-ronde met haar 58
punten, de agentopdrachten van ronde 3, de eerste pilot, en de
plandocumentatie waar niets meer naar verwijst.

Hier wordt niet meer in gewerkt. Het staat er zodat een besluit van drie weken
geleden nog na te lezen is, niet om als werkvoorraad te dienen.

## Draaiboeken

- [`pilot-b-draaiboek.md`](pilot-b-draaiboek.md) — de groepspilot die nog moet
  draaien. Dat is op dit moment het grootste openstaande risico: alles is
  getest, niets is met echte mensen gespeeld.
- [`handoff-principles.md`](handoff-principles.md) — hoe werk wordt overgedragen
