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

---

# 6. Aanvulling van de producteigenaar (5 aug 2026) — punten 7 t/m 12

Letterlijk aangeleverd en hier canoniek vastgelegd, met per punt een
regie-notitie: wat er al staat, wat het kost, en waar het botst met iets
anders. De notities zijn geen tegenspraak — ze maken de bouwvolgorde
beslisbaar.

## 6.1 Landenselectie (punt 7)

**Standaard:** alle landen, wereldwijd, geen configuratie nodig.
**Onder Geavanceerde instellingen:** continenten aan- of uitzetten; mogelijk
later aanvullende filters. **Geen** lange lijst waarin de host individuele
landen selecteert.

> **Regie:** de standaard is vandaag al zo — de pool is wereldwijd en
> `difficulty` is de enige as die de landenselectie versmalt (§4.3). Er is dus
> niets te bouwen aan de default.
>
> Het continentfilter is nieuw en raakt drie lagen: een veld op
> `GameConfiguration`, een filter in `question-selection.js`, en de
> "Meer instellingen"-sectie in de lobby.
>
> **Botsing om te beslissen:** "Welke hoort er niet bij" heeft **minstens twee
> continenten** nodig — de hele opgave is drie uit continent A en één uit B.
> Zet een host alles behalve Europa uit, dan kan die game geen vraag meer
> bouwen. Drie uitwegen: (a) het filter alleen tonen bij games die het aankan,
> (b) een ondergrens afdwingen ("minstens twee continenten"), of (c) de game
> laten terugvallen op een andere afwijklogica (zie 6.5). **Voorkeur regie: (b)
> plus (c)** — een ondergrens is uitlegbaar, en (c) maakt de game sowieso beter.

## 6.2 Persoonlijke taal per speler (punt 8)

Iedere speler kiest zijn eigen taal, los van de game-instellingen. Die taal
bepaalt: knoppen, instructies, landnamen, feedback, scoreteksten én
gegenereerde spelersnamen. Nederlanders, Spanjaarden en Engelstaligen spelen zo
in dezelfde lobby, ieder in de eigen taal.

> **Regie: dit is voor het grootste deel al zo.** De app-taal staat per client
> in het hamburgermenu en wordt bewaard in `preferences`; knoppen, instructies,
> feedback en scoreteksten lopen allemaal door `i18n.mjs`, en landnamen worden
> client-side vertaald (`country-names.mjs` krijgt de app-taal mee). De
> vragentaal (`config.language`) is bewust een gaminstelling en blijft dat —
> §4.5 noemt die scheiding een kernkwaliteit.
>
> **Eén echt gat: de gegenereerde spelersnaam.** Die maakt de server nu als
> platte tekst in de taal van de ROOM (`generateName(config.language, …)`) en
> stuurt hem als `effectiveName` naar iedereen. Een Spanjaard ziet dus een
> Nederlandse naam. Dat is niet met een vertaaltabel op te lossen: de naam moet
> als **structuur** over de lijn (welk dier, welk land), zodat elke client hem
> in de eigen taal rendert. Dat is precies wat punt 12 óók nodig heeft — zie
> daar; het is één verbouwing, niet twee.

## 6.3 Raad het land (punt 9)

De speler ziet alleen de contour of kaartvorm van één land, en kiest daarna uit
vier landnamen of typt het land zelf. **Geen wereldkaart, geen locatie prikken,
geen extra interactie. Bewust basic.**

> **Regie:** ongewijzigd t.o.v. §1 en het bouwplan. De meerkeuzevariant is de
> eerste oplevering; "zelf typen" hangt aan de typed-answers-feature en komt
> daarmee mee, niet eerder. Wat deze game nog vraagt staat in
> `PLAN-CONVERGENTIE` §"Wat Raad het land nog vraagt" — de contourdata koppelen
> aan de landenpool is daar de eerste en grootste taak.

## 6.4 Echt of nep (punt 10)

De speler ziet een vlag en kiest echt of nep. Geen aanvullende antwoordvorm
nodig.

> **Regie: gebouwd en live** (5 aug, verticaal bewezen). Dat "geen aanvullende
> antwoordvorm" is nu ook expliciet: deze game slaat de Kiezen/Mix/Typen-as
> over, wat de mix-machinerie voor deze game overbodig maakt.

