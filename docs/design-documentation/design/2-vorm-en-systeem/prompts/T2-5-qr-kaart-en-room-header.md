# Prompt — T2-5: QR-kaart als component, en de dode `room-header.mjs` inhangen

Onderdeel van [`README.md`](README.md). Blokkeert thema 1 (`S05`).

## Brondocument

`05-DESIGN-SYSTEM.md` §7 (QR-card). Besluiten `D-018` (code permanent in de
appheader, QR achter een pictogram als modal) en `D-019` (code en QR altijd
zichtbaar, ook voor spelers en ook bij een vergrendelde room).

## Wat er nu staat

Twee dingen die niet bij elkaar komen.

`frontend/js/qr.mjs` genereert lokaal een data-URL uit de gevendorde generator
— werkt, geen externe dienst, drie tests groen. `views/lobby.mjs` toont die in
een schermvullende overlay achter de knop `Toon QR-code`, met daarnaast een
knop `Toon code`.

En `frontend/js/views/room-header.mjs` bestaat sinds `d3c900e`: een volledige
implementatie van `D-018` — code permanent in de appheader, QR-pictogram
ernaast, modal met kaart, code en URL, focusbeheer en Escape. **Hij is nergens
ingehangen.** Dat is dode code, en dat is mijn schuld, niet die van thema 1.

Gevolg: de code zit nog steeds achter een knop, terwijl `00-DESIGN-INDEX.md` §5
"geen verborgen roomcode of QR in de hostlobby" als expliciet *bewust niet
doen* noemt, en `09` §15 `Show code` op de verboden-copylijst zet.

## Wat dit is

1. **`room-header.mjs` inhangen** in de appheader, zodat de code permanent
   zichtbaar is zodra er een sessie is — voor host én speler, en ook wanneer de
   room vergrendeld is (`D-019`; vergrendelen blokkeert het joinen, niet het
   tonen).

2. **De twee knoppen uit de lobby halen.** `Toon code` en `Toon QR-code`
   vervallen zodra de code bovenin staat en de QR één tik verderop zit. Daarmee
   verdwijnt ook de laatste term van de verboden-copylijst.
   `Delen` en `Kopieer link` blijven.

3. **De QR-kaart als component** (`05` §7): label `Scan om mee te doen`, QR met
   voldoende stille zone, code, korte URL — bij elkaar, niet los. `room-header.mjs`
   heeft dit al; til het uit die module zodra thema 1 het elders nodig heeft
   (podium, groot scherm) in plaats van het te kopiëren.

4. **Controleer de aannames die ik in `room-header.mjs` heb gemaakt** — hij is
   nooit tegen een echte sessie gedraaid:
   - `setJoinUrl()` wordt aangeroepen zodra de joinUrl bekend is;
   - `destroy()` bij het verlaten van een sessie, anders blijft de code van een
     oude room in beeld;
   - de code blijft leesbaar naast het hamburgermenu op 320px breedte.

## Regels

- **Het is een naad, geen overdracht.** De component is van thema 2, het scherm
  (`S05`) van thema 1. Wie hem inhangt bepalen we samen; wie hem onderhoudt
  staat vast.
- **Geen externe QR-dienst**, ooit (`DEPLOYMENT-AND-TESTING.md`). De
  gevendorde generator blijft.
- **Geen `innerHTML` voor de QR.** De data-URL op een `<img>` is bewust
  gekozen boven een SVG-string; de CSP staat `img-src data:` toe en verder
  niets.
- De QR mag niet kleiner worden dan scanbaar. `05` §7 vraagt om een test met
  een échte telefooncamera op meerdere afstanden — dat kan geen agent doen en
  hoort in thema 5's testmatrix (`T5-6`).

## Definition of done

- De code staat op elk scherm van een lopende sessie in beeld, ook tijdens een
  actieve vraag, ook als speler, ook bij een vergrendelde room.
- `Toon code` en `Toon QR-code` bestaan niet meer; `grep -rn "lobby.shareCode"
  frontend/` geeft nul treffers in de views.
- De QR opent als modal, sluit met Escape en met een tik naast de kaart, en de
  focus keert terug naar het pictogram.
- Een sessie verlaten haalt de code weg — geen code van een oude room in beeld.
- Op 320px breedte staan code, pictogram en hamburger naast elkaar zonder
  overlap.
