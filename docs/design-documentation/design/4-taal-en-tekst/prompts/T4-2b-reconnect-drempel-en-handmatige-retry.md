# Prompt — T4-2b: Reconnect-drempel + handmatige retry

**Status: open, welbewust niet uitgevoerd.** Afgesplitst van de
oorspronkelijke T4-2 ná reviewfeedback: [T4-2a](T4-2a-statusteksten-direct-uitvoerbaar.md)
had geen open productbesluit nodig, dit deel wel. Onderdeel van
[`../PROGRESS.md`](../PROGRESS.md), thema 4.

## Brondocument

`09-CONTENT-AND-MICROCOPY.md` §13 (reconnect, "langdurig mislukt" +
handmatige uitweg).

## Waarom dit niet gewoon is uitgevoerd

De reviewfeedback wees terecht op een tegenstelling in de oorspronkelijke
T4-2: die prompt vroeg de uitvoerder om zelf **geen** drempel vast te
stellen, maar leverde tegelijk wél een werkend `connection.reconnectFailed`
op — dat kán niet zonder een drempel te kiezen. Een tekst-alleen-oplossing
bestaat hier niet: zowel de drempel (na hoeveel pogingen / hoeveel ms) als
het gedrag van de knop zijn productbeslissingen, geen tekstkeuzes
(CLAUDE.md, `ux`-categorie vereist een human-beslissing;
`00-DESIGN-INDEX.md` §6.9 verbiedt zelf verzinnen).

## Openstaande vragen voor de Product Owner

1. **Drempel.** Na hoeveel mislukte reconnect-pogingen (of hoeveel ms
   backoff, zie `reconnect-state.backoffDelayMs`) verschijnt
   `connection.reconnectFailed` in plaats van het gewone
   `connection.reconnecting`? Voorstel uit de oorspronkelijke prompt (na de
   3e poging, rond 15s) staat nog steeds open ter beoordeling.
2. **Knopgedrag.** De transportlaag doet de backoff al automatisch
   (`transport-contract-response.md`, correctie 2). Wat doet een
   handmatige "Opnieuw proberen"-knop dan concreet die de automatische
   retry niet al doet — een geforceerde herverbinding nu meteen (skip de
   resterende backoff), of alleen zichtbaar geruststellen dat er íets
   gebeurt? En doet "Terug naar start" een lokale route-wissel of ook een
   servermelding (verlaat de room)?

## Wat te bouwen zodra de PO beslist heeft

- Nieuwe sleutel `connection.reconnectFailed` ("Herstellen lukt nog niet.")
  in nl/en/es, getoond i.p.v. `connection.reconnecting` zodra de gekozen
  drempel is gepasseerd.
- De twee knoppen ("Opnieuw proberen"/"Terug naar start") met het
  vastgestelde gedrag; tekst is triviaal en kan direct mee, gedrag pas ná
  besluit.
- `PROGRESS.md`-rij voor de handmatige uitweg blijft op niveau 0 tot dan.

## Definition of done

- Niet van toepassing zolang er geen PO-besluit is — deze prompt levert
  bewust geen code.
