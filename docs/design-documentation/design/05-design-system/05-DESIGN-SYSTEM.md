# 05 — Design System

## 1. Doel

Het designsysteem voorkomt dat alle contexten dezelfde AI-templatecomponenten krijgen. Het systeem ondersteunt snelheid, gamefeel, toegankelijkheid en herkenbare wereldesthetiek.

Exacte tokens worden tijdens visueel ontwerp gekalibreerd. Rollen en componenthiërarchie zijn wel onderdeel van de baseline.

## 2. Foundations

### 2.1 Kleurenrollen

Gebruik semantische tokens, geen kleurcodes verspreid in component-CSS.

```text
--color-bg-canvas
--color-bg-arena
--color-surface-1
--color-surface-2
--color-surface-elevated
--color-border-subtle
--color-border-strong
--color-text-primary
--color-text-secondary
--color-text-muted
--color-accent-primary
--color-accent-primary-hover
--color-accent-primary-active
--color-accent-competition
--color-success
--color-danger
--color-warning
--color-focus
--color-overlay
```

**Baselinerichting:**

- diep nachtblauw/inkt voor dark canvas;
- blauwgrijze surfaces;
- helder indigo/violet als merkaccent;
- warm goud voor competitie/podium;
- groen en rood uitsluitend semantisch;
- warm gebroken wit voor light canvas.

### 2.2 Contrastregels

- normale tekst minimaal WCAG AA;
- grote displaytekst minimaal AA;
- focusring zichtbaar op alle surfaces;
- disabled-state blijft leesbaar en wordt niet uitsluitend `opacity: .5`;
- vlaggen en afbeeldingen krijgen zo nodig een neutrale rand tegen de achtergrond.

### 2.3 Typografie

**Voorgesteld:**

- display: `Space Grotesk` of `Sora`;
- UI/body: `Inter` of gelijkwaardig zeer leesbaar sans-serif.

Rollen:

- `display-hero`: merk/arena-moment;
- `display-code`: roomcode en grote score;
- `heading-1`: schermtitel;
- `heading-2`: sectie/resultaat;
- `body-lg`: primaire uitleg;
- `body`: standaard UI;
- `label`: knoppen en statussen;
- `caption`: ondersteunende metadata;
- `numeric`: tabular nums voor timer, score, rank en code.

Geen gradient op iedere heading. Gradient of speciaal effect is gereserveerd voor merklock-up of zeldzaam hero-moment.

### 2.4 Spacing

Gebruik een consistente schaal, bijvoorbeeld:

`4, 8, 12, 16, 20, 24, 32, 40, 48, 64`.

Principes:

- touchcontrols hebben onderlinge ademruimte;
- kaarten gebruiken ruime interne padding;
- op kleine schermen krimpt decoratieve spacing vóór touch target of leesbaarheid;
- sticky actiezone houdt rekening met safe areas.

### 2.5 Radii

Niet alles wordt een pill.

- klein: tags, chips;
- medium: inputs, normale knoppen;
- groot: kaarten en QR-surface;
- volledig rond: alleen iconbutton, avatar/symbool of statusdot.

### 2.6 Borders en schaduw

- subtiele borders leveren structuur;
- schaduw is spaarzaam en functioneel voor elevation;
- geen zware glow op iedere primary button;
- focusring is niet hetzelfde als decoratieve glow.

### 2.7 Wereldmotieven

Toegestaan:

- subtiel raster van lengte-/breedtegraden;
- routeboog;
- kaartcontour als laag contrast;
- atlaslabel;
- coördinaatnotatie;
- scorebordachtige numerieke lijnen.

Regels:

- nooit de leesbaarheid van vlag of tekst verminderen;
- maximaal één dominant achtergrondmotief per scherm;
- decoratie reageert niet alsof zij interactief is;
- geen drukke wereldkaart achter antwoordopties.

## 3. Iconografie en assets

- één consistente iconenset;
- belangrijke iconacties altijd met tekstlabel;
- eigen logo/beeldmerk, geen 🌍 als productlogo;
- eigen medaille/podiumassets, geen 🥇🥈🥉 als definitieve oplossing;
- antwoordvormen zijn geometrisch en consistent;
- vlaggen blijven echte assets met correcte verhoudingen.

## 4. Knophiërarchie

### 4.1 Hero button

Voor één primaire productactie per scherm, bijvoorbeeld `Start direct een game`.

- visueel grootste actie;
- niet voor instellingen of modalbuttons;
- bevat loadingvariant;
- mag volle breedte op mobiel, contentbreedte op desktop.

### 4.2 Primary button

Voor primaire actie binnen een state, bijvoorbeeld `Start game — 7 spelers`, `Ik doe mee`, `Revanche`.

### 4.3 Secondary button

Voor relevante maar niet-dominante alternatieven, bijvoorbeeld `Nieuw spel`.

### 4.4 Quiet button/link

Voor lage prioriteit, bijvoorbeeld `Spel aanpassen`, `Delen`, `Voorkeuren`.

### 4.5 Destructive button

Voor `Game beëindigen` en speler verwijderen.

