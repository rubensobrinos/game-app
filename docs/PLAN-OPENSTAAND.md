# Plan — wat er nog openstaat

**Peildatum:** 5 aug 2026, na de mobiele UX-ronde. **Eigenaar:** regie.

Alles wat níét aan staat of nog gebouwd moet worden, met omvang, afhankelijkheid
en een voorgestelde volgorde. Wat af is staat hier niet in — daarvoor is
`docs/agent-opdrachten/VOORTGANG.md` en `STATUS.md`.

---

## 1. Aan te zetten — gebouwd, maar staat uit

| Wat | Handeling | Wie |
| --- | --- | --- |
| **Metrics** | `METRICS_SECRET` (min. 16 tekens) in `.env`. Zonder die regel geeft `/metrics` een 404 en draait er geen tellerwerk | producteigenaar |
| **Deploy** | Na D3; alles staat gecommit klaar | regie |

Twee minuten werk samen. Het eerste is de enige reden dat we tijdens de pilot
geen cijfers hebben.

## 2. Beslissen — geen bouwwerk, wel een keuze

| # | Vraag | Waarom het wacht |
| --- | --- | --- |
| B1 | **Antwoord automatisch tonen** (punt 27) — bouwen of nog niet? | ~1,5 dag, 14–18 bestanden, en het botst met besluit 1 (één hostactie per ronde). Voorstel ligt klaar: onthullen wórdt dan de hostactie, dus nog steeds één knop |
| B2 | **Lege bovenhelft van de reveal** vlak ná je antwoord | Geen ruimteprobleem: de tussenstand is daar bewust verborgen omdat hij nog niet klopt. Vullen betekent iets nieuws bedenken |
| B3 | **Startknop schuift over de inhoud** bij scrollen | Alleen op te lossen met een andere schermopbouw (vaste voet + scrollend midden). De producteigenaar noemde het zweven "goud", dus dit is geen bugfix maar een herontwerp |
| B4 | **Twee complimentjes op scherm 5** (streak én "jij was de enige") | Past ruim, zegt iets anders. Smaak |
| B5 | **Swipe: strip van vier kaarten** i.p.v. vegen over één kaart | Kost een herziening van drie tests die eraan hangen dat de kaart de serverstand toont |

## 3. Klein bouwwerk — uren, geen dagen

| # | Wat | Omvang |
| --- | --- | --- |
| K1 | Home scrolt 13 px zodra de codefout zichtbaar wordt | uur |
| K2 | Hardgecodeerde 1c-kleuren vallen buiten de contrastcontrole — `contrast.test.mjs` dekt alleen tokens | halve dag, voorkomt herhaling van de magenta-bijna-misser |
| K3 | `player:leave` heeft geen compositiefunctie (geeft `UNSUPPORTED_EVENT`) | halve dag |
| K4 | Host kan naam/kleur van ánderen niet wijzigen | halve dag |
| K5 | Marktplaats-notitie verhuizen uit deze repo | minuten |

## 4. Middelgroot — dagen

| # | Wat | Omvang | Afhankelijk van |
| --- | --- | --- | --- |
| M1 | **Antwoord automatisch tonen** (als B1 = ja) | 1–1,5 dag | besluit B1 |
| M2 | **Redis keten-race** (~1 op 7 flaky) | 1 dag | — · moet vóór CI |
| M3 | **Continentfilter** (punt 7 uit de spec) | 1 dag | ondergrens van 2 continenten, anders kan "welke hoort er niet bij" geen vraag bouwen |
| M4 | **Odd-one-out: kleurpatroon-logica** | 1 dag | vraagt `pattern`/`palette` per échte vlag in de pool |
| M5 | Solopartij overleeft geen herlaadbeurt | 1 dag | bewuste grens vandaag; alleen nodig als solo serieus wordt |

## 5. Groot — weken of een eigen sprint

| # | Wat | Omvang | Waarom groot |
| --- | --- | --- | --- |
| G1 | **Spelersidentiteit** — besluit 41 (*Bulgaarse Koe* + vlag) | weken | 230 landen × 3 talen aan bijvoeglijke naamwoorden, met Spaanse verbuiging. Lost meteen punt 8 op (naam in je eigen taal) |
| G2 | **"Raad het land"** — de vierde game | groot | Contourdata (257 landen, gesleuteld op Engelse naam, zonder iso2) koppelen aan de pool van 230. Die koppeling is het werk, niet het tekenen |
| G3 | **Typed answers** | groot | Spec klaar; Mix en Typen staan daarom uitgeschakeld |
| G4 | "Wie had het goed" rijker tonen | middel | Hangt aan G1: zonder identiteit valt er weinig te tonen |

## 6. Dood hout — bestaat, maar niemand ziet het

| Wat | Besluit |
| --- | --- |
| `capitals_mc` en `higher_lower` | Volledig gebouwd en getest in de motor, maar niet in doelbeeld v2. Sinds besluit C-2 bewust onzichtbaar. **Weggooien of alsnog tonen is een productkeuze** — nu kost het niets, maar het is wel code die niemand onderhoudt |

## 7. Bewust zo gelaten

| Wat | Waarom |
| --- | --- |
| Timer stapt per hele seconde | Onvermijdelijk bij 12 segmenten en een rondeduur die er niet op deelt. Geen bug |
| Lobby past niet in één viewport | Besluit producteigenaar: de warm-up blijft opengeklapt. De eis is "alles wat je nodig hebt boven de vouw", en dat klopt |
| Pauzeren buiten een lopende ronde wordt geweigerd | Besluit 12: de resterende tijd is daar niet uit persistente state af te leiden |

---

## Voorgestelde volgorde

**Eerst, en het kost bijna niets:** metrics aanzetten, deployen, **de pilot
draaien** (`pilot-b-draaiboek.md`). Alles hierboven is gissen zolang er geen
avond met echte mensen is gespeeld. De pilot bepaalt of B2/B3 er nog toe doen
of dat er heel andere dingen bovenkomen.

**Daarna, in deze volgorde:**

1. **M2** (de flaky test) — die blokkeert CI en wordt alleen maar vervelender.
2. **K2** (contrastcontrole) — goedkoop, en voorkomt dat we de magenta-misser
   nog eens maken.
3. **B1 beantwoorden**; is het ja, dan **M1**.
4. **G1** (spelersidentiteit). Dit is de grootste, maar ook de leukste, en hij
   lost twee punten tegelijk op.
5. **G2** (Raad het land) als vierde game.

**K1, K3, K4 en K5** zijn opvulwerk: doen wanneer er een gaatje valt, niet
plannen.
