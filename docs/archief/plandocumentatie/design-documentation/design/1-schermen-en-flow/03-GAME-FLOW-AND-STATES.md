# 03 — Game Flow en States

## 1. Begrippen

- **Host:** gebruiker die de room aanmaakt en de gezamenlijke flow bestuurt.
- **Speler:** deelnemer die joint en antwoorden indient.
- **Podium:** optionele grote hostweergave; kan dezelfde hostsession op desktop/tablet zijn.
- **Room:** tijdelijke gamesessie met code, deelnemers en instellingen.
- **Ronde:** één vraag inclusief countdown, antwoordfase, reveal en rankingupdate.

## 2. Hoofdflow

```text
LANDING
  ├─ HOST: snel starten
  │    → ROOM_AANMAKEN
  │    → HOST_LOBBY
  │    → COUNTDOWN
  │    → VRAAG_ACTIEF
  │    → RONDE_GESLOTEN
  │    → REVEAL
  │    → SOCIALE_HEADLINE
  │    → LEADERBOARD
  │    → volgende ronde of PODIUM
  │    → REVANCHE / NIEUW_SPEL / AFSLUITEN
  │
  └─ SPELER: code / QR / link
       → ROOM_VALIDEREN
       → NAAM_KIEZEN
       → SPELER_LOBBY
       → COUNTDOWN
       → VRAAG_ACTIEF
       → ANTWOORD_BEZIG
       → ANTWOORD_BEVESTIGD
       → REVEAL
       → PERSOONLIJK_RESULTAAT
       → LEADERBOARD
       → volgende ronde of PODIUM
```

## 3. Global state model

| State | Entry trigger | Exit trigger | Hostactie | Speleractie |
|---|---|---|---|---|
| `LANDING` | site geopend | start/join | snel starten, aanpassen, code invoeren | code invoeren of QR/link volgen |
| `ROOM_CREATING` | snel starten | success/error | wachten/annuleren indien mogelijk | n.v.t. |
| `HOST_LOBBY` | room gemaakt | host start | starten, delen, vergrendelen, beheren | n.v.t. |
| `NAME_ENTRY` | room geldig | naam geaccepteerd | n.v.t. | naam kiezen, joinen |
| `PLAYER_LOBBY` | speler gejoined | host start | n.v.t. | uitnodigen, voorkeuren, verlaten |
| `COUNTDOWN` | host start/volgende ronde | timer einde | pauzeren alleen indien productbesluit | geen |
| `QUESTION_ACTIVE` | countdown einde | timer/alle antwoorden/host sluit | pauze, noodbeheer | één antwoord indienen |
| `ANSWER_SUBMITTING` | speler tapt | server bevestigt/error | n.v.t. | geen dubbele submit |
| `ANSWER_CONFIRMED` | submit bevestigd | ronde sluit | n.v.t. | wachten, evt. uitnodigen niet tijdens actieve ronde |
| `ROUND_CLOSED` | deadline/alle antwoorden | reveal gestart | geen antwoordmutatie | geen antwoordmutatie |
| `REVEAL` | ronde gesloten | revealduur/host vervolgt | presenteren | resultaat bekijken |
| `SOCIAL_HIGHLIGHT` | relevante headline | duur/host vervolgt | presenteren | headline bekijken |
| `LEADERBOARD` | scores bijgewerkt | volgende ronde/podium | doorgaan/pauze | positie bekijken |
| `PAUSED` | host pauzeert | host hervat/beëindigt | beheren | rustige wachtstate |
| `PODIUM` | laatste leaderboard | rematch/nieuw/exit | vervolg kiezen | resultaat delen/vervolg |
| `RECONNECTING` | verbinding verloren | herstel/timeout | status | wachten/handmatig opnieuw proberen |
| `GAME_ENDED` | host beëindigt/room verloopt | landing | nieuwe game | terug naar start |

## 4. Hostflow in detail

### 4.1 `ROOM_CREATING`

**UI:** primaire knop verandert direct naar `Potje maken…` met progressindicator.

**Success:** transitie naar lobby zonder extra bevestigingsscherm.

**Error:** behoud ingevoerde instellingen; toon menselijke fout en `Opnieuw proberen`.

**Acceptatiecriteria:**

- geen stille seconde na klik;
- dubbele roomcreatie wordt verhinderd;
- browser back creëert niet onbedoeld nog een room.

### 4.2 `HOST_LOBBY`

**Altijd zichtbaar:**

- QR;
- code;
- join-URL;
- aantal aanwezige spelers;
- primaire startactie;
- roomstatus: open/vergrendeld.

**Nieuwe speler:** teller pulseert subtiel, naam verschijnt geanimeerd, optionele sound cue.

**Startvoorwaarden:**

- bij nul spelers is start disabled met uitleg `Er moet minimaal één speler meedoen`;
- bij één of meer spelers toont label `Start game — N spelers`;
- host krijgt bij start geen extra generieke confirmatiemodal.

### 4.3 `QUESTION_ACTIVE`

Host ziet minimaal ronde, timer, aantal antwoorden en noodcontrols. Op grote schermen kan de inhoud visueel rijker zijn.

**Host mag niet:** individuele antwoorden vóór reveal zien.

**Vroeg sluiten:** alleen als productbesluit dit toestaat; UI moet duidelijk maken dat niet-antwoorders geen antwoord krijgen.

### 4.4 `PAUSED`

Pauze bevriest de relevante gameklok server-side.

Host ziet:

- `Hervatten` als primaire actie;
- spelers beheren;
- room vergrendelen/ontgrendelen;
- QR/code tonen;
- game beëindigen als destructieve actie.

Spelers zien geen beheercontrols, alleen status en eventueel de laatst veilige context.

