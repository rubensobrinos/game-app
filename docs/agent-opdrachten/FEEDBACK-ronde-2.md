# Feedbackronde 2 — na de deploy van 5 aug (v1c26)

Losse feedback van de producteigenaar op de **gedeployde** stand, apart
genoteerd zodat hij niet ondergaat in de 58 van ronde 1. Nummering `R2-x`.

| # | Scherm | Feedback | Eigenaar | Status |
| --- | --- | --- | --- | --- |
| R2-1 | Home | De ⋯-knop zit in een zwarte balk die dwars door de lime gloed snijdt. Hij zou gewoon over de achtergrond moeten zweven. *"Tis strak, maar die driepuntjes zeg."* | lead | ✅ |
| R2-2 | Codebalk | *"Kijk hoe lelijk nu de codebalk is en hoe mooi die eerst was."* Deel-icoon en QR-pictogram zijn goed, maar de uitlijning en de ruimte ertussen zijn vaag, en de cijfers mogen groter. | lead | ✅ |
| R2-3 | Lobby | De zwevende startknop is goud. **Niet aankomen.** | — | 🚫 |
| R2-4 | Lobby | "Antwoord automatisch tonen" werkt nog steeds niet | — | ⏸ = punt 27, nooit gebouwd, wacht op besluit |
| R2-5 | Lobby | **"Meer instellingen" moet een kleine regel onderin zijn, geen grote knop.** | C | 🔄 |
| R2-6 | Lobby | Kleurkeuze en spelersnamen moeten nog gefixt worden (= punten 19, 20, 21) | C | 🔄 |

## R2-2 — waarom de balk uit elkaar viel

Punt 14 vroeg om code, QR, delen en opties in **één samenhangend blok**. A1
haalde de dubbele omkadering weg (de kaart ín de header was een kader in een
kader) en maakte er drie losse knoppen van naast een losse code. Technisch
netter, visueel het tegenovergestelde van wat er gevraagd was.

De kaart is terug, maar nu bínnen de 44 px chromerij in plaats van als eigen
rij: 38 px hoog, lime rand, vleugje lime vulling. De iconen erin verliezen hun
eigen rand — twee kaders in elkaar was precies de ruis die het vaag maakte. De
⋯ blijft er bewust buiten; dat is een menu, geen onderdeel van de code, net
zoals de hamburger er vroeger naast stond.

## R2-3 — de zwevende startknop blijft

Expliciet gewaardeerd door de producteigenaar. Staat al als harde regel in
`README.md §4` (sticky blijft sticky); dit bevestigt het. Wie hem uit de
scrollstroom wil halen om de overlap op te lossen, moet eerst hier langs.

## R2-1 — waarom die balk er stond

Geen slordigheid maar een botsing van twee eisen. Tijdens een potje moet de
codebalk sticky bovenin blijven staan (jouw besluit), en dan scrolt de inhoud
eronderdoor — zónder achtergrond schijnt die er zichtbaar doorheen. Dat was
bevinding A-x1 uit de verkenning, en de oplossing was een dekkende achtergrond.

Op **home** valt er niets onderdoor te scrollen: dat scherm past precies en
staat stil. Daar levert diezelfde achtergrond alleen een zwarte band op die de
gloed afsnijdt.

**Opgelost door de achtergrond te koppelen aan de aanleiding**: hij verschijnt
alleen wanneer er ook echt iets onderdoor kan scrollen — dus zodra de codebalk
er is (tijdens een sessie). Op home zweeft de ⋯ over de gloed.
