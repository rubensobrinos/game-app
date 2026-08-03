# Prompt — T2-11: Lege en foutstaten als patroon

Onderdeel van [`README.md`](README.md). Blokkeert thema 1 en thema 4.

Deze prompt sluit het gat dat in [`REVIEW.md`](REVIEW.md) als openstaand is
genoteerd: `T2-2` dekt alleen de laadstaat op knoppen, terwijl `05` §13 over
loading **én** empty **én** error gaat.

## Brondocument

`05-DESIGN-SYSTEM.md` §13 (Loading, empty, error, disabled).
`09-CONTENT-AND-MICROCOPY.md` §4 (errors) en §6 (lege lobby).
`08-ACCESSIBILITY-AND-RESILIENCE.md` §6 (roomfouten).

## Wat er nu staat

Beide staten bestáán, maar elk scherm heeft zijn eigen versie:

| Staat | Waar | Vorm |
| --- | --- | --- |
| Lege lobby | `.lobby-empty` + `-title` + `-hint` | eigen blok, alleen voor de lobby |
| Veldfout | `.field-error` | rood vlak onder een invoerveld |
| Verbindingsfout | `.session-banner.is-disconnected` | balk bovenaan |
| Terminale roomfout | eigen scherm in `session-shell.mjs` | los gebouwd |

Vier oplossingen voor twee patronen. Dat werkt zolang er vier zijn; bij het
achtste scherm heeft iedereen zijn eigen variant en is er geen gedeelde vorm
meer — precies het probleem dat `05` §15 bij de knoppen beschreef en dat daar
al een keer is opgeruimd.

`05` §13 stelt bovendien twee inhoudelijke eisen waar geen van de vier aan
voldoet:

- **Empty** verklaart wáárom hij leeg is én biedt een concrete volgende actie.
  `.lobby-empty` doet dat wél ("Laat iemand de QR scannen") — de andere
  schermen hebben geen lege staat.
- **Error** noemt de oorzaak, in menselijke taal, met een herstelactie. Onze
  fouttéksten zijn goed (`09` is netjes gevolgd), maar de meeste hebben geen
  actie ernaast: je leest wat er mis is en kunt niets.

## Wat dit is

1. **Eén lege-staatcomponent.** Kop, uitleg, en een optionele actie. De lobby
   is het model — die heeft de goede vorm, hij is alleen niet herbruikbaar.

2. **Eén foutcomponent, in twee zwaartes.** Inline (bij een veld of een blok)
   en paginabreed (een scherm dat niet verder kan). De bestaande `.field-error`
   en het terminale scherm zijn die twee zwaartes; ze horen alleen uit dezelfde
   bron te komen.

3. **De herstelactie is onderdeel van de component, niet optioneel bijwerk.**
   `05` §13 en `08` §6 koppelen aan elke fout een vervolgstap. Een fout zonder
   actie is een doodlopende weg, en dat is precies waar `08` §6's tabel tegen
   bedoeld is.

4. **De vier bestaande plekken omzetten.** Anders staan er vijf patronen in
   plaats van vier, en dat is erger dan niets doen.

5. **Toegankelijkheid overnemen, niet opnieuw bedenken.** De sessiebanner heeft
   `aria-live="assertive"` en de veldfout een gekoppeld label; die
   eigenschappen horen in de component te zitten zodat het volgende scherm ze
   gratis krijgt.

## Regels

- **Geen teksten schrijven.** Wat er in een lege of foute staat staat is thema
  4 (`09` §4 en §6). Deze prompt levert de vorm en de plek; de woorden komen
  daarvandaan. Bij een ontbrekende tekst: melden, niet zelf invullen.
- **De terminale roomfout is een scherm, geen component.** Dat blijft van thema
  1 (`S21`). Lever de foutcomponent die dat scherm gebruikt; bouw het scherm
  niet.
- **`disabled` valt hierbuiten** — dat is al opgelost in `d3c900e` en staat op
  niveau 2.
- Stem af met thema 1 vóór je de vier bestaande plekken omzet: `lobby.mjs` en
  `session-shell.mjs` zijn zijn schermen.

## Definition of done

- Eén lege-staatcomponent en één foutcomponent, allebei in beide thema's
  gerenderd — screenshot.
- De vier bestaande plekken gebruiken ze; `grep -n "lobby-empty\|field-error"
  frontend/css/` toont geen losse implementatie meer naast de component.
- Elke fout die een herstelactie kán hebben, heeft er een.
- `aria-live` en labelkoppeling zitten in de component, niet bij de aanroeper.
- Geen tekst hardgecodeerd; alles via `t()`.
- `node --test frontend/ client/` blijft groen.
