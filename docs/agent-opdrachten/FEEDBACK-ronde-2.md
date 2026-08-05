# Feedbackronde 2 — na de deploy van 5 aug (v1c26)

Losse feedback van de producteigenaar op de **gedeployde** stand, apart
genoteerd zodat hij niet ondergaat in de 58 van ronde 1. Nummering `R2-x`.

| # | Scherm | Feedback | Eigenaar | Status |
| --- | --- | --- | --- | --- |
| R2-1 | Home | De ⋯-knop zit in een zwarte balk die dwars door de lime gloed snijdt. Hij zou gewoon over de achtergrond moeten zweven. *"Tis strak, maar die driepuntjes zeg."* | lead | ✅ |

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
