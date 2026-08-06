# Pilot A — draaiboek en observatieformulier

**Voor:** Ruben (host/observator) · **Bron:** DEPLOYMENT-AND-TESTING.md
§Handmatige pilots · **Groep:** neef-/studentengroep, 8–15 spelers, iedereen
uitsluitend op de eigen telefoon · **Wanneer:** zodra de keten-test over echte
sockets groen is én UI1a op twee telefoons werkt.

## Vooraf (de middag ervoor)

- [ ] `docker compose ps` — vijf services healthy; `https://play.aseso.nl`
  opent op 4G.
- [ ] Zelf één volledige match spelen met 2 telefoons (jij + huisgenoot) —
  géén pilot plannen op een flow die je niet zelf hebt doorlopen.
- [ ] macOS-updates gepauzeerd; slaapstand uit; Mac op stroom.
- [ ] Telefoonnummers/groepsapp van de groep klaar (voor de deel-link-test).
- [ ] Dit formulier geprint of op een tweede scherm.

## De avond zelf — jouw rol: trainer, niet uitlegger

Het hele punt van Pilot A: **leg níéts uit.** Zeg alleen: "we gaan een quiz
doen, scan deze QR." Elke vraag die daarna komt is een bevinding, geen
gespreksmoment. Eén uitzondering: als iemand er echt niet uitkomt, noteer wáár
en help dan pas.

1. Start een room via Snel starten, toon de QR op één telefoon (niet op een
   groot scherm — dat is bewust: de spec eist dat het zonder centraal scherm
   werkt).
2. Laat de QR doorgeven van telefoon naar telefoon; stuur hem NIET in de
   groepsapp — observeer eerst of spelers zelf de deel-actie vinden.
3. Speel minimaal twee matches (de tweede via de rematch-knop).
4. Doe halverwege match 2 alsof je een "netwerkprobleem" hebt: laat één
   speler z'n telefoon vergrendelen en weer openen (reconnect-test in het
   echt).

## Observatieformulier

Per onderdeel: turven + één zin. Niet meer — je bent host, geen notulist.

| # | Observatie | Meting |
| --- | --- | --- |
| 1 | Scan → in de lobby, per speler | < 10 s? aantal geslukt/mislukt: ___ |
| 2 | Hoeveel spelers slaan de naam over (gegenereerde naam houden) | ___ van ___ |
| 3 | Waar twijfelt iemand zichtbaar (welk scherm, welke knop) | ___ |
| 4 | Leesbaarheid vraag + timer op de kleinste telefoon in de groep | ja / nee: ___ |
| 5 | Geeft iemand spontaan de QR/link dóór zonder dat jij het vraagt | ja / nee |
| 6 | Reconnect-moment (vergrendelde telefoon): terug in de match mét score? | ja / nee |
| 7 | Wordt er hardop gereageerd op de ronde-uitslag (plezier/discussie) | turven: ___ |
| 8 | Vraagt iemand om revanche vóórdat jij rematch noemt | ja / nee |
| 9 | Start iemand vanuit het podium zélf een nieuwe room als host | ja / nee |
| 10 | Grootste ergernis van de avond (één ding) | ___ |

## Direct na afloop (10 minuten, niet later)

- [ ] Formulier invoeren als `docs/pilot-a-resultaat-<datum>.md`.
- [ ] De drie pijnlijkste observaties als HANDOFF-items naar de juiste agent.
- [ ] Jouw eigen onderbuik in één zin: zou déze groep het uit zichzelf nog
  eens spelen?

## Slagingscriteria (uit de spec, niet onderhandelbaar)

Scan→lobby onder de 10 seconden voor vrijwel iedereen; niemand heeft een
account of uitleg nodig; minstens één spontane rematch of doorgestuurde link.
Haal je die drie, dan is Pilot B (werkborrel, met één totaal onvoorbereide
gebruiker die zelf een room moet hosten) de volgende stap.
