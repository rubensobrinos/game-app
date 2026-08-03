# Prompt — T2-2: Laadvariant op knoppen

Onderdeel van [`README.md`](README.md). Blokkeert thema 1 (`S01`) en thema 4
(`Potje maken…`).

## Brondocument

`05-DESIGN-SYSTEM.md` §4.1 (hero button: "bevat loadingvariant") en §13
(Loading). `06-MOTION-SOUND-AND-FEEDBACK.md` `E02`. `09-CONTENT-AND-MICROCOPY.md`
§4 voor de teksten.

## Wat er nu staat

Er is geen laadstaat. `views/home.mjs` zet bij het aanmaken van een game alleen
`quickStartButton.disabled = true`; het label blijft `Snel starten`. De gebruiker
ziet een knop die grijs wordt en verder niets — bij een trage verbinding is dat
seconden stilte.

Dat is precies wat de audit als bevinding 4 noteert ("Loadingstates ontbreken.
Na `Snel starten` is er circa een seconde geen goede feedback") en wat `P8`
verbiedt: iedere actie antwoordt binnen ~100 ms zichtbaar.

Sinds `d3c900e` is de disabled-staat wél opgeknapt (gedempt vlak, leesbare
tekst, niet meer `opacity: .5`). Wat ontbreekt is het onderscheid tussen
*uitgeschakeld* en *bezig* — nu zien die er identiek uit, terwijl het voor de
gebruiker twee verschillende dingen zijn.

## Wat dit is

1. **Een `is-loading`-staat** die op elke knopvariant werkt (`.btn-primary`,
   `.btn-secondary`, `.btn-destructive`). Zichtbaar anders dan `:disabled`.

2. **De knop blijft op zijn plaats en op zijn maat.** `05` §4.1 en `06` `E02`:
   geen layoutshift. Een label dat van `Snel starten` naar `Potje maken…` gaat
   is breder — reserveer de ruimte of gebruik `min-width`, laat de knop niet
   springen.

3. **Een compacte voortgangsindicatie** naast het label. Spinner mag, maar
   `05` §13 is expliciet: de spinner is de aanvullende cue, de *tekst* is de
   boodschap.

4. **Toegankelijk:** `aria-busy="true"` zolang het laadt, en de labelwissel
   wordt één keer aangekondigd — niet elke frame. `prefers-reduced-motion`
   respecteren (staat al blanket in `base.css` sinds `58eba07`, controleer dat
   een spinner daar niet doorheen glipt).

5. **Een `setLoading(bool, label)`-hulpfunctie** of gelijkwaardig, zodat thema 1
   en 4 hem aanroepen in plaats van elk hun eigen `disabled`-gedoe te schrijven.
   Dit is de naad: leg de signatuur vast vóór zij hem gaan gebruiken.

## Regels

- **Alleen de component, niet de teksten.** `Potje maken…`, `Gamecode
  controleren…` en `Je wordt toegevoegd…` zijn thema 4 (`T4-2`). Deze prompt
  levert het mechanisme; die prompt vult het.
- **Ook niet de aanroep.** Waar de laadstaat aan gaat is thema 1. Lever de
  component en meld de signatuur; bouw hem niet zelf in `home.mjs` in.
- Disabled en loading blijven **visueel onderscheidbaar**. Wie ze hetzelfde
  maakt lost niets op.

## Definition of done

- Een knop in `is-loading` is met het blote oog te onderscheiden van een
  disabled knop en van een normale knop — screenshot van de drie naast elkaar,
  donker én licht.
- Geen enkele pixel layoutshift bij de wissel normaal → loading → normaal
  (meet de `getBoundingClientRect()` vóór en na).
- `aria-busy` staat aan tijdens en uit erna.
- De signatuur van de hulpfunctie staat in `HANDOFF-UI.md`, zodat thema 1 en 4
  hem kunnen aanroepen zonder de implementatie te lezen.
