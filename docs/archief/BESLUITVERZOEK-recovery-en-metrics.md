# Besluitverzoek — herstelpad (C-3) en de eerste metricset

**Voor:** de producteigenaar. **Van:** regie, 5 aug 2026. **Aanleiding:**
PLAN-CONVERGENTIE stap 8 en 9. Beide punten zijn technisch voorbereid; ze
liggen stil op een beslissing die niet van mij is.

---

# Deel 1 — C-3: herstel na een serverherstart

## Wat er nu gebeurt

Redis (AOF, `appendfsync everysec`) houdt room, match, ronde en antwoorden
vast. Dat is bewezen: er staat een test die na een gesimuleerde herstart de
room terugvindt in fase `SCOREBOARD` met de scores intact.

Wat er níét gebeurt, staat in diezelfde test letterlijk als bevinding:

> *herstart: room komt terug in fase SCOREBOARD met de scores intact, maar
> zonder PAUSED(server_recovery) + RECOVERY_RESUME — dat pad ontbreekt in de
> compositielaag.*

Concreet: de state overleeft, maar de **timers en de socket-runtime** zijn weg.
Niemand zet de avond weer in beweging. In de praktijk betekent dat: de spelers
kijken naar een scherm dat niet meer verandert, en de host moet een nieuwe room
starten — met verlies van de stand.

De state machine kent `RECOVERY_RESUME` al (enige toegestane bestemming:
`COUNTDOWN`). Het pad eromheen bestaat niet.

## De keuze

| | **A. Accepteren** | **B. Bouwen** |
| --- | --- | --- |
| Wat je afspreekt | "Bij een serverherstart start de host een nieuwe room" | De server pakt de match zelf weer op |
| Kosten nu | niets | ± een dag werk in `server/composition/` + `server/transport/`, plus tests |
| Risico bij pilots | een herstart middenin een avond kost die avond | een herstelpad dat zelf fouten kan hebben (dubbele timers) |
| Wanneer verstandig | zolang jij de enige host bent en de server op je eigen Mac draait | zodra iemand anders een avond host, of zodra je 'm zonder begeleiding weggeeft |

**Mijn advies: A voor de eerstvolgende pilot, B vóór je het weggeeft.** Een
deploy is de meest waarschijnlijke oorzaak van een herstart, en die plan je
zelf — tijdens een pilot deploy je niet. Maar zodra jij niet in de kamer staat,
is "start maar een nieuwe room" geen antwoord meer.

## Als het B wordt — dit bouwen we, in deze volgorde

1. **Bij startup actieve rooms vinden** via de bestaande room-index.
2. Elke actieve match naar **`PAUSED(server_recovery)`** — één atomische
   fase+pausedState-schrijfactie, hetzelfde pad als een gewone pauze.
3. **Nooit automatisch een verlopen antwoordvenster hervatten.** Stond de ronde
   op `ROUND_ACTIVE` en is `endsAt` al voorbij, dan wordt die ronde afgesloten
   zoals hij lag — niet stiekem verlengd.
4. De host krijgt na reconnect een **expliciete herstelactie** ("hervat de
   game"), geen automatische start: de groep zit op dat moment niet klaar.
5. **Hervatten via een nieuwe countdown** (`RECOVERY_RESUME` → `COUNTDOWN`) —
   die bestemming staat al vast in de state machine, en de aftelregel uit §A2
   geeft daar al de echte 3-2-1.
6. **Oude timers kunnen nooit dubbel afgaan**: de runtime is na een herstart per
   definitie leeg, en elke geplande overgang loopt langs de compare-and-set van
   de state machine — een dubbele wint nooit twee keer. Dit is getest gedrag,
   geen aanname, maar hoort expliciet in de recovery-test.
7. **Recovery en uitkomst in de logs**, met dezelfde veilige velden als de rest
   (geen namen, geen tokens).

---

# Deel 2 — de eerste metricset (stap 9)

## Waarom dit nog niet gebouwd is

Twee redenen, allebei uit jullie eigen materiaal:

1. `INT4b-metrics.md` opent met: *"⛔ Niet uitvoeren zonder expliciet akkoord op
   de afscherming van `/metrics`."* Dat endpoint openzetten of afschermen raakt
   secrets en deployment; daar mag ik geen eigen securitymodel voor kiezen.
2. Diezelfde prompt waarschuwt: *"Tellers zonder dashboard, alert of vaste
   kijker zijn decoratie."* De pilot (stap 7) heeft nog niet plaatsgevonden.
   Metrics kiezen vóór de pilot betekent gokken welke vraag we straks hebben.

## Wat er nu al meetbaar is, zonder één regel nieuwe code

De veilige traceercontext uit INT4a logt genoeg voor een eerste avond. In
`pilot-b-draaiboek.md` §2 staan vier `grep`-regels die na afloop opleveren:
afgewezen acties, verloren fase-races, eigen serverfouten, en de verdeling van
foutcodes. Voor één avond met tien mensen is dat voldoende.

## Wat ik voorstel voor ná de pilot

Een **kleine** set die precies de vragen beantwoordt die de pilot oproept — en
niet meer dan dat:

| Metric | Beantwoordt |
| --- | --- |
| `rounda_socket_connections_total`, `rounda_socket_disconnects_total{reason}` | vielen er mensen uit, en waarom |
| `rounda_active_sockets`, `rounda_active_rooms` | hoeveel er tegelijk in zaten |
| `rounda_answers_total{outcome}` | hoeveel antwoorden geweigerd werden |
| `rounda_event_errors_total{event, code}` | welke actie problemen geeft |
| `rounda_event_duration_seconds_bucket{event}` | of antwoorden traag werden |
| `rounda_joins_total{method}` | of QR, link of code de moeite waard is |
| `rounda_recovery_attempts_total{outcome}` | alleen zinvol als C-3 = B |

Cumulatieve tellers, geen per-seconde-gauges; histogram met vaste buckets, geen
zelf berekende percentielen; **nooit** `roomId`, `sessionId`, `playerId`,
`gameCode` of een naam als label. Dat staat allemaal al uitgeschreven in
`INT4b-metrics.md` — er hoeft niets aan het ontwerp bedacht te worden.

## De vraag aan jou

| # | Vraag |
| --- | --- |
| M-1 | Mag `/metrics` er komen, en zo ja: afgeschermd met een aparte secret (voorstel uit INT4b) of alleen bereikbaar binnen het Docker-netwerk? |
| M-2 | Bouwen we de set hierboven ná de pilot, of pas als er een echte kijker is (dashboard/alert)? |

---

## Samenvatting van wat ik van je nodig heb

| # | Besluit | Mijn advies |
| --- | --- | --- |
| **C-3** | Herstelpad accepteren of bouwen | A nu, B vóór je het weggeeft |
| **M-1** | Afscherming `/metrics` | alleen binnen het Docker-netwerk, geen publiek endpoint |
| **M-2** | Timing metricset | ná de pilot, en alleen de zeven hierboven |
