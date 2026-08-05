# Bouwplan — spelersidentiteit (*Bulgaarse Koe*)

**Besluit 41**, producteigenaar 5 aug 2026. Vastgelegd, nog niet gebouwd.
**Eigenaar van dit plan:** regie. **Peildatum:** 5 aug 2026.

Iedere speler krijgt bij binnenkomst automatisch een identiteit: een **land**
(met vlag) plus een **speels woord**, weergegeven in de bijvoeglijke vorm —
*Bulgaarse Koe*, *Peruaanse Pinguïn*. Niet "Koe uit Bulgarije".

---

## Wat je vandaag ziet, en waarom

De generator bestaat al: `generateName(language, wordListsByLanguage,
existingEffectiveNames)` in `server/data/name-processing.js` plakt een
adjectief en een dier aan elkaar en maakt de uitkomst uniek binnen de room.

**Maar in productie krijgt hij geen woordenlijst.** `server/index.mjs` (~r642)
bouwt de context met precies drie configvelden — `tokenPeppers`,
`publicAppUrl`, `contentVersion` — en `nameWordLists` zit daar niet bij.
`generateName` valt dus altijd terug op zijn laatste redmiddel: `Speler {n}`.
De enige plek waar woordenlijsten bestaan zijn drie testbestanden.

Dat verklaart de "Speler 7" die de producteigenaar ziet, en het betekent dat
**de goedkoopste helft van deze feature één regel config is**. Voordat je aan
de landbijvoeglijke naamwoorden begint, kun je met een lijst van twintig
adjectieven en twintig dieren per taal al vierhonderd namen hebben.

## De echte kosten zitten in de grammatica

Besluit 41 noemt het Spaans als de dure taal (*vaca búlgara* naast *pingüino
peruano*). Dat klopt, maar **het Nederlands is niet gratis**:

| Taal | Vorm | Verbuiging |
| --- | --- | --- |
| en | `Bulgarian Cow` | geen |
| nl | `Bulgaarse Koe`, maar `Bulgaars Konijn` | de-woord vs. het-woord |
| es | `vaca búlgara`, `pingüino peruano` | mannelijk vs. vrouwelijk, adjectief áchter |

Een Nederlands het-woord zonder lidwoord krijgt de onverbogen vorm. Reken dus
niet op "Engels is invariant, Nederlands ook, alleen Spaans is lastig": twee
van de drie talen hebben een geslacht nodig **bij het woord**, en de derde
heeft ook nog een andere woordvolgorde.

Gevolg voor het datamodel: het speelse woord draagt per taal een geslacht, en
het land draagt per taal één of twee bijvoeglijke vormen. De samenvoeging is
per taal een klein functietje, geen sjabloon met `${adjectief} ${woord}`.

## Voorstel: begin met zestig landen, niet met 230

Besluit 41 schat "weken werk" en rekent daarbij met 230 landen × 3 talen. Dat
klopt voor de volledige lijst, maar **een potje heeft acht identiteiten nodig,
geen 230**. Zestig bekende landen (de `easy` + `medium` schijf in
`shared/content/countries.data.mjs`, samen 96) geven exact hetzelfde gevoel,
zijn herkenbaarder voor spelers, en zijn in dagen te maken in plaats van weken.

De lijst kan daarna per taal groeien zonder dat er code verandert — mits je de
terugval goed bouwt (zie hieronder). **Dit is een productkeuze; de bouwer
beslist hem niet zelf.**

| Omvang | Strings | Inschatting |
| --- | --- | --- |
| 60 landen | ~240 | 2–3 dagen content |
| 96 landen (easy + medium) | ~380 | 4–5 dagen content |
| 230 landen | ~920 | weken, zoals besluit 41 zegt |

## De structuur gaat over de lijn, niet de tekst

Dit is het harde deel van besluit 41 en het is ook de reden dat punt 8 (naam in
je eigen taal) hiermee opgelost raakt. Vandaag maakt de server de naam in de
taal van de **room**; een Spanjaard in een Nederlandse room ziet daardoor een
Nederlandse naam.

Dus: de server kiest **welk land en welk woord**, en stuurt dat paar mee. Elke
client rendert het in zijn eigen app-taal.

```
identity: { country: 'bg', word: 'cow' }   →  nl: "Bulgaarse Koe"
                                              en: "Bulgarian Cow"
                                              es: "vaca búlgara"
```

Drie gevolgen die je niet mag missen:

1. **Uniek zijn gaat over het paar, niet over de tekst.** `makeUniqueInRoom`
   werkt op strings en plakt er een cijfer achter. Bij een gerenderde naam
   levert dat per client een ander resultaat op. De uniciteitscheck moet dus op
   `country+word` gebeuren, vóór het renderen.
2. **`effectiveName` blijft bestaan** voor spelers die zélf een naam typen.
   De identiteit vervangt alleen de gegenereerde naam. Overal waar een speler
   over de lijn gaat (lobby, tussenstand, reveal, podium, snapshot) moet het
   paar meereizen naast `effectiveName`.
3. **De vlag hoort erbij.** De client heeft de vlagrenderer al; het land is een
   iso2 die daar zo in past.

## Terugval — het geval dat de lijst kan laten groeien

Besluit 41 laat expliciet aan de bouwer over wat er gebeurt bij een land
waarvoor een taal nog geen bijvoeglijke vorm heeft. **Voorstel regie, en het
staat er niet voor niets:** val per ontbrekend geval terug op de "uit"-vorm
(*Koe uit Bulgarije*), nooit op een lege naam.

Dat is niet alleen netjes, het is wat de gefaseerde aanpak hierboven mogelijk
maakt: met een werkende terugval mag de woordenlijst onvolledig zijn, en kan
een taal per week groeien zonder release-risico. Zonder terugval moet alles in
één keer af.

## Volgorde van bouwen

| Stap | Wat | Duur |
| --- | --- | --- |
| 1 | `nameWordLists` daadwerkelijk meegeven in `server/index.mjs`; twintig woorden per taal. Levert meteen echte namen op | uur |
| 2 | Woordlijstformaat met geslacht per taal + de drie rendermodules (`nl`/`en`/`es`), met tests op de lastige gevallen: het-woord, Spaans vrouwelijk, ontbrekende vorm → "uit"-vorm | 1 dag |
| 3 | Landbijvoeglijke naamwoorden voor de gekozen schijf. Redactiewerk, geen programmeerwerk — apart houden van stap 2 | 2–5 dagen |
| 4 | Identiteit als paar over de lijn: datamodel, protocol, uniciteit op het paar, alle plekken waar een speler verstuurd wordt | 1,5 dag |
| 5 | Client rendert in de eigen app-taal, met vlag; lobby, tussenstand, reveal, podium | 1 dag |
| 6 | Migratie: rooms die al in Redis leven hebben geen identiteit. Een speler zonder paar houdt zijn `effectiveName` | halve dag |

Stap 1 kan vandaag, los van de rest. Stap 3 loopt parallel aan 4 en 5 zolang
de terugval uit stap 2 werkt.

## Wat dit meteen oplost

- **Punt 12** — automatisch gegenereerde spelersidentiteit.
- **Punt 8** — je ziet namen in je eigen taal, niet in die van de host.
- **"Wie had het goed" rijker tonen** (genoteerd 5 aug) hangt hieraan: zonder
  identiteit valt er in de reveal weinig te tonen.

## Wat dit niet is

Geen avatarsysteem, geen profielen, geen accounts. De identiteit leeft in de
room en verdwijnt ermee. Wie zelf een naam typt, houdt die.
