<!-- BEGIN DEVKIT MANAGED -->
<!-- Voeg lokale wijzigingen BUITEN deze markers toe — devkit update overschrijft alleen dit blok. -->
# Repo: profiel `react-native-app`

React Native app, TypeScript, Expo
Taal: **typescript**

## Hoe deze repo werkt

- Standaarden komen uit het devkit-profiel — zie `devkit show-profile` voor de details.
- Mandatory gates draaien via `devkit ci` (lokaal) en de GitHub Actions CI (remote).
- Voor uitleg over een specifieke gate: `devkit explain gate <naam>`.
- Voor het volledige beleid (gates, advisory, autonomy): `devkit policy --json`.

## Beslisbevoegdheid

**Zelfstandig uitvoeren** (geen bevestiging nodig):
- lint
- test
- format
- refactor
- docs
- bugfix

**Altijd vragen aan een human**:
- design
- ux
- deps
- prod
- architecture

## Autonomy-limieten
- max bestanden per actie: **15**
- max regels per actie: **5000**
- verboden paden:
  - `infra/prod/**`
  - `.github/workflows/deploy.yml`

Verifieer voor elke commit: `devkit check-autonomy --staged`.
Agents zien een overtreding als blokkering (exit 6); humans krijgen een waarschuwing.

## Skills

- `.claude/skills/devkit-policy.md` — toont de actieve gates, advisory en agent-rules.
- `.claude/skills/devkit-explain.md` — uitleg-on-demand voor profielen, gates en mappen.

## Rollback

Bij problemen met de gegenereerde `.claude/`-configuratie:

```bash
rm -rf .claude/
git restore .pre-commit-config.yaml
devkit doctor --here
```
<!-- END DEVKIT MANAGED -->
