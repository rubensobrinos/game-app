# Agent 1 — fase 4: "Antwoord automatisch tonen", opnieuw

De eerste poging is **teruggedraaid** (`git revert` van merge `b55a44e`). Niet
omdat er slecht werk in zat — het configveld, de protocolroute, de fixtures en
de lobbytoggle waren goed — maar omdat de kern omgekeerd was. Dit document
zegt precies wat de bedoeling is, zodat dat niet nog eens gebeurt.

Lees dit hele bestand vóór je begint. De vorige briefing was op dit punt
dubbelzinnig; dat was de fout van de lead, niet van de agent.

## Wat er de vorige keer gebeurde

Gemeten met een browser, met de toggle uit:

| | Verwacht | Wat het deed |
| --- | --- | --- |
| Het goede antwoord | verschijnt pas ná de tik van de host | stond er meteen |
| Knop "Toon antwoord" | onthult het antwoord | sprong naar de volgende vraag |

De hostactie was verplaatst naar "doorgaan vanaf de uitslag", terwijl hij
"laat het antwoord zien" moet zijn. De suite was groen; alleen een browser liet
het verschil zien.

## Wat het wél moet doen

> Staat "Antwoord automatisch tonen" uit, dan is de ronde voorbij als de tijd
> om is, maar **verlaat het goede antwoord de server nog niet**. De host tikt
> "Toon antwoord". Pas dán gaat `round:ended` de deur uit, verschijnt de
> uitslag, en loopt de rest van de ronde vanzelf door.

## De aanpak die de lead voor ogen heeft

**Sluit de ronde later af in plaats van het antwoord te verbergen.**

`endRound()` is vandaag het moment waarop het juiste antwoord de server
verlaat — dat staat er letterlijk bij (besluit 20, "nooit vóór round:ended").
Zolang je `endRound()` niet aanroept, is er niets te lekken. Verberg dus niets
in de client: **roep `endRound()` gewoon later aan.**

Concreet:

| Waar | Wat |
| --- | --- |
| `socket.mjs`, `runStartRound` | Plan `runEndRound` **niet** in als automatisch tonen uit staat. De ronde houdt zijn `endsAt` (de speler ziet zijn timer gewoon aftellen) en antwoorden sluiten vanzelf op de deadline |
| `socket.mjs`, `game:reveal` | Roept `runEndRound(roomId)` aan in plaats van een fase-overgang. Weiger het als de deadline nog niet voorbij is of als automatisch tonen aanstaat |
| `match-lifecycle.mjs` | `ROUND_RESULT` is weer een gewone getimede fase. `HOST_REVEAL` als fase-overgang vervalt — er wordt geen fase overgeslagen, er wordt een ronde later afgesloten |
| `state-machine.js` | De `HOST_REVEAL`-tak eruit; hij hoort niet in de fasetabel |
| Client | Als de timer op 0 staat en er nog geen `round:ended` is: laat zien dat er op de host gewacht wordt. De host ziet "Toon antwoord", de spelers een rustige regel |
| Mock | Zelfde gedrag, anders is het solo niet te zien |

**Wat je uit de vorige poging kunt overnemen** (staat in de git-historie,
commit `2a880c6` t/m `f29bad5`): het `autoReveal`-configveld met alle fixtures,
de protocolroute voor `game:reveal`, de lobbytoggle en de locales. Dat werk was
in orde.

## Besluit 1 blijft staan: één hostactie per ronde

Staat automatisch tonen uit, dan **is het onthullen die ene actie** en tikt de
rest van de ronde door op timers — ook bij host-tempo. De `machinePacing`-
oplossing uit de vorige poging deed precies dat en mag terugkomen.

Er komt dus géén tweede knop "Volgende" bij.

## Hoe je oplevert

**Meet het in een browser voordat je klaar zegt.** De vorige poging had 3056
groene tests en deed het verkeerde. Zet de toggle uit, speel een ronde, en laat
zien:

1. dat het antwoord er ná de tijd nog niet staat,
2. dat de host "Toon antwoord" ziet,
3. dat het antwoord verschijnt ná de tik,
4. dat de ronde daarna vanzelf doorloopt.

`node tools/meet.mjs past spel` helpt met het scherm; het spelverloop moet je
zelf naspelen.
