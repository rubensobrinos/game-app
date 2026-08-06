# Prompt — T5-10: Host verliest verbinding (gescoped, niet het VIP-besluit)

**Status: HANDOFF aan INT-A/PR — geen bouwprompt meer.** Voormalige stap 1
("meet of er een server-side afkap-timeout bestaat") is al beantwoord: **nee,
die bestaat niet.** Geverifieerd (3 aug 2026): `host_disconnected` komt in
`server/` uitsluitend voor als commentaar/enum-waarde
(`server/architecture/state-machine.js:82`,
`server/composition/match-lifecycle.mjs:186` — "maakt er geen [onderscheid]").
Geen grace-, abandon- of recoverytimer. De enige grace in de server is
`deadlineGraceMs: 250` (`room-lifecycle.mjs:105`), en dat is de
antwoord-deadlinemarge — iets heel anders. Een room met een verdwenen host
blijft dus voor onbepaalde tijd gepauzeerd.

## Brondocument

`08-ACCESSIBILITY-AND-RESILIENCE.md` §7 "Host sluit tab": "korte
recoveryperiode; reconnect bij heropenen; mogelijke VIP-overdracht is OPEN;
na timeout nette beëindiging en uitslagbehoud waar mogelijk."

## Wat al werkt (geen actie nodig)

**Recoveryperiode + reconnect bij heropenen** — al aanwezig: `game:pause` met
reden `host_disconnected` bestaat server-side, en de pauze-overlay toont 'm
al aan spelers.

## Wat ontbreekt en waarom dit geen bouwtaak voor UI is

**Nette beëindiging na timeout, met uitslagbehoud** — kan niet gebouwd
worden zolang er geen server-side timeout is om op te reageren. Een
client-side timer verzinnen die de server niet heeft zou een tweede,
mogelijk afwijkende bron van waarheid worden — precies wat
`session-shell.mjs`'s eigen module-comment over `reconnect-state` al
vermijdt voor een vergelijkbare reden. Dit is dus een `HANDOFF`-item, geen
UI-taak.

## Wat hier bewust niet gebouwd wordt, met reden

- **VIP-overdracht** (een andere speler wordt host) — expliciet "OPEN" in het
  brondocument. Geen enkele aanname hierover: geen UI die suggereert dat
  overdracht mogelijk is, geen knop die nergens naartoe leidt.

## HANDOFF-voorstel aan INT-A/PR

1. Een server-side timeout ná `host_disconnected` (voorstel: enkele minuten,
   af te stemmen met INT-A/PR — geen UI-getal).
2. Bij afloop: een nieuw event (bv. `game:abandoned` of een `session:*`-
   variant) met de laatste bekende stand, zodat de client "uitslagbehoud"
   ook zichtbaar kan maken, niet alleen server-side data-behoud.
3. Zodra dit event bestaat: `session-shell.mjs` toont hetzelfde patroon als
   de bestaande `terminate()` (S21, commit `58eba07`) — duidelijke reden +
   terugkeeractie — mét de laatst bekende `standingsPayload` zichtbaar in
   plaats van een kaal foutscherm. Die clientkant is dan triviaal en hoeft
   niet op dit HANDOFF-antwoord te wachten om vast ontworpen te worden.

## Regels

- Spelers krijgen nooit de indruk dat ze zelf iets kunnen doen aan een
  hostloze room buiten wachten/vertrekken — geen valse actieknoppen.

## Definition of done

- Dit document zelf, als vastgelegde meting + HANDOFF-voorstel — geen code
  in deze prompt, dat volgt pas ná INT-A/PR's antwoord.
- `PROGRESS.md`'s rij expliciet gesplitst: "recovery: 1, gemeten (bestaat)",
  "timeout/uitslagbehoud: 0, wacht op HANDOFF-antwoord", "VIP-overdracht:
  blijft 0, wacht op productbesluit" — niet één cijfer dat alle drie verbergt.
