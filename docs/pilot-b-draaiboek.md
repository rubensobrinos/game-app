# Pilot B — één echte groepsavond, met meetlat

**Voor:** Ruben (host/observator). **Waarom nu:** PLAN-CONVERGENTIE stap 7 —
we hebben genoeg losse schermen beoordeeld; wat ontbreekt is één potje met
echte mensen dat de hele keten aanraakt. **Groep:** 6–10 spelers, iedereen op
de eigen telefoon. **Duur:** reken op 45 minuten inclusief napraten.

Pilot A (`pilot-a-draaiboek.md`) ging over *begrijpt een vreemde het zonder
uitleg*. Pilot B gaat over *houdt de keten stand als er van alles gebeurt* —
en levert getallen op waar we een besluit op kunnen baseren.

---

## 0. Vooraf (de middag ervoor)

- [ ] Laatste stand gedeployed en gecommit — **nooit mid-sprint deployen**, de
      build kopieert de werkboom.
- [ ] `docker compose ps` → alle services healthy; `https://rounda.io` opent
      op 4G (niet alleen op wifi).
- [ ] Zelf één volledige match spelen met twee telefoons. Een pilot op een
      flow die je zelf niet hebt doorlopen is een demo van je eigen bugs.
- [ ] Mac op stroom, slaapstand uit, updates gepauzeerd.
- [ ] Serverlog meelezen klaarzetten:
      `docker compose logs -f game-server | tee ~/pilot-b-$(date +%F).log`
- [ ] Dit formulier op een tweede scherm of geprint.

## 1. Het scenario — elk onderdeel raakt iets dat kan breken

Speel **twee matches**: de eerste met Raad de vlag, de tweede met Echt of nep
(de host draait de carrousel in de lobby). Tien vragen per match.

| # | Doe dit | Wat het toetst |
| --- | --- | --- |
| 1 | Drie spelers joinen via **QR**, drie via een **doorgestuurde link**, de rest via de **code** | alle drie de joinwegen, en of mensen de code zonder hulp vinden |
| 2 | Eén speler joint **pas ná ronde 1** | late join: telt pas mee vanaf de volgende ronde, geen punten voor gemiste rondes |
| 3 | Twee spelers wijzigen hun **naam**, twee hun **kleur** | `player:rename` (maximaal één keer!) en `player:recolor` |
| 4 | Eén speler zet halverwege ronde 3 z'n telefoon **in vliegtuigstand** en weer terug | reconnect: terug in de match, mét score en de juiste ronde |
| 5 | Eén speler opent de game in een **tweede tab** | twee verbindingen op één sessie |
| 6 | Zorg voor een **gelijke eindstand** (laat twee spelers de laatste ronde dezelfde antwoorden geven, of laat er twee bewust niets doen) | ties: 1-2-2-4 op élk scherm, ook op het podium |
| 7 | Speel de match uit tot het **podium** en druk op **revanche** | rematch: zelfde room, geen herhaalde vragen |
| 8 | Eén speler **sluit de app** en komt niet terug | de match loopt gewoon door |
| 9 | Tweede match: host draait de carrousel naar **Echt of nep** | game 2 end-to-end met echte mensen |

**Jouw rol:** host én observator. Leg niets uit tenzij iemand vastloopt — noteer
dan wáár. Je bent geen notulist: één zin per bevinding is genoeg.

## 2. De meetlat

Vul in tijdens of direct na afloop. De eerste vier zijn getallen, de rest is
observatie.

| # | Meting | Hoe je het meet | Uitkomst |
| --- | --- | --- | --- |
| 1 | **Tijd tot de eerste vraag** — van "scan deze QR" tot ronde 1 op de schermen | stopwatch, één keer | ___ s |
| 2 | **Mislukte joins** | tellen: iedere keer dat iemand het opnieuw moest proberen | ___ van ___ pogingen |
| 3 | **Antwoordlatency** — tik tot bevestiging ("je antwoord staat") | gevoel volstaat: direct / merkbaar / hinderlijk | ___ |
| 4 | **Reconnectduur** — vliegtuigstand uit tot weer in de match | stopwatch | ___ s |
| 5 | **Waar was uitleg nodig** | elk moment dat je iets moest zeggen | ___ |
| 6 | **Raakt de host de instellingen aan?** | jijzelf: heb je iets veranderd behalve de game? | ja / nee: ___ |
| 7 | **Weet iedereen wanneer zijn antwoord vaststaat?** | vraag het na afloop expliciet aan drie mensen | ___ |
| 8 | **Ties**: klopte het nummer op alle schermen? | vergelijk twee telefoons + het podium | ja / nee |
| 9 | **Grootste ergernis van de avond** (één ding) | ___ | |
| 10 | **Vroeg iemand spontaan om nog een potje?** | ja / nee | |

### Uit het serverlog achteraf

De log draagt sinds INT4a een veilige traceercontext (geen namen, geen tokens).
Deze vier zijn nu al af te lezen; de rest komt met de metricset uit stap 9:

```bash
grep -c 'clientevent geweigerd'      ~/pilot-b-*.log   # afgewezen acties
grep -c 'phase_race_lost'            ~/pilot-b-*.log   # verloren fase-races
grep -c 'server_error'               ~/pilot-b-*.log   # onze eigen fouten
grep -o 'code":"[A-Z_]*'             ~/pilot-b-*.log | sort | uniq -c
```

Eén `server_error` in een avond van tien mensen is geen ruis: zoek 'm op.

## 3. Wat een geslaagde pilot is

Niet "niemand klaagde", maar:

- [ ] beide matches volledig uitgespeeld, tot en met podium en revanche;
- [ ] iedereen die wilde meedoen, deed mee (mislukte joins = 0 of verklaard);
- [ ] de reconnect kwam terug in de juiste ronde mét score;
- [ ] de gelijke eindstand toonde overal hetzelfde nummer;
- [ ] geen `server_error` in het log;
- [ ] jij hoefde hooguit één keer iets uit te leggen.

Haalt de avond dat niet, dan is de uitkomst **niet** "het was best leuk" maar
een lijst met exact wat er misging — dat is de opbrengst.

## 4. Wat we bewust nog niet meten

- **Herstel na een serverrestart** bestaat nog niet (ARCHITECTURE §10, besluit
  C-3). Herstart de server dus niet tijdens de pilot; gebeurt het per ongeluk,
  dan is de match verloren en start je een nieuwe room. Dat is precies het
  risico waar C-3 over gaat — noteer of het gebeurde.
- **Typed answers** en games 3–4 bestaan niet; niet aankondigen.
- **Meer dan ~15 spelers**: het protocol kan 100, maar dat is nooit met echte
  mensen getest. Houd deze pilot klein.

---

_Na afloop: uitkomsten in `docs/STATUS.md` onder een kopje "Pilot B", en per
bevinding een los ticket. Niet in dit bestand — dat is een draaiboek, geen
logboek._
