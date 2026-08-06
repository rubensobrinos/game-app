# Plan — de drie bouwklussen die nog openstaan

Peildatum 6 aug 2026. Naast de refactors (`refactor/`) en de punten uit de
marktvergelijking (`uit-de-marktvergelijking.md`) staan er nog drie echte
bouwklussen open. Dit is de volgorde die ik zou aanhouden en waarom.

| # | Wat | Maat | Wanneer |
| --- | --- | --- | --- |
| 1 | Spelersidentiteit stap 4–6 | M | nu |
| 2 | Donut-gamekeuze | M | als er ruimte is |
| 3 | Typed answers | XL | **pas ná de pilot** |

Maten: XS is een handeling van een paar regels, S past in één commit, M is een
paar bestanden met tests, L raakt meerdere lagen, XL vraagt eigen besluiten
onderweg. Bewust geen uren of dagen — die zijn voor een agent niet te
voorspellen en gaan altijd mis.

---

## 1. Spelersidentiteit stap 4–6 — eerst, want hij deblokkeert vier dingen

Stap 1 t/m 3 zijn af: de woordenlijsten worden echt meegegeven (je heet nu
*Dappere Otter* in plaats van *Speler 1*), de drie rendermodules bestaan met
hun taalregels, en er liggen zestig landen met hun bijvoeglijke vormen klaar.

Wat ontbreekt is de koppeling. Het land gaat nog niet over de lijn, dus je ziet
*Dappere Otter* en niet *Bulgaarse Koe*.

**De stappen**

| Stap | Wat | Maat |
| --- | --- | --- |
| 4 | Identiteit als paar (land + woord) in het datamodel en over het protocol; uniciteit op het paar in plaats van op de gerenderde tekst | M |
| 5 | Client rendert in de eigen app-taal, met vlag — lobby, tussenstand, reveal, podium | S |
| 6 | Migratie: rooms die al in Redis leven hebben geen paar; die houden hun `effectiveName` | S |

**Waarom eerst.** Er wachten vier dingen op deze klus:

- **Punt 8** — namen in je eigen taal. Vandaag maakt de server de naam in de
  taal van de room, dus een Spanjaard ziet een Nederlandse naam.
- **"Wie had het goed" rijker tonen** — zonder identiteit valt er niets te
  tonen behalve een aantal.
- **Rivalen in de reactiezinnen** (*"Jij haalde Sanne in"*) — die zin heeft een
  naam nodig die iets betekent.
- **De lege onderhelft van het uitslagscherm** — besluit 50 heeft die ruimte
  vrijgespeeld; identiteit is wat er in hoort.

Dat is vier keer waarde uit één klus van maat M. Geen van de andere twee
komt daar in de buurt.

**De valkuil.** Uniciteit gaat over het páár, niet over de tekst.
`makeUniqueInRoom` plakt vandaag een cijfer achter een string; bij een naam die
per client anders gerenderd wordt, levert dat per telefoon een ander resultaat
op. De controle moet dus vóór het renderen, op `land + woord`.

---

## 2. Donut-gamekeuze — als er ruimte is

De mechaniek bestaat al: een carrousel met pijlen en vegen, gekoppeld aan
`game:update-config`. Wat ontbreekt is het beeld — de ring die draait, met de
games op de rand.

**Waarom niet eerder.** Het is puur uiterlijk. Het maakt de lobby mooier, maar
het verandert niets aan of mensen willen blijven spelen, en het deblokkeert
niets anders.

**Waarom niet later.** Het is klein, en het is het eerste wat een host ziet
als hij een game kiest. Zodra er ruimte is, is dit een goedkope indruk.

**Nog te beslissen bij de bouw:** het merkteken heeft vier segmenten, maar met
hoofdsteden en hoger/lager erbij zijn het zes games. Zes posities op de ring,
of vier segmenten waar zes games langs schuiven? Dat is een ontwerpkeuze en
hoort vóór de bouw beslist te zijn.

---

## 3. Typed answers — pas ná de pilot, en dat is een advies met een reden

De spec is compleet, het scorebesluit is genomen (besluit 46: intypen levert
150 punten in plaats van 100), en `Mix` en `Typen` staan al zichtbaar-maar-uit
in de lobby. Het kán dus meteen.

**Toch niet nu.** Dit is XL — meer dan de andere twee samen —
en niemand heeft ooit gevraagd om te typen. De aanname is dat intypen leuker of
uitdagender is dan kiezen. Dat kan kloppen, maar het is een aanname.

Eén avond met echte mensen beantwoordt hem gratis:

- Vinden mensen vier opties te makkelijk?
- Wordt er geroepen "dat wist ik ook zonder de antwoorden"?
- Of gaat het gesprek juist over iets heel anders — tempo, moeilijkheid,
  welke game ze nog eens willen?

**Als de pilot zegt dat het moet**, ligt alles klaar: de spec, het besluit, en
de plek in de lobby. Je bouwt dan aan iets waarvan je wéét dat
het gewild is.

**Als de pilot iets anders zegt**, heb je de grootste klus op de lijst uitgespaard.

---

## De onderliggende regel

Van deze drie is er één die vier andere dingen deblokkeert, één die klein is en
niets blokkeert, en één die groot is en op een onbewezen aanname rust. Dat is de hele volgorde.

En het geldt breder: er wordt nu al een tijd doorgebouwd zonder dat er één keer
met echte mensen gespeeld is. Elke schatting hierboven — inclusief de mijne —
is een gok zolang dat zo blijft. Het draaiboek staat klaar in
`../pilot-b-draaiboek.md`.
