# Voortgang — 2. Vorm en systeem

**Eigenaar:** UX/UI-frontend (Claude) — sinds 3 augustus 2026
**Documenten:** `02-DESIGN-PRINCIPLES.md`, `05-DESIGN-SYSTEM.md`
**Criteria uit:** `11-DESIGN-QA-CHECKLIST.md` sectie I · schaal: [`NIVEAUS.md`](../NIVEAUS.md)
**Bijgewerkt:** 3 augustus 2026 · commit `54a08b2`

Dit gebied levert geen schermen maar het **gereedschap waarmee elk scherm
gemaakt wordt**. Eén zwak fundament zakt door naar alle 21 schermen tegelijk;
één reparatie tilt ze allemaal op.

Daarom is dit bestand geen inventaris maar een **werkvoorraad**. De kolom
`Blokkeert` zegt welk ander gebied op dit onderdeel wacht, en dát bepaalt de
volgorde — niet het niveau. Een 1 waar drie agents op wachten gaat vóór een 0
waar niemand op wacht.

Legenda `Blokkeert`: **→1** schermen · **→3** beweging · **→4** taal · **—** niemand

## Werkvolgorde

Afgeleid uit de kolom `Blokkeert` hieronder, niet uit de niveaus:

1. **Kleurtokens hernoemen** (→1 →3 →4) — nu de drie andere agents nog inlezen
   en niets hebben geschreven. Elke regel CSS die zij vanaf nu tegen `--bg`
   schrijven maakt deze rename duurder; over een week is het een conflict met
   vier gelijktijdige schrijvers.
2. **Motion-tokens + reduced motion** (→3) — agent 3 kan geen animatie schrijven
   zonder namen. Reduced motion hoort in dezelfde pas: erna is het overal
   terugbouwen.
3. **Laadvariant op knoppen** (→1 →4) — `Potje maken…` hangt hierop.
4. **Timer/progress, spelerchip, QR-kaart, leaderboard-rij** (→1) — de vier
   componenten die de schermen-agent nodig heeft.
5. De rest, op niveau.

## Fundamenten

| Fundament | Niveau | Blokkeert | Klaar bij niveau 2 | Stand |
|---|---|---|---|---|
| Kleurtokens | 1 | →1 →3 →4 | Rolnamen conform `05` §2.1 (`--color-bg-canvas`, `--color-accent-competition`), en een competitie-/goudaccent dat in beide thema's contrasteert. | Werkende set met licht/donker, gelijk aan de singleplayer. Namen zijn presentatief (`--bg`, `--surface`), niet semantisch. Goud bestaat alleen als fallback in `components.css`. |
| Motion-tokens | 0 | →3 | Vaste schaal (`--motion-instant` t/m `--motion-stage`) plus easingrollen, en géén losse duration meer in de CSS. | Bestaan niet. Er staan losse `0.12s`- en `0.18s`-waarden verspreid door `base.css` en `components.css`. **Staat ook in `3-beweging-en-gevoel/PROGRESS.md` — zie de notitie onderaan.** |
| Typografie | 1 | →1 | Rollen `display-code`, `heading-1/2`, `body`, `label`, `numeric` bestaan als klassen, en code/score/timer gebruiken de numerieke rol. | Eén leesbare schaal, verder niets. Code en score krijgen geen eigen moment. Definitieve lettertypekeuze is `O-002` en blokkeert niveau 3, niet 2. |
| Contrast | 2 | — | *Niveau 3 n.v.t.* — dit is een drempel, geen beleving. Blijft 2 zolang elke nieuwe kleur AA haalt. | Tekst haalt AA in beide thema's, focusring contrasteert, disabled is niet langer alleen opacity. Vlaggen missen nog een neutrale rand tegen lichte achtergronden (`05` §2.2). |
| Spacing | 2 | — | *Niveau 3 n.v.t.* | Consistente ritmiek sinds de fundamentfix. **Schuld:** de schaal is nergens vastgelegd, dus consistentie berust op oplettendheid. Geen safe-area-afhandeling. |
| Radii en randen | 2 | — | *Niveau 3 n.v.t.* | Twee radii, subtiele randen, weinig schaduw. Volgt `05` §2.5–2.6: niet alles is een pil, focusring is geen decoratieve glow. |

## Componenten

