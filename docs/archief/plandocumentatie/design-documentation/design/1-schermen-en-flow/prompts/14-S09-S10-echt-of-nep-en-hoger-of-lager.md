# Prompt — 14: `S09` Echt of Nep + `S10` Hoger of Lager

Bouwtaak, geen verzoek — in tegenstelling tot 10–13 hiernaast. Onderdeel van
[`README.md`](README.md).

## Waarom dit nu een prompt is en geen `HANDOFF` meer

`../PROGRESS.md` zei tot 3 augustus 2026 dat `S09`/`S10` "buiten de
lanceerscope" vielen. Dat was fout (principe 8, `handoff-principles.md`):
`docs/multiplayer/PRODUCT.md` §Spelvormen in multiplayer noemt
`real_or_fake_flag` en `higher_lower` expliciet als twee van de vijf **Golf 1
— MVP-launch**-spelvormen, naast het al gebouwde `flags_mc` (S08). Geverifieerd
dat de fundering er al staat, niet aangenomen:

- `server/rules/question-selection.js` — `selectRealOrFakeFlagQuestion`,
  `selectHigherLowerQuestion` bestaan en zijn getest.
- `server/rules/validators.js` — regels 99–139: valideert
  `correctAnswer.choice ∈ {real,fake}` resp. `correctAnswer.side ∈ {0,1}`.
- `docs/multiplayer/PROTOCOL.md` §Voorbeeld `round:started` — volledige
  voorbeeldpayloads per `gameType`, hieronder overgenomen.

Wat wél nog ontbreekt en apart blijft (niet dit prompt, `UI-17`,
`HANDOFF-UI.md`, al gemeld aan `product-plan` via
`docs/game-flow-plan/GF-HANDOFF-TO-INT-A.md`): `client/flow/`'s
`HostConfig.gameTypes` staat vast op `['flags_mc']`, er is geen UI om een
andere spelvorm te kiezen. Dat blokkeert dit prompt niet — een ronde van dit
type kan al server-side ontstaan zodra `gameTypes` iets anders bevat dan
`['flags_mc']` (bv. rechtstreeks in een test of tijdelijk in
`transport-mock.mjs`); de S09/S10-schermen zelf zijn onafhankelijk bouwbaar en
testbaar.

## Brondocument

`04-SCREEN-SPECIFICATIONS.md` S09/S10:

> **S09 — Echt of Nep.** Zelfde shell, eigen karakter: centrale vlag/visual,
> twee duidelijke antwoordopties, microcopy met spanning (`Echt`/`Nep`),
> reveal met een korte "authenticiteitsstempel" of atlasmotief, semantische
> kleur pas na sluiting. Geen horror- of casino-esthetiek.
>
> **S10 — Hoger of Lager.** Zelfde shell, duelcompositie: twee landen/waarden
> visueel vergelijkbaar, primaire keuze `Hoger`/`Lager` of directe
> side-select, reveal animeert de waarden kort naar hun werkelijke positie,
> toegankelijk alternatief beschrijft de uitkomst tekstueel.