## 6.5 Welke hoort er niet bij? (punt 11)

Meerdere vlaggen, kies de afwijkende. Mogelijke logica: andere regio, ander
continent, ander kleurpatroon, andere vorm of symboliek, of een echte vlag
tussen neppe (of andersom). **Na het antwoord moet kort worden uitgelegd
waarom** één vlag afwijkt.

> **Regie:** gebouwd, met vandaag één afwijklogica (continent) en de uitlegregel
> erbij — dat laatste was een open ontwerppunt in §1 en is hiermee beslecht.
>
> Deze lijst is de ontbrekende helft: de andere logicavormen. Twee ervan zijn
> goedkoop omdat het materiaal er al ligt:
> - **echte vlag tussen neppe** (en andersom): `generateFlagSpec(seed)` levert
>   de nepvlaggen al voor Echt of nep;
> - **ander kleurpatroon**: de gegenereerde vlaggen dragen `pattern` en
>   `palette`; voor échte vlaggen bestaat die metadata nog niet in de pool.
>
> "Andere vorm of symboliek" vraagt nieuwe contentannotatie per vlag en is
> daarmee een orde duurder — die zou ik pas doen als de andere drie te weinig
> variatie blijken te geven.

## 6.6 Automatisch gegenereerde spelersidentiteit (punt 12)

Bij binnenkomst krijgt iedere speler automatisch een grappige naam, een
gekoppeld land, de vlag van dat land en een dier of speels woord —
*Bulgarian Cow*, *Peruvian Penguin*, *Japanese Jaguar*. De naam wordt vertaald
naar de persoonlijke app-taal.

> **Regie:** dit is de leukste toevoeging van de zes en tegelijk de enige die
> het protocol raakt. Vandaag krijgt een speler een adjectief+dier ("Vlugge
> Vos") plus een kleur uit een palet van acht; land en vlag bestaan niet, en de
> naam is een platte string in de roomtaal.
>
> **De verbouwing (één keer, dekt ook punt 8):** de identiteit wordt een
> structuur op `Player` — `{ iso2, animalKey }` — en `effectiveName` blijft
> alleen bestaan voor spelers die zélf een naam typten. Elke client rendert de
> gegenereerde identiteit in de eigen taal, met de vlag uit `flags/`.
>
> **Één taalvraag die eerst beslist moet worden.** "Bulgarian Cow" is een
> *bijvoeglijk naamwoord* van een land, en dat is nieuwe content: 230 landen ×
> 3 talen, met in het Spaans ook nog geslachtsverbuiging (*vaca búlgara*, maar
> *pingüino peruano*). Twee opties:
>
> | | A. Bijvoeglijke vorm | B. "uit"-vorm |
> | --- | --- | --- |
> | NL | Bulgaarse Koe | Koe uit Bulgarije |
> | EN | Bulgarian Cow | Cow from Bulgaria |
> | ES | Vaca búlgara | Vaca de Bulgaria |
> | Content | 230 × 3 nieuwe woorden + verbuiging | **niets** — de landnamen staan al in de pool |
> | Klank | precies het voorbeeld uit punt 12 | iets langer, even herkenbaar |
>
> **Voorstel regie: B**, met A als latere verfijning voor de dertig bekendste
> landen. Zo staat de identiteit er in dagen in plaats van weken, en blijft de
> vlag — het meest zichtbare deel — precies zoals bedoeld.

## 6.7 Wat dit betekent voor de volgorde

| # | Werk | Zwaarte | Blokkeert op |
| --- | --- | --- | --- |
| 1 | Extra afwijklogica voor "Welke hoort er niet bij" (echt-tussen-nep, kleurpatroon) | Klein–middel, server + uitlegregel | — |
| 2 | Continentfilter onder Meer instellingen | Middel, config + selectie + UI | ondergrens-besluit uit 6.1 |
| 3 | Spelersidentiteit als structuur (punt 12 + de naamhelft van punt 8) | **Groot**: Player, protocol, snapshot, client, mock | taalvraag A/B uit 6.6 |
| 4 | Raad het land | Groot, eigen contentmigratie | — |

Punt 1 kan meteen; punt 3 is de grootste maar levert twee punten tegelijk op.
