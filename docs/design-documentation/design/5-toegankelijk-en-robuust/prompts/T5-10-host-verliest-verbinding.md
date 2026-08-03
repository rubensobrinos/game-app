# Prompt — T5-10: Host verliest verbinding (gescoped, niet het VIP-besluit)

**Status in `PROGRESS.md`:** Host verliest verbinding | niveau 1 | bewijs:
gelezen ("Pauzereden `host_disconnected` bestaat en wordt getoond. Overdracht
of nette beëindiging is nog een open besluit.")

## Brondocument

`08-ACCESSIBILITY-AND-RESILIENCE.md` §7 "Host sluit tab": "korte
recoveryperiode; reconnect bij heropenen; mogelijke VIP-overdracht is OPEN;
na timeout nette beëindiging en uitslagbehoud waar mogelijk."

## Wat nu al kan (geen open besluit blokkeert dit)

- **Recoveryperiode + reconnect bij heropenen** — dit is grotendeels al
  aanwezig: `game:pause` met reden `host_disconnected` bestaat server-side, en
  de pauze-overlay toont 'm al aan spelers. Niet geverifieerd: is er een
  daadwerkelijke *timeout* die na X seconden iets anders doet, of blijft de
  room voor altijd gepauzeerd in afwachting van de host? Dat is eerst een
  meetvraag (net als `T5-3`), geen bouwvraag — meet dit eerst vóór er iets
  bijgebouwd wordt.
- **Nette beëindiging na timeout, met uitslagbehoud** — als er een server-side
  timeout blijkt te bestaan (of zodra die er komt), toont de client daarbij
  hetzelfde patroon als `session-shell.mjs`'s bestaande `terminate()` (S21,
  commit `58eba07`): een duidelijke reden + terugkeeractie, met — nieuw t.o.v.
  de bestaande S21-gevallen — de laatst bekende `standingsPayload` nog
  zichtbaar in plaats van een kaal foutscherm, zodat "uitslagbehoud" ook
  visueel klopt en niet alleen server-side data-behoud betekent.

## Wat hier bewust niet gebouwd wordt, met reden

- **VIP-overdracht** (een andere speler wordt host) — expliciet "OPEN" in het
  brondocument. Geen enkele aanname hierover: geen UI die suggereert dat
  overdracht mogelijk is, geen knop die nergens naartoe leidt.

## Contract

1. Eerst meten (zie `T5-3`'s aanpak): bestaat er server-side al een
   afkap-timeout ná `host_disconnected`, en wat gebeurt er dan? Zonder een
   timeout is er niets om vervolgens client-side op te reageren — dit
   bepaalt of de rest van deze prompt nu al uitvoerbaar is of een
   `HANDOFF`-item aan INT-A/PR wordt.
2. Als de timeout bestaat: `session-shell.mjs`'s event-afhandeling voor het
   resulterende serverevent (waarschijnlijk een `session:*`- of
   `game:*`-variant, af te leiden uit wat stap 1 oplevert) toont een
   S21-achtig scherm mét de laatste `standingsPayload`, niet alleen tekst.

## Regels

- Geen gok naar een events-vorm die niet bevestigd is — als stap 1 geen
  bestaande timeout vindt, stopt deze prompt bij een `HANDOFF`-item, wordt er
  geen client-side timer verzonnen die de server niet heeft (dat zou een
  tweede, mogelijk afwijkende bron van waarheid worden — precies wat
  `session-shell.mjs`'s eigen module-comment over `reconnect-state` al
  vermijdt voor een vergelijkbare reden).
- Spelers krijgen nooit de indruk dat ze zelf iets kunnen doen aan een
  hostloze room buiten wachten/vertrekken — geen valse actieknoppen.

## Definition of done

- Stap 1's uitkomst is vastgelegd (bestaat de timeout, en zo ja: welk event,
  welke duur) — ook als het antwoord "nee, nog niet" is, telt dat als
  voltooide meting, niet als openstaand.
- Als er iets te bouwen viel: geverifieerd met `transport-mock.mjs` (die moet
  er dan zelf ook een variant van simuleren) dat het S21-scherm de laatste
  uitslag toont.
- `PROGRESS.md`'s rij expliciet gesplitst: "recovery/timeout: [niveau]" en
  "VIP-overdracht: blijft 0, wacht op productbesluit" — niet één cijfer dat
  beide verbergt.
