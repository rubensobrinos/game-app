# Prompt — T2-3: Timer en progress

Onderdeel van [`README.md`](README.md). Blokkeert thema 1 (`S08`).

## Brondocument

`05-DESIGN-SYSTEM.md` §9 (Timer en progress). `06-MOTION-SOUND-AND-FEEDBACK.md`
`E07` (laatste drie seconden). `08-ACCESSIBILITY-AND-RESILIENCE.md` §2.2
(screenreader-updates niet elke seconde).

## Wat er nu staat

`views/gameplay.mjs` toont één getal in `.gameplay-timer`, herberekend per tick
uit `secondsRemaining()` op de gemeten serveroffset. Dat deel is goed en moet
blijven: de tijd komt van de server, niet van een lokale seconde-tick.

Wat ontbreekt is de vorm. `05` §9 noemt de horizontale progressbalk de
basisvorm, met het getal als optionele aanvulling ernaast — wij hebben alleen
het getal. Er is ook geen enkel verschil tussen seconde 30 en seconde 2.

De singleplayer heeft dit al wél: `style.css` heeft `.timer-track`,
`.timer-fill` en `.timer-fill.urgent`. Dat is de visuele taal om op aan te
sluiten, niet om opnieuw te bedenken.

## Wat dit is

1. **Een progressbalk-component** die van vol naar leeg loopt over de
   rondeduur. Aansluiten op de bestaande singleplayer-vormtaal.

2. **Rust in de normale fase, nadruk in de laatste drie seconden.**
   Verhoogd contrast — géén volledige schermflits, géén doorlopend rood: `05`
   §9 zegt "waarschuwing niet continu rood", en `P12` reserveert rood voor
   fout en geeft tijd/aandacht een eigen rol: `--color-warning`. Gebruik die
   token; hij komt uit `T2-1` stap 3, waar hij om precies deze reden als
   niet-optioneel staat aangemerkt.

   **De pulsanimatie hoort níét hier.** `E07` staat in thema 3's
   gebeurteniscatalogus, en `T2-4` en `T2-6` stoten hun motion om dezelfde
   reden af. Deze prompt levert het contrastverschil en de klassen; thema 3
   hangt er beweging aan. Thema 3 heeft nog geen prompt voor `E07`, dus dit is
   nu goedkoop af te spreken — leg het vast in `HANDOFF-UI.md` in plaats van
   het te laten zitten.

3. **Het getal blijft**, als tabulaire aanvulling naast de balk. Niet
   vervangen: op een luidruchtige borrel is een getal sneller af te lezen dan
   een balkje, en `07` §11 vraagt tabular nums.

4. **Screenreader gedoseerd** (`08` §2.2): niet elke seconde een update. Eén
   aankondiging bij de start van de ronde, en eventueel één bij "nog vijf
   seconden". De balk zelf krijgt `aria-hidden` — de tijd komt via de tekst.

5. **De rekenkant niet aanraken.** `secondsRemaining()` in `server-time.mjs` is
   getest en correct; deze prompt is puur de weergavelaag.

## Regels

- **Geen eigen tijdrekening.** De component krijgt de resterende seconden
  binnen en tekent; hij berekent niets zelf en houdt geen eigen interval bij.
  Dat is `session-shell.mjs`'s ticker, en die is van thema 1.
- **De urgentiedrempel is een constante, geen hardcoded 3.** Thema 1 moet 'm
  kunnen meegeven als de rondeduur ooit configureerbaar wordt.
- De urgentie mag niet uitsluitend in beweging zitten (`08` §2.4). Omdat het
  contrastverschil hier wordt gebouwd en de beweging bij thema 3, is dat
  automatisch goed — maar alleen als thema 3 de beweging als aanvulling bouwt
  en niet als vervanging. Zeg dat er expliciet bij in de handoff.

## Definition of done

- De balk loopt zichtbaar leeg over een ronde van 30 seconden, gemeten in de
  browser tegen de mock.
- Bij ≤3 seconden is er een zichtbaar verschil, ook met een screenshot te
  bewijzen — en dat verschil is niet uitsluitend kleur (`08` §2.3).
- Met `prefers-reduced-motion: reduce` beweegt er niets meer maar blijft de
  urgentie zichtbaar.
- Een screenreader krijgt hooguit twee aankondigingen per ronde, niet dertig.
- De component staat in `HANDOFF-UI.md` met zijn aanroep, zodat thema 1 hem in
  `S08` kan hangen.