- rood niet als volledige permanente nadruk in normale view;
- duidelijke bevestiging;
- nooit naast primary zonder voldoende onderscheid.

### 4.6 Icon-with-label

Voor compacte hostactions. Icoon alleen is onvoldoende bij niet-universele acties.

## 5. Gameplay option

Gameplay options zijn geen gewone secondary buttons.

### Anatomie

- positiebadge met letter en symbool;
- tekstlabel;
- optioneel media/waarde;
- state-indicator rechts;
- volledige rij als target.

### States

| State | Visueel | Gedrag |
|---|---|---|
| default | neutrale surface, positie-identiteit | tappable |
| hover | lichte elevation/border | desktop enhancement |
| focus-visible | sterke focusring | keyboard |
| active | korte press/scale | directe feedback |
| selected | primaire accentrand/surface | onmiddellijk na tap |
| submitting | status/progress, locked | geen dubbele tap |
| submitted | `Verstuurd ✓`, geselecteerd blijft | correctheid verborgen |
| disabled | leesbaar, duidelijk niet-actief | reden waar nodig |
| correct | groen + icoon + tekst | alleen na reveal |
| incorrect-selected | rood/contrasterend + tekst | alleen na reveal |
| not-selected | verlaagd, maar leesbaar | revealcontext |

Kleur is nooit de enige drager: gebruik icoon en resultaattekst.

## 6. Inputs

### Roomcode

- grote numerieke tekst;
- mobiel numeriek toetsenbord;
- pastevriendelijk;
- codeformattering visueel;
- duidelijke invalid/expired states.

### Naaminput

- voorgestelde waarde zichtbaar geselecteerbaar;
- charactercounter alleen bij nadering limiet;
- error niet alleen in kleur;
- submit via toetsenbord.

## 7. QR-card

Bevat:

- label `Scan om mee te doen`;
- grote QR met quiet zone;
- roomcode;
- korte URL;
- deelactie buiten of onder de card.

QR mag niet te klein worden door naastliggende decoratie. Test met werkelijke telefooncamera op meerdere afstanden.

## 8. Spelerchip / spelerrow

- naam;
- eenvoudige tijdelijke identiteit: kleur + symbool;
- joinmotion;
- ellipsis en toegankelijke volledige naam;
- optionele hostmenuactie;
- geen kinderavatar als default.

## 9. Timer en progress

Baselinerichting: horizontale progressbar.

- normale fase rustig;
- laatste drie seconden verhoogde nadruk;
- numerieke tijd optioneel naast progress;
- waarschuwing niet continu rood;
- screenreader updates niet iedere tiende seconde.

## 10. Leaderboard row

- rankkolom vast;
- naam flexibel;
- score tabular;
- movement compact;
- eigen row met accent en label `Jij` indien nodig;
- stijgen/dalen met symbool én toegankelijke tekst.

## 11. Cards en panels

Cardtypen:

- QR-card;
- result-card;
- stat-card;
- management-panel;
- preference-sheet;
- podium-surface.

Niet iedere tekstgroep krijgt automatisch een card. Surfacehiërarchie wordt spaarzaam gebruikt.

## 12. Overlays

- bottom sheet op mobiel;
- side panel op desktop;
- modal alleen voor echte onderbreking/confirmatie;
- geen popover over actieve onbeantwoorde vraag behalve essentiële mute/noodactie;
- overlay sluitbaar via duidelijke actie en Escape waar relevant;
- focus trap correct.

## 13. Loading, empty, error en disabled

### Loading

- behoud context;
- benoem activiteit: `Potje maken…`, `Antwoord versturen…`;
- spinner alleen als aanvullende cue;
- skeleton alleen bij contentlijsten, niet als universeel effect.

### Empty

- verklaart waarom leeg;
- biedt concrete volgende actie;
- gebruikt geen generieke illustratie die de taak overschaduwt.

### Error

- specifieke oorzaak indien bekend;
- menselijke taal;
- herstelactie;
- technische detailcode alleen secundair/kopieerbaar.

### Disabled

- niet alleen lagere opacity;
- waar onduidelijk: korte reden;
- focus/tooltip alleen als toegankelijk en mobiel bruikbaar.

## 14. Thema's

Dark en light gebruiken dezelfde semantische rollen. Geen aparte merkidentiteit per thema.

- systeem is default;
- keuze blijft lokaal bewaard;
- themawisseling veroorzaakt geen flash;
- vlagassets blijven correct zichtbaar;
- podium blijft feestelijk in beide thema’s.

## 15. CSS/componentarchitectuur

Aanbevolen scheiding:

```text
styles/
  tokens.css
  reset.css
  typography.css
  layout.css
  motion.css
  utilities.css
components/
  Button/
  GameplayOption/
  RoomCode/
  QRCard/
  PlayerChip/
  Timer/
  LeaderboardRow/
  ResultPanel/
  BottomSheet/
  ConnectionStatus/
```

Varianten worden semantisch benoemd, niet per pagina gekopieerd. Vermijd één gedeeld regelblok dat hero, secondary, gameplay-option en podiumrematch identiek maakt.
