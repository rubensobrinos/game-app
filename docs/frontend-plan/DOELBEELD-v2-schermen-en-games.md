# Doelbeeld v2 — de vijf schermen en de vier games

**Status: canoniek doelbeeld** (producteigenaar, 3 aug 2026). De screenshot
van de Claude-Design-iteratie is **leidend**; dit document legt die vast plus
de productconcept-uitwerking en de vier besluiten van de producteigenaar.
Vervangt eerdere schermbeschrijvingen waar die conflicteren (o.a. het "code
permanent groot"-paneel uit BRIEFING §3.3 — zie besluit A hieronder).

Tagline: **"Wereldgames met de hele kamer. Goed én snel telt."**

---

## 1. De vier games

Rounda is geen "één vlaggenquiz" maar een compacte verzameling wereldgames
met dezelfde kern: *je ziet iets, je herkent het land, je antwoordt snel en
je vergelijkt jezelf direct met de groep.*

| Game | Wat zie je? | Wat doe je? |
| --- | --- | --- |
| **Raad de vlag** | Een vlag | Kies of typ het land |
| **Echt of nep** | Een vlag | Kies echt of nep |
| **Welke hoort er niet bij?** | Meerdere vlaggen | Kies de afwijkende vlag |
| **Raad het land** | De contour van één land | Kies of typ het land |

- **Raad het land blijft exact zo basic**: contour van één land, vier namen
  of zelf typen, antwoord, door. Geen wereldkaart, geen prikken, geen extra
  mechaniek — dat is juist de kracht.
- **Welke hoort er niet bij? — nog scherp te maken**: elke vraag heeft één
  duidelijke, uitlegbare afwijklogica (bijv. drie Europese + één Aziatisch
  land; drie rood-wit-blauw + één andere; drie buurlanden + één
  buitenstaander; drie echt + één nep), en die logica wordt **na het
  antwoord kort getoond**. Anders denkt een speler terecht dat meerdere
  antwoorden verdedigbaar zijn. (Open ontwerppunt; besluit nodig vóór bouw
  van deze game.)

## 2. De vijf schermen (screenshot leidend)

### Scherm 1 — HOME
- Rad-logo (actief, draaiend), wordmark ROUNDA.
- Tagline "Wereldgames met de hele kamer. Goed én snel telt."
- Primair: **START EEN GAME** (lime hero-pil) met sub "GEEN ACCOUNT · JIJ
  LEIDT".
- Code-kaart eronder: code invoeren, "Plakken werkt · QR-scan ook".
- Voorkeuren (taal/thema) via bescheiden ingang; geen zware chrome.

### Scherm 2 — LOBBY + INSTELLINGEN (host, één scrollbaar scherm)
Het aparte instellingenscherm bestaat niet meer. Eén scroll, START vast
onderaan (sticky).

- **Smalle codebalk bovenaan** (permanent zichtbaar): CODE in mono +
  QR-icoon (tik → QR-modal/fullscreen) + deel-knop. *Besluit A: dit
  vervangt het grote codepaneel; de balk is permanent, de grote QR zit op
  één tik.*
- Spelersteller + chips van binnengekomen spelers (kleurblokjes), "+N".
- **Gamekeuze-carrousel**: "RAAD DE VLAG" groot, ‹ draai › voor de andere
  drie games.
- **Antwoorden:** Kiezen / **Mix** / Typen (drie-stand).
- **Niveau:** Easy / Medium / Hard.
- **Vragen:** 5 / 10 / 15.
- **Toggles:** "Automatisch volgende vraag" en "Antwoord automatisch tonen".
- **Meer instellingen** (ingang voor de rest: richting, continenten,
  vragentaal, late instap, host speelt mee, …).
- **START HET SPEL** sticky onderaan.

### Scherm 3 — LOBBY (speler/gast)
Geen apart meedoen-scherm: gast landt via link/QR/code **direct in de
lobby**.

- Naamvoorstel bovenaan: "Zo heet je vanavond: **Speler 07**" + eigen kleur;
  opties "Andere" en "Eigen naam typen". Doorspelen zonder typen kan altijd.
- Knop **IK BEN KLAAR** → *besluit B: puur client-side bevestiging van je
  naam; daarna wacht je tot de host start. Géén server-side ready-check,
  geen protocolwerk.*
- Onderaan compacte info: gekozen game + modus + aantal vragen ("Raad de
  vlag · Mix · 10 vragen — [host] kan elk moment starten").

### Scherm 4 — DE VRAAG
Ongewijzigd t.o.v. huidige 1c-bouw: vlag/opgave, segmententimer, rad als
rondeteller, antwoordpillen met vorm-identiteit (Ruit/Bol/Piek/Blok), nooit
goed/fout vóór ronde-einde.

### Scherm 5 — REVEAL + TUSSENSTAND (één scherm)
Reveal en scorebord zijn samengevoegd tot één moment:

- Het goede antwoord groot ("OOSTENRIJK").
- Persoonlijk resultaat: "Jij zat goed ✓ **+847** · 4e die 'm had ·
  snelheidsbonus".
- Top 5 met ▲▼-bewegingspijlen **plus je eigen rij** (bijv. "8 · Jij").
- Aftelbalk onderaan: "volgende vraag over 5 sec" — of, als "Automatisch
  volgende vraag" uit staat, een host-knop **Volgende**.

## 3. De vier besluiten (producteigenaar, 3 aug 2026)

| # | Besluit |
| --- | --- |
| A | **Screenshot leidend**: smalle permanente codebalk + QR-op-één-tik vervangt het grote code/QR-paneel (herziening van BRIEFING §3.3 / eerdere D-018-lijn). |
| B | **IK BEN KLAAR** = naam bevestigen, daarna wachten tot start. Client-side; geen ready-check in het protocol. |
| C | **Host-getriggerde reveal bouwen**: toggle "Antwoord automatisch tonen" uit → de host onthult. Dit is serverwerk (nieuwe host-actie in de match-lifecycle). |
| D | **Mix en Typen zichtbaar maar disabled** ("binnenkort") tot de typed-answers-feature af is. Idem carrousel: alleen "Raad de vlag" actief tot game 2-4 bestaan. |

## 4. Ontwerp-principes uit de concept-uitwerking

### 4.1 Eén verstandige standaard per game — de host mag níets hoeven doen
Er zijn veel mogelijke keuzes (game, antwoordvorm, richting, niveau,
continenten, taal, mixgedrag) maar de gebruiker mag dat gewicht niet voelen.
Elke game heeft één standaard; bij **Raad de vlag**: meerkeuze, vlag → land,
medium, wereldwijd, tien vragen. De host ziet hooguit drie compacte keuzes
(Antwoorden / Niveau / Meer instellingen); niets aanpassen = toch een goede
game. **De ontwerpdiscipline: rijkdom onder de motorkap, voorkant extreem
eenvoudig.**

### 4.2 Mix is voorspelbaar eerlijk, niet willekeurig
Bij tien vragen: vijf kiezen + vijf typen, volgorde willekeurig, **nooit
meer dan twee dezelfde vormen achter elkaar**. (Anders bevat een ronde
toevallig acht typevragen.)

### 4.3 Niveau bepaalt alléén de landenselectie
- Easy: zeer bekende landen; Medium: redelijk herkenbaar; Hard: minder
  bekend of visueel vergelijkbaar.
- De **antwoordvorm** bepaalt hoeveel hulp iemand krijgt — dat is een
  **aparte as** en blijft intern én visueel gescheiden van niveau.

### 4.4 De sessie onthoudt gebruikte landen
Wie na Raad de vlag direct Raad het land speelt, wil niet opnieuw Nederland,
Frankrijk en Brazilië. De sessie onthoudt recent gebruikte landen en
prioriteert tijdelijk andere. Geen extra instelling — gewoon gedrag.

### 4.5 Wat dit concept sterk maakt (vastgelegd als toetssteen)
- Games direct begrijpelijk zonder tutorial; één voorbeeldvraag volstaat.
- Dezelfde kennis anders getest (vlaggen ≠ contouren ≠ nepvlaggen) =
  variatie zonder inhoudelijke uitwaaiering.
- De lobby ontstaat direct; de host legt de groepsenergie nooit stil voor
  een formulier.
- Interfacetaal en vragentaal gescheiden: internationaal samen spelen.
- De revanche houdt de groep bij elkaar: het product stopt niet bij het
  podium — "nog een Rounda".

## 5. Implementatie-impact (regie-inschatting)

| Onderdeel | Aard | Zwaarte |
| --- | --- | --- |
| Scherm 5: reveal+tussenstand samenvoegen | Client (render reveal- en scoreboard-data in één view) | Middel |
| Scherm 3: gast direct in lobby + naamvoorstel + IK BEN KLAAR | Client (join-flow herschikken; naamvoorstel bestaat al deels) | Middel |
| Scherm 2: settings in de lobby-scroll, sticky start | Client (host-setup-state verhuist de lobby in) | Middel–groot |
| Besluit C: host-onthul reveal | **Server + protocol** (nieuwe host-actie, toggle in HostConfig) | Groot |
| Carrousel + Mix/Typen disabled tonen | Client, cosmetisch | Klein |
| Mix-verdelingsregel (4.2), sessie-geheugen landen (4.4) | Server (vraagselectie) — pas relevant bij typed answers / game 2+ | Later |
| Games 2–4 | Nieuwe vraagvormen (content + server + client) | Later, per game |

Bouwvolgorde (akkoord regie-voorstel): **5 → 3 → 2 (met C erin) → carrousel/
disabled-states**; games 2–4 en mix-machinerie daarna.
