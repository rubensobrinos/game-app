# Agent 1 — fase 2: een speler die weggaat

Fase 1 (`autoReveal`) is gemerged. De correctie daarop doet de lead zelf —
**raak `match-lifecycle.mjs`, `socket.mjs` en de hostbalk deze fase niet aan
voor iets dat met onthullen te maken heeft.**

## Wat er stuk is

`player:leave` staat in het protocol maar doet niets. `socket.mjs` logt
`clientevent zonder compositiefunctie` en geeft `UNSUPPORTED_EVENT` terug; er
is geen `leaveRoom()` in `room-lifecycle.mjs`. Een speler die de tab sluit of
op "verlaten" tikt, blijft dus in de lijst staan.

## Wat het moet doen

Een vertrek telt niet meer mee, verdwijnt uit de spelerslijst, en de anderen
zien dat via `room:player-changed`.

`kickPlayer` heeft dat pad al: het zet `left`/`kicked` op de speler en zendt de
wijziging uit. Dit is de vrijwillige variant ervan — leen die structuur in
plaats van een tweede te bedenken.

## De randen die je moet afdekken

| Geval | Wat er hoort te gebeuren |
| --- | --- |
| De host vertrekt | Zie hieronder — dit is de lastige |
| Speler had al punten | Blijft in de eindstand staan; hij heeft ze verdiend |
| Speler vertrekt tijdens een lopende ronde | De ronde eindigt niet vroegtijdig op "iedereen heeft geantwoord" door zíjn ontbrekende antwoord |
| Speler vertrekt in de lobby | Gewoon weg uit de lijst |
| Zelfde speler komt terug | Mag opnieuw joinen zolang de room dat toestaat |

**De host die vertrekt is een productvraag, geen technische.** Onderzoek wat er
vandaag gebeurt bij een hostdisconnect en **bouw geen nieuw hostoverdrachts-
mechanisme**. Beschrijf wat je vindt; de lead legt het voor.

## Niet doen

- Geen hostoverdracht bouwen.
- Niets aan `autoReveal` of het onthullen — dat is fase 1 en van de lead.
- De kickflow niet verbouwen; alleen hergebruiken.
