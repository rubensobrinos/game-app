# GAME-RULES.md — Hoe werkt het spel?

Dit document beschrijft de spelinhoud, los van deployment en transport. De server is
autoritair over vraagselectie, correcte antwoorden, deadlines, scores en faseovergangen.

## Rondestructuur

| Fase | Standaard | Instelbaar |
| --- | ---: | --- |
| Startcountdown | 3 s | nee |
| Vraag actief | 15 s | 10–30 s |
| Ronde-uitslag | 5 s | 3–8 s |
| Tussenstand | 4 s | elke ronde / periodiek / uit |
| Eindstand | totdat host afsluit | — |

Bij auto-tempo plant de server alle overgangen. Bij host-tempo wacht de game na de
uitslag of tussenstand op `Volgende`.

Antwoorden zijn definitief zodra de server ze accepteert:

- één antwoord per speler per ronde;
- wijzigen is niet toegestaan;
- servertijd is leidend;
- clienttijd wordt alleen voor diagnostiek meegestuurd;
- het correcte antwoord wordt nooit vóór `round:ended` naar de client gestuurd.

## Puntentelling

### Individueel

- goed antwoord: **100 basispunten**;
- snelheidsbonus: **0–100 punten**;
- fout of niet geantwoord: **0 punten**;
- maximaal: **200 punten per ronde**.

Formule:

```text
bonus = round(100 × clamp((endsAt - receivedAt) / questionDuration, 0, 1))
punten = correct ? 100 + bonus : 0
```

Wanneer snelheidspunten uitstaan: goed = 100, fout/geen antwoord = 0.

De server mag een kleine deadline-grace toepassen voor transportvertraging, maar:

- maximaal 250 ms;
- gelijk voor alle spelers;
- niet meetellen als extra snelheidsbonus;
- expliciet configureerbaar en getest.

### Gelijke eindscore

Volgorde:

1. hoogste totaalscore;
2. meeste correcte antwoorden;
3. laagste totale responstijd over correcte antwoorden;
4. gedeelde positie.

Daarom bewaart de speler `correctResponseTimeMsTotal`, niet alleen het tijdstip van het
laatste juiste antwoord.

## Vraagselectie

- room pint één `contentVersion` voor de volledige match;
- alle spelers krijgen exact dezelfde vraag en optievolgorde;
- geen dubbele vraag binnen één match;
- rematch vermijdt de vragen uit de direct vorige match totdat de pool onvoldoende groot
  is;
- mixgames verdelen rondes zo gelijkmatig mogelijk over de gekozen spelvormen;
- vraagselectie en correcte antwoorden vinden server-side plaats;
- client en server gebruiken dezelfde gedeelde contentmodule en rendererversie.

## Spelvormen

### 1. Vlaggen Quiz

**Standaard:** vlag → kies land uit vier opties.

Optionele variant: landnaam → kies vlag uit vier opties.

Afleiders komen uit dezelfde moeilijkheidspool en waar mogelijk uit hetzelfde continent,
zodat de vraag niet kunstmatig eenvoudig wordt.

### 2. Hoofdsteden Quiz

Landnaam en vlag → kies hoofdstad uit vier opties.

Alleen landen met een geldige hoofdstad in de gekozen contentversie worden gebruikt.

### 3. Echt of Nep? — vlaggen

Per match ongeveer 50/50:

- echte vlag;
- algoritmisch gegenereerde vlag.

Een gegenereerde ronde bevat:

- seed;
- genormaliseerde renderparameters;
- `rendererVersion`.

Alle clients renderen dezelfde specificatie. Indien de bestaande canvasrenderer niet
deterministisch genoeg blijkt tussen browsers, wordt voor die spelvorm een canonieke
SVG/afbeelding gebruikt.

Antwoorden: `Echte vlag` of `Nepvlag`. De uitslag toont bij een echte vlag het land.

### 4. Hoger of Lager

Twee landen worden vergeleken op één metriek:

- inwoners;
- oppervlakte;
- BBP.

De host kiest vooraf de metriek of gebruikt een mix. Paren met gelijke of ontbrekende
waarden worden niet geselecteerd. De uitslag toont beide waarden.

### 5. Buitenbeentje

Vier vlaggen:

- drie landen uit hetzelfde continent;
- één uit een ander continent.

De speler kiest de afwijkende vlag. De uitslag benoemt beide continenten.

### 6. Typen-invoer — golf 2

Voor vlaggen en hoofdsteden:

- invoer maximaal 60 tekens;
- Unicode-normalisatie;
- accent- en leestekennormalisatie;
- bestaande aliassen per taal;
- Levenshtein-tolerantie alleen volgens expliciete bestaande regels;
- beoordeling uitsluitend server-side.

De uitslag toont het eigen antwoord en het geaccepteerde antwoord.

### 7. Logo Quiz, Voetballogo's en Logo: Echt of Nep? — feature flag

Mechanisch volgen deze dezelfde contracten als vlaggen of echt/nep. Ze staan achter een
server-side feature flag en worden pas publiek aangezet na expliciete juridische en
productmatige vrijgave.

`Privéroom` is daarbij een distributie-instelling, geen juridische garantie.

## Late join

Een late joiner:

- krijgt geen punten voor gemiste rondes;
- telt pas mee in `playerCount` voor antwoordvoortgang vanaf de eerstvolgende volledig
  nieuwe ronde;
- kan wel de huidige uitslag en tussenstand bekijken;
- wordt in de eindstand desgewenst gemarkeerd met `vanaf ronde {n}`.

## Speler verlaat of disconnect

- tijdelijk disconnected blijft maximaal gedurende de room-TTL herstelbaar;
- disconnected spelers tellen na een korte graceperiode niet mee in de noemer van
  antwoordvoortgang;
- reeds behaalde punten blijven staan;
- vrijwillig vertrokken spelers tellen niet mee in volgende rondes.

## Teams — fase 1.5

Iedere speler antwoordt individueel. Om teamgrootte en late joins eerlijk te behandelen:

1. bereken per ronde het gemiddelde van de punten van de in die ronde speelgerechtigde
   teamleden;
2. rond dat gemiddelde af;
3. tel de rondegemiddelden op tot de teamscore.

Hierdoor kan een groot team niet winnen door alleen meer deelnemers te hebben en trekt
een late joiner niet met terugwerkende kracht eerdere teamrondes omlaag.

Eindstand:

- winnend team;
- beste individuele speler per team;
- gelijkspel is toegestaan.

## Verdiepende content — optioneel

Na een vlaggenronde kan het bestaande vlagverhaal via `ⓘ` worden geopend. Dit is extra
content en:

- onderbreekt auto-tempo niet;
- verandert geen punten;
- is niet nodig om de game te begrijpen;
- wordt niet als primaire positionering gebruikt.

Contourhints staan uit bij multiplayer-meerkeuze. Bij typen-invoer kunnen ze later als
roomoptie worden toegevoegd; gebruik van de hint halveert dan de punten voor die ronde.

## Reactiezinnen en streaks

- draaien per speler;
- mogen client-side worden bepaald uit serverresultaten;
- staan standaard aan;
- zijn per speler uitzetbaar;
- hebben geen invloed op de server-score;
- mogen nooit vóór `round:ended` verraden of het antwoord goed was.

## Groepsvlag of badge

Een gegenereerde groepsvlag/badge heeft geen invloed op vraagselectie, score of
gamefases. Het is uitsluitend presentatie en blijft buiten de spelregels van de MVP.
