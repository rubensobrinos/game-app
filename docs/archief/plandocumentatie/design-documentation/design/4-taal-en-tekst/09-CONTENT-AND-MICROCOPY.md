# 09 — Content en Microcopy

## 1. Merkstem

Play Aseso klinkt:

- direct;
- menselijk;
- speels zonder kinderachtig te zijn;
- competitief zonder agressief te worden;
- internationaal en nieuwsgierig;
- kort genoeg voor een rumoerige omgeving.

Niet:

- technisch;
- schools;
- corporate;
- overdreven jolig;
- moraliserend bij fouten;
- vol Engelse systeemtermen in Nederlandse UI.

## 2. Taalprincipes

1. Benoem de huidige situatie vóór technische oorzaak.
2. Geef één duidelijke vervolgstap.
3. Gebruik actieve werkwoorden.
4. Houd knoppen kort en specifiek.
5. Vermijd “OK” wanneer een concrete actie mogelijk is.
6. Gebruik `potje` in consumententaal; `room` alleen waar functioneel nodig.
7. Spreek speler aan met `je`.
8. Gebruik cijfers waar snelheid belangrijk is: `Nog 4 spelers`.
9. Humor komt uit de groep/statistiek, niet uit willekeurige grappen.
10. Fouten beschuldigen de gebruiker niet.

## 3. Terminologie

| Concept | Voorkeur NL | Vermijden |
|---|---|---|
| game session | potje / game | sessie geïnitialiseerd |
| host | host | beheerder van de sessie |
| join | meedoen | submitten / registreren |
| room code | gamecode / code | PIN-token |
| answer submitted | antwoord ontvangen / verstuurd | response submitted |
| leaderboard | tussenstand | ranking dashboard |
| rematch | revanche | restart session |
| pause | gepauzeerd | suspended |

## 4. Start en join

### Aanbevolen

- `Start direct een game`
- `of doe mee`
- `Voer de gamecode in`
- `Meedoen`
- `Spel aanpassen`
- `Geen account. Geen download. Iedereen speelt op zijn eigen telefoon.`

### Loading

- `Potje maken…`
- `Gamecode controleren…`
- `Je wordt toegevoegd…`

### Errors

- `Deze code kennen we niet. Controleer de zes cijfers.`
- `Dit potje is al afgelopen.`
- `De room is vergrendeld door de host.`
- `Dit potje zit vol.`
- `De verbinding werkt even niet. Probeer het opnieuw.`

## 5. Naam kiezen

- `Je doet mee aan game 482 917`
- `Hoe noemen we je?`
- `Ik doe mee`
- `19 spelers wachten al`
- `Deze naam wordt al gebruikt. We hebben er “2” achter gezet.`
- `Kies een andere naam om mee te doen.`

Voorgestelde namen mogen werelds, kort en niet-infantiel zijn. Bijvoorbeeld combinaties van snelheid, geografie en dieren, maar voorkom alleen maar “Vlugge Vos”-achtige kinderformules.

## 6. Lobby

### Host

- `Scan om mee te doen`
- `7 spelers aanwezig`
- `Start game — 7 spelers`
- `Nog niemand binnen`
- `Laat iemand de QR scannen om te beginnen.`
- `Room vergrendeld`
- `Nieuwe spelers kunnen weer meedoen`

### Speler

- `Je bent binnen`
- `De host start zo`
- `7 spelers aanwezig`
- `Nodig iemand uit`
- `Je speelt als Ruben`

## 7. Countdown en vraag

- `Ronde 6 van 10`
- `3 van 7 geantwoord`
- `Welke vlag is dit?`
- `Echt of nep?`
- `Welk land heeft meer inwoners?`

Laatste seconden hoeven niet extra tekst te produceren als timer duidelijk is.

## 8. Antwoordfeedback

### Voor reveal

- `Antwoord versturen…`
- `Verstuurd ✓`
- `Wachten op 4 spelers…`
- `Wachten tot de ronde sluit…`

Nooit vóór reveal:

- `Goed!`
- `Helaas!`
- `Dat was fout`
- groen/rood resultaatlabel.

### Submitfout

- `Je antwoord is nog niet verstuurd.`
- `Probeer opnieuw`
- `De tijd was net voorbij. Dit antwoord telt niet mee.`

## 9. Reveal

- `JUIST`
- `ONJUIST`
- `GEEN ANTWOORD`
- `Japan`
- `+164 punten`
- `Snelheidsbonus +64`
- `Je stijgt naar #4`
- `Twee plaatsen omhoog`

Gebruik hoofdletters spaarzaam als visuele resultaatstempel, niet voor volledige alinea’s.

## 10. Sociale headlines

### Goede voorbeelden

- `Lisa was de enige met het juiste antwoord.`
- `Mohammed was het snelst: 1,8 sec.`
- `Iedereen had deze goed.`
- `Niemand koos Japan.`
- `Ruben stijgt vijf plaatsen.`
- `Emma maakt de comeback van de ronde.`
- `Vier op rij voor Lisa.`
- `De helft trapte in de nepvlag.`

### Regels

- maximaal één headline per ronde;
- feitelijk correct;
- geen belediging;
- geen gevoelige afleiding uit naam of profiel;
- vermijd herhaling binnen hetzelfde potje;
- bij weinig spelers niet doen alsof een triviale statistiek groot is.

## 11. Leaderboard en podium

- `TUSSENSTAND`
- `Jij: #12 — 610 punten`
- `Gedeelde eerste plaats`
- `EINDSTAND`
- `Lisa wint`
- `Jij eindigde #7 van 23`
- `Revanche`
- `Nieuw spel`
- `Deel uitslag`
- `Afsluiten`

## 12. Pauze en beheer

### Speler

- `Gepauzeerd door de host`
- `We gaan zo verder.`

### Host

- `GAME GEPAUZEERD`
- `Hervatten`
- `Spelers beheren`
- `Room vergrendelen`
- `Game beëindigen`
- `Weet je zeker dat je het potje wilt beëindigen?`

## 13. Reconnect

- `Verbinding herstellen…`
- `Je antwoord blijft bewaard.`
- `We zijn weer verbonden.`
- `Herstellen lukt nog niet.`
- `Opnieuw proberen`
- `Terug naar start`

Geen vage tekst als `Er is iets fout gegaan` wanneer oorzaak bekend is.

## 14. Lokalisatie

- copykeys zijn semantisch, niet volledige Nederlandse zinnen als key;
- ondersteun pluralisatie (`1 speler`, `2 spelers`);
- scores en getallen volgen locale;
- roomcode wordt niet gelokaliseerd;
- UI ondersteunt langere vertalingen;
- sociale headlines worden met templates opgebouwd en grammaticaal getest.

Voorbeeldkeys:

```text
landing.startQuick
join.codeLabel
lobby.playerCount
answer.submitting
answer.confirmed
round.result.correct
leaderboard.yourRank
connection.reconnecting
```

## 15. Verboden prototypecopy

- `Game App`
- `Submit`
- `Loading…` zonder activiteit
- `Success`
- `Error 500` als hoofdtekst
- `Awaiting host action`
- `Session initialized`
- `User joined room`
- `Show code` wanneer code permanent zichtbaar hoort te zijn.
