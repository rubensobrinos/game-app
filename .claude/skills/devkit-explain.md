---
name: devkit-explain
description: Vraag uitleg op over een devkit-profiel, gate of mapconventie.
---

# devkit explain

Bij twijfel over wat een gate doet, waarom hij bestaat, of welke map waarvoor dient:

```bash
devkit explain profile python-api      # tech stack, gates, structuur
devkit explain gate gitleaks            # wat de gate doet, override-procedure
devkit explain folder docs/decisions    # doel, verplicht/optioneel
```

Output is didactisch — gebruik dit voordat je een gate negeert of een
afwijkende structuur voorstelt.
