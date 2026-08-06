# Voortgang — CT (gedeelde contentmodule)

Bijgewerkt: 2 augustus 2026. Mandaat: [`prompts/CT1-shared-content-module.md`](prompts/CT1-shared-content-module.md).
Leidend contract: [`../game-rules-plan/CONTENT-POOL-INTERFACE.md`](../game-rules-plan/CONTENT-POOL-INTERFACE.md).

| Onderdeel | Status | Toelichting |
| --- | --- | --- |
| Extractiestap (`build-content.mjs`) | ✅ | Herhaalbaar script; leest `data/countries.js` + `data/country-facts.js` via vm-context; `app.js` en `data/` onaangeraakt; harde validatie (dubbele iso2, ontbrekende facts/continent/naam ⇒ buildfout) |
| Landenpool (`countries.data.mjs`) | ✅ | Gegenereerd: 230 landen, per difficulty 30/66/104/30, zes continenten — exact de referentiecijfers uit het contract |
| API (`index.mjs`) | ✅ | `getCountryPool()` (diep bevroren), `CONTENT_VERSION` (2026.08.1), `mapRoomDifficulty()` (gotcha 2: normal→medium, één plek) |
| Tests (`index.test.mjs`) | ✅ | 9/9 groen, incl. integratietest: de echte `buildMatchQuestionPlan()` accepteert de pool voor flags_mc, capitals_mc, higher_lower en odd_one_out (10 unieke rondes elk) én de CJS↔ESM-interop |
| Gotcha 1 (`capital` expliciet) | ✅ | `capital` altijd aanwezig (object of `null`); door test afgedwongen |
| Aliassen (golf 2, typen) | ✅ meegenomen | `aliases` + `capitalAliases` per taal in elke entry; GR4 leest ze niet (mag van het contract) |
| Nepvlag-spec (`generateFlagSpec(seed)`) | ✅ | `flag-spec.mjs` — seed-deterministisch (xmur3+mulberry32), vocabulaire gepind op de bestaande canvasrenderer (`flag-renderer-1`), mét echte-vlag-wering op kleurklasse (verbetering t.o.v. singleplayer); 10 tests incl. 2000-seeds-weringscheck en integratie met `buildMatchQuestionPlan` |
| Logo-/voetbalcontent | ⏸️ bewust | Golf 2 + feature flag; niet nodig voor Golf 1 |

## Consequentie voor consumenten

- **INT-A:** `server/composition/content-source.mjs` kan zijn tijdelijke pool
  vervangen door `import { getCountryPool, CONTENT_VERSION, mapRoomDifficulty }
  from '../../shared/content/index.mjs'` — één import, conform zijn mandaat.
- **real_or_fake_flag** blijft de enige Golf 1-vorm die nog niet uit deze module
  bediend wordt (wacht op de seed-deterministische spec, 🔵 hierboven).
- Bij wijziging van `data/`: `node shared/content/build-content.mjs` opnieuw
  draaien én `CONTENT_VERSION` verhogen in `index.mjs`.
