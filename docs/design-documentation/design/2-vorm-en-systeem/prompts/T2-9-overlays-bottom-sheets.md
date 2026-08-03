# Prompt — T2-9: Overlays als bottom sheet op mobiel

Onderdeel van [`README.md`](README.md). Blokkeert thema 1 (`S17`, `S18`).

Deze prompt ontbrak in de eerste ronde. `Overlays` staat op niveau 1 en
blokkeert thema 1, maar stond niet in de lijst en ook niet bij de bewust
weggelaten onderwerpen — een gat in een README die claimt op blokkade te
sorteren.

## Brondocument

`05-DESIGN-SYSTEM.md` §12 (Overlays). `04-SCREEN-SPECIFICATIONS.md` `S17`
(spelers beheren) en `S18` (voorkeuren). `00-DESIGN-INDEX.md` §5. Het
benchmarkrapport §9.

## Wat er nu staat

Drie overlays, alle drie een gecentreerde modal:

| Overlay | Waar | Toegankelijkheid |
| --- | --- | --- |
| Voorkeurenpaneel | `app-menu.mjs` | `aria-haspopup`/`-expanded`/`-controls`, Escape, focusherstel |
| QR-overlay | `lobby.mjs` | `role="dialog"`, `aria-modal`, Escape, focusherstel |
| Pauze-overlay | `session-shell.mjs` | idem, Escape alleen voor de host |

De toegankelijkheid is in orde en moet zo blijven. Het probleem is de vorm.
`05` §12 vraagt "bottom sheet op mobiel; side panel op desktop; modal alleen
voor echte onderbreking/confirmatie", en het benchmarkrapport is bij het
voorkeurenpaneel expliciet: *"Geen zwevend dropdownmenu dat half over de vraag
valt. Gebruik een bottom sheet op mobiel."* Ons voorkeurenpaneel ís dat
zwevende dropdownmenu.

## Wat dit is

1. **Eén bottom-sheet-component** met `role="dialog"`, `aria-modal`, Escape
   sluit, en focus die erin gaat bij openen en terugkeert naar de trigger bij
   sluiten.

   Let op dat dit voor het voorkeurenpaneel een **patroonwissel** is, geen
   verbouwing: dat is vandaag een disclosure (`aria-haspopup`/`-expanded`/
   `-controls`, geen focus trap), niet een dialog. De QR- en pauze-overlay zijn
   wél al dialogs. Wie het voorkeurenpaneel omzet moet het hele ARIA-patroon
   omzetten, niet er een `role` bij plakken.

2. **Bepaal per overlay welke vorm hij krijgt**, en verantwoord het:
   - **Voorkeuren (`S18`)** → sheet. Hier is de spec het meest uitgesproken,
     en het benchmarkrapport noemt dit paneel met naam.
   - **Pauze** → blijft modal. Dit ís een echte onderbreking, precies de
     uitzondering die §12 toestaat.
   - **QR** → blijft modal, op grond van `D-018`. Zie de regel hieronder.

   **`S17` (spelers beheren) valt hier bewust buiten.** De eerste versie van
   deze prompt wees die een sheet toe. Dat was fout op twee manieren: het is
   vandaag geen overlay maar een inline verwijderknop per rij in `lobby.mjs`,
   en thema 1 heeft in `01-snelle-reparaties.md` juist gekozen om het inline te
   houden. Een sheet bouwen zou dus een nieuwe overlay toevoegen — wat deze
   prompt zelf verbiedt — en een keuze van thema 1 overschrijven.

3. **Op desktop een zijpaneel**, niet een uitgerekte sheet (`05` §12: "side
   panel op desktop"; `07` §3 noemt onder Medium "side panel voor voorkeuren").

   **Stem dit af met thema 5 vóór je begint.** `T5-7-medium-tablet-compositie.md`
   claimt hetzelfde onderdeel — het hamburgermenu vanaf medium als vast
   zijpaneel — en zijn definition of done eist dat compact portrait (390×844)
   ongewijzigd blijft, precies de breedte waar deze prompt de sheet invoert.
   Twee prompts op één component; dat moet één worden.

4. **Veilig gedrag tijdens een actieve vraag.** `05` §12 verbiedt een popover
   over een onbeantwoorde vraag — **behalve een essentiële mute- of
   noodactie**, en die uitzondering telt hier: `06` §5 eist dat mute altijd
   bereikbaar is zonder de vraag te blokkeren, en de mute komt straks juist in
   dit paneel (`O-008`). De sheet moet dus weten of er een onbeantwoorde vraag
   loopt, en in dat geval een beperkte variant tonen in plaats van niets. Dat
   is een contract met thema 1: de sheet krijgt de fase als parameter, hij
   leidt hem niet zelf af.

## Regels

- **Toegankelijkheid gaat niet achteruit.** De drie bestaande overlays hebben
  focusbeheer dat werkt en in thema 5's `PROGRESS.md` als *gemeten* staat.
  Wie dat bij de verbouwing sloopt levert een regressie op een van de weinige
  dingen die aantoonbaar goed staan.
- **De QR blijft een modal.** `D-018` schrijft die vorm voor en het
  besluitregister wint van `05` §12 (`00` §1). Noteer die afwijking expliciet
  in `05`-termen in plaats van hem stil te laten — dat is precies wat `D-020`
  wél deed en `D-018` nog niet.
- **Geen nieuwe overlay toevoegen.** Deze prompt verandert de vorm van wat er
  is; nieuwe schermen zijn thema 1.
- Animatie van open/dicht is thema 3 (`M3`, `E16`). Lever de vorm en de
  klassen; laat de transitie aan hem.

## Definition of done

- Voorkeuren en spelers beheren openen op telefoonbreedte als bottom sheet, op
  desktopbreedte als zijpaneel — screenshot van beide breedtes, beide thema's.
- Escape sluit elke sheet en de focus keert terug naar de knop die hem opende;
  met het toetsenbord doorlopen, niet uit de code afgeleid.
- Met een onbeantwoorde vraag actief bedekt geen enkele sheet de vraag —
  gedrag afgesproken met thema 1 en in `HANDOFF-UI.md` vastgelegd.
- De pauze- en QR-overlay zijn ongewijzigd; hun afwijking van `05` §12 staat
  met reden in de component-documentatie.
- `node --test frontend/ client/` blijft groen.
