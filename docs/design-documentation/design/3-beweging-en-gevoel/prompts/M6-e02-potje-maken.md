# Prompt — M6: E02, Potje maken (niveau 0 → 1)

Onderdeel van [`README.md`](README.md). Vereist `M1` (thema 2's tokens) —
inmiddels geleverd (`8eb1996`), dus dit is nu zelfstandig te bouwen.

## Brondocument

`06-MOTION-SOUND-AND-FEEDBACK.md` §4 E02: label verandert naar
`Potje maken…`, compacte progressindicator, knop blijft op plaats, success
transition naar lobby, fout stopt indicator en toont retry.
`11-DESIGN-QA-CHECKLIST.md` C: "Verandert de knop direct naar
`Potje maken…`?" — **deze checklist-regel faalt vandaag letterlijk**, zie
onder. C ontbrak tot nu in `PROGRESS.md`'s Criteria-citatie (alleen F/G/H
genoemd) — wordt hierbij toegevoegd, samen met D voor `M7`.

## Wat er nu al klopt, en wat niet (geverifieerd in `home.mjs`)

`frontend/js/views/home.mjs`:

- **De copy bestaat al**: `home.creating` = `"Potje maken…"` staat al in
  alle drie de locales en wordt al getoond — maar in `quickStartStatus`,
  een aparte paragraaf ónder de knop, niet op de knop zelf
  (`quickStartButton.textContent` blijft altijd de statische
  `t('home.quickStart')`). De checklist-vraag "verandert de knop direct
  naar…" is dus vandaag letterlijk `nee`, ook al staat de juiste tekst al
  ergens op het scherm.
- **"Knop blijft op plaats"**: al waar — de knop wordt nooit verwijderd of
  verplaatst, alleen `disabled`. Geen wijziging nodig.
- **Geen progressindicator**: er is niets anders dan tekst — geen dots,
  spinner of balk.
- **"Fout stopt indicator en toont retry"**: retry-logica bestaat al
  (`quickStartButton`'s eigen click-handler dispatcht `RETRY` als
  `state.status === 'error'`) en de knop is dan weer `enabled` — er is
  alleen nog geen indicator om te stóppen.
- **"Success transition naar lobby"**: bestaat niet — `onNavigate(...)`
  wordt synchroon aangeroepen ná `CREATE_SUCCEEDED`, geen enkele
  overgangsanimatie. **Dit is geen `home.mjs`-specifiek gat**: elke
  schermwissel in de app (`session-shell.mjs`'s mount/unmount) is vandaag
  een instant harde swap, voor alle fases, niet alleen deze. Zie
  "Wat dit expliciet niet is" hieronder.

## Wat dit is

1. **Knop-label zelf** wisselt naar `t('home.creating')` zodra
   `state.status === 'creating'` (i.p.v. alleen de aparte paragraaf) —
   maakt checklist C waar.
2. **Compacte decoratieve progressindicator** (bv. drie stippen, opacity-
   pulse via een `@keyframes`, `aria-hidden="true"`) met
   `animation-duration` uit `--motion-base`/`--motion-emphasis` en
   `--ease-enter` (de nieuwe tokens uit `base.css`) — geen eigen
   duurwaarde verzinnen.
3. **`quickStartStatus` wordt de indicator-container** (visueel, decoratief)
   in plaats van zichtbare duplicaattekst; de bestaande `aria-live="polite"`
   blijft, maar krijgt zijn tekst via een `sr-only`-span binnenin (zelfde
   patroon als `M2`'s E10-oplossing: één visueel kanaal, één
   toegankelijkheidskanaal, geen dubbele zichtbare tekst).
4. **Reduced motion**: geen extra werk nodig — dit is een nieuwe
   `animation`, geen bestaande scale zoals `M0` moest herstellen. `M0`'s
   blanket-regel (`animation-duration: 0.001ms !important` op `*` onder
   reduced motion) dekt deze indicator automatisch. Verifiëren, niet
   aannemen — zie Definition of done.

## Wat dit expliciet niet is

**"Success transition naar lobby" bouw ik hier niet als eigen fade.** Elke
schermwissel in de app is vandaag instant (`session-shell.mjs`), niet alleen
deze ene. Een losse fade uitsluitend voor home→lobby zou inconsistent zijn
met alle andere overgangen (lobby→gameplay, gameplay→scoreboard, etc.) — en
`lobby.mjs` heeft zelfs geen eigen `.screen`-klasse (zie z'n eigen
kopcommentaar), dus een `.screen`-gerichte overgang zou lobby sowieso
overslaan. Dit is een open vraag voor een gedeelde "scherm verschijnt"-
behandeling over de hele app, niet iets wat ik hier stilzwijgend eenmalig
oplos. Gelogd als openstaand punt, niet als "gedaan" — zie
`PROGRESS.md`'s afhankelijkhedensectie.

## Regels

- Geen nieuwe hardcoded duurwaarden — uitsluitend de bestaande
  `--motion-*`/`--ease-*`-tokens.
- Geen zichtbare tekstverdubbeling (knop + status-paragraaf mogen niet
  allebei dezelfde zin tonen).
- Geen scope-uitbreiding naar een generieke schermovergang (zie boven).

## Definition of done

- Knop toont zichtbaar `"Potje maken…"` tijdens `creating` (handmatig of
  via Playwright DOM-check, geen unit-testlaag — `home.mjs` heeft er geen,
  zoals de rest van `views/`).
- Progressindicator zichtbaar tijdens `creating`, verdwijnt bij `error` of
  navigatie weg van het scherm.
- Geverifieerd via CDP (`page.emulateMedia({reducedMotion:'reduce'})` +
  `getComputedStyle`) dat de indicator-animatie onder reduced motion
  vrijwel instant is, zonder dat hiervoor een aparte regel nodig was —
  expliciet vermelden of `M0`'s blanket-regel dit inderdaad alleen al dekte.
- `PROGRESS.md`: E02 van niveau 0 naar 1, Criteria-regel uitgebreid met
  checklist-sectie C.
- `node --test`: geen regressie (deze module heeft geen eigen tests, dus
  dit raakt alleen de bredere suite als er iets anders breekt).
