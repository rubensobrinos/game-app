# Prompt — 07: Ronde-reveal + Sociale headline (S13/S14)

Onderdeel van thema 1 ([`../PROGRESS.md`](../PROGRESS.md)). Roadmap noemt
"reveal/leaderboard" **zeer hoge impact, middel/hoge complexiteit** — dit is
de zwaarste prompt van de negen. Lees 'm helemaal voordat je begint; een deel
van S14 is niet zonder meer bouwbaar met de data die er nu is.

## Brondocument

[`../03-GAME-FLOW-AND-STATES.md`](../03-GAME-FLOW-AND-STATES.md) §4.5, §5.5,
[`../04-SCREEN-SPECIFICATIONS.md`](../04-SCREEN-SPECIFICATIONS.md) S13, S14.

## Wat er nu gebeurt

`gameplay.mjs`'s `result`-blok toont bij `round:ended` in één keer: correct
antwoord, eigen keuze gemarkeerd, `Goed`/`Fout`-label, eigen punten. Geen
opbouw, geen rankbeweging, geen sociale headline. `round:ended`'s payload
bevat (`transport-mock.mjs`, `buildDistribution`): `distribution` als
`[{optionId, count}]` — **tellingen per optie, geen spelersidentiteiten.**

## S13 — opbouwvolgorde

`04` vraagt deze volgorde: ronde sluit → correct antwoord krijgt focus →
eigen keuze gemarkeerd → resultaatlabel → punten/bonus → rankbeweging →
maximaal één sociale headline. Dat is een reeks stappen in tijd, niet één
render. Bouw dit als een kleine interne stap-state in `gameplay.mjs` (of een
apart `reveal-model.mjs`, zelfde stijl als `round-model.mjs`: puur, getest,
geen DOM) die bepaalt welke stap nu getoond wordt, met een minimale
tijdslijn — zie `03` §6 voor richtduren (reveal 1,0–1,8s, persoonlijk
resultaat 1,5–3,0s). **Zonder motion-tokens (thema 3, bestaan nog niet) is dit
een reeks tekst-/zichtbaarheidswissels, geen animatie** — bouw geen eigen
animatiesysteem vooruitlopend op dat werk.

## S14 — sociale headline: wat wél en niet bouwbaar is

Prioriteitslijst uit `04`: (1) één speler als enige correct, (2)
comeback/grootste stijger, (3) uitzonderlijk snelle speler, (4) iedereen
correct, (5) iedereen fout, (6) opvallende misleider, (7) streak.

**Nu bouwbaar, client-side, zonder protocolwijziging:**

- **(4) iedereen correct**: de telling op de correcte `optionId` is gelijk
  aan `eligiblePlayerCount` uit het laatste `round:progress` — niet aan het
  totaal aantal gegeven antwoorden. Dat laatste zou "iedereen die antwoordde
  had gelijk" ook laten triggeren wanneer maar twee van de acht spelers
  antwoordden; vergelijken met `eligiblePlayerCount` sluit "niet iedereen
  antwoordde" automatisch uit, want een niet-antwoordende speler telt nooit
  bij een optie mee.
- **(5) iedereen fout**: 0 op de correcte optie, **én** de som van alle
  tellingen > 0. Zonder die tweede voorwaarde vuurt deze conditie ook af
  wanneer niemand geantwoord heeft — dat is geen "iedereen fout", dat is
  "geen data".
- **(6) opvallende misleider**: ook uit `distribution` af te leiden — de
  foute optie met de hoogste telling.
- **(2) comeback/grootste stijger**: bouwbaar als je zelf de vorige
  `standingsFrom()`-uitkomst bewaart (in `session-shell.mjs`, naast
  `standingsPayload`) en per speler het positieverschil berekent — dezelfde
  data die S15's rankbeweging (`08-leaderboard-en-podium.md`) nodig heeft.
  Bouw dit één keer, gebruik het op beide plekken.

**Nu NIET bouwbaar zonder meer data — dit is een `HANDOFF`-item aan INT-A,
geen giswerk:**

- **(1) één speler als enige correct**: `distribution` telt alleen, het
  bevat geen speler-identiteit. Je kunt detecteren dát er precies één correcte
  respons was (telling === 1), maar niet wélke speler dat was, dus geen naam
  in de headline zoals `04`'s voorbeeld (`Lisa was de enige met het juiste
  antwoord.`) — tenzij dat al ergens anders (bv. de eigen `round:ended`
  wanneer `selfCorrect` en de telling 1 is) impliciet af te leiden is. Check
  dat eerst; is het niet af te leiden, meld het als open punt.
- **(3) uitzonderlijk snelle speler**: er is geen antwoordtijd per speler
  zichtbaar voor andere clients in het huidige protocol.
- **(7) streak**: vereist het bijhouden van opeenvolgende juiste antwoorden
  per speler over meerdere rondes — geen client heeft zicht op andermans
  streaks, alleen op de eigen.

**Selectieregel** (`04`): toon maximaal één headline, en alleen als hij
"werkelijk onderscheidend" is — bouw dus een enkele functie die de
bovenstaande, wél-bouwbare condities in prioriteitsvolgorde probeert en bij
de eerste treffer stopt; geen headline tonen is een geldige, verwachte
uitkomst.

## Regels

- Nooit een sociale headline verzinnen op basis van data die er niet is —
  liever geen headline dan een onjuiste.
- Nooit vernederend, nooit persoonsgegevens buiten de roomcontext (`04` S14).
- Geen `innerHTML`; nieuwe teksten in alle drie de locales.

## Definition of done

- Tegen `transport-mock.mjs`, een scenario met 2+ spelers waarbij minstens
  één ronde door iedereen fout wordt beantwoord en één ronde door iedereen
  goed: beide gevallen tonen de juiste headline, andere rondes tonen er geen.
- De opbouwvolgorde uit `04` S13 is zichtbaar als reeks, niet als één render.
- De drie niet-bouwbare headline-typen staan als genummerd `HANDOFF`-item
  vastgelegd (nieuw item in het handoff-document van dit domein), niet
  stilzwijgend weggelaten.
- `../PROGRESS.md` bijgewerkt voor S13 en S14 — S14 kan alleen "gedeeltelijk"
  scoren zolang de drie ontbrekende databronnen openstaan.
