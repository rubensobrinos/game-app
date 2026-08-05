# Verkenning vóór de bouw — 5 aug 2026

Twee vragen beantwoord vóórdat de agents beginnen:
**(1) wat is er al opgelost in de tree**, en **(2) waar gaat de ruimte heen**.

De screenshots van de producteigenaar komen van een **oudere live build**. Alles
hieronder is getoetst tegen de huidige, gecommitte tree.

---

# Deel 1 — Waar de ruimte heen gaat

## 1.1 De bovenbalk heeft geen achtergrond

```css
/* frontend/css/base.css:400 */
#app-header {
  position: sticky;
  top: 0;
  z-index: 60;
  padding: 0.75rem 1rem 0;
  /* ← geen background */
}
```

Een **sticky** balk **zonder achtergrond**. De pagina scrolt er dus zichtbaar
onderdoor en er omheen. Dat verklaart twee dingen die als losse rare dingen op
de foto's staan:

- **IMG_0291** — een lime-rode strook bóven de codebalk. Dat is de minigame
  die door de 12 px padding-ruimte van de header heen schijnt.
- **IMG_0292** — de codebalk lijkt dwars door de knop "Hard" te snijden. Hij
  snijdt nergens door: de knop scrolt eronderdoor en blijft zichtbaar omdat er
  niets tussen zit.

**Het is dus één bug, niet twee.** Een achtergrond (of een blur-laag) op
`#app-header` lost beide op. Dat hoort bij **pakket A**, punt A-x1.

## 1.2 De "grote lege zwarte ruimte" in de lobby is de minigame

```css
/* frontend/css/rounda-1c.css:423 */
.rounda-flag-card {
  height: clamp(260px, 38vh, 360px);
  background: #101016;   /* bijna zwart */
}
```

Op 844 px hoog is `38vh` = **321 px**, plus 14 px marge. Dat is **meer dan de
helft** van de bruikbare 650 px, en zolang niemand op de minigame tikt is het
een egaal donker vlak.

**Punt 11 is daarmee geen opruimklus maar een productvraag:**

> Hoort de warm-up open in de lobby te staan, of achter een tik ("zin in een
> warming-up?") — met de lobby zelf compact eronder?

Zolang die 335 px daar staat, kan agent C punt 11 niet halen door hier en daar
wat marges te verkleinen. **Dit is de enige vraag uit de verkenning die de
producteigenaar moet beantwoorden.** Mijn voorstel, tenzij hij iets anders
zegt: de kaart standaard ingeklapt tot een strook van ~56 px met de tekst
"Warming-up — tik om te spelen", die uitklapt naar de volle kaart. Dan blijft
de vondst behouden en is de lobby in één oogopslag te lezen.

## 1.3 Wat er daarna nog overblijft

| Post | Nu | Na 1.1 + 1.2 |
| --- | --- | --- |
| Chrome (2 rijen) | ~180 px | ~60 px (pakket A) |
| Minigame in de lobby | ~335 px | ~56 px ingeklapt |
| Kleurenrij (8 blokjes, 2 rijen) | ~200 px | ~48 px (pakket C, punt 19) |

Alleen deze drie posten leveren samen ~550 px op. Het probleem is niet dat
alles net iets te groot is — het zijn drie blokken.

---

# Deel 2 — Wat al in de tree zit

Kolom **Status** is getoetst tegen de code, met de vindplaats erbij.

| # | Onderwerp | Status | Bewijs |
| --- | --- | --- | --- |
| 18 | Codebalk compact tijdens spel | **deels gebouwd** | `rounda-1c.css:718-737` — scheelt ~25 px, er moet ~155 px af |
| 36 | Segmententimer i.p.v. kaal cijfer | **gebouwd, niet live** | `timer-bar.mjs` tekent 12 segmenten; `rounda-1c.css:1059-1063` maakt er een balk van en verbergt het cijfer (`.timer-value { display: none }`). Op de foto zie je alléén het cijfer → oude build |
| 37 | Timer telt vloeiend af | **waarschijnlijk opgelost met 36** | in de oude build stond de timer ín de kopregel en kneep de flexrij de segmenten weg; in de tree staat `timerHost` los onder de kop (`gameplay.mjs:148`) |
| 38 | Toon hoeveel spelers geantwoord | **gebouwd, niet live** | `gameplay.mjs` — `headerProgress`, "9/14 BINNEN" |
| 39 | Status hoog in beeld | **gebouwd, niet live** | staat in de kopregel, boven de vraag |
| 41 | Direct de volgende vraag | **gebouwd, niet live** | `socket.mjs` §A2 (5 aug): tussen rondes start de ronde direct; alleen de match-opening telt nog af |
| 22 | Hostinstellingen in/uitklapbaar | **bestaat** | `lobby.mjs` — `settingsHeader` met `aria-expanded` |
| 10 | "1 speler" compacter | **deels** | `.lobby-count` is al een mono-label (`rounda-1c.css:766`); het punt is dat het een eigen regel is |
| 2 | Zes codevelden | **bestaat** | `home.mjs` — `codeCellInputs`, zes cellen. Wat mist is de compacte **Go** ernaast |
| 5 | Logo groter | **meetbaar** | `.app-logo` is 96 px (`rounda-1c.css:35`) → 20% erbij = ~115 px |
| 25 | Kies/Mix/Typ | **deels besluit** | Mix/Typen bewust uit (besluit 40D). "Kiezen" heeft géén klikhandler: `segButton(answersGroup)` zonder `onPick` — dáár zit de echte bevinding |
| 27 | "Antwoord automatisch tonen" | **serverwerk** | besluit C uit doelbeeld v2: nieuwe hostactie in de match-lifecycle |
| 20 | Palet van 36 kleuren | **botst** | de server kent er acht (`client-events-dispatch.mjs:101`, gesloten enum). Meer kleuren = protocolwerk |
| 32 | Startknop bedekt content | **bevestigd** | `.lobby-start` is `position: sticky` (`base.css:990`) zonder ruimte eronder |
| 6, 12, 26, 28, 29, 30 | — | **niet doen** | producteigenaar vond deze goed |

**Alle overige punten zijn ontwerpwerk** en staan in de vier briefings. Ik heb
ze niet stuk voor stuk in de code nagelopen; waar ik geen bewijs had, staat er
ook geen claim.

## Wat dit betekent

**Deploy eerst.** Zes punten (18 deels, 36, 37, 38, 39, 41) staan al in de tree
en niet live. Een deploy plus verse screenshots kan die van de lijst halen
vóórdat er iemand aan begint. De stand is gecommit, gepusht en groen — dit is
het veiligste deploymoment in dagen.

**Voor pakket B verandert er het meest.** Drie van zijn tien punten (36, 37, 41)
zijn waarschijnlijk al klaar. Zijn eerste stoppunt is daarmee vooral
*verifiëren en melden*, niet bouwen. Dat staat al zo in zijn briefing en wordt
door deze verkenning bevestigd.

**Voor pakket A komt er één bug bij** die op geen enkele lijst stond: de
achtergrondloze sticky header (1.1). Die verklaart twee "rare" screenshots.

**Voor pakket C ligt er één vraag** die eerst beantwoord moet worden: de
minigame in de lobby (1.2).
