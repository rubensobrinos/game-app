# Prompt — T2-7: Besluitverzoek `O-002` en `O-003`

Onderdeel van [`README.md`](README.md). **Geen bouwtaak.** Dit is een verzoek
aan de producteigenaar, geschreven zoals `docs/handoff-principles.md` het
voorschrijft: een concreet voorstel, maar het besluit blijft bij hem.

## Waarom dit er ligt

Twee onderdelen van thema 2 staan op 0 en blijven daar, hoeveel tijd er ook in
gestoken wordt:

| Onderdeel | Wacht op |
| --- | --- |
| Wereldmotieven (`05` §2.7) | `O-003` — de exacte accentkleur |
| Iconografie (`05` §3) | `O-002` — het lettertype, plus een merkontwerper |

Ze staan niet stil door capaciteit maar door een ontbrekende keuze. En ze zijn
samen precies wat `10-IMPLEMENTATION-ROADMAP.md` als risico `R3` benoemt:
**zonder eigen visuele grammatica blijft dit generieke donkere
gaming-esthetiek**, hoe netjes elk scherm verder ook wordt.

Ze blokkeren ook buiten dit thema. Thema 5 noemt `O-002`/`O-003` expliciet als
reden om medium/tablet- en podiumcomposities nog niet als prompt te schrijven.

## `O-002` — lettertype

**Werkhypothese uit het besluitregister:** `Space Grotesk` of `Sora` voor
display, `Inter` voor UI.

**Wat wij vandaag hebben:** `'Segoe UI', system-ui, -apple-system, Roboto,
sans-serif`. Dat is de systeemfont-stack van de singleplayer. Hij is snel
(geen download), maar hij is van niemand — op een iPhone ziet Rounda er
daardoor anders uit dan op Android, en op geen van beide herkenbaar.

**Wat het besluit raakt:**

- de typografierollen uit `05` §2.3 (`display-code`, `numeric`) kunnen wél al
  zonder, maar krijgen pas karakter mét;
- een webfont kost laadtijd op 4G — dat is een reële afweging tegen `P8`;
- licentie en herkomst moeten geregeld zijn vóór livegang.

**Wat ik zou voorstellen:** systeemfont houden voor bodytekst, en één display-
font toevoegen voor uitsluitend code, score, rank en podium. Dat zijn korte
strings, dus een subset volstaat en de laadkosten blijven klein. Maar dit is
een merkbeslissing, geen technische.

## `O-003` — accentkleur

**Werkhypothese:** indigo/violet, gevalideerd op contrast en op onderscheid met
vlagkleuren.

**Wat wij vandaag hebben:** `#7c3aed` met `#a855f7` als lichtere variant,
overgenomen uit de singleplayer.

**Wat het besluit raakt:**

- de wereldmotieven kunnen pas ontworpen worden als vaststaat waaraan ze zich
  ondergeschikt moeten maken;
- `05` §2.2 vraagt dat het accent zich onderscheidt van vlagkleuren — paars is
  daarvoor gunstig (weinig nationale vlaggen gebruiken het), maar dat is nooit
  getoetst;
- thema 5 heeft in `58eba07` het lichte thema al moeten corrigeren omdat
  `--accent-light` als tekst op 3,61:1 zat. Elke wijziging aan het accent
  vraagt die berekening opnieuw.

**Wat ik zou voorstellen:** de huidige paarse familie bevestigen als
merkaccent, en de goud/competitiekleur apart vaststellen — die ontbreekt nu
volledig in het lichte thema en podium en rank hebben hem nodig.

## Wat ik nodig heb om verder te kunnen

Eén van deze drie per vraag:

1. **Bevestigd** — de werkhypothese wordt het besluit. Dan kan ik `05` §2.3 en
   §2.7 uitwerken en vervalt de blokkade voor thema 5's composities.
2. **Anders, met een richting** — dan pas ik de tokens aan vóór thema 1, 3 en 4
   er CSS tegen schrijven.
3. **Nog niet, en dat is bewust** — ook goed, maar dan staat vast dat
   wereldmotieven en iconografie deze release niet halen, en dan hoort `R3`
   als geaccepteerd risico in `STATUS.md` in plaats van als openstaand punt.

Optie 3 is een legitiem antwoord. Wat niet werkt is de vraag open laten en
tegelijk verwachten dat het product er eigen uitziet.

## Regels

- Geen agent vult dit stilzwijgend in (`00-DESIGN-INDEX.md` §4).
- Zolang er geen antwoord is: geen half werk. Een wereldmotief tekenen tegen
  een accentkleur die nog kan wijzigen is weggegooid werk, geen voorschot.
