# Prompt — T2-5: QR-kaart als component

> **⏹ Vervallen — niet uitvoeren.** Thema 1 heeft `room-header.mjs` zelf
> ingehangen én gestyled (`HANDOFF-UI.md` UI-10 ✅). Daarmee is de blokkade
> weg en is deze prompt zonder inhoud geraakt.
>
> Het bestand blijft staan omdat de redenering eronder nog geldt: de
> scopeafbakening tussen "component" (thema 2) en "scherm" (thema 1), en het
> punt dat de code in de appheader klein hoort te blijven terwijl de code in
> de modal groot moet. Dat laatste is alsnog uitgevoerd in `T2-10`.
>
> Wie hier een nieuwe QR-kaart nodig heeft — podium, groot scherm — begint met
> een nieuw ticket, niet met dit bestand.

Onderdeel van [`README.md`](README.md).

_Herzien ná review. De eerste versie nam werk over dat volgens `HANDOFF-UI.md`
UI-10 aan thema 1 is toegewezen, en beschreef de module als "ongetest" terwijl
het probleem is dat er nul CSS voor bestaat._

## Scopewijziging ten opzichte van de eerste versie

De eerste versie schreef het inhangen van `room-header.mjs` voor. Dat is
grotendeels een duplicaat van thema 1's `02-S05-permanente-qr-code.md`, dat
dezelfde vier handelingen gedetailleerder beschrijft. Bovendien heeft thema 2's
eigen handoff-item de eigenaar al aangewezen: *"thema 1 hangt hem in; thema 2
onderhoudt de component."* En mounten in `#app-header` is volgens `UI-7`
session-shell-werk.

**Deze prompt beperkt zich daarom tot wat werkelijk van thema 2 is:** de
styling en de component. Het inhangen staat bij thema 1.

## Brondocument

`05-DESIGN-SYSTEM.md` §7 (QR-card) en §12 (Overlays). Besluiten `D-018`
(code permanent in de appheader, QR achter een pictogram als modal), `D-019`
(code en QR altijd zichtbaar, ook bij een vergrendelde room) en `D-023`
(`Toon code` en `Toon QR-code` vervallen uit de lobby).

## Wat er nu staat

`frontend/js/views/room-header.mjs` bestaat sinds `d3c900e` en implementeert
`D-018` in gedrag: code in de header, QR-pictogram, modal met kaart, code en
URL, focusbeheer, Escape.

**Er is nul CSS voor.** Geen enkele van de klassen die die module gebruikt —
`.room-header`, `.room-header-code`, `.room-header-code-value`,
`.room-header-qr`, `.room-qr-overlay`, `.room-qr-card`, `.room-qr-image`,
`.room-qr-code`, `.room-qr-url` — komt voor in `frontend/css/`. De module is
dus niet ongetest maar ongestyled, en zou vandaag als ongeordende tekst
renderen.

Dat is ook precies wat hem tegenhoudt: thema 1 kan hem niet inhangen zolang
hij er niet uitziet.

## Wat dit is

1. **De styling voor alle negen klassen.** Dit is de blokkade voor thema 1 en
   dus het eerste dat af moet.

2. **De code als leesbaar getal.** `05` §7 en §2.3 (`display-code`): dit is
   een getal dat wordt voorgelezen en overgetypt. Tabulaire cijfers,
   letterspatiëring, en groot genoeg om op een meter afstand op te lezen. De
   module formatteert al naar `123 456`; de vorm moet daarop aansluiten.

3. **De QR-kaart als geheel** (`05` §7): label `Scan om mee te doen`, QR met
   voldoende stille zone, code en korte URL bij elkaar — niet vier losse
   elementen onder elkaar.

4. **Werkt naast het hamburgermenu op 320px.** Code, pictogram en hamburger
   moeten daar naast elkaar passen zonder overlap of afkapping.

5. **Beslis over het QR-pictogram tijdens een actieve vraag.** `05` §12
   verbiedt een overlay over een onbeantwoorde vraag, en `00` §5 zet
   "geen instellingenpopover over actieve spelinhoud" bij *bewust niet doen*.
   De code permanent tonen is `D-018` en dus in orde; de modal daaroverheen
   kunnen openen is dat niet vanzelf. Kies: pictogram verbergen tijdens een
   actieve onbeantwoorde vraag, of de modal daar blokkeren. Leg de keuze vast
   en stem hem af met thema 1 — die kent de fase, deze component niet.

6. **Verantwoord de modalvorm.** `05` §12 wil op mobiel een bottom sheet;
   `D-018` schrijft een modal voor en het besluitregister wint (`00` §1).
   Noteer dat expliciet in de component-documentatie, zoals `D-020` het bij de
   startknop deed — niet stil laten staan.

## Regels

- **Niet inhangen.** Dat is thema 1 (`02-S05-permanente-qr-code.md`, UI-10).
  Deze prompt levert de vorm; thema 1 plaatst hem.
- **Niet de lobbyknoppen weghalen.** `D-023` regelt dát ze vervallen, maar de
  uitvoering zit in `lobby.mjs` en dat is thema 1's scherm. Let op dat
  `client/flow/share-actions.mjs` `'show-code'` altijd meelevert en dat dat in
  `share-actions.test.mjs` is vastgelegd — het weghalen van de knop raakt dus
  getest werk buiten `views/`. Meld dat aan thema 1.
- **Geen externe QR-dienst.** `DEPLOYMENT-AND-TESTING.md` legt vast dat de QR
  lokaal in de browser wordt gegenereerd; de gevendorde generator blijft.
- **Geen `innerHTML` voor de QR.** De data-URL op een `<img>` is bewust
  gekozen boven een SVG-string; de CSP staat `img-src data:` toe en verder
  niets.
- **Stem af met thema 3.** `M3` (`E16`) bouwt één gedeelde dialoogtransitie
  voor onder meer de QR-overlay, en noemt `lobby.mjs` als locatie. Als die
  lobby-overlay verdwijnt door `D-023`, bouwt `M3` tegen iets dat weggaat.

## Definition of done

- De header rendert met code en pictogram in beide thema's, screenshot op
  320px, 390px en 768px breedte.
- De QR-modal toont label, QR, code en URL als één kaart.
- De code is op een meter afstand leesbaar — met een echt scherm gecontroleerd,
  niet op een laptopbeeldscherm van dichtbij.
- Escape sluit, een tik naast de kaart sluit, en de focus keert terug naar het
  pictogram.
- De keuze uit punt 5 en de afwijking uit punt 6 staan in `HANDOFF-UI.md`.
- Scanbaarheid met een echte telefooncamera hoort bij thema 5's testmatrix
  (`T5-6`) — geen agent kan dat afvinken.