| Component | Niveau | Blokkeert | Klaar bij niveau 2 | Stand |
|---|---|---|---|---|
| Knophiërarchie | 1 | →1 →4 | Laad- en actieve staat op elke variant, en `quiet` daadwerkelijk in gebruik. | Primary, secondary, quiet, destructive en gameplay-option staan los sinds `d3c900e` — het gedeelde regelblok waar `05` §15 tegen waarschuwt is weg. **Maar er is geen laadvariant**, en `quiet` bestaat zonder één gebruiker. Verlaagd van 2 naar 1: `05` §4.1 eist een loadingvariant. |
| Loading / empty / error | 1 | →1 →4 | Elke laadstaat benoemt zijn activiteit, elke lege staat verklaart zichzelf en biedt een actie. | Foutteksten zijn specifiek en volledig vertaald — dat deel is af. Laadstatussen benoemen niets, lege staten verklaren niets. |
| Timer en progress | 1 | →1 | Horizontale progressbalk met rustige normale fase en nadruk in de laatste drie seconden; numerieke tijd optioneel ernaast. | Numerieke aftelling op serveroffset, verder niets. `05` §9 vraagt om een balk als basisvorm. |
| Spelerchip | 1 | →1 | Naam met tijdelijke kleur/symboolidentiteit en toegankelijke volledige naam bij afkapping. | Naam met afkapping. Geen identiteit, geen joinmotion. |
| QR-kaart | 1 | →1 | Eén component met label, QR met stille zone, code en korte URL bij elkaar. | Generator en overlay werken lokaal, zonder externe dienst. `room-header.mjs` heeft de volledige kaart al, maar hangt nergens — zie de notitie onderaan. |
| Leaderboard-rij | 1 | →1 | Vaste rankkolom, flexibele naam, tabulaire score, bewegingskolom met symbool én tekst. | Rank, naam en score met tabular nums. Geen bewegingskolom, dus `↑2` kan niet worden getoond. |
| Overlays | 1 | →1 | Bottom sheet op mobiel, paneel op desktop; modal alleen voor echte onderbreking. | QR- en pauze-overlay met rol, label, Escape en focusherstel — toegankelijk in orde. Maar het zijn modals; `05` §12 vraagt op mobiel om een sheet. |
| Gameplay option | 1 | — | Letter- en vormidentiteit per positie, plus de elf staten uit `05` §5. | Werkt en heeft eigen regels, maar is visueel een knop. Bewust uitgesteld door `D-021` — dus geen schuld, een besluit. |
| Invoervelden | 2 | — | Visuele codeformattering en een tekenteller bij nadering van de limiet tillen dit naar 3. | Code- en naamveld met focusstijl, numeriek toetsenbord, placeholder, plakbaar. |
| Kaarten en panels | 2 | — | Onderscheid tussen de zes kaarttypen uit `05` §11, spaarzaam toegepast. | Deelblok, spelersrij en pauzekaart delen één stijl en dat oogt rustig. Geen typenonderscheid. |
| Thema's | 2 | — | *Niveau 3 n.v.t.* | Donker en licht delen dezelfde rollen, keuze blijft lokaal bewaard, geen flash bij wisselen. |
| CSS-architectuur | 1 | — | De mappenstructuur uit `05` §15, of een bewust vastgelegd alternatief. | Twee bestanden met een duidelijke grens (base = reset en layout, components = componenten). Werkt nu; schaalt niet naar vier gelijktijdige schrijvers. |

## Niet bouwbaar zonder besluit

Deze twee staan op 0 en blijven daar tot iemand anders iets beslist. Ze in de
werkvoorraad zetten zou het beeld vertekenen: mijn werkelijke speelveld is niet
achttien onderdelen maar de negen op niveau 1.

| Onderdeel | Niveau | Wacht op | Waarom ik hier niets kan |
|---|---|---|---|
| Wereldmotieven | 0 | `O-003` accentkleur + echt visueel ontwerp | `05` §2.7 vraagt om raster, routeboog, kaartcontour of atlasmotief. Dat is ontwerpwerk, geen CSS-werk. Zonder vastgestelde accentkleur is elke uitwerking weggegooid. |
| Iconografie | 0 | `O-002` lettertype + een merkontwerper | `D-015` keurt de emoji-placeholders af (🌍 als logo, 🥇🥈🥉 als medailles), maar er is geen set om ze mee te vervangen. |

Samen zijn dit precies de twee onderdelen die `R3` in de roadmap als hoofdrisico
benoemt: **zonder eigen visuele grammatica blijft dit generieke donkere
gaming-esthetiek**, hoe netjes elk scherm ook wordt. Dit is het enige deel van
dit gebied dat een frontender niet kan oplossen.

## Telling

| Niveau | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| Fundamenten | 1 | 2 | 3 | 0 |
| Componenten | 0 | 7 | 4 | 0 |
| Niet bouwbaar | 2 | 0 | 0 | 0 |

Verschoven sinds de eerste opname: knophiërarchie van 2 naar 1 (geen
laadvariant, `05` §4.1), en motion-tokens toegevoegd als eigen regel.

## Twee naden die niet van mij alleen zijn

Volgens `docs/handoff-principles.md` beschrijf ik ze hier in plaats van ze stil
op te lossen.

**Motion-tokens staan in twee bestanden.** Ze staan als fundament in
`3-beweging-en-gevoel/PROGRESS.md` én hierboven. Inhoudelijk horen tokens bij
het designsysteem (`05` §2), maar agent 3 is de enige gebruiker. Voorstel: ik
lever de tokens, agent 3 gebruikt ze en houdt de vijftien gebeurtenissen bij.
Eén regel schrappen in één van beide bestanden — welke, is aan ons samen.

**`room-header.mjs` hangt nergens.** Ik heb hem gebouwd (`d3c900e`, besluit
`D-018`), volledig en zelfstandig, maar niet ingehangen; de bijbehorende
opruiming in de lobby (`Toon code` en `Toon QR-code` vervallen dan) is niet
gedaan. Als component is hij van mij, als scherm is `S05` van gebied 1.
Voorstel: agent 1 hangt hem in, ik onderhoud de component. Zolang dat niet
gebeurt is het dode code, en dat is mijn schuld, niet die van agent 1.

## Voorstel aan de andere vier eigenaren

Dit bestand heeft twee kolommen die de andere vier niet hebben: `Blokkeert` en
`Klaar bij niveau 2`. Ik heb ze toegevoegd omdat ik als eigenaar een
werkvoorraad nodig heb en geen lijst, en omdat "niveau 1" zonder criterium
binnen een maand naar 2 schuift zonder dat er iets is veranderd.

Het dashboard breekt er niet op — de parser zoekt de `Niveau`-kolom op naam, dus
extra kolommen worden gewoon meegetoond. Neem het over als het jullie helpt;
laat het staan als het jullie gebied niet past. Ik leg het niet op.
