# Het paspoort — welke landen heb je al gehad

**Besluit 53** (producteigenaar, 6 aug 2026). Nog niet gebouwd.

> Aan het einde zie je een soort paspoort: welke landen jullie hebben gehad.
> Dat wordt opgeslagen, en een volgende keer onthoudt hij dat — "jullie hebben
> al zoveel landen gehad".

## Waarom dit sterker is dan het lijkt

Sinds 6 aug ligt `shared/content/shapes.data.mjs` in de repo: de contouren van
225 landen, gemigreerd voor "Raad het land". Dat is precies wat je nodig hebt
om een **wereldkaart in te kleuren** met de landen die je hebt gezien.

Het idee kost daarmee bijna geen nieuwe content. De vragen dragen de iso2 al,
de contouren liggen er, en de vlaggen ook.

Het past bovendien op de niche: dit is geen quizplatform-mechaniek maar een
geo-mechaniek. Een collectie opbouwen is precies wat een landenspel leuk maakt
en wat een generieke quiz-app níét kan nadoen.

## Eén wijziging op het voorstel: op het apparaat, niet in de sessie

Het voorstel zegt "opgeslagen in de sessie". Dat zou niet werken: een room
leeft vier uur en verdwijnt dan (`ROOM_TTL_SECONDS`). Je paspoort zou dus
precies verdwijnen op het moment dat het interessant wordt.

**Het hoort in de browser van de speler zelf** (`localStorage`, naast
`mp:session:*` en `mp:solo:*`). Dat past bij de harde regel dat er geen
accounts zijn: iedereen bouwt zijn eigen paspoort op zonder dat er ergens iets
van hem wordt opgeslagen. Niets gaat naar de server, dus er is ook geen
privacyvraag.

Gevolg: het wordt **"jij"** in plaats van "jullie". Dat is geen verlies — een
groep is nooit twee keer dezelfde, jouw telefoon wel.

## Wat het ongeveer is

| Onderdeel | Wat |
| --- | --- |
| Opslag | een verzameling iso2-codes per apparaat, plus wanneer je ze voor het eerst zag |
| Bijwerken | bij `round:ended`, één code per ronde — het land dat de vraag was |
| Tonen | op het podium, na de eindstand: *"Je hebt 47 van de 230 landen gezien."* |
| Groter | een wereldkaart waarin die 47 ingekleurd zijn, getekend met de contouren die er al liggen |

## De besluiten (6 aug 2026)

| Vraag | Besluit |
| --- | --- |
| Alleen goed geraden, of elk land dat je zag? | **Elk land dat je zag.** Het is een reisverslag, geen cijferlijst |
| Tellen de afleiders mee? | **Nee.** Alleen het land waar de vraag over ging |
| Wat als de kaart vol is? | **Een verrassing.** Wat die is, is nog niet bepaald — en dat hoeft ook niet vóór de bouw |

Dat eerste besluit maakt het bouwen bovendien eenvoudiger: je hoeft niet te
weten of iemand het goed had, alleen wélk land de vraag was. Dat staat al in
elke `round:ended`.

## Wat het niet moet worden

Geen profiel, geen account, geen ranglijst tussen apparaten. Zodra het paspoort
iets wordt dat je kunt verliezen of moet beschermen, botst het met de reden dat
deze app in tien seconden te starten is.

Dit is geen tijdelijke oplossing in afwachting van accounts. De producteigenaar
wijst erop dat die stap omslachtig is en dat we niet eens weten of gebruikers
accounts wíllen — dus het paspoort per apparaat ís het antwoord, niet de
goedkope versie ervan.

## Verwant

- De deelbare eindkaart uit `uit-de-marktvergelijking.md` — een paspoort is
  precies wat je op zo'n kaart wilt zetten.
- "Raad het land" (`raad-het-land.md`) levert de contourrenderer die dit
  visueel maakt. Bouw je die eerst, dan is de kaart bijna gratis.
