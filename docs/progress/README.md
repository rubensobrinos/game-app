# Voortgangsoverzicht — lokale pagina

Eén pagina die laat zien waar Rounda staat per ontwerpgebied, op de schaal uit
[`NIVEAUS.md`](../design-documentation/design/NIVEAUS.md).

## Openen

```bash
cd ~/game-app
python3 -m http.server 8199
```

Daarna: <http://localhost:8199/docs/progress/>

Het moet over `http://` — de pagina haalt de vijf `PROGRESS.md`-bestanden op
met `fetch`, en dat werkt niet vanaf `file://`.

## Hoe je een niveau wijzigt

**Niet in deze pagina.** Het dashboard bewaart zelf geen cijfers; het leest ze
elke keer opnieuw uit:

```
docs/design-documentation/design/<gebied>/PROGRESS.md
```

Wijzig het niveau daar, ververs de pagina, klaar. Zo is er één bron van
waarheid en kunnen het cijfer en de toelichting niet uit elkaar lopen.

## Wat de pagina leest

Elke tabel in een `PROGRESS.md` met een kolom **Niveau** waarin een cijfer 0–3
staat, wordt meegeteld en getoond. Tabellen zonder zo'n kolom (bijvoorbeeld de
telling onderaan een bestand) worden overgeslagen.

De parser is bewust tolerant: een rij die hij niet begrijpt, slaat hij over.
Ontbreekt een heel bestand, dan meldt de betreffende kaart dat in plaats van
dat de pagina leeg blijft.

Voeg je een nieuw gebied toe, dan hoort dat ook in de `AREAS`-lijst boven in
`index.html`.

## Waarom hier en niet in de repo-root

`docker-compose.yml` mount losse bestanden uit de repo-root naar nginx. `docs/`
zit daar niet bij, dus deze pagina kan niet per ongeluk publiek worden.
