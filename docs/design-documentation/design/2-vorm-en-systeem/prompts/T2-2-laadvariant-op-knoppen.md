# Prompt — T2-2: Laadvariant op knoppen

Onderdeel van [`README.md`](README.md). Blokkeert thema 1 (`S01`).

_Herzien ná review. De eerste versie beschreef een beginsituatie die al niet
meer klopte, en legde een naad vast zonder het foutpad._

## Brondocument

`05-DESIGN-SYSTEM.md` §4.1 (hero button: "bevat loadingvariant"), §5
(`submitting`: "locked, geen dubbele tap") en §13 (Loading, Error).
`06-MOTION-SOUND-AND-FEEDBACK.md` `E01` (geen layoutshift) en `E02` (alle vijf
de bullets, inclusief de foutafloop). `08-ACCESSIBILITY-AND-RESILIENCE.md`
§4.1 en §4.2.

## Wat er nu staat

**Er ís een laadstaat, maar niet op de knop.** Thema 4 heeft in `2f313c1`
`home.creating` ("Potje maken…") geland als een losse statusregel:
`views/home.mjs` maakt `.home-quick-start-status` met `aria-live="polite"`,
vult die zolang de status `creating` is, en verbergt tegelijk de divider, het
codelabel en de code-knop. De knop zelf blijft `Snel starten` heten en wordt
alleen `disabled`.

Er zijn dus drie dingen aan de hand, en alleen het eerste stond in de vorige
versie van deze prompt:

1. `05` §4.1 wil de laadstaat **op** de knop, niet ernaast.
2. `.home-quick-start-status` heeft **nul CSS** — hij erft alleen
   `p { color: var(--text-muted) }`. Dat is de gedeelde componentlaag en dus
   werk van dit thema, hoe dan ook.
3. Zolang beide bestaan komt "Potje maken…" straks twee keer op het scherm.

## Wat dit is

1. **Een `is-loading`-staat** die op elke knopvariant werkt (`.btn-primary`,
   `.btn-secondary`, `.btn-destructive`), zichtbaar anders dan `:disabled`.

2. **Loading blokkeert de actie.** `05` §5 (`submitting`: "locked, geen dubbele
   tap"), `08` §4.1 ("geen dubbele acties") en `11` §L ("kan een dubbele tap
   geen dubbel antwoord maken?") eisen dat de knop tijdens het laden niet
   opnieuw kan vuren. Anders ziet het er alleen maar bezig uit.

3. **Het foutpad hoort erbij.** `E02` heeft vijf bullets; de laatste luidt
   *"fout stopt indicator en toont retry"*. Een `setLoading(bool, label)`
   zonder foutafloop legt de naad half vast — thema 1 en 4 kunnen hem dan niet
   gebruiken voor de mislukking, en bouwen er alsnog omheen. De signatuur moet
   drie uitkomsten kennen: bezig, gelukt, mislukt-met-retry.

4. **Geen layoutshift** (`E01`). Een label dat van `Snel starten` naar
   `Potje maken…` gaat is breder; reserveer de ruimte.

5. **Beslis wat er met de statusregel gebeurt.** Twee opties, allebei
   verdedigbaar: de knop neemt de tekst over en `.home-quick-start-status`
   vervalt, óf de regel blijft als `aria-live`-kanaal en de knop toont alleen
   de visuele staat. Kies er één, leg 'm vast, en stem hem af met thema 1 en 4
   — nu bouwen twee prompts hetzelfde.

6. **`.home-quick-start-status` krijgt CSS**, welke keuze het ook wordt.

7. **Toegankelijk:** `aria-busy="true"` tijdens het laden, en de labelwissel
   wordt één keer aangekondigd. De blanket-`prefers-reduced-motion`-regel in
   `base.css` moet ook een spinner raken — controleer dat, niet aannemen.

## Regels

- **Alleen het mechanisme, niet de teksten.** `Potje maken…` bestaat al;
  `Gamecode controleren…` en `Je wordt toegevoegd…` zijn thema 4.
- **Niet zelf inbouwen in `home.mjs`.** Waar de laadstaat aan gaat is thema 1.
  Maar let op: thema 1's `06-start-en-join-polish.md` plant een kale
  `textContent`-wissel zonder deze component te kennen. **Stem af vóór je
  bouwt**, anders staan er twee mechanismen. Thema 1 heeft die naad zelf al
  zien aankomen.
- Disabled en loading blijven visueel onderscheidbaar.

## Definition of done

- Normaal, disabled en loading zijn met het blote oog te onderscheiden —
  screenshot van de drie naast elkaar, donker én licht.
- Een tweede tik tijdens het laden veroorzaakt geen tweede aanroep; met een
  test vastgelegd, niet met het oog.
- Het foutpad toont een retry en de knop is daarna weer bruikbaar.
- Geen pixel layoutshift bij normaal → loading → normaal
  (`getBoundingClientRect()` vóór en na).
- "Potje maken…" staat nergens twee keer op het scherm.
- De signatuur staat in `HANDOFF-UI.md`, met de keuze uit punt 5 erbij, zodat
  thema 1 en 4 hem kunnen aanroepen zonder de implementatie te lezen.
