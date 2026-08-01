---
name: devkit-policy
description: Toon het devkit-veiligheidsbeleid (gates, advisory, autonomy, LLM) van het actieve profiel.
---

# devkit policy

Wanneer je wilt weten welke gates blokkerend zijn, welke advisory, en welke autonomy-regels gelden:

```bash
devkit policy --json
```

JSON-output bevat:

- `mandatory`: blokkerende pre-commit gates
- `advisory`: niet-blokkerende scanners
- `llm`: actief LLM-profiel
- `agent_rules.decisions`: wat zelfstandig mag (`approve`) en wat goedkeuring vraagt (`always_ask`)
- `agent_rules.autonomy`: limieten op files/lines/forbidden_paths

Gebruik dit bij voorkeur als context voor besluitvorming i.p.v. te raden.
