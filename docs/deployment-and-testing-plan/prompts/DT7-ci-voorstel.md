# Prompt — DT7: CI-volgordevoorstel

Onderdeel van [`README.md`](../README.md), fase DT7. Volledig nu uitvoerbaar als
geschreven voorstel — het raakt geen bestaand CI-bestand, dus geen checkpoint nodig
om te schríjven. Alleen **activeren** (een workflow-bestand toevoegen) is
checkpoint-plichtig.

## Context

- De bestaande, devkit-managed `.github/workflows/ci.yml` draait `npm ci` + ESLint
  + Jest en dekt de `node:test`-boom onder `tests/` niet (zie README.md,
  Uitgangspunt 7 en DT0b). Dat gat lost dit voorstel op — als voorstel, niet als
  directe wijziging.
- `agent_rules.autonomy.forbidden_paths` (CLAUDE.md / `devkit policy --json`) sluit
  `.github/workflows/deploy.yml` expliciet uit; `ci.yml` staat daar niet in, maar
  het devkit-managed blok erin wijzig ik nooit handmatig (README.md, Uitgangspunt
  7).
- `agent_rules.decisions.always_ask` bevat `deps`; k6/Playwright-stappen in een
  toekomstige workflow zijn dus alleen als voorstel op te nemen, niet als iets dat
  al draait.

## Stappen

1. Maak `docs/deployment-and-testing-plan/ci-proposal.md`.
2. Beschrijf een voorgestelde **nieuwe, aparte** workflow (bijv.
   `.github/workflows/tests-node.yml`, niet het bestaande `ci.yml`-bestand) die:
   - draait op dezelfde triggers als het bestaande `ci.yml` (push/PR op alle
     branches);
   - de lagen in volgorde uitvoert, aansluitend op `agent_rules.deployment_order`
     (`lint → security → test → validate → build → deploy`): eerst per module de
     `node --test`-unittests van elke eigenaar (`server/rules`,
     `server/architecture`, `server/protocol`, `server/data`, `client/flow`,
     `tests/fixtures`), dan `tests/contract/*.test.js`, dan
     `tests/integration/*.test.js` (leeg/geen-op zolang DT3b niets heeft
     geactiveerd — moet dus geen falende stap worden als er nog geen
     `.test.js`-bestanden bestaan);
   - E2E/load/chaos **niet** standaard op elke push laat draaien (die vereisen
     eerst hun eigen `deps`-akkoord en blijven handmatig/`workflow_dispatch`
     totdat dat er is).
3. Benoem expliciet: dit voorstel wijzigt geen bestaand bestand, voegt niks toe aan
   het devkit-managed blok, en activeert zichzelf niet — het is input voor een
   mens om te beoordelen.

## Harde grenzen

- Eén nieuw bestand: `docs/deployment-and-testing-plan/ci-proposal.md`. **Geen**
  wijziging aan `.github/workflows/ci.yml` of enig ander bestaand workflow-bestand,
  en geen nieuw workflow-bestand aanmaken in `.github/workflows/` — dat is de
  activatiestap, apart geautoriseerd (zie hieronder).

## Definition of done

- Bestand bestaat, beschrijft een concrete, leesbare YAML-achtige structuur (mag
  als codeblok in het voorstel staan) zonder dat er een echt workflow-bestand is
  aangemaakt.

---

## Activatie — apart checkpoint

**Checkpoint: STOP hier. Het daadwerkelijk aanmaken van
`.github/workflows/tests-node.yml` (of vergelijkbaar) vraagt expliciet akkoord,
los van het schrijven van dit voorstel. Dit lost pas na dat akkoord de CI-kloof uit
DT0b op.**