### 4.5 `PODIUM`

Na laatste ronde wordt de complete ranglijst al berekend voordat animatie start. Zonder motion moet de definitieve uitslag direct beschikbaar zijn.

Acties:

1. `Revanche` — dezelfde configuratie en deelnemers, scores resetten;
2. `Nieuw spel` — terug naar configuratie met relevante defaults;
3. `Deel uitslag` — privacyvriendelijke samenvatting;
4. `Afsluiten`.

## 5. Spelerflow in detail

### 5.1 `ROOM_VALIDATING`

Via QR/link is de roomcode al ingevuld en verborgen of alleen informatief. Via handmatige invoer valideert de app na submit.

Fouten:

- code bestaat niet;
- room verlopen;
- room vergrendeld;
- game al gestart en late join niet toegestaan;
- room vol;
- netwerkfout.

Iedere fout heeft een specifieke vervolgstap.

### 5.2 `NAME_ENTRY`

Doel: één handeling tussen room en lobby.

- voorgestelde naam vooraf ingevuld;
- duidelijke maximale lengte;
- ongewenste/duplicaatnaam wordt begrijpelijk opgelost;
- één primaire knop `Ik doe mee`;
- aantal wachtenden mag als sociaal bewijs worden getoond.

### 5.3 `PLAYER_LOBBY`

Toont:

- bevestiging dat speler in juiste room zit;
- eigen naam/identiteit;
- aantal aanwezige spelers;
- `Nodig iemand uit`;
- status `De host start zo`;
- lokale voorkeuren voor taal, thema en geluid.

### 5.4 `ANSWER_SUBMITTING` en `ANSWER_CONFIRMED`

Na tap:

1. option krijgt active-state;
2. invoer wordt geblokkeerd tegen dubbel submit;
3. status wordt `Antwoord versturen…` wanneer netwerkbevestiging niet direct is;
4. bij succes wordt de gekozen optie `Verstuurd ✓`;
5. correctheid blijft verborgen;
6. bij fout blijft context behouden en verschijnt retry, tenzij deadline verstreken is.

### 5.5 `REVEAL` en persoonlijk resultaat

Speler ziet:

- correct antwoord;
- eigen gekozen antwoord;
- juist/onjuist/geen antwoord;
- behaalde punten;
- eventuele snelheidsbonus;
- rankbeweging;
- maximaal één relevante sociale headline.

## 6. Rondeverloop en timingbaseline

Exacte timing wordt na prototype-test vastgesteld. Baseline:

| Segment | Richtduur | Gedrag |
|---|---:|---|
| Countdown | 2,5–3,0 s | `3–2–1`, kort en gezamenlijk |
| Vraag actief | spelinstelling | timer rustig, laatste 3 s nadruk |
| Ronde sluiten | 0,3–0,6 s | input lock + overgangscue |
| Correct antwoord reveal | 1,0–1,8 s | inhoud en semantische kleuren |
| Persoonlijk resultaat | 1,5–3,0 s | punten en rank movement |
| Sociale headline | 1,5–2,5 s | alleen indien relevant |
| Leaderboard | 2,0–4,0 s | host kan automatische flow of vervolgactie hebben |

Geen vaste animatie mag een snelle host dwingen langer dan nodig te wachten. Autoprogress en hostgestuurd vervolg moeten technisch te ondersteunen zijn.

## 7. Randgevallen

### Niemand antwoordt

- reveal toont correct antwoord;
- sociale headline kan `Niemand durfde voor [antwoord] te gaan` tonen;
- score blijft ongewijzigd;
- geen kapotte nuldeling in antwoordverdeling.

### Iedereen antwoordt vroeg

- productbesluit: ronde kan automatisch sluiten of timer blijft lopen;
- aanbevolen: hostconfiguratie of standaard korte grace period van circa 0,5 s, daarna sluiten.

### Speler joint tijdens lobby

Normale joinflow.

### Speler joint tijdens actieve game

Afhankelijk van late-joininstelling:

- toegestaan: speler komt in veilige wachtstate en start volgende ronde;
- niet toegestaan: heldere melding met een route terug naar de homepage.

> **Niet in deze MVP:** een spectatoroptie. `DECISIONS.md` besluit 9 schrapt
> spectators — geen rol, geen token, geen projectie — en er bestaat geen
> spectatorcode in `server/`, `client/` of `shared/`. Een wachtoptie voor wie
> niet mag joinen is wél denkbaar, maar dat is dan een gewone speler die op de
> volgende ronde wacht, niet een aparte rol.

### Host verliest verbinding

- room blijft korte herstelperiode bestaan;
- host krijgt reconnecttoken/session recovery;
- spelers zien `De host maakt opnieuw verbinding`;
- bij definitief verlies: overdracht naar aangewezen VIP/volgende speler of nette beëindiging; keuze is OPEN technisch/productbesluit.

### Refresh door speler

- sessie wordt herkend;
- naam, score en roompositie blijven behouden;
- gebruiker landt in actuele veilige state;
- reeds verstuurd antwoord kan niet opnieuw worden gewijzigd.

### Dubbele tab

De nieuwste of eerste actieve sessie moet deterministisch leidend zijn. Toon op andere tab een uitleg in plaats van dubbele deelname.

## 8. State-events voor analytics en logging

Privacyvriendelijke events:

- room_create_started/succeeded/failed;
- player_join_started/succeeded/failed;
- game_started;
- round_started/closed;
- answer_submitted/confirmed/failed;
- reconnect_started/succeeded/failed;
- game_completed;
- rematch_started;
- share_invoked.

Geen vrije spelersnamen of antwoordinhoud in generieke telemetry zonder expliciete noodzaak.
