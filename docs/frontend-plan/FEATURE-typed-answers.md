# FEATURE — Antwoordmodus: meerkeuze óf intypen met land-autocomplete

**Status:** besluit producteigenaar, 3 aug 2026 (live-testsessie). Nog niet in
uitvoering — dit document is de opdrachtbasis. **Raakt: UI + protocol +
server + content — géén solo-UI-klus.**

## Wat de producteigenaar wil (letterlijk)

> "We moeten maken dat je kan kiezen, meerkeuze of echt intypen. Maar als je
> intypt dat je bijvoorbeeld B intypt, dat je dan dropdown krijgt met de
> landen met de B — zoals Brazilië en België. Type je Be, dan krijg je
> Belize en België bijvoorbeeld."

## UX-kern

- Nieuwe **game-instelling voor de host** (host-setup, "Game instellen"):
  antwoordmodus `meerkeuze` (default, huidige gedrag) of `intypen`.
- In intyp-modus krijgt de speler i.p.v. vier knoppen één tekstveld met
  live-suggesties: prefix-filter op landnaam in de **vraagtaal**
  (`config.language`), dus B → België/Brazilië/…, Be → België/Belize.
- Antwoorden = een suggestie kiezen (tik of enter op de bovenste). Vrije
  tekst die geen land matcht is niet verzendbaar — het antwoord op de wire
  blijft een **iso2-code**, nooit een string die de server moet raden.
- Diakritics/hoofdletters vergevingsgezind matchen (belgie → België).

## Technische ankers (voor wie dit oppakt)

- **Wire ongewijzigd houden kan**: het antwoord blijft `optionId = iso2`.
  Het verschil zit in wat de client toont en in wat de server accepteert:
  bij intyp-modus is elk land uit de pool een geldig antwoord, niet slechts
  de vier opties. Dat raakt de servervalidatie van `round:answer`
  (`ALREADY_ANSWERED`/`INVALID_OPTION`-pad) en de rondegeneratie
  (`question.optionIso2s` is dan niet meer de gesloten verzameling).
- **Config**: nieuw veld in `HostConfig` (bv. `answerMode:
  'multiple_choice' | 'typed'`) → `host-setup-state.mjs`, create-validator,
  PROTOCOL.md §config, DATA-MODEL.md. Zelfde route als besluit #35-velden.
- **Landnamenbron**: `frontend/js/views/country-names.mjs` heeft al namen
  per taal voor de 230-landenpool (CONTENT_VERSION-gebonden). De
  suggestielijst filtert dáárop — geen tweede lijst introduceren.
- **Scoring**: intypen is moeilijker; als speedbonus geldt, overwegen of de
  basisscore per modus verschilt. Productbesluit — expliciet voorleggen.
- **Views**: nieuw invoercomponent naast `gameplay.mjs`'s knoppenrooster;
  zelfde regels (nooit innerHTML, aria-live voor status, geen goed/fout vóór
  `round:ended`).

## Afbakening

- Per match één modus (hostkeuze), niet per speler — anders is de score
  onvergelijkbaar.
- Geen fuzzy matching/spelfouten-tolerantie in v1; alleen prefix +
  diakritics-ongevoelig.
- Meertaligheid: suggesties in de vraagtaal van de match, niet de UI-taal
  van de speler (consistent met hoe vragen nu al werken).

## Volgorde

1. Productbesluit bevestigen in DECISIONS.md (nieuw nummer): antwoordmodus
   als hostinstelling, wire blijft iso2. → regie legt voor.
2. Protocol + validators (INT-A) parallel met UI-component (UI-agent).
3. Servervalidatie rondeantwoord (INT-A/DM-kant) + tests via echte fixtures
   (INT-18-les).

## Verwant maar apart

Mockmodus (`?mock=1`, zelfde sessie gevraagd) is los hiervan al gebouwd in
`frontend/js/app.mjs` — solo testen zonder server/host. De intyp-modus moet
t.z.t. óók in de mock werken zodat hij solo te demonstreren is.