"Zelfde shell" = de bestaande rondechrome die S08 al heeft (timer, status
"Antwoord versturen…"/vergrendeling uit S11, voortgang `3/7 beantwoord` uit
S12) — niet de vraag/opties-rendering zelf, die is per spelvorm anders.
`gameplay.mjs` is vandaag expliciet flags_mc-only (bestandskop: "DOM-laag van
het spelscherm (flags_mc)") — dit prompt beslist zelf hoe dat gesplitst wordt
(nieuwe zustermodules per spelvorm vs. een branch in `gameplay.mjs`'s
`update()`), zolang de gedeelde chrome niet gedupliceerd wordt.

## Exacte contracten

### `real_or_fake_flag` — `round:started`

Twee subvarianten van `question.kind`:

```json
// kind: "real" — een bestaand land
{ "question": { "kind": "real", "iso2": "IT" } }

// kind: "generated" — geen bestaand land, een opgewekte vlagspec
{
  "question": {
    "kind": "generated",
    "seed": "fx_91b2c3a0",
    "rendererVersion": "flag-renderer-1",
    "spec": { "pattern": "nordic", "palette": ["#003082", "#FFFFFF", "#CE1126"] }
  }
}
```

`round:answer`-payload: `{ answer: { choice: "real" | "fake" } }`.
`correctAnswer` (pas in `round:ended`): `{ choice: "real" | "fake" }` — nooit
vooraf zichtbaar.

De `generated`-vorm heeft geen bestaand vlagasset (`flagAssetPath()` in
`gameplay.mjs` gaat uit van een `iso2`) — deze vorm moet uit `spec`
(`pattern`/`palette`) gerenderd worden, niet uit een asset-lookup. Zoek geen
bestaand renderpad hiervoor; dat bestaat nog nergens in de frontend (geverifieerd:
geen enkele `.mjs` onder `frontend/` refereert `pattern`/`palette` op deze
manier). Simpele CSS-gebaseerde weergave (bv. gestreepte/gekleurde
achtergrond volgens `palette`) is voldoende voor niveau 1 — geen eigen
SVG-generator bouwen.

### `higher_lower` — `round:started`

```json
{
  "question": {
    "metric": "population",
    "sides": [
      { "side": 0, "iso2": "DE" },
      { "side": 1, "iso2": "PT" }
    ]
  }
}
```

`round:answer`-payload: `{ answer: { side: 0 | 1 } }`. `correctAnswer`:
`{ side: 0 | 1 }`. De rauwe metriekwaarden komen pas in `round:ended` mee
(niet vooraf — anders is het antwoord af te leiden, dezelfde klasse risico als
`INT-5`/`DECISIONS.md` #38 voor `flags_mc`).

`metric` is vandaag alleen `"population"` in het geziene voorbeeld — bouw geen
aanname over een vaste set metrics; toon het label dat bij de waarde van
`metric` hoort (nieuwe locale-sleutel per metric, uitbreidbaar).

## Wat gebouwd moet worden

1. **Rendering per `gameType`.** `round-model.mjs` bewaart `question` al
   generiek (geen wijziging nodig daar) — de DOM-laag beslist per `gameType`
   welke content te tonen. Voeg toe: vlag-versus-stempel-lay-out (S09) en
   twee-landen-duel-lay-out (S10), beide met de bestaande timer/vergrendel/
   voortgangs-chrome uit S08/S11/S12 hergebruikt, niet herbouwd.
2. **`round:answer` verzenden met de juiste vorm** (`{choice}` resp. `{side}`)
   — niet `{optionId}` zoals `flags_mc` gebruikt. Controleer dat de bestaande
   verzendstatus-flow (`idle → sending → accepted/rejected`) generiek genoeg
   is voor beide vormen (die is nu al vorm-onafhankelijk in `round-model.mjs`
   — alleen de payload-vorm hoort bij de DOM-laag).
3. **Reveal.** S09: authenticiteitsstempel na sluiting (geen kleur vooraf).
   S10: de daadwerkelijke metriekwaarden (uit `round:ended`) kort tonen naast
   de vergelijking, plus een tekstuele samenvatting voor het toegankelijke
   alternatief (`04` eist dit expliciet — geen puur visuele animatie zonder
   tekst-equivalent).
4. **Locales.** Nieuwe sleutels in alle drie (`nl`/`en`/`es`): S09's
   `Echt`/`Nep`-labels + stempeltekst, S10's `Hoger`/`Lager`-labels +
   metric-labels (te beginnen met `population`).

## Wat dit prompt niet doet

- Geen `client/flow/`-wijziging (`HostConfig.gameTypes` blijft vast op
  `['flags_mc']`) — dat is `UI-17`'s al-gemelde punt, een andere eigenaar.
  Verifieer dit prompt met een tijdelijke test-only manier om een ronde van
  dit type te laten ontstaan (bv. rechtstreeks een `round:started`-event door
  een testharnas laten injecteren), niet door de spelvorm-selector zelf te
  bouwen.
- `odd_one_out` (de vijfde Golf-1-spelvorm) heeft geen eigen `S`-nummer in
  `04` — blijft buiten dit prompt.
- Geen nieuwe SVG/canvas-vlaggenrenderer voor `kind: "generated"` — een
  CSS-benadering volstaat voor niveau 1 (zie hierboven).

## Definition of Done

- [ ] S09 en S10 renderen correct vanuit een echte `round:started`-payload van
      dat `gameType` (test met een geïnjecteerd event, geen aanname).
- [ ] `round:answer` verstuurt `{choice}` resp. `{side}`, nooit `{optionId}`.
- [ ] Geen kleur/goed-fout-signaal vóór `round:ended` (zelfde discipline als
      `flags_mc`).
- [ ] Reveal toont voor S10 een tekst-equivalent naast de visuele vergelijking.
- [ ] `node --test frontend/**/*.test.mjs` blijft groen; nieuwe tests voor
      beide rendering- en verzendpaden.
- [ ] `../PROGRESS.md`'s S09/S10-rijen bijgewerkt naar wat er echt staat.

## Regels

- Geen `HostConfig`/`SETTABLE_CONFIG_KEYS`-wijziging (andere eigenaar, zie
  hierboven).
- Geen aanname over `metric`-waarden buiten `population` zonder het als open
  punt te noemen in `../PROGRESS.md`.
